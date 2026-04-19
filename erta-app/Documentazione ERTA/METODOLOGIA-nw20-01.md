# METODOLOGIA DI LAVORO FMI-ENDURO
## Versione aggiornata: Chat 20 - 22 Dicembre 2025

---

## 📚 PREMESSA: LEGGERE QUESTO DOCUMENTO È OBBLIGATORIO

Questo documento raccoglie le lezioni apprese dalle Chat 13, 14, 15 e 16. Gli errori qui descritti sono stati commessi realmente e hanno causato ore di lavoro perso. **Non ripeterli.**

---

## 🔧 REGOLE FONDAMENTALI

### 1. SEMPRE BACKUP PRIMA DI MODIFICARE
```bash
cp file.js file.js.BACKUP_CHATXX
```

### 2. FILE NUMERATI PROGRESSIVI
- Frontend: `LiveTiming-nw16-01.jsx`, `LiveTiming-nw16-02.jsx`, ...
- Backend: `server-nw16-01.js`, `server-nw16-02.js`, ...
- Config: `config-nw16-01.js`, `polling-config-nw16-02.js`, ...

⚠️ **SEMPRE** usare il formato `nwXX-YY` dove XX = numero chat, YY = progressivo

### 3. MAI USARE `head -n -X` SU MAC
Non funziona su macOS BSD! Usare invece:
- Upload file → Claude modifica → Download

### 4. VERIFICA DOPO OGNI DEPLOY
- Frontend: test visivo + console browser (F12)
- Backend: `curl` per testare endpoint
- Sempre verificare con `grep` che la modifica sia presente

### 5. UPLOAD FILE INVECE DI COPIA/INCOLLA
Il copia/incolla può omettere caratteri (parentesi, backtick). Preferire:
- Screenshot per output terminale
- Upload file per codice sorgente

### 6. MODIFICHE CHIRURGICHE (MAX 10-15 RIGHE)
Se serve modificare più di 15 righe, **spezzare in più round**.
Ogni round = UNA sola modifica piccola e testabile.

### 7. TEST COMPLETO DOPO OGNI MODIFICA
Non testare solo la nuova feature! Verificare che **tutto il resto** funzioni ancora:
- Reset, Avanti, Play Auto funzionano?
- Popup e modal funzionano?
- Font, badge, colori sono corretti?
- Nessuna regressione visiva?

---

## 🚨 ERRORI DA EVITARE

### ERRORI DI PROCESSO

#### 1. Non Leggere la Documentazione
**Errore Chat 14**: Claude ha detto "ho capito" senza leggere davvero la documentazione.

**Regola**: Quando viene chiesto di leggere un documento:
- Leggerlo DAVVERO
- Riassumere cosa si è capito
- Aspettare conferma PRIMA di scrivere codice

#### 2. Creare Codice Nuovo Invece di Modificare
**Errore Chat 14**: Funzioni nuove di 100 righe invece di `str_replace` chirurgico.

**Regola**: Max 10-15 righe per modifica. Se serve di più, spezzare in più round.

#### 3. Test Parziali
**Errore Chat 14**: Verificare solo "funziona la nuova feature?" senza controllare regressioni.

**Regola**: Dopo ogni modifica, test COMPLETO del sistema.

#### 4. Errori Architetturali
**Errore Chat 14**: Integrare il simulatore DENTRO il sistema esistente invece che separato.

**Regola**: Componenti nuovi e complessi devono essere **applicazioni separate**.

#### 5. Ignorare gli Avvisi
**Errore Chat 14**: Quando Ettore avvisa di un rischio, Claude risponde "sì sì" e va avanti.

**Regola**: Quando viene segnalato un rischio, **FERMARSI** e riflettere.

#### 6. Fidarsi Senza Verificare
**Regola per Ettore**: Quando Claude dice "ho capito", chiedere: **"Dimostrami cosa hai capito"**.

---

### ERRORI TECNICI

