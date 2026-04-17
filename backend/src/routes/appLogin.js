const router = require('express').Router();
const pool = require('../db/pool');
const axios = require('axios');
const config = require('../config');
const { cercaEventoPerCodice } = require('../helpers/transcodification');
const { generateDeviceToken } = require('../helpers/deviceToken');

// LOGIN CON DEVICE TOKEN
router.post('/api/app/login-token', async (req, res, next) => {
  try {
    const { codice_accesso, device_token } = req.body;

    if (!codice_accesso || !device_token) {
      return res.status(400).json({ success: false, error: 'Codice gara e token richiesti' });
    }

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);

    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    const evento = eventiTrovati[0];

    // 1. Cerca TOKEN nei DdG verificati
    const ddgResult = await pool.query(
      'SELECT * FROM ddg_verificati WHERE device_token = $1 AND telefono_verificato = TRUE',
      [device_token]
    );

    if (ddgResult.rows.length > 0) {
      const ddg = ddgResult.rows[0];
      const codiceDdGEvento = evento.codice_ddg || '0';

      if (ddg.codice_ddg === codiceDdGEvento.toUpperCase() || ddg.codice_ddg === '0') {
        console.log(`Login DdG con TOKEN: ${ddg.codice_ddg}`);

        return res.json({
          success: true,
          isDdG: true,
          authMethod: 'token',
          pilota: {
            id: null, numero: ddg.codice_ddg, nome: 'Direzione', cognome: 'Gara',
            classe: 'DdG', moto: '', team: ''
          },
          evento: {
            id: evento.id, nome: evento.nome_evento, codice_gara: evento.codice_gara,
            data: evento.data_inizio, luogo: evento.luogo,
            gps_frequenza: evento.gps_frequenza || 30, allarme_fermo_minuti: evento.allarme_fermo_minuti || 10
          }
        });
      }
    }

    // 2. Cerca TOKEN nei piloti verificati
    const pilotaVerificatoResult = await pool.query(
      'SELECT * FROM piloti_verificati WHERE device_token = $1 AND telefono_verificato = TRUE',
      [device_token]
    );

    if (pilotaVerificatoResult.rows.length > 0) {
      const pilotaVerificato = pilotaVerificatoResult.rows[0];

      let pilotaTrovato = null;
      let eventoDelPilota = null;

      for (const ev of eventiTrovati) {
        const pilotaResult = await pool.query(
          'SELECT * FROM piloti WHERE id_evento = $1 AND UPPER(licenza_fmi) = $2',
          [ev.id, pilotaVerificato.licenza_fmi.toUpperCase()]
        );

        if (pilotaResult.rows.length > 0) {
          pilotaTrovato = pilotaResult.rows[0];
          eventoDelPilota = ev;
          break;
        }
      }

      if (pilotaTrovato) {
        console.log(`Login Pilota con TOKEN: #${pilotaTrovato.numero_gara} (${pilotaVerificato.licenza_fmi})`);

        return res.json({
          success: true,
          isDdG: false,
          authMethod: 'token',
          pilota: {
            id: pilotaTrovato.id, numero: pilotaTrovato.numero_gara,
            nome: pilotaTrovato.nome, cognome: pilotaTrovato.cognome,
            classe: pilotaTrovato.classe, moto: pilotaTrovato.moto, team: pilotaTrovato.team,
            telefono: pilotaVerificato.telefono, licenza_fmi: pilotaTrovato.licenza_fmi
          },
          evento: {
            id: eventoDelPilota.id, nome: eventoDelPilota.nome_evento,
            codice_gara: eventoDelPilota.codice_gara, data: eventoDelPilota.data_inizio,
            luogo: eventoDelPilota.luogo, gps_frequenza: eventoDelPilota.gps_frequenza || 30,
            allarme_fermo_minuti: eventoDelPilota.allarme_fermo_minuti || 10
          }
        });
      } else {
        return res.status(404).json({
          success: false, error: 'Non sei iscritto a questa gara',
          licenza_fmi: pilotaVerificato.licenza_fmi
        });
      }
    }

    return res.status(401).json({
      success: false, error: 'Dispositivo non riconosciuto. Effettua la registrazione.',
      token_invalid: true
    });

  } catch (err) {
    console.error('[POST /api/app/login-token] Error:', err.message);
    res.status(500).json({ success: false, error: 'Errore server' });
  }
});

