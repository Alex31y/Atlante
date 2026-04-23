# Refresh Diagram

Re-runs workspace analysis from inside the webview. Functionally equivalent to [analyze-workspace](analyze-workspace.md) but surfaced as "Refresh" in the UI.

## Command

- ID: `archlens.refreshDiagram`
- Title: **Atlante: Refresh**
- Hidden from command palette (`when: false`)

## How to trigger

- **Refresh** button inside the inventory webview
- Message `inventory:refresh` from the webview

## Behavior

Discards cached hashes where appropriate and runs the full pipeline again. Useful after large external changes (checkout, merge, generated files) where incremental updates may lag.

## Code

- [src/extension/extension.ts](../../src/extension/extension.ts) — handler
- [src/extension/services/AnalysisOrchestrator.ts](../../src/extension/services/AnalysisOrchestrator.ts) — orchestration

## Related

- [analyze-workspace](analyze-workspace.md)
- [file-watcher](file-watcher.md) — covers small edits automatically
