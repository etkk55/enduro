const router = require('express').Router();
const pool = require('../db/pool');

// Helper per trovare gare da codice FMI pubblico
async function trovaGareDaCodicePubblico(codice) {
  const codiceUpper = codice.toUpperCase().trim();

  let result = await pool.query('SELECT * FROM eventi WHERE UPPER(codice_fmi) = $1', [codiceUpper]);

  if (result.rows.length === 0) {
    result = await pool.query('SELECT * FROM eventi WHERE UPPER(codice_accesso_pubblico) LIKE $1', [`%${codiceUpper}%`]);
  }

  if (result.rows.length === 0) {
    result = await pool.query('SELECT * FROM eventi WHERE UPPER(codice_gara) = $1 OR UPPER(codice_accesso) = $1', [codiceUpper]);
  }

  return result.rows;
}

// GET info evento (NO LOGIN)
router.get('/api/app/evento/:codice/open', async (req, res, next) => {
  try {
    const { codice } = req.params;
    const codiceUpper = codice.toUpperCase();

    let eventiResult = await pool.query(
      `SELECT id, nome_evento, data_inizio, luogo, codice_gara, codice_accesso, codice_fmi FROM eventi WHERE UPPER(codice_fmi) = $1`,
      [codiceUpper]
    );

    if (eventiResult.rows.length === 0) {
      eventiResult = await pool.query(
        `SELECT id, nome_evento, data_inizio, luogo, codice_gara, codice_accesso, codice_fmi FROM eventi WHERE UPPER(codice_accesso) = $1 OR UPPER(codice_gara) = $1`,
        [codiceUpper]
      );
    }

    if (eventiResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evento non trovato' });
    }

    const eventi = eventiResult.rows;
    const eventoIds = eventi.map(e => e.id);
    const codiciGara = eventi.map(e => e.codice_gara);

    const pilotiResult = await pool.query(
      `SELECT p.numero_gara, p.cognome, p.nome, p.classe, p.moto, p.team, p.orario_partenza, e.codice_gara
       FROM piloti p JOIN eventi e ON p.id_evento = e.id
       WHERE p.id_evento = ANY($1) ORDER BY p.numero_gara`,
      [eventoIds]
    );

    const comunicatiResult = await pool.query(
      `SELECT id, numero, ora, data, testo, tipo, codice_gara,
              CASE WHEN pdf_allegato IS NOT NULL THEN true ELSE false END as ha_pdf, pdf_nome
       FROM comunicati WHERE codice_gara = ANY($1) ORDER BY created_at DESC`,
      [codiciGara]
    );

    const comunicati = {
      comunicato: comunicatiResult.rows.filter(c => c.tipo === 'comunicato'),
      general_info: comunicatiResult.rows.filter(c => c.tipo === 'general_info'),
      paddock_info: comunicatiResult.rows.filter(c => c.tipo === 'paddock_info')
    };

    const primoEvento = eventi[0];

    res.json({
      success: true,
      codice_fmi: primoEvento.codice_fmi || codice,
      manifestazione: { luogo: primoEvento.luogo, data: primoEvento.data_inizio },
      gare: eventi.map(e => ({ codice_gara: e.codice_gara, nome: e.nome_evento })),
      piloti: pilotiResult.rows,
      comunicati: comunicati,
      totale_piloti: pilotiResult.rows.length,
      totale_gare: eventi.length
    });

  } catch (err) {
    console.error('[GET /api/app/evento/:codice/open] Error:', err.message);
    next(err);
  }
});

