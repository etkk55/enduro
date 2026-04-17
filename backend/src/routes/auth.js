const router = require('express').Router();
const pool = require('../db/pool');
const axios = require('axios');
const config = require('../config');
const { generateDeviceToken } = require('../helpers/deviceToken');

// 1. INVIA CODICE OTP via SMS (Pilota)
router.post('/api/twilio/invia-otp', async (req, res, next) => {
  try {
    const { licenza_fmi, telefono, nome, cognome } = req.body;

    if (!licenza_fmi || !telefono) {
      return res.status(400).json({ success: false, error: 'Licenza FMI e telefono richiesti' });
    }

    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_VERIFY_SID) {
      return res.status(500).json({ success: false, error: 'Servizio SMS non configurato. Contatta l\'amministratore.' });
    }

    let telefonoNorm = telefono.replace(/\s/g, '');
    if (!telefonoNorm.startsWith('+')) {
      telefonoNorm = '+39' + telefonoNorm.replace(/^0/, '');
    }

    await pool.query(`
      INSERT INTO piloti_verificati (licenza_fmi, telefono, nome, cognome, telefono_verificato, updated_at)
      VALUES ($1, $2, $3, $4, FALSE, NOW())
      ON CONFLICT (licenza_fmi)
      DO UPDATE SET telefono = $2, nome = $3, cognome = $4, telefono_verificato = FALSE, updated_at = NOW()
    `, [licenza_fmi.toUpperCase(), telefonoNorm, nome || null, cognome || null]);

    const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/Verifications`;

    await axios.post(twilioUrl,
      new URLSearchParams({ To: telefonoNorm, Channel: 'sms' }),
      { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
    );

    console.log(`OTP inviato a ${telefonoNorm} per licenza ${licenza_fmi}`);

    res.json({
      success: true,
      message: 'Codice inviato via SMS',
      telefono_mascherato: telefonoNorm.slice(0, 6) + '****' + telefonoNorm.slice(-2)
    });

  } catch (err) {
    console.error('[POST /api/twilio/invia-otp] Error:', err.response?.data || err.message);
    if (err.response?.data?.code === 60203) {
      return res.status(429).json({ success: false, error: 'Troppi tentativi. Riprova tra qualche minuto.' });
    }
    if (err.response?.data?.code === 60200) {
      return res.status(400).json({ success: false, error: 'Numero di telefono non valido' });
    }
    res.status(500).json({ success: false, error: 'Errore invio SMS. Riprova.' });
  }
});

// 2. VERIFICA CODICE OTP (Pilota)
router.post('/api/twilio/verifica-otp', async (req, res, next) => {
  try {
    const { licenza_fmi, codice } = req.body;

    if (!licenza_fmi || !codice) {
      return res.status(400).json({ success: false, error: 'Licenza FMI e codice richiesti' });
    }

    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_VERIFY_SID) {
      return res.status(500).json({ success: false, error: 'Servizio SMS non configurato' });
    }

    const pilotaResult = await pool.query(
      'SELECT * FROM piloti_verificati WHERE licenza_fmi = $1',
      [licenza_fmi.toUpperCase()]
    );

    if (pilotaResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Richiedi prima l\'invio del codice' });
    }

    const pilota = pilotaResult.rows[0];

    const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/VerificationCheck`;

    const response = await axios.post(twilioUrl,
      new URLSearchParams({ To: pilota.telefono, Code: codice }),
      { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
    );

    if (response.data.status === 'approved') {
      const deviceToken = generateDeviceToken();

      await pool.query(
        'UPDATE piloti_verificati SET telefono_verificato = TRUE, device_token = $1, updated_at = NOW() WHERE licenza_fmi = $2',
        [deviceToken, licenza_fmi.toUpperCase()]
      );

      console.log(`Pilota verificato: ${licenza_fmi} - TOKEN generato`);

      res.json({
        success: true,
        message: 'Telefono verificato con successo!',
        device_token: deviceToken,
        licenza_fmi: licenza_fmi.toUpperCase()
      });
    } else {
      res.status(400).json({ success: false, error: 'Codice non valido o scaduto' });
    }

  } catch (err) {
    console.error('[POST /api/twilio/verifica-otp] Error:', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return res.status(400).json({ success: false, error: 'Codice scaduto. Richiedi un nuovo codice.' });
    }
    res.status(500).json({ success: false, error: 'Errore verifica. Riprova.' });
  }
});

