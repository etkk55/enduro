# ERTA - Enduro Race Timing Assistant

PWA mobile per piloti, Direttori di Gara e pubblico delle gare Enduro FMI.
Si collega al backend del monorepo `enduro` deployato su Railway.

## Struttura

```
erta-app/
├── index.html       # App completa (HTML/CSS/JS inline, ~7700 righe)
├── manifest.json    # PWA manifest
├── sw.js            # Service worker (push notifications, offline)
├── vercel.json      # Config Vercel (SPA rewrite + SW cache headers)
├── icon-192.png     # Icon PWA
├── icon-512.png     # Icon PWA
└── EN-RAS_banner.png
```

## Configurazione backend

`index.html` punta al backend:
```javascript
const API_BASE = 'https://enduro-production.up.railway.app';
```

Endpoint usati:
- `POST /api/app/login` + `/api/app/login-token` - autenticazione (PIN / Twilio / device token)
- `GET /api/app/miei-tempi/:codice/:numero` - tempi pilota e posizione
- `GET /api/app/comunicati/:codice` - comunicati DdG con polling incrementale
- `GET /api/app/comunicati/:codice/pdf/:id` - download PDF allegati
- `POST /api/app/sos` - emergenza SOS
- `POST /api/app/messaggio` - messaggi pilota -> DdG
- `POST /api/app/posizione` - invio GPS pilota
- `POST /api/app/push/subscribe` - registrazione push notifications
- `GET /api/app/pubblico/*` - endpoint read-only per pubblico

## Deploy

**Vercel** (consigliato, stesso provider del frontend admin):
```bash
# Prima volta: import da GitHub su vercel.com/new
# Root directory: erta-app
# Framework preset: Other (static)
# Build command: (vuoto)
# Output directory: . (root della cartella)
```

Auto-deploy su ogni push a `main`.

## Installazione su mobile

### Android (Chrome)
Menu ⋮ → "Installa app" / "Aggiungi a schermata home"

### iOS (Safari)
Condividi → "Aggiungi a Home"

## Utenti e login

### Pilota
Codice accesso (es. `FRIEN006`) + numero di gara. Autenticazione via PIN
(licenza FMI + anno nascita) o OTP Twilio SMS.

### Direttore di Gara (DdG)
Codice DdG + numero Twilio. Accesso dashboard multi-evento.

### Pubblico
Codice pubblico (solo lettura classifiche e comunicati).

## Polling

Comunicati e tempi: 30 secondi.
Push notifications: immediate (via VAPID web-push).
