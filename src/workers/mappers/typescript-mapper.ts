/**
 * TypeScript/JavaScript Mapper
 *
 * Extracts FileStructure from a tree-sitter TypeScript/JavaScript AST.
 * This is the most critical mapper — TS/JS is the primary target.
 *
 * Handles:
 * - Classes (with methods, properties, decorators)
 * - Functions (declarations + arrow functions assigned to const)
 * - Imports (named, default, namespace, relative vs package)
 * - Exports (named, default, re-exports)
 * - Interfaces / Type aliases
 *
 * Uses tree-sitter node types for TypeScript grammar:
 * https://github.com/tree-sitter/tree-sitter-typescript
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
import { computeComplexity } from './complexity';

// ─── Helpers ──────────────────────────────────────────────────────────

function getNodeText(node: TreeSitterNode | null): string {
  return node?.text?.trim() ?? '';
}

function findChild(node: TreeSitterNode, type: string): TreeSitterNode | null {
  return node.children.find((c) => c.type === type) ?? null;
}

function findChildren(node: TreeSitterNode, type: string): TreeSitterNode[] {
  return node.children.filter((c) => c.type === type);
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

  // Extract decorators
  for (const child of node.children) {
    if (child.type === 'decorator') {
      const decoratorName = getNodeText(child).replace(/^@/, '');
      decorators.push(decoratorName);
    }
  }

  // Extract body members
  const body = findChild(node, 'class_body');
  if (body) {
    for (const member of body.namedChildren) {
      switch (member.type) {
        case 'method_definition': {
          const methodName = findNamedChild(member, 'name');
          if (methodName) methods.push(getNodeText(methodName));
          break;
        }
        case 'public_field_definition':
        case 'property_definition': {
          const propName = findNamedChild(member, 'name');
          if (propName) properties.push(getNodeText(propName));
          break;
        }
        // Handle shorthand properties and index signatures
        case 'field_definition': {
          const fieldName = findNamedChild(member, 'name');
          if (fieldName) properties.push(getNodeText(fieldName));
          break;
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

// ─── Function Extraction ──────────────────────────────────────────────

function extractFunction(node: TreeSitterNode, isExported: boolean): FunctionNode {
  const nameNode = findNamedChild(node, 'name');
  const name = getNodeText(nameNode);
  const params = extractParameters(node);
  const returnType = extractReturnType(node);
  const isAsync = node.children.some((c) => c.type === 'async');

  // Compute complexity from function body
  const body = findChild(node, 'statement_block');
  const { cognitiveComplexity, maxNestingDepth, maxBooleanOpsInExpr } = body
    ? computeComplexity(body)
    : { cognitiveComplexity: 0, maxNestingDepth: 0, maxBooleanOpsInExpr: 0 };

  return {
    name,
    parameters: params,
    returnType: returnType || undefined,
    isAsync,
    isExported,
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    cognitiveComplexity,
    maxNestingDepth,
    maxBooleanOpsInExpr,
  };
}

/**
 * Extract arrow function assigned to a variable:
 * const myFunc = async (param: Type) => { ... }
 */
function extractArrowFunction(
  declarator: TreeSitterNode,
  isExported: boolean,
  parentNode: TreeSitterNode,
): FunctionNode | null {
  const nameNode = findNamedChild(declarator, 'name');
  const value = findNamedChild(declarator, 'value');

  if (!nameNode || !value || value.type !== 'arrow_function') return null;

  const name = getNodeText(nameNode);
  const params = extractParameters(value);
  const returnType = extractReturnType(value);
  const isAsync = value.children.some((c) => c.type === 'async');

  // Compute complexity — arrow functions may have statement_block or expression body
  const body = findChild(value, 'statement_block');
  const { cognitiveComplexity, maxNestingDepth, maxBooleanOpsInExpr } = body
    ? computeComplexity(body)
    : { cognitiveComplexity: 0, maxNestingDepth: 0, maxBooleanOpsInExpr: 0 };

  return {
    name,
    parameters: params,
    returnType: returnType || undefined,
    isAsync,
    isExported,
    startLine: parentNode.startPosition.row,
    endLine: parentNode.endPosition.row,
    cognitiveComplexity,
    maxNestingDepth,
    maxBooleanOpsInExpr,
  };
}

function extractParameters(node: TreeSitterNode): string[] {
  const params: string[] = [];
  const formalParams = findChild(node, 'formal_parameters');
  if (formalParams) {
    for (const param of formalParams.namedChildren) {
      // Get the parameter name (first identifier)
      const paramName =
        findNamedChild(param, 'pattern') ??
        findNamedChild(param, 'name') ??
        findChild(param, 'identifier');
      if (paramName) {
        params.push(getNodeText(paramName));
      }
    }
  }
  return params;
}

