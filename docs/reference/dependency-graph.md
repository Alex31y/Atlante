# Dependency Constellation Graph

Interactive network view of internal file dependencies, rendered alongside the inventory table.

## Visualization

- **Nodes** = files (star glyphs), colored by language, sized by fan-in + fan-out
- **Groups** = top-level directories (clusters)
- **Edges** = resolved internal imports
- Max ~140 nodes (configurable in code) to keep the view readable

## Interactions

- **Drag** to pan
- **Mouse wheel** to zoom
- **Fit to view** and **fullscreen** toggles
- **Language legend**
- **Edge focus mode** — hide edges not connected to the selected file
- Selecting a node opens the [file-details-drawer](file-details-drawer.md)

## Code

- [src/webview/components/SourceInventoryPage.tsx](../../src/webview/components/SourceInventoryPage.tsx)

## Related

- [source-inventory-table](source-inventory-table.md) — same data, tabular form
- [import-resolver](import-resolver.md) — edge computation
