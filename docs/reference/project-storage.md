# Project Storage

Reads and writes Atlante's per-project data under a `.atlante/` directory at the workspace root.

## Layout

```
.atlante/
├── inventory/
│   └── inventory.json        # FileInventoryPayload (main data)
└── analysis/
    └── hashes.json           # Content hashes for change detection
```

Additional subdirectories are reserved for future features (model, hypothesis, diagram, clusters, flows, health, rules, git, usage).

## Responsibilities

- Create the directory structure on first write.
- Serialize `FileInventoryPayload` deterministically (stable key ordering) so diffs stay readable.
- Load existing data on project switch without triggering a re-analysis.
- Delete the whole `.atlante/` tree on [remove-project](remove-project.md).

## Code

- [src/extension/services/ProjectStorageService.ts](../../src/extension/services/ProjectStorageService.ts)
- [src/shared/types/inventory.ts](../../src/shared/types/inventory.ts) — payload schema

## Related

- [analysis-orchestrator](analysis-orchestrator.md) — main writer
- [project-registry](project-registry.md) — index over storages
