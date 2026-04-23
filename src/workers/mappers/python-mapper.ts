/**
 * Python Mapper
 *
 * Extracts FileStructure from a tree-sitter Python AST.
 *
 * Handles:
 * - Classes (with methods via function_definition children)
 * - Functions (top-level, async, decorated)
 * - Imports (import x, from x import y, relative imports)
 * - Exports (Python: all top-level names are implicitly exported, __all__ if present)
 *
 * Uses tree-sitter node types for Python grammar:
 * https://github.com/tree-sitter/tree-sitter-python
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

// ─── Helpers ──────────────────────────────────────────────────────────

function getNodeText(node: TreeSitterNode | null): string {
  return node?.text?.trim() ?? '';
}

function findChild(node: TreeSitterNode, type: string): TreeSitterNode | null {
  return node.children.find((c) => c.type === type) ?? null;
}

function findNamedChild(node: TreeSitterNode, fieldName: string): TreeSitterNode | null {
  return node.childForFieldName(fieldName);
}

// ─── Class Extraction ─────────────────────────────────────────────────

function extractClass(node: TreeSitterNode): ClassNode {
  const nameNode = findNamedChild(node, 'name');
  const name = getNodeText(nameNode);

  const methods: string[] = [];
  const properties: string[] = [];
  const decorators: string[] = [];

  // Extract decorators (appear as siblings before the class in Python AST)
  // In tree-sitter python, decorators are part of decorated_definition parent
  // But we check node's own children too

  const body = findChild(node, 'block');
  if (body) {
    for (const member of body.namedChildren) {
      if (member.type === 'function_definition') {
        const methodName = findNamedChild(member, 'name');
        if (methodName) {
          const mName = getNodeText(methodName);
          // Skip __init__ from methods, extract assignments as properties instead
          if (mName === '__init__') {
            extractInitProperties(member, properties);
          }
          methods.push(mName);
        }
      }

      // Class-level assignments as properties
      if (member.type === 'expression_statement') {
        const assignment = findChild(member, 'assignment');
        if (assignment) {
          const left = findNamedChild(assignment, 'left');
          if (left && left.type === 'identifier') {
            properties.push(getNodeText(left));
          }
        }
      }
    }
  }

  return {
    name,
    methods,
    properties,
    decorators: decorators.length > 0 ? decorators : undefined,
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
  };
}

/** Extract self.xxx assignments from __init__ as properties */
function extractInitProperties(initNode: TreeSitterNode, properties: string[]): void {
  const body = findChild(initNode, 'block');
  if (!body) return;

  for (const stmt of body.namedChildren) {
    if (stmt.type === 'expression_statement') {
      const assignment = findChild(stmt, 'assignment');
      if (assignment) {
        const left = findNamedChild(assignment, 'left');
        if (left && left.type === 'attribute') {
          // self.property_name → extract property_name
          const attr = findNamedChild(left, 'attribute');
          if (attr) properties.push(getNodeText(attr));
        }
      }
    }
  }
}

// ─── Function Extraction ──────────────────────────────────────────────

function extractFunction(node: TreeSitterNode, isExported: boolean): FunctionNode {
  const nameNode = findNamedChild(node, 'name');
  const name = getNodeText(nameNode);
  const params = extractParameters(node);
  const returnType = extractReturnType(node);
  // In Python, async functions are a different node type or have 'async' keyword
  const isAsync = node.type === 'function_definition' &&
    node.children.some((c) => c.type === 'async');

  return {
    name,
    parameters: params,
    returnType: returnType || undefined,
    isAsync,
    isExported, // In Python, all top-level are "exported"
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
  };
}

function extractParameters(node: TreeSitterNode): string[] {
  const params: string[] = [];
  const paramsNode = findNamedChild(node, 'parameters');
  if (paramsNode) {
    for (const param of paramsNode.namedChildren) {
      if (param.type === 'identifier') {
        const name = getNodeText(param);
        if (name !== 'self' && name !== 'cls') params.push(name);
      } else if (param.type === 'typed_parameter' || param.type === 'default_parameter') {
        const nameNode = param.children[0];
        if (nameNode) {
          const name = getNodeText(nameNode);
          if (name !== 'self' && name !== 'cls') params.push(name);
        }
      } else if (param.type === 'typed_default_parameter') {
        const nameNode = param.children[0];
        if (nameNode) {
          const name = getNodeText(nameNode);
          if (name !== 'self' && name !== 'cls') params.push(name);
        }
      }
    }
  }
  return params;
}

