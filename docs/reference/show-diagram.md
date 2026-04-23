# Show Diagram

Opens the main Atlante webview panel with the source inventory and dependency visualization.

## Command

- ID: `archlens.showDiagram`
- Title: **Atlante**
- Icon: `$(symbol-structure)`
- Visible in command palette: yes

## How to trigger

- Command palette → **Atlante**
- Sidebar **Open Inventory** button
- Walkthrough step "Open Source Inventory"

## Behavior

1. If the panel is already open, it is revealed.
2. Otherwise a new webview panel is created by [DiagramPanelProvider](../../src/extension/providers/DiagramPanelProvider.ts).
3. The webview bundle ([App.tsx](../../src/webview/App.tsx)) mounts and sends `webview:ready`.
4. The extension responds with the current inventory (if present) or a status asking the user to analyze the workspace.

## Code

- [src/extension/extension.ts](../../src/extension/extension.ts) — registers the command
- [src/extension/providers/DiagramPanelProvider.ts](../../src/extension/providers/DiagramPanelProvider.ts) — creates/manages the panel
- [src/webview/App.tsx](../../src/webview/App.tsx) — panel contents

## Related

- [analyze-workspace](analyze-workspace.md) — run before inventory appears
- [message-protocol](message-protocol.md) — how panel and host talk
