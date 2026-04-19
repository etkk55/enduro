# ERTA - Documentazione Tecnica
> Enduro Real-Time App - PWA per piloti, pubblico e DdG

---

## 📁 POSIZIONE FILES

| Elemento | Path |
|----------|------|
| **Repository locale** | `~/Desktop/erta-app/` |
| **GitHub** | https://github.com/etkk55/erta-app |
| **File principale** | `index.html` (app monolitica ~7000 righe) |
| **Service Worker** | `sw.js` |
| **Manifest PWA** | `manifest.json` |
| **Banner splash** | `EN-RAS_banner.png` |
| **Redirect Netlify** | `_redirects` |

### Struttura cartella
```
~/Desktop/erta-app/
├── index.html          # App principale (HTML + CSS + JS inline)
├── sw.js               # Service Worker per cache
├── manifest.json       # PWA manifest
├── _redirects          # Netlify SPA redirect
├── EN-RAS_banner.png   # Logo splash screen
├── icon-192.png        # Icona PWA
├── icon-512.png        # Icona PWA grande
└── index.html.BACKUP_* # Backup vari
```

---

## 🚀 PROCEDURE DI DEPLOYMENT

### Deploy standard (dopo modifiche)
```bash
# 1. Pulisci Downloads
rm -f ~/Downloads/index.html

# 2. Scarica il nuovo file dalla chat Claude

# 3. Copia nella cartella
cp ~/Downloads/index.html ~/Desktop/erta-app/index.html

# 4. Verifica versione
grep "ERTA v" ~/Desktop/erta-app/index.html | head -1

# 5. Deploy su Netlify
cd ~/Desktop/erta-app && netlify deploy --prod --dir=.

# 6. Backup su GitHub (opzionale ma consigliato)
git add index.html
git commit -m "pNN: descrizione modifica - vX.Y.Z-pNN"
git push
```

### ⚠️ IMPORTANTE
- Netlify **NON** fa auto-deploy da GitHub per ERTA
- Il `git push` è solo per backup/versioning
- Il deploy effettivo richiede SEMPRE `netlify deploy --prod`

---

## 🔑 CREDENZIALI E URL

| Servizio | URL/Info |
|----------|----------|
| **URL Produzione** | https://erta-app.netlify.app |
| **Netlify Dashboard** | https://app.netlify.com/projects/erta-app |
| **GitHub Repo** | https://github.com/etkk55/erta-app |
| **Backend API** | https://daring-eagerness-production-34de.up.railway.app |

### Codici accesso app
- **Pilota**: codice gara (es. `ERACLEA24`) + numero pilota
- **Pubblico**: codice FMI manifestazione
- **DdG**: codice gara + password evento

---

## 🏗️ STRUTTURA NETLIFY

| Attributo | Valore |
|-----------|--------|
| **Tipo hosting** | Statico (no build) |
| **Directory deploy** | `.` (root) |
| **Auto-deploy GitHub** | ❌ Disabilitato |
| **Config file** | Nessuno (default) |
| **Account ID** | `690b19544d405b4aaa1eba8f` |

### Flusso dati
```
📱 Utente apre ERTA
       ↓
🌐 Netlify (frontend statico)
   Serve index.html, sw.js
       ↓
📡 Railway (backend)
   API login, tempi, GPS, comunicati
       ↓
🗄️ PostgreSQL (database)
```

---

## ⚠️ COSE DA EVITARE

### 🚫 MAI fare
1. **Modificare sw.js senza incrementare CACHE_VERSION** → utenti vedono vecchia versione
2. **Usare wildcard `*` nella destinazione di `cp`** → errore zsh
3. **Pushare su GitHub pensando che deploya** → serve `netlify deploy`
4. **Toccare le funzioni di login senza testare tutti e 3 i flussi** (pilota/pubblico/DdG)
5. **Rimuovere `localStorage.setItem('erta_user', ...)** → rompe persistenza sessione

### ✅ Sempre fare
1. **Backup prima di modificare**: `cp index.html index.html.BACKUP_pNN`
2. **Testare su dispositivo mobile** (è una PWA)
3. **Hard refresh dopo deploy** (Cmd+Shift+R)
4. **Verificare versione nel `<title>`** dopo deploy

### Service Worker - Attenzione
- Incrementare `CACHE_VERSION` in `sw.js` forza refresh su tutti i client
- Se modifichi solo `index.html`, il SW potrebbe servire la versione cached
- Per forzare update: incrementa versione sia in `<title>` che in `sw.js`

---

## 📊 VERSIONING

### Formato
```
vMAJOR.MINOR.PATCH-pNN

Esempi:
- v1.0.5-p36
- v1.1.0-p40
```

### Regole incremento

| Tipo | Quando | Esempio |
|------|--------|---------|
| **MAJOR** | Breaking change, redesign completo | 1.0.0 → 2.0.0 |
| **MINOR** | Nuova funzionalità | 1.0.5 → 1.1.0 |
| **PATCH** | Bug fix, modifiche minori | 1.0.5 → 1.0.6 |
| **pNN** | Numero sessione Claude | -p36 → -p37 |

### Dove aggiornare la versione
1. **`<title>`** in `index.html` (riga ~10)
2. **`sw.js`** → `CACHE_VERSION` (se serve invalidare cache)

### Versione attuale
```
ERTA v1.0.5-p36
```

---

## 📝 STORICO RECENTE

| Versione | Sessione | Modifiche |
|----------|----------|-----------|
| v1.0.5-p36 | p36 | Popup dettagli PS con variazioni gap |
| v1.0.4-p36 | p36 | Fix snapshot PS corretto |
| v1.0.3-p36 | p36 | Popup dettagli PS su tap |
| v1.0.2-p33 | p33 | Classifica Squadre con logica classe costituita |

---

## 🔧 TROUBLESHOOTING

### "Versione vecchia dopo deploy"
```bash
# 1. Verifica file locale
grep "ERTA v" ~/Desktop/erta-app/index.html

# 2. Hard refresh browser
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)

# 3. Clear site data
DevTools → Application → Storage → Clear site data
```

### "Login non funziona"
- Verificare che `API_BASE` punti al backend corretto
- Controllare console per errori CORS
- Verificare che l'evento esista nel database
