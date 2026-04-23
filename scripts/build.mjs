import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');
const targetArg = process.argv.find((a, i) => process.argv[i - 1] === '--target');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode', '@vscode/ripgrep'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview/index.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
};

/** @type {esbuild.BuildOptions} */
const workersConfig = {
  entryPoints: [
    'src/workers/ast-worker.ts',
  ],
  bundle: true,
  outdir: 'dist/workers',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  // web-tree-sitter uses dynamic WASM loading — mark as external
  // so esbuild doesn't try to bundle .wasm files
  external: ['web-tree-sitter'],
};

const configs = {
  extension: extensionConfig,
  webview: webviewConfig,
  workers: workersConfig,
};

/**
 * Copy WASM files needed at runtime into dist/grammars/.
 *
 * This includes:
 * - tree-sitter.wasm (the core parsing engine)
 * - Language grammar .wasm files from grammars/ directory
 */
function copyWasmFiles() {
  const grammarsOutDir = path.resolve('dist', 'grammars');
  fs.mkdirSync(grammarsOutDir, { recursive: true });

  // 1. Copy tree-sitter.wasm (core engine) from node_modules
  const treeSitterWasm = path.resolve('node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
  if (fs.existsSync(treeSitterWasm)) {
    fs.copyFileSync(treeSitterWasm, path.join(grammarsOutDir, 'tree-sitter.wasm'));
    console.log('  ✓ Copied tree-sitter.wasm (core engine)');
  } else {
    console.warn('  ⚠ tree-sitter.wasm not found in node_modules — AST parsing will use fallback');
  }

  // 2. Copy language grammar .wasm files from grammars/ directory
  const grammarsSourceDir = path.resolve('grammars');
  if (fs.existsSync(grammarsSourceDir)) {
    const wasmFiles = fs.readdirSync(grammarsSourceDir).filter(f => f.endsWith('.wasm'));
    for (const file of wasmFiles) {
      fs.copyFileSync(
        path.join(grammarsSourceDir, file),
        path.join(grammarsOutDir, file),
      );
      console.log(`  ✓ Copied ${file}`);
    }
    if (wasmFiles.length === 0) {
      console.warn('  ⚠ No grammar .wasm files found in grammars/ — run: npm run build:grammars');
    }
  } else {
    console.warn('  ⚠ grammars/ directory not found — AST parsing will use fallback');
  }
}

async function build() {
  const targets = targetArg ? [targetArg] : ['extension', 'webview', 'workers'];

  for (const target of targets) {
    const config = configs[target];
    if (!config) {
      console.error(`Unknown target: ${target}`);
      process.exit(1);
    }

    if (isWatch) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
      console.log(`Watching ${target}...`);
    } else {
      await esbuild.build(config);
      console.log(`Built ${target}`);
    }
  }

  // Copy WASM files after build (only on full build, not per-target)
  if (!targetArg) {
    console.log('\nCopying WASM files...');
    copyWasmFiles();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
