# Integrazione FICR Plus — Analisi e Piano Esecutivo

**Stato:** Analisi completata, implementazione non avviata.
**Data:** 2026-04-22
**Autore:** Analisi tecnica pre-implementazione

---

## 1. Sommario esecutivo

Il backend attuale si integra con FICR (`apienduro.ficr.it`) usando lo schema "classic" a chiave numerica (`anno/equipe/manifestazione/categoria`). Questo schema è usato dalle sezioni **Triveneto** (equipe 99 Trentino, 107 Veneto).

Altre sezioni FICR (Lombardia, Toscana, Emilia Romagna) usano una **variante "Enduro Plus"** con chiave alfanumerica a 5 lettere (`codpub`, es. `PVUNY`, `LZEUW`, `MGXYR`, `UAJFK`).

**Buona notizia emersa dall'analisi:** le due varianti condividono host, headers, authentication e response envelope. Differiscono solo per:

- Path prefix (`/plus/` aggiunto)
- Chiave gara (1 codpub vs 4 numeri)
- Nomi dei campi JSON (lowercase in Plus, Capitalized in classic)

**Rischio di regressione su Triveneto** se implementiamo il supporto Plus in modo isolato: **ZERO**.

---

## 2. Confronto tra le varianti

### 2.1 URL pattern

| Risorsa | Classic | Plus |
|---------|---------|------|
| Host | `apienduro.ficr.it` | `apienduro.ficr.it` *(stesso)* |
| Iscritti | `/END/mpcache-30/get/entrylist/{anno}/{equipe}/{manif}/{cat}/*/*/*/*/*` | `/END/mpcache-30/get/plus/entrylist/{codpub}` |
| Tempi | `/END/mpcache-5/get/clasps/{anno}/{equipe}/{manif}/{giorno}/{ps}/1/*/*/*/*/*` | `/END/mpcache-10/get/plus/clasps/{codpub}/{giorno}/{ps}` |
| Programma | `/END/mpcache-30/get/program/{anno}/{equipe}/{manif}/{cat}` | `/END/mpcache-30/get/plus/program/{codpub}` |
| Startlist | `/END/mpcache-20/get/startlist/{anno}/{equipe}/{manif}/{cat}/1/1/*/*/*/*/*` | `/END/mpcache-20/get/plus/startlist/{codpub}` |
| Descrizione | — | `/END/mpcache-30/get/plus/descrizione/{codpub}` *(Rosetta Stone)* |

### 2.2 Response envelope

Entrambe le varianti restituiscono:

```json
{ "code": 200, "status": true, "message": "", "data": ... }
```

### 2.3 Schema dati iscritti

| Classic (entrylist) | Plus (entrylist) |
|---------------------|------------------|
| `Numero`            | `id`             |
| `Nome`              | `nome`           |
| `Cognome`           | `cognome`        |
| `Motoclub`          | `motoclub`       |
| `Naz`               | `naz`            |
| `Classe`            | `classe`         |
| `Moto`              | `moto`           |
| — | `cat, an, sex, fmn, motosh, q, q2, f, transp1, transp2, ver, rank` *(extra)* |

Il Plus ha più campi e nomi in lowercase. Serve un mapper.

### 2.4 Endpoint "descrizione" — il ponte

L'endpoint `/plus/descrizione/{codpub}` restituisce i valori numerici equivalenti:

```json
{
  "data": [{
    "ma_Anno": 2026,
    "ma_CodiceEquipe": 61,                          // Lombardia
    "ma_Manifestazione": 2,
    "ma_Descrizione": "CAMPIONATO REGIONALE ENDURO LOMBARDIA - 2^ PROVA",
    "ma_Data": "2026-03-01T00:00:00.000Z",
    "ma_Localita": "Crema (CR)",
    "ma_DSC": "2498|PVUNY",
    "ma_VersioneProgramma": "ENDUROPLUS"            // flag variante
  }]
}
```

**Implicazione chiave:** da un codpub ottengo `anno + equipe + manifestazione` → posso costruire il nostro formato interno `codice_gara = "{anno}-{equipe}-{manif}-{cat}"` senza modificare nulla del resto del sistema.

### 2.5 Config FICR (da `https://enduro.ficr.it/assets/Config.json`)

Il server FICR espone la configurazione di tutti gli sport. L'oggetto `END` contiene i suffissi path per entrambe le varianti:

