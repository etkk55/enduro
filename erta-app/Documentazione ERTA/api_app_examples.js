app.post('/api/app/login', async (req, res) => {
  try {
    const { codice_accesso, numero_pilota } = req.body;
    
    if (!codice_accesso || numero_pilota === undefined || numero_pilota === null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Codice gara e numero pilota richiesti' 
      });
    }
    
    // Trova evento con questo codice_accesso O codice_gara (FICR)
    const eventoResult = await pool.query(
      'SELECT * FROM eventi WHERE UPPER(codice_accesso) = $1 OR UPPER(codice_gara) = $1',
      [codice_accesso.toUpperCase()]
    );
    
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Codice gara non valido' 
      });
    }
    
    const evento = eventoResult.rows[0];
    
    // NUOVO Chat 21: Login DdG con codice configurabile o "0" come fallback
    const codiceDdG = evento.codice_ddg || '0';
    const inputPulito = String(numero_pilota).trim().toUpperCase();
    
    if (inputPulito === codiceDdG.toUpperCase() || inputPulito === '0') {
      return res.json({
        success: true,
        isDdG: true,
        pilota: {
          id: null,
          numero: inputPulito,
          nome: 'Direzione',
          cognome: 'Gara',
          classe: 'DdG',
          moto: '',
          team: ''
        },
        evento: {
          id: evento.id,
          nome: evento.nome_evento,
          codice_gara: evento.codice_gara,
          data: evento.data_inizio,
          luogo: evento.luogo,
          gps_frequenza: evento.gps_frequenza || 30,
          allarme_fermo_minuti: evento.allarme_fermo_minuti || 10
        }
      });
    }
    
    // Trova pilota con questo numero in questo evento
    const pilotaResult = await pool.query(
      'SELECT * FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
      [evento.id, parseInt(numero_pilota)]
    );
    
    if (pilotaResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Pilota #${numero_pilota} non trovato in questa gara` 
      });
    }
    
    const pilota = pilotaResult.rows[0];
    
    res.json({
      success: true,
      isDdG: false,
      pilota: {
        id: pilota.id,
        numero: pilota.numero_gara,
        nome: pilota.nome,
        cognome: pilota.cognome,
        classe: pilota.classe,
        moto: pilota.moto,
        team: pilota.team
      },
      evento: {
        id: evento.id,
        nome: evento.nome_evento,
        codice_gara: evento.codice_gara,
        data: evento.data_inizio,
        luogo: evento.luogo,
        // NUOVO Chat 21: Parametri GPS
        gps_frequenza: evento.gps_frequenza || 30,
        allarme_fermo_minuti: evento.allarme_fermo_minuti || 10
      }
    });
  } catch (err) {
    console.error('[POST /api/app/login] Error:', err.message);
    res.status(500).json({ success: false, error: 'Errore server' });
  }
});

// 2. MIEI TEMPI - Prestazioni pilota
app.get('/api/app/miei-tempi/:codice_accesso/:numero_pilota', async (req, res) => {
  try {
    const { codice_accesso, numero_pilota } = req.params;
    
    // Trova evento
    const eventoResult = await pool.query(
      'SELECT * FROM eventi WHERE codice_accesso = $1',
      [codice_accesso.toUpperCase()]
    );
    
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }
    
    const evento = eventoResult.rows[0];
    
    // Trova pilota
    const pilotaResult = await pool.query(
      'SELECT * FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
      [evento.id, parseInt(numero_pilota)]
    );
    
    if (pilotaResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pilota non trovato' });
    }
    
    const pilota = pilotaResult.rows[0];
    
    // Recupera prove speciali
    const proveResult = await pool.query(
      'SELECT * FROM prove_speciali WHERE id_evento = $1 ORDER BY numero_ordine',
      [evento.id]
    );
    
    // Recupera tempi del pilota
    const tempiResult = await pool.query(
      `SELECT t.*, ps.nome_ps, ps.numero_ordine 
       FROM tempi t
       JOIN prove_speciali ps ON t.id_ps = ps.id
       WHERE t.id_pilota = $1
       ORDER BY ps.numero_ordine`,
      [pilota.id]
    );
    
    // Calcola classifica assoluta
    const classificaResult = await pool.query(
      `SELECT p.id, p.numero_gara, p.cognome, p.nome, p.classe,
              SUM(t.tempo_secondi) as tempo_totale
       FROM piloti p
       JOIN tempi t ON t.id_pilota = p.id
       WHERE p.id_evento = $1
       GROUP BY p.id
       HAVING SUM(t.tempo_secondi) > 0
       ORDER BY tempo_totale ASC`,
      [evento.id]
    );
    
    // Trova posizione assoluta
    const posAssoluta = classificaResult.rows.findIndex(r => r.id === pilota.id) + 1;
    const totPiloti = classificaResult.rows.length;
    
    // Calcola posizione di classe
    const pilotiClasse = classificaResult.rows.filter(r => r.classe === pilota.classe);
    const posClasse = pilotiClasse.findIndex(r => r.id === pilota.id) + 1;
    const totClasse = pilotiClasse.length;
    
    // Calcola tempo totale pilota
    const tempoTotale = tempiResult.rows.reduce((sum, t) => sum + parseFloat(t.tempo_secondi || 0), 0);
    
    // Formatta tempo
    const formatTempo = (sec) => {
      if (!sec || sec === 0) return '--';
      const mins = Math.floor(sec / 60);
      const secs = (sec % 60).toFixed(2);
      return `${mins}:${secs.padStart(5, '0')}`;
    };
    
    // Gap dal primo
    let gapPrimo = null;
    if (classificaResult.rows.length > 0 && posAssoluta > 1) {
      const primo = classificaResult.rows[0];
      gapPrimo = `+${formatTempo(tempoTotale - parseFloat(primo.tempo_totale))}`;
    }
    
    res.json({
      success: true,
      pilota: {
        numero: pilota.numero_gara,
        nome: pilota.nome,
        cognome: pilota.cognome,
        classe: pilota.classe,
        moto: pilota.moto
      },
      posizione_assoluta: posAssoluta || '-',
      totale_piloti: totPiloti,
      posizione_classe: posClasse || '-',
      totale_classe: totClasse,
      tempo_totale: formatTempo(tempoTotale),
      gap_primo: gapPrimo,
      prove: tempiResult.rows.map(t => ({
        ps: t.numero_ordine,
        nome: t.nome_ps,
        tempo: formatTempo(parseFloat(t.tempo_secondi)),
        penalita: t.penalita_secondi || 0
      })),
      ultimo_aggiornamento: new Date().toISOString()
    });
  } catch (err) {
    console.error('[GET /api/app/miei-tempi] Error:', err.message);
    res.status(500).json({ success: false, error: 'Errore server' });
  }
});

// 3. COMUNICATI APP - Lista comunicati per codice_accesso
app.get('/api/app/comunicati/:codice_accesso', async (req, res) => {
  try {
    const { codice_accesso } = req.params;
    const { after, tipo } = req.query; // timestamp per polling incrementale + tipo documento
    
    // Trova evento (accetta sia codice_accesso che codice_gara)
    const eventoResult = await pool.query(
      'SELECT * FROM eventi WHERE UPPER(codice_accesso) = $1 OR UPPER(codice_gara) = $1',
      [codice_accesso.toUpperCase()]
    );
    
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }
    
    const evento = eventoResult.rows[0];
    
    // Query comunicati (con filtro opzionale per polling e tipo)
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
    
