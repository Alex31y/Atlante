/**
 * Code Health metrics types.
 *
 * Computed entirely from AST data (FileStructure[] + importGraph).
 * Pure number crunching.
 */

// ─── KPI Score Tiers ─────────────────────────────────────────────────

export type KpiTier = 'green' | 'yellow' | 'orange' | 'red';

export function kpiTier(score: number): KpiTier {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  if (score >= 30) return 'orange';
  return 'red';
}

export const KPI_TIER_COLORS: Record<KpiTier, string> = {
  green: '#c8bfa8',    // warm cream — healthy is quiet, nothing to see
  yellow: '#c4a46d',   // soft gold — fair, mild attention
  orange: '#c4845c',   // warm clay — needs work
  red: '#b85c4a',      // warm red-brown — critical
};

export const KPI_TIER_BG: Record<KpiTier, string> = {
  green: '#faf8f4',
  yellow: '#faf6ee',
  orange: '#f9f2ec',
  red: '#f8efeb',
};

// ─── Per-File Metrics ────────────────────────────────────────────────

export interface FileMetrics {
  /** Workspace-relative file path (forward-slash normalized) */
  filePath: string;
  /** Detected language */
  language: string;
  /** Total lines of code */
  loc: number;
  /** Number of methods (class methods + top-level functions) */
  methodCount: number;
  /** Number of classes */
  classCount: number;
  /** Number of interfaces / type definitions */
  interfaceCount: number;
  /** Outgoing dependencies: unique local files this file imports */
  fanOut: number;
  /** Incoming dependencies: unique local files that import this file */
  fanIn: number;
  /** Number of exports */
  exportCount: number;
  /** Number of imports */
  importCount: number;
  /** Dead code findings for this file */
  deadCode: DeadCodeFinding[];
  /** Violation counts mapped from ArchViolation[] via component→file */
  violationCounts: { error: number; warning: number; info: number };
  /** Deterministic file health score (0–100). Higher = easier to change safely. */
  healthScore: number;
  /** Deterministic impact score (0–100). Higher = larger blast radius if this file changes. */
  impactScore: number;
  /** Deterministic refactor priority score (0–100). Higher = deserves attention sooner. */
  priorityScore: number;
  /** @deprecated Compatibility alias for healthScore. */
  kpiScore: number;
  /** Health tier for color coding */
  kpiTier: KpiTier;

  // ── Architectural harmony fields ──
  /** Instability: fanOut / (fanIn + fanOut). 0 = maximally stable, 1 = maximally unstable */
  instability: number;
  /** File participates in a circular dependency */
  inCycle: boolean;
  /** Hub file: both high fan-in and high fan-out (top quartile of both) */
  isHub: boolean;
  /** Has at least one bidirectional dependency with another file */
  isTangled: boolean;
  /** Ratio of unused exports: (total − used) / total. 0 = all used, 1 = all wasted */
  exportWasteRatio: number;
  /** Number of wrong-direction dependencies (stable file → unstable file) */
  unstableDepCount: number;

  // ── Complexity fields (Phase E) ──
  /** Highest cognitive complexity among all functions in this file */
  maxCognitiveComplexity: number;
  /** Maximum nesting depth of control flow structures across all functions */
  maxNestingDepth: number;
  /** Longest function in this file (lines) */
  maxFunctionLength: number;
  /** Highest parameter count among all functions in this file */
  maxParamCount: number;
  /** God-file risk score 0–1 (composite of size, complexity, coupling) */
  godFileRisk: number;

  // ── Git history fields (populated when git data available) ──
  /** Commits within the churn window (default 90 days). Undefined if no git data. */
  churnScore?: number;
  /** churnScore x maxCognitiveComplexity, normalized 0-100. Undefined if no git data. */
  hotspotScore?: number;
  /** Number of unique authors who have touched this file */
  authorCount?: number;
  /** Days since the last commit touching this file */
  daysSinceLastChange?: number;
}

// ─── Dead Code Findings ──────────────────────────────────────────────

export type DeadCodeKind = 'unused-export' | 'orphan-file';

export interface DeadCodeFinding {
  kind: DeadCodeKind;
  filePath: string;
  /** The export symbol name (for unused-export), undefined for orphan-file */
  symbolName?: string;
  /** Human-readable explanation */
  message: string;
}

export interface DeadCodeSuppression {
  kind: DeadCodeKind;
  filePath: string;
  symbolName?: string;
  reason?: string;
}

// ─── Aggregate Summary ───────────────────────────────────────────────

export interface CodeHealthSummary {
  totalFiles: number;
  avgHealthScore: number;
  avgImpactScore: number;
  avgPriorityScore: number;
  /** @deprecated Compatibility alias for avgHealthScore. */
  avgKpi: number;
  filesInRedZone: number;
  deadCodeCount: number;
  deadCodeBreakdown: {
    unusedExportCount: number;
    orphanFileCount: number;
  };
  heaviestFile: { filePath: string; loc: number } | null;
  /** Function with the highest cognitive complexity across the codebase */
  hottestFunction: { filePath: string; functionName: string; complexity: number } | null;
  insightCount: number;
  /** Hottest hotspot: file with highest complexity x churn product */
  hottestHotspot?: { filePath: string; hotspotScore: number; churnScore: number; complexity: number };
  /** Vibe coding risk: 0–100, aggregated from god files, copy-paste, sprawl, surface area */
  vibeCodingRisk: number;
  /** Per-dimension breakdown of vibe coding risk (each 0–25) */
  vibeCodingBreakdown?: {
    godFiles: number;
    copyPaste: number;
    sprawl: number;
    surfaceArea: number;
  };
  /** Number of unused libraries detected from manifest files */
  unusedLibraryCount: number;
  computedAt: number;
}

