/** Lightweight snapshot of a previously analyzed project, stored in the global registry. */
export interface ProjectEntry {
  /** Absolute filesystem path to the project root. */
  fsPath: string;
  /** Human-readable folder name. */
  name: string;
  /** Summary snapshot captured after last analysis. */
  summary?: ProjectSummary;
}

export interface ProjectSummary {
  fileCount: number;
  internalDependencyEdges: number;
  languages: string[];
  /** ISO 8601 timestamp of the last completed analysis. */
  analyzedAt: string;
}
