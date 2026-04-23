# Configuration

User-configurable settings contributed by the extension. Exposed in VS Code Settings UI under **Atlante**.

## Settings

### `archlens.excludePatterns`

- Type: `string[]`
- Default: 40+ glob patterns covering `node_modules`, `dist`, `build`, `.venv`, `target`, `Pods`, `DerivedData`, lockfiles, caches, etc. (see [package.json](../../package.json))
- Description: glob patterns for files or folders excluded from analysis.
- Read by: [analysis-orchestrator](analysis-orchestrator.md) and [file-watcher](file-watcher.md).

Add project-specific patterns here when monorepos or generated folders bloat the inventory.

### `archlens.maxFilesForFullAnalysis`

- Type: `number`
- Default: `500`
- Description: maximum number of source files included in the deterministic source inventory. Above this threshold the user is warned before analysis proceeds.
- Read by: [analysis-orchestrator](analysis-orchestrator.md).

## Related

- [analyze-workspace](analyze-workspace.md)
- [language-support](language-support.md) — which extensions count toward the limit