// LOGIN PUBBLICO
router.post('/api/app/login-pubblico', async (req, res, next) => {
  try {
    const { codice_fmi } = req.body;
    if (!codice_fmi) return res.status(400).json({ success: false, error: 'Codice FMI richiesto' });

    const gare = await trovaGareDaCodicePubblico(codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    res.json({
      success: true, isPublic: true, codice_fmi: codice_fmi.toUpperCase(),
      gare: gare.map(g => ({ id: g.id, codice_gara: g.codice_gara, nome: g.nome_evento, data: g.data_inizio, luogo: g.luogo }))
    });
  } catch (err) {
    console.error('[POST /api/app/login-pubblico] Error:', err.message);
    next(err);
  }
});

// ISCRITTI PUBBLICO
router.get('/api/app/pubblico/iscritti/:codice_fmi', async (req, res, next) => {
  try {
    const gare = await trovaGareDaCodicePubblico(req.params.codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    const pilotiResult = await pool.query(
      `SELECT p.numero_gara, p.cognome, p.nome, p.classe, p.moto, p.team, e.codice_gara
       FROM piloti p JOIN eventi e ON p.id_evento = e.id
       WHERE p.id_evento = ANY($1) ORDER BY p.cognome, p.nome`,
      [gare.map(g => g.id)]
    );

    res.json({
      success: true, totale: pilotiResult.rows.length,
      piloti: pilotiResult.rows.map(p => ({ numero: p.numero_gara, cognome: p.cognome, nome: p.nome, classe: p.classe, moto: p.moto, team: p.team, gara: p.codice_gara }))
    });
  } catch (err) { next(err); }
});

// ORDINE PARTENZA PUBBLICO
router.get('/api/app/pubblico/ordine/:codice_fmi', async (req, res, next) => {
  try {
    const gare = await trovaGareDaCodicePubblico(req.params.codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    const pilotiResult = await pool.query(
      `SELECT p.numero_gara, p.cognome, p.nome, p.classe, p.orario_partenza, e.codice_gara
       FROM piloti p JOIN eventi e ON p.id_evento = e.id
       WHERE p.id_evento = ANY($1) AND p.orario_partenza IS NOT NULL
       ORDER BY p.orario_partenza, p.numero_gara`,
      [gare.map(g => g.id)]
    );

    res.json({
      success: true, totale: pilotiResult.rows.length,
      partenze: pilotiResult.rows.map(p => ({ numero: p.numero_gara, cognome: p.cognome, nome: p.nome, classe: p.classe, orario: p.orario_partenza ? p.orario_partenza.substring(0, 5) : null, gara: p.codice_gara }))
    });
  } catch (err) { next(err); }
});

// PROGRAMMA PUBBLICO
router.get('/api/app/pubblico/programma/:codice_fmi', async (req, res, next) => {
  try {
    const gare = await trovaGareDaCodicePubblico(req.params.codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    const gara = gare[0];
    const anno = gara.ficr_anno || new Date().getFullYear();
    const equipe = gara.ficr_codice_equipe;
    const manif = gara.ficr_manifestazione;

    if (!equipe || !manif) {
      return res.json({ success: true, prove: [], message: 'Parametri FICR non configurati' });
    }

    const categoria = gara.ficr_categoria || 1;
    const apiUrl = `https://apienduro.ficr.it/END/mpcache-30/get/program/${anno}/${equipe}/${manif}/${categoria}`;

    try {
      const ficrRes = await fetch(apiUrl);
      if (ficrRes.ok) {
        const ficrData = await ficrRes.json();
        const prove = ficrData.data || ficrData || [];
        res.json({
          success: true, gara: gara.nome_evento,
          prove: Array.isArray(prove) ? prove.map(p => ({ sigla: p.Sigla, descrizione: p.Description, lunghezza: p.Length, data: p.Data })) : []
        });
      } else {
        res.json({ success: true, prove: [], message: 'Programma non disponibile da FICR' });
      }
    } catch (ficrErr) {
      res.json({ success: true, prove: [], message: 'Programma non disponibile' });
    }
  } catch (err) { next(err); }
});

// COMUNICATI PUBBLICO
router.get('/api/app/pubblico/comunicati/:codice_fmi', async (req, res, next) => {
  try {
    const gare = await trovaGareDaCodicePubblico(req.params.codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    const codiciGara = gare.map(g => g.codice_gara);

    const comunicatiResult = await pool.query(
      `SELECT id, numero, ora, data, testo, tipo, codice_gara, CASE WHEN pdf_allegato IS NOT NULL THEN true ELSE false END as ha_pdf, pdf_nome, created_at
       FROM comunicati WHERE codice_gara = ANY($1) AND (tipo = 'comunicato' OR tipo IS NULL) ORDER BY created_at DESC`,
      [codiciGara]
    );

    const paddockResult = await pool.query(
      `SELECT id, numero, ora, data, testo, tipo, codice_gara, CASE WHEN pdf_allegato IS NOT NULL THEN true ELSE false END as ha_pdf, pdf_nome, created_at
       FROM comunicati WHERE codice_gara = ANY($1) AND tipo = 'general_info' ORDER BY created_at DESC`,
      [codiciGara]
    );

    res.json({
      success: true, totale: comunicatiResult.rows.length + paddockResult.rows.length,
      comunicati: comunicatiResult.rows.map(c => ({ id: c.id, numero: c.numero, ora: c.ora, data: c.data, testo: c.testo, gara: c.codice_gara, ha_pdf: c.ha_pdf, pdf_nome: c.pdf_nome, created_at: c.created_at })),
      paddock: paddockResult.rows.map(c => ({ id: c.id, numero: c.numero, ora: c.ora, data: c.data, testo: c.testo, gara: c.codice_gara, ha_pdf: c.ha_pdf, pdf_nome: c.pdf_nome, created_at: c.created_at }))
    });
  } catch (err) { next(err); }
});

// GPS Piloti pubblico
router.get('/api/app/pubblico/gps/:codice_fmi', async (req, res, next) => {
  try {
    const gare = await trovaGareDaCodicePubblico(req.params.codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    const codiciGara = gare.map(g => g.codice_gara);
    const eventoIds = gare.map(g => g.id);

    const result = await pool.query(`
      SELECT DISTINCT ON (pp.numero_pilota, pp.codice_gara)
        pp.numero_pilota, pp.lat, pp.lon, pp.codice_gara, pp.created_at,
        p.nome, p.cognome, p.classe
      FROM posizioni_piloti pp
      LEFT JOIN piloti p ON p.numero_gara = pp.numero_pilota AND p.id_evento = ANY($2)
      WHERE pp.codice_gara = ANY($1)
      ORDER BY pp.numero_pilota, pp.codice_gara, pp.created_at DESC
    `, [codiciGara, eventoIds]);

    res.json({
      success: true, totale: result.rows.length,
      posizioni: result.rows.map(r => ({ numero: r.numero_pilota, nome: r.nome, cognome: r.cognome, classe: r.classe, lat: r.lat, lon: r.lon, gara: r.codice_gara, aggiornato: r.created_at }))
    });
  } catch (err) { next(err); }
});

// SERVIZIO PUBBLICO
router.get('/api/app/pubblico/servizio/:codice_fmi', async (req, res, next) => {
  try {
    const gare = await trovaGareDaCodicePubblico(req.params.codice_fmi);
    if (gare.length === 0) return res.status(404).json({ success: false, error: 'Codice non valido' });

    const servizioResult = await pool.query(
      `SELECT id, numero, ora, data, testo, codice_gara, CASE WHEN pdf_allegato IS NOT NULL THEN true ELSE false END as ha_pdf, pdf_nome, created_at
       FROM comunicati WHERE codice_gara = ANY($1) AND tipo = 'servizio' ORDER BY created_at DESC`,
      [gare.map(g => g.codice_gara)]
    );

    res.json({
      success: true, totale: servizioResult.rows.length,
      comunicazioni: servizioResult.rows.map(c => ({ id: c.id, numero: c.numero, ora: c.ora, data: c.data, testo: c.testo, gara: c.codice_gara, ha_pdf: c.ha_pdf, pdf_nome: c.pdf_nome, created_at: c.created_at }))
    });
  } catch (err) { next(err); }
});

module.exports = router;