// LOGIN APP - Validazione codice_accesso + numero pilota
router.post('/api/app/login', async (req, res, next) => {
  try {
    const { codice_accesso, numero_pilota, pin, telefono } = req.body;

    if (!codice_accesso || numero_pilota === undefined || numero_pilota === null) {
      return res.status(400).json({ success: false, error: 'Codice gara e numero pilota richiesti' });
    }

    const eventiTrovati = await cercaEventoPerCodice(codice_accesso);

    if (eventiTrovati.length === 0) {
      return res.status(404).json({ success: false, error: 'Codice gara non valido' });
    }

    const evento = eventiTrovati[0];

    // Login DdG
    const codiceDdG = evento.codice_ddg || '0';
    const inputPulito = String(numero_pilota).trim().toUpperCase();

    if (inputPulito === codiceDdG.toUpperCase() || inputPulito === '0') {
      const ddgResult = await pool.query(
        'SELECT telefono_verificato, telefono, device_token FROM ddg_verificati WHERE codice_ddg = $1',
        [inputPulito]
      );

      const ddgRegistrato = ddgResult.rows.length > 0;
      const ddgVerificato = ddgRegistrato && ddgResult.rows[0].telefono_verificato;
      const ddgHasToken = ddgRegistrato && ddgResult.rows[0].device_token;

      if (config.TWILIO_ACCOUNT_SID && config.TWILIO_VERIFY_SID && !ddgRegistrato) {
        return res.status(401).json({
          success: false, isDdG: true,
          error: 'Registra il DdG con SMS per accedere',
          require_registration: true, ddg_code: inputPulito
        });
      }

      const requestToken = req.body.device_token;
      if (config.TWILIO_ACCOUNT_SID && config.TWILIO_VERIFY_SID && ddgVerificato && ddgHasToken) {
        if (requestToken !== ddgResult.rows[0].device_token) {
          const telefonoDdG = ddgResult.rows[0].telefono;
          try {
            const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/Verifications`;
            await axios.post(twilioUrl,
              new URLSearchParams({ To: telefonoDdG, Channel: 'sms' }),
              { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
            );
            console.log(`SMS nuovo dispositivo DdG inviato a ${telefonoDdG.slice(0,6)}****`);
            return res.status(401).json({
              success: false, isDdG: true,
              error: 'Nuovo dispositivo rilevato. Conferma via SMS.',
              require_device_auth: true, ddg_code: inputPulito,
              telefono_mascherato: telefonoDdG.slice(0, 6) + '****' + telefonoDdG.slice(-2)
            });
          } catch (err) {
            console.error('Errore invio SMS nuovo device DdG:', err.response?.data || err.message);
            return res.status(500).json({ success: false, error: 'Errore invio SMS. Riprova.' });
          }
        }
      }

      let deviceToken = ddgRegistrato ? ddgResult.rows[0].device_token : null;
      if (ddgVerificato && !deviceToken) {
        deviceToken = generateDeviceToken();
        await pool.query(
          'UPDATE ddg_verificati SET device_token = $1, updated_at = NOW() WHERE codice_ddg = $2',
          [deviceToken, inputPulito]
        );
      }

      console.log(`Login DdG: ${inputPulito} - ${ddgVerificato ? 'VERIFICATO' : 'NO_TWILIO'}`);

      return res.json({
        success: true, isDdG: true,
        authMethod: ddgVerificato ? 'verified' : 'none',
        device_token: deviceToken,
        pilota: {
          id: null, numero: inputPulito, nome: 'Direzione', cognome: 'Gara',
          classe: 'DdG', moto: '', team: ''
        },
        evento: {
          id: evento.id, nome: evento.nome_evento, codice_gara: evento.codice_gara,
          data: evento.data_inizio, luogo: evento.luogo,
          gps_frequenza: evento.gps_frequenza || 30, allarme_fermo_minuti: evento.allarme_fermo_minuti || 10
        }
      });
    }

    // Trova pilota
    let pilota = null;
    let eventoDelPilota = evento;

    for (const ev of eventiTrovati) {
      const pilotaResult = await pool.query(
        'SELECT * FROM piloti WHERE id_evento = $1 AND numero_gara = $2',
        [ev.id, parseInt(numero_pilota)]
      );
      if (pilotaResult.rows.length > 0) {
        pilota = pilotaResult.rows[0];
        eventoDelPilota = ev;
        break;
      }
    }

    if (!pilota) {
      return res.status(404).json({ success: false, error: `Pilota #${numero_pilota} non trovato in questa gara` });
    }

    let isVerificatoTwilio = false;
    let pilotaVerificato = null;

    if (pilota.licenza_fmi) {
      const verificatoResult = await pool.query(
        'SELECT telefono_verificato, telefono, device_token FROM piloti_verificati WHERE licenza_fmi = $1 AND telefono_verificato = TRUE',
        [pilota.licenza_fmi.toUpperCase()]
      );
      isVerificatoTwilio = verificatoResult.rows.length > 0;
      if (isVerificatoTwilio) {
        pilotaVerificato = verificatoResult.rows[0];
        if (pilotaVerificato.telefono) {
          pilota.telefono = pilotaVerificato.telefono;
        }
      }
    }

    const requestToken = req.body.device_token;
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_VERIFY_SID && isVerificatoTwilio && pilotaVerificato.device_token) {
      if (requestToken !== pilotaVerificato.device_token) {
        try {
          const twilioUrl = `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SID}/Verifications`;
          await axios.post(twilioUrl,
            new URLSearchParams({ To: pilotaVerificato.telefono, Channel: 'sms' }),
            { auth: { username: config.TWILIO_ACCOUNT_SID, password: config.TWILIO_AUTH_TOKEN } }
          );
          console.log(`SMS nuovo dispositivo pilota inviato a ${pilotaVerificato.telefono.slice(0,6)}****`);
          return res.status(401).json({
            success: false,
            error: 'Nuovo dispositivo rilevato. Conferma via SMS.',
            require_device_auth: true,
            licenza_fmi: pilota.licenza_fmi.toUpperCase(),
            telefono_mascherato: pilotaVerificato.telefono.slice(0, 6) + '****' + pilotaVerificato.telefono.slice(-2)
          });
        } catch (err) {
          console.error('Errore invio SMS nuovo device pilota:', err.response?.data || err.message);
          return res.status(500).json({ success: false, error: 'Errore invio SMS. Riprova.' });
        }
      }
    }

    let deviceToken = null;

    if (!isVerificatoTwilio) {
      if (!config.PIN_AUTH_ENABLED) {
        return res.status(401).json({ success: false, error: 'Registrati con SMS per accedere', require_registration: true });
      }
      if (!pin) {
        return res.status(401).json({ success: false, error: 'Inserisci il PIN oppure registrati con SMS', pin_required: true });
      }

      const licenza = pilota.licenza_fmi || '';
      const anno = String(pilota.anno_nascita || '');
      if (!licenza || !anno) {
        return res.status(400).json({ success: false, error: 'Dati licenza o anno mancanti. Contatta la Direzione Gara.' });
      }

      const pinCorretto = licenza.slice(-4) + anno.slice(-2);
      if (pin !== pinCorretto) {
        return res.status(401).json({ success: false, error: 'PIN errato. Controlla licenza e anno di nascita.' });
      }

      if (telefono) {
        await pool.query('UPDATE piloti SET telefono = $1 WHERE id = $2', [telefono, pilota.id]);
      }
    } else {
      if (pilotaVerificato && !pilotaVerificato.device_token) {
        deviceToken = generateDeviceToken();
        await pool.query(
          'UPDATE piloti_verificati SET device_token = $1, updated_at = NOW() WHERE licenza_fmi = $2',
          [deviceToken, pilota.licenza_fmi.toUpperCase()]
        );
      } else if (pilotaVerificato) {
        deviceToken = pilotaVerificato.device_token;
      }
    }

    console.log(`Login: Pilota #${pilota.numero_gara} - ${isVerificatoTwilio ? 'TWILIO' : 'PIN'}`);

    res.json({
      success: true, isDdG: false,
      authMethod: isVerificatoTwilio ? 'twilio' : 'pin',
      device_token: deviceToken,
      pilota: {
        id: pilota.id, numero: pilota.numero_gara, nome: pilota.nome, cognome: pilota.cognome,
        classe: pilota.classe, moto: pilota.moto, team: pilota.team,
        telefono: telefono || pilota.telefono || null, licenza_fmi: pilota.licenza_fmi
      },
      evento: {
        id: eventoDelPilota.id, nome: eventoDelPilota.nome_evento,
        codice_gara: eventoDelPilota.codice_gara, data: eventoDelPilota.data_inizio,
        luogo: eventoDelPilota.luogo, gps_frequenza: eventoDelPilota.gps_frequenza || 30,
        allarme_fermo_minuti: eventoDelPilota.allarme_fermo_minuti || 10
      }
    });
  } catch (err) {
    console.error('[POST /api/app/login] Error:', err.message);
    res.status(500).json({ success: false, error: 'Errore server' });
  }
});

module.exports = router;
