# 📱 ERTA - Guida Completa allo Sviluppo

## 🎯 PANORAMICA PROGETTO

**ERTA** (Enduro Race Timing Assistant) è una PWA per gare di enduro motociclistico.
Fa parte del progetto **FMI-ENDURO** che include:
- **Backend**: Node.js su Railway
- **Frontend Admin**: React su Netlify (beautiful-granita)
- **ERTA**: PWA standalone (HTML/CSS/JS)

---

## 🏗️ ARCHITETTURA ESISTENTE

### Backend (Railway)
- **URL**: `https://daring-eagerness-production-34de.up.railway.app`
- **Tech**: Node.js + Express + PostgreSQL
- **GitHub**: `https://github.com/etkk55/enduro-backend`

### Frontend Admin (Netlify)
- **URL**: `https://beautiful-granita-1603f5.netlify.app`
- **Tech**: React + Vite + Tailwind

### ERTA PWA
- **Struttura**: Single HTML file + manifest.json + sw.js
- **Deploy**: Netlify (drag & drop cartella)

---

## 🗄️ SCHEMA DATABASE (PostgreSQL)

### Tabella `eventi`
```sql
id SERIAL PRIMARY KEY
nome_evento VARCHAR(255)
codice_gara VARCHAR(50)           -- es. "303-1", "303-2", "303-3"
data_inizio DATE
data_fine DATE
luogo VARCHAR(255)
descrizione TEXT
codice_accesso VARCHAR(20)        -- Accesso piloti ERTA
codice_ddg VARCHAR(20)            -- Accesso DdG ERTA
codice_fmi VARCHAR(20)            -- Codice FMI pubblico (es. VENE015)
codice_accesso_pubblico VARCHAR(50) -- Codici FMI multipli (es. "VENE015, VENE005")
ficr_anno INTEGER
ficr_codice_equipe VARCHAR(10)    -- es. "107" per Veneto
ficr_manifestazione VARCHAR(10)   -- es. "303"
paddock1_lat, paddock1_lon DECIMAL
paddock2_lat, paddock2_lon DECIMAL
paddock_raggio INTEGER DEFAULT 500
gps_frequenza INTEGER DEFAULT 30
allarme_fermo_minuti INTEGER DEFAULT 10
```

### Tabella `piloti`
```sql
id SERIAL PRIMARY KEY
id_evento INTEGER REFERENCES eventi(id)
numero_gara INTEGER
cognome VARCHAR(100)
nome VARCHAR(100)
classe VARCHAR(50)                -- es. "TCVEN", "JUVEN", "TU"
moto VARCHAR(100)
team VARCHAR(100)
orario_partenza TIME              -- Orario PAR dal FICR
licenza_fmi VARCHAR(20)
anno_nascita INTEGER
```

### Tabella `comunicati`
```sql
id UUID PRIMARY KEY
codice_gara VARCHAR(50)
numero_comunicato INTEGER
titolo VARCHAR(255)
testo TEXT
tipo VARCHAR(20)                  -- "comunicato", "general_info", "paddock_info"
pdf_data BYTEA                    -- PDF allegato
pdf_filename VARCHAR(255)
created_at TIMESTAMP
```

### Tabella `tempi_settore`
```sql
codice_gara VARCHAR(50) PRIMARY KEY
co1_attivo...co7_attivo BOOLEAN
tempo_par_co1 VARCHAR(10)         -- es. "00:45:00"
tempo_co1_co2 VARCHAR(10)
...
tempo_ultimo_arr VARCHAR(10)
```

---

## 🔐 LE 3 MODALITÀ DI ACCESSO ERTA

### 1️⃣ ACCESSO DdG (Direzione Gara)
**Credenziali**: Codice Accesso (es. 303-1) + Codice DdG (configurato in admin)

**Funzionalità**:
- ✅ Visualizza comunicati
- ✅ **CREA** nuovi comunicati
- ✅ **MODIFICA** comunicati esistenti
- ✅ **ELIMINA** comunicati
- ✅ Upload PDF allegati
- 🆕 Crea "Comunicazioni di Servizio" (tipo speciale solo per pubblico)

**API esistente**: `POST /api/app/login`
- Se `numero_pilota === codice_ddg` → ritorna `isDdG: true`

