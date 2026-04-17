const router = require('express').Router();
const pool = require('../db/pool');
const axios = require('axios');
const config = require('../config');
const { FICR_HEADERS, FICR_BASE_URL } = require('../helpers/ficrClient');

// GET lista manifestazioni FICR
router.get('/api/ficr/manifestazioni', async (req, res, next) => {
  try {
    const anno = req.query.anno || new Date().getFullYear();
    const url = `${FICR_BASE_URL}/END/mpcache-30/get/schedule/${anno}/*/*`;
    const response = await axios.get(url, { headers: FICR_HEADERS });
    const gare = response.data?.data || response.data;
    res.json(gare);
  } catch (err) {
    next(err);
  }
});

// GET calendario gare FICR per anno
router.get('/api/ficr/gare/:anno', async (req, res, next) => {
  try {
    const { anno } = req.params;
    const url = `${FICR_BASE_URL}/END/mpcache-30/get/schedule/${anno}/*/*`;
    const response = await axios.get(url, { headers: FICR_HEADERS });
    res.json(response.data);
  } catch (err) {
    console.error('[GET /api/ficr/gare/:anno] Error:', err.message);
    next(err);
  }
});

// GET categorie per una manifestazione FICR
router.get('/api/ficr/categorie/:anno/:equipe/:manifestazione', async (req, res, next) => {
  try {
    const { anno, equipe, manifestazione } = req.params;
    const url = `${FICR_BASE_URL}/END/mpcache-60/get/gare/${anno}/${equipe}/${manifestazione}`;
    console.log('[FICR categorie] Fetching:', url);

    const response = await axios.get(url, { headers: FICR_HEADERS });

    if (response.data?.status && response.data?.data) {
      const categorie = response.data.data.map(c => ({
        id: c.Gara,
        nome: c.Descr || `Categoria ${c.Gara}`
      }));
      res.json({ success: true, categorie });
    } else {
      res.json({ success: true, categorie: [] });
    }
  } catch (err) {
    console.error('[GET /api/ficr/categorie] Error:', err.message);
    next(err);
  }
});

