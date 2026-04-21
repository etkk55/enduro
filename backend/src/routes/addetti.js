const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db/pool');
const { distanza } = require('../helpers/haversine');
const { inviaPushAdAddetto } = require('../helpers/pushNotifications');

// Util: genera token URL-safe (32 caratteri base64url)
function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// ============================================================
// CRUD addetti (dashboard DdG)
// ============================================================

// GET addetti per evento
router.get('/api/eventi/:id_evento/addetti', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const result = await pool.query(
      `SELECT a.*,
              ps.nome_ps,
              CASE WHEN a.ultima_posizione_at IS NOT NULL
                   AND a.ultima_posizione_at > NOW() - INTERVAL '5 minutes'
                   THEN true ELSE false END AS online
       FROM addetti a
       LEFT JOIN prove_speciali ps ON a.id_ps = ps.id
       WHERE a.id_evento = $1
       ORDER BY
         CASE a.ruolo
           WHEN 'medico' THEN 1
           WHEN 'resp_trasf' THEN 2
           WHEN 'resp_ps' THEN 3
           ELSE 4
         END,
         a.cognome, a.nome`,
      [id_evento]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST crea addetto
router.post('/api/eventi/:id_evento/addetti', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const { ruolo, nome, cognome, telefono, id_ps, nome_settore, note } = req.body;

    if (!nome || !cognome) {
      return res.status(400).json({ error: 'Nome e cognome sono obbligatori' });
    }
    const ruoliValidi = ['medico', 'resp_ps', 'resp_trasf', 'addetto'];
    if (ruolo && !ruoliValidi.includes(ruolo)) {
      return res.status(400).json({ error: `Ruolo non valido. Usa uno di: ${ruoliValidi.join(', ')}` });
    }

    const token = generateToken();

    const result = await pool.query(
      `INSERT INTO addetti (id_evento, ruolo, nome, cognome, telefono, id_ps, nome_settore, token, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id_evento, ruolo || 'addetto', nome.trim(), cognome.trim(), telefono || null, id_ps || null, nome_settore || null, token, note || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH aggiorna addetto
router.patch('/api/addetti/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ruolo, nome, cognome, telefono, id_ps, nome_settore, note, attivo } = req.body;

    const result = await pool.query(
      `UPDATE addetti SET
        ruolo = COALESCE($1, ruolo),
        nome = COALESCE($2, nome),
        cognome = COALESCE($3, cognome),
        telefono = COALESCE($4, telefono),
        id_ps = $5,
        nome_settore = $6,
        note = $7,
        attivo = COALESCE($8, attivo),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [ruolo, nome, cognome, telefono, id_ps || null, nome_settore || null, note || null, attivo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Addetto non trovato' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE addetto
router.delete('/api/addetti/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM addetti WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST rigenera token addetto (se perso o compromesso)
router.post('/api/addetti/:id/regen-token', async (req, res, next) => {
  try {
    const { id } = req.params;
    const token = generateToken();
    const result = await pool.query(
      `UPDATE addetti SET token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [token, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Addetto non trovato' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ============================================================
// Lato ERTA (app mobile)
// ============================================================

// POST login via token (QR scan)
router.post('/api/addetti/login-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token mancante' });

    const result = await pool.query(
      `SELECT a.*, e.nome_evento, e.codice_gara, e.codice_accesso_pubblico, ps.nome_ps
       FROM addetti a
       JOIN eventi e ON a.id_evento = e.id
       LEFT JOIN prove_speciali ps ON a.id_ps = ps.id
       WHERE a.token = $1 AND a.attivo = TRUE`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Token non valido o addetto disattivato' });
    }

    await pool.query(
      `UPDATE addetti SET ultimo_accesso_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [result.rows[0].id]
    );

    const a = result.rows[0];
    res.json({
      success: true,
      addetto: {
        id: a.id,
        id_evento: a.id_evento,
        ruolo: a.ruolo,
        nome: a.nome,
        cognome: a.cognome,
        telefono: a.telefono,
        id_ps: a.id_ps,
        nome_ps: a.nome_ps,
        nome_settore: a.nome_settore
      },
      evento: {
        id: a.id_evento,
        nome: a.nome_evento,
        codice_gara: a.codice_gara,
        codice_accesso: a.codice_accesso_pubblico || a.codice_gara
      }
    });
  } catch (err) { next(err); }
});

// POST aggiorna posizione GPS
router.post('/api/addetti/:id/posizione', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lon } = req.body;
    if (lat == null || lon == null) {
      return res.status(400).json({ error: 'lat e lon sono obbligatori' });
    }
    await pool.query(
      `UPDATE addetti SET
        ultima_lat = $1,
        ultima_lon = $2,
        ultima_posizione_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [parseFloat(lat), parseFloat(lon), id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET lista addetti live (per DdG in app ERTA) con top-N più vicini a una posizione
router.get('/api/eventi/:id_evento/addetti-live', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const { lat, lon } = req.query;

    const result = await pool.query(
      `SELECT a.id, a.ruolo, a.nome, a.cognome, a.telefono, a.nome_settore,
              a.ultima_lat, a.ultima_lon, a.ultima_posizione_at,
              ps.nome_ps,
              CASE WHEN a.ultima_posizione_at IS NOT NULL
                   AND a.ultima_posizione_at > NOW() - INTERVAL '5 minutes'
                   THEN true ELSE false END AS online
       FROM addetti a
       LEFT JOIN prove_speciali ps ON a.id_ps = ps.id
       WHERE a.id_evento = $1 AND a.attivo = TRUE
       ORDER BY online DESC,
         CASE a.ruolo
           WHEN 'medico' THEN 1
           WHEN 'resp_trasf' THEN 2
           WHEN 'resp_ps' THEN 3
           ELSE 4
         END`,
      [id_evento]
    );

    let addetti = result.rows;

    // Se lat/lon forniti, aggiungi distanza e ordina per vicinanza
    if (lat != null && lon != null) {
      const pLat = parseFloat(lat);
      const pLon = parseFloat(lon);
      addetti = addetti.map(a => {
        if (a.ultima_lat != null && a.ultima_lon != null) {
          const dist = distanza(pLat, pLon, parseFloat(a.ultima_lat), parseFloat(a.ultima_lon));
          return { ...a, distanza_m: Math.round(dist) };
        }
        return { ...a, distanza_m: null };
      });
      // Ordina per: online desc, distanza asc (null last)
      addetti.sort((a, b) => {
        if (a.online !== b.online) return b.online ? 1 : -1;
        if (a.distanza_m == null && b.distanza_m == null) return 0;
        if (a.distanza_m == null) return 1;
        if (b.distanza_m == null) return -1;
        return a.distanza_m - b.distanza_m;
      });
    }

    res.json(addetti);
  } catch (err) { next(err); }
});

// GET alerts di un addetto (chiamato dal suo ERTA)
router.get('/api/addetti/:id/alerts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM addetti_alerts
       WHERE id_addetto = $1
         AND created_at > NOW() - INTERVAL '6 hours'
       ORDER BY created_at DESC LIMIT 50`,
      [id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// PATCH preso in carico (addetto conferma ricezione SOS)
router.patch('/api/addetti/alerts/:id_alert/preso-in-carico', async (req, res, next) => {
  try {
    const { id_alert } = req.params;
    const result = await pool.query(
      `UPDATE addetti_alerts SET preso_in_carico = TRUE WHERE id = $1 RETURNING *`,
      [id_alert]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert non trovato' });
    res.json({ success: true, alert: result.rows[0] });
  } catch (err) { next(err); }
});

// POST inoltra un SOS a un addetto specifico (da DdG)
// Crea un alert nella sua app ERTA + invia push notification
router.post('/api/addetti/:id/inoltra-sos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_messaggio, tipo, testo, numero_pilota, nome_pilota, gps_lat, gps_lon } = req.body || {};

    const aRes = await pool.query('SELECT id, nome, cognome, id_evento FROM addetti WHERE id = $1', [id]);
    if (aRes.rows.length === 0) return res.status(404).json({ error: 'Addetto non trovato' });

    // Calcola distanza se addetto ha posizione nota
    let distanza_m = null;
    if (gps_lat != null && gps_lon != null) {
      try {
        const posRes = await pool.query(
          'SELECT ultima_lat, ultima_lon FROM addetti WHERE id = $1 AND ultima_lat IS NOT NULL AND ultima_lon IS NOT NULL',
          [id]
        );
        if (posRes.rows.length > 0) {
          distanza_m = Math.round(distanza(parseFloat(gps_lat), parseFloat(gps_lon), parseFloat(posRes.rows[0].ultima_lat), parseFloat(posRes.rows[0].ultima_lon)));
        }
      } catch (e) {}
    }

    const alertRes = await pool.query(
      `INSERT INTO addetti_alerts (id_addetto, id_messaggio, tipo, testo, pilota_numero, pilota_nome, gps_lat, gps_lon, distanza_m)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        id,
        id_messaggio || null,
        tipo || 'sos',
        testo || '',
        numero_pilota ? parseInt(numero_pilota) : null,
        nome_pilota || null,
        gps_lat || null,
        gps_lon || null,
        distanza_m
      ]
    );

    try {
      const distTxt = distanza_m != null ? ` · ${distanza_m}m` : '';
      const nomeTxt = nome_pilota ? ` ${nome_pilota}` : '';
      await inviaPushAdAddetto(
        id,
        `🆘 ${tipo || 'SOS'} Pilota #${numero_pilota || '?'}${nomeTxt}`,
        `${(testo || '').substring(0, 80)}${distTxt}`,
        '/',
        { tipo: 'sos_inoltrato', id_messaggio: id_messaggio || null, gps_lat, gps_lon }
      );
    } catch (pushErr) {
      console.log(`Push inoltro SOS ad addetto ${id} fallito:`, pushErr.message);
    }

    res.json({ success: true, alert: alertRes.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
