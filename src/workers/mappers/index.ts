/**
 * Mapper Registry — dispatches tree-sitter AST nodes to language-specific mappers.
 *
 * Each mapper knows how to walk a tree-sitter tree for a specific language
 * and extract a FileStructure (classes, functions, imports, exports, interfaces).
 *
 * The registry pattern keeps language support decoupled:
 * adding a new language = adding a mapper file + registering it here.
 */

import type { FileStructure } from '../../shared/types/architecture';
import { typescriptMapper } from './typescript-mapper';
import { pythonMapper } from './python-mapper';
import { genericMapper } from './generic-mapper';

/**
 * A language mapper extracts FileStructure from a tree-sitter parse tree.
 *
 * @param tree - The tree-sitter parse tree root node
 * @param filePath - The file path for context
 * @param rawText - The raw file content
 * @returns FileStructure with all extracted nodes
 */
export type LanguageMapper = (
  tree: { rootNode: TreeSitterNode },
  filePath: string,
  rawText: string,
  language: string,
) => FileStructure;

/**
 * Minimal interface for tree-sitter node access.
 * This abstracts away the full tree-sitter bindings so mappers
 * are testable without loading WASM.
 */
export interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeSitterNode[];
  childCount: number;
  namedChildren: TreeSitterNode[];
  namedChildCount: number;
  childForFieldName(name: string): TreeSitterNode | null;
  descendantsOfType(type: string | string[]): TreeSitterNode[];
}

/**
 * Registry of language-specific mappers.
 * If a language has no specific mapper, falls back to genericMapper.
 */
const MAPPER_REGISTRY: Record<string, LanguageMapper> = {
  typescript: typescriptMapper,
  javascript: typescriptMapper, // JS is close enough to TS for structure extraction
  python: pythonMapper,
};

/**
 * Get the appropriate mapper for a language.
 * Falls back to genericMapper if no specific mapper is registered.
 */
export function getMapper(language: string): LanguageMapper {
  return MAPPER_REGISTRY[language] ?? genericMapper;
}

/**
 * Check if a language has a dedicated mapper (vs generic fallback).
 */
export function hasDedicatedMapper(language: string): boolean {
  return language in MAPPER_REGISTRY;
}
