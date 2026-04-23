# Import Resolver

Pure functions that map import statements from source files to actual files in the project. Drives fan-in, fan-out, and all internal edges in the [dependency-graph](dependency-graph.md).

## Resolution rules

- **Relative TS/JS imports** (`./foo`, `../bar/baz`): try the literal path, then common extensions (`.ts`, `.tsx`, `.js`, `.jsx`, …), then `index.*` in a matching folder.
- **Relative Python imports** (`.module`, `..pkg.mod`): converted to path form (`./module`, `../pkg/mod`) and matched against `.py` or `__init__.py`.
- **Absolute Python imports**: resolved against known packages in the project by suffix matching.
- **Barrel files**: `index.*` / `__init__.py` are followed one hop.
- Unresolved imports are flagged so they can be surfaced as a quick filter in the [source-inventory-table](source-inventory-table.md).

## Pure & testable

The resolver takes plain inputs (list of files, import string, base path) and returns resolved paths — no I/O. This makes it trivial to unit-test and safe to reuse across the orchestrator and mappers.

## Code

- [src/shared/import-resolver.ts](../../src/shared/import-resolver.ts)

## Related

- [analysis-orchestrator](analysis-orchestrator.md) — calls the resolver during inventory build
- [ast-worker](ast-worker.md) — produces the raw import strings
