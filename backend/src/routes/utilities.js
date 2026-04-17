const router = require('express').Router();
const pool = require('../db/pool');
const axios = require('axios');
const config = require('../config');
const { FICR_BASE_URL } = require('../helpers/ficrClient');

// Health check
router.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'OK',
      version: '3.1.0-p37',
      db: 'connected',
      timestamp: new Date().toISOString(),
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
  } catch (err) {
    res.status(503).json({ status: 'UNHEALTHY', db: 'disconnected', error: err.message });
  }
});

// Categorie
router.get('/api/categorie', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM categorie ORDER BY nome_categoria');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// IMPORT PILOTI DA FICR PER ISOLA VICENTINA
router.get('/api/import-piloti-isola', async (req, res, next) => {
  const EVENTI = [
    { id: '03406500-2c1e-4053-8580-ef4e9e5de0bf', nome: 'Campionato' },
    { id: '8ef1e8a7-fc27-43f8-a3f2-d0694528a6e3', nome: 'Training' },
    { id: '372c0c07-fdad-44be-9ba4-27a3de6bf69f', nome: 'Regolarita' }
  ];

  try {
    let totaleImportati = 0;
    let totaleAggiornati = 0;

    for (const evento of EVENTI) {
      const url = `${FICR_BASE_URL}/END/mpcache-5/get/iscbycog/${new Date().getFullYear()}/99/11/1/*/1`;
      const response = await axios.get(url);

      if (!response.data?.data?.iscrdella) continue;

      const piloti = response.data.data.iscrdella;

      for (const pilotaFICR of piloti) {
        const checkResult = await pool.query(
          'SELECT id FROM piloti WHERE numero_gara = $1 AND id_evento = $2',
          [pilotaFICR.Numero, evento.id]
        );

        if (checkResult.rows.length > 0) {
          await pool.query(
            `UPDATE piloti SET
              nome = $1, cognome = $2, team = $3, nazione = $4, classe = $5, moto = $6
             WHERE id = $7`,
            [pilotaFICR.Nome, pilotaFICR.Cognome, pilotaFICR.Motoclub || '', pilotaFICR.Naz || '', pilotaFICR.Classe || '', pilotaFICR.Moto || '', checkResult.rows[0].id]
          );
          totaleAggiornati++;
        } else {
          await pool.query(
            `INSERT INTO piloti (numero_gara, nome, cognome, team, nazione, id_evento, classe, moto)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [pilotaFICR.Numero, pilotaFICR.Nome, pilotaFICR.Cognome, pilotaFICR.Motoclub || '', pilotaFICR.Naz || '', evento.id, pilotaFICR.Classe || '', pilotaFICR.Moto || '']
          );
          totaleImportati++;
        }
      }
    }

    res.json({
      success: true,
      pilotiImportati: totaleImportati,
      pilotiAggiornati: totaleAggiornati
    });
  } catch (err) {
    next(err);
  }
});

// EXPORT REPLAY
router.get('/api/eventi/:id_evento/export-replay', async (req, res, next) => {
  const { id_evento } = req.params;

  try {
    const eventoResult = await pool.query('SELECT * FROM eventi WHERE id = $1', [id_evento]);
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    const evento = eventoResult.rows[0];

    const pilotiResult = await pool.query(
      'SELECT id, numero_gara, nome, cognome, classe, moto, team FROM piloti WHERE id_evento = $1 ORDER BY numero_gara',
      [id_evento]
    );

    const proveResult = await pool.query(
      'SELECT id, numero_ordine, nome_ps FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
      [id_evento]
    );

    const tempiResult = await pool.query(
      `SELECT t.id_pilota, ps.numero_ordine, t.tempo_secondi
       FROM tempi t
       JOIN prove_speciali ps ON t.id_ps = ps.id
       WHERE ps.id_evento = $1`,
      [id_evento]
    );

    const tempiPerPilota = {};
    tempiResult.rows.forEach(t => {
      if (!tempiPerPilota[t.id_pilota]) {
        tempiPerPilota[t.id_pilota] = {};
      }
      tempiPerPilota[t.id_pilota][`ps${t.numero_ordine}`] = parseFloat(t.tempo_secondi);
    });

    const numProve = proveResult.rows.length;
    const proveReali = proveResult.rows.map(p => p.numero_ordine);

    const pilotiConStoria = pilotiResult.rows.map(p => {
      const storia = {};
      let tempoCumulativo = 0;
      let proveCompletate = 0;

      for (let psIdx = 0; psIdx < numProve; psIdx++) {
        const numProva = proveReali[psIdx];
        const tempo = tempiPerPilota[p.id]?.[`ps${numProva}`];

        if (tempo) {
          tempoCumulativo += tempo;
          proveCompletate++;
          storia[psIdx] = { tempoCumulativo, tempoProva: tempo, completata: true, proveCompletate };
        } else {
          storia[psIdx] = { tempoCumulativo, tempoProva: null, completata: false, proveCompletate };
        }
      }

      return {
        id: p.id, num: p.numero_gara, nome: p.nome, cognome: p.cognome,
        classe: p.classe || '', moto: p.moto || '', team: p.team || '',
        storia, totalProveCompletate: proveCompletate
      };
    });

    for (let psIdx = 0; psIdx < numProve; psIdx++) {
      const pilotiValidi = pilotiConStoria.filter(p => {
        for (let i = 0; i <= psIdx; i++) {
          if (!p.storia[i]?.completata) return false;
        }
        return true;
      });

      pilotiValidi.sort((a, b) => a.storia[psIdx].tempoCumulativo - b.storia[psIdx].tempoCumulativo);

      pilotiValidi.forEach((p, idx) => {
        p.storia[psIdx].posizione = idx + 1;
        if (idx === 0) {
          p.storia[psIdx].gap = 0;
          p.storia[psIdx].gapStr = '0.0';
        } else {
          const gapSec = p.storia[psIdx].tempoCumulativo - pilotiValidi[idx - 1].storia[psIdx].tempoCumulativo;
          p.storia[psIdx].gap = gapSec;
          p.storia[psIdx].gapStr = `+${gapSec.toFixed(1)}`;
        }

        if (psIdx === 0) {
          p.storia[psIdx].variazione = 0;
        } else if (p.storia[psIdx - 1]?.posizione) {
          p.storia[psIdx].variazione = p.storia[psIdx - 1].posizione - p.storia[psIdx].posizione;
        } else {
          p.storia[psIdx].variazione = 0;
        }
      });

      const pilotiConTempoPS = pilotiConStoria.filter(p => p.storia[psIdx]?.tempoProva);
      pilotiConTempoPS.sort((a, b) => a.storia[psIdx].tempoProva - b.storia[psIdx].tempoProva);
      pilotiConTempoPS.forEach((p, idx) => {
        p.storia[psIdx].posizioneTempoPS = idx + 1;
      });

      pilotiConStoria.filter(p => !pilotiValidi.includes(p)).forEach(p => {
        if (!p.storia[psIdx]) p.storia[psIdx] = {};
        p.storia[psIdx].posizione = null;
        p.storia[psIdx].gap = null;
        p.storia[psIdx].gapStr = null;
        p.storia[psIdx].variazione = 0;
      });
    }

    const snapshots = [];

    for (let psIdx = 0; psIdx < numProve; psIdx++) {
      const proveRichieste = psIdx + 1;

      const pilotiAttivi = pilotiConStoria
        .filter(p => p.storia[psIdx]?.posizione !== null && p.storia[psIdx]?.posizione !== undefined)
        .sort((a, b) => a.storia[psIdx].posizione - b.storia[psIdx].posizione);

      const pilotiRitirati = pilotiConStoria
        .filter(p => {
          const haAlmenoUna = p.totalProveCompletate > 0;
          const nonTutte = p.storia[psIdx]?.posizione === null || p.storia[psIdx]?.posizione === undefined;
          return haAlmenoUna && nonTutte;
        })
        .sort((a, b) => b.totalProveCompletate - a.totalProveCompletate);

      const classificaAttivi = pilotiAttivi.map((p, idx) => {
        const tempoTotale = p.storia[psIdx].tempoCumulativo;
        const minutes = Math.floor(tempoTotale / 60);
        const seconds = tempoTotale % 60;
        const pos = p.storia[psIdx].posizione;

        const psData = {};
        for (let i = 0; i <= psIdx; i++) {
          psData[`ps${i+1}`] = p.storia[i]?.gapStr || '--';
          psData[`ps${i+1}_time`] = p.storia[i]?.tempoProva || null;
          psData[`var${i+1}`] = p.storia[i]?.variazione || 0;
          psData[`pos${i+1}`] = p.storia[i]?.posizioneTempoPS || null;
        }

        for (let i = psIdx + 1; i < numProve; i++) {
          psData[`ps${i+1}`] = null;
          psData[`ps${i+1}_time`] = null;
          psData[`var${i+1}`] = null;
          psData[`pos${i+1}`] = null;
        }

        return {
          pos, num: p.num, cognome: p.cognome, nome: p.nome,
          classe: p.classe, moto: p.moto, team: p.team,
          ...psData,
          totale: `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`,
          var: p.storia[psIdx]?.variazione || 0,
          stato: 'attivo'
        };
      });

      const classificaRitirati = pilotiRitirati.map((p, idx) => {
        const lastCompleted = Object.values(p.storia).filter(s => s.completata).length;
        const tempoTotale = p.storia[psIdx]?.tempoCumulativo || 0;
        const minutes = Math.floor(tempoTotale / 60);
        const seconds = tempoTotale % 60;
        const posRit = pilotiAttivi.length + idx + 1;

        const psData = {};
        for (let i = 0; i <= psIdx; i++) {
          if (p.storia[i]?.completata) {
            psData[`ps${i+1}`] = p.storia[i]?.gapStr || '+RIT';
          } else {
            psData[`ps${i+1}`] = 'RIT';
          }
          psData[`ps${i+1}_time`] = p.storia[i]?.tempoProva || null;
          psData[`var${i+1}`] = p.storia[i]?.variazione || 0;
          psData[`pos${i+1}`] = p.storia[i]?.posizioneTempoPS || null;
        }

        for (let i = psIdx + 1; i < numProve; i++) {
          psData[`ps${i+1}`] = null;
          psData[`ps${i+1}_time`] = null;
          psData[`var${i+1}`] = null;
          psData[`pos${i+1}`] = null;
        }

        return {
          pos: posRit, num: p.num, cognome: p.cognome, nome: p.nome,
          classe: p.classe, moto: p.moto, team: p.team,
          ...psData,
          totale: `RIT (${lastCompleted}/${proveRichieste})`,
          var: 0,
          stato: 'ritirato'
        };
      });

      const classifica = [...classificaAttivi, ...classificaRitirati];

      snapshots.push({
        step: psIdx + 1,
        descrizione: `Dopo ${proveResult.rows[psIdx].nome_ps}`,
        prova_corrente: psIdx + 1,
        classifica
      });
    }

    res.json({
      manifestazione: evento.nome_evento,
      prove: proveResult.rows.map(p => ({ id: p.numero_ordine, nome: p.nome_ps })),
      piloti: pilotiResult.rows.map(p => ({ num: p.numero_gara, cognome: p.cognome, nome: p.nome, classe: p.classe || '', id: p.id })),
      snapshots
    });

  } catch (err) {
    console.error('Errore export replay:', err);
    next(err);
  }
});

// FIX TEMPORANEO - Crea prove Isola Vicentina
router.get('/api/fix-prove-isola', async (req, res, next) => {
  try {
    const eventi = [
      { id: '03406500-2c1e-4053-8580-ef4e9e5de0bf', nome: 'Campionato' },
      { id: '8ef1e8a7-fc27-43f8-a3f2-d0694528a6e3', nome: 'Training' },
      { id: '372c0c07-fdad-44be-9ba4-27a3de6bf69f', nome: 'Regolarita' }
    ];

    const prove = [2, 3, 5, 6, 8, 9, 11, 12];
    let createdCount = 0;

    for (const evento of eventi) {
      for (let i = 0; i < prove.length; i++) {
        await pool.query(
          `INSERT INTO prove_speciali (nome_ps, numero_ordine, id_evento, stato)
          VALUES ($1, $2, $3, 'non_iniziata')`,
          [`Prova ${prove[i]}`, i + 1, evento.id]
        );
        createdCount++;
      }
    }

    res.json({ success: true, prove_create: createdCount });
  } catch (err) {
    next(err);
  }
});

// IMPORT TEMPI ISOLA VICENTINA
router.get('/api/import-tempi-isola-campionato', async (req, res, next) => {
  const ID_EVENTO = '03406500-2c1e-4053-8580-ef4e9e5de0bf';
  const prove = [2, 3, 5, 6, 8, 9, 11, 12];

  try {
    let totaleImportati = 0;

    for (const numeroProva of prove) {
      const provaResult = await pool.query(
        'SELECT id FROM prove_speciali WHERE id_evento = $1 AND nome_ps = $2',
        [ID_EVENTO, `Prova ${numeroProva}`]
      );

      if (provaResult.rows.length === 0) continue;
      const id_ps = provaResult.rows[0].id;

      const url = `${FICR_BASE_URL}/END/mpcache-5/get/clasps/${new Date().getFullYear()}/99/11/1/${numeroProva}/1/*/*/*/*/*`;
      const response = await axios.get(url);

      if (!response.data?.data?.clasdella) continue;

      const piloti = response.data.data.clasdella;

      for (const pilotaFICR of piloti) {
        const pilotaResult = await pool.query(
          'SELECT id FROM piloti WHERE numero_gara = $1 AND id_evento = $2',
          [pilotaFICR.Numero, ID_EVENTO]
        );

        let pilotaId;
        if (pilotaResult.rows.length > 0) {
          pilotaId = pilotaResult.rows[0].id;
        } else {
          const nuovoPilota = await pool.query(
            `INSERT INTO piloti (numero_gara, nome, cognome, team, nazione, id_evento, classe, moto)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [pilotaFICR.Numero, pilotaFICR.Nome, pilotaFICR.Cognome, pilotaFICR.Motoclub || '', pilotaFICR.Naz || '', ID_EVENTO, pilotaFICR.Classe || '', pilotaFICR.Moto || '']
          );
          pilotaId = nuovoPilota.rows[0].id;
        }

        const tempoStr = pilotaFICR.Tempo;
        if (!tempoStr) continue;

        const match = tempoStr.match(/(\d+)'(\d+\.\d+)/);
        if (!match) continue;

        const tempoSecondi = parseInt(match[1]) * 60 + parseFloat(match[2]);

        await pool.query(
          `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (id_pilota, id_ps) DO UPDATE SET tempo_secondi = $3`,
          [pilotaId, id_ps, tempoSecondi]
        );

        totaleImportati++;
      }
    }

    res.json({ success: true, tempi_importati: totaleImportati });
  } catch (err) {
    next(err);
  }
});

// IMPORT UNIVERSALE TUTTE LE GARE ISOLA
router.get('/api/import-tempi-isola/:tipo_gara', async (req, res, next) => {
  const { tipo_gara } = req.params;

  const EVENTI_MAP = {
    'campionato': '03406500-2c1e-4053-8580-ef4e9e5de0bf',
    'training': '8ef1e8a7-fc27-43f8-a3f2-d0694528a6e3',
    'regolarita': '372c0c07-fdad-44be-9ba4-27a3de6bf69f'
  };

  const ID_EVENTO = EVENTI_MAP[tipo_gara];
  if (!ID_EVENTO) {
    return res.status(400).json({ error: 'Tipo gara non valido. Usa: campionato, training, regolarita' });
  }

  const prove = [2, 3, 5, 6, 8, 9, 11, 12];

  try {
    let totaleImportati = 0;
    let dettagli = [];

    for (const numeroProva of prove) {
      const provaResult = await pool.query(
        'SELECT id FROM prove_speciali WHERE id_evento = $1 AND nome_ps = $2',
        [ID_EVENTO, `Prova ${numeroProva}`]
      );

      if (provaResult.rows.length === 0) {
        dettagli.push({ prova: numeroProva, status: 'prova non trovata nel DB' });
        continue;
      }

      const id_ps = provaResult.rows[0].id;
      const url = `${FICR_BASE_URL}/END/mpcache-5/get/clasps/${new Date().getFullYear()}/99/11/1/${numeroProva}/1/*/*/*/*/*`;

      try {
        const response = await axios.get(url);

        if (!response.data?.data?.clasdella) {
          dettagli.push({ prova: numeroProva, status: 'nessun dato da FICR' });
          continue;
        }

        const piloti = response.data.data.clasdella;
        let importatiProva = 0;

        for (const pilotaFICR of piloti) {
          const pilotaResult = await pool.query(
            'SELECT id FROM piloti WHERE numero_gara = $1 AND id_evento = $2',
            [pilotaFICR.Numero, ID_EVENTO]
          );

          let pilotaId;
          if (pilotaResult.rows.length > 0) {
            pilotaId = pilotaResult.rows[0].id;
          } else {
            const nuovoPilota = await pool.query(
              `INSERT INTO piloti (numero_gara, nome, cognome, team, nazione, id_evento, classe, moto)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
              [pilotaFICR.Numero, pilotaFICR.Nome, pilotaFICR.Cognome, pilotaFICR.Motoclub || '', pilotaFICR.Naz || '', ID_EVENTO, pilotaFICR.Classe || '', pilotaFICR.Moto || '']
            );
            pilotaId = nuovoPilota.rows[0].id;
          }

          const tempoStr = pilotaFICR.Tempo;
          if (!tempoStr) continue;

          const match = tempoStr.match(/(\d+)'(\d+\.\d+)/);
          if (!match) continue;

          const tempoSecondi = parseInt(match[1]) * 60 + parseFloat(match[2]);

          await pool.query(
            `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (id_pilota, id_ps) DO UPDATE SET tempo_secondi = $3`,
            [pilotaId, id_ps, tempoSecondi]
          );

          importatiProva++;
          totaleImportati++;
        }

        dettagli.push({ prova: numeroProva, status: 'ok', tempi: importatiProva });

      } catch (err) {
        dettagli.push({ prova: numeroProva, status: 'errore FICR API', error: err.message });
      }
    }

    res.json({ success: true, tipo_gara, tempi_importati: totaleImportati, dettagli });

  } catch (err) {
    next(err);
  }
});

// ==================== SIMULAZIONE LIVE ====================

// Stato simulazioni in memoria (per ogni evento)
const simulationState = {};

// Cleanup automatico simulazioni vecchie (>1 ora) per evitare memory leak
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of Object.entries(simulationState)) {
    if (now - new Date(state.inizioSimulazione).getTime() > 3600000) {
      delete simulationState[id];
      console.log(`[SIMULATE] Pulito stato simulazione ${id}`);
    }
  }
}, 600000);