function extractReturnType(node: TreeSitterNode): string {
  const returnType = findNamedChild(node, 'return_type');
  if (returnType) {
    return getNodeText(returnType);
  }
  return '';
}

// ─── Import Extraction ────────────────────────────────────────────────

function extractImports(node: TreeSitterNode): ImportNode[] {
  const imports: ImportNode[] = [];

  if (node.type === 'import_statement') {
    // import module, import module as alias
    for (const child of node.namedChildren) {
      if (child.type === 'dotted_name') {
        imports.push({
          source: getNodeText(child),
          symbols: [],
          isRelative: false,
        });
      } else if (child.type === 'aliased_import') {
        const name = findNamedChild(child, 'name');
        if (name) {
          imports.push({
            source: getNodeText(name),
            symbols: [],
            isRelative: false,
          });
        }
      }
    }
  }

  if (node.type === 'import_from_statement') {
    // Strategy: walk ALL children (not just named), find the module between 'from' and 'import' keywords
    let moduleNode: TreeSitterNode | null = null;
    let seenFrom = false;
    for (const child of node.children) {
      if (child.type === 'from') { seenFrom = true; continue; }
      if (child.type === 'import') break;
      if (seenFrom && (child.type === 'dotted_name' || child.type === 'relative_import')) {
        moduleNode = child;
        break;
      }
    }
    const source = moduleNode ? getNodeText(moduleNode) : '';
    const isRelative = source.startsWith('.');

    // Extract imported symbols: walk children AFTER the 'import' keyword
    const symbols: string[] = [];
    let pastImport = false;
    for (const child of node.children) {
      if (child.type === 'import') { pastImport = true; continue; }
      if (!pastImport) continue;
      // Skip commas and whitespace
      if (child.type === ',' || !child.type) continue;
      if (child.type === 'dotted_name') {
        symbols.push(getNodeText(child));
      } else if (child.type === 'aliased_import') {
        const name = findNamedChild(child, 'name');
        if (name) symbols.push(getNodeText(name));
      }
    }

    if (node.children.some((c: TreeSitterNode) => c.type === 'wildcard_import')) {
      symbols.push('*');
    }

    if (source) {
      imports.push({ source, symbols, isRelative });
    }
  }

  return imports;
}

// ─── Main Mapper ──────────────────────────────────────────────────────

export const pythonMapper: LanguageMapper = (tree, filePath, rawText, language) => {
  const root = tree.rootNode;
  const classes: ClassNode[] = [];
  const functions: FunctionNode[] = [];
  const imports: ImportNode[] = [];
  const exports: ExportNode[] = [];
  const interfaces: InterfaceNode[] = []; // Python doesn't have interfaces (Protocol is a class)

  for (const node of root.children) {
    switch (node.type) {
      case 'class_definition':
        classes.push(extractClass(node));
        break;

      case 'function_definition':
        functions.push(extractFunction(node, true));
        break;

      case 'decorated_definition': {
        // @decorator\nclass/function
        const decorators: string[] = [];
        let inner: TreeSitterNode | null = null;

        for (const child of node.children) {
          if (child.type === 'decorator') {
            decorators.push(getNodeText(child).replace(/^@/, ''));
          } else if (child.type === 'class_definition') {
            inner = child;
            const cls = extractClass(child);
            cls.decorators = decorators;
            classes.push(cls);
          } else if (child.type === 'function_definition') {
            inner = child;
            functions.push(extractFunction(child, true));
          }
        }
        break;
      }

      case 'import_statement':
      case 'import_from_statement':
        imports.push(...extractImports(node));
        break;

      // Track __all__ = [...] as explicit exports
      case 'expression_statement': {
        const assignment = findChild(node, 'assignment');
        if (assignment) {
          const left = findNamedChild(assignment, 'left');
          if (left && getNodeText(left) === '__all__') {
            const right = findNamedChild(assignment, 'right');
            if (right && right.type === 'list') {
              for (const item of right.namedChildren) {
                if (item.type === 'string') {
                  const name = getNodeText(item).replace(/^['"]|['"]$/g, '');
                  exports.push({ name, kind: 'variable' });
                }
              }
            }
          }
        }
        break;
      }
    }
  }

  // If no explicit __all__, export all top-level non-private names
  if (exports.length === 0) {
    for (const cls of classes) {
      if (!cls.name.startsWith('_')) {
        exports.push({ name: cls.name, kind: 'class' });
      }
    }
    for (const fn of functions) {
      if (!fn.name.startsWith('_')) {
        exports.push({ name: fn.name, kind: 'function' });
      }
    }
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
