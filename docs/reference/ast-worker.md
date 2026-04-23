# AST Worker

Off-thread parser that extracts structured facts (classes, functions, imports, exports, complexity) from source files using Tree-sitter WASM grammars.

## Why a worker

Parsing runs in a Node.js worker thread so heavy files don't block the extension host or the UI thread.

## Flow

1. `init` message loads the requested grammars.
2. `parse` messages carry a batch of files; the worker picks a mapper per language.
3. Each file returns a structured result; errors are reported per-file without killing the batch.

## Mappers

- [typescript-mapper.ts](../../src/workers/mappers/typescript-mapper.ts) — TS/JS (exports, imports, classes, methods, types)
- [python-mapper.ts](../../src/workers/mappers/python-mapper.ts) — Python
- [generic-mapper.ts](../../src/workers/mappers/generic-mapper.ts) — fallback for other Tree-sitter grammars
- [fallback-parser.ts](../../src/workers/mappers/fallback-parser.ts) — pure-regex safety net when Tree-sitter is unavailable or crashes
- [complexity.ts](../../src/workers/mappers/complexity.ts) — cognitive complexity metric

## Code

- [src/workers/ast-worker.ts](../../src/workers/ast-worker.ts) — entry point
- [src/workers/grammar-config.ts](../../src/workers/grammar-config.ts) — language → WASM mapping
- [src/shared/types/worker-messages.ts](../../src/shared/types/worker-messages.ts) — request/response types

## Related

- [language-support](language-support.md)
- [analysis-orchestrator](analysis-orchestrator.md)
