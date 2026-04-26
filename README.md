# Atlante

**Find the files your AI coding agent is silently bloating.**

Your agent keeps adding code to the same handful of files. They grow past 2,000 lines, then past 4,000, then they stop fitting in context comfortably. Suddenly every refactor prompt fails, every edit takes three tries, and the agent starts inventing APIs that already exist two screens above.

Atlante scans your workspace locally, without any LLM, and tells you exactly which files to split **before** your next session becomes a dumpster fire. Not a graph to interpret. A ranked list of what matters, sorted.

[![Dependency Constellation](https://github.com/Alex31y/Atlante/raw/main/docs/assets/graph.png)](/Alex31y/Atlante/blob/main/docs/assets/graph.png)

## Why this exists

AI-assisted coding amplifies volume. Structural judgment doesn't scale at the same speed:

- files grow past 3,000 lines before anyone notices, and then they're too big to load into any agent's context usefully
- the agent writes helpers that will never be called, and you can't spot them from inside the editor
- duplicate imports and cycles appear by accident, not by choice
- silent fan-in turns innocent modules into single points of failure

Linters look at one line. Type checkers look at types. Neither tells you *which file to refactor next so your agent can keep working*. Atlante does.

Three principles, in order:

1. **Deterministic.** Same input, same output. Always.
2. **Local.** Nothing leaves your machine. No accounts, no uploads, no telemetry.
3. **Prescriptive.** Not "here's a graph to interpret" but "these are the files that matter, sorted".

## The workflow

1. You're deep in a Claude Code / Cursor / Aider session. Things feel slow. Edits start failing.
2. Run **Analyze Workspace**.
3. Sort by LOC. The top five files are your problem.
4. Pick one, open the details drawer, see its fan-in and who imports it.
5. Ask the agent to split it with that context. Resume shipping.

That's it. No AI in the loop, no cloud, no waiting. The analysis is serialized under `.atlante/` as diff-friendly JSON, so you can commit it and watch your repo's structural health over time.

## What you get today

[![Source Inventory Table](https://github.com/Alex31y/Atlante/raw/main/docs/assets/table.png)](/Alex31y/Atlante/blob/main/docs/assets/table.png)

- **Source inventory table.** Every file with LOC, imports, exports, fan-in, fan-out. Sortable, searchable, filterable.
- **Quick filters.** *Large files*, *High fan-in*, *High fan-out*, *Unresolved imports*. One click, see what stands out.
- **File details drawer.** Symbols, imports (resolved vs external vs unresolved), dependents, open-file action.
- **Dependency Constellation.** Interactive graph of internal dependencies, clustered by top-level folder, with a focus mode to see only what connects to the selected file.
- **Project library.** Analyze multiple projects, switch between them from the sidebar.
- **Persistent analysis.** Results stored under `.atlante/` in your workspace: stable JSON, diff-friendly, versionable.

Supported languages: JavaScript, TypeScript, Python via Tree-sitter AST; Java, C#, Go, Rust, Kotlin, Swift, Ruby, PHP via a generic/fallback parser.

## What's next

The next layer is **diagnostics**: deterministic rules that turn the inventory into actionable refactor flags (`god-file`, `giant-function`, `hub-file`, `file-cycle`, `dead-export`, and more). The full plan lives in [docs/todo/diagnostics.md](https://github.com/Alex31y/Atlante/blob/main/docs/todo/diagnostics.md).

See [docs/vision.md](https://github.com/Alex31y/Atlante/blob/main/docs/vision.md) for the longer framing.

## Install

Install from the [**VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=OlexiyLysytsya.atlante), or search for *Atlante* in the Extensions panel inside VS Code.

<details>
<summary>Build from source</summary>

```bash
git clone https://github.com/Alex31y/Atlante.git
cd Atlante
npm install
npm run build
npm run package
```

Then in VS Code: **Extensions → ⋯ → Install from VSIX…** and pick the generated `atlante-*.vsix`.

</details>

## Use

1. Open any workspace.
2. Command palette → **Atlante** (opens the panel).
3. Click **Analyze Workspace** in the sidebar.
4. Explore: sort the table, flip to the graph, click rows for details.

## Commands

| Command | What it does |
| --- | --- |
| `archlens.showDiagram` | Open the Atlante panel |
| `archlens.analyzeWorkspace` | Run a full scan |
| `archlens.refreshDiagram` | Re-analyze the workspace |
| `archlens.switchProject` | Switch the active analyzed project |
| `archlens.removeProject` | Remove a project from the library |

Per-feature docs: [docs/reference/](https://github.com/Alex31y/Atlante/blob/main/docs/reference/README.md).

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `archlens.excludePatterns` | 40+ globs | Folders/files skipped during analysis |
| `archlens.maxFilesForFullAnalysis` | 500 | Warn threshold before analyzing very large workspaces |

## Development

```bash
npm install
npm run build        # full build
npm run watch        # rebuild on change
npm run lint         # tsc --noEmit
npm test             # vitest
npm run package      # produce .vsix
```

Repo layout:

```
src/
├── extension/   # VS Code host (commands, providers, services, watchers)
├── webview/     # React UI (inventory + graph)
├── workers/     # Worker-thread Tree-sitter parsing
└── shared/      # Types, constants, import resolver
```

## Non-goals

- No chat, no LLM, no API keys, no embeddings.
- No cloud analysis, no telemetry on your code.
- Not a linter, not a type checker, not a runtime profiler.

## Read more

- [Why I built Atlante](https://alexlys.dev/blog/atlante/). The longer story, the principles, the *why now*.

## License

MIT. See [LICENSE](https://github.com/Alex31y/Atlante/blob/main/LICENSE).