// Reset simulazione per un evento
router.post('/api/eventi/:id/simulate-reset', async (req, res, next) => {
  const { id } = req.params;

  try {
    const tempiResult = await pool.query(
      `SELECT t.id, t.id_pilota, t.id_ps, t.tempo_secondi, t.penalita_secondi,
              p.numero_gara, p.nome, p.cognome, p.classe,
              ps.numero_ordine, ps.nome_ps
       FROM tempi t
       JOIN piloti p ON t.id_pilota = p.id
       JOIN prove_speciali ps ON t.id_ps = ps.id
       WHERE ps.id_evento = $1
       ORDER BY ps.numero_ordine, t.tempo_secondi`,
      [id]
    );

    if (tempiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nessun tempo trovato per questo evento' });
    }

    const tempiShuffled = tempiResult.rows
      .map(t => ({ ...t, sortKey: Math.random() }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...t }) => t);

    const proveResult = await pool.query(
      'SELECT id FROM prove_speciali WHERE id_evento = $1',
      [id]
    );
    const proveIds = proveResult.rows.map(p => p.id);

    if (proveIds.length > 0) {
      await pool.query('DELETE FROM tempi WHERE id_ps = ANY($1)', [proveIds]);
      console.log(`[SIMULATE-RESET] Cancellati ${tempiResult.rows.length} tempi dal DB`);
    }

    simulationState[id] = {
      tempiTotali: tempiShuffled,
      tempiRilasciati: [],
      indiceCorrente: 0,
      inizioSimulazione: new Date(),
      ultimoPolling: null
    };

    res.json({
      success: true,
      message: 'Simulazione resettata - tempi cancellati dal DB',
      tempiTotali: tempiShuffled.length,
      tempiRilasciati: 0,
      tempiRimanenti: tempiShuffled.length
    });

  } catch (error) {
    console.error('Errore reset simulazione:', error);
    next(error);
  }
});

