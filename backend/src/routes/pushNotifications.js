const router = require('express').Router();
const pool = require('../db/pool');
const config = require('../config');

// Endpoint: Ottieni VAPID public key
router.get('/api/app/push/vapid-key', (req, res) => {
  if (!config.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications non configurate' });
  }
  res.json({ publicKey: config.VAPID_PUBLIC_KEY });
});

// Endpoint: Registra subscription push
router.post('/api/app/push/subscribe', async (req, res, next) => {
  try {
    const { codice_gara, numero_pilota, ruolo, subscription, id_addetto } = req.body;

    if (!codice_gara || !ruolo || !subscription) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    const { endpoint, keys } = subscription;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Subscription non valida' });
    }

    // Upsert: aggiorna se esiste, inserisci se nuovo
    await pool.query(`
      INSERT INTO push_subscriptions (codice_gara, numero_pilota, ruolo, endpoint, p256dh, auth, id_addetto)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (endpoint) DO UPDATE SET
        codice_gara = $1, numero_pilota = $2, ruolo = $3, p256dh = $5, auth = $6, id_addetto = $7
    `, [codice_gara, numero_pilota || null, ruolo, endpoint, keys.p256dh, keys.auth, id_addetto || null]);

    console.log(`Push subscription registrata: ${ruolo}${id_addetto ? ' (addetto ' + id_addetto.slice(0, 8) + ')' : ''} - gara ${codice_gara}`);
    res.json({ success: true, message: 'Notifiche attivate' });
  } catch (err) {
    console.error('Errore registrazione push:', err);
    next(err);
  }
});

// Endpoint: Rimuovi subscription push
router.delete('/api/app/push/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint mancante' });
    }

    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    console.log('Push subscription rimossa');
    res.json({ success: true, message: 'Notifiche disattivate' });
  } catch (err) {
    console.error('Errore rimozione push:', err);
    next(err);
  }
});

// INFO CONFIGURAZIONE (per frontend)
router.get('/api/auth/config', (req, res) => {
  res.json({
    pin_enabled: config.PIN_AUTH_ENABLED,
    twilio_enabled: true
  });
});

module.exports = router;
