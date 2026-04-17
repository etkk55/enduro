const axios = require('axios');

const PORT = process.env.PORT || 8080;
const FICR_BASE_URL = process.env.FICR_URL || 'https://apienduro.ficr.it';

// FICR API client con timeout e headers standard
const ficrAxios = axios.create({
  baseURL: FICR_BASE_URL,
  timeout: 8000,
  headers: {
    'Referer': 'https://enduro.ficr.it/',
    'Origin': 'https://enduro.ficr.it',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (compatible; EnduroFMI/3.0)'
  }
});

// Configurazione Twilio (da variabili ambiente Railway)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SID;

// Flag per abilitare/disabilitare autenticazione PIN (true = PIN attivo come fallback)
const PIN_AUTH_ENABLED = process.env.PIN_AUTH_ENABLED !== 'false'; // default true

// PUSH NOTIFICATIONS - VAPID Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@erta-app.netlify.app';

const config = Object.freeze({
  PORT,
  FICR_BASE_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SID,
  PIN_AUTH_ENABLED,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT
});

module.exports = config;
module.exports.ficrAxios = ficrAxios;
