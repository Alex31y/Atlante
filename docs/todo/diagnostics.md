# Diagnostics — Refactor Triage for Vibe Coders

## Positioning

Atlante oggi è un "inventory + graph viewer". Il prossimo layer è **refactor triage deterministico** per chi sviluppa velocemente con AI e perde di vista lo stato del codice (file che esplodono a 3000 righe, dead code accumulato, cicli di import nati per caso).

Il differenziatore vs CodeViz / CodeVisualizer / Dependency Cruiser è esattamente questo:

- loro = descrittivi ("ecco com'è fatto il codice")
- Atlante = prescrittivi ("ecco cosa vale la pena rifattorizzare adesso")

Tutto resta locale e deterministico. Nessun LLM, nessuna chiamata di rete.

Fonte principale di ispirazione: il modulo `checks.py` del progetto predecessore ArchLensAI (vedi `docs/reference/data-inventory.md` in quel repo).

---

## Data model nuovo

### `FileDiagnostic`

Da aggiungere in [src/shared/types/inventory.ts](../../src/shared/types/inventory.ts):

```ts
type FileDiagnostic = {
  kind: DiagnosticKind;
  severity: 'info' | 'warning' | 'error';
  message: string;
  symbol?: string;
  line?: number;
  sourceFile: string;
  targetFile?: string; // per check cross-file
};
```

Posizioni nel payload:

- `FileInventoryItem.diagnostics[]` — check a livello di file
- `FileInventoryPayload.diagnostics[]` — check a livello di payload (es. `dir-cycle`)

Aggregato per la UI:

- `FileInventoryItem.diagnosticCounts`: `{ error, warning, info }`
- `FileInventoryPayload.summary.diagnosticCounts`

---

## Check da implementare

Priorità in ordine di ROI per l'utente target.

### Tier 1 — red flag ad alto impatto

| Kind | Severity | Regola | Dati richiesti | Note |
|------|----------|--------|----------------|------|
| `god-file` | warning | LOC > 500 AND functions > 15 AND fan_out > 8 | `loc`, `function_count`, `fan_out` | **il caso d'uso dei "3000 righe"** |
| `giant-function` | warning | funzione con > 100 righe | `FunctionNode.start_line/end_line` | richiede linee precise nel mapper |
| `hub-file` | warning | `fan_in > max(6, 2 * media progetto)` | `fan_in` | minimo assoluto 6 per evitare falsi positivi su progetti piccoli |
| `file-cycle` | error | ciclo di import tra file, lunghezza ≤ 4 | grafo `resolvedDependencies`, DFS | cicli lunghi sono composizioni dei corti — non duplicare |

### Tier 2 — dead code (l'AI ne produce tanto)

| Kind | Severity | Regola | Dati richiesti |
|------|----------|--------|----------------|
| `unused-import` | info | simbolo importato mai referenziato nel corpo | `used_names` vs import symbols |
| `dead-symbol` | info | funzione/classe né esportata né usata localmente | `used_names` + export list |
| `dead-export` | info | simbolo esportato mai importato altrove e non usato localmente | cross-file import map + `used_names` |
| `orphan-file` | info | `fan_in == 0` (mai importato) | `fan_in`, `fan_out` |

### Tier 3 — smell e violazioni strutturali

| Kind | Severity | Regola | Dati richiesti |
|------|----------|--------|----------------|
| `structural-duplicate` | info | Jaccard ≥ 0.7 su nomi funzione AND ≥ 0.5 su import sources, stesso linguaggio, ≥ 3 funzioni | `functions`, `imports` |
| `import-sprawl` | info | `fan_out > 10` AND `function_count ≤ 3` | `fan_out`, `function_count` |
| `dependency-sprawl` | info | `external_import_count / total_files > 8` (payload-level) | summary counters |
| `dir-cycle` | warning | ciclo tra directory sibling | grafo aggregato per `parentDirectory` |
| `layer-violation` | error | import che viola regole in `.atlante/rules.json` | `resolvedDependencies` + config |

---

## Soppressione falsi positivi

Regole da portare dal prior art — tutte necessarie per non generare rumore:

- `unused-import`: skip `__future__`, `import *`, side-effect imports TS/JS (`import './polyfill'`)
- `dead-symbol`: skip dunder methods, metodi dentro classi, nomi `_prefixed`
- `dead-export`: skip se usato localmente, se decorato (framework-wired, es. Angular `@Component`), se è l'unico export del file
- `dir-cycle`: skip self-edges, skip parent-child (directory antenata/discendente)
- `file-cycle`: solo cicli di lunghezza ≤ 4
- `orphan-file`: skip entry points (`main.*`, `index.*`), test files, config files, script dir
- `hub-file`: soglia minima assoluta di 6
- `structural-duplicate`: skip < 3 funzioni, solo stesso linguaggio

---

## Dati richiesti nei mapper AST

I check Tier 2 richiedono due campi che oggi i mapper **non producono**:

### `used_names: Set<string>`

Tutti gli identifier referenziati nel corpo del file (escluse le dichiarazioni di import). Necessario per `unused-import`, `dead-symbol`, `dead-export`.

- [typescript-mapper](../../src/workers/mappers/typescript-mapper.ts): Tree-sitter query su `identifier` + `property_identifier` + `type_identifier`, escludendo i nodi dentro `import_statement`.
- [python-mapper](../../src/workers/mappers/python-mapper.ts): Tree-sitter query su `identifier` + `attribute`, escludendo `import_statement` e `import_from_statement`.
- mapper generici / fallback: skip — questi check non partono per quei linguaggi.

