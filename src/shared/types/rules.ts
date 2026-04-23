/**
 * Governance rule types.
 *
 * Rules define architectural constraints that are checked against the
 * ArchitectureModel graph with pure graph traversal.
 *
 * The rule engine auto-generates defaults based on the detected architecture
 * pattern and writes them to the project rules file for user customization.
 */

import type { ArchitecturePattern, ViolationSeverity, ComponentType } from './architecture';

// ─── Rule Types ─────────────────────────────────────────────────────

export type RuleType =
  | 'no-layer-bypass'
  | 'no-dependency-cycle'
  | 'max-dependencies'
  | 'no-orphan'
  | 'custom-forbidden-dependency';

// ─── Rule Definitions (discriminated union on `type`) ───────────────

export type GovernanceRule =
  | NoLayerBypassRule
  | NoDependencyCycleRule
  | MaxDependenciesRule
  | NoOrphanRule
  | CustomForbiddenDependencyRule;

interface BaseRule {
  type: RuleType;
  severity: ViolationSeverity;
  enabled: boolean;
}

export interface NoLayerBypassRule extends BaseRule {
  type: 'no-layer-bypass';
}

export interface NoDependencyCycleRule extends BaseRule {
  type: 'no-dependency-cycle';
}

export interface MaxDependenciesRule extends BaseRule {
  type: 'max-dependencies';
  params: {
    max: number;
    /** Component types exempt from this rule (e.g., entry-point types like 'module', 'configuration') */
    exemptTypes?: ComponentType[];
  };
}

export interface NoOrphanRule extends BaseRule {
  type: 'no-orphan';
}

export interface CustomForbiddenDependencyRule extends BaseRule {
  type: 'custom-forbidden-dependency';
  params: {
    /** Source component type that must NOT depend on target component type */
    from: ComponentType;
    to: ComponentType;
    /** Optional human-readable reason */
    reason?: string;
  };
}

// ─── Constants for Settings UI ──────────────────────────────────────

/** Built-in rule types (cannot be deleted by the user) */
export const BUILT_IN_RULE_TYPES: RuleType[] = [
  'no-layer-bypass',
  'no-dependency-cycle',
  'max-dependencies',
  'no-orphan',
];

/** All ComponentType values for dropdown rendering */
export const COMPONENT_TYPE_OPTIONS: ComponentType[] = [
  'controller', 'service', 'repository', 'model', 'middleware', 'utility',
  'configuration', 'gateway', 'port', 'adapter', 'use-case', 'domain-entity',
  'event-handler', 'factory', 'provider', 'module', 'other',
];

// Rules file schema

export interface RulesFileSchema {
  /** Schema version for future migration */
  version: 1;
  /** The pattern these defaults were generated for */
  generatedForPattern: ArchitecturePattern;
  rules: GovernanceRule[];
}
