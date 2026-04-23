# Message Protocol

Typed message passing between the extension host, the main webview, and the sidebar webview.

## Extension → Webview

- `inventory:data` — full `FileInventoryPayload`
- `inventory:status` — progress / empty-state / error text
- `project:switched` — active project changed, expect a fresh `inventory:data`

## Webview → Extension

- `webview:ready` — boot complete, please send current state
- `inventory:request` — explicit pull (used on reconnect)
- `inventory:refresh` — re-run analysis ([refresh-diagram](refresh-diagram.md))
- `file:open` — open a source file in VS Code ([file-details-drawer](file-details-drawer.md))
- `project:switch` — switch active project ([switch-project](switch-project.md))
- `debug:log` — forward a log line to the extension's output channel

## Code

- [src/shared/types/messages.ts](../../src/shared/types/messages.ts) — type definitions
- [src/extension/providers/DiagramPanelProvider.ts](../../src/extension/providers/DiagramPanelProvider.ts) — main webview side
- [src/extension/providers/SidebarViewProvider.ts](../../src/extension/providers/SidebarViewProvider.ts) — sidebar side
- [src/webview/App.tsx](../../src/webview/App.tsx) — webview handler

## Worker protocol

Separately, the [ast-worker](ast-worker.md) uses its own request/response pairs defined in [src/shared/types/worker-messages.ts](../../src/shared/types/worker-messages.ts) (`init`, `parse`, `ready`, per-file results, errors).
