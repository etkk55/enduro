const pool = require('./pool');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[MIGRATIONS] Avvio migrazioni...');

    // Auto-migrazione: aggiungi colonne PDF se non esistono
    await client.query(`
      ALTER TABLE comunicati
      ADD COLUMN IF NOT EXISTS pdf_allegato TEXT,
      ADD COLUMN IF NOT EXISTS pdf_nome VARCHAR(255);
    `);

    // Crea funzione get_next_comunicato_number se non esiste
    await client.query(`
      CREATE OR REPLACE FUNCTION get_next_comunicato_number(p_codice_gara VARCHAR)
      RETURNS INTEGER AS $$
      DECLARE
        next_num INTEGER;
      BEGIN
        SELECT COALESCE(MAX(numero), 0) + 1 INTO next_num
        FROM comunicati
        WHERE codice_gara = p_codice_gara;
        RETURN next_num;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`ALTER TABLE eventi ADD COLUMN IF NOT EXISTS codice_accesso VARCHAR(20) UNIQUE;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messaggi_piloti (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        codice_gara VARCHAR(50) NOT NULL,
        numero_pilota INTEGER NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'messaggio',
        testo TEXT,
        gps_lat DECIMAL(10, 8),
        gps_lon DECIMAL(11, 8),
        letto BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_messaggi_codice_gara ON messaggi_piloti(codice_gara);
      CREATE INDEX IF NOT EXISTS idx_messaggi_tipo ON messaggi_piloti(tipo);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS squadre (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        codice_gara VARCHAR(50) NOT NULL,
        nome_squadra VARCHAR(100) NOT NULL,
        creatore_numero INTEGER NOT NULL,
        membri INTEGER[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_squadre_codice_gara ON squadre(codice_gara);
      CREATE INDEX IF NOT EXISTS idx_squadre_creatore ON squadre(creatore_numero);
    `);

    await client.query(`
      ALTER TABLE eventi
      ADD COLUMN IF NOT EXISTS paddock1_lat DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS paddock1_lon DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS paddock2_lat DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS paddock2_lon DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS paddock_raggio INTEGER DEFAULT 500,
      ADD COLUMN IF NOT EXISTS gps_frequenza INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS allarme_fermo_minuti INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS codice_ddg VARCHAR(20);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS posizioni_piloti (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        codice_gara VARCHAR(50) NOT NULL,
        numero_pilota INTEGER NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lon DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_posizioni_codice_gara ON posizioni_piloti(codice_gara);
      CREATE INDEX IF NOT EXISTS idx_posizioni_pilota ON posizioni_piloti(numero_pilota);
      CREATE INDEX IF NOT EXISTS idx_posizioni_created ON posizioni_piloti(created_at DESC);
    `);

    await client.query(`ALTER TABLE comunicati ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'comunicato';`);

    await client.query(`
      CREATE OR REPLACE FUNCTION get_next_comunicato_number(p_codice_gara VARCHAR, p_tipo VARCHAR DEFAULT 'comunicato')
      RETURNS INTEGER AS $$
      DECLARE
        next_num INTEGER;
      BEGIN
        SELECT COALESCE(MAX(numero), 0) + 1 INTO next_num
        FROM comunicati
        WHERE codice_gara = p_codice_gara AND tipo = p_tipo;
        RETURN next_num;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comunicati_codice_gara_numero_key') THEN
          ALTER TABLE comunicati DROP CONSTRAINT comunicati_codice_gara_numero_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comunicati_codice_gara_numero_tipo_key') THEN
          ALTER TABLE comunicati ADD CONSTRAINT comunicati_codice_gara_numero_tipo_key UNIQUE (codice_gara, numero, tipo);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tempi_settore (
        id SERIAL PRIMARY KEY,
        id_evento UUID REFERENCES eventi(id) ON DELETE CASCADE,
        codice_gara VARCHAR(20),
        co1_attivo BOOLEAN DEFAULT true,
        co2_attivo BOOLEAN DEFAULT true,
        co3_attivo BOOLEAN DEFAULT false,
        tempo_par_co1 INTEGER,
        tempo_co1_co2 INTEGER,
        tempo_co2_co3 INTEGER,
        tempo_ultimo_arr INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_evento, codice_gara)
      );
    `);

    await client.query(`ALTER TABLE piloti ADD COLUMN IF NOT EXISTS orario_partenza VARCHAR(10);`);
    await client.query(`ALTER TABLE piloti ADD COLUMN IF NOT EXISTS licenza_fmi VARCHAR(20), ADD COLUMN IF NOT EXISTS anno_nascita INTEGER;`);
    await client.query(`ALTER TABLE piloti ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);`);
    await client.query(`ALTER TABLE eventi ADD COLUMN IF NOT EXISTS codice_fmi VARCHAR(20);`);
    await client.query(`ALTER TABLE eventi ADD COLUMN IF NOT EXISTS ficr_anno INTEGER, ADD COLUMN IF NOT EXISTS ficr_codice_equipe VARCHAR(10), ADD COLUMN IF NOT EXISTS ficr_manifestazione VARCHAR(10);`);
    await client.query(`ALTER TABLE eventi ADD COLUMN IF NOT EXISTS codice_accesso_pubblico VARCHAR(50);`);
    await client.query(`ALTER TABLE eventi ADD COLUMN IF NOT EXISTS ficr_categoria INTEGER;`);

    // p34: Migrazione codice_gara al nuovo formato (idempotente: WHERE filtra solo vecchio formato)
    const migResult = await client.query(`
      UPDATE eventi
      SET
        ficr_categoria = CAST(split_part(codice_gara, '-', 2) AS INTEGER),
        codice_gara = ficr_anno || '-' || ficr_codice_equipe || '-' || codice_gara
      WHERE
        ficr_anno IS NOT NULL
        AND ficr_codice_equipe IS NOT NULL
        AND codice_gara NOT LIKE '%-%-%-%'
        AND codice_gara LIKE '%-%';
    `);
    if (migResult.rowCount > 0) {
      console.log(`[MIGRATIONS] p34: Migrati ${migResult.rowCount} eventi al nuovo formato codice_gara`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS piloti_verificati (
        id SERIAL PRIMARY KEY,
        licenza_fmi VARCHAR(20) UNIQUE NOT NULL,
        telefono VARCHAR(20) NOT NULL,
        telefono_verificato BOOLEAN DEFAULT FALSE,
        nome VARCHAR(100),
        cognome VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_piloti_verificati_licenza ON piloti_verificati(licenza_fmi);
      CREATE INDEX IF NOT EXISTS idx_piloti_verificati_telefono ON piloti_verificati(telefono);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ddg_verificati (
        id SERIAL PRIMARY KEY,
        codice_ddg VARCHAR(20) UNIQUE NOT NULL,
        telefono VARCHAR(20) NOT NULL,
        telefono_verificato BOOLEAN DEFAULT FALSE,
        nome VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ddg_verificati_codice ON ddg_verificati(codice_ddg);
    `);

    await client.query(`
      ALTER TABLE piloti_verificati ADD COLUMN IF NOT EXISTS device_token VARCHAR(64) UNIQUE;
      ALTER TABLE ddg_verificati ADD COLUMN IF NOT EXISTS device_token VARCHAR(64) UNIQUE;
      CREATE INDEX IF NOT EXISTS idx_piloti_verificati_token ON piloti_verificati(device_token);
      CREATE INDEX IF NOT EXISTS idx_ddg_verificati_token ON ddg_verificati(device_token);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS codici_gara (
        id SERIAL PRIMARY KEY,
        codice_fmi VARCHAR(20) NOT NULL,
        codice_ficr VARCHAR(20) NOT NULL,
        descrizione VARCHAR(100),
        anno INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(codice_fmi, codice_ficr)
      );
      CREATE INDEX IF NOT EXISTS idx_codici_gara_fmi ON codici_gara(codice_fmi);
      CREATE INDEX IF NOT EXISTS idx_codici_gara_ficr ON codici_gara(codice_ficr);
    `);

    await client.query(`
      ALTER TABLE tempi_settore
      ADD COLUMN IF NOT EXISTS co4_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS co5_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS co6_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS co7_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS co8_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS co9_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS co10_attivo BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS tempo_co3_co4 INTEGER,
      ADD COLUMN IF NOT EXISTS tempo_co4_co5 INTEGER,
      ADD COLUMN IF NOT EXISTS tempo_co5_co6 INTEGER,
      ADD COLUMN IF NOT EXISTS tempo_co6_co7 INTEGER,
      ADD COLUMN IF NOT EXISTS tempo_co7_co8 INTEGER,
      ADD COLUMN IF NOT EXISTS tempo_co8_co9 INTEGER,
      ADD COLUMN IF NOT EXISTS tempo_co9_co10 INTEGER;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        codice_gara VARCHAR(50) NOT NULL,
        numero_pilota INTEGER,
        ruolo VARCHAR(20) NOT NULL DEFAULT 'pilota',
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(endpoint)
      );
      CREATE INDEX IF NOT EXISTS idx_push_subs_gara ON push_subscriptions(codice_gara);
      CREATE INDEX IF NOT EXISTS idx_push_subs_ruolo ON push_subscriptions(ruolo);
    `);

    // Aggiunge id_addetto a push_subscriptions per notifiche mirate ai marshalls
    await client.query(`
      ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS id_addetto UUID;
      CREATE INDEX IF NOT EXISTS idx_push_subs_addetto ON push_subscriptions(id_addetto);
    `);

    // Addetti al percorso (medico, resp PS, resp trasferimenti, addetti generici)
    await client.query(`
      CREATE TABLE IF NOT EXISTS addetti (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_evento UUID NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
        ruolo VARCHAR(20) NOT NULL DEFAULT 'addetto',
        nome VARCHAR(100) NOT NULL,
        cognome VARCHAR(100) NOT NULL,
        telefono VARCHAR(30),
        id_ps UUID REFERENCES prove_speciali(id) ON DELETE SET NULL,
        nome_settore VARCHAR(100),
        token VARCHAR(80) NOT NULL UNIQUE,
        note TEXT,
        ultima_lat DECIMAL(10, 8),
        ultima_lon DECIMAL(11, 8),
        ultima_posizione_at TIMESTAMP,
        ultimo_accesso_at TIMESTAMP,
        attivo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_addetti_evento ON addetti(id_evento);
      CREATE INDEX IF NOT EXISTS idx_addetti_ruolo ON addetti(ruolo);
      CREATE INDEX IF NOT EXISTS idx_addetti_token ON addetti(token);
    `);

    // Alerts inviati agli addetti (SOS, segnalazioni) — dopo addetti per FK
    await client.query(`
      CREATE TABLE IF NOT EXISTS addetti_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_addetto UUID NOT NULL REFERENCES addetti(id) ON DELETE CASCADE,
        id_messaggio UUID REFERENCES messaggi_piloti(id) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL DEFAULT 'sos',
        testo TEXT,
        pilota_numero INTEGER,
        pilota_nome VARCHAR(200),
        gps_lat DECIMAL(10, 8),
        gps_lon DECIMAL(11, 8),
        distanza_m INTEGER,
        preso_in_carico BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_addetti_alerts_addetto ON addetti_alerts(id_addetto);
      CREATE INDEX IF NOT EXISTS idx_addetti_alerts_created ON addetti_alerts(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('[MIGRATIONS] Completate con successo');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[MIGRATIONS] FALLITE, rollback eseguito:', err.message);
    throw err; // propagate to startup to exit(1)
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
