# Remove Project

Deletes all Atlante data for a project and removes it from the library.

## Command

- ID: `archlens.removeProject`
- Title: **Atlante: Remove Project from Library**
- Hidden from command palette (`when: false`)

## How to trigger

- "×" button on a project row in the [sidebar-view](sidebar-view.md)

## Behavior

1. Shows a confirmation dialog (`showWarningMessage` with "Remove"/"Cancel").
2. On confirm:
   - [ProjectStorageService](../../src/extension/services/ProjectStorageService.ts) deletes the project's `.atlante/` directory.
   - [ProjectRegistryService](../../src/extension/services/ProjectRegistryService.ts) removes the entry from `globalState`.
3. Sidebar updates its list.

Source files are never touched — only the `.atlante/` directory is removed.

## Code

- [src/extension/extension.ts](../../src/extension/extension.ts) — handler + confirmation
- [src/extension/services/ProjectStorageService.ts](../../src/extension/services/ProjectStorageService.ts)
- [src/extension/services/ProjectRegistryService.ts](../../src/extension/services/ProjectRegistryService.ts)

## Related

- [project-registry](project-registry.md)
- [switch-project](switch-project.md)