// POST import piloti da XML FMI
router.post('/api/eventi/:id_evento/import-xml', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const { piloti } = req.body;

    if (!piloti || !Array.isArray(piloti) || piloti.length === 0) {
      return res.status(400).json({ error: 'Nessun pilota nel payload' });
    }

    const evRes = await pool.query('SELECT id FROM eventi WHERE id = $1', [id_evento]);
    if (evRes.rows.length === 0) return res.status(404).json({ error: 'Evento non trovato' });

    let importati = 0;
    let aggiornati = 0;

    for (const p of piloti) {
      const check = await pool.query(
        'SELECT id FROM piloti WHERE id_evento = $1 AND (licenza_fmi = $2 OR numero_gara = $3)',
        [id_evento, p.licenza || null, p.ngara || null]
      );
      if (check.rows.length > 0) {
        await pool.query(
          `UPDATE piloti SET nome=$1, cognome=$2, numero_gara=$3, classe=$4, moto=$5, team=$6, nazione=$7, licenza_fmi=$8, anno_nascita=$9 WHERE id=$10`,
          [p.nome, p.cognome, p.ngara || null, p.classe || null, p.motociclo || null, p.motoclub || null, p.nazionalita || 'ITA', p.licenza || null, p.anno_nascita ? parseInt(p.anno_nascita) : null, check.rows[0].id]
        );
        aggiornati++;
      } else {
        await pool.query(
          `INSERT INTO piloti (nome, cognome, numero_gara, classe, moto, team, nazione, id_evento, licenza_fmi, anno_nascita) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [p.nome, p.cognome, p.ngara || null, p.classe || null, p.motociclo || null, p.motoclub || null, p.nazionalita || 'ITA', id_evento, p.licenza || null, p.anno_nascita ? parseInt(p.anno_nascita) : null]
        );
        importati++;
      }
    }

    res.json({ importati, aggiornati, totale: importati + aggiornati });
  } catch (err) {
    console.error('[import-xml] ERRORE:', err.message);
    next(err);
  }
});

// POST import piloti da FICR
router.post('/api/ficr/import-piloti', async (req, res, next) => {
  try {
    const { id_evento, anno, id_manif, id_prova } = req.body;

    const evRes = await pool.query('SELECT codice_gara, ficr_categoria FROM eventi WHERE id = $1', [id_evento]);
    if (evRes.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    const codice_gara = evRes.rows[0].codice_gara;
    const num_gara = evRes.rows[0].ficr_categoria || 1;

    const url = `${FICR_BASE_URL}/END/mpcache-30/get/entrylist/${anno}/${id_manif}/${id_prova}/${num_gara}/*/*/*/*/*`;
    console.log('[import-piloti] URL:', url);
    console.log('[import-piloti] codice_gara:', codice_gara, '-> num_gara:', num_gara);
    const response = await fetch(url, { headers: FICR_HEADERS });
    console.log('[import-piloti] FICR status:', response.status);
    if (!response.ok) {
      const errText = await response.text();
      console.log('[import-piloti] FICR error body:', errText.substring(0, 200));
      return res.status(404).json({ error: `FICR risponde: ${response.status}` });
    }
    const ficr_data = await response.json();
    console.log('[import-piloti] FICR response:', JSON.stringify(ficr_data).substring(0, 300));

    if (!ficr_data?.data || ficr_data.data.length === 0) {
      return res.status(404).json({ error: 'Nessun pilota trovato' });
    }

    const piloti = ficr_data.data;
    let pilotiImportati = 0;
    let pilotiAggiornati = 0;

    for (const pilotaFICR of piloti) {
      const checkResult = await pool.query(
        'SELECT id FROM piloti WHERE numero_gara = $1 AND id_evento = $2',
        [pilotaFICR.Numero, id_evento]
      );

      if (checkResult.rows.length > 0) {
        await pool.query(
          `UPDATE piloti SET
            nome = $1, cognome = $2, team = $3, nazione = $4, classe = $5, moto = $6
           WHERE id = $7`,
          [pilotaFICR.Nome, pilotaFICR.Cognome, pilotaFICR.Motoclub || '', pilotaFICR.Naz || '', pilotaFICR.Classe || '', pilotaFICR.Moto || '', checkResult.rows[0].id]
        );
        pilotiAggiornati++;
      } else {
        await pool.query(
          `INSERT INTO piloti (numero_gara, nome, cognome, team, nazione, id_evento, classe, moto)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [pilotaFICR.Numero, pilotaFICR.Nome, pilotaFICR.Cognome, pilotaFICR.Motoclub || '', pilotaFICR.Naz || '', id_evento, pilotaFICR.Classe || '', pilotaFICR.Moto || '']
        );
        pilotiImportati++;
      }
    }

    res.json({ success: true, pilotiImportati, pilotiAggiornati, totale: piloti.length });
  } catch (err) {
    console.error('[import-piloti] ERRORE:', err.message, err.stack);
    next(err);
  }
});

// POST import tempi da FICR
router.post('/api/ficr/import-tempi', async (req, res, next) => {
  try {
    const { id_ps, anno, id_manif, id_prova, giorno_prova, numero_prova } = req.body;

    const url = `${FICR_BASE_URL}/END/mpcache-5/get/clasps/${anno}/${id_manif}/${id_prova}/${giorno_prova}/${numero_prova}/1/*/*/*/*/*`;
    const response = await axios.get(url);

    if (!response.data?.data?.clasdella) {
      return res.status(404).json({ error: 'Nessun tempo trovato' });
    }

    const tempi = response.data.data.clasdella;
    let tempiImportati = 0;

    const provaResult = await pool.query('SELECT id_evento FROM prove_speciali WHERE id = $1', [id_ps]);
    if (provaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prova non trovata' });
    }
    const id_evento = provaResult.rows[0].id_evento;

    for (const tempoFICR of tempi) {
      const pilotaResult = await pool.query(
        'SELECT id FROM piloti WHERE numero_gara = $1 AND id_evento = $2',
        [tempoFICR.Numero, id_evento]
      );

      if (pilotaResult.rows.length === 0) continue;

      const id_pilota = pilotaResult.rows[0].id;
      const tempoStr = tempoFICR.Tempo;

      if (!tempoStr) continue;

      const match = tempoStr.match(/(\d+)'(\d+\.\d+)/);
      if (!match) continue;

      const tempoSecondi = parseInt(match[1]) * 60 + parseFloat(match[2]);

      await pool.query(
        `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (id_pilota, id_ps)
         DO UPDATE SET tempo_secondi = $3`,
        [id_pilota, id_ps, tempoSecondi]
      );

      tempiImportati++;
    }

    res.json({ success: true, tempiImportati });
  } catch (err) {
    next(err);
  }
});

// POST import TUTTI i tempi archiviati da FICR per un evento
router.post('/api/eventi/:id/import-tempi-archiviati', async (req, res, next) => {
  const { id } = req.params;

  try {
    console.log(`[IMPORT-TEMPI] Inizio import per evento ${id}`);

    const eventoResult = await pool.query('SELECT * FROM eventi WHERE id = $1', [id]);
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const evento = eventoResult.rows[0];
    const { ficr_anno, ficr_codice_equipe, ficr_manifestazione } = evento;

    if (!ficr_anno || !ficr_codice_equipe || !ficr_manifestazione) {
      return res.status(400).json({ error: 'Parametri FICR mancanti (anno, equipe, manifestazione)' });
    }

    const categoriaFicr = evento.ficr_categoria || 1;

    const proveResult = await pool.query(
      'SELECT id, nome_ps, numero_ordine FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
      [id]
    );

    if (proveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nessuna prova speciale trovata' });
    }

    const pilotiResult = await pool.query(
      'SELECT id, numero_gara FROM piloti WHERE id_evento = $1',
      [id]
    );

    const pilotiMap = {};
    pilotiResult.rows.forEach(p => { pilotiMap[p.numero_gara] = p.id; });

    let totaleTempi = 0;
    const risultatiProve = [];

    for (const prova of proveResult.rows) {
      const numeroOrdine = prova.numero_ordine;
      const url = `${FICR_BASE_URL}/END/mpcache-5/get/clasps/${ficr_anno}/${ficr_codice_equipe}/${ficr_manifestazione}/${categoriaFicr}/${numeroOrdine}/1/*/*/*/*/*`;

      try {
        const response = await axios.get(url);

        if (!response.data?.data?.clasdella || response.data.data.clasdella.length === 0) {
          risultatiProve.push({ prova: prova.nome_ps, tempi: 0, status: 'empty' });
          continue;
        }

        const tempiFicr = response.data.data.clasdella;
        let tempiProva = 0;

        for (const tempoFICR of tempiFicr) {
          const idPilota = pilotiMap[tempoFICR.Numero];
          if (!idPilota || !tempoFICR.Tempo) continue;

          const match = tempoFICR.Tempo.match(/(\d+)'(\d+\.\d+)/);
          if (!match) continue;

          const tempoSecondi = parseInt(match[1]) * 60 + parseFloat(match[2]);
          if (tempoSecondi === 0) continue;

          await pool.query(
            `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (id_pilota, id_ps)
             DO UPDATE SET tempo_secondi = $3`,
            [idPilota, prova.id, tempoSecondi]
          );

          tempiProva++;
        }

        risultatiProve.push({ prova: prova.nome_ps, tempi: tempiProva, status: 'ok' });
        totaleTempi += tempiProva;

      } catch (err) {
        console.error(`[IMPORT-TEMPI] Errore ${prova.nome_ps}:`, err.message);
        risultatiProve.push({ prova: prova.nome_ps, tempi: 0, status: 'error', error: err.message });
      }
    }

    res.json({ success: true, evento: evento.nome_evento, tempiTotali: totaleTempi, prove: risultatiProve });

  } catch (err) {
    console.error('[IMPORT-TEMPI] Errore generale:', err.message);
    next(err);
  }
});

// POLL FICR LIVE - Importa tempi per TUTTE le gare fratelle
router.post('/api/eventi/:id/poll-ficr-live', async (req, res, next) => {
  const { id } = req.params;

  try {
    const eventoResult = await pool.query('SELECT * FROM eventi WHERE id = $1', [id]);
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    const evento = eventoResult.rows[0];

    if (!evento.ficr_anno || !evento.ficr_codice_equipe || !evento.ficr_manifestazione) {
      return res.status(400).json({ error: 'Parametri FICR mancanti' });
    }

    const gareFratelleRes = await pool.query(
      `SELECT * FROM eventi
       WHERE ficr_anno = $1 AND ficr_codice_equipe = $2 AND ficr_manifestazione = $3
       ORDER BY ficr_categoria`,
      [evento.ficr_anno, evento.ficr_codice_equipe, evento.ficr_manifestazione]
    );
    const gareFratelle = gareFratelleRes.rows;

    console.log(`[POLL-FICR-LIVE] Aggiornamento gare: ${gareFratelle.map(g => g.codice_gara).join(', ')}`);

    const risultati = {};
    let totaleTempi = 0;

    for (const gara of gareFratelle) {
      const categoriaFicr = gara.ficr_categoria || 1;

      let proveResult = await pool.query(
        'SELECT id, nome_ps, numero_ordine FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
        [gara.id]
      );

      if (proveResult.rows.length === 0) {
        console.log(`[POLL-FICR-LIVE] ${gara.codice_gara}: nessuna prova, tento creazione da FICR listps`);
        try {
          const listpsUrl = `${FICR_BASE_URL}/END/mpcache-30/get/listps/${gara.ficr_anno}/${gara.ficr_codice_equipe}/${gara.ficr_manifestazione}/${categoriaFicr}`;
          const listpsRes = await axios.get(listpsUrl, { timeout: 5000 });
          const listpsData = listpsRes.data?.data || [];

          for (const ps of listpsData) {
            const nomeMatch = ps.Descr?.match(/''([^']+)''/);
            const nomePista = nomeMatch ? nomeMatch[1] : '';
            const nomePs = nomePista ? `${ps.Sigla} ${nomePista}` : (ps.Sigla || `PS${ps.Rilevazione}`);
            await pool.query(
              `INSERT INTO prove_speciali (nome_ps, numero_ordine, id_evento, stato)
               VALUES ($1, $2, $3, 'non_iniziata')
               ON CONFLICT DO NOTHING`,
              [nomePs, ps.Rilevazione, gara.id]
            );
          }

          proveResult = await pool.query(
            'SELECT id, nome_ps, numero_ordine FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
            [gara.id]
          );
        } catch(e) {
          console.log(`[POLL-FICR-LIVE] ${gara.codice_gara}: listps non disponibile - ${e.message}`);
        }

        if (proveResult.rows.length === 0) {
          risultati[gara.codice_gara] = { tempi: 0, status: 'no_prove' };
          continue;
        }
      }

      const pilotiResult = await pool.query(
        'SELECT id, numero_gara FROM piloti WHERE id_evento = $1',
        [gara.id]
      );
      const pilotiMap = {};
      pilotiResult.rows.forEach(p => { pilotiMap[p.numero_gara] = p.id; });

      let tempiGara = 0;

      for (const prova of proveResult.rows) {
        const url = `${FICR_BASE_URL}/END/mpcache-5/get/clasps/${gara.ficr_anno}/${gara.ficr_codice_equipe}/${gara.ficr_manifestazione}/${categoriaFicr}/${prova.numero_ordine}/1/*/*/*/*/*`;

        try {
          const response = await axios.get(url, { timeout: 5000 });
          const tempiFicr = response.data?.data?.clasdella || [];

          for (const t of tempiFicr) {
            const idPilota = pilotiMap[t.Numero];
            if (!idPilota || !t.Tempo) continue;

            const match = t.Tempo.match(/(\d+)'(\d+\.\d+)/);
            if (!match) continue;

            const tempoSecondi = parseInt(match[1]) * 60 + parseFloat(match[2]);
            if (tempoSecondi === 0) continue;

            await pool.query(
              `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
               VALUES ($1, $2, $3, 0)
               ON CONFLICT (id_pilota, id_ps)
               DO UPDATE SET tempo_secondi = $3`,
              [idPilota, prova.id, tempoSecondi]
            );
            tempiGara++;
          }
        } catch (e) {
          console.log(`[POLL-FICR-LIVE] ${gara.codice_gara} PS${prova.numero_ordine}: ${e.message}`);
        }
      }

      risultati[gara.codice_gara] = { tempi: tempiGara, status: 'ok' };
      totaleTempi += tempiGara;
    }

    console.log(`[POLL-FICR-LIVE] Completato: ${totaleTempi} tempi totali`);
    res.json({ success: true, totaleTempi, risultati, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('[POLL-FICR-LIVE] Errore:', err);
    next(err);
  }
});

// Import FICR per TUTTE le gare fratelle (3 modalita)
router.post('/api/eventi/:id_evento/import-ficr-tutte', async (req, res, next) => {
  try {
    const { id_evento } = req.params;
    const { modalita } = req.body;

    if (!['program', 'entrylist', 'startlist'].includes(modalita)) {
      return res.status(400).json({ error: 'Modalita non valida. Usa: program, entrylist, startlist' });
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
        error: 'Parametri FICR non configurati. Configura Anno, Codice Equipe e Manifestazione.'
      });
    }

    const gareFratelleRes = await pool.query(
      `SELECT * FROM eventi
       WHERE ficr_anno = $1 AND ficr_codice_equipe = $2 AND ficr_manifestazione = $3
       ORDER BY ficr_categoria`,
      [anno, equipe, manif]
    );
    const gareFratelle = gareFratelleRes.rows;

    console.log(`[IMPORT-FICR-TUTTE] Modalita: ${modalita}, Gare fratelle: ${gareFratelle.map(g => g.codice_gara).join(', ')}`);

    const risultati = {};

    for (const gara of gareFratelle) {
      const categoria = gara.ficr_categoria || 1;

      let apiUrl;
      let pilotiData = [];

      try {
        if (modalita === 'program') {
          apiUrl = `https://apienduro.ficr.it/END/mpcache-30/get/entrylist/${anno}/${equipe}/${manif}/${categoria}/*/*/*/*/*/*/*`;
        } else if (modalita === 'entrylist') {
          apiUrl = `https://apienduro.ficr.it/END/mpcache-30/get/entrylist/${anno}/${equipe}/${manif}/${categoria}/*/*/*/*/*/*/*`;
        } else {
          apiUrl = `https://apienduro.ficr.it/END/mpcache-20/get/startlist/${anno}/${equipe}/${manif}/${categoria}/1/1/*/*/*/*/*`;
        }

        const apiRes = await fetch(apiUrl);
        if (apiRes.ok) {
          const jsonResponse = await apiRes.json();
          pilotiData = jsonResponse.data || jsonResponse;
          if (!Array.isArray(pilotiData)) pilotiData = [];
        }
      } catch (e) {
        console.log(`[IMPORT-FICR-TUTTE] Errore API per ${gara.codice_gara}:`, e.message);
      }

      if (!Array.isArray(pilotiData) || pilotiData.length === 0) {
        risultati[gara.codice_gara] = { created: 0, updated: 0, message: 'Nessun dato disponibile' };
        continue;
      }

      let created = 0;
      let updated = 0;

      for (const pilota of pilotiData) {
        const numeroGara = pilota.Numero;
        const cognome = pilota.Cognome || '';
        const nome = pilota.Nome || '';
        const classe = pilota.Classe || '';
        const moto = pilota.Moto || '';
        const team = pilota.Motoclub || pilota.Scuderia || pilota.MotoClub || '';
        const orarioPartenza = pilota.Orario || null;
        const licenza = pilota.co_Licenza || pilota.Licenza || pilota.NumTessera || null;
        const annoNascita = pilota.co_AnnoConduttore || pilota.AnnoConduttore || pilota.AnnoNascita || null;

        if (!numeroGara) continue;

        const existingRes = await pool.query(
          'SELECT id FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
          [gara.id, numeroGara]
        );

        if (existingRes.rows.length > 0) {
          if (modalita === 'startlist') {
            await pool.query(
              'UPDATE piloti SET orario_partenza = $1 WHERE id_evento = $2 AND numero_gara = $3',
              [orarioPartenza, gara.id, numeroGara]
            );
          } else {
            await pool.query(`
              UPDATE piloti SET
                cognome = $1, nome = $2, classe = $3, moto = $4, team = $5, orario_partenza = COALESCE($6, orario_partenza),
                licenza_fmi = COALESCE($7, licenza_fmi), anno_nascita = COALESCE($8, anno_nascita)
              WHERE id_evento = $9 AND numero_gara = $10
            `, [cognome, nome, classe, moto, team, orarioPartenza, licenza, annoNascita, gara.id, numeroGara]);
          }
          updated++;
        } else {
          await pool.query(`
            INSERT INTO piloti (id_evento, numero_gara, cognome, nome, classe, moto, team, orario_partenza, licenza_fmi, anno_nascita)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [gara.id, numeroGara, cognome, nome, classe, moto, team, orarioPartenza, licenza, annoNascita]);
          created++;
        }
      }

      // DOPO import da entrylist/program, recupera licenza e anno da startlist
      if (modalita === 'program' || modalita === 'entrylist') {
        try {
          const startlistUrl = `https://apienduro.ficr.it/END/mpcache-20/get/startlist/${anno}/${equipe}/${manif}/${categoria}/1/1/*/*/*/*/*`;
          const startlistRes = await fetch(startlistUrl);
          if (startlistRes.ok) {
            const startlistJson = await startlistRes.json();
            const startlistData = startlistJson.data || [];

            let licenzeAggiornate = 0;
            for (const p of startlistData) {
              const lic = p.co_Licenza || null;
              const annoN = p.co_AnnoConduttore || null;

              if (p.Numero && (lic || annoN)) {
                await pool.query(`
                  UPDATE piloti SET
                    licenza_fmi = COALESCE($1, licenza_fmi),
                    anno_nascita = COALESCE($2, anno_nascita),
                    orario_partenza = COALESCE($3, orario_partenza)
                  WHERE id_evento = $4 AND numero_gara = $5
                `, [lic, annoN, p.Orario || null, gara.id, p.Numero]);
                licenzeAggiornate++;
              }
            }
            console.log(`[IMPORT-FICR-TUTTE] ${gara.codice_gara}: ${licenzeAggiornate} licenze/anni aggiornati da startlist`);
          }
        } catch (e) {
          console.log(`[IMPORT-FICR-TUTTE] Startlist non disponibile per ${gara.codice_gara}:`, e.message);
        }
      }

      risultati[gara.codice_gara] = { created, updated, total: pilotiData.length };
    }

    let totCreated = 0, totUpdated = 0;
    Object.values(risultati).forEach(r => {
      totCreated += r.created || 0;
      totUpdated += r.updated || 0;
    });

    res.json({
      success: true,
      modalita,
      risultati,
      totali: { created: totCreated, updated: totUpdated },
      message: `Import ${modalita}: ${totCreated} creati, ${totUpdated} aggiornati`
    });

  } catch (err) {
    console.error('[IMPORT-FICR-TUTTE] Errore:', err);
    next(err);
  }
});