// ─── Architecture Insights ──────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'info';
export type InsightEffort = 'quick-fix' | 'moderate' | 'significant';

export type InsightKind =
  | 'circular-dep'
  | 'hub-file'
  | 'tangled-pair'
  | 'unstable-dep'
  | 'export-waste'
  // Complexity insights (Phase E)
  | 'brain-method'
  | 'god-file'
  | 'deep-nesting'
  | 'complex-conditional'
  | 'high-param-count'
  // Vibe coding insights (Phase F)
  | 'copy-paste-smell'
  | 'dependency-sprawl'
  | 'high-surface-area'
  // Git history insights (Phase G)
  | 'hotspot'
  | 'bus-factor-risk'
  | 'stale-code'
  | 'git-healthy'
  | 'logical-coupling'
  // Agent-discovered insights
  | 'agent-discovered';

export interface ArchInsight {
  kind: InsightKind;
  /** Short title, e.g. "Circular Dependency" */
  title: string;
  /** Affected file paths (clickable in UI) */
  files: string[];
  /** Full educational description (shown in verbose mode) */
  description: string;
  /** Punchy one-liner (shown in tl;dr mode) */
  shortDescription: string;
  /** Approachable explanation — explains the concept, not just the symptom (tl;dr mode when available) */
  learnDescription?: string;
  /** Optional educational quote / principle name */
  principle?: string;
  /** Severity for prioritized sorting (critical → warning → info) */
  severity: InsightSeverity;
  /** Estimated effort to fix */
  effort?: InsightEffort;
  /** Concrete refactoring suggestion */
  suggestion?: string;
  /** Compact factual metric line for instance lists (e.g. "105 lines, 62 decision points") */
  summaryLine?: string;
  /** Generic suggestion for when multiple instances of this kind exist */
  groupSuggestion?: string;
  /** True when this insight was verified, enriched, or discovered by the health insight agent */
  agentVerified?: boolean;
}

// ─── Agent Health Insight Verdicts ──────────────────────────────────

export type InsightVerdict = 'confirmed' | 'false-positive' | 'enriched';

export interface AgentInsightAction {
  /** Index into the briefed insights array (omit for new discoveries) */
  insightIndex?: number;
  /** The agent's verdict on this insight */
  verdict: InsightVerdict | 'new';
  /** For 'enriched': replacement one-liner */
  enrichedShortDescription?: string;
  /** For 'enriched': replacement explanation with concrete details from the code */
  enrichedLearnDescription?: string;
  /** For 'new': full insight data */
  newInsight?: ArchInsight;
  /** Why the agent reached this verdict */
  reasoning: string;
}

// —— Health Fact-check Findings ——————————————————————————————————————————————————————

export type HealthFactCheckVerdict = 'confirmed' | 'corrected' | 'qualified' | 'rejected';

export interface HealthFactCheckClaim {
  id: string;
  claim: string;
  context?: string;
  files?: string[];
}

export interface HealthFactCheckFinding {
  claimId: string;
  verdict: HealthFactCheckVerdict;
  claim: string;
  correctedClaim?: string;
  evidence: string;
  files?: string[];
  deadCodeSuppressions?: DeadCodeSuppression[];
}

// ─── Unused Library Findings ─────────────────────────────────────────

export interface UnusedLibrary {
  /** Package name as declared in the manifest */
  name: string;
  /** Source manifest file, e.g. 'package.json', 'requirements.txt' */
  source: string;
  /** Whether this is a dev dependency */
  isDev: boolean;
}

// ─── Directory Metrics (Abstractness / Instability / Distance) ──────

export interface DirectoryMetrics {
  /** Directory path (forward-slash, workspace-relative) */
  dirPath: string;
  /** Total files in this directory */
  fileCount: number;
  /** Abstractness: interfaces / (classes + interfaces). 0 = fully concrete, 1 = fully abstract */
  abstractness: number;
  /** Average instability of files in this directory */
  instability: number;
  /** Distance from Main Sequence: |A + I - 1|. 0 = balanced, 1 = extreme */
  distance: number;
  /** Zone classification */
  zone: 'balanced' | 'zone-of-pain' | 'zone-of-uselessness';
}

// ─── Full Payload (sent to webview) ──────────────────────────────────

export interface CodeHealthPayload {
  summary: CodeHealthSummary;
  files: FileMetrics[];
  deadCode: DeadCodeFinding[];
  insights: ArchInsight[];
  directoryMetrics: DirectoryMetrics[];
  unusedLibraries: UnusedLibrary[];
  /** Git churn window in days (undefined when no git data) */
  gitWindowDays?: number;
  /** Analysis metadata (mirrored from DiagramModel for display on Code Health page) */
  metadata?: { analyzedAt: number; filesAnalyzed: number; analysisTimeMs: number; tokenUsage: { input: number; output: number } };
  /** Agent-generated approachable content (Phase E) */
  approachable?: {
    summary: string;
    takeaway: string;
  };
  /** Verified health claims used to ground the user-facing summary */
  factCheck?: {
    findings: HealthFactCheckFinding[];
    trace?: Array<{ turn: number; thinking?: string; toolName?: string; toolInput?: unknown; toolResult?: string }>;
  };
}
