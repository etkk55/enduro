const router = require('express').Router();
const pool = require('../db/pool');
const { cercaEventoPerCodice } = require('../helpers/transcodification');

// MIEI TEMPI - Prestazioni pilota
router.get('/api/app/miei-tempi/:codice_accesso/:numero_pilota', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota } = req.params;

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    let evento = null;
    let pilota = null;

    for (const ev of eventiTrovati) {
      const pilotaResult = await pool.query(
        'SELECT * FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
        [ev.id, parseInt(numero_pilota)]
      );
      if (pilotaResult.rows.length > 0) {
        evento = ev;
        pilota = pilotaResult.rows[0];
        break;
      }
    }

    if (!pilota) {
      return res.status(404).json({ success: false, error: 'Pilota non trovato' });
    }

    const proveResult = await pool.query(
      'SELECT * FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
      [evento.id]
    );

    const tempiResult = await pool.query(
      `SELECT t.*, ps.nome_ps, ps.numero_ordine
       FROM tempi t
       JOIN prove_speciali ps ON t.id_ps = ps.id
       WHERE t.id_pilota = $1
       ORDER BY ps.numero_ordine`,
      [pilota.id]
    );

    const classificaResult = await pool.query(
      `SELECT p.id, p.numero_gara, p.cognome, p.nome, p.classe,
              COUNT(t.id) as ps_fatte,
              SUM(t.tempo_secondi) as tempo_totale
       FROM piloti p
       JOIN tempi t ON t.id_pilota = p.id
       WHERE p.id_evento = $1
       GROUP BY p.id
       HAVING SUM(t.tempo_secondi) > 0
       ORDER BY ps_fatte DESC, tempo_totale ASC`,
      [evento.id]
    );

    const posAssoluta = classificaResult.rows.findIndex(r => r.id === pilota.id) + 1;
    const totPiloti = classificaResult.rows.length;

    const pilotiClasse = classificaResult.rows.filter(r => r.classe === pilota.classe);
    const posClasse = pilotiClasse.findIndex(r => r.id === pilota.id) + 1;
    const totClasse = pilotiClasse.length;

    const tempoTotale = tempiResult.rows.reduce((sum, t) => sum + parseFloat(t.tempo_secondi || 0), 0);

    const formatTempo = (sec) => {
      if (!sec || sec === 0) return '--';
      const mins = Math.floor(sec / 60);
      const secs = (sec % 60).toFixed(2);
      return `${mins}:${secs.padStart(5, '0')}`;
    };

    let gapPrimo = null;
    if (classificaResult.rows.length > 0 && posAssoluta > 1) {
      const primo = classificaResult.rows[0];
      gapPrimo = `+${formatTempo(tempoTotale - parseFloat(primo.tempo_totale))}`;
    }

    res.json({
      success: true,
      pilota: {
        numero: pilota.numero_gara, nome: pilota.nome, cognome: pilota.cognome,
        classe: pilota.classe, moto: pilota.moto
      },
      posizione_assoluta: posAssoluta || '-',
      totale_piloti: totPiloti,
      posizione_classe: posClasse || '-',
      totale_classe: totClasse,
      tempo_totale: formatTempo(tempoTotale),
      gap_primo: gapPrimo,
      prove: tempiResult.rows.map(t => ({
        ps: t.numero_ordine, nome: t.nome_ps,
        tempo: formatTempo(parseFloat(t.tempo_secondi)),
        penalita: t.penalita_secondi || 0
      })),
      ultimo_aggiornamento: new Date().toISOString()
    });
  } catch (err) {
    console.error('[GET /api/app/miei-tempi] Error:', err.message);
    next(err);
  }
});