---

### 2️⃣ ACCESSO PILOTA
**Credenziali**: Codice Accesso (es. 303-1) + Numero Gara (es. 101)

**Funzionalità** (TAB):
| Tab | Contenuto | API |
|-----|-----------|-----|
| 📢 Comunicati | Lista comunicati DdG | `GET /api/app/comunicati/:codice` |
| ⏰ I Miei Orari | PAR + CO teorici personali | `GET /api/app/orari-teorici/:codice/:numero` |
| ⏱️ I Miei Tempi | Tempi PS + classifica | `GET /api/app/miei-tempi/:codice/:numero` |
| 👥 Squadra | Gestione team | `GET /api/app/squadra/:codice/:numero` |
| 🆘 Segnala | SOS / Emergenze | `POST /api/app/sos` |

**API esistente**: `POST /api/app/login`
- Verifica pilota esiste in DB → ritorna dati pilota

---

### 3️⃣ ACCESSO PUBBLICO (🆕 DA SVILUPPARE)
**Credenziali**: Solo Codice FMI pubblico (es. VENE015)

**Funzionalità** (TAB):
| Tab | Contenuto | Ordinamento | API da creare |
|-----|-----------|-------------|---------------|
| 📋 Programma | Prove speciali (CT1, ET1...) | Sequenza | `GET /api/app/pubblico/programma/:codice_fmi` |
| 👥 Iscritti | TUTTI i piloti | Alfabetico cognome | `GET /api/app/pubblico/iscritti/:codice_fmi` |
| 🏁 Ordine Partenza | Orari PAR tutti | Per orario | `GET /api/app/pubblico/ordine/:codice_fmi` |
| 📢 Comunicati | Comunicati gara | Per data | `GET /api/app/pubblico/comunicati/:codice_fmi` |
| 📌 Servizio | Comunicazioni servizio | Per data | `GET /api/app/pubblico/servizio/:codice_fmi` |

**Nota**: Codice FMI può mappare a più gare (es. VENE015 → 303-1, 303-2, 303-3)

---

## 🔧 API ESISTENTI (Backend)

### Login
```
POST /api/app/login
Body: { codice_accesso, numero_pilota }
Response: { success, isDdG, pilota, evento }
```

### Comunicati
```
GET /api/app/comunicati/:codice_accesso
Response: [{ id, numero_comunicato, titolo, testo, tipo, has_pdf, created_at }]

GET /api/app/comunicati/:codice_accesso/pdf/:id
Response: PDF file
```

### Tempi Pilota
```
GET /api/app/miei-tempi/:codice_accesso/:numero_pilota
Response: { posizione_assoluta, posizione_classe, tempo_totale, gap, prove: [...] }
```

### Orari Teorici
```
GET /api/app/orari-teorici/:codice_gara/:numero_pilota
Response: { pilota, orario_partenza, controlli: [{ nome, orario_teorico }] }
```

### SOS
```
POST /api/app/sos
Body: { codice_accesso, numero_pilota, lat, lon, messaggio }
```

### Squadra
```
POST /api/app/squadra - Crea squadra
GET /api/app/squadra/:codice/:numero - Info squadra
PUT /api/app/squadra/:id/aggiungi - Aggiungi membro
PUT /api/app/squadra/:id/rimuovi - Rimuovi membro
GET /api/app/classifica-squadra/:id - Classifica membri
```

---

## 🆕 API DA CREARE (Per Accesso Pubblico)

### 1. Login Pubblico
```javascript
POST /api/app/login-pubblico
Body: { codice_fmi }  // es. "VENE015"

// Logica:
// 1. Cerca eventi dove codice_fmi = $1 OR codice_accesso_pubblico LIKE '%$1%'
// 2. Ritorna lista gare associate

Response: {
  success: true,
  isPublic: true,
  gare: [
    { codice_gara: "303-1", nome: "Campionato Veneto" },
    { codice_gara: "303-2", nome: "Training" },
    { codice_gara: "303-3", nome: "Epoca" }
  ]
}
```

