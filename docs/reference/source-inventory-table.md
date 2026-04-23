# Source Inventory Table

Interactive table inside the main webview listing every analyzed file with structural metrics.

## Columns

- File path
- Language
- Lines of code (LOC)
- Imports
- Exports
- Fan-in (number of files that import this one)
- Fan-out (number of files this one imports)

## Controls

- **Sort** on any column
- **Filters**: language, top-level directory
- **Quick filters**: large files (≥500 LOC), high fan-in, high fan-out, unresolved imports
- **Search**: path, exported symbol, import source
- **Row click** → opens the [file-details-drawer](file-details-drawer.md)

## Data source

The table is rendered from a `FileInventoryPayload` (see [message-protocol](message-protocol.md) and [src/shared/types/inventory.ts](../../src/shared/types/inventory.ts)) delivered via `inventory:data`.

## Code

- [src/webview/components/SourceInventoryPage.tsx](../../src/webview/components/SourceInventoryPage.tsx)
- [src/webview/App.tsx](../../src/webview/App.tsx) — state management

## Related

- [dependency-graph](dependency-graph.md) — graph view of the same data
- [analyze-workspace](analyze-workspace.md) — produces the payload
