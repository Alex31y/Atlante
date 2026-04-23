/**
 * Agent Discovery Phase Types
 *
 * The agent classifies ambiguous files (not imported, not matching known patterns)
 * by using grep/read/glob tools to discover how they're actually used.
 */

/** How the agent classified a file */
export type FileClassificationType =
  | 'entry-point'      // Executed directly (package.json scripts, Dockerfile CMD, etc.)
  | 'config'           // Build/runtime config (tsconfig, .d.ts, framework config)
  | 'script'           // Standalone CLI tool, migration, seed, benchmark
  | 'test'             // Test file executed by test runner
  | 'framework-wired'  // Connected via framework mechanism (include_router, DI, decorators)
  | 'truly-orphan';    // Genuinely unused — dead code

export interface FileClassification {
  filePath: string;
  classification: FileClassificationType;
  confidence: number;  // 0-1
  reason: string;      // 1-2 sentence explanation of why
}

export interface AgentDiscoveryResult {
  classifications: FileClassification[];
  usage: Array<{ inputTokens: number; outputTokens: number }>;
}

/** Parameters for the agent discovery run */
export interface AgentDiscoveryParams {
  ambiguousFiles: string[];
  hypothesis: {
    pattern: string;
    framework: string;
    modules: Array<{ name: string; filePatterns: string[]; role: string }>;
  };
  skeletonTree: string;           // directory tree string
  importGraphSummary: string;     // compact import graph for context
  workspaceRoot: string;
  model: string;
  allFilePaths: Set<string>;      // for list_files tool (in-memory glob)
}
