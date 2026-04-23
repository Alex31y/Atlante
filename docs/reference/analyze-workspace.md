# Analyze Workspace

Runs a full static scan of the active workspace and produces the source inventory.

## Command

- ID: `archlens.analyzeWorkspace`
- Title: **Atlante: Analyze Workspace**
- Hidden from command palette (`when: false`) — triggered from the sidebar or walkthrough

## Pipeline

1. Discover source files (filtered by `archlens.excludePatterns`).
2. Enforce `archlens.maxFilesForFullAnalysis` (warn if exceeded).
3. Parse each file off-thread via the [ast-worker](ast-worker.md).
4. [SourceInventoryBuilder](../../src/extension/services/SourceInventoryBuilder.ts) aggregates per-file results and resolves internal imports with [import-resolver](import-resolver.md).
5. [project-storage](project-storage.md) writes `.atlante/inventory/inventory.json` and `.atlante/analysis/hashes.json`.
6. Inventory is pushed to any open webview via `inventory:data`.
7. On first successful analysis, the [file-watcher](file-watcher.md) is armed for incremental updates.

## How to trigger

- Sidebar **Analyze Workspace** button
- Walkthrough step "Analyze the Workspace"
- Programmatically: `vscode.commands.executeCommand('archlens.analyzeWorkspace')`

## Code

- [src/extension/services/AnalysisOrchestrator.ts](../../src/extension/services/AnalysisOrchestrator.ts)
- [src/extension/services/SourceInventoryBuilder.ts](../../src/extension/services/SourceInventoryBuilder.ts)

## Related

- [configuration](configuration.md) — excludes and file budget
- [refresh-diagram](refresh-diagram.md) — re-run after initial analysis
- [analysis-orchestrator](analysis-orchestrator.md)
