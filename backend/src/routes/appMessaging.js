const router = require('express').Router();
const pool = require('../db/pool');
const { cercaEventoPerCodice } = require('../helpers/transcodification');

// MESSAGGIO - Pilota invia messaggio normale
router.post('/api/app/messaggio', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota, tipo, testo, gps_lat, gps_lon } = req.body;

    if (!codice_accesso || !numero_pilota || !testo) {
      return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    const codice_gara = eventiTrovati[0].codice_gara;
    const tipoValido = ['assistenza', 'pericolo', 'info', 'altro'].includes(tipo) ? tipo : 'altro';

    const result = await pool.query(
      `INSERT INTO messaggi_piloti (codice_gara, numero_pilota, tipo, testo, gps_lat, gps_lon)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [codice_gara, parseInt(numero_pilota), tipoValido, testo, gps_lat || null, gps_lon || null]
    );

    console.log(`Messaggio ricevuto: Pilota #${numero_pilota} - Tipo: ${tipoValido}`);

    res.json({ success: true, messaggio: result.rows[0], alert: 'Messaggio inviato alla Direzione Gara' });
  } catch (err) {
    console.error('[POST /api/app/messaggio] Error:', err.message);
    next(err);
  }
});

// Recupera messaggi inviati dal pilota
router.get('/api/app/messaggi-inviati/:codice_accesso/:numero_pilota', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota } = req.params;

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    const codiciGara = eventiTrovati.map(e => e.codice_gara);

    const result = await pool.query(
      `SELECT id, tipo, testo, gps_lat, gps_lon, created_at, codice_gara
       FROM messaggi_piloti
       WHERE codice_gara = ANY($1) AND numero_pilota = $2
       ORDER BY created_at DESC LIMIT 50`,
      [codiciGara, parseInt(numero_pilota)]
    );

    res.json({
      success: true,
      messaggi: result.rows.map(m => ({ id: m.id, tipo: m.tipo, testo: m.testo, gps_lat: m.gps_lat, gps_lon: m.gps_lon, data: m.created_at, gara: m.codice_gara }))
    });
  } catch (err) { next(err); }
});

// LISTA MESSAGGI - Per pannello admin DdG
router.get('/api/messaggi-piloti/:codice_gara', async (req, res, next) => {
  try {
    const { codice_gara } = req.params;
    const { solo_non_letti, tipo } = req.query;

    let query = `
      SELECT mp.*, p.nome, p.cognome, p.classe, p.moto
      FROM messaggi_piloti mp
      LEFT JOIN piloti p ON mp.numero_pilota = p.numero_gara
        AND p.id_evento = (SELECT id FROM eventi WHERE codice_gara = $1 LIMIT 1)
      WHERE mp.codice_gara = $1
    `;
    const params = [codice_gara];

    if (solo_non_letti === 'true') query += ' AND mp.letto = FALSE';
    if (tipo) { query += ` AND mp.tipo = $${params.length + 1}`; params.push(tipo); }
    query += ' ORDER BY mp.created_at DESC';

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE letto = FALSE) as non_letti,
              COUNT(*) FILTER (WHERE tipo = 'sos' AND letto = FALSE) as sos_attivi
       FROM messaggi_piloti WHERE codice_gara = $1`,
      [codice_gara]
    );

    res.json({
      success: true, messaggi: result.rows, totale: result.rows.length,
      non_letti: parseInt(countResult.rows[0].non_letti),
      sos_attivi: parseInt(countResult.rows[0].sos_attivi)
    });
  } catch (err) { next(err); }
});

// SEGNA COME LETTO
router.patch('/api/messaggi-piloti/:id/letto', async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE messaggi_piloti SET letto = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Messaggio non trovato' });
    res.json({ success: true, messaggio: result.rows[0] });
  } catch (err) { next(err); }
});

// SEGNA TUTTI COME LETTI
router.patch('/api/messaggi-piloti/:codice_gara/letti-tutti', async (req, res, next) => {
  try {
    await pool.query('UPDATE messaggi_piloti SET letto = TRUE WHERE codice_gara = $1', [req.params.codice_gara]);
    res.json({ success: true, message: 'Tutti i messaggi segnati come letti' });
  } catch (err) { next(err); }
});

// ELIMINA MESSAGGIO
router.delete('/api/messaggi-piloti/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM messaggi_piloti WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Messaggio non trovato' });
    res.json({ success: true, message: 'Messaggio eliminato' });
  } catch (err) { next(err); }
});

// AGGIORNA TESTO MESSAGGIO
router.patch('/api/messaggi-piloti/:id/testo', async (req, res, next) => {
  try {
    const { testo } = req.body;
    if (!testo) return res.status(400).json({ success: false, error: 'Testo mancante' });

    const result = await pool.query('UPDATE messaggi_piloti SET testo = $1 WHERE id = $2 RETURNING *', [testo, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Messaggio non trovato' });
    res.json({ success: true, messaggio: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
