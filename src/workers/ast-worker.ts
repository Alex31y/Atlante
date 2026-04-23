/**
 * AST Worker — Tree-sitter WASM parsing engine.
 *
 * Runs in a Worker Thread (off-main-thread).
 * Uses web-tree-sitter (WASM) to parse source files and extract
 * a language-agnostic FileStructure.
 *
 * The AST worker extracts raw structure: classes, functions, imports, exports.
 *
 * Communication: postMessage with typed AstWorkerRequest/AstWorkerResponse.
 */

import { parentPort } from 'worker_threads';
import * as path from 'path';
import type {
  AstWorkerRequest,
  AstWorkerResponse,
} from '../shared/types/worker-messages';
import type { FileStructure } from '../shared/types/architecture';
import { LANGUAGE_CONFIGS } from './grammar-config';
import { getMapper } from './mappers/index';
import { fallbackParse } from './mappers/fallback-parser';

// web-tree-sitter types (loaded dynamically via WASM)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Parser: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Language: any;
type TreeSitterLanguage = unknown;

/** Cache of loaded language grammars: language → Language object */
const languageCache = new Map<string, TreeSitterLanguage>();

/** The single parser instance, reused for all languages */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let parser: any = null;

/** Directory where grammar WASM files are stored */
let grammarsDir = '';

/** Whether the parser core is initialized */
let isInitialized = false;

// ─── Response Helper ──────────────────────────────────────────────────

function respond(msg: AstWorkerResponse): void {
  parentPort?.postMessage(msg);
}

function respondError(error: string, requestId?: string): void {
  respond({ type: 'ast:error', requestId, error });
}

// ─── Initialization ───────────────────────────────────────────────────

async function initialize(grammarsDirectory: string): Promise<string[]> {
  grammarsDir = grammarsDirectory;

  // Always mark as initialized — the fallback regex parser works without tree-sitter.
  // Tree-sitter WASM is a nice-to-have for richer ASTs, but not required.
  isInitialized = true;

  try {
    // Dynamic import of web-tree-sitter
    const mod = await import('web-tree-sitter');
    Parser = mod.default ?? mod.Parser ?? mod;
    Language = mod.Language ?? Parser.Language;

    // Initialize the WASM engine
    // locateFile tells tree-sitter where to find tree-sitter.wasm
    await Parser.init({
      locateFile(scriptName: string) {
        // tree-sitter.wasm is co-located with the grammar files
        return path.join(grammarsDir, scriptName);
      },
    });

    parser = new Parser();

    // Pre-load available grammars
    const loaded: string[] = [];
    for (const [language, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.parserType !== 'tree-sitter') continue;

      const wasmPath = path.join(grammarsDir, config.wasmFile);
      try {
        const lang = await Language.load(wasmPath);
        languageCache.set(language, lang);
        loaded.push(language);
      } catch {
        // Grammar not available — will use fallback parser
        console.warn(`[AST Worker] Grammar not found for ${language}: ${wasmPath}`);
      }
    }

    return loaded;
  } catch (err) {
    // Tree-sitter WASM failed — log it but continue with fallback parser
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[AST Worker] Tree-sitter init failed (fallback parser will be used): ${message}`);
    Parser = null;
    parser = null;
    return []; // No tree-sitter languages loaded, all files will use fallback
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────

/**
 * Parse a single file and return its FileStructure.
 * Uses tree-sitter if a grammar is available, otherwise falls back to regex.
 */
function parseFile(
  filePath: string,
  content: string,
  language: string,
): FileStructure {
  // Try tree-sitter first
  const cachedLang = languageCache.get(language);
  if (cachedLang && parser && isInitialized) {
    try {
      parser.setLanguage(cachedLang);
      const tree = parser.parse(content);
      const mapper = getMapper(language);
      const result = mapper(tree, filePath, content, language);
      tree.delete(); // Free WASM memory
      return result;
    } catch (err) {
      console.warn(
        `[AST Worker] Tree-sitter parse failed for ${filePath}, falling back to regex:`,
        err,
      );
    }
  }

  // Fallback: regex-based parsing
  return fallbackParse(filePath, content, language);
}

// ─── Message Handler ──────────────────────────────────────────────────

async function handleMessage(msg: AstWorkerRequest): Promise<void> {
  switch (msg.type) {
    case 'ast:init': {
      const loaded = await initialize(msg.payload.grammarsDir);
      respond({
        type: 'ast:initComplete',
        payload: { loadedLanguages: loaded },
      });
      break;
    }

    case 'ast:parse': {
      if (!isInitialized) {
        respondError('AST Worker not initialized. Send ast:init first.', msg.requestId);
        return;
      }

      try {
        const { filePath, content, language } = msg.payload;
        const result = parseFile(filePath, content, language);
        respond({
          type: 'ast:parseResult',
          requestId: msg.requestId,
          payload: result,
        });
      } catch (err) {
        respondError(
          err instanceof Error ? err.message : String(err),
          msg.requestId,
        );
      }
      break;
    }

    case 'ast:parseBatch': {
      if (!isInitialized) {
        respondError('AST Worker not initialized. Send ast:init first.', msg.requestId);
        return;
      }

      try {
        const results: FileStructure[] = [];
        for (const file of msg.payload) {
          try {
            results.push(parseFile(file.filePath, file.content, file.language));
          } catch (err) {
            // Don't fail the whole batch for one file
            console.warn(`[AST Worker] Failed to parse ${file.filePath}:`, err);
            // Return a minimal structure so the inventory can still include the file.
            results.push({
              filePath: file.filePath,
              language: file.language,
              classes: [],
              functions: [],
              imports: [],
              exports: [],
              interfaces: [],
              rawText: file.content,
              lineCount: file.content.split('\n').length,
            });
          }
        }
        respond({
          type: 'ast:parseBatchResult',
          requestId: msg.requestId,
          payload: results,
        });
      } catch (err) {
        respondError(
          err instanceof Error ? err.message : String(err),
          msg.requestId,
        );
      }
      break;
    }

    default: {
      respondError(`Unknown message type: ${(msg as { type: string }).type}`);
    }
  }
}

// ─── Worker Entry Point ───────────────────────────────────────────────

parentPort?.on('message', (msg: AstWorkerRequest) => {
  handleMessage(msg).catch((err) => {
    respondError(
      `Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
});
