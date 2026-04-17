const router = require('express').Router();
const pool = require('../db/pool');
const { cercaEventoPerCodice } = require('../helpers/transcodification');
const { inviaPushADestinatari } = require('../helpers/pushNotifications');

// SOS/EMERGENZA - Pilota invia emergenza
router.post('/api/app/sos', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota, testo, tipo_emergenza, telefono, gps_lat, gps_lon } = req.body;

    if (!codice_accesso || !numero_pilota) {
      return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);
    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    const codice_gara = eventiTrovati[0].codice_gara;

    let testoCompleto = testo || 'EMERGENZA SOS';
    if (telefono) testoCompleto += ` | Tel: ${telefono}`;

    const result = await pool.query(
      `INSERT INTO messaggi_piloti (codice_gara, numero_pilota, tipo, testo, gps_lat, gps_lon)
       VALUES ($1, $2, 'sos', $3, $4, $5) RETURNING *`,
      [codice_gara, parseInt(numero_pilota), testoCompleto, gps_lat || null, gps_lon || null]
    );

    console.log(`SOS RICEVUTO: Pilota #${numero_pilota} - Gara ${codice_gara} - Tipo: ${tipo_emergenza || 'sos'}`);

    try {
      await inviaPushADestinatari(codice_gara, 'ddg', `SOS Pilota #${numero_pilota}`, testoCompleto.substring(0, 100), '/');
    } catch (pushErr) {
      console.log('Push SOS failed (non bloccante):', pushErr.message);
    }

    res.json({ success: true, messaggio: result.rows[0], alert: 'SOS inviato alla Direzione Gara' });
  } catch (err) {
    console.error('[POST /api/app/sos] Error:', err.message);
    next(err);
  }
});

