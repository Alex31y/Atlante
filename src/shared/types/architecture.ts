/**
 * Legacy architecture domain types.
 *
 * These types represent the SEMANTIC understanding of a codebase's architecture.
 * They are language-agnostic — the same types describe a TypeScript Express API,
 * a Java Spring Boot app, and a Python FastAPI project.
 *
 * Legacy architecture data types retained for old cache compatibility.
 * The webview consumes these types for rendering.
 */

// ─── Evidence Citations ─────────────────────────────────────────────

/** A single piece of evidence backing a claim in the approachable text.
 *  Referenced by [N] markers in identity/structure/signals paragraphs. */
export interface EvidenceCitation {
  id: number;
  /** The structural claim this evidence supports */
  claim: string;
  /** The proof — what was found in the codebase */
  evidence: string;
  /** Where the evidence came from */
  source: 'import-graph' | 'manifest' | 'agent-investigation';
  /** Related file paths (optional) */
  files?: string[];
}

// ─── Architecture Patterns ──────────────────────────────────────────

export type ArchitecturePattern =
  | 'layered'
  | 'hexagonal'
  | 'mvc'
  | 'clean-architecture'
  | 'microservices-monolith'
  | 'cqrs'
  | 'event-driven'
  | 'pipe-and-filter'
  | 'modular'
  | 'unknown';

// ─── Components ─────────────────────────────────────────────────────

export type ComponentType =
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'middleware'
  | 'utility'
  | 'configuration'
  | 'gateway'
  | 'port'
  | 'adapter'
  | 'use-case'
  | 'domain-entity'
  | 'event-handler'
  | 'factory'
  | 'provider'
  | 'module'
  | 'other';

export interface ArchComponent {
  /** Stable unique identifier. Format: "component:<name-slug>" */
  id: string;
  /** Human-readable name (e.g., "AuthenticationService", "UserRepository") */
  name: string;
  /** Architectural role */
  type: ComponentType;
  /** Layer this component belongs to (if architecture is layered) */
  layer?: string;
  /** File paths that constitute this component */
  files: string[];
  /** Human-readable descriptions of what this component does */
  responsibilities: string[];
  /** Content hash (SHA-256 of concatenated file contents) for cache invalidation */
  contentHash: string;
}

// ─── Relations ──────────────────────────────────────────────────────

export type RelationType =
  | 'depends-on'
  | 'implements'
  | 'extends'
  | 'calls'
  | 'emits'
  | 'listens-to'
  | 'uses'
  | 'creates';

export interface ArchRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  /** Human-readable label (e.g., "via REST API", "through repository") */
  label?: string;
}

// ─── Layers ─────────────────────────────────────────────────────────

export interface ArchLayer {
  /** Layer name (e.g., "presentation", "domain", "infrastructure") */
  name: string;
  /** Order from top (0 = topmost, e.g., controllers) to bottom (e.g., database) */
  order: number;
  /** Component IDs in this layer */
  componentIds: string[];
  /** Deployment stack this layer belongs to (e.g., "backend", "frontend"). Layers in different stacks have independent hierarchies. */
  stack?: string;
  /** True for middleware/config/utility layers that are legitimately referenced from any layer in their stack */
  crossCutting?: boolean;
}

// ─── Violations ─────────────────────────────────────────────────────

export type ViolationSeverity = 'error' | 'warning' | 'info';

export type ViolationType =
  | 'dependency-cycle'
  | 'layer-bypass'
  | 'srp-violation'
  | 'orphan-component'
  | 'god-component'
  | 'custom'
  | 'anti-pattern'
  | 'cross-cutting-concern'
  | 'pattern-inconsistency';

export interface ArchViolation {
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  /** Human-readable description of the violation */
  message: string;
  /** Component IDs involved in this violation */
  affectedComponentIds: string[];
  /** Relation IDs involved (for cycle/bypass violations) */
  affectedRelationIds?: string[];
  /** Optional suggestion for how to fix */
  suggestion?: string;
}

// ─── Architecture Model (top-level) ────────────────────────────────

