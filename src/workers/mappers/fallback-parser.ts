/**
 * Fallback Parser — regex-based extraction for languages without WASM grammars.
 *
 * This is NOT a real parser. It uses pattern matching to extract a rough
 * FileStructure suitable for deterministic inventory.
 *
 * Strategy:
 * - Import patterns are fairly universal across languages
 * - Class/struct patterns are recognizable by keywords
 * - Function patterns follow common conventions
 * - When in doubt, include the rawText for downstream deterministic indexing
 */

import type {
  FileStructure,
  ClassNode,
  FunctionNode,
  ImportNode,
  ExportNode,
} from '../../shared/types/architecture';

// ─── Language-Specific Patterns ───────────────────────────────────────

interface LanguagePatterns {
  classPattern: RegExp;
  functionPattern: RegExp;
  importPatterns: RegExp[];
  exportPattern?: RegExp;
}

const PATTERNS: Record<string, LanguagePatterns> = {
  // Java / Kotlin / C#
  java: {
    classPattern: /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/gm,
    functionPattern: /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[\w,\s]+>)?)\s+(\w+)\s*\(/gm,
    importPatterns: [/import\s+([\w.]+(?:\.\*)?)\s*;/gm],
    exportPattern: /public\s+(?:class|interface|enum|record)\s+(\w+)/gm,
  },
  kotlin: {
    classPattern: /(?:data\s+|sealed\s+|abstract\s+|open\s+)?class\s+(\w+)|object\s+(\w+)|interface\s+(\w+)/gm,
    functionPattern: /(?:fun|suspend\s+fun)\s+(?:<[\w,\s]+>\s+)?(\w+)\s*\(/gm,
    importPatterns: [/import\s+([\w.]+)/gm],
  },
  csharp: {
    classPattern: /(?:public\s+|internal\s+|private\s+)?(?:abstract\s+|static\s+|sealed\s+)?(?:class|interface|struct|enum|record)\s+(\w+)/gm,
    functionPattern: /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:\w+(?:<[\w,\s]+>)?)\s+(\w+)\s*\(/gm,
    importPatterns: [/using\s+([\w.]+)\s*;/gm],
    exportPattern: /public\s+(?:class|interface|struct|enum)\s+(\w+)/gm,
  },
  // Go
  go: {
    classPattern: /type\s+(\w+)\s+struct\s*\{/gm,
    functionPattern: /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm,
    importPatterns: [
      /import\s+"([\w./\-]+)"/gm,
      /import\s+\w+\s+"([\w./\-]+)"/gm,
    ],
    exportPattern: /func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Z]\w+)/gm,
  },
  // Rust
  rust: {
    classPattern: /(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/gm,
    functionPattern: /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm,
    importPatterns: [/use\s+([\w:]+(?:::\{[\w,\s]+\})?)/gm],
    exportPattern: /pub\s+(?:fn|struct|enum|trait)\s+(\w+)/gm,
  },
  // Ruby
  ruby: {
    classPattern: /(?:class|module)\s+(\w+(?:::\w+)*)/gm,
    functionPattern: /def\s+(?:self\.)?(\w+[?!]?)/gm,
    importPatterns: [
      /require\s+['"]([^'"]+)['"]/gm,
      /require_relative\s+['"]([^'"]+)['"]/gm,
    ],
  },
  // PHP
  php: {
    classPattern: /(?:abstract\s+)?(?:class|interface|trait|enum)\s+(\w+)/gm,
    functionPattern: /(?:public|private|protected)?\s*(?:static\s+)?function\s+(\w+)\s*\(/gm,
    importPatterns: [
      /use\s+([\w\\]+)(?:\s+as\s+\w+)?;/gm,
      /require(?:_once)?\s+['"]([^'"]+)['"]/gm,
    ],
    exportPattern: /(?:class|interface|trait)\s+(\w+)/gm,
  },
  // Swift
  swift: {
    classPattern: /(?:class|struct|protocol|enum|actor)\s+(\w+)/gm,
    functionPattern: /(?:func)\s+(\w+)\s*[\(<]/gm,
    importPatterns: [/import\s+(\w+)/gm],
  },
};

/** Get patterns for a language, with a universal fallback */
function getPatternsForLanguage(language: string): LanguagePatterns {
  return PATTERNS[language] ?? {
    classPattern: /(?:class|struct|interface|type)\s+(\w+)/gm,
    functionPattern: /(?:func|function|def|fn|fun|sub)\s+(\w+)\s*\(/gm,
    importPatterns: [
      /(?:import|require|include|use)\s+['"]?([^'"\s;]+)/gm,
    ],
  };
}

// ─── Extraction ───────────────────────────────────────────────────────

function extractWithRegex(
  content: string,
  pattern: RegExp,
): Array<{ match: string; line: number }> {
  const results: Array<{ match: string; line: number }> = [];
  const lines = content.split('\n');

  // Create a fresh regex (reset lastIndex)
  const re = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    // Find the line number
    const upToMatch = content.substring(0, match.index);
    const lineNum = upToMatch.split('\n').length - 1;
    // Get the first capturing group that matched
    const captured = match.slice(1).find((g) => g !== undefined) ?? match[0];
    results.push({ match: captured, line: lineNum });
  }

  return results;
}

function estimateEndLine(content: string, startLine: number): number {
  const lines = content.split('\n');
  let braceDepth = 0;
  let started = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { braceDepth++; started = true; }
      if (ch === '}') braceDepth--;
    }
    if (started && braceDepth <= 0) return i;
    // For Python-style: check dedent
    if (i > startLine && started && line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
      return i - 1;
    }
  }

  return Math.min(startLine + 20, lines.length - 1);
}

// ─── Main Fallback Parser ─────────────────────────────────────────────

export function fallbackParse(
  filePath: string,
  content: string,
  language: string,
): FileStructure {
  const patterns = getPatternsForLanguage(language);

  // Extract classes
  const classMatches = extractWithRegex(content, patterns.classPattern);
  const classes: ClassNode[] = classMatches.map((m) => ({
    name: m.match,
    methods: [],
    properties: [],
    startLine: m.line,
    endLine: estimateEndLine(content, m.line),
  }));

  // Extract functions
  const fnMatches = extractWithRegex(content, patterns.functionPattern);
  const functions: FunctionNode[] = fnMatches
    // Filter out functions that are inside classes (rough heuristic: check indentation)
    .filter((m) => {
      const line = content.split('\n')[m.line] ?? '';
      // If line starts with no indentation, it's likely top-level
      return !line.match(/^\s{2,}/);
    })
    .map((m) => ({
      name: m.match,
      parameters: [],
      isAsync: false,
      isExported: false,
      startLine: m.line,
      endLine: estimateEndLine(content, m.line),
    }));

  // Extract imports
  const imports: ImportNode[] = [];
  for (const importPattern of patterns.importPatterns) {
    const importMatches = extractWithRegex(content, importPattern);
    for (const im of importMatches) {
      imports.push({
        source: im.match,
        symbols: [],
        isRelative: im.match.startsWith('.') || im.match.startsWith('/'),
      });
    }
  }

  // Extract exports
  const exports: ExportNode[] = [];
  if (patterns.exportPattern) {
    const exportMatches = extractWithRegex(content, patterns.exportPattern);
    for (const ex of exportMatches) {
      exports.push({ name: ex.match, kind: 'variable' });
    }
  } else {
    // Default: all classes and functions are exports
    for (const cls of classes) {
      exports.push({ name: cls.name, kind: 'class' });
    }
    for (const fn of functions) {
      exports.push({ name: fn.name, kind: 'function' });
    }
  }

  const lineCount = content.split('\n').length;

  return {
    filePath,
    language,
    classes,
    functions,
    imports,
    exports,
    interfaces: [], // Regex can't reliably extract interface details
    rawText: content,
    lineCount,
  };
}
