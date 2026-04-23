# Sidebar View

Activity-bar panel acting as the entry point for Atlante: quick actions plus the project library.

## Contribution

- View container: `archlens` (activity bar), icon `resources/atlante-icon.svg`
- View: `archlens.sidebarView` (type: `webview`)

## Features

- **Open Inventory** — runs [show-diagram](show-diagram.md)
- **Analyze Workspace** — runs [analyze-workspace](analyze-workspace.md)
- **Project list** — one row per registered project with name, file count, edge count
- **Project selection** — click to [switch-project](switch-project.md)
- **Remove button** — per-entry "×" triggers [remove-project](remove-project.md)
- Active project is highlighted

## Code

- [src/extension/providers/SidebarViewProvider.ts](../../src/extension/providers/SidebarViewProvider.ts) — webview provider, inline HTML/CSS/JS
- [src/extension/extension.ts](../../src/extension/extension.ts) — command dispatch

## Related

- [message-protocol](message-protocol.md)
- [project-registry](project-registry.md)
