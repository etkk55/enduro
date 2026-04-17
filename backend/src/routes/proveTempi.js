const router = require('express').Router();
const pool = require('../db/pool');

// GET prove per evento
router.get('/api/eventi/:id_evento/prove', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const result = await pool.query(
      'SELECT * FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
      [id_evento]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST crea prova speciale
router.post('/api/prove', async (req, res, next) => {
  try {
    const { nome_ps, numero_ordine, id_evento, stato } = req.body;
    const result = await pool.query(
      'INSERT INTO prove_speciali (nome_ps, numero_ordine, id_evento, stato) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome_ps, numero_ordine, id_evento, stato || 'non_iniziata']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Alias per compatibilita
router.post('/api/prove-speciali', async (req, res, next) => {
  try {
    const { nome_ps, numero_ordine, id_evento, stato } = req.body;
    const result = await pool.query(
      'INSERT INTO prove_speciali (nome_ps, numero_ordine, id_evento, stato) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome_ps, numero_ordine, id_evento, stato || 'non_iniziata']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT aggiorna stato prova
router.patch('/api/prove/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stato } = req.body;
    const result = await pool.query(
      'UPDATE prove_speciali SET stato = $1 WHERE id = $2 RETURNING *',
      [stato, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE prova
router.delete('/api/prove/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM prove_speciali WHERE id = $1', [id]);
    res.json({ message: 'Prova eliminata' });
  } catch (err) {
    next(err);
  }
});

// GET tempi per prova
router.get('/api/prove/:id_ps/tempi', async (req, res, next) => {
  try {
    const { id_ps } = req.params;
    const result = await pool.query(
      `SELECT t.*, p.numero_gara, p.nome, p.cognome, p.classe
       FROM tempi t
       JOIN piloti p ON t.id_pilota = p.id
       WHERE t.id_ps = $1
       ORDER BY t.tempo_secondi`,
      [id_ps]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST inserisci tempo
router.post('/api/tempi', async (req, res, next) => {
  try {
    const { id_pilota, id_ps, tempo_secondi, penalita_secondi } = req.body;
    const result = await pool.query(
      'INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi) VALUES ($1, $2, $3, $4) ON CONFLICT (id_pilota, id_ps) DO UPDATE SET tempo_secondi = $3, penalita_secondi = $4 RETURNING *',
      [id_pilota, id_ps, tempo_secondi, penalita_secondi || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET classifica per evento
router.get('/api/eventi/:id_evento/classifica', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const result = await pool.query(
      `SELECT
        p.id,
        p.numero_gara,
        p.nome,
        p.cognome,
        p.classe,
        p.team,
        SUM(t.tempo_secondi + t.penalita_secondi) as tempo_totale
       FROM piloti p
       LEFT JOIN tempi t ON p.id = t.id_pilota
       LEFT JOIN prove_speciali ps ON t.id_ps = ps.id
       WHERE p.id_evento = $1
       GROUP BY p.id
       ORDER BY tempo_totale ASC NULLS LAST`,
      [id_evento]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
