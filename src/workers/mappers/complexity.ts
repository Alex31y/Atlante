/**
 * Complexity Metrics — Computed from tree-sitter AST nodes.
 *
 * Implements:
 * - Cognitive Complexity (SonarSource algorithm)
 * - Maximum Nesting Depth
 *
 * These run during the initial parse pass, adding negligible overhead.
 * Language-agnostic: uses configurable node type sets.
 */

import type { TreeSitterNode } from './index';

// ─── Node Type Sets ──────────────────────────────────────────────────

/**
 * Control flow node types that increment cognitive complexity
 * AND increase nesting depth for children.
 */
const NESTING_FLOW_TYPES = new Set([
  // TypeScript / JavaScript
  'if_statement',
  'for_statement',
  'for_in_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'catch_clause',
  'ternary_expression',
  // Python
  'if_statement',      // same name, no conflict
  'for_statement',     // same name
  'while_statement',   // same name
  'try_statement',
  'except_clause',
  'with_statement',
  'conditional_expression',
  // Go
  'if_statement',
  'for_statement',
  'select_statement',
]);

/**
 * `else` clauses increment complexity but do NOT increase nesting
 * (they're at the same conceptual level as `if`).
 */
const ELSE_TYPES = new Set([
  'else_clause',       // TypeScript / JavaScript
  'elif_clause',       // Python
  'else_clause',       // Go
]);

/** Boolean operators that add +1 complexity (no nesting penalty). */
const BOOLEAN_OPS = new Set(['&&', '||', '??']);

/** Node types containing boolean operators. */
const BINARY_EXPR_TYPES = new Set([
  'binary_expression',       // TypeScript / JavaScript
  'boolean_operator',        // Python
]);

// ─── Result Type ─────────────────────────────────────────────────────

export interface ComplexityResult {
  /** SonarSource cognitive complexity score */
  cognitiveComplexity: number;
  /** Maximum nesting depth of control flow structures */
  maxNestingDepth: number;
  /** Maximum boolean operators (&&, ||, ??) in a single condition expression */
  maxBooleanOpsInExpr: number;
}

// ─── Main Computation ────────────────────────────────────────────────

/**
 * Compute cognitive complexity and max nesting depth for a function body node.
 *
 * Algorithm (SonarSource):
 * - +1 for each control flow break (if, for, while, switch, catch, ternary)
 * - +1 extra per nesting level when inside another control flow
 * - +1 for else/elif (no nesting penalty)
 * - +1 for each boolean operator (&&, ||, ??) — no nesting penalty
 */
export function computeComplexity(bodyNode: TreeSitterNode): ComplexityResult {
  let cognitiveComplexity = 0;
  let maxNestingDepth = 0;
  let maxBooleanOpsInExpr = 0;

  function walk(node: TreeSitterNode, nestingDepth: number): void {
    // Nesting control flow: +1 base + nesting penalty, then recurse with depth+1
    if (NESTING_FLOW_TYPES.has(node.type)) {
      cognitiveComplexity += 1 + nestingDepth;
      const newDepth = nestingDepth + 1;
      if (newDepth > maxNestingDepth) maxNestingDepth = newDepth;

      // Count boolean operators in the condition expression
      const condOps = countConditionBooleanOps(node);
      if (condOps > maxBooleanOpsInExpr) maxBooleanOpsInExpr = condOps;

      for (const child of node.children) {
        walk(child, newDepth);
      }
      return;
    }

    // Else/elif: +1 flat (no nesting penalty, no depth increase)
    if (ELSE_TYPES.has(node.type)) {
      cognitiveComplexity += 1;
      for (const child of node.children) {
        walk(child, nestingDepth);
      }
      return;
    }

    // Boolean operators: +1 per operator (no nesting penalty)
    if (BINARY_EXPR_TYPES.has(node.type)) {
      const operator = extractOperator(node);
      if (operator && BOOLEAN_OPS.has(operator)) {
        cognitiveComplexity += 1;
      }
    }

    // Default: recurse with same nesting depth
    for (const child of node.children) {
      walk(child, nestingDepth);
    }
  }

  walk(bodyNode, 0);

  return { cognitiveComplexity, maxNestingDepth, maxBooleanOpsInExpr };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract the operator from a binary expression node.
 * In tree-sitter, the operator is typically a child with a short text like "&&".
 */
function extractOperator(node: TreeSitterNode): string | null {
  for (const child of node.children) {
    const t = child.type;
    if (t === '&&' || t === '||' || t === '??' || t === 'and' || t === 'or') {
      return t === 'and' ? '&&' : t === 'or' ? '||' : t;
    }
  }
  return null;
}

/** Node types that contain a condition expression (parenthesized or direct). */
const CONDITION_PARENT_TYPES = new Set([
  'parenthesized_expression', // JS/TS: if (...), while (...)
  'condition',                // Some grammars use a 'condition' field
]);

/**
 * Count boolean operators (&&, ||, ??) in the condition expression of a control flow node.
 * Walks the condition subtree (first parenthesized_expression child) and counts operators.
 */
function countConditionBooleanOps(controlNode: TreeSitterNode): number {
  // Find the condition — typically the first parenthesized_expression child
  let conditionNode: TreeSitterNode | null = null;
  for (const child of controlNode.children) {
    if (CONDITION_PARENT_TYPES.has(child.type)) {
      conditionNode = child;
      break;
    }
    // Ternary expressions: the condition is the first named child
    if (controlNode.type === 'ternary_expression' && BINARY_EXPR_TYPES.has(child.type)) {
      conditionNode = child;
      break;
    }
  }
  if (!conditionNode) return 0;

  let count = 0;
  function countOps(node: TreeSitterNode): void {
    if (BINARY_EXPR_TYPES.has(node.type)) {
      const op = extractOperator(node);
      if (op && BOOLEAN_OPS.has(op)) count++;
    }
    for (const child of node.children) {
      countOps(child);
    }
  }
  countOps(conditionNode);
  return count;
}