### 2. Programma Gara (Prove Speciali)
```javascript
GET /api/app/pubblico/programma/:codice_fmi

// Chiama API FICR:
// https://apienduro.ficr.it/END/mpcache-30/get/program/{anno}/{equipe}/{manif}/{cat}

Response: {
  prove: [
    { sigla: "CT1", descrizione: "Cross Test 1 'Collina Verde'", lunghezza: 3 },
    { sigla: "ET1", descrizione: "Enduro Test 1 'Viale'", lunghezza: 3 },
    ...
  ]
}
```

### 3. Lista Iscritti
```javascript
GET /api/app/pubblico/iscritti/:codice_fmi

// Query DB: SELECT * FROM piloti WHERE id_evento IN (gare associate) ORDER BY cognome, nome

Response: {
  piloti: [
    { numero: 101, cognome: "Pellizzaro", nome: "Davide", classe: "TCVEN", moto: "KTM 125", team: "Arsie" },
    ...
  ]
}
```

### 4. Ordine Partenza
```javascript
GET /api/app/pubblico/ordine/:codice_fmi

// Query DB: SELECT * FROM piloti WHERE id_evento IN (...) AND orario_partenza IS NOT NULL ORDER BY orario_partenza

Response: {
  partenze: [
    { numero: 101, cognome: "Pellizzaro", nome: "Davide", classe: "TCVEN", orario: "09:00" },
    { numero: 102, cognome: "Verona", nome: "Michele", classe: "TCVEN", orario: "09:01" },
    ...
  ]
}
```

### 5. Comunicati Pubblici
```javascript
GET /api/app/pubblico/comunicati/:codice_fmi

// Query DB: SELECT * FROM comunicati WHERE codice_gara IN (...) AND tipo = 'comunicato' ORDER BY created_at DESC
```

### 6. Comunicazioni Servizio
```javascript
GET /api/app/pubblico/servizio/:codice_fmi

// Query DB: SELECT * FROM comunicati WHERE codice_gara IN (...) AND tipo = 'servizio' ORDER BY created_at DESC
```

---

## 📱 STRUTTURA ERTA ATTUALE

### File: index.html (3677 righe)
```
- Splash Screen con login
- Tab Navigation (bottom bar)
- Tab Content:
  - tabComunicati: Lista comunicati
  - tabOrari: Orari teorici personali
  - tabTempi: Tempi prove speciali
  - tabSquadra: Gestione team
  - tabSegnala: SOS/Emergenze
```

### File: manifest.json
```json
{
  "name": "ERTA - Enduro Race Timing Assistant",
  "short_name": "ERTA",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1a1a2e",
  "theme_color": "#e94560"
}
```

### File: sw.js
Service Worker per caching offline.

---

## 🎨 UI LOGIN DA MODIFICARE

### Attuale
```
┌─────────────────────────────────────┐
│  [Codice Gara]     [Nr. Pilota]     │
│           [ ACCEDI ]                │
└─────────────────────────────────────┘
```

