# Analysis Orchestrator

Coordinates the full analysis pipeline: discovery → parsing → inventory → persistence → notification.

## Responsibilities

- Enumerate source files under the workspace, applying `archlens.excludePatterns` and the `archlens.maxFilesForFullAnalysis` budget.
- Hash each file (content-based) and skip parsing for files whose hash is unchanged since the last run.
- Dispatch parse requests to the [ast-worker](ast-worker.md) in batches.
- Feed parse results to [SourceInventoryBuilder](../../src/extension/services/SourceInventoryBuilder.ts), which merges structures and resolves imports via [import-resolver](import-resolver.md).
- Persist results through [project-storage](project-storage.md) and update [project-registry](project-registry.md) summaries.
- Push `inventory:data` / `inventory:status` to any open webview.
- Drive incremental re-analysis when triggered by the [file-watcher](file-watcher.md).

## Code

- [src/extension/services/AnalysisOrchestrator.ts](../../src/extension/services/AnalysisOrchestrator.ts)
- [src/extension/services/SourceInventoryBuilder.ts](../../src/extension/services/SourceInventoryBuilder.ts)

## Related

- [analyze-workspace](analyze-workspace.md) — user-facing command
- [refresh-diagram](refresh-diagram.md)
- [configuration](configuration.md)
