# Get Started Walkthrough

VS Code walkthrough that onboards new users in three steps.

## Contribution

Declared in `package.json` under `contributes.walkthroughs`:

- ID: `archlens.getStarted`
- Title: **Get Started with Atlante**

## Steps

1. **Open Source Inventory** → runs [show-diagram](show-diagram.md)
2. **Analyze the Workspace** → runs [analyze-workspace](analyze-workspace.md)
3. **Review the Inventory** — guidance on search, filters, and row expansion in the [source-inventory-table](source-inventory-table.md)

## How to trigger

- Automatically offered on first install
- Command palette → "Welcome: Open Walkthrough" → choose Atlante

## Code

- [package.json](../../package.json) — `contributes.walkthroughs` block
