# Atlante Documentation

Atlante is a deterministic VS Code extension for mapping a repository after fast coding sessions. It scans local source files, builds a source inventory, and highlights files that may deserve refactor attention through immediate metrics and dependency views.

Atlante does not use LLMs, external inference APIs, cloud services, API keys, embeddings, or remote analysis. All current analysis is local and deterministic.

## Current Features

- Workspace source scan for JavaScript, TypeScript, Python, and supported Tree-sitter grammars.
- File inventory with path, language, line count, imports, exports, fan-in, and fan-out.
- KPI strip for total files, total lines, internal dependency edges, unresolved imports, and language count.
- Search by file path, import source, and exported symbol.
- Filters by language and top-level folder.
- Quick filters for large files, high fan-in, high fan-out, and unresolved imports.
- Sortable inventory table.
- File details drawer with symbols, imports, resolved dependencies, dependents, and an Open File action.
- Dependency constellation graph built from resolved internal imports.
- Graph pan, zoom, fit, fullscreen, edge focus mode, language legend, and file selection details.
- Project sidebar with analyzed project library and deterministic project summaries.

## What The Scan Produces

Each analyzed file contributes:

- `filePath`
- `language`
- `loc`
- `imports`
- `exports`
- `classes`, `functions`, `interfaces`, `symbols`
- `resolvedDependencies`
- `unresolvedImports`
- `dependents`
- `fanIn`
- `fanOut`
- `topLevelDirectory`
- `parentDirectory`

Workspace summary data includes:

- total source files
- language counts
- top directories
- total internal dependency edges
- unresolved import count
- generated timestamp

## Views

### Inventory Table

The table is the primary view for triage. It keeps the repository sortable and searchable while showing the most useful deterministic metrics next to each file.

A selected row opens a details drawer. The drawer is an overlay, so the table layout does not change when details are open.

### Dependency Constellation

The graph view renders files as stars grouped by top-level directory. Edges represent resolved internal imports. Star color is based on language and star size reflects dependency surface through fan-in/fan-out.

Controls include:

- mouse wheel zoom
- drag to pan
- fit view
- fullscreen
- all edges vs selected-neighborhood edges
- selected file details

## Runtime Architecture

- VS Code extension host coordinates project selection, analysis commands, storage, and webview panels.
- AST worker parses files using Tree-sitter/WebAssembly grammars.
- Source inventory builder aggregates file structures, imports, exports, dependency resolution, fan-in, and fan-out.
- React webview renders the table, filters, file drawer, and graph.
- Project storage persists Atlante data under `.atlante` in the analyzed project.

## Commands

The current command identifiers still use the legacy `archlens.*` namespace for compatibility:

- `archlens.showDiagram`
- `archlens.analyzeWorkspace`
- `archlens.refreshDiagram`
- `archlens.switchProject`
- `archlens.removeProject`

User-facing titles are branded as Atlante.

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Type-check:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Package the extension:

```bash
npm run package
```

## Non-Goals For This MVP

- No chat interface.
- No LLM provider configuration.
- No API keys.
- No external inference.
- No embeddings or semantic search.
- No generated architectural reports.

Atlante is currently focused on immediate local repo triage: inventory, metrics, dependencies, and navigation.
