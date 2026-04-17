const router = require('express').Router();
const pool = require('../db/pool');

// GET tutti i piloti
router.get('/api/piloti', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM piloti ORDER BY id_evento, numero_gara');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET piloti per evento
router.get('/api/eventi/:id_evento/piloti', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const result = await pool.query(
      'SELECT * FROM piloti WHERE id_evento = $1 ORDER BY numero_gara',
      [id_evento]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST crea pilota
router.post('/api/piloti', async (req, res, next) => {
  try {
    const { numero_gara, nome, cognome, team, nazione, id_evento, classe, moto } = req.body;
    const result = await pool.query(
      'INSERT INTO piloti (numero_gara, nome, cognome, team, nazione, id_evento, classe, moto) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [numero_gara, nome, cognome, team, nazione, id_evento, classe, moto]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE pilota
router.delete('/api/piloti/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM piloti WHERE id = $1', [id]);
    res.json({ message: 'Pilota eliminato' });
  } catch (err) {
    next(err);
  }
});

// DELETE tutti piloti di un evento
router.delete('/api/eventi/:id_evento/piloti', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const result = await pool.query('DELETE FROM piloti WHERE id_evento = $1', [id_evento]);
    res.json({
      message: `Eliminati ${result.rowCount} piloti`,
      count: result.rowCount
    });
  } catch (err) {
    next(err);
  }
});

// Recupera PIN pilota per SOS (solo per DdG)
router.get('/api/eventi/:id_evento/pilota/:numero/pin', async (req, res, next) => {
  try {
    const { id_evento, numero } = req.params;

    const eventoResult = await pool.query(
      'SELECT codice_accesso FROM eventi WHERE id = $1',
      [id_evento]
    );

    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const codiceAccesso = eventoResult.rows[0].codice_accesso;

    const result = await pool.query(
      `SELECT p.numero_gara, p.cognome, p.nome, p.licenza_fmi, p.anno_nascita
       FROM piloti p
       JOIN eventi e ON p.id_evento = e.id
       WHERE e.codice_accesso = $1 AND p.numero_gara = $2
       LIMIT 1`,
      [codiceAccesso, numero]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pilota non trovato' });
    }

    const pilota = result.rows[0];
    const licenza = pilota.licenza_fmi || '';
    const anno = String(pilota.anno_nascita || '');

    if (!licenza || !anno) {
      return res.status(400).json({ error: 'Dati licenza o anno mancanti per questo pilota' });
    }

    const pin = licenza.slice(-4) + anno.slice(-2);

    res.json({
      numero: pilota.numero_gara,
      cognome: pilota.cognome,
      nome: pilota.nome,
      pin: pin
    });
  } catch (err) {
    next(err);
  }
});

// Import piloti da FICR startlist
router.post('/api/eventi/:id_evento/import-piloti-ficr', async (req, res, next) => {
  try {
    const { id_evento } = req.params;

    const eventoRes = await pool.query('SELECT * FROM eventi WHERE id = $1', [id_evento]);
    if (eventoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    const evento = eventoRes.rows[0];

    const anno = evento.ficr_anno || new Date().getFullYear();
    const equipe = evento.ficr_codice_equipe;
    const manif = evento.ficr_manifestazione;
    const categoriaFicr = evento.ficr_categoria || 1;

    if (!equipe || !manif) {
      return res.status(400).json({
        error: 'Parametri FICR non configurati. Configura Anno, Codice Equipe e Manifestazione.'
      });
    }

    const ficrUrl = `https://apienduro.ficr.it/END/mpcache-20/get/startlist/${anno}/${equipe}/${manif}/${categoriaFicr}/1/1/*/*/*/*/*`;
    console.log('Import piloti FICR URL:', ficrUrl);

    const response = await fetch(ficrUrl);
    if (!response.ok) {
      return res.status(502).json({ error: `Errore API FICR: ${response.status}` });
    }

    const jsonResponse = await response.json();
    const startlist = jsonResponse.data || jsonResponse;

    if (!startlist || !Array.isArray(startlist) || startlist.length === 0) {
      return res.json({
        message: 'Nessun pilota trovato nella startlist FICR',
        created: 0,
        updated: 0
      });
    }

    let created = 0;
    let updated = 0;

    for (const pilota of startlist) {
      const numeroGara = pilota.Numero;
      const cognome = pilota.Cognome;
      const nome = pilota.Nome;
      const classe = pilota.Classe || '';
      const moto = pilota.Moto || '';
      const team = pilota.Scuderia || pilota.Motoclub || '';
      const orarioPartenza = pilota.Orario || null;
      const licenza = pilota.co_Licenza || null;
      const annoNascita = pilota.co_AnnoConduttore || null;

      const existingRes = await pool.query(
        'SELECT id FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
        [id_evento, numeroGara]
      );

      if (existingRes.rows.length > 0) {
        await pool.query(`
          UPDATE piloti SET
            cognome = $1, nome = $2, classe = $3, moto = $4, team = $5, orario_partenza = $6, licenza_fmi = $7, anno_nascita = $8
          WHERE id_evento = $9 AND numero_gara = $10
        `, [cognome, nome, classe, moto, team, orarioPartenza, licenza, annoNascita, id_evento, numeroGara]);
        updated++;
      } else {
        await pool.query(`
          INSERT INTO piloti (id_evento, numero_gara, cognome, nome, classe, moto, team, orario_partenza, licenza_fmi, anno_nascita)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [id_evento, numeroGara, cognome, nome, classe, moto, team, orarioPartenza, licenza, annoNascita]);
        created++;
      }
    }

    res.json({
      message: `Import completato: ${created} creati, ${updated} aggiornati`,
      created,
      updated,
      total: startlist.length
    });

  } catch (err) {
    console.error('Errore import piloti FICR:', err);
    next(err);
  }
});

// Cancella piloti da TUTTE le gare fratelle
router.delete('/api/eventi/:id_evento/piloti-tutte', async (req, res, next) => {
  try {
    const { id_evento } = req.params;

    const eventoRes = await pool.query(
      'SELECT ficr_anno, ficr_codice_equipe, ficr_manifestazione FROM eventi WHERE id = $1',
      [id_evento]
    );
    if (eventoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const { ficr_anno, ficr_codice_equipe, ficr_manifestazione } = eventoRes.rows[0];

    const gareFratelleRes = await pool.query(
      `SELECT id, codice_gara FROM eventi
       WHERE ficr_anno = $1 AND ficr_codice_equipe = $2 AND ficr_manifestazione = $3`,
      [ficr_anno, ficr_codice_equipe, ficr_manifestazione]
    );

    const risultati = {};
    let totale = 0;

    for (const gara of gareFratelleRes.rows) {
      const deleteRes = await pool.query('DELETE FROM piloti WHERE id_evento = $1', [gara.id]);
      risultati[gara.codice_gara] = deleteRes.rowCount;
      totale += deleteRes.rowCount;
    }

    res.json({
      success: true,
      message: `Eliminati ${totale} piloti da tutte le gare`,
      risultati,
      totale
    });

  } catch (err) {
    console.error('[DELETE-PILOTI-TUTTE] Errore:', err);
    next(err);
  }
});

// Import completo da FICR (entrylist + startlist) per una categoria specifica
router.post('/api/eventi/:id_evento/import-completo-ficr', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const { categoria } = req.body;

    if (!categoria) {
      return res.status(400).json({ error: 'Categoria richiesta (1, 2 o 3)' });
    }

    const eventoRes = await pool.query('SELECT * FROM eventi WHERE id = $1', [id_evento]);
    if (eventoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    const evento = eventoRes.rows[0];

    const anno = evento.ficr_anno || new Date().getFullYear();
    const equipe = evento.ficr_codice_equipe;
    const manif = evento.ficr_manifestazione;

    if (!equipe || !manif) {
      return res.status(400).json({
        error: 'Parametri FICR non configurati. Configura Anno, Codice Equipe e Manifestazione prima di importare.'
      });
    }

    console.log(`[IMPORT-FICR] Evento ${id_evento}, Categoria ${categoria}, FICR: ${anno}/${equipe}/${manif}`);

    const entrylistUrl = `https://apienduro.ficr.it/END/mpcache-30/get/entrylist/${anno}/${equipe}/${manif}/${categoria}/*/*/*/*/*/*/*`;
    console.log('[IMPORT-FICR] Chiamata entrylist:', entrylistUrl);

    const entrylistRes = await fetch(entrylistUrl);
    if (!entrylistRes.ok) {
      return res.status(502).json({ error: `Errore API FICR entrylist: ${entrylistRes.status}` });
    }
    const entrylistJson = await entrylistRes.json();
    const entrylist = entrylistJson.data || entrylistJson;

    const startlistUrl = `https://apienduro.ficr.it/END/mpcache-20/get/startlist/${anno}/${equipe}/${manif}/${categoria}/1/1/*/*/*/*/*`;
    console.log('[IMPORT-FICR] Chiamata startlist:', startlistUrl);

    let startlist = [];
    try {
      const startlistRes = await fetch(startlistUrl);
      if (startlistRes.ok) {
        const startlistJson = await startlistRes.json();
        startlist = startlistJson.data || startlistJson;
      }
    } catch (e) {
      console.log('[IMPORT-FICR] Startlist non disponibile:', e.message);
    }

    const orariMap = {};
    if (Array.isArray(startlist)) {
      for (const p of startlist) {
        if (p.Numero && p.Orario) {
          orariMap[p.Numero] = p.Orario;
        }
      }
    }

    console.log(`[IMPORT-FICR] Entrylist: ${entrylist?.length || 0} piloti, Startlist: ${Object.keys(orariMap).length} orari`);

    if (!entrylist || !Array.isArray(entrylist) || entrylist.length === 0) {
      return res.json({
        success: true,
        message: 'Nessun pilota trovato nella entrylist FICR per questa categoria',
        created: 0,
        updated: 0
      });
    }

    let created = 0;
    let updated = 0;

    for (const pilota of entrylist) {
      const numeroGara = pilota.Numero;
      const cognome = pilota.Cognome || '';
      const nome = pilota.Nome || '';
      const classe = pilota.Classe || '';
      const moto = pilota.Moto || '';
      const team = pilota.Scuderia || pilota.MotoClub || '';
      const orarioPartenza = orariMap[numeroGara] || null;

      if (!numeroGara) continue;

      const existingRes = await pool.query(
        'SELECT id FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
        [id_evento, numeroGara]
      );

      if (existingRes.rows.length > 0) {
        await pool.query(`
          UPDATE piloti SET
            cognome = $1, nome = $2, classe = $3, moto = $4, team = $5, orario_partenza = $6
          WHERE id_evento = $7 AND numero_gara = $8
        `, [cognome, nome, classe, moto, team, orarioPartenza, id_evento, numeroGara]);
        updated++;
      } else {
        await pool.query(`
          INSERT INTO piloti (id_evento, numero_gara, cognome, nome, classe, moto, team, orario_partenza)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [id_evento, numeroGara, cognome, nome, classe, moto, team, orarioPartenza]);
        created++;
      }
    }

    const orariMsg = Object.keys(orariMap).length > 0 ? ` (${Object.keys(orariMap).length} con orario)` : ' (orari non ancora disponibili)';

    res.json({
      success: true,
      message: `Import completato: ${created} creati, ${updated} aggiornati${orariMsg}`,
      created,
      updated,
      total: entrylist.length,
      orari_disponibili: Object.keys(orariMap).length
    });

  } catch (err) {
    console.error('[IMPORT-FICR] Errore:', err);
    next(err);
  }
});

module.exports = router;
