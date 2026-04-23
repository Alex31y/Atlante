import * as path from 'path';
import type { FileStructure, ImportNode } from '../../shared/types/architecture';
import type {
  FileImportEdge,
  FileInventoryGroup,
  FileInventoryItem,
  FileInventoryMetadata,
  FileInventoryPayload,
  FileSymbol,
} from '../../shared/types/inventory';
import { resolveImport, resolvePythonAbsoluteImport } from '../../shared/import-resolver';

interface BuildFileInventoryOptions {
  analyzedAt?: number;
  analysisTimeMs?: number;
  parserMode?: FileInventoryMetadata['parserMode'];
}

interface ResolvedImportResult {
  edge: FileImportEdge;
  dependencies: string[];
}

export function buildFileInventory(
  fileStructures: FileStructure[],
  workspaceRoot: string,
  options: BuildFileInventoryOptions = {},
): FileInventoryPayload {
  const allFilePaths = new Set<string>();

  for (const structure of fileStructures) {
    allFilePaths.add(toRelativePath(structure.filePath, workspaceRoot));
  }

  const inboundDependents = new Map<string, Set<string>>();
  const fileItems = new Map<string, FileInventoryItem>();
  let internalDependencyEdges = 0;
  let unresolvedImportCount = 0;

  for (const structure of fileStructures) {
    const filePath = toRelativePath(structure.filePath, workspaceRoot);
    const resolvedDependencySet = new Set<string>();
    const imports = structure.imports.map((entry) => {
      const resolved = resolveInventoryImport(filePath, structure.language, entry, allFilePaths);

      for (const dependency of resolved.dependencies) {
        if (!resolvedDependencySet.has(dependency)) {
          resolvedDependencySet.add(dependency);
          internalDependencyEdges++;
        }

        let inbound = inboundDependents.get(dependency);
        if (!inbound) {
          inbound = new Set<string>();
          inboundDependents.set(dependency, inbound);
        }
        inbound.add(filePath);
      }

      if (resolved.dependencies.length === 0) {
        unresolvedImportCount++;
      }

      return resolved.edge;
    });

    fileItems.set(filePath, {
      filePath,
      language: structure.language,
      loc: structure.lineCount,
      classCount: structure.classes.length,
      functionCount: structure.functions.length,
      interfaceCount: structure.interfaces.length,
      importCount: structure.imports.length,
      exportCount: structure.exports.length,
      fanOut: resolvedDependencySet.size,
      fanIn: 0,
      imports,
      exports: structure.exports.map((entry) => ({ name: entry.name, kind: entry.kind })),
      resolvedDependencies: [...resolvedDependencySet].sort(),
      dependents: [],
      unresolvedImports: imports.filter((entry) => entry.resolvedFile === null).map((entry) => entry.source),
      topLevelDirectory: getTopLevelDirectory(filePath),
      parentDirectory: getParentDirectory(filePath),
      classes: structure.classes.map((entry) => entry.name),
      functions: structure.functions.map((entry) => entry.name),
      interfaces: structure.interfaces.map((entry) => entry.name),
      symbols: buildFileSymbols(structure),
    });
  }

  for (const [filePath, item] of fileItems) {
    const dependents = [...(inboundDependents.get(filePath) ?? new Set<string>())].sort();
    item.dependents = dependents;
    item.fanIn = dependents.length;
  }

  const files = [...fileItems.values()].sort((a, b) => a.filePath.localeCompare(b.filePath));
  const groups = buildGroups(files);
  const topDirectories = [...groupBy(files, (file) => file.topLevelDirectory).entries()]
    .map(([dirPath, dirFiles]) => ({ path: dirPath, fileCount: dirFiles.length }))
    .sort((a, b) => b.fileCount - a.fileCount || a.path.localeCompare(b.path))
    .slice(0, 8);
  const languages = [...groupBy(files, (file) => file.language).entries()]
    .map(([language, matchingFiles]) => ({ language, count: matchingFiles.length }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));

  return {
    summary: {
      totalFiles: files.length,
      internalDependencyEdges,
      unresolvedImportCount,
      languages,
      topDirectories,
    },
    files,
    groups,
    metadata: {
      analyzedAt: options.analyzedAt ?? 0,
      filesAnalyzed: files.length,
      analysisTimeMs: options.analysisTimeMs ?? 0,
      parserMode: options.parserMode ?? 'mixed',
    },
  };
}

function resolveInventoryImport(
  importerPath: string,
  language: string,
  entry: ImportNode,
  allFilePaths: Set<string>,
): ResolvedImportResult {
  const dependencies = new Set<string>();
  const directResolution = entry.isRelative
    ? resolveImport(importerPath, entry.source, allFilePaths)
    : language === 'python'
      ? resolvePythonAbsoluteImport(entry.source, allFilePaths)
      : null;

  if (directResolution) {
    dependencies.add(directResolution);
  }

  if (language === 'python' && entry.symbols.length > 0) {
    for (const candidate of resolvePythonSubmoduleImports(importerPath, entry, allFilePaths, directResolution)) {
      dependencies.add(candidate);
    }
  }

  const dependencyList = [...dependencies].sort();
  return {
    edge: {
      source: entry.source,
      symbols: entry.symbols,
      isRelative: entry.isRelative,
      resolvedFile: dependencyList[0] ?? null,
    },
    dependencies: dependencyList,
  };
}