```
PROGRAM           → mpcache-30/get/program/
PROGRAMPLUS       → mpcache-30/get/plus/program/
ENTRYLIST         → mpcache-30/get/entrylist/
ENTRYLISTPLUS     → mpcache-30/get/plus/entrylist/
STAGERANK         → mpcache-5/get/clasps/
STAGERANKPLUS     → mpcache-10/get/plus/clasps/
STARTLIST         → mpcache-20/get/startlist/
STARTLISTPLUS     → mpcache-20/get/plus/startlist/
DESCRIZIONEPLUS   → mpcache-30/get/plus/descrizione/
DRIVERRESULTSPLUS → mpcache-15/get/plus/resultconc/
RESULTPSPLUS      → mpcache-15/get/plus/risultatiprove/
CATEGORYPLUS      → mpcache-30/get/plus/categorie/
PUNTICAMPIONATO   → mpcache-60/get/plus/punticampionato/
COPLUS            → mpcache-10/get/plus/passaggico/
DAILYRANKINGPLUS  → mpcache-20/get/plus/clasgiornata/
```

Tutti gli endpoint Plus sono già esposti e funzionanti oggi.

---

## 3. Inventario chiamate FICR nel nostro codice

22 chiamate totali in 4 file, divise per tipo di trigger:

### 3.1 Import-time (18 chiamate) — user-initiated

File `backend/src/routes/ficr.js`:

| Riga | Risorsa | Endpoint classic |
|------|---------|------------------|
| 11, 24 | schedule | `schedule/{anno}/*/*` |
| 37 | categorie | `gare/{anno}/{equipe}/{manif}` |
| 112 | import-piloti | `entrylist/{anno}/{manif}/{prova}/{cat}/*/*/*/*/*` |
| 169, 263, 393, 613 | import-tempi | `clasps/{anno}/{equipe}/{manif}/{cat}/{prova}/1/*/*/*/*/*` |
| 353 | listps | `listps/{anno}/{equipe}/{manif}/{cat}` |
| 482, 484 | entrylist (refresh) | `entrylist/{anno}/{equipe}/{manif}/{cat}/*/*/*/*/*/*/*` |
| 486, 552, 805 | startlist | `startlist/{anno}/{equipe}/{manif}/{cat}/1/1/*/*/*/*/*` |

### 3.2 Runtime (4 chiamate) — durante normale utilizzo

| File | Riga | Risorsa | Note |
|------|------|---------|------|
| `appPublic.js` | 162 | program | Vista pubblica programma gara |
| `piloti.js` | 139 | startlist | Probabilmente on-demand |
| `piloti.js` | 277 | entrylist | Probabilmente on-demand |
| `piloti.js` | 287 | startlist | Probabilmente on-demand |

### 3.3 Dev / Hardcoded (3 chiamate) — da ignorare

File `backend/src/routes/utilities.js`:

| Riga | Endpoint |
|------|----------|
| 46 | `iscbycog/{anno}/99/11/1/*/1` |
| 351 | `clasps/{anno}/99/11/1/{numeroProva}/1/*/*/*/*/*` |
| 434 | `clasps/{anno}/99/11/1/{numeroProva}/1/*/*/*/*/*` |

Hanno `equipe=99 manif=11` hardcoded (Isola Vicentina). Sono chiaramente test/dev endpoints. Non toccati dalla migrazione.

---

## 4. Architettura proposta — "Silos Completi"

Principio guida: **non toccare il codice classic esistente**. Il supporto Plus è una build-up parallela.

### 4.1 Struttura file

```
backend/src/
  helpers/
    ficrClient.js            [INVARIATO]
    ficrPlusClient.js        [NUOVO]
  routes/
    ficr.js                  [INVARIATO]
    ficrPlus.js              [NUOVO]
  db/
    migrations.js            [AGGIORNATO — aggiunta colonne additive]

frontend/src/
  pages/
    SetupGaraFicr.jsx        [ESTESO con card 'codpub' (additivo)]
    Eventi.jsx               [ESTESO per mostrare badge 'Plus' sugli eventi]
```

### 4.2 Schema DB — migration additiva

```sql
ALTER TABLE eventi
  ADD COLUMN IF NOT EXISTS ficr_provider VARCHAR(10) DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS ficr_codpub VARCHAR(10);
```

**Retrocompat:** eventi esistenti restano `provider='classic'`, `codpub=NULL`. Nessuna query esistente cambia comportamento.

### 4.3 Helper `ficrPlusClient.js`

Espone funzioni con interfaccia simile al classic ma parametrizzate su codpub:

```
getDescrizione(codpub)         → { anno, equipe, manif, descrizione, localita, data }
getEntrylist(codpub)           → array piloti { Numero, Nome, Cognome, Motoclub, ... }  // già mappati
getClasps(codpub, day, ps)     → array tempi
getProgram(codpub)             → programma gara
getStartlist(codpub, day)      → ordine partenza
```