// IMPORT FICR GENERICO
router.post('/api/import-ficr', async (req, res, next) => {
  try {
    const { anno, codiceEquipe, manifestazione, giorno, prova, categoria, id_evento, id_ps } = req.body;

    if (!anno || !codiceEquipe || !manifestazione || !categoria || !id_evento || !id_ps) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const url = `${FICR_BASE_URL}/END/mpcache-5/get/clasps/${anno}/${codiceEquipe}/${manifestazione}/${categoria}/${prova}/1/*/*/*/*/*`;

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://enduro.ficr.it',
      'Referer': 'https://enduro.ficr.it/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      'Cache-Control': 'Private',
      'Pragma': 'no-cache'
    };

    const response = await axios.get(url, { headers });
    const dati = response.data?.data?.clasdella || [];

    if (!dati || !Array.isArray(dati) || dati.length === 0) {
      return res.status(404).json({ error: 'Nessun dato trovato da FICR' });
    }

    let pilotiImportati = 0;
    let tempiImportati = 0;

    for (const record of dati) {
      try {
        const numeroGara = parseInt(record.Numero);
        const cognome = record.Cognome || '';
        const nome = record.Nome || '';
        const classe = record.Classe || '';
        const moto = record.Moto || '';
        const team = record.Motoclub || '';
        const nazione = record.Naz || 'ITA';

        let pilotaResult = await pool.query(
          'SELECT id FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
          [id_evento, numeroGara]
        );

        let pilotaId;
        if (pilotaResult.rows.length === 0) {
          const insertResult = await pool.query(
            `INSERT INTO piloti (id_evento, numero_gara, cognome, nome, classe, moto, team, nazione)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [id_evento, numeroGara, cognome, nome, classe, moto, team, nazione]
          );
          pilotaId = insertResult.rows[0].id;
          pilotiImportati++;
        } else {
          pilotaId = pilotaResult.rows[0].id;
        }

        const tempoStr = record.Tempo;
        if (tempoStr && tempoStr.includes("'")) {
          const match = tempoStr.match(/(\d+)'(\d+\.\d+)/);
          if (match) {
            const tempoSecondi = parseInt(match[1]) * 60 + parseFloat(match[2]);
            await pool.query(
              `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
               VALUES ($1, $2, $3, 0)
               ON CONFLICT (id_pilota, id_ps) DO UPDATE SET tempo_secondi = $3`,
              [pilotaId, id_ps, tempoSecondi]
            );
            tempiImportati++;
          }
        }
      } catch (err) {
        console.error(`[IMPORT] Errore import record:`, err.message);
      }
    }

    res.json({ success: true, piloti_importati: pilotiImportati, tempi_importati: tempiImportati, totale_record: dati.length });

  } catch (err) {
    console.error('[IMPORT] Errore:', err.message);
    next(err);
  }
});

// IMPORT XML ISCRITTI (da Comitato Enduro)
router.post('/api/import-xml-iscritti', async (req, res, next) => {
  try {
    const { id_evento, xml_content } = req.body;

    if (!id_evento || !xml_content) {
      return res.status(400).json({ error: 'Parametri mancanti: id_evento e xml_content richiesti' });
    }

    const eventoRes = await pool.query('SELECT codice_gara FROM eventi WHERE id = $1', [id_evento]);
    const codiceGara = eventoRes.rows[0]?.codice_gara || '';
    const isTraining = codiceGara.includes('-2');
    const isEpoca = codiceGara.includes('-3');

    let xmlText = xml_content;
    if (xml_content.includes('base64,')) {
      xmlText = Buffer.from(xml_content.split('base64,')[1], 'base64').toString('utf-8');
    } else if (!xml_content.includes('<')) {
      try {
        xmlText = Buffer.from(xml_content, 'base64').toString('utf-8');
      } catch (e) {
        // Non e base64, usa cosi com'e
      }
    }

    const conduttoriMatch = xmlText.match(/<conduttore>[\s\S]*?<\/conduttore>/g);

    if (!conduttoriMatch || conduttoriMatch.length === 0) {
      return res.status(400).json({ error: 'Nessun conduttore trovato nel file XML' });
    }

    let pilotiImportati = 0;
    let pilotiAggiornati = 0;
    let pilotiSaltati = 0;
    let errori = [];

    for (const conduttoreXml of conduttoriMatch) {
      try {
        const getField = (field) => {
          const match = conduttoreXml.match(new RegExp(`<${field}>([^<]*)</${field}>`));
          return match ? match[1].trim() : '';
        };

        const ngara = parseInt(getField('ngara')) || null;
        const cognome = getField('cognome');
        const nome = getField('nome');
        const licenza = getField('licenza');
        const classe = getField('classe');
        const moto = getField('motociclo');
        const motoclub = getField('motoclub');
        const regione = getField('regione');
        const annoNascita = parseInt(getField('anno_nascita')) || null;

        if (!ngara || !cognome) continue;

        const isClasseTU = classe === 'TU';

        if (isTraining && !isClasseTU) { pilotiSaltati++; continue; }
        if (!isTraining && !isEpoca && isClasseTU) { pilotiSaltati++; continue; }
        if (isEpoca) { pilotiSaltati++; continue; }

        const existingResult = await pool.query(
          'SELECT id FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
          [id_evento, ngara]
        );

        if (existingResult.rows.length > 0) {
          await pool.query(
            `UPDATE piloti SET
              cognome = $1, nome = $2, classe = $3, moto = $4, team = $5,
              nazione = $6, licenza_fmi = $7, anno_nascita = $8
            WHERE id_evento = $9 AND numero_gara = $10`,
            [cognome, nome, classe, moto, motoclub, regione || 'ITA', licenza, annoNascita, id_evento, ngara]
          );
          pilotiAggiornati++;
        } else {
          await pool.query(
            `INSERT INTO piloti (id_evento, numero_gara, cognome, nome, classe, moto, team, nazione, licenza_fmi, anno_nascita)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id_evento, ngara, cognome, nome, classe, moto, motoclub, regione || 'ITA', licenza, annoNascita]
          );
          pilotiImportati++;
        }

      } catch (err) {
        errori.push(err.message);
      }
    }

    res.json({
      success: true,
      piloti_importati: pilotiImportati,
      piloti_aggiornati: pilotiAggiornati,
      piloti_saltati: pilotiSaltati,
      totale_processati: conduttoriMatch.length,
      filtro: isTraining ? 'Solo classe TU (Training)' : isEpoca ? 'Epoca (non supportato)' : 'Esclusa classe TU',
      errori: errori.length > 0 ? errori : undefined
    });

  } catch (err) {
    console.error('[IMPORT-XML] Errore:', err.message);
    next(err);
  }
});

