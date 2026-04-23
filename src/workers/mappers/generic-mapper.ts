/**
 * Generic Mapper — fallback for languages with tree-sitter grammars
 * but no dedicated mapper.
 *
 * Uses common tree-sitter node type naming conventions to extract
 * basic structure. Won't be as accurate as dedicated mappers,
 * but provides enough structure for deterministic inventory.
 */

import type {
  FileStructure,
  ClassNode,
  FunctionNode,
  ImportNode,
  ExportNode,
  InterfaceNode,
} from '../../shared/types/architecture';
import type { TreeSitterNode, LanguageMapper } from './index';

// ─── Common Node Type Patterns ────────────────────────────────────────

/** Node types that commonly represent class-like constructs across languages */
const CLASS_TYPES = new Set([
  'class_declaration',
  'class_definition',
  'class_specifier',
  'struct_declaration',
  'struct_definition',
  'struct_item',
  'enum_declaration',
  'enum_definition',
  'enum_item',
  'trait_item',         // Rust
  'impl_item',          // Rust
  'object_declaration',  // Kotlin
]);

/** Node types that commonly represent function-like constructs */
const FUNCTION_TYPES = new Set([
  'function_declaration',
  'function_definition',
  'function_item',       // Rust
  'method_declaration',
  'method_definition',
  'constructor_declaration',
  'func_literal',        // Go
]);

/** Node types for import statements */
const IMPORT_TYPES = new Set([
  'import_declaration',
  'import_statement',
  'import_from_statement',
  'use_declaration',      // Rust
  'use_item',
  'include_expression',   // PHP
  'require_expression',
]);

/** Node types for export/public declarations */
const EXPORT_TYPES = new Set([
  'export_statement',
  'export_declaration',
  'module_declaration',
]);

// ─── Helpers ──────────────────────────────────────────────────────────

function getNodeText(node: TreeSitterNode | null): string {
  return node?.text?.trim() ?? '';
}

function findNamedChild(node: TreeSitterNode, fieldName: string): TreeSitterNode | null {
  return node.childForFieldName(fieldName);
}

function truncateText(text: string, maxLen: number = 100): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

// ─── Generic Extraction ───────────────────────────────────────────────

function extractGenericClass(node: TreeSitterNode): ClassNode {
  const nameNode = findNamedChild(node, 'name');
  const name = getNodeText(nameNode) || `anonymous_${node.startPosition.row}`;

  const methods: string[] = [];
  const properties: string[] = [];

  // Walk children looking for method/function definitions
  walkDescendants(node, (child) => {
    if (FUNCTION_TYPES.has(child.type)) {
      const methodName = findNamedChild(child, 'name');
      if (methodName) methods.push(getNodeText(methodName));
    }
  }, 2); // Only go 2 levels deep to avoid nested classes

  return {
    name,
    methods,
    properties,
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
  };
}

function extractGenericFunction(node: TreeSitterNode): FunctionNode {
  const nameNode = findNamedChild(node, 'name');
  const name = getNodeText(nameNode) || `anonymous_${node.startPosition.row}`;

  // Try to get parameter names
  const params: string[] = [];
  const paramsNode =
    findNamedChild(node, 'parameters') ??
    findNamedChild(node, 'parameter_list');
  if (paramsNode) {
    for (const param of paramsNode.namedChildren) {
      const pName =
        findNamedChild(param, 'name') ??
        findNamedChild(param, 'pattern');
      if (pName) params.push(getNodeText(pName));
    }
  }

  return {
    name,
    parameters: params,
    returnType: undefined,
    isAsync: node.children.some((c) => c.type === 'async'),
    isExported: false, // Generic mapper can't reliably detect this
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
  };
}

function extractGenericImport(node: TreeSitterNode): ImportNode {
  // Best effort: grab the string literal for the source
  const stringNodes = node.descendantsOfType('string_literal')
    .concat(node.descendantsOfType('string'))
    .concat(node.descendantsOfType('interpreted_string_literal'));

  const source = stringNodes.length > 0
    ? getNodeText(stringNodes[0]).replace(/^['"`]|['"`]$/g, '')
    : truncateText(getNodeText(node), 200);

  return {
    source,
    symbols: [],
    isRelative: source.startsWith('.') || source.startsWith('/'),
  };
}

/**
 * Walk descendants up to a given depth, calling visitor for each.
 */
function walkDescendants(
  node: TreeSitterNode,
  visitor: (node: TreeSitterNode) => void,
  maxDepth: number,
  currentDepth: number = 0,
): void {
  if (currentDepth > maxDepth) return;
  for (const child of node.children) {
    visitor(child);
    walkDescendants(child, visitor, maxDepth, currentDepth + 1);
  }
}

// ─── Main Mapper ──────────────────────────────────────────────────────

export const genericMapper: LanguageMapper = (tree, filePath, rawText, language) => {
  const root = tree.rootNode;
  const classes: ClassNode[] = [];
  const functions: FunctionNode[] = [];
  const imports: ImportNode[] = [];
  const exports: ExportNode[] = [];
  const interfaces: InterfaceNode[] = [];

  // Walk top-level children
  for (const node of root.children) {
    if (CLASS_TYPES.has(node.type)) {
      classes.push(extractGenericClass(node));
    } else if (FUNCTION_TYPES.has(node.type)) {
      functions.push(extractGenericFunction(node));
    } else if (IMPORT_TYPES.has(node.type)) {
      imports.push(extractGenericImport(node));
    } else if (EXPORT_TYPES.has(node.type)) {
      // Look for inner declarations
      for (const child of node.children) {
        if (CLASS_TYPES.has(child.type)) {
          classes.push(extractGenericClass(child));
        } else if (FUNCTION_TYPES.has(child.type)) {
          const fn = extractGenericFunction(child);
          fn.isExported = true;
          functions.push(fn);
        }
      }
    }
  }

  // For generic mapper, assume all top-level names are exported
  for (const cls of classes) {
    exports.push({ name: cls.name, kind: 'class' });
  }
  for (const fn of functions) {
    exports.push({ name: fn.name, kind: 'function' });
  }

  const lineCount = rawText.split('\n').length;

  return {
    filePath,
    language,
    classes,
    functions,
    imports,
    exports,
    interfaces,
    rawText,
    lineCount,
  };
};