function resolvePythonSubmoduleImports(
  importerPath: string,
  entry: ImportNode,
  allFilePaths: Set<string>,
  directResolution: string | null,
): string[] {
  const packageDir = getPythonPackageDir(importerPath, entry, allFilePaths, directResolution);
  if (!packageDir) {
    return [];
  }

  const results: string[] = [];
  for (const symbol of entry.symbols) {
    if (symbol === '*') continue;

    const fileCandidate = `${packageDir}/${symbol}.py`;
    if (allFilePaths.has(fileCandidate)) {
      results.push(fileCandidate);
    }

    const packageCandidate = `${packageDir}/${symbol}/__init__.py`;
    if (allFilePaths.has(packageCandidate)) {
      results.push(packageCandidate);
    }
  }

  return results;
}

function getPythonPackageDir(
  importerPath: string,
  entry: ImportNode,
  allFilePaths: Set<string>,
  directResolution: string | null,
): string | null {
  if (directResolution) {
    return path.posix.dirname(directResolution);
  }

  const sourcePath = entry.isRelative
    ? path.posix.normalize(
      path.posix.join(
        path.posix.dirname(importerPath),
        entry.source.replace(/^\.*/, '').replace(/\./g, '/'),
      ),
    )
    : entry.source.replace(/\./g, '/');

  for (const filePath of allFilePaths) {
    if (filePath.startsWith(`${sourcePath}/`) || filePath.endsWith(`/${sourcePath}/__init__.py`)) {
      return sourcePath;
    }
  }

  const suffix = `/${sourcePath}/`;
  for (const filePath of allFilePaths) {
    const index = filePath.indexOf(suffix);
    if (index >= 0) {
      return filePath.slice(0, index + suffix.length - 1);
    }
  }

  return null;
}

function buildGroups(files: FileInventoryItem[]): FileInventoryGroup[] {
  const groups: FileInventoryGroup[] = [];
  const descriptors: Array<{ kind: FileInventoryGroup['kind']; pick: (file: FileInventoryItem) => string }> = [
    { kind: 'top-level-directory', pick: (file) => file.topLevelDirectory },
    { kind: 'parent-directory', pick: (file) => file.parentDirectory },
    { kind: 'language', pick: (file) => file.language },
  ];

  for (const descriptor of descriptors) {
    for (const [value, matchingFiles] of groupBy(files, descriptor.pick).entries()) {
      groups.push({
        key: `${descriptor.kind}:${value}`,
        label: value,
        kind: descriptor.kind,
        filePaths: matchingFiles.map((file) => file.filePath).sort(),
        totalLoc: matchingFiles.reduce((total, file) => total + file.loc, 0),
      });
    }
  }

  return groups.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}

function groupBy<T>(items: T[], pick: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = pick(item);
    const current = groups.get(key);
    if (current) {
      current.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function toRelativePath(filePath: string, workspaceRoot: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
}

function getTopLevelDirectory(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts[0] : '.';
}

function getParentDirectory(filePath: string): string {
  const parentDirectory = path.posix.dirname(filePath);
  return parentDirectory === '.' ? '.' : parentDirectory;
}

function buildFileSymbols(structure: FileStructure): FileSymbol[] {
  const seen = new Set<string>();
  const symbols: FileSymbol[] = [];
  const exportedNames = new Set(structure.exports.map((entry) => entry.name));

  const pushSymbol = (symbol: FileSymbol) => {
    const key = `${symbol.kind}:${symbol.name}:${symbol.line ?? 'null'}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    symbols.push(symbol);
  };

  for (const entry of structure.classes) {
    pushSymbol({
      name: entry.name,
      kind: 'class',
      line: entry.startLine,
      exported: exportedNames.has(entry.name),
    });

    for (const methodName of entry.methods) {
      pushSymbol({
        name: methodName,
        kind: 'method',
        line: null,
        exported: false,
      });
    }
  }

  for (const entry of structure.functions) {
    pushSymbol({
      name: entry.name,
      kind: 'function',
      line: entry.startLine,
      exported: entry.isExported || exportedNames.has(entry.name),
    });
  }

  for (const entry of structure.interfaces) {
    pushSymbol({
      name: entry.name,
      kind: 'interface',
      line: entry.startLine,
      exported: exportedNames.has(entry.name),
    });
  }

  for (const entry of structure.exports) {
    pushSymbol({
      name: entry.name,
      kind: 'export',
      line: null,
      exported: true,
    });
  }

  return symbols.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return left.name.localeCompare(right.name);
  });
}