// COMUNICATI APP - Lista comunicati per codice_accesso
router.get('/api/app/comunicati/:codice_accesso', async (req, res, next) => {
  try {
    const { codice_accesso } = req.params;
    const { after, tipo } = req.query;

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    const evento = eventiTrovati[0];

    let query = `
      SELECT id, numero, ora, data, testo, tipo,
             CASE WHEN pdf_allegato IS NOT NULL THEN true ELSE false END as ha_pdf,
             pdf_nome, created_at
      FROM comunicati
      WHERE codice_gara = $1
    `;
    const params = [evento.codice_gara];
    let paramIndex = 2;

    if (tipo) {
      query += ` AND tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    if (after) {
      query += ` AND created_at > $${paramIndex}`;
      params.push(after);
    }

    query += ' ORDER BY numero DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      evento: evento.nome_evento,
      comunicati: result.rows,
      totale: result.rows.length,
      ultimo_aggiornamento: new Date().toISOString()
    });
  } catch (err) {
    console.error('[GET /api/app/comunicati] Error:', err.message);
    next(err);
  }
});

// DOWNLOAD PDF COMUNICATO (per app)
router.get('/api/app/comunicati/:codice_accesso/pdf/:id', async (req, res, next) => {
  try {
    const { codice_accesso, id } = req.params;

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    for (const evento of eventiTrovati) {
      const result = await pool.query(
        'SELECT pdf_allegato, pdf_nome FROM comunicati WHERE id = $1 AND codice_gara = $2',
        [id, evento.codice_gara]
      );

      if (result.rows.length > 0 && result.rows[0].pdf_allegato) {
        return res.json({ success: true, pdf_base64: result.rows[0].pdf_allegato, nome: result.rows[0].pdf_nome });
      }
    }

    return res.status(404).json({ success: false, error: 'PDF non trovato' });
  } catch (err) {
    console.error('[GET /api/app/comunicati/pdf] Error:', err.message);
    next(err);
  }
});

// Serve PDF come file diretto (per iOS/Safari)
router.get('/api/app/comunicati/:codice_accesso/file/:id', async (req, res, next) => {
  try {
    const { codice_accesso, id } = req.params;

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).send('Codice gara non valido');
    }

    for (const evento of eventiTrovati) {
      const result = await pool.query(
        'SELECT pdf_allegato, pdf_nome FROM comunicati WHERE id = $1 AND codice_gara = $2',
        [id, evento.codice_gara]
      );

      if (result.rows.length > 0 && result.rows[0].pdf_allegato) {
        const fileName = result.rows[0].pdf_nome || 'allegato.pdf';
        const ext = fileName.split('.').pop().toLowerCase();

        let contentType = 'application/pdf';
        if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'png') contentType = 'image/png';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'webp') contentType = 'image/webp';

        const fileBuffer = Buffer.from(result.rows[0].pdf_allegato, 'base64');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        return res.send(fileBuffer);
      }
    }

    return res.status(404).send('File non trovato');

  } catch (err) {
    console.error('[GET /api/app/comunicati/file] Error:', err.message);
    res.status(500).send('Errore server');
  }
});

// GET orari teorici per pilota specifico
router.get('/api/app/orari-teorici/:codice_gara/:numero_pilota', async (req, res, next) => {
  try {
    const { codice_gara, numero_pilota } = req.params;

    const eventiTrovati = await cercaEventoPerCodice(codice_gara);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Evento non trovato' });
    }

    let evento = null;
    let pilota = null;

    for (const ev of eventiTrovati) {
      const pilotaResult = await pool.query(
        'SELECT * FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
        [ev.id, numero_pilota]
      );

      if (pilotaResult.rows.length > 0) {
        pilota = pilotaResult.rows[0];

        const eventoResult = await pool.query(
          `SELECT e.id as evento_id, e.nome_evento, e.codice_gara, e.data_inizio,
                  ts.co1_attivo, ts.co2_attivo, ts.co3_attivo,
                  ts.tempo_par_co1, ts.tempo_co1_co2, ts.tempo_co2_co3, ts.tempo_ultimo_arr
           FROM eventi e
           LEFT JOIN tempi_settore ts ON e.id = ts.id_evento AND ts.codice_gara = $1
           WHERE e.id = $2`,
          [ev.codice_gara, ev.id]
        );

        if (eventoResult.rows.length > 0) {
          evento = eventoResult.rows[0];
        }
        break;
      }
    }

    if (!pilota || !evento) {
      return res.status(404).json({ success: false, error: 'Pilota non trovato' });
    }

    if (evento.tempo_par_co1 === null || evento.tempo_par_co1 === undefined) {
      return res.json({
        success: true,
        pilota: { numero: pilota.numero_gara, cognome: pilota.cognome, nome: pilota.nome },
        orari_configurati: false,
        messaggio: 'Tempi settore non ancora configurati'
      });
    }

    const orarioPartenza = pilota.orario_partenza || '09:00';
    const [ore, minuti] = orarioPartenza.split(':').map(Number);
    let minTotali = ore * 60 + minuti;

    const orari = { partenza: orarioPartenza };

    if (evento.co1_attivo && evento.tempo_par_co1) {
      minTotali += evento.tempo_par_co1;
      orari.co1 = `${Math.floor(minTotali / 60).toString().padStart(2, '0')}:${(minTotali % 60).toString().padStart(2, '0')}`;
    }

    if (evento.co2_attivo && evento.tempo_co1_co2) {
      minTotali += evento.tempo_co1_co2;
      orari.co2 = `${Math.floor(minTotali / 60).toString().padStart(2, '0')}:${(minTotali % 60).toString().padStart(2, '0')}`;
    }

    if (evento.co3_attivo && evento.tempo_co2_co3) {
      minTotali += evento.tempo_co2_co3;
      orari.co3 = `${Math.floor(minTotali / 60).toString().padStart(2, '0')}:${(minTotali % 60).toString().padStart(2, '0')}`;
    }

    if (evento.tempo_ultimo_arr) {
      minTotali += evento.tempo_ultimo_arr;
      orari.arrivo = `${Math.floor(minTotali / 60).toString().padStart(2, '0')}:${(minTotali % 60).toString().padStart(2, '0')}`;
    }

    res.json({
      success: true,
      pilota: { numero: pilota.numero_gara, cognome: pilota.cognome, nome: pilota.nome },
      orari_configurati: true,
      orari: orari,
      checkpoint_attivi: { co1: evento.co1_attivo, co2: evento.co2_attivo, co3: evento.co3_attivo }
    });

  } catch (err) {
    console.error('[GET /api/app/orari-teorici] Error:', err.message);
    next(err);
  }
});

module.exports = router;
