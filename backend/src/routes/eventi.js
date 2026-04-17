const router = require('express').Router();
const pool = require('../db/pool');
const { cercaEventoPerCodice } = require('../helpers/transcodification');
const { distanza } = require('../helpers/haversine');

// GET tutti gli eventi
router.get('/api/eventi', async (req, res, next) => {
  try {
    const { ficr_codice_equipe, ficr_manifestazione, ficr_anno } = req.query;

    // Se ci sono filtri FICR, filtra per quei parametri
    if (ficr_codice_equipe && ficr_manifestazione) {
      const result = await pool.query(
        `SELECT * FROM eventi
         WHERE ficr_codice_equipe = $1
           AND ficr_manifestazione = $2
           AND ($3::int IS NULL OR ficr_anno = $3)
         ORDER BY codice_gara`,
        [ficr_codice_equipe, ficr_manifestazione, ficr_anno || null]
      );
      return res.json(result.rows);
    }

    // Altrimenti restituisci tutti
    const result = await pool.query('SELECT * FROM eventi ORDER BY data_inizio DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/eventi] Error:', err.message);
    next(err);
  }
});

// GET evento singolo
router.get('/api/eventi/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM eventi WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST crea evento
router.post('/api/eventi', async (req, res, next) => {
  try {
    const {
      nome_evento,
      codice_gara,
      data_inizio,
      data_fine,
      luogo,
      descrizione,
      codice_accesso
    } = req.body;

    // UPSERT: aggiorna se esiste, crea se non esiste
    const result = await pool.query(
      `INSERT INTO eventi (nome_evento, codice_gara, data_inizio, data_fine, luogo, descrizione, codice_accesso)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (codice_gara)
       DO UPDATE SET
         nome_evento = EXCLUDED.nome_evento,
         data_inizio = EXCLUDED.data_inizio,
         data_fine = EXCLUDED.data_fine,
         luogo = EXCLUDED.luogo,
         descrizione = EXCLUDED.descrizione,
         codice_accesso = COALESCE(EXCLUDED.codice_accesso, eventi.codice_accesso)
       RETURNING *`,
      [nome_evento, codice_gara, data_inizio, data_fine || data_inizio, luogo, descrizione || null, codice_accesso || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/eventi] Error:', err.message);
    next(err);
  }
});

// POST setup evento da FICR - crea eventi con nomi categoria specifici
router.post('/api/eventi/setup-da-ficr', async (req, res, next) => {
  try {
    const {
      anno,
      equipe,
      manifestazione,
      nome_evento,
      nomi_categorie,
      luogo,
      data_gara,
      codice_accesso_fmi,
      categorie_selezionate,
      codici_fmi
    } = req.body;

    const eventiCreati = [];

    for (const categoria of categorie_selezionate) {
      const codice_gara = `${anno}-${equipe}-${manifestazione}-${categoria}`;
      const nomeSpecifico = nomi_categorie?.[categoria] || nome_evento;
      const nomeConLuogo = luogo ? `${luogo} - ${nomeSpecifico}` : nomeSpecifico;
      const codiceAccesso = codici_fmi?.[categoria] || codice_accesso_fmi;

      let dataIso = null;
      if (data_gara) {
        const parts = data_gara.split('/');
        if (parts.length === 3) {
          dataIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      const result = await pool.query(
        `INSERT INTO eventi (
          nome_evento, codice_gara, data_inizio, data_fine, luogo,
          ficr_anno, ficr_codice_equipe, ficr_manifestazione, ficr_categoria, codice_accesso
        ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (codice_gara) DO UPDATE SET
          nome_evento = EXCLUDED.nome_evento,
          data_inizio = EXCLUDED.data_inizio,
          data_fine = EXCLUDED.data_fine,
          luogo = EXCLUDED.luogo,
          ficr_anno = EXCLUDED.ficr_anno,
          ficr_codice_equipe = EXCLUDED.ficr_codice_equipe,
          ficr_manifestazione = EXCLUDED.ficr_manifestazione,
          ficr_categoria = EXCLUDED.ficr_categoria,
          codice_accesso = COALESCE(EXCLUDED.codice_accesso, eventi.codice_accesso)
        RETURNING *`,
        [nomeConLuogo, codice_gara, dataIso, luogo, anno, equipe, manifestazione, categoria, codiceAccesso]
      );

      eventiCreati.push(result.rows[0]);
    }

    res.json({
      success: true,
      risultati: {
        eventi_creati: eventiCreati
      }
    });
  } catch (err) {
    console.error('[POST /api/eventi/setup-da-ficr] Error:', err.message);
    next(err);
  }
});

// PATCH aggiorna campi evento
router.patch('/api/eventi/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...fields.map(f => updates[f])];

    const result = await pool.query(
      `UPDATE eventi SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /api/eventi/:id] Error:', err.message);
    next(err);
  }
});

// DELETE evento
router.delete('/api/eventi/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM eventi WHERE id = $1', [id]);
    res.json({ message: 'Evento eliminato' });
  } catch (err) {
    next(err);
  }
});

// PUT aggiorna codice_accesso per app ERTA
router.patch('/api/eventi/:id/codice-accesso', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { codice_accesso } = req.body;

    if (!codice_accesso || codice_accesso.length < 4) {
      return res.status(400).json({ error: 'Codice accesso deve essere almeno 4 caratteri' });
    }

    const result = await pool.query(
      'UPDATE eventi SET codice_accesso = $1 WHERE id = $2 RETURNING *',
      [codice_accesso.toUpperCase(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    res.json({ success: true, evento: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Codice accesso gia in uso' });
    }
    next(err);
  }
});

// Aggiorna parametri paddock e GPS
router.patch('/api/eventi/:id/parametri-gps', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      paddock1_lat, paddock1_lon,
      paddock2_lat, paddock2_lon,
      paddock_raggio,
      gps_frequenza,
      allarme_fermo_minuti,
      codice_ddg,
      codice_fmi,
      ficr_anno,
      ficr_codice_equipe,
      ficr_manifestazione,
      codice_accesso_pubblico
    } = req.body;

    const result = await pool.query(
      `UPDATE eventi SET
        paddock1_lat = $1, paddock1_lon = $2,
        paddock2_lat = $3, paddock2_lon = $4,
        paddock_raggio = $5,
        gps_frequenza = $6,
        allarme_fermo_minuti = $7,
        codice_ddg = $8,
        codice_fmi = $9,
        ficr_anno = $10,
        ficr_codice_equipe = $11,
        ficr_manifestazione = $12,
        codice_accesso_pubblico = $13
      WHERE id = $14 RETURNING *`,
      [
        paddock1_lat || null, paddock1_lon || null,
        paddock2_lat || null, paddock2_lon || null,
        paddock_raggio || 500,
        gps_frequenza || 30,
        allarme_fermo_minuti || 10,
        codice_ddg || null,
        codice_fmi || null,
        ficr_anno || null,
        ficr_codice_equipe || null,
        ficr_manifestazione || null,
        codice_accesso_pubblico || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    res.json({ success: true, evento: result.rows[0] });
  } catch (err) {
    console.error('[PUT /api/eventi/:id/parametri-gps] Error:', err.message);
    next(err);
  }
});

// Salva posizione GPS pilota (chiamato da ERTA)
router.post('/api/app/posizione', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota, lat, lon } = req.body;

    if (!codice_accesso || !numero_pilota || !lat || !lon) {
      return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);

    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Evento non trovato' });
    }

    const codice_gara = eventiTrovati[0].codice_gara;

    await pool.query(
      'INSERT INTO posizioni_piloti (codice_gara, numero_pilota, lat, lon) VALUES ($1, $2, $3, $4)',
      [codice_gara, parseInt(numero_pilota), parseFloat(lat), parseFloat(lon)]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[POST /api/app/posizione] Error:', err.message);
    res.status(500).json({ success: false, error: 'Errore salvataggio posizione' });
  }
});

// Elimina posizioni GPS pilota (per ritirati)
router.delete('/api/gps/:codice_gara/:numero_pilota', async (req, res, next) => {
  try {
    const { codice_gara, numero_pilota } = req.params;

    await pool.query(
      'DELETE FROM posizioni_piloti WHERE codice_gara = $1 AND numero_pilota = $2',
      [codice_gara, parseInt(numero_pilota)]
    );

    console.log(`GPS eliminato: Pilota #${numero_pilota} - Gara ${codice_gara}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/gps] Error:', err.message);
    next(err);
  }
});

// Ottieni ultima posizione di tutti i piloti
router.get('/api/eventi/:id/posizioni-piloti', async (req, res, next) => {
  try {
    const { id } = req.params;

    const eventoResult = await pool.query('SELECT codice_gara FROM eventi WHERE id = $1', [id]);
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const codice_gara = eventoResult.rows[0].codice_gara;

    const result = await pool.query(`
      SELECT DISTINCT ON (pp.numero_pilota)
        pp.numero_pilota, pp.lat, pp.lon, pp.created_at,
        p.nome, p.cognome, p.classe
      FROM posizioni_piloti pp
      LEFT JOIN piloti p ON p.numero_gara = pp.numero_pilota AND p.id_evento = $2
      WHERE pp.codice_gara = $1
      ORDER BY pp.numero_pilota, pp.created_at DESC
    `, [codice_gara, id]);

    res.json({ success: true, posizioni: result.rows });
  } catch (err) {
    console.error('[GET /api/eventi/:id/posizioni-piloti] Error:', err.message);
    next(err);
  }
});

// Ottieni piloti fermi (per allarmi)
router.get('/api/eventi/:id/piloti-fermi', async (req, res, next) => {
  try {
    const { id } = req.params;

    const eventoResult = await pool.query(
      'SELECT codice_gara, paddock1_lat, paddock1_lon, paddock2_lat, paddock2_lon, paddock_raggio, allarme_fermo_minuti FROM eventi WHERE id = $1',
      [id]
    );

    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const evento = eventoResult.rows[0];
    const sogliaMinuti = evento.allarme_fermo_minuti || 10;
    const raggioM = evento.paddock_raggio || 500;
    const raggioFermoM = 50;

    // Ottieni TUTTE le posizioni degli ultimi X*2 minuti per ogni pilota
    const posizioniResult = await pool.query(`
      SELECT numero_pilota, lat, lon, created_at
      FROM posizioni_piloti
      WHERE codice_gara = $1
        AND created_at > NOW() - INTERVAL '${sogliaMinuti * 2} minutes'
      ORDER BY numero_pilota, created_at ASC
    `, [evento.codice_gara]);

    // Ottieni ULTIMA posizione di TUTTI i piloti che hanno mai inviato GPS (per segnale perso)
    const ultimePosResult = await pool.query(`
      SELECT DISTINCT ON (numero_pilota) numero_pilota, lat, lon, created_at
      FROM posizioni_piloti
      WHERE codice_gara = $1
      ORDER BY numero_pilota, created_at DESC
    `, [evento.codice_gara]);

    // Raggruppa posizioni recenti per pilota
    const posPerPilota = {};
    posizioniResult.rows.forEach(pos => {
      if (!posPerPilota[pos.numero_pilota]) {
        posPerPilota[pos.numero_pilota] = [];
      }
      posPerPilota[pos.numero_pilota].push(pos);
    });

    const pilotiFermi = [];
    const pilotiSegnalePerso = [];
    const now = new Date();

    // 1. Trova piloti con SEGNALE PERSO
    ultimePosResult.rows.forEach(pos => {
      const minutiDaUltimaPos = (now - new Date(pos.created_at)) / 60000;

      if (minutiDaUltimaPos > sogliaMinuti) {
        let nelPaddock = false;

        if (evento.paddock1_lat && evento.paddock1_lon) {
          const dist1 = distanza(pos.lat, pos.lon, evento.paddock1_lat, evento.paddock1_lon);
          if (dist1 <= raggioM) nelPaddock = true;
        }

        if (!nelPaddock && evento.paddock2_lat && evento.paddock2_lon) {
          const dist2 = distanza(pos.lat, pos.lon, evento.paddock2_lat, evento.paddock2_lon);
          if (dist2 <= raggioM) nelPaddock = true;
        }

        if (!nelPaddock) {
          pilotiSegnalePerso.push({
            numero_pilota: pos.numero_pilota,
            tipo: 'segnale_perso',
            lat: pos.lat,
            lon: pos.lon,
            ultima_posizione: pos.created_at,
            minuti_senza_segnale: Math.round(minutiDaUltimaPos)
          });
        }
      }
    });

    // 2. Trova piloti FERMI
    Object.keys(posPerPilota).forEach(numeroPilota => {
      const posizioni = posPerPilota[numeroPilota];
      if (posizioni.length < 2) return;

      const primaPos = posizioni[0];
      const ultimaPos = posizioni[posizioni.length - 1];

      const minutiCoperti = (new Date(ultimaPos.created_at) - new Date(primaPos.created_at)) / 60000;

      if (minutiCoperti >= sogliaMinuti) {
        const movimento = distanza(primaPos.lat, primaPos.lon, ultimaPos.lat, ultimaPos.lon);

        if (movimento < raggioFermoM) {
          let nelPaddock = false;

          if (evento.paddock1_lat && evento.paddock1_lon) {
            const dist1 = distanza(ultimaPos.lat, ultimaPos.lon, evento.paddock1_lat, evento.paddock1_lon);
            if (dist1 <= raggioM) nelPaddock = true;
          }

          if (!nelPaddock && evento.paddock2_lat && evento.paddock2_lon) {
            const dist2 = distanza(ultimaPos.lat, ultimaPos.lon, evento.paddock2_lat, evento.paddock2_lon);
            if (dist2 <= raggioM) nelPaddock = true;
          }

          if (!nelPaddock) {
            pilotiFermi.push({
              numero_pilota: parseInt(numeroPilota),
              tipo: 'fermo',
              lat: ultimaPos.lat,
              lon: ultimaPos.lon,
              ultima_posizione: ultimaPos.created_at,
              minuti_fermo: Math.round(minutiCoperti),
              movimento_metri: Math.round(movimento)
            });
          }
        }
      }
    });

    // Ordina per gravita
    pilotiSegnalePerso.sort((a, b) => b.minuti_senza_segnale - a.minuti_senza_segnale);
    pilotiFermi.sort((a, b) => b.minuti_fermo - a.minuti_fermo);

    res.json({
      success: true,
      piloti_fermi: pilotiFermi,
      piloti_segnale_perso: pilotiSegnalePerso
    });
  } catch (err) {
    console.error('[GET /api/eventi/:id/piloti-fermi] Error:', err.message);
    next(err);
  }
});

module.exports = router;