// IMPORT ORARI PARTENZA DA FICR STARTLIST
router.post('/api/import-orari-ficr', async (req, res, next) => {
  try {
    const { id_evento, anno, codiceEquipe, manifestazione, categoria } = req.body;

    if (!id_evento || !anno || !codiceEquipe || !manifestazione || !categoria) {
      return res.status(400).json({
        error: 'Parametri mancanti: id_evento, anno, codiceEquipe, manifestazione, categoria richiesti'
      });
    }

    const url = `${FICR_BASE_URL}/END/mpcache-20/get/startlist/${anno}/${codiceEquipe}/${manifestazione}/1/1/${categoria}/*/*/*/*/*`;

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://enduro.ficr.it',
      'Referer': 'https://enduro.ficr.it/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      'Cache-Control': 'Private',
      'Pragma': 'no-cache'
    };

    const response = await axios.get(url, { headers });

    let pilotiFicr = response.data?.data?.clasdella || response.data?.data || [];

    if (!Array.isArray(pilotiFicr) && typeof pilotiFicr === 'object') {
      pilotiFicr = Object.values(pilotiFicr).flat();
    }

    if (!Array.isArray(pilotiFicr) || pilotiFicr.length === 0) {
      return res.status(404).json({ error: 'Nessun pilota trovato nella startlist FICR' });
    }

    let pilotiAggiornati = 0;
    let pilotiNonTrovati = [];

    for (const pilota of pilotiFicr) {
      try {
        const numero = parseInt(pilota.Numero);
        const orario = pilota.Orario || pilota.op_Orario;

        if (!numero || !orario) continue;

        let orarioPartenza = orario;
        if (orario.includes('T')) {
          const match = orario.match(/T(\d{2}:\d{2})/);
          if (match) orarioPartenza = match[1];
        }

        const updateResult = await pool.query(
          'UPDATE piloti SET orario_partenza = $1 WHERE id_evento = $2 AND numero_gara = $3',
          [orarioPartenza, id_evento, numero]
        );

        if (updateResult.rowCount > 0) {
          pilotiAggiornati++;
        } else {
          pilotiNonTrovati.push(numero);
        }

      } catch (err) {
        console.error(`[IMPORT-ORARI] Errore singolo pilota:`, err.message);
      }
    }

    res.json({
      success: true,
      piloti_aggiornati: pilotiAggiornati,
      piloti_non_trovati: pilotiNonTrovati.length > 0 ? pilotiNonTrovati : undefined,
      totale_ficr: pilotiFicr.length
    });

  } catch (err) {
    console.error('[IMPORT-ORARI] Errore:', err.message);
    next(err);
  }
});

module.exports = router;
