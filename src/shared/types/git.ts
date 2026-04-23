/**
 * Git history types for the temporal dimension of architecture analysis.
 *
 * All data is extracted from `git log` with pure deterministic computation.
 * Used by MetricsComputer to enrich FileMetrics with churn, hotspot, and bus-factor signals.
 */

// ─── Per-File Git Stats ─────────────────────────────────────────────

export interface GitFileStats {
  /** Workspace-relative file path (forward-slash normalized, matches FileMetrics.filePath) */
  filePath: string;
  /** Total commits touching this file */
  commits: number;
  /** Unique author names */
  authors: string[];
  /** Number of unique authors */
  authorCount: number;
  /** Total lines added across all commits */
  linesAdded: number;
  /** Total lines removed across all commits */
  linesRemoved: number;
  /** ISO date of most recent commit touching this file */
  lastModifiedDate: string;
  /** ISO date of first commit touching this file */
  firstCommitDate: string;
  /** Days since last change (computed at extraction time) */
  daysSinceLastChange: number;
  /** Commits within the configurable window (default 90 days) */
  churnScore: number;
}

// ─── Parsed Commit ──────────────────────────────────────────────────

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  /** ISO date string */
  date: string;
  message: string;
  /** Workspace-relative file paths changed in this commit */
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

// ─── Co-Change (Logical Coupling) ───────────────────────────────────

export interface CoChangePair {
  fileA: string;
  fileB: string;
  /** Number of commits containing both files */
  coChangeCount: number;
  /** coChangeCount / min(commitsA, commitsB) */
  coChangeRate: number;
  /** Whether both files belong to the same ArchComponent */
  sameComponent: boolean;
}

// ─── Aggregate Payload ──────────────────────────────────────────────

/** Per-file complexity data from Code Health analysis (attached by orchestrator) */
export interface FileComplexityInfo {
  maxCognitiveComplexity: number;
  hotspotScore: number;
  kpiTier: string;
}

/** Per-module churn aggregation (computed by orchestrator from components + fileStats) */
export interface ModuleVelocity {
  moduleName: string;
  /** Sum of churnScore across module files */
  totalCommits: number;
  /** Unique authors across module files */
  totalAuthors: number;
  /** Files with git activity in this module */
  fileCount: number;
  /** Most churned file in this module */
  topFile: string;
  /** churnScore of the top file */
  topFileChurn: number;
}

export interface GitHistoryData {
  /** Per-file churn stats (keyed by workspace-relative path) */
  fileStats: Record<string, GitFileStats>;
  /** Parsed commits (newest first) */
  commits: GitCommit[];
  /** File pairs that change together frequently */
  coChangePairs: CoChangePair[];
  /** Per-file complexity data from Code Health (optional, present after analysis) */
  fileComplexity?: Record<string, FileComplexityInfo>;
  /** Per-module churn aggregation (optional, present when architecture model is available) */
  moduleVelocity?: ModuleVelocity[];
  /** Optional narrative insights retained for legacy snapshots */
  approachable?: {
    overview: string;
    hotspots: string;
    coupling: string;
    knowledge: string;
    velocity: string;
  };
  metadata: {
    totalCommits: number;
    totalAuthors: number;
    /** Window used for churnScore calculation */
    windowDays: number;
    /** Timestamp when extraction ran */
    analyzedAt: number;
    oldestCommitDate: string;
    newestCommitDate: string;
  };
}
