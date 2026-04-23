# Project Registry

Tracks the list of projects Atlante knows about, surviving across VS Code sessions.

## Storage

- VS Code `globalState` (per-user, machine-local)
- Not synced through VS Code Settings Sync

## Entry shape

Each entry carries:

- project ID (stable)
- display name
- absolute filesystem path
- analysis summary (file count, edge count, last-analyzed timestamp)

## API

- `getAll()` — list all known projects
- `upsert(entry)` — add or update
- `remove(id)` — delete
- `updateSummary(id, summary)` — refresh metrics after an analysis run
- Validation on startup — entries whose path no longer exists on disk are pruned

## Code

- [src/extension/services/ProjectRegistryService.ts](../../src/extension/services/ProjectRegistryService.ts)

## Related

- [switch-project](switch-project.md)
- [remove-project](remove-project.md)
- [project-storage](project-storage.md) — per-project on-disk data
