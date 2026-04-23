# Atlante — Vision

## Per chi

**Vibe coder** e sviluppatori AI-assisted: persone che producono codice velocemente, spesso con un agente, e che non hanno il tempo (o l'abitudine) di accorgersi quando un file è esploso a 3000 righe, quando tre helper duplicati convivono in cartelle diverse, quando un import ciclico si è infilato fra due moduli.

Il target non è lo staff engineer che audita l'architettura ogni trimestre. È lo sviluppatore che chiude la feature alle 23 e spinge, e che un mese dopo non riesce più a toccare quel file senza rompere altro.

## Il problema

L'AI-assisted coding amplifica il volume. Il giudizio strutturale non scala alla stessa velocità:

- i file crescono senza che nessuno se ne accorga
- il dead code si accumula — l'agente genera helper che non verranno mai chiamati
- import duplicati e cicli nascono per caso, non per scelta
- il fan-in silenzioso trasforma moduli innocui in single point of failure
- il refactor viene rimandato perché "non si vede" dove sarebbe prioritario

Gli IDE non segnalano niente di tutto questo. Il linter vede la singola riga, non il file; il type checker vede i tipi, non la forma. Il code review umano è l'unico filtro — e nei flussi vibe-coding spesso manca.

## La risposta

Atlante è un **triage di refactor deterministico, locale, sempre aggiornato**.

Non descrive il codice ("ecco com'è fatto"). Dice cosa riparare ("questi 4 file, in questo ordine, per questi motivi"). Guarda il repository con metriche stabili e produce un verdetto riproducibile — nessun LLM, nessuna chiamata di rete, nessuna dipendenza da un servizio che domani può cambiare policy o chiudere.

Tre principi, in ordine di importanza:

1. **Deterministico.** Stesso input → stesso output. Sempre. È ciò che permette di fidarsi del verdetto e di usarlo come segnale in CI, in un pre-commit, in un dashboard di progetto.
2. **Locale.** Niente lascia la macchina. Niente account, niente upload, niente telemetria sul codice. È quello che rende il tool usabile su repo privati, proprietari, regolamentati.
3. **Prescrittivo.** Ogni output è azionabile. Non "ecco un grafo da interpretare" ma "questo file è un `god-file`, questa funzione è un `giant-function`, questo ciclo di import è al nodo X".

## Cosa Atlante è

- un **inventario statico** del repository: file, simboli, import, export, dipendenze interne, fan-in/out
- un **layer di diagnostic**: regole deterministiche che trasformano l'inventario in allarmi di refactor
- un **workspace persistente** in `.atlante/`: i risultati sono serializzati in JSON stabile, diff-friendly, versionabile
- un **pannello VS Code** con tabella, dettaglio per file, grafo delle dipendenze, filtri rapidi per "cosa mi conviene guardare adesso"

## Cosa Atlante non è

- non è un linter (non vede la singola riga)
- non è un type checker (non tocca i tipi)
- non è un AI code review (nessun LLM nel loop)
- non è un visualizzatore generico di dipendenze (CodeViz, CodeVisualizer, Dependency Cruiser coprono già quel segmento)
- non è un tool di profiling runtime

Se una feature richiede di rompere uno dei tre principi sopra — determinismo, località, prescrittività — probabilmente non appartiene ad Atlante.

## Perché ora

I visualizzatori di dipendenze esistono da dieci anni. La categoria "capire il codice" è satura.

La categoria che non esiste ancora è **"triage post-agent"**: dare a uno sviluppatore un verdetto immediato sullo stato del codice che ha appena prodotto (o che un agente ha appena prodotto per lui), senza dover caricare niente da nessuna parte. È una finestra che si è aperta con Copilot, Cursor, Claude Code, Aider — tool che producono molto codice e poco contesto strutturale.

Atlante è progettato per essere il secondo schermo mentale di chi lavora con questi tool.

## Segnali di successo

Sappiamo di averla fatta giusta quando:

- un utente apre Atlante dopo una sessione di coding e dice "non mi ero accorto che quel file fosse così grosso"
- un utente spinge una PR con meno file toccati di quelli che avrebbe toccato senza Atlante, perché il diagnostics gli ha detto che tre degli helper che stava per aggiungere erano già duplicati
- il report di Atlante diventa qualcosa che si incolla nella PR description come contesto
- `.atlante/inventory.json` entra nei `.gitignore` di default ma il conteggio diagnostics viene riesposto in CI come gate
- la gente smette di chiederci "ma è un altro grafo delle dipendenze?" — perché la categoria "refactor triage" diventa riconoscibile da sola

## North star

> Nessuno dovrebbe scoprire che un file ha 3000 righe quando deve modificarlo.

Tutto il resto — grafo, tabella, drawer, check, soglie — serve quella frase.