Ogni funzione:
1. Compone URL `/END/mpcache-N/get/plus/{risorsa}/{codpub}/...`
2. Aggiunge header `Referer: https://enduro.ficr.it/`
3. Parsa `data` dall'envelope
4. Applica **field mapper** lowercase → capitalized (solo nei punti che restituiscono piloti/tempi)

### 4.4 Routes `ficrPlus.js` — paralleli a ficr.js

```
POST /api/ficr-plus/analizza-codpub   body: { codpub }
  → chiama getDescrizione, restituisce preview gara (nome, luogo, data, numero iscritti)

POST /api/ficr-plus/crea-evento       body: { codpub }
  → chiama getDescrizione, crea evento in DB con:
     ficr_provider = 'plus'
     ficr_codpub   = codpub
     ficr_anno/codice_equipe/manifestazione derivati dalla descrizione
     codice_gara   = "{anno}-{equipe}-{manif}-1" (stesso formato classic)

POST /api/ficr-plus/import-piloti     body: { id_evento }
  → legge evento.ficr_codpub, chiama getEntrylist, UPSERT piloti
     usa stessa logica UPSERT di ficr.js ma chiamando getEntrylist invece di getEntrylistClassic

POST /api/ficr-plus/import-tempi      body: { id_evento, giorno, ps }
  → analogo import-tempi classic

GET  /api/ficr-plus/program/:id_evento
  → snapshot programma per vista pubblica (vedi §4.5 option B)
```

### 4.5 Runtime endpoints — due strategie alternative

Le 4 chiamate runtime (appPublic, piloti) richiedono una scelta architetturale.

**Strategia A — Dispatch inline (raccomandata per semplicità)**

Modifica minima ai 4 punti: un `if` all'inizio che sceglie l'URL:

```js
// appPublic.js linea 162
const apiUrl = evento.ficr_provider === 'plus' && evento.ficr_codpub
  ? `${BASE}/END/mpcache-30/get/plus/program/${evento.ficr_codpub}`
  : `${BASE}/END/mpcache-30/get/program/${anno}/${equipe}/${manif}/${categoria}`;  // codice originale
```

Il ramo classic resta byte-identico. Gli eventi con `ficr_provider='classic'` o NULL (tutti quelli esistenti) passano sul ramo else = comportamento attuale.

Pro: 4 diff piccoli, ogni test classic passa automaticamente.
Contro: tocco files esistenti.

**Strategia B — Snapshot in DB al momento dell'import (rischio zero assoluto)**

Quando importi un evento Plus, la chiamata `getProgram` viene fatta UNA volta e il risultato JSONB viene persistito in `eventi.program_snapshot JSONB`. Gli endpoint runtime leggono da DB invece che da FICR live.

Implementazione:
- Migration: `ALTER TABLE eventi ADD COLUMN program_snapshot JSONB`
- `import-piloti-plus` popola anche `program_snapshot`
- Runtime endpoint: `if provider='plus' return program_snapshot else call FICR live`

Pro: zero modifiche ai 4 punti runtime, rischio classic=0.
Contro: dati non live, bisogna re-importare se FICR cambia.

**Raccomandazione:** Strategia A. Il rischio classic è già bassissimo (branch else identico) e si evita il problema freschezza dati.

### 4.6 Frontend — `SetupGaraFicr.jsx` con card aggiuntiva

Il wizard esistente rimane invariato. Si aggiunge una card sopra:

```
┌─────────────────────────────────────────────┐
│ 🆕 Nuova gara da codpub FICR Plus           │
│                                             │
│ Codpub: [__________]  [Analizza]            │
│                                             │
│ (Preview: nome gara, data, luogo, iscritti) │
│                                             │
│ [✓ Crea evento]                             │
└─────────────────────────────────────────────┘

         ── oppure ──

┌─────────────────────────────────────────────┐
│ Wizard classico FICR (invariato)            │
│ anno / equipe / manifestazione / categoria  │
└─────────────────────────────────────────────┘
```

Il blocco nuovo chiama `/api/ficr-plus/analizza-codpub` e `/api/ficr-plus/crea-evento`. Non interagisce con il wizard classico.

### 4.7 UI — badge "Plus" nella lista eventi

Aggiungere piccolo chip nelle liste eventi per distinguere:

```
Vestenanova (VR) · Campionato Veneto Enduro    [Classic]
Crema (CR) · Campionato Lombardia 2° prova     [Plus]
```