### Nuova (3 modalità)
```
┌─────────────────────────────────────────┐
│           ERTA - Login                  │
├─────────────────────────────────────────┤
│                                         │
│  [Tab: PILOTA] [Tab: PUBBLICO] [Tab:DdG]│
│                                         │
│  ─────── Se PILOTA selezionato ──────   │
│  [Codice Accesso]  [Nr. Gara]           │
│           [ ACCEDI ]                    │
│                                         │
│  ─────── Se PUBBLICO selezionato ─────  │
│  [Codice FMI es. VENE015]               │
│           [ ACCEDI ]                    │
│                                         │
│  ─────── Se DdG selezionato ──────────  │
│  [Codice Accesso]  [Codice DdG]         │
│           [ ACCEDI ]                    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📋 CHECKLIST SVILUPPO

### Fase 1: Backend API Pubbliche
- [ ] Endpoint `POST /api/app/login-pubblico`
- [ ] Endpoint `GET /api/app/pubblico/programma/:codice_fmi`
- [ ] Endpoint `GET /api/app/pubblico/iscritti/:codice_fmi`
- [ ] Endpoint `GET /api/app/pubblico/ordine/:codice_fmi`
- [ ] Endpoint `GET /api/app/pubblico/comunicati/:codice_fmi`
- [ ] Aggiungere tipo "servizio" ai comunicati
- [ ] Endpoint `GET /api/app/pubblico/servizio/:codice_fmi`

### Fase 2: ERTA Login
- [ ] Modificare splash screen con 3 tab (Pilota/Pubblico/DdG)
- [ ] Form login diverso per ogni modalità
- [ ] Salvare ruolo in localStorage

### Fase 3: ERTA Pubblico
- [ ] Nuovo tab "Programma" con prove speciali
- [ ] Nuovo tab "Iscritti" con lista alfabetica
- [ ] Nuovo tab "Ordine" con orari partenza
- [ ] Adattare tab "Comunicati" per pubblico
- [ ] Nuovo tab "Servizio" per comunicazioni servizio

### Fase 4: ERTA DdG
- [ ] Pulsante "Nuovo Comunicato" nel tab Comunicati
- [ ] Form creazione comunicato
- [ ] Upload PDF
- [ ] Modifica/Elimina comunicati esistenti

---

## 🚀 DEPLOY

### Backend
```bash
cd ~/Desktop/enduro-backend
cp file-modificato.js server.js
git add -A && git commit -m "descrizione"
git push
# Railway auto-deploy
```

### ERTA
```bash
cd cartella-erta
# Crea/modifica index.html, manifest.json, sw.js
netlify deploy --prod --dir=.
# Oppure drag & drop su netlify.com
```

---

## 📡 API FICR (Riferimento)

### Base URL
`https://apienduro.ficr.it`

### Entrylist (Iscritti)
```
GET /END/mpcache-30/get/entrylist/{anno}/{equipe}/{manif}/{cat}/*/*/*/*/*/*/*
Esempio: /END/mpcache-30/get/entrylist/2025/107/303/1/*/*/*/*/*/*/*

Response: {
  "code": 200,
  "status": true,
  "data": [
    { "Numero": 101, "Cognome": "Pellizzaro", "Nome": "Davide", "Classe": "TCVEN", "Moto": "KTM 125", "Motoclub": "Arsie" },
    ...
  ]
}
```

### Startlist (Ordine Partenza)
```
GET /END/mpcache-20/get/startlist/{anno}/{equipe}/{manif}/{cat}/1/1/*/*/*/*/*
Esempio: /END/mpcache-20/get/startlist/2025/107/303/1/1/1/*/*/*/*/*

Response: {
  "code": 200,
  "data": [
    { "Numero": 101, "Cognome": "Pellizzaro", "Nome": "Davide", "Orario": "09:00", ... },
    ...
  ]
}
```

### Program (Prove Speciali)
```
GET /END/mpcache-30/get/program/{anno}/{equipe}/{manif}/{cat}

Response: {
  "code": 200,
  "data": [
    { "Sigla": "CT1", "Description": "Cross Test 1 'Collina Verde'", "Length": 3 },
    { "Sigla": "ET1", "Description": "Enduro Test 1 'Viale'", "Length": 3 },
    ...
  ]
}
```

---

## ⚠️ NOTE IMPORTANTI

1. **Parsing FICR**: Le risposte FICR hanno i dati in `.data`, non direttamente nella risposta
   ```javascript
   const response = await fetch(url);
   const json = await response.json();
   const piloti = json.data || json;  // ← Importante!
   ```

2. **Codici multipli**: `codice_accesso_pubblico` può contenere più codici separati da virgola
   ```
   "VENE015, VENE005" → split(',').map(c => c.trim())
   ```

3. **Relazione Codice FMI → Gare**:
   - VENE015 → 303-1 (Campionato), 303-2 (Training)
   - VENE005 → 303-3 (Epoca)
   - L'utente inserisce UN codice, vede dati di TUTTE le gare associate

4. **Service Worker**: Incrementare versione cache quando si modifica index.html
   ```javascript
   const CACHE_NAME = 'erta-cache-v14';  // Incrementare!
   ```

---

## 📞 SUPPORTO

**Repository GitHub**: 
- Backend: `https://github.com/etkk55/enduro-backend`

**Deploy URLs**:
- Backend: `https://daring-eagerness-production-34de.up.railway.app`
- Admin: `https://beautiful-granita-1603f5.netlify.app`

---

*Documento generato da Chat 22 - FMI-ENDURO Project*
