# File Details Drawer

Side panel that opens when a row is selected in the [source-inventory-table](source-inventory-table.md), showing the full structural profile of one file.

## Contents

- File path, language, line count
- **Symbols** — classes, functions, interfaces, methods, exports
- **Imports** — grouped, annotated with resolution status (resolved / external / unresolved)
- **Resolved internal dependencies** — files this one depends on
- **Dependents** — files that import this one (inverse of fan-in)
- **Open File** action — triggers `file:open` (see [message-protocol](message-protocol.md))

## Code

- [src/webview/components/SourceInventoryPage.tsx](../../src/webview/components/SourceInventoryPage.tsx)

## Related

- [import-resolver](import-resolver.md) — how imports become "resolved"
- [source-inventory-table](source-inventory-table.md)