### `call_sites: CallSite[]` (opzionale, Tier futuro)

Call graph parziale per analisi più avanzate. Non necessario per il primo round.

```ts
type CallSite = {
  callerFunction: string;
  calleeName: string;
  calleeKind: 'free' | 'self-method' | 'imported' | 'unknown';
  line: number;
  resolvedFile?: string; // valorizzato durante i checks
};
```

---

## Configurazione

### Soglie esposte come settings

Aggiungere in `package.json` → `contributes.configuration`:

- `archlens.thresholds.godFileLoc` (default: 500)
- `archlens.thresholds.godFileFunctions` (default: 15)
- `archlens.thresholds.godFileFanOut` (default: 8)
- `archlens.thresholds.giantFunctionLines` (default: 100)
- `archlens.thresholds.hubFileFanIn` (default: 6)
- `archlens.thresholds.importSprawlFanOut` (default: 10)
- `archlens.diagnostics.enabled` (default: `true`)
- `archlens.diagnostics.disabledKinds` (default: `[]`) — per spegnere singoli check

### `.atlante/rules.json` per `layer-violation`

File opzionale nella root del workspace:

```json
{
  "layerRules": [
    { "from": "utils/", "cannotImport": ["features/", "pages/"] },
    { "from": "domain/", "cannotImport": ["infra/", "ui/"] }
  ]
}
```

Se il file non esiste, il check `layer-violation` viene saltato silenziosamente.

---

## Nuovo servizio: `DiagnosticsBuilder`

Da creare in `src/extension/services/DiagnosticsBuilder.ts`. Input: `FileInventoryPayload` + `FileStructure[]`. Output: mutazione del payload aggiungendo `diagnostics[]` ai file e alla summary.

Ordine di esecuzione nella pipeline (vedi [analysis-orchestrator](../reference/analysis-orchestrator.md)):

1. discovery
2. AST parse
3. `SourceInventoryBuilder` (com'è oggi)
4. **`DiagnosticsBuilder` (nuovo)**
5. `ProjectStorageService.save()`
6. push `inventory:data` al webview

Ogni check è una funzione pura `(payload, structures, config) => FileDiagnostic[]`. Facile da testare con vitest.

---

## UI — cosa cambia nel webview

Modifiche a [SourceInventoryPage.tsx](../../src/webview/components/SourceInventoryPage.tsx):

### 1. Colonna "Health" / severity pill nella tabella

Per ogni riga: 🔴 N · 🟡 N · 🔵 N. Sortable per totale errori, poi warning, poi info. È il segnale immediato "questo file ha problemi".

### 2. Nuovo quick filter "Needs refactor"

Accanto a `Large files / High fan-in / High fan-out / Unresolved imports`. Combina: god-file OR giant-function OR hub-file OR file-cycle.

### 3. Drawer — sezione "Diagnostics"

Sopra "Symbols". Lista dei `FileDiagnostic` del file, raggruppati per severity, ognuno cliccabile → apre il file alla `line` indicata (nuovo messaggio `file:open` esteso con `line`, vedi [message-protocol](../reference/message-protocol.md)).

### 4. Badge sull'activity bar

Numero totale di errori di progetto sull'icona Atlante nella activity bar. È il nudge che riporta l'utente nel pannello anche quando non ci sta pensando.

### 5. Grafo — evidenza visiva

In [dependency-graph](../reference/dependency-graph.md): nodi con diagnostics `error` bordati di rosso, nodi dei cicli collegati da archi rossi.

---

## Roadmap

### M1 — Tier 1 minimo viable

1. `FileDiagnostic` nel payload + mutazione dei tipi shared
2. `DiagnosticsBuilder` scheletro
3. check: `god-file`, `giant-function`, `hub-file`, `file-cycle`
4. UI: severity pill nella tabella + sezione Diagnostics nel drawer
5. quick filter "Needs refactor"

Rilasciabile da solo. Già copre il caso d'uso principale ("non mi ero accorto che quel file fosse a 2800 righe").

### M2 — Dead code (richiede `used_names`)

1. estendere [typescript-mapper](../../src/workers/mappers/typescript-mapper.ts) e [python-mapper](../../src/workers/mappers/python-mapper.ts) con `used_names`
2. check: `unused-import`, `dead-symbol`, `dead-export`, `orphan-file`
3. soppressioni false-positive
4. badge activity bar

### M3 — Smell e rules

1. `structural-duplicate`, `import-sprawl`, `dependency-sprawl`, `dir-cycle`
2. `.atlante/rules.json` + `layer-violation`
3. evidenza visiva sul grafo

### M4 — nice to have

1. soglie configurabili via settings + UI di override
2. "ignora questa diagnostic" persistito in `.atlante/suppressions.json`
3. trend: confronto con snapshot precedente in `.atlante/` per mostrare "questo file è peggiorato di 400 LOC questa settimana"
4. export markdown del report diagnostics (per PR description)

---

## Quick win parallelo — non bloccante

**Path alias resolution in [import-resolver](../reference/import-resolver.md):** leggere `tsconfig.json → compilerOptions.paths` e `baseUrl`. Oggi sul progetto Architect viewato in demo, 68 su 186 edge (37%) sono unresolved proprio per questo motivo. Finché non è risolto, il filtro "Unresolved imports" è rumoroso e i check `hub-file` / `file-cycle` / `dead-export` sotto-stimano le relazioni reali.

Fix semi-meccanico, alto ritorno, indipendente dal lavoro diagnostics.
