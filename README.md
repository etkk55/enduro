# Enduro FMI - Timing System

Race management platform for the Italian Motorcycle Federation (FMI). Real-time timing, GPS tracking, FICR integration, pilot communications.

## Structure

```
backend/   - Node.js + Express + PostgreSQL (Railway)
frontend/  - React + Vite + Tailwind (Vercel)
```

## Quick Start

```bash
# Backend
cd backend && npm install && npm start

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## Deploy

- **Backend**: Push to `main` -> Railway auto-deploys from `backend/`
- **Frontend**: Push to `main` -> Vercel auto-deploys from `frontend/`

## Environment Variables

See `backend/.env.example` and `frontend/.env.production` for required config.
