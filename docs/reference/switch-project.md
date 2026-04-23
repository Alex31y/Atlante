# Switch Project

Switches the active project in Atlante's library, loading its inventory without re-running analysis.

## Command

- ID: `archlens.switchProject`
- Title: **Atlante: Switch Project**
- Visible in command palette: yes

## How to trigger

- Command palette → **Atlante: Switch Project** → pick from list
- Click a project entry in the [sidebar-view](sidebar-view.md)
- Message `project:switch` from the webview

## Behavior

1. [ProjectRegistryService](../../src/extension/services/ProjectRegistryService.ts) lists known projects (stored in VS Code `globalState`).
2. User selects one (QuickPick) or it is provided by ID.
3. [ProjectStorageService](../../src/extension/services/ProjectStorageService.ts) loads the project's persisted inventory.
4. Webview receives `project:switched` + `inventory:data`.

Projects that no longer exist on disk are pruned at startup.

## Code

- [src/extension/extension.ts](../../src/extension/extension.ts) — command handler
- [src/extension/services/ProjectRegistryService.ts](../../src/extension/services/ProjectRegistryService.ts)
- [src/extension/providers/SidebarViewProvider.ts](../../src/extension/providers/SidebarViewProvider.ts)

## Related

- [project-registry](project-registry.md)
- [project-storage](project-storage.md)