#### 7. Hardcoding di Valori
**Errore Chat 16**: URL FICR con `/2/` hardcoded invece di `/${prova}/`
```javascript
// ❌ SBAGLIATO
const url = `.../${categoria}/2/1/*`;

// ✅ CORRETTO
const url = `.../${categoria}/${prova}/1/*`;
```
**Lezione**: Mai hardcodare valori che dovrebbero essere parametri.

#### 8. Dimenticare di Aggiornare UUID
**Errore Chat 16**: "Evento non trovato" dopo reimport.

**Causa**: UUID cambiato ma config non aggiornati.

**Soluzione**: Sempre verificare e aggiornare UUID dopo reimport evento.

#### 9. Confondere Frontend vs Backend
**Errore Chat 16**: Assumere che l'ordinamento sia fatto dal backend quando era nel frontend.

**Lezione**: Verificare SEMPRE dove avviene la logica:
```bash
grep -n "sort\|ordina" file.js
```

#### 10. Modifiche Incomplete
**Errore**: Modificare una funzione ma non aggiornare dove viene chiamata.

**Lezione**: Cercare TUTTI i riferimenti prima di modificare:
```bash
grep -n "nomeFunzione" file.js
```

#### 11. Non Verificare i Dati Sorgente
**Errore Chat 16**: Cercare bug nel frontend quando era nell'import FICR.

**Lezione**: Seguire il flusso dati dall'origine:
```
FICR API → Import Backend → DB → Backend API → Frontend
```

#### 12. Polling/Simulatore Multipli
**Errore Chat 16**: Avviare più istanze di polling o simulatore.

**Soluzione**: Prima di avviare, sempre:
```bash
pkill -f "node polling.js"; pkill -f "node server.js"
```

#### 13. Fragment non Importato
**Errore**: "Can't find variable: React"

**Causa**: Usato `<Fragment>` senza import.

**Soluzione**: 
```javascript
import { useState, useEffect, Fragment } from 'react';
```

#### 14. Deploy Backend Crashato
**Causa**: File incompleto o con errori pushato.

**Soluzione**: Rollback immediato:
```bash
cp server.js.BACKUP_XXX server.js
git add . && git commit -m "Rollback" && git push
```

---

## 📋 WORKFLOW STANDARD

### Prima di QUALSIASI Codice
1. **Architettura a parole**
   - Claude descrive COSA vuole fare
   - Claude descrive COME vuole farlo
   - Ettore conferma o corregge

2. **Per ogni str_replace:**
   - Quale file
   - Quante righe (max 15)
   - Cosa potrebbe rompersi
   - Come testeremo
   - Ettore approva → poi si scrive

3. **Dopo ogni modifica:**
   - Test completo (non solo la nuova feature)
   - Screenshot se ci sono dubbi
   - Se qualcosa si rompe → rollback IMMEDIATO

### Deploy Frontend (Netlify)

⚠️ **IMPORTANTE**: NON usare `npm run build` in locale - richiede fino a 20 minuti!
Usare `git push` che fa la build sui server Netlify (molto più veloce).

```bash
# 1. Scarica file da Claude
# 2. Copia in progetto
mv ~/Downloads/LiveTiming-nwXX-YY.jsx ~/Desktop/enduro-frontend/src/pages/LiveTiming.jsx

# 3. Deploy via git (RACCOMANDATO - build su Netlify)
cd ~/Desktop/enduro-frontend
git add src/pages/LiveTiming.jsx   # ⚠️ File specifico, NON "git add ."
git commit -m "Descrizione modifica"
git push

# 4. Attendi 1-2 minuti per build Netlify

# 5. Verifica (svuota cache Safari: Cmd+Option+E, poi Cmd+R)
```

**Alternativa** (deploy diretto senza git):
```bash
cd ~/Desktop/enduro-frontend
npm run build && netlify deploy --prod --dir=dist
```

⚠️ **NOTA**: `npm run dev` è solo per test locale (resta in esecuzione). Per deploy usare sempre `npm run build && netlify deploy`.

### Deploy Backend (Railway)
```bash
# 1. Backup
cp ~/Desktop/enduro-backend/server.js ~/Desktop/enduro-backend/server.js.BACKUP_CHATXX

# 2. Copia nuovo file
mv ~/Downloads/server-nwXX-YY.js ~/Desktop/enduro-backend/server.js

# 3. Verifica modifica
grep "stringa_nuova" ~/Desktop/enduro-backend/server.js

# 4. Deploy
cd ~/Desktop/enduro-backend
git add server.js
git commit -m "Descrizione modifica"
git push

# 5. Attendi 1-2 minuti per redeploy Railway
```

---

## 🖥️ GESTIONE TERMINALI

Durante test con simulatore/polling, usare **3 terminali**:

| Terminale | Uso | Comando |
|-----------|-----|---------|
| 1 | Simulatore FICR | `cd ~/Desktop/ficr-simulator && node server.js` |
| 2 | Polling Service | `cd ~/Desktop/polling-service && node polling.js` |
| 3 | Comandi curl/test | Libero per comandi |

### Comandi Utili Terminale 3
```bash
# Status simulatore
curl -s "http://localhost:3001/simulator/status" | jq '{rilasciati: .tempiRilasciati, totali: .tempiTotali, percentuale: .percentuale}'

# Reset simulatore
curl -s -X POST "http://localhost:3001/simulator/reset" -H "Content-Type: application/json" | jq .

# Fermare tutto
pkill -f "node polling.js"; pkill -f "node server.js"
```

---

## 🔑 GESTIONE UUID EVENTI

⚠️ **IMPORTANTE**: L'UUID evento cambia ogni volta che cancelli e reimporti!

### Ottenere UUID Corrente
```bash
curl -s "https://daring-eagerness-production-34de.up.railway.app/api/eventi" | jq '.[] | select(.nome_evento | contains("Campionato Veneto")) | {id, nome_evento}'
```

### Aggiornare Config Simulatore e Polling
```bash
# Sostituisci OLD_UUID con NEW_UUID
sed -i '' "s/OLD_UUID/NEW_UUID/g" ~/Desktop/ficr-simulator/config.js
sed -i '' "s/OLD_UUID/NEW_UUID/g" ~/Desktop/polling-service/config.js
echo "Config aggiornati"
```

### Dopo aver aggiornato UUID
Riavviare simulatore e polling (Ctrl+C nei terminali 1 e 2, poi rilanciare)

---

## 🔍 METODOLOGIA DEBUG

### Passo 1: Identificare DOVE è il Bug
```
FICR API → Simulatore → Polling → Backend DB → Backend API → Frontend
```

Testare ogni step:
```bash
# 1. Dati FICR originali
curl -s "https://apienduro.ficr.it/END/mpcache-5/get/clasps/2025/107/303/1/2/1/*/*/*/*/*" | jq '.data.clasdella[] | select(.Numero == 170)'

