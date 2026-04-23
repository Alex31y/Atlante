# Language Support

Atlante parses multiple languages with Tree-sitter WASM grammars, with a regex fallback for resilience.

## Supported source extensions

`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.java`, `.cs`, `.go`, `.rs`, `.kt`, `.swift`, `.rb`, `.php`

The canonical list is in [src/shared/constants.ts](../../src/shared/constants.ts) (`SUPPORTED_EXTENSIONS`).

## Parsing strategy per language

| Language            | Mapper                                                                                     | Depth                                    |
|---------------------|---------------------------------------------------------------------------------------------|------------------------------------------|
| TypeScript / JavaScript | [typescript-mapper.ts](../../src/workers/mappers/typescript-mapper.ts)                 | Full (classes, methods, types, imports)  |
| Python              | [python-mapper.ts](../../src/workers/mappers/python-mapper.ts)                              | Full (classes, functions, imports)       |
| Other Tree-sitter grammars | [generic-mapper.ts](../../src/workers/mappers/generic-mapper.ts)                    | Top-level symbols + imports              |
| Any                 | [fallback-parser.ts](../../src/workers/mappers/fallback-parser.ts)                          | Regex-based, if Tree-sitter fails        |

## Adding a language

1. Add the extension to `SUPPORTED_EXTENSIONS` in [constants.ts](../../src/shared/constants.ts).
2. Register its Tree-sitter grammar in [grammar-config.ts](../../src/workers/grammar-config.ts).
3. Either extend the generic mapper or add a dedicated one in `src/workers/mappers/`.
4. Extend the [file-watcher](file-watcher.md) glob to cover the new extension.

## Related

- [ast-worker](ast-worker.md)
- [import-resolver](import-resolver.md) — resolution rules per language family