// Polling simulato
router.get('/api/eventi/:id/simulate-poll', async (req, res, next) => {
  const { id } = req.params;
  const batchSize = parseInt(req.query.batch) || 15;

  try {
    if (!simulationState[id]) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna simulazione attiva. Esegui prima Inizializza/Reset.'
      });
    }

    const state = simulationState[id];

    const minBatch = Math.ceil(batchSize * 0.5);
    const actualBatch = Math.floor(Math.random() * (batchSize - minBatch + 1)) + minBatch;

    const startIdx = state.indiceCorrente;
    const endIdx = Math.min(startIdx + actualBatch, state.tempiTotali.length);
    const nuoviTempi = state.tempiTotali.slice(startIdx, endIdx);

    for (const tempo of nuoviTempi) {
      await pool.query(
        `INSERT INTO tempi (id_pilota, id_ps, tempo_secondi, penalita_secondi)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_pilota, id_ps)
         DO UPDATE SET tempo_secondi = $3, penalita_secondi = $4`,
        [tempo.id_pilota, tempo.id_ps, tempo.tempo_secondi, tempo.penalita_secondi || 0]
      );
    }

    state.indiceCorrente = endIdx;
    state.tempiRilasciati = state.tempiRilasciati.concat(nuoviTempi);
    state.ultimoPolling = new Date();

    const simulazioneCompleta = state.indiceCorrente >= state.tempiTotali.length;

    res.json({
      success: true,
      nuoviTempi: nuoviTempi,
      tempiTotali: state.tempiTotali.length,
      tempiRilasciati: state.tempiRilasciati.length,
      tempiRimanenti: state.tempiTotali.length - state.indiceCorrente,
      simulazioneCompleta: simulazioneCompleta,
      polling: {
        batchRichiesto: batchSize,
        batchEffettivo: nuoviTempi.length,
        ultimoPolling: state.ultimoPolling
      }
    });

  } catch (error) {
    console.error('Errore polling simulazione:', error);
    next(error);
  }
});

// Stato corrente simulazione
router.get('/api/eventi/:id/simulate-status', async (req, res) => {
  const { id } = req.params;

  const state = simulationState[id];

  if (!state) {
    return res.json({
      success: true,
      attiva: false,
      message: 'Nessuna simulazione attiva per questo evento'
    });
  }

  res.json({
    success: true,
    attiva: true,
    tempiTotali: state.tempiTotali.length,
    tempiRilasciati: state.tempiRilasciati.length,
    tempiRimanenti: state.tempiTotali.length - state.indiceCorrente,
    simulazioneCompleta: state.indiceCorrente >= state.tempiTotali.length,
    inizioSimulazione: state.inizioSimulazione,
    ultimoPolling: state.ultimoPolling
  });
});

module.exports = router;