# 2. Dati nel DB
curl -s "https://daring-eagerness-production-34de.up.railway.app/api/prove/UUID_PROVA/tempi" | jq '.[] | select(.numero_gara == 170)'

# 3. Dati API classifica
curl -s "https://daring-eagerness-production-34de.up.railway.app/api/eventi/UUID_EVENTO/classifica" | jq '.[] | select(.numero_gara == 170)'
```

### Passo 2: Isolare il Problema
- Se dati FICR corretti ma DB sbagliato → bug in import/simulatore/polling
- Se DB corretto ma frontend sbagliato → bug in API backend o frontend

### Passo 3: Cercare nel Codice
```bash
# Trovare dove viene usata una variabile
grep -n "variabile" file.js

# Vedere contesto (5 righe prima e dopo)
grep -n -B5 -A5 "variabile" file.js

# Vedere range di righe
sed -n '100,150p' file.js
```

### Passo 4: Verificare la Fix
```bash
# Verificare che la modifica sia presente
grep "nuova_stringa" file.js

# Verificare che vecchio codice sia rimosso
grep "vecchia_stringa" file.js  # non deve trovare nulla
```

---

## 📡 COMUNICAZIONE EFFICACE CON CLAUDE

### DO ✅
- Upload file invece di copia/incolla per codice lungo
- Screenshot per output terminale con caratteri speciali
- Descrivere il comportamento ATTESO vs OSSERVATO
- Specificare DOVE si trova il file (path completo)
- Chiedere conferma prima di modifiche critiche
- Chiedere "Riassumimi cosa hai capito in 3 punti" se Claude dice "ho capito"

### DON'T ❌
- Copia/incolla codice con backtick o caratteri speciali
- Assumere che Claude ricordi tutto (la memoria ha limiti)
- Saltare i backup
- Pushare senza verificare con grep
- Tenere più chat aperte sullo stesso progetto
- Accettare modifiche di più di 15 righe senza spezzarle

### Quando Claude Sbaglia
- Chiedere rollback con backup
- Verificare SEMPRE il file scaricato prima di deployare
- Se il file sembra incompleto, chiedere di rigenerarlo

### Controlli di Sicurezza
| Se Claude dice... | Ettore chiede... |
|-------------------|------------------|
| "Ho capito" | "Riassumimi cosa hai capito in 3 punti" |
| "Modifico X" | "Quante righe? Max 15" |
| "Aggiungo funzione al backend" | "È davvero necessario toccare il backend esistente?" |
| "Funziona!" | "Test completo fatto? Reset, Avanti, popup?" |

---

## 🔗 URL UTILI

| Servizio | URL |
|----------|-----|
| Frontend | https://beautiful-granita-1603f5.netlify.app |
| Backend | https://daring-eagerness-production-34de.up.railway.app |
| LiveTiming | https://beautiful-granita-1603f5.netlify.app/live |
| API Eventi | https://daring-eagerness-production-34de.up.railway.app/api/eventi |
| API FICR | https://apienduro.ficr.it |

---

## 📦 STRUTTURA BACKUP CONSIGLIATA

```bash
# Frontend - dopo ogni chat significativa
cd ~/Desktop/enduro-frontend/src/pages
cp LiveTiming.jsx LiveTiming.jsx.BACKUP_CHATXX

