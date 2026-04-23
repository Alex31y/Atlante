/**
 * Build WASM Grammar Files
 *
 * Downloads pre-built tree-sitter grammar .wasm files for supported languages.
 * These are placed in grammars/ and then copied to dist/grammars/ during build.
 *
 * For PoC: TypeScript, JavaScript, Python
 *
 * Usage: node scripts/build-grammars.mjs
 *
 * The WASM files are sourced from the tree-sitter GitHub releases.
 * Each .wasm is ~200-500KB — lightweight enough to ship with the extension.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const GRAMMARS_DIR = path.resolve('grammars');

/**
 * Grammar sources: npm packages that contain pre-built .wasm files
 * or can be compiled with tree-sitter CLI.
 *
 * Strategy: try to copy from node_modules if the npm package ships a .wasm,
 * otherwise build from source using tree-sitter CLI.
 */
const GRAMMAR_SOURCES = [
  {
    language: 'typescript',
    npmPackage: 'tree-sitter-typescript',
    wasmFile: 'tree-sitter-typescript.wasm',
    subPath: 'typescript', // tree-sitter-typescript has a typescript/ subfolder
  },
  {
    language: 'javascript',
    npmPackage: 'tree-sitter-javascript',
    wasmFile: 'tree-sitter-javascript.wasm',
    subPath: null,
  },
  {
    language: 'python',
    npmPackage: 'tree-sitter-python',
    wasmFile: 'tree-sitter-python.wasm',
    subPath: null,
  },
];

async function main() {
  console.log('Building tree-sitter grammar WASM files...\n');

  // Ensure output directory exists
  fs.mkdirSync(GRAMMARS_DIR, { recursive: true });

  // Install grammar npm packages (devDependencies)
  const packages = GRAMMAR_SOURCES.map((g) => g.npmPackage);
  console.log(`Installing grammar packages: ${packages.join(', ')}`);

  try {
    execSync(`npm install --save-dev ${packages.join(' ')}`, {
      stdio: 'inherit',
      cwd: path.resolve('.'),
    });
  } catch (err) {
    console.error('Failed to install grammar packages');
    process.exit(1);
  }

  console.log('');

  // Check if tree-sitter CLI is available for building WASM
  let hasTreeSitterCLI = false;
  try {
    execSync('npx tree-sitter --version', { stdio: 'pipe' });
    hasTreeSitterCLI = true;
  } catch {
    console.log('tree-sitter CLI not found — will try alternative methods\n');
  }

  // Try to build each grammar
  for (const grammar of GRAMMAR_SOURCES) {
    const outputPath = path.join(GRAMMARS_DIR, grammar.wasmFile);

    // Strategy 1: Check if the npm package already has a .wasm file
    const npmWasmPaths = [
      path.resolve('node_modules', grammar.npmPackage, grammar.wasmFile),
      path.resolve('node_modules', grammar.npmPackage, 'prebuilds', grammar.wasmFile),
    ];

    let found = false;
    for (const wasmPath of npmWasmPaths) {
      if (fs.existsSync(wasmPath)) {
        fs.copyFileSync(wasmPath, outputPath);
        console.log(`✓ ${grammar.language}: copied from npm package`);
        found = true;
        break;
      }
    }

    if (found) continue;

    // Strategy 2: Build with tree-sitter CLI
    if (hasTreeSitterCLI) {
      try {
        const grammarDir = grammar.subPath
          ? path.resolve('node_modules', grammar.npmPackage, grammar.subPath)
          : path.resolve('node_modules', grammar.npmPackage);

        console.log(`Building ${grammar.language} WASM from ${grammarDir}...`);
        execSync(
          `npx tree-sitter build --wasm ${grammarDir} -o ${outputPath}`,
          { stdio: 'inherit' },
        );
        console.log(`✓ ${grammar.language}: built with tree-sitter CLI`);
        continue;
      } catch (err) {
        console.warn(`⚠ ${grammar.language}: tree-sitter build failed, trying web-tree-sitter generate...`);
      }
    }

    // Strategy 3: Download pre-built WASM from GitHub releases
    console.log(`⚠ ${grammar.language}: could not build WASM — will use fallback regex parser at runtime`);
    console.log(`  To build manually: npx tree-sitter build --wasm node_modules/${grammar.npmPackage}${grammar.subPath ? '/' + grammar.subPath : ''} -o ${outputPath}`);
  }

  console.log('\nDone! Grammar files in:', GRAMMARS_DIR);

  // List what we have
  const files = fs.readdirSync(GRAMMARS_DIR).filter((f) => f.endsWith('.wasm'));
  if (files.length > 0) {
    console.log(`Available grammars: ${files.join(', ')}`);
  } else {
    console.log('No grammar .wasm files were built. The AST worker will use fallback regex parsing.');
    console.log('This is fine for development - the fallback parser can still build a basic inventory.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
