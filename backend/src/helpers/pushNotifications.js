const webpush = require('web-push');
const pool = require('../db/pool');
const config = require('../config');

// Configura web-push se le chiavi sono presenti
if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
  console.log('Web Push configurato con VAPID keys');
} else {
  console.log('VAPID keys non configurate - Push notifications disabilitate');
}

// Funzione: Invia push a destinatari (con supporto transcodifica FICR/FMI)
async function inviaPushADestinatari(codiceGara, ruoloDestinatario, titolo, messaggio, url) {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
    console.log('Push skip: VAPID non configurato');
    return { sent: 0, failed: 0 };
  }

  try {
    // Trova tutti i codici correlati (FICR e FMI)
    const codiciDaCercare = [codiceGara];

    // Cerca codici FMI associati a questo FICR
    const codiciFmi = await pool.query(
      'SELECT DISTINCT codice_fmi FROM codici_gara WHERE UPPER(codice_ficr) = $1',
      [codiceGara.toUpperCase()]
    );
    codiciFmi.rows.forEach(r => codiciDaCercare.push(r.codice_fmi));

    // Cerca codici FICR associati a questo FMI
    const codiciFicr = await pool.query(
      'SELECT DISTINCT codice_ficr FROM codici_gara WHERE UPPER(codice_fmi) = $1',
      [codiceGara.toUpperCase()]
    );
    codiciFicr.rows.forEach(r => codiciDaCercare.push(r.codice_ficr));

    // Cerca subscriptions per tutti i codici correlati
    const subs = await pool.query(
      'SELECT * FROM push_subscriptions WHERE codice_gara = ANY($1) AND ruolo = $2',
      [codiciDaCercare, ruoloDestinatario]
    );

    let sent = 0, failed = 0;

    for (const sub of subs.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };

      const payload = JSON.stringify({
        title: titolo,
        body: messaggio,
        url: url || '/',
        timestamp: Date.now()
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err) {
        console.log(`Push failed to ${sub.endpoint.substring(0, 50)}:`, err.message);
        failed++;
        // Rimuovi subscription non valida (410 Gone)
        if (err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    }

    console.log(`Push inviati: ${sent} ok, ${failed} failed (${ruoloDestinatario} - ${codiceGara} + transcodifica: ${codiciDaCercare.join(', ')})`);
    return { sent, failed };
  } catch (err) {
    console.error('Errore invio push:', err);
    return { sent: 0, failed: 0 };
  }
}

module.exports = { inviaPushADestinatari };