// 3. VERIFICA SE PILOTA E GIA REGISTRATO
router.get('/api/twilio/stato/:licenza_fmi', async (req, res, next) => {
  try {
    const { licenza_fmi } = req.params;

    const result = await pool.query(
      'SELECT licenza_fmi, telefono_verificato, telefono FROM piloti_verificati WHERE licenza_fmi = $1',
      [licenza_fmi.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.json({ registrato: false, verificato: false });
    }

    const pilota = result.rows[0];
    res.json({
      registrato: true,
      verificato: pilota.telefono_verificato,
      telefono_mascherato: pilota.telefono ? pilota.telefono.slice(0, 6) + '****' + pilota.telefono.slice(-2) : null
    });

  } catch (err) {
    console.error('[GET /api/twilio/stato] Error:', err.message);
    res.status(500).json({ error: 'Errore server' });
  }
});

// 5. INVIA CODICE OTP per DdG
router.post('/api/twilio/ddg/invia-otp', async (req, res, next) => {
  try {
    const { codice_ddg, telefono, nome } = req.body;

    if (!codice_ddg || !telefono) {
      return res.status(400).json({ success: false, error: 'Codice DdG e telefono richiesti' });
    }

    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_VERIFY_SID) {
      return res.status(500).json({ success: false, error: 'Servizio SMS non configurato. Contatta l\'amministratore.' });
    }

    let telefonoNorm = telefono.replace(/\s/g, '');
    if (!telefonoNorm.startsWith('+')) {
      telefonoNorm = '+39' + telefonoNorm.replace(/^0/, '');
    }

    await pool.query(`
      INSERT INTO ddg_verificati (codice_ddg, telefono, nome, telefono_verificato, updated_at)
      VALUES ($1, $2, $3, FALSE, NOW())
      ON CONFLICT (codice_ddg)
      DO UPDATE SET telefono = $2, nome = $3, telefono_verificato = FALSE, updated_at = NOW()
    `, [codice_ddg.toUpperCase(), telefonoNorm, nome || null]);

    const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/Verifications`;

    await axios.post(twilioUrl,
      new URLSearchParams({ To: telefonoNorm, Channel: 'sms' }),
      { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
    );

    console.log(`OTP DdG inviato a ${telefonoNorm} per codice ${codice_ddg}`);

    res.json({
      success: true,
      message: 'Codice inviato via SMS',
      telefono_mascherato: telefonoNorm.slice(0, 6) + '****' + telefonoNorm.slice(-2)
    });

  } catch (err) {
    console.error('[POST /api/twilio/ddg/invia-otp] Error:', err.response?.data || err.message);
    if (err.response?.data?.code === 60203) {
      return res.status(429).json({ success: false, error: 'Troppi tentativi. Riprova tra qualche minuto.' });
    }
    if (err.response?.data?.code === 60200) {
      return res.status(400).json({ success: false, error: 'Numero di telefono non valido' });
    }
    res.status(500).json({ success: false, error: 'Errore invio SMS. Riprova.' });
  }
});

// 6. VERIFICA CODICE OTP per DdG
router.post('/api/twilio/ddg/verifica-otp', async (req, res, next) => {
  try {
    const { codice_ddg, codice } = req.body;

    if (!codice_ddg || !codice) {
      return res.status(400).json({ success: false, error: 'Codice DdG e codice OTP richiesti' });
    }

    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_VERIFY_SID) {
      return res.status(500).json({ success: false, error: 'Servizio SMS non configurato' });
    }

    const ddgResult = await pool.query(
      'SELECT * FROM ddg_verificati WHERE codice_ddg = $1',
      [codice_ddg.toUpperCase()]
    );

    if (ddgResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Richiedi prima l\'invio del codice' });
    }

    const ddg = ddgResult.rows[0];

    const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/VerificationCheck`;

    const response = await axios.post(twilioUrl,
      new URLSearchParams({ To: ddg.telefono, Code: codice }),
      { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
    );

    if (response.data.status === 'approved') {
      const deviceToken = generateDeviceToken();

      await pool.query(
        'UPDATE ddg_verificati SET telefono_verificato = TRUE, device_token = $1, updated_at = NOW() WHERE codice_ddg = $2',
        [deviceToken, codice_ddg.toUpperCase()]
      );

      console.log(`DdG verificato: ${codice_ddg} - TOKEN generato`);

      res.json({
        success: true,
        message: 'DdG verificato con successo!',
        device_token: deviceToken,
        codice_ddg: codice_ddg.toUpperCase()
      });
    } else {
      res.status(400).json({ success: false, error: 'Codice non valido o scaduto' });
    }

  } catch (err) {
    console.error('[POST /api/twilio/ddg/verifica-otp] Error:', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return res.status(400).json({ success: false, error: 'Codice scaduto. Richiedi un nuovo codice.' });
    }
    res.status(500).json({ success: false, error: 'Errore verifica. Riprova.' });
  }
});

// 7. VERIFICA SE DdG E GIA REGISTRATO
router.get('/api/twilio/ddg/stato/:codice_ddg', async (req, res, next) => {
  try {
    const { codice_ddg } = req.params;

    const result = await pool.query(
      'SELECT codice_ddg, telefono_verificato, telefono FROM ddg_verificati WHERE codice_ddg = $1',
      [codice_ddg.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.json({ registrato: false, verificato: false });
    }

    const ddg = result.rows[0];
    res.json({
      registrato: true,
      verificato: ddg.telefono_verificato,
      telefono_mascherato: ddg.telefono ? ddg.telefono.slice(0, 6) + '****' + ddg.telefono.slice(-2) : null
    });

  } catch (err) {
    console.error('[GET /api/twilio/ddg/stato] Error:', err.message);
    res.status(500).json({ error: 'Errore server' });
  }
});

// 8. CONFERMA NUOVO DISPOSITIVO per DdG
router.post('/api/twilio/ddg/conferma-dispositivo', async (req, res, next) => {
  try {
    const { codice_ddg, codice } = req.body;

    if (!codice_ddg || !codice) {
      return res.status(400).json({ success: false, error: 'Codice DdG e codice OTP richiesti' });
    }

    const ddgResult = await pool.query(
      'SELECT * FROM ddg_verificati WHERE codice_ddg = $1 AND telefono_verificato = TRUE',
      [codice_ddg.toUpperCase()]
    );

    if (ddgResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'DdG non trovato' });
    }

    const ddg = ddgResult.rows[0];

    const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/VerificationCheck`;

    const response = await axios.post(twilioUrl,
      new URLSearchParams({ To: ddg.telefono, Code: codice }),
      { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
    );

    if (response.data.status === 'approved') {
      const newToken = generateDeviceToken();

      await pool.query(
        'UPDATE ddg_verificati SET device_token = $1, updated_at = NOW() WHERE codice_ddg = $2',
        [newToken, codice_ddg.toUpperCase()]
      );

      console.log(`Nuovo dispositivo autorizzato per DdG: ${codice_ddg}`);

      res.json({
        success: true,
        message: 'Dispositivo autorizzato!',
        device_token: newToken,
        codice_ddg: codice_ddg.toUpperCase()
      });
    } else {
      res.status(400).json({ success: false, error: 'Codice non valido o scaduto' });
    }

  } catch (err) {
    console.error('[POST /api/twilio/ddg/conferma-dispositivo] Error:', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return res.status(400).json({ success: false, error: 'Codice scaduto. Riprova il login.' });
    }
    res.status(500).json({ success: false, error: 'Errore verifica. Riprova.' });
  }
});

// 9. CONFERMA NUOVO DISPOSITIVO per Pilota
router.post('/api/twilio/pilota/conferma-dispositivo', async (req, res, next) => {
  try {
    const { licenza_fmi, codice } = req.body;

    if (!licenza_fmi || !codice) {
      return res.status(400).json({ success: false, error: 'Licenza FMI e codice OTP richiesti' });
    }

    const pilotaResult = await pool.query(
      'SELECT * FROM piloti_verificati WHERE licenza_fmi = $1 AND telefono_verificato = TRUE',
      [licenza_fmi.toUpperCase()]
    );

    if (pilotaResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pilota non trovato' });
    }

    const pilota = pilotaResult.rows[0];

    const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/VerificationCheck`;

    const response = await axios.post(twilioUrl,
      new URLSearchParams({ To: pilota.telefono, Code: codice }),
      { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
    );

    if (response.data.status === 'approved') {
      const newToken = generateDeviceToken();

      await pool.query(
        'UPDATE piloti_verificati SET device_token = $1, updated_at = NOW() WHERE licenza_fmi = $2',
        [newToken, licenza_fmi.toUpperCase()]
      );

      console.log(`Nuovo dispositivo autorizzato per pilota: ${licenza_fmi}`);

      res.json({
        success: true,
        message: 'Dispositivo autorizzato!',
        device_token: newToken,
        licenza_fmi: licenza_fmi.toUpperCase()
      });
    } else {
      res.status(400).json({ success: false, error: 'Codice non valido o scaduto' });
    }

  } catch (err) {
    console.error('[POST /api/twilio/pilota/conferma-dispositivo] Error:', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return res.status(400).json({ success: false, error: 'Codice scaduto. Riprova il login.' });
    }
    res.status(500).json({ success: false, error: 'Errore verifica. Riprova.' });
  }
});

module.exports = router;
