const router = require('express').Router();
const pool = require('../db/pool');
const { cercaEventoPerCodice } = require('../helpers/transcodification');

// CREA SQUADRA
router.post('/api/app/squadra', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota, nome_squadra, membri } = req.body;
    if (!codice_accesso || !numero_pilota || !nome_squadra) {
      return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) return res.status(404).json({ success: false, error: 'Codice gara non valido' });

    const codice_gara = eventiTrovati[0].codice_gara;

    const esistente = await pool.query(
      'SELECT id FROM squadre WHERE codice_gara = $1 AND (creatore_numero = $2 OR $2 = ANY(membri))',
      [codice_gara, parseInt(numero_pilota)]
    );
    if (esistente.rows.length > 0) return res.status(400).json({ success: false, error: 'Sei gia in una squadra' });

    let membriArray = [parseInt(numero_pilota)];
    if (membri && Array.isArray(membri)) {
      membri.forEach(m => { const num = parseInt(m); if (num && !membriArray.includes(num)) membriArray.push(num); });
    }

    const result = await pool.query(
      'INSERT INTO squadre (codice_gara, nome_squadra, creatore_numero, membri) VALUES ($1, $2, $3, $4) RETURNING *',
      [codice_gara, nome_squadra, parseInt(numero_pilota), membriArray]
    );

    res.json({ success: true, squadra: result.rows[0] });
  } catch (err) { next(err); }
});

// OTTIENI SQUADRA DEL PILOTA
router.get('/api/app/squadra/:codice_accesso/:numero_pilota', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota } = req.params;
    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) return res.status(404).json({ success: false, error: 'Codice gara non valido' });

    const codice_gara = eventiTrovati[0].codice_gara;
    const numero = parseInt(numero_pilota);

    const result = await pool.query(
      'SELECT * FROM squadre WHERE codice_gara = $1 AND (creatore_numero = $2 OR $2 = ANY(membri))',
      [codice_gara, numero]
    );

    if (result.rows.length === 0) return res.json({ success: true, squadra: null });

    const squadra = result.rows[0];

    const pilotiResult = await pool.query(
      `SELECT numero_gara, nome, cognome, classe, moto FROM piloti
       WHERE id_evento = (SELECT id FROM eventi WHERE codice_gara = $1 LIMIT 1) AND numero_gara = ANY($2)`,
      [codice_gara, squadra.membri]
    );

    res.json({ success: true, squadra: { ...squadra, piloti: pilotiResult.rows } });
  } catch (err) { next(err); }
});