# Backend - dopo ogni chat significativa
cd ~/Desktop/enduro-backend
cp server.js server.js.BACKUP_CHATXX

# Prima di modifiche rischiose
cp file.js file.js.BACKUP_CHATXX_BEFORE_FEATURE
```

---

## 🧪 CHECKLIST PRE-DEPLOY

### Frontend
- [ ] File scaricato correttamente (dimensione > 0)
- [ ] `grep` conferma modifica presente
- [ ] `git push` completato (build su Netlify)
- [ ] Atteso 1-2 min per build Netlify
- [ ] Cache browser svuotata
- [ ] Test visivo OK
- [ ] Test completo: Reset, Avanti, Play, popup funzionano

### Backend
- [ ] Backup creato
- [ ] File copiato correttamente
- [ ] `grep` conferma modifica presente
- [ ] `git push` completato
- [ ] Atteso 1-2 min per redeploy
- [ ] `curl` endpoint funziona
- [ ] Log Railway senza errori

---

## 📝 TEMPLATE INIZIO NUOVA CHAT

```
Ciao Claude, riprendiamo il progetto FMI-ENDURO.

PRIMA DI TUTTO: Leggi il documento METODOLOGIA.md che ti allego.

Stato attuale:
- [descrizione breve dello stato]
- [ultimo file modificato]
- [eventuali problemi aperti]

Obiettivo oggi:
- [cosa vogliamo fare]

File rilevanti che allego:
- [lista file]

Ricorda:
- Max 10-15 righe per modifica
- Descrivi COSA e COME prima di scrivere codice
- Test completo dopo ogni modifica
```

---

## 📊 RIEPILOGO METODOLOGIA

| Cosa | Come |
|------|------|
| Modifiche | str_replace chirurgico, max 10-15 righe |
| Test | Completo dopo ogni modifica |
| Backup | Prima di ogni round |
| Rollback | Immediato se qualcosa si rompe |
| Un round | UNA sola modifica piccola |
| Comunicazione | Descrivere prima, codice dopo |
| Verifica | grep + test visivo + test funzionale |

---

## 📝 NOTE PER IL FUTURO

### `git add .` lento/bloccato su Mac
- **Causa**: scansiona `node_modules/` e `dist/` (migliaia di file)
- **Soluzione**: sempre specificare il file esatto
```bash
# ❌ LENTO (scansiona tutto)
git add .

# ✅ VELOCE (file specifico)
git add src/pages/LiveTiming.jsx
git add src/pages/ImportFicr.jsx
```

---

*Documento creato: Chat 13 - 10 Dicembre 2025*
*Aggiornato: Chat 14 - 11 Dicembre 2025 (lezioni apprese)*
*Aggiornato: Chat 16 - 13 Dicembre 2025 (errori tecnici, debug, UUID, deploy)*
*Aggiornato: Chat 20 - 22 Dicembre 2025 (chiarimento deploy frontend)*
