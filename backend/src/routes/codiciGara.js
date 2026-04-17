const router = require('express').Router();
const pool = require('../db/pool');
const { traduciCodiceFMI } = require('../helpers/transcodification');

// GET tutti i mapping
router.get('/api/codici-gara', async (req, res, next) => {
  try {
    const { anno } = req.query;
    let query = 'SELECT * FROM codici_gara';
    let params = [];

    if (anno) {
      query += ' WHERE anno = $1';
      params.push(anno);
    }

    query += ' ORDER BY codice_fmi, codice_ficr';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/codici-gara] Error:', err.message);
    next(err);
  }
});

// POST nuovo mapping
router.post('/api/codici-gara', async (req, res, next) => {
  try {
    const { codice_fmi, codice_ficr, descrizione, anno } = req.body;

    if (!codice_fmi || !codice_ficr) {
      return res.status(400).json({ error: 'codice_fmi e codice_ficr richiesti' });
    }

    const result = await pool.query(
      `INSERT INTO codici_gara (codice_fmi, codice_ficr, descrizione, anno)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (codice_fmi, codice_ficr) DO UPDATE SET
         descrizione = EXCLUDED.descrizione,
         anno = EXCLUDED.anno
       RETURNING *`,
      [codice_fmi.toUpperCase(), codice_ficr.toUpperCase(), descrizione || null, anno || new Date().getFullYear()]
    );

    console.log(`Mapping aggiunto: ${codice_fmi} -> ${codice_ficr}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/codici-gara] Error:', err.message);
    next(err);
  }
});

// DELETE mapping
router.delete('/api/codici-gara/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM codici_gara WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping non trovato' });
    }

    console.log(`Mapping eliminato: ${result.rows[0].codice_fmi} -> ${result.rows[0].codice_ficr}`);
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('[DELETE /api/codici-gara] Error:', err.message);
    next(err);
  }
});

// GET traduzione FMI -> FICR
router.get('/api/codici-gara/traduci/:codice_fmi', async (req, res, next) => {
  try {
    const { codice_fmi } = req.params;
    const codiciFicr = await traduciCodiceFMI(codice_fmi);

    res.json({
      codice_fmi: codice_fmi.toUpperCase(),
      codici_ficr: codiciFicr,
      trovati: codiciFicr.length
    });
  } catch (err) {
    console.error('[GET /api/codici-gara/traduci] Error:', err.message);
    next(err);
  }
});

module.exports = router;
