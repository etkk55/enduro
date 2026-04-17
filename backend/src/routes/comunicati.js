const router = require('express').Router();
const pool = require('../db/pool');
const { inviaPushADestinatari } = require('../helpers/pushNotifications');

// 1. CREA COMUNICATO
router.post('/api/comunicati', async (req, res, next) => {
  const { codice_gara, testo, pdf_allegato, pdf_nome, tipo } = req.body;
  const tipoDoc = tipo || 'comunicato';

  if (!codice_gara || !testo) {
    return res.status(400).json({ error: 'Codice gara e testo obbligatori' });
  }

  const tipiValidi = ['comunicato', 'general_info', 'paddock_info'];
  if (!tipiValidi.includes(tipoDoc)) {
    return res.status(400).json({ error: 'Tipo non valido. Usa: comunicato, general_info, paddock_info' });
  }

  try {
    const numeroResult = await pool.query(
      'SELECT get_next_comunicato_number($1, $2) as numero',
      [codice_gara, tipoDoc]
    );
    const numero = numeroResult.rows[0].numero;

    const result = await pool.query(
      `INSERT INTO comunicati (codice_gara, numero, testo, ora, data, pdf_allegato, pdf_nome, tipo)
       VALUES ($1, $2, $3, CURRENT_TIME, CURRENT_DATE, $4, $5, $6)
       RETURNING *`,
      [codice_gara, numero, testo, pdf_allegato || null, pdf_nome || null, tipoDoc]
    );

    const comunicato = result.rows[0];

    // PUSH NOTIFICATION
    try {
      await inviaPushADestinatari(
        codice_gara,
        'pilota',
        `${tipoDoc === 'comunicato' ? 'Comunicato' : 'Info'} #${numero}`,
        testo.substring(0, 100) + (testo.length > 100 ? '...' : ''),
        '/'
      );
      await inviaPushADestinatari(
        codice_gara,
        'pubblico',
        `${tipoDoc === 'comunicato' ? 'Comunicato' : 'Info'} #${numero}`,
        testo.substring(0, 100) + (testo.length > 100 ? '...' : ''),
        '/'
      );
    } catch (pushErr) {
      console.log('Push comunicato failed (non bloccante):', pushErr.message);
    }

    res.status(201).json({
      success: true,
      comunicato: {
        id: comunicato.id,
        numero: comunicato.numero,
        ora: comunicato.ora,
        data: comunicato.data,
        testo: comunicato.testo,
        codice_gara: comunicato.codice_gara,
        pdf_allegato: comunicato.pdf_allegato,
        pdf_nome: comunicato.pdf_nome,
        tipo: comunicato.tipo
      }
    });
  } catch (error) {
    console.error('Errore creazione comunicato:', error);
    next(error);
  }
});

// 2. LISTA COMUNICATI PER GARA
router.get('/api/comunicati/:codice_gara', async (req, res, next) => {
  const { codice_gara } = req.params;
  const { tipo } = req.query;

  try {
    let query = `SELECT id, numero, ora, data, testo, created_at, updated_at,
            pdf_allegato, pdf_nome, tipo,
            jsonb_array_length(letto_da) as num_letti
     FROM comunicati
     WHERE codice_gara = $1`;

    const params = [codice_gara];

    if (tipo) {
      query += ` AND tipo = $2`;
      params.push(tipo);
    }

    query += ` ORDER BY numero DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, comunicati: result.rows });
  } catch (error) {
    console.error('Errore recupero comunicati:', error);
    next(error);
  }
});

// 3. ELIMINA COMUNICATO
router.delete('/api/comunicati/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM comunicati WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione:', error);
    next(error);
  }
});

// 4. MODIFICA COMUNICATO
router.patch('/api/comunicati/:id', async (req, res, next) => {
  const { id } = req.params;
  const { testo } = req.body;

  try {
    const result = await pool.query(
      `UPDATE comunicati SET testo = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, testo]
    );
    res.json({ success: true, comunicato: result.rows[0] });
  } catch (error) {
    console.error('Errore modifica:', error);
    next(error);
  }
});

// 5. STATISTICHE
router.get('/api/comunicati/:codice_gara/stats', async (req, res, next) => {
  const { codice_gara } = req.params;
  const { tipo } = req.query;

  try {
    let query = `SELECT COUNT(*) as totale_comunicati, MAX(numero) as ultimo_numero
       FROM comunicati WHERE codice_gara = $1`;
    const params = [codice_gara];

    if (tipo) {
      query += ` AND tipo = $2`;
      params.push(tipo);
    }

    const stats = await pool.query(query, params);

    res.json({
      success: true,
      stats: {
        totale_comunicati: stats.rows[0].totale_comunicati,
        ultimo_numero: stats.rows[0].ultimo_numero,
        piloti_attivi: 0
      }
    });
  } catch (error) {
    console.error('Errore statistiche:', error);
    next(error);
  }
});

module.exports = router;
