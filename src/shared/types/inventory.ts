export interface FileInventoryPayload {
  summary: FileInventorySummary;
  files: FileInventoryItem[];
  groups: FileInventoryGroup[];
  metadata: FileInventoryMetadata;
}

export interface FileSymbol {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'method' | 'export';
  line: number | null;
  exported: boolean;
}

export interface FileInventorySummary {
  totalFiles: number;
  internalDependencyEdges: number;
  unresolvedImportCount: number;
  languages: Array<{ language: string; count: number }>;
  topDirectories: Array<{ path: string; fileCount: number }>;
}

export interface FileInventoryItem {
  filePath: string;
  language: string;
  loc: number;
  classCount: number;
  functionCount: number;
  interfaceCount: number;
  importCount: number;
  exportCount: number;
  fanOut: number;
  fanIn: number;
  imports: FileImportEdge[];
  exports: Array<{ name: string; kind: string }>;
  resolvedDependencies: string[];
  dependents: string[];
  unresolvedImports: string[];
  topLevelDirectory: string;
  parentDirectory: string;
  classes: string[];
  functions: string[];
  interfaces: string[];
  symbols: FileSymbol[];
}

export interface FileImportEdge {
  source: string;
  symbols: string[];
  isRelative: boolean;
  resolvedFile: string | null;
}

export interface FileInventoryGroup {
  key: string;
  label: string;
  kind: 'top-level-directory' | 'parent-directory' | 'language';
  filePaths: string[];
  totalLoc: number;
}

export interface FileInventoryMetadata {
  analyzedAt: number;
  filesAnalyzed: number;
  analysisTimeMs: number;
  parserMode: 'tree-sitter' | 'fallback' | 'mixed';
}
