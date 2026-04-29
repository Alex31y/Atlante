# Graph workflow development plan

## Product frame

The graph is not a standalone overview. Its value appears when the user selects a file and sees the dependency blast radius: connected files, dimmed noise, and the side panel with fan-in, fan-out, dependencies, and dependents.

The first graph experience should therefore guide the user toward selection. The default hairball is useful context, but it should not be the only first impression.

## First-click onboarding

Goal: make the first useful action obvious.

Planned changes:

1. Auto-select an interesting node when the graph opens for the first time.
   - Default candidate: highest dependency impact.
   - If the quick filter is fan-in oriented, prefer the highest fan-in file.
   - If the quick filter is fan-out oriented, prefer the highest fan-out file.
2. Show a lightweight hint only when no file is selected.
   - Candidate copy: "Select a file to reveal its dependency impact."
   - The hint should live inside the graph surface, visually tied to nodes, not in the generic page toolbar.
3. Keep the selected-node reveal as the main aha moment.
   - Connected edges become prominent.
   - Unrelated nodes dim.
   - The details panel opens immediately.

## Graph search as navigation

Current issue: the existing search bar filters the inventory, feels slow, and is visually disconnected from the graph. In graph mode, searching for a file should select it automatically. It should not filter the graph.

Goal: make search a fast way to jump to a file and inspect its impact.

Planned behavior:

1. In graph mode, the search field acts as file navigation.
   - Typing shows file path matches.
   - Choosing a match selects the corresponding graph node.
   - The viewport animates to the selected node.
   - The side panel opens with dependencies and dependents.
2. Search must not remove non-matching nodes in graph mode.
   - The graph should remain spatially stable.
   - The selected result should become the active focus.
   - Non-connected nodes can dim through the existing selected-node behavior.
3. Search should feel connected to the graph.
   - Place or mirror the search affordance in the graph header.
   - Use wording that implies navigation, for example "Find file in graph".
   - Keep the generic inventory filters available, but do not make them the primary graph search path.
4. Search should remain responsive.
   - Debounce only the suggestion list if needed.
   - Selection should be immediate.
   - Matching should use precomputed lowercase file paths for the current graph file set.

## Selected-file search

When a file is already selected, search should help the user move from one impact view to another without resetting the graph mental model.

Planned behavior:

1. The selected file remains active while the user types.
2. Selecting a search result replaces the active file.
3. The panel updates in place.
4. The viewport moves to the new node.
5. Escape closes suggestions first, then clears active search text, then can clear selection if already idle.

## Most connected ranking

Add a compact ranking inside the graph surface for the files with the highest fan-in plus fan-out. This gives the user a useful starting point even when they do not know which file to search for.

Planned behavior:

1. Show the top connected files in a small panel inside the graph.
2. Clicking a row selects and centers the matching node.
3. The ranking should not filter the graph.
4. The selected row should reflect the active graph focus.
5. The ranking panel should be toggleable from the graph header.

## Queue mode labels

These controls should change ordering, not membership. They are queue modes: every file remains available unless the user applies language, folder, or text search constraints.

Labels:

| Current | Candidate |
|---------|-----------|
| Largest files | Refactor candidates |
| High fan-in | Critical hubs |
| High fan-out | Tangled files |

This is secondary to the graph onboarding and search work. The main product improvement is making the selected-node workflow obvious.

## Acceptance checks

1. Opening graph view for the first time shows an obvious selected-file experience or a clear hint to select a file.
2. Searching in graph mode selects and centers a file instead of filtering the graph.
3. The details panel opens from search selection exactly as it does from node click.
4. The graph does not jump, collapse, or lose context while typing.
5. Queue modes reorder the graph and table queues without filtering files out.
6. The most connected ranking is toggleable and selects nodes without changing graph membership.