// DASHBOARD DDG MULTI-EVENTO
router.get('/api/ddg/multi/:codice_gara', async (req, res, next) => {
  try {
    const { codice_gara } = req.params;

    const eventoRef = await pool.query(
      'SELECT ficr_anno, ficr_codice_equipe, ficr_manifestazione FROM eventi WHERE codice_gara = $1',
      [codice_gara]
    );

    if (eventoRef.rows.length === 0) {
      return res.json({ success: true, eventi: [], sos: [], piloti_fermi: [], piloti_segnale_perso: [], posizioni: [] });
    }

    const { ficr_anno, ficr_codice_equipe, ficr_manifestazione } = eventoRef.rows[0];

    const eventiResult = await pool.query(
      `SELECT id, codice_gara, nome_evento, paddock1_lat, paddock1_lon, paddock2_lat, paddock2_lon,
              paddock_raggio, allarme_fermo_minuti
       FROM eventi
       WHERE ficr_anno = $1 AND ficr_codice_equipe = $2 AND ficr_manifestazione = $3
       ORDER BY ficr_categoria`,
      [ficr_anno, ficr_codice_equipe, ficr_manifestazione]
    );

    if (eventiResult.rows.length === 0) {
      return res.json({ success: true, eventi: [], sos: [], piloti_fermi: [], piloti_segnale_perso: [], posizioni: [] });
    }

    const eventi = eventiResult.rows;
    const codiciGara = eventi.map(e => e.codice_gara);

    const sosResult = await pool.query(
      `SELECT mp.*, e.codice_gara, e.nome_evento
       FROM messaggi_piloti mp
       JOIN eventi e ON mp.codice_gara = e.codice_gara
       WHERE mp.codice_gara = ANY($1) AND mp.tipo = 'sos' AND mp.letto = false
       ORDER BY mp.created_at DESC`,
      [codiciGara]
    );

    let tuttiPilotiFermi = [];
    let tuttiSegnalePerso = [];
    let tuttiPosizioni = [];

    for (const evento of eventi) {
      const allarmeMinuti = evento.allarme_fermo_minuti || 10;
      const raggioP = evento.paddock_raggio || 500;

      const posResult = await pool.query(
        `SELECT DISTINCT ON (pp.numero_pilota)
           pp.numero_pilota, pp.lat, pp.lon, pp.created_at,
           p.nome, p.cognome, p.classe
         FROM posizioni_piloti pp
         LEFT JOIN piloti p ON p.numero_gara = pp.numero_pilota AND p.id_evento = $2
         WHERE pp.codice_gara = $1
         ORDER BY pp.numero_pilota, pp.created_at DESC`,
        [evento.codice_gara, evento.id]
      );

      for (const pos of posResult.rows) {
        let inPaddock = false;
        if (evento.paddock1_lat && evento.paddock1_lon) {
          const dist1 = Math.sqrt(Math.pow((pos.lat - evento.paddock1_lat) * 111000, 2) + Math.pow((pos.lon - evento.paddock1_lon) * 85000, 2));
          if (dist1 < raggioP) inPaddock = true;
        }
        if (evento.paddock2_lat && evento.paddock2_lon) {
          const dist2 = Math.sqrt(Math.pow((pos.lat - evento.paddock2_lat) * 111000, 2) + Math.pow((pos.lon - evento.paddock2_lon) * 85000, 2));
          if (dist2 < raggioP) inPaddock = true;
        }

        const minutiFa = Math.floor((Date.now() - new Date(pos.created_at).getTime()) / 60000);

        if (minutiFa > allarmeMinuti && !inPaddock) {
          tuttiSegnalePerso.push({ ...pos, codice_gara: evento.codice_gara, nome_evento: evento.nome_evento, minuti_senza_segnale: minutiFa });
        }

        tuttiPosizioni.push({ ...pos, codice_gara: evento.codice_gara, nome_evento: evento.nome_evento, minuti_fa: minutiFa, ultimo_aggiornamento: pos.created_at });
      }

      const fermiResult = await pool.query(
        `WITH posizioni_recenti AS (
          SELECT numero_pilota, lat, lon, created_at,
                 LAG(lat) OVER (PARTITION BY numero_pilota ORDER BY created_at) as prev_lat,
                 LAG(lon) OVER (PARTITION BY numero_pilota ORDER BY created_at) as prev_lon,
                 LAG(created_at) OVER (PARTITION BY numero_pilota ORDER BY created_at) as prev_time
          FROM posizioni_piloti
          WHERE codice_gara = $1 AND created_at > NOW() - INTERVAL '${allarmeMinuti * 2} minutes'
        )
        SELECT numero_pilota, lat, lon, created_at,
               SQRT(POW((lat - prev_lat) * 111000, 2) + POW((lon - prev_lon) * 85000, 2)) as distanza
        FROM posizioni_recenti WHERE prev_lat IS NOT NULL`,
        [evento.codice_gara]
      );

      const movimentoPiloti = {};
      for (const pos of fermiResult.rows) {
        if (!movimentoPiloti[pos.numero_pilota]) movimentoPiloti[pos.numero_pilota] = { totale: 0, ultimaPos: pos };
        movimentoPiloti[pos.numero_pilota].totale += parseFloat(pos.distanza) || 0;
        movimentoPiloti[pos.numero_pilota].ultimaPos = pos;
      }

      for (const [numero, data] of Object.entries(movimentoPiloti)) {
        if (data.totale < 50) {
          let inPaddock = false;
          if (evento.paddock1_lat && evento.paddock1_lon) {
            const dist1 = Math.sqrt(Math.pow((data.ultimaPos.lat - evento.paddock1_lat) * 111000, 2) + Math.pow((data.ultimaPos.lon - evento.paddock1_lon) * 85000, 2));
            if (dist1 < raggioP) inPaddock = true;
          }
          if (!inPaddock) {
            tuttiPilotiFermi.push({ numero_pilota: parseInt(numero), lat: data.ultimaPos.lat, lon: data.ultimaPos.lon, codice_gara: evento.codice_gara, nome_evento: evento.nome_evento, movimento_totale: Math.round(data.totale) });
          }
        }
      }
    }

    res.json({
      success: true,
      eventi: eventi.map(e => ({ codice_gara: e.codice_gara, nome_evento: e.nome_evento })),
      sos: sosResult.rows,
      piloti_fermi: tuttiPilotiFermi,
      piloti_segnale_perso: tuttiSegnalePerso,
      posizioni: tuttiPosizioni
    });

  } catch (err) {
    console.error('[GET /api/ddg/multi] Error:', err.message);
    next(err);
  }
});

module.exports = router;