function extractReturnType(node: TreeSitterNode): string {
  const returnTypeAnnotation = findChild(node, 'type_annotation');
  if (returnTypeAnnotation) {
    // Get the type after the ':'
    const typeNode = returnTypeAnnotation.namedChildren[0];
    return typeNode ? getNodeText(typeNode) : '';
  }
  return '';
}

// ─── Import Extraction ────────────────────────────────────────────────

function extractImport(node: TreeSitterNode): ImportNode | null {
  // import_statement can be:
  // import { Foo, Bar } from 'module'
  // import Foo from 'module'
  // import * as Foo from 'module'
  // import 'module' (side-effect)

  const source = findChild(node, 'string') ?? findChild(node, 'template_string');
  if (!source) return null;

  // Remove quotes from source
  const rawSource = getNodeText(source).replace(/^['"`]|['"`]$/g, '');
  const isRelative = rawSource.startsWith('.') || rawSource.startsWith('/');
  const symbols: string[] = [];

  // import { Foo, Bar } from 'module'
  const importClause = findChild(node, 'import_clause');
  if (importClause) {
    // Named imports: { Foo, Bar }
    const namedImports = findChild(importClause, 'named_imports');
    if (namedImports) {
      for (const specifier of namedImports.namedChildren) {
        const name =
          findNamedChild(specifier, 'alias') ?? findNamedChild(specifier, 'name');
        if (name) symbols.push(getNodeText(name));
      }
    }

    // Default import: import Foo from 'module'
    const defaultImport = findChild(importClause, 'identifier');
    if (defaultImport) {
      symbols.push(getNodeText(defaultImport));
    }

    // Namespace import: import * as Foo from 'module'
    const nsImport = findChild(importClause, 'namespace_import');
    if (nsImport) {
      const alias = findChild(nsImport, 'identifier');
      if (alias) symbols.push(`* as ${getNodeText(alias)}`);
    }
  }

  return { source: rawSource, symbols, isRelative };
}

// ─── Dynamic Import / Require Extraction ─────────────────────────────

function extractDynamicImports(root: TreeSitterNode): ImportNode[] {
  const results: ImportNode[] = [];
  const callNodes = root.descendantsOfType('call_expression');

  for (const call of callNodes) {
    const callee = call.children[0];
    if (!callee) continue;

    // import('module') -- callee type is 'import'
    // require('module') -- callee is identifier with text 'require'
    const isDynamic = callee.type === 'import';
    const isRequire = callee.type === 'identifier' && callee.text === 'require';
    if (!isDynamic && !isRequire) continue;

    const args = call.children.find((c) => c.type === 'arguments');
    if (!args || args.namedChildren.length === 0) continue;

    const firstArg = args.namedChildren[0];
    if (firstArg.type !== 'string' && firstArg.type !== 'template_string') continue;

    const rawSource = getNodeText(firstArg).replace(/^['"`]|['"`]$/g, '');
    if (!rawSource || rawSource.includes('${')) continue;

    const isRelative = rawSource.startsWith('.') || rawSource.startsWith('/');
    results.push({ source: rawSource, symbols: [], isRelative });
  }

  return results;
}

// ─── Export Extraction ────────────────────────────────────────────────

function extractExports(node: TreeSitterNode): ExportNode[] {
  const exports: ExportNode[] = [];
  const isDefault = node.children.some((c) => c.type === 'default');

  // Export of a declaration: export function foo() {}
  const declaration = findChild(node, 'function_declaration')
    ?? findChild(node, 'class_declaration')
    ?? findChild(node, 'interface_declaration')
    ?? findChild(node, 'type_alias_declaration')
    ?? findChild(node, 'lexical_declaration')
    ?? findChild(node, 'variable_declaration');

  if (declaration) {
    const nameNode = findNamedChild(declaration, 'name');
    if (nameNode) {
      let kind: ExportNode['kind'] = 'variable';
      switch (declaration.type) {
        case 'function_declaration':
          kind = 'function';
          break;
        case 'class_declaration':
          kind = 'class';
          break;
        case 'interface_declaration':
          kind = 'interface';
          break;
        case 'type_alias_declaration':
          kind = 'type';
          break;
        case 'lexical_declaration':
        case 'variable_declaration': {
          // Check if it's an arrow function export
          const declarators = declaration.descendantsOfType('variable_declarator');
          if (declarators.length > 0) {
            for (const d of declarators) {
              const dn = findNamedChild(d, 'name');
              const val = findNamedChild(d, 'value');
              if (dn) {
                exports.push({
                  name: getNodeText(dn),
                  kind: val?.type === 'arrow_function' ? 'function' : 'variable',
                });
              }
            }
            return exports;
          }
          break;
        }
      }

      exports.push({
        name: isDefault ? 'default' : getNodeText(nameNode),
        kind: isDefault ? 'default' : kind,
      });
    }
    return exports;
  }

  // Named export list: export { Foo, Bar }
  const exportClause = findChild(node, 'export_clause');
  if (exportClause) {
    for (const specifier of exportClause.namedChildren) {
      const name = findNamedChild(specifier, 'name');
      if (name) {
        exports.push({
          name: getNodeText(name),
          kind: 'variable', // Can't infer kind from export list
        });
      }
    }
    return exports;
  }

  // Default export of expression: export default someExpression
  if (isDefault) {
    exports.push({ name: 'default', kind: 'default' });
  }

  return exports;
}

// ─── Interface Extraction ─────────────────────────────────────────────

function extractInterface(node: TreeSitterNode): InterfaceNode {
  const nameNode = findNamedChild(node, 'name');
  const name = getNodeText(nameNode);

  const methods: string[] = [];
  const properties: string[] = [];

  const body =
    findChild(node, 'interface_body') ?? findChild(node, 'object_type');
  if (body) {
    for (const member of body.namedChildren) {
      switch (member.type) {
        case 'method_signature': {
          const methodName = findNamedChild(member, 'name');
          if (methodName) methods.push(getNodeText(methodName));
          break;
        }
        case 'property_signature': {
          const propName = findNamedChild(member, 'name');
          if (propName) properties.push(getNodeText(propName));
          break;
        }
        case 'call_signature':
          methods.push('__call');
          break;
        case 'index_signature':
          properties.push('__index');
          break;
      }
    }
  }

  return {
    name,
    methods,
    properties,
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
  };
}

// ─── Main Mapper ──────────────────────────────────────────────────────

export const typescriptMapper: LanguageMapper = (tree, filePath, rawText, language) => {
  const root = tree.rootNode;
  const classes: ClassNode[] = [];
  const functions: FunctionNode[] = [];
  const imports: ImportNode[] = [];
  const exports: ExportNode[] = [];
  const interfaces: InterfaceNode[] = [];

  for (const node of root.children) {
    switch (node.type) {
      // ── Classes ──
      case 'class_declaration':
        classes.push(extractClass(node));
        break;

      // ── Functions ──
      case 'function_declaration':
        functions.push(extractFunction(node, false));
        break;

      // ── Variable declarations (may contain arrow functions) ──
      case 'lexical_declaration':
      case 'variable_declaration': {
        const declarators = node.descendantsOfType('variable_declarator');
        for (const declarator of declarators) {
          const arrowFn = extractArrowFunction(declarator, false, node);
          if (arrowFn) functions.push(arrowFn);
        }
        break;
      }

      // ── Imports ──
      case 'import_statement': {
        const imp = extractImport(node);
        if (imp) imports.push(imp);
        break;
      }

      // ── Exports ──
      case 'export_statement': {
        // Check if it wraps a class
        const exportedClass = findChild(node, 'class_declaration');
        if (exportedClass) {
          classes.push(extractClass(exportedClass));
        }

        // Check if it wraps a function
        const exportedFunc = findChild(node, 'function_declaration');
        if (exportedFunc) {
          functions.push(extractFunction(exportedFunc, true));
        }

        // Check if it wraps an interface
        const exportedInterface = findChild(node, 'interface_declaration');
        if (exportedInterface) {
          interfaces.push(extractInterface(exportedInterface));
        }

        // Check if it wraps arrow functions
        const exportedLexical = findChild(node, 'lexical_declaration');
        if (exportedLexical) {
          const declarators = exportedLexical.descendantsOfType('variable_declarator');
          for (const declarator of declarators) {
            const arrowFn = extractArrowFunction(declarator, true, node);
            if (arrowFn) functions.push(arrowFn);
          }
        }

        // Extract export metadata
        const exportNodes = extractExports(node);
        exports.push(...exportNodes);
        break;
      }

      // ── Interfaces ──
      case 'interface_declaration':
        interfaces.push(extractInterface(node));
        break;

      // ── Type aliases (treat like interfaces) ──
      case 'type_alias_declaration': {
        const typeNameNode = findNamedChild(node, 'name');
        if (typeNameNode) {
          interfaces.push({
            name: getNodeText(typeNameNode),
            methods: [],
            properties: [],
            startLine: node.startPosition.row,
            endLine: node.endPosition.row,
          });
        }
        break;
      }
    }
  }

  // Capture dynamic import() and require() calls anywhere in the AST
  imports.push(...extractDynamicImports(root));

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