Informa il DdG sul tipo ma non cambia comportamento.

---

## 5. Matrice rischio/beneficio per sito

| Area | Modifica | Rischio classic | Valore Plus |
|------|----------|-----------------|-------------|
| Migration DB | Additiva (2 colonne nullable) | Zero | Fondamentale |
| `ficr.js` | Zero | Zero | — |
| `ficrPlus.js` | Nuovo file | Zero | Fondamentale |
| `ficrPlusClient.js` | Nuovo file | Zero | Fondamentale |
| `appPublic.js:162` | Inline if (strategia A) | Bassissimo (branch else = codice odierno) | Alto |
| `piloti.js` 3 call | Inline if (strategia A) | Bassissimo | Alto |
| `utilities.js` | Zero (sono DEV) | Zero | — |
| `SetupGaraFicr.jsx` | Additiva (card nuova) | Basso (no modifiche a flow esistente) | Fondamentale |
| `Eventi.jsx` | Additiva (badge condizionale) | Zero | Informativo |

---

## 6. Piano esecutivo (commit-by-commit)

Ogni commit è indipendente, pushabile separatamente, con rollback banale.

### Commit 1 — Backend: fondamenta Plus
- Migration: add `ficr_provider`, `ficr_codpub` colonne nullable
- Nuovo file `backend/src/helpers/ficrPlusClient.js` con:
  - `getDescrizione`
  - `getEntrylist` + field mapper verso formato classic
  - `getClasps` + field mapper
  - `getProgram`
  - `getStartlist`
- Nuovo file `backend/src/routes/ficrPlus.js` con:
  - `POST /api/ficr-plus/analizza-codpub`
  - `POST /api/ficr-plus/crea-evento`
- Mounting in `server.js`
- **Test**: `curl -X POST /api/ficr-plus/analizza-codpub -d '{"codpub":"PVUNY"}'` → risposta con nome gara Lombardia
- **Rischio classic**: zero (nessun file esistente toccato, solo aggiunte)

### Commit 2 — Backend: import Plus
- Aggiunta in `ficrPlus.js`:
  - `POST /api/ficr-plus/import-piloti`
  - `POST /api/ficr-plus/import-tempi`
- Entrambi leggono `evento.ficr_codpub` dal DB ed eseguono UPSERT identici al classic
- **Test**: crea evento Plus con PVUNY, import piloti → 272 piloti in DB. Verifica che codice_gara formato standard `2026-61-2-1` sia coerente.
- **Rischio classic**: zero

### Commit 3 — Runtime dispatch (Strategia A)
- `appPublic.js:162` — aggiungi if inline
- `piloti.js` 3 linee — aggiungi if inline
- **Test regressione obbligatorio**: aprire Vestenanova VR (classic) su:
  - Pagina pubblica programma
  - Pagina Piloti
  - Pagina Classifiche
  Tutto deve funzionare identico a oggi.
- **Test Plus**: aprire la gara Lombardia appena importata → stesse pagine → devono mostrare dati.
- **Rischio classic**: bassissimo, ma test manuale prima del push è obbligatorio.

### Commit 4 — Frontend: card setup gara Plus
- `SetupGaraFicr.jsx` — aggiungi card "codpub FICR Plus" sopra il wizard classico
- Chiama `/api/ficr-plus/analizza-codpub` → mostra preview → `/api/ficr-plus/crea-evento` al conferma
- **Test**: crea un evento Plus dall'UI end-to-end
- **Rischio classic**: zero (wizard esistente non toccato)

### Commit 5 — UI: badge Plus nelle liste eventi
- `Eventi.jsx`, `Dashboard.jsx`, `ContextBar.jsx` — piccolo chip "Plus" se `evento.ficr_provider === 'plus'`
- **Rischio classic**: zero

### Commit 6 (opzionale) — Endpoint Plus rimanenti
- `listps`, `schedule`, `gare/categorie` plus se necessari
- Da valutare in base all'uso reale

---

## 7. Verifica e rollback

### Test regressione classic (post-Commit 3)

1. Aprire frontend `/eventi` → Vestenanova VR deve apparire come oggi
2. Aprire `/piloti` con Vestenanova selezionato → 191 iscritti, campi corretti
3. Aprire `/tempi` → selezionare prova, vedere tempi
4. Aprire `/classifiche` → classifica generale ordinata correttamente
5. Aprire `/live` → Live Timing funzionante
6. Lanciare import tempi FICR da `/import-ficr` → dati aggiornati

