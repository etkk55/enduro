# 🚀 CONTESTO RAPIDO PER CHAT ERTA

## Copia questo messaggio nella nuova chat:

---

**Progetto:** FMI-ENDURO / ERTA PWA

**Cosa è ERTA:** App PWA per piloti e pubblico gare enduro motociclistiche.

**Backend già funzionante:**
- URL: `https://daring-eagerness-production-34de.up.railway.app`
- PostgreSQL con tabelle: eventi, piloti, comunicati, tempi_settore

**Campo già presente in DB:** `codice_accesso_pubblico` VARCHAR(50) - per accesso pubblico

---

## 📱 3 MODALITÀ DA IMPLEMENTARE

### 1. PILOTA (già funziona)
- Login: Codice Accesso + Nr Gara
- Vede: Comunicati, I Miei Orari, I Miei Tempi, Squadra, SOS

### 2. DdG (parzialmente funziona)
- Login: Codice Accesso + Codice DdG
- Vede: Comunicati + **può CREARE/MODIFICARE/ELIMINARE**

### 3. PUBBLICO (🆕 DA SVILUPPARE)
- Login: Solo Codice FMI (es. VENE015)
- Vede:
  - 📋 Programma (prove speciali CT1, ET1...)
  - 👥 Iscritti (tutti i piloti, ordine alfabetico)
  - 🏁 Ordine Partenza (tutti, per orario)
  - 📢 Comunicati
  - 📌 Comunicazioni Servizio (nuovo tipo)

---

## 📎 FILE ALLEGATI

1. **ERTA_DEVELOPMENT_GUIDE.md** - Guida completa con schema DB, API, checklist
2. **erta_index_current.html** - ERTA attuale (3677 righe)
3. **server_current.js** - Backend attuale (4087 righe)
4. **api_app_examples.js** - Esempi endpoint /api/app esistenti

---

## 🎯 TASK PRIORITARI

1. **Modificare login ERTA** con 3 tab (Pilota/Pubblico/DdG)
2. **Creare endpoint backend** per accesso pubblico:
   - POST /api/app/login-pubblico
   - GET /api/app/pubblico/iscritti/:codice_fmi
   - GET /api/app/pubblico/ordine/:codice_fmi
   - GET /api/app/pubblico/programma/:codice_fmi
3. **Creare tab ERTA** per vista pubblica

---

**Inizia leggendo ERTA_DEVELOPMENT_GUIDE.md per tutti i dettagli!**
