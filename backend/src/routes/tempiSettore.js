const router = require('express').Router();
const pool = require('../db/pool');

// GET tempi settore per evento
router.get('/api/eventi/:id/tempi-settore', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM tempi_settore WHERE id_evento = $1 ORDER BY codice_gara',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/eventi/:id/tempi-settore] Error:', err.message);
    next(err);
  }
});

// POST/PUT tempi settore per gara specifica
router.post('/api/eventi/:id/tempi-settore', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      codice_gara,
      co1_attivo, co2_attivo, co3_attivo, co4_attivo, co5_attivo,
      co6_attivo, co7_attivo, co8_attivo, co9_attivo, co10_attivo,
      tempo_par_co1, tempo_co1_co2, tempo_co2_co3, tempo_co3_co4,
      tempo_co4_co5, tempo_co5_co6, tempo_co6_co7, tempo_co7_co8,
      tempo_co8_co9, tempo_co9_co10, tempo_ultimo_arr
    } = req.body;

    const result = await pool.query(`
      INSERT INTO tempi_settore (
        id_evento, codice_gara,
        co1_attivo, co2_attivo, co3_attivo, co4_attivo, co5_attivo,
        co6_attivo, co7_attivo, co8_attivo, co9_attivo, co10_attivo,
        tempo_par_co1, tempo_co1_co2, tempo_co2_co3, tempo_co3_co4,
        tempo_co4_co5, tempo_co5_co6, tempo_co6_co7, tempo_co7_co8,
        tempo_co8_co9, tempo_co9_co10, tempo_ultimo_arr
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (id_evento, codice_gara)
      DO UPDATE SET
        co1_attivo = EXCLUDED.co1_attivo, co2_attivo = EXCLUDED.co2_attivo, co3_attivo = EXCLUDED.co3_attivo,
        co4_attivo = EXCLUDED.co4_attivo, co5_attivo = EXCLUDED.co5_attivo, co6_attivo = EXCLUDED.co6_attivo,
        co7_attivo = EXCLUDED.co7_attivo, co8_attivo = EXCLUDED.co8_attivo, co9_attivo = EXCLUDED.co9_attivo,
        co10_attivo = EXCLUDED.co10_attivo,
        tempo_par_co1 = EXCLUDED.tempo_par_co1, tempo_co1_co2 = EXCLUDED.tempo_co1_co2,
        tempo_co2_co3 = EXCLUDED.tempo_co2_co3, tempo_co3_co4 = EXCLUDED.tempo_co3_co4,
        tempo_co4_co5 = EXCLUDED.tempo_co4_co5, tempo_co5_co6 = EXCLUDED.tempo_co5_co6,
        tempo_co6_co7 = EXCLUDED.tempo_co6_co7, tempo_co7_co8 = EXCLUDED.tempo_co7_co8,
        tempo_co8_co9 = EXCLUDED.tempo_co8_co9, tempo_co9_co10 = EXCLUDED.tempo_co9_co10,
        tempo_ultimo_arr = EXCLUDED.tempo_ultimo_arr
      RETURNING *
    `, [id, codice_gara,
        co1_attivo, co2_attivo, co3_attivo, co4_attivo, co5_attivo,
        co6_attivo, co7_attivo, co8_attivo, co9_attivo, co10_attivo,
        tempo_par_co1, tempo_co1_co2, tempo_co2_co3, tempo_co3_co4,
        tempo_co4_co5, tempo_co5_co6, tempo_co6_co7, tempo_co7_co8,
        tempo_co8_co9, tempo_co9_co10, tempo_ultimo_arr]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[POST /api/eventi/:id/tempi-settore] Error:', err.message);
    next(err);
  }
});

// POST struttura-ps - Salva struttura gara
router.post('/api/eventi/:id/struttura-ps', async (req, res, next) => {
  const { id } = req.params;
  const { numGiri, prove, psGenerate } = req.body;

  try {
    await pool.query(`
      ALTER TABLE prove_speciali
      ADD COLUMN IF NOT EXISTS gruppo_prova VARCHAR(100),
      ADD COLUMN IF NOT EXISTS giro INTEGER,
      ADD COLUMN IF NOT EXISTS is_finale BOOLEAN DEFAULT FALSE
    `);

    await pool.query(`
      ALTER TABLE eventi
      ADD COLUMN IF NOT EXISTS struttura_giri INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS struttura_prove TEXT
    `);

    await pool.query('DELETE FROM prove_speciali WHERE id_evento = $1', [id]);

    for (const ps of psGenerate) {
      await pool.query(
        `INSERT INTO prove_speciali (nome_ps, numero_ordine, id_evento, stato, gruppo_prova, giro, is_finale)
         VALUES ($1, $2, $3, 'attiva', $4, $5, $6)`,
        [ps.nome, ps.numero, id, ps.gruppo, ps.giro === 'finale' ? null : ps.giro, ps.isFinale || false]
      );
    }

    await pool.query(
      'UPDATE eventi SET struttura_giri = $1, struttura_prove = $2 WHERE id = $3',
      [numGiri, JSON.stringify(prove), id]
    );

    res.json({ success: true, ps_create: psGenerate.length });
  } catch (err) {
    console.error('[POST /api/eventi/:id/struttura-ps] Error:', err.message);
    next(err);
  }
});

// GET struttura-ps - Leggi struttura gara
router.get('/api/eventi/:id/struttura-ps', async (req, res, next) => {
  const { id } = req.params;

  try {
    const eventoResult = await pool.query(
      'SELECT struttura_giri, struttura_prove FROM eventi WHERE id = $1',
      [id]
    );

    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const evento = eventoResult.rows[0];

    const psResult = await pool.query(
      'SELECT id, nome_ps, numero_ordine, gruppo_prova, giro, is_finale FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
      [id]
    );

    res.json({
      success: true,
      numGiri: evento.struttura_giri || 3,
      prove: evento.struttura_prove ? JSON.parse(evento.struttura_prove) : [],
      psGenerate: psResult.rows.map(ps => ({
        numero: ps.numero_ordine, nome: ps.nome_ps,
        giro: ps.is_finale ? 'finale' : ps.giro,
        gruppo: ps.gruppo_prova, isFinale: ps.is_finale
      }))
    });

  } catch (err) {
    console.error('[GET /api/eventi/:id/struttura-ps] Error:', err.message);
    next(err);
  }
});

module.exports = router;
