# Atlante — Reference

Atlante is a deterministic VS Code extension that maps a repository's source inventory and internal dependencies. All analysis is local, static, and reproducible — no LLMs or network calls.

This folder documents every independent feature in isolation.

## Commands

- [show-diagram](show-diagram.md) — Open the main inventory panel
- [analyze-workspace](analyze-workspace.md) — Run a full static scan
- [refresh-diagram](refresh-diagram.md) — Re-analyze from the webview
- [switch-project](switch-project.md) — Change the active analyzed project
- [remove-project](remove-project.md) — Delete a project's Atlante data

## UI

- [sidebar-view](sidebar-view.md) — Activity-bar project library
- [source-inventory-table](source-inventory-table.md) — Sortable/filterable file table
- [file-details-drawer](file-details-drawer.md) — Per-file symbols, imports, dependents
- [dependency-graph](dependency-graph.md) — Constellation visualization
- [walkthrough](walkthrough.md) — Get Started onboarding

## Core systems

- [analysis-orchestrator](analysis-orchestrator.md) — Pipeline coordinator
- [ast-worker](ast-worker.md) — Off-thread Tree-sitter parser
- [file-watcher](file-watcher.md) — Incremental re-analysis on file changes
- [import-resolver](import-resolver.md) — Resolve imports to local files
- [project-registry](project-registry.md) — Multi-project library persistence
- [project-storage](project-storage.md) — `.atlante/` on-disk storage
- [message-protocol](message-protocol.md) — Extension ↔ webview communication

## Configuration

- [configuration](configuration.md) — User settings (`archlens.*`)
- [language-support](language-support.md) — Supported languages and parsers

## Architecture at a glance

```
src/
├── extension/   # VS Code host (commands, providers, services, watchers)
├── webview/     # React UI (inventory + graph)
├── workers/     # Worker-thread Tree-sitter parsing
└── shared/      # Types, constants, import resolver
```

Data flow: discover files → parse via AST worker → build inventory + resolve imports → persist to `.atlante/` → render in React webview → watch for changes → repeat incrementally.
