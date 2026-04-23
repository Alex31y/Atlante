/**
 * Import Resolution — Pure functions for resolving import paths.
 *
 * Shared by deterministic inventory and metrics helpers.
 * No VS Code API dependencies — operates entirely on strings and Sets.
 */

import * as path from 'path';
import { SUPPORTED_EXTENSIONS } from './constants';

interface ImportGraphEntry {
  filePath: string;
  imports: Array<{ source: string; symbols: string[]; isRelative: boolean }>;
}

/**
 * Resolve a relative import source to an actual file path in the project.
 * Handles both TypeScript/JavaScript and Python-style relative imports.
 */
export function resolveImport(
  importerPath: string,
  importSource: string,
  allFilePaths: Set<string>,
): string | null {
  const importerDir = path.posix.dirname(importerPath);
  const isPythonFile = importerPath.endsWith('.py');

  // Normalize Python relative imports: ".module" → "./module", "..module" → "../module"
  let normalizedSource = importSource;
  if (isPythonFile) {
    if (/^\.\w/.test(importSource)) {
      normalizedSource = './' + importSource.slice(1);
    } else if (/^\.\.\w/.test(importSource)) {
      normalizedSource = '../' + importSource.slice(2);
    }
    // Convert remaining Python dots to path separators for multi-level relative imports
    normalizedSource = normalizedSource.replace(/\./g, (match, offset) => {
      if (offset === 0) return match;
      if (normalizedSource[offset - 1] === '.' || normalizedSource[offset - 1] === '/') return match;
      return '/';
    });
  }

  const resolved = path.posix.normalize(path.posix.join(importerDir, normalizedSource));

  // Try exact match first
  if (allFilePaths.has(resolved)) return resolved;

  // Try adding known extensions
  const extensions = Object.keys(SUPPORTED_EXTENSIONS);
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allFilePaths.has(candidate)) return candidate;
  }

  // Try index files (barrel imports) and Python __init__.py
  for (const ext of extensions) {
    const candidate = resolved + '/index' + ext;
    if (allFilePaths.has(candidate)) return candidate;
  }
  const initCandidate = resolved + '/__init__.py';
  if (allFilePaths.has(initCandidate)) return initCandidate;

  return null;
}

/**
 * Try to resolve a Python absolute module import (e.g., "app.services.logica")
 * to a file path within the project. Returns null for external packages.
 */
export function resolvePythonAbsoluteImport(
  importSource: string,
  allFilePaths: Set<string>,
): string | null {
  const asPath = importSource.replace(/\./g, '/');

  // Try direct match with extensions
  for (const ext of Object.keys(SUPPORTED_EXTENSIONS)) {
    const candidate = asPath + ext;
    if (allFilePaths.has(candidate)) return candidate;
  }

  // Try __init__.py (package import)
  const initCandidate = asPath + '/__init__.py';
  if (allFilePaths.has(initCandidate)) return initCandidate;

  // Try suffix matching for nested project structures
  const suffix = '/' + asPath;
  for (const fp of allFilePaths) {
    if (fp.endsWith(suffix + '.py') || fp.endsWith(suffix + '/__init__.py')) {
      return fp;
    }
  }

  return null;
}

/**
 * Resolve all imports in the import graph and return the set of imported files
 * plus the symbol-level import map.
 *
 * This is the core resolution logic used by both dead code detection and
 * deterministic inventory helpers for identifying unresolved files.
 */
export function resolveImportGraph(
  importGraph: ImportGraphEntry[],
  allFilePaths: Set<string>,
): { importedFiles: Set<string>; importedSymbolsByFile: Map<string, Set<string>> } {
  const importedSymbolsByFile = new Map<string, Set<string>>();
  const importedFiles = new Set<string>();

  for (const entry of importGraph) {
    for (const imp of entry.imports) {
      let target: string | null = null;
      if (imp.isRelative) {
        target = resolveImport(entry.filePath, imp.source, allFilePaths);
      } else {
        target = resolvePythonAbsoluteImport(imp.source, allFilePaths);
      }

      // Python `from package import submodule`: try resolving each symbol as a submodule.
      // This must run EVEN IF target is null — the package directory might not have an
      // __init__.py in allFilePaths (empty __init__.py gets skipped by AST parsing),
      // but the submodule files are still there.
      if (entry.filePath.endsWith('.py') && imp.symbols.length > 0) {
        // Determine the package directory from the resolved target or from the source path
        let packageDir: string | null = null;
        if (target) {
          packageDir = target.endsWith('/__init__.py')
            ? path.posix.dirname(target)
            : path.posix.dirname(target);
        } else {
          // No target resolved — derive package dir from the import source path
          // e.g., "backend.routers" → "backend/routers", or for relative ".routers" on "backend/main.py" → "backend/routers"
          const sourcePath = imp.isRelative
            ? path.posix.normalize(path.posix.join(path.posix.dirname(entry.filePath), imp.source.replace(/^\.*/, '').replace(/\./g, '/')))
            : imp.source.replace(/\./g, '/');
          // Try suffix matching for nested project structures
          for (const fp of allFilePaths) {
            if (fp.startsWith(sourcePath + '/') || fp.endsWith('/' + sourcePath + '/')) {
              packageDir = sourcePath;
              break;
            }
          }
          // Also try with any prefix (e.g., "myproject/backend/routers")
          if (!packageDir) {
            const suffix = '/' + sourcePath + '/';
            for (const fp of allFilePaths) {
              const idx = fp.indexOf(suffix);
              if (idx >= 0) {
                packageDir = fp.slice(0, idx + suffix.length - 1);
                break;
              }
            }
          }
        }

        if (packageDir) {
          for (const sym of imp.symbols) {
            if (sym === '*') continue;
            const submodCandidate = packageDir + '/' + sym + '.py';
            if (allFilePaths.has(submodCandidate)) {
              importedFiles.add(submodCandidate);
              let subSet = importedSymbolsByFile.get(submodCandidate);
              if (!subSet) {
                subSet = new Set();
                importedSymbolsByFile.set(submodCandidate, subSet);
              }
              subSet.add('*');
            }
            const subpkgCandidate = packageDir + '/' + sym + '/__init__.py';
            if (allFilePaths.has(subpkgCandidate)) {
              importedFiles.add(subpkgCandidate);
              let subSet = importedSymbolsByFile.get(subpkgCandidate);
              if (!subSet) {
                subSet = new Set();
                importedSymbolsByFile.set(subpkgCandidate, subSet);
              }
              subSet.add('*');
            }
          }
        }
      }

      if (!target) continue;

      importedFiles.add(target);

      if (imp.symbols.length === 0) {
        let set = importedSymbolsByFile.get(target);
        if (!set) {
          set = new Set();
          importedSymbolsByFile.set(target, set);
        }
        set.add('*');
      } else {
        let set = importedSymbolsByFile.get(target);
        if (!set) {
          set = new Set();
          importedSymbolsByFile.set(target, set);
        }
        for (const sym of imp.symbols) {
          set.add(sym);
        }
      }
    }
  }

  return { importedFiles, importedSymbolsByFile };
}