export interface ArchitectureModel {
  /** Detected dominant architecture pattern */
  pattern: ArchitecturePattern;
  /** All identified architectural components */
  components: ArchComponent[];
  /** All relationships between components */
  relations: ArchRelation[];
  /** Layer structure (if layered architecture detected) */
  layers?: ArchLayer[];
  /** Detected violations */
  violations: ArchViolation[];
  /** Component IDs identified by Phase D as composition hubs — orchestrators/routers
   *  whose high connectivity is structural (composing children), not coupling.
   *  RuleEngine exempts these from god-component violations. */
  compositionHubs?: string[];
  /** Analysis metadata */
  metadata: ArchitectureMetadata;
}

export interface ArchitectureMetadata {
  /** Timestamp of analysis */
  analyzedAt: number;
  /** Number of files included in the analysis */
  filesAnalyzed: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Total token usage for this analysis */
  tokenUsage: {
    input: number;
    output: number;
  };
  /** Time taken for analysis in milliseconds */
  analysisTimeMs: number;
}

// ─── Architecture Hypothesis (Phase B output) ──────────────────────

export interface ArchitectureHypothesis {
  pattern: ArchitecturePattern;
  /** Identified logical modules/layers and their file patterns */
  modules: Array<{
    name: string;
    role: string;
    filePatterns: string[];
  }>;
  /** Key entry point files to deep-analyze in Phase C */
  keyFiles: string[];
  /** Detected framework/library context */
  framework?: string;
  /** Confidence in the hypothesis (0-1) */
  confidence: number;
  /** 2-3 key architectural strengths */
  strengths?: string[];
  /** 2-3 architectural concerns or risks */
  concerns?: string[];
  /** 2-3 actionable improvement suggestions */
  suggestions?: string[];
  /** Deployment stacks grouping modules (e.g., "backend", "frontend") */
  stacks?: Array<{ name: string; moduleNames: string[] }>;
  /** Module names that are cross-cutting (legitimately referenced from any layer in their stack) */
  crossCuttingModules?: string[];
  /** Agent-generated approachable summaries (Phase E) */
  approachable?: {
    identity: string;
    structure: string;
    modules: string;
    signals: string;
    /** Evidence citations referenced by [N] markers in the text */
    citations?: EvidenceCitation[];
  };
  /** Questions about architectural ambiguities */
  questions?: Array<{
    id: string;
    text: string;
    type: 'choice' | 'confirm';
    options?: Array<{ label: string; description: string }>;
    context?: string;
    defaultAnswer: string;
    effect: 'deprioritize-module' | 'add-module' | 'split-stack' | 'adjust-confidence';
    targetModule?: string;
  }>;
}

// ─── File Structure (AST Worker output — language agnostic) ────────

export interface FileStructure {
  filePath: string;
  language: string;
  classes: ClassNode[];
  functions: FunctionNode[];
  imports: ImportNode[];
  exports: ExportNode[];
  interfaces: InterfaceNode[];
  /** Full file content retained for legacy snapshots */
  rawText: string;
  lineCount: number;
}

export interface ClassNode {
  name: string;
  methods: string[];
  properties: string[];
  decorators?: string[];
  startLine: number;
  endLine: number;
}

export interface FunctionNode {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
  /** SonarSource cognitive complexity score (computed from AST control flow walk) */
  cognitiveComplexity?: number;
  /** Maximum nesting depth of control flow structures */
  maxNestingDepth?: number;
  /** Maximum number of boolean operators (&&, ||, ??) in a single condition expression */
  maxBooleanOpsInExpr?: number;
}

export interface ImportNode {
  /** The module/package being imported from */
  source: string;
  /** Specific symbols imported (empty = whole module) */
  symbols: string[];
  /** Whether this is a relative import (./foo) or package import (express) */
  isRelative: boolean;
}

export interface ExportNode {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'type' | 'default';
}

export interface InterfaceNode {
  name: string;
  methods: string[];
  properties: string[];
  startLine: number;
  endLine: number;
}

// ─── Logic Flow (on-demand per component) ──────────────────────────

export interface LogicFlowStep {
  id: string;
  name: string;
  description: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  type: 'function' | 'method' | 'handler' | 'constructor' | 'getter';
}

export interface LogicFlowEdge {
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface LogicFlow {
  id: string;
  name: string;
  description: string;
  steps: LogicFlowStep[];
  edges: LogicFlowEdge[];
}

export interface ComponentLogicResult {
  componentId: string;
  flows: LogicFlow[];
}
