# File Watcher

Monitors source files for changes and feeds incremental updates into the [analysis-orchestrator](analysis-orchestrator.md).

## Behavior

- Glob: `**/*.{ts,tsx,js,jsx,py,java,cs,go,rs,kt,swift,rb,php}` (hard-coded in the watcher)
- Respects `archlens.excludePatterns` before scheduling work.
- **Debouncing**: bursts of changes are coalesced (default 500 ms).
- **Adaptive debounce**: if many files change in quick succession (e.g. an agent session), debounce widens so we re-analyze once at the end instead of many times mid-flight.
- Armed only after the first full analysis — otherwise there is no baseline to update.

## Code

- [src/extension/watchers/FileWatcher.ts](../../src/extension/watchers/FileWatcher.ts)
- [src/extension/extension.ts](../../src/extension/extension.ts) — lifecycle

## Related

- [analyze-workspace](analyze-workspace.md) — arms the watcher
- [refresh-diagram](refresh-diagram.md) — manual full re-run when watcher isn't enough