// AGGIUNGI MEMBRO
router.patch('/api/app/squadra/:id/aggiungi', async (req, res, next) => {
  try {
    const { numero_pilota } = req.body;
    if (!numero_pilota) return res.status(400).json({ success: false, error: 'Numero pilota mancante' });

    const numero = parseInt(numero_pilota);
    const squadraResult = await pool.query('SELECT * FROM squadre WHERE id = $1', [req.params.id]);
    if (squadraResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Squadra non trovata' });

    const squadra = squadraResult.rows[0];

    const pilotaResult = await pool.query(
      `SELECT numero_gara FROM piloti WHERE id_evento = (SELECT id FROM eventi WHERE codice_gara = $1 LIMIT 1) AND numero_gara = $2`,
      [squadra.codice_gara, numero]
    );
    if (pilotaResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Pilota non trovato in questa gara' });

    const altraSquadra = await pool.query(
      'SELECT id FROM squadre WHERE codice_gara = $1 AND id != $2 AND $3 = ANY(membri)',
      [squadra.codice_gara, req.params.id, numero]
    );
    if (altraSquadra.rows.length > 0) return res.status(400).json({ success: false, error: 'Il pilota e gia in un\'altra squadra' });

    const result = await pool.query(
      'UPDATE squadre SET membri = array_append(membri, $1) WHERE id = $2 AND NOT ($1 = ANY(membri)) RETURNING *',
      [numero, req.params.id]
    );

    res.json({ success: true, squadra: result.rows[0] });
  } catch (err) { next(err); }
});

// RIMUOVI MEMBRO
router.patch('/api/app/squadra/:id/rimuovi', async (req, res, next) => {
  try {
    const numero = parseInt(req.body.numero_pilota);
    const squadraResult = await pool.query('SELECT * FROM squadre WHERE id = $1', [req.params.id]);
    if (squadraResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Squadra non trovata' });

    if (squadraResult.rows[0].creatore_numero === numero) {
      return res.status(400).json({ success: false, error: 'Il creatore non puo essere rimosso' });
    }

    const result = await pool.query(
      'UPDATE squadre SET membri = array_remove(membri, $1) WHERE id = $2 RETURNING *',
      [numero, req.params.id]
    );

    res.json({ success: true, squadra: result.rows[0] });
  } catch (err) { next(err); }
});

// CLASSIFICA SQUADRA
router.get('/api/app/classifica-squadra/:id', async (req, res, next) => {
  try {
    const squadraResult = await pool.query('SELECT * FROM squadre WHERE id = $1', [req.params.id]);
    if (squadraResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Squadra non trovata' });

    const squadra = squadraResult.rows[0];
    const codice_gara = squadra.codice_gara;

    const eventoResult = await pool.query('SELECT id FROM eventi WHERE codice_gara = $1', [codice_gara]);
    if (eventoResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Evento non trovato' });
    const eventoId = eventoResult.rows[0].id;

    const proveResult = await pool.query('SELECT id, nome_ps, numero_ordine FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine', [eventoId]);
    const numProveTotali = proveResult.rows.length;
    const listaProve = proveResult.rows;

    const classificaResult = await pool.query(`
      SELECT p.numero_gara, p.nome, p.cognome, p.classe, p.moto,
        COALESCE(SUM(t.tempo_secondi), 0) + COALESCE(SUM(t.penalita_secondi), 0) as tempo_totale,
        COUNT(t.id) as prove_completate
      FROM piloti p LEFT JOIN tempi t ON p.id = t.id_pilota
      WHERE p.id_evento = $1 GROUP BY p.id, p.numero_gara, p.nome, p.cognome, p.classe, p.moto
      HAVING COUNT(t.id) > 0 ORDER BY COUNT(t.id) DESC, tempo_totale ASC
    `, [eventoId]);

    let posizione = 0;
    const classificaConPosizioni = classificaResult.rows.map((row, idx) => {
      posizione = idx + 1;
      return { ...row, posizione_assoluta: posizione, ritirato: parseInt(row.prove_completate) < numProveTotali };
    });

    let membriClassifica = classificaConPosizioni.filter(p => squadra.membri.includes(p.numero_gara));
    membriClassifica.sort((a, b) => { if (a.ritirato !== b.ritirato) return a.ritirato ? 1 : -1; return a.tempo_totale - b.tempo_totale; });
    membriClassifica.forEach((m, idx) => { m.posizione_squadra = idx + 1; });

    const tempiDettagliatiResult = await pool.query(`
      SELECT p.numero_gara, ps.numero_ordine, ps.nome_ps, t.tempo_secondi, t.penalita_secondi
      FROM piloti p JOIN tempi t ON p.id = t.id_pilota JOIN prove_speciali ps ON t.id_ps = ps.id
      WHERE p.id_evento = $1 AND p.numero_gara = ANY($2) ORDER BY p.numero_gara, ps.numero_ordine
    `, [eventoId, squadra.membri]);

    const tuttiTempiResult = await pool.query(`
      SELECT p.numero_gara, ps.numero_ordine, t.tempo_secondi, t.penalita_secondi
      FROM piloti p JOIN tempi t ON p.id = t.id_pilota JOIN prove_speciali ps ON t.id_ps = ps.id
      WHERE p.id_evento = $1 ORDER BY ps.numero_ordine, (t.tempo_secondi + COALESCE(t.penalita_secondi, 0)) ASC
    `, [eventoId]);

    const classifichePerPS = {};
    tuttiTempiResult.rows.forEach(t => {
      const ps = t.numero_ordine;
      if (!classifichePerPS[ps]) classifichePerPS[ps] = [];
      classifichePerPS[ps].push({ numero_gara: t.numero_gara, tempo: parseFloat(t.tempo_secondi) + parseFloat(t.penalita_secondi || 0) });
    });
    Object.keys(classifichePerPS).forEach(ps => {
      classifichePerPS[ps].sort((a, b) => a.tempo - b.tempo);
      classifichePerPS[ps].forEach((p, idx) => { p.posizione = idx + 1; });
    });

    const tempiPerPilota = {};
    tempiDettagliatiResult.rows.forEach(t => {
      if (!tempiPerPilota[t.numero_gara]) tempiPerPilota[t.numero_gara] = {};
      const tempoTot = parseFloat(t.tempo_secondi) + parseFloat(t.penalita_secondi || 0);
      const classificaPS = classifichePerPS[t.numero_ordine] || [];
      const pilotaInClassifica = classificaPS.find(p => p.numero_gara === t.numero_gara);
      tempiPerPilota[t.numero_gara][t.numero_ordine] = { tempo: tempoTot, nome_prova: t.nome_ps, posizione_assoluta: pilotaInClassifica ? pilotaInClassifica.posizione : null };
    });

    const medianePS = {};
    listaProve.forEach(ps => {
      const tempiSquadraPS = [];
      squadra.membri.forEach(num => { if (tempiPerPilota[num]?.[ps.numero_ordine]) tempiSquadraPS.push(tempiPerPilota[num][ps.numero_ordine].tempo); });
      if (tempiSquadraPS.length > 0) {
        const sorted = [...tempiSquadraPS].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianePS[ps.numero_ordine] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
    });

    const migliorTempoPS = {};
    listaProve.forEach(ps => {
      let minTempo = Infinity;
      squadra.membri.forEach(num => { if (tempiPerPilota[num]?.[ps.numero_ordine]?.tempo < minTempo) minTempo = tempiPerPilota[num][ps.numero_ordine].tempo; });
      migliorTempoPS[ps.numero_ordine] = minTempo;
    });

    const formatTempo = (sec) => {
      if (!sec || sec === 0) return '--';
      const min = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const cent = Math.round((sec % 1) * 100);
      return `${min}:${s.toString().padStart(2, '0')}.${cent.toString().padStart(2, '0')}`;
    };

    membriClassifica.forEach(m => {
      const tot = parseFloat(m.tempo_totale);
      m.tempo_formattato = formatTempo(tot);
      m.prove_completate = parseInt(m.prove_completate);
      m.prove_totali = numProveTotali;

      const primoNonRitirato = membriClassifica.find(x => !x.ritirato);
      if (m.posizione_squadra > 1 && primoNonRitirato && !m.ritirato) {
        m.gap = '+' + formatTempo(tot - parseFloat(primoNonRitirato.tempo_totale));
      } else { m.gap = m.ritirato ? 'RIT' : ''; }

      m.tempi_ps = {};
      listaProve.forEach(ps => {
        if (tempiPerPilota[m.numero_gara]?.[ps.numero_ordine]) {
          const t = tempiPerPilota[m.numero_gara][ps.numero_ordine];
          const mediana = medianePS[ps.numero_ordine];
          const scostamento = mediana ? parseFloat((t.tempo - mediana).toFixed(2)) : null;
          m.tempi_ps[ps.numero_ordine] = { tempo: formatTempo(t.tempo), tempo_raw: t.tempo, nome: t.nome_prova, migliore: t.tempo === migliorTempoPS[ps.numero_ordine], posizione_assoluta: t.posizione_assoluta, scostamento };
        } else {
          m.tempi_ps[ps.numero_ordine] = { tempo: '--', tempo_raw: null, nome: '', migliore: false, posizione_assoluta: null, scostamento: null };
        }
      });
    });

    res.json({
      success: true,
      squadra: { id: squadra.id, nome: squadra.nome_squadra, creatore: squadra.creatore_numero, totale_membri: squadra.membri.length },
      prove: listaProve.map(ps => ({ numero: ps.numero_ordine, nome: ps.nome_ps || `PS${ps.numero_ordine}`, mediana: medianePS[ps.numero_ordine] || null })),
      classifica: membriClassifica,
      ultimo_aggiornamento: new Date().toISOString()
    });
  } catch (err) { next(err); }
});

// ELIMINA SQUADRA
router.delete('/api/app/squadra/:id', async (req, res, next) => {
  try {
    const { numero_pilota } = req.body;
    const squadraResult = await pool.query('SELECT * FROM squadre WHERE id = $1', [req.params.id]);
    if (squadraResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Squadra non trovata' });

    if (squadraResult.rows[0].creatore_numero !== parseInt(numero_pilota)) {
      return res.status(403).json({ success: false, error: 'Solo il creatore puo eliminare la squadra' });
    }

    await pool.query('DELETE FROM squadre WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Squadra eliminata' });
  } catch (err) { next(err); }
});

module.exports = router;
