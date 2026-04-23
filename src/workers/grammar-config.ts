/**
 * Grammar Configuration — maps language identifiers to WASM grammar files.
 *
 * Each supported language needs a .wasm grammar file built from tree-sitter.
 * For PoC: TypeScript, JavaScript, Python.
 * Additional languages are added here as WASM grammars are built.
 */

export interface GrammarConfig {
  /** Language identifier (e.g., 'typescript', 'python') */
  language: string;
  /** Filename of the .wasm grammar file */
  wasmFile: string;
  /** File extensions this grammar handles */
  extensions: string[];
  /** Parser type: 'tree-sitter' uses WASM grammar, 'fallback' uses regex */
  parserType: 'tree-sitter' | 'fallback';
}

/**
 * Registry of all grammar configurations.
 * Order does not matter — lookup is by language ID.
 */
export const GRAMMAR_CONFIGS: GrammarConfig[] = [
  // ── PoC Languages (with WASM grammars) ───────────────────────────
  {
    language: 'typescript',
    wasmFile: 'tree-sitter-typescript.wasm',
    extensions: ['.ts', '.tsx'],
    parserType: 'tree-sitter',
  },
  {
    language: 'javascript',
    wasmFile: 'tree-sitter-javascript.wasm',
    extensions: ['.js', '.jsx'],
    parserType: 'tree-sitter',
  },
  {
    language: 'python',
    wasmFile: 'tree-sitter-python.wasm',
    extensions: ['.py'],
    parserType: 'tree-sitter',
  },
  // ── Future Languages (fallback until WASM built) ─────────────────
  {
    language: 'java',
    wasmFile: 'tree-sitter-java.wasm',
    extensions: ['.java'],
    parserType: 'fallback',
  },
  {
    language: 'csharp',
    wasmFile: 'tree-sitter-c-sharp.wasm',
    extensions: ['.cs'],
    parserType: 'fallback',
  },
  {
    language: 'go',
    wasmFile: 'tree-sitter-go.wasm',
    extensions: ['.go'],
    parserType: 'fallback',
  },
  {
    language: 'rust',
    wasmFile: 'tree-sitter-rust.wasm',
    extensions: ['.rs'],
    parserType: 'fallback',
  },
  {
    language: 'kotlin',
    wasmFile: 'tree-sitter-kotlin.wasm',
    extensions: ['.kt'],
    parserType: 'fallback',
  },
  {
    language: 'ruby',
    wasmFile: 'tree-sitter-ruby.wasm',
    extensions: ['.rb'],
    parserType: 'fallback',
  },
  {
    language: 'php',
    wasmFile: 'tree-sitter-php.wasm',
    extensions: ['.php'],
    parserType: 'fallback',
  },
];

/** Quick lookup: file extension → language ID */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {};
for (const cfg of GRAMMAR_CONFIGS) {
  for (const ext of cfg.extensions) {
    EXTENSION_TO_LANGUAGE[ext] = cfg.language;
  }
}

/** Quick lookup: language ID → GrammarConfig */
export const LANGUAGE_CONFIGS: Record<string, GrammarConfig> = {};
for (const cfg of GRAMMAR_CONFIGS) {
  LANGUAGE_CONFIGS[cfg.language] = cfg;
}

/** Returns the GrammarConfig for a given file extension, or undefined */
export function getGrammarForExtension(ext: string): GrammarConfig | undefined {
  const lang = EXTENSION_TO_LANGUAGE[ext];
  return lang ? LANGUAGE_CONFIGS[lang] : undefined;
}