Se uno solo di questi fallisce: `git revert` del commit 3 e investigazione.

### Test nuovo flusso Plus (post-Commit 4)

1. `/setup-gara` → sezione codpub Plus → inserire `PVUNY` → Analizza → preview "CAMPIONATO REGIONALE ENDURO LOMBARDIA" con 272 iscritti
2. Crea evento → redirect a `/eventi`, nuovo evento visibile con badge "Plus"
3. Click sull'evento → Piloti → 272 piloti caricati
4. Import tempi da UI → tempi popolati
5. `/classifiche` con evento Plus → classifica generata

### Rollback

**Per commit:** ogni commit può essere revertito indipendentemente.

**Rollback completo:**
```bash
git revert <commit-6>..<commit-1>
# oppure
git revert --no-commit HEAD~6..HEAD && git commit -m "Rollback FICR Plus"
```

Le 2 colonne DB nuove restano (nullable) ma inutilizzate — harmless.

---

## 8. Tempo stimato

| Fase | Tempo |
|------|-------|
| Commit 1 (fondamenta) | 1.5h |
| Commit 2 (import) | 1.5h |
| Commit 3 (runtime dispatch) | 1h |
| Commit 4 (frontend wizard) | 2h |
| Commit 5 (UI badge) | 30min |
| Test regressione + smoke Plus | 1.5h |
| **Totale** | **~8 ore** |

---

## 9. Dipendenze e pre-requisiti

- **FICR**: nessuna — le API Plus sono pubbliche, stesso server
- **Database**: migration auto-applicata al deploy (pattern già usato)
- **Deploy**: auto da push su main (Railway backend + Vercel frontend)
- **Test**: accesso a un browser per smoke test (nessun test automatizzato in progetto)

---

## 10. Open question da risolvere prima dell'implementazione

- [ ] **Campo `id` in entrylist Plus corrisponde a Numero?** Il sample mostrava `id`, ma serve verifica con payload reale per essere sicuri che sia il numero di gara e non un id DB FICR.
- [ ] **Nomi PS nelle gare Plus**: la logica "numero_ordine PS" e i giorni (`day`) potrebbero essere strutturati diversamente. Verificare su PVUNY quanti `day` e quante `ps` esistono.
- [ ] **Categoria numerica**: negli eventi classic abbiamo `categoria` (es. 1). In Plus c'è solo il codpub: serve decidere se:
   - Fissiamo `categoria=1` per tutti gli eventi Plus (semplice)
   - Oppure leggiamo la prima categoria disponibile dall'endpoint `categorie` Plus
- [ ] **Più categorie nella stessa gara**: in Plus una manifestazione potrebbe avere più categorie (Major, Expert, etc.) che il classic tratta come eventi separati. Decidere se replicare N eventi collegati o gestirli come uno solo.

---

## 11. Decisione di stop

**Al 22-04-2026, l'implementazione NON è avviata** per permettere:

1. Valutazione costi/benefici completa
2. Risposta alle open question in §10
3. Conferma utente che il volume di gare non-Triveneto giustifica lo sforzo

**Prossimo step quando si deciderà di procedere:**
Rivedere questo documento, sciogliere le open question, aprire un branch `feature/ficr-plus` e seguire il piano esecutivo commit-by-commit.

---

## Riferimenti tecnici

- **Config FICR** (estraibile liberamente): https://enduro.ficr.it/assets/Config.json
- **Endpoint descrizione di test** (PVUNY, Lombardia): https://apienduro.ficr.it/END/mpcache-30/get/plus/descrizione/PVUNY
- **Bundle Angular FICR** (analizzabile per ulteriori route): https://enduro.ficr.it/main-es2015.*.js

### Rotte client-side estratte dal bundle (tutte disponibili per Plus)

`END/plus/programma/:descr/:codpub`, `END/plus/iscritti/:descr/:codpub`, `END/plus/ordinepartenza/:descr/:codpub[/:day]`, `END/plus/passaggi/:descr/:codpub[/:day]`, `END/plus/tempi/:descr/:codpub[/:day/:ps]`, `END/plus/risultati/:descr/:codpub`, `END/plus/risultatiprove/:descr/:codpub[/:day]`, `END/plus/puntigiornata/:descr/:codpub[/:day]`, `END/plus/resultrider/:descr/:codpub[/:id]`, `END/plus/championship-points/:descr/:codpub`, `END/plus/shakedown/:descr/:codpub`, `END/plus/monitor-rally/:descr/:codpub`, `END/plus/pdf/:descr/:codpub[/:day]`, `END/plus/live/:descr/:codpub`.
