// require('dotenv').config(); // DISABLED: Railway injects env vars directly
const express = require('express');
const config = require('./src/config');
const pool = require('./src/db/pool');
const { runMigrations } = require('./src/db/migrations');
const corsMiddleware = require('./src/middleware/cors');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// ==================== MIDDLEWARE ====================
app.use(corsMiddleware);
app.use(express.json({ limit: '15mb' }));

// ==================== ROUTES ====================
app.use(require('./src/routes/utilities'));
app.use(require('./src/routes/codiciGara'));
app.use(require('./src/routes/eventi'));
app.use(require('./src/routes/piloti'));
app.use(require('./src/routes/proveTempi'));
app.use(require('./src/routes/ficr'));
app.use(require('./src/routes/comunicati'));
app.use(require('./src/routes/pushNotifications'));
app.use(require('./src/routes/auth'));
app.use(require('./src/routes/appLogin'));
app.use(require('./src/routes/appPilotData'));
app.use(require('./src/routes/appPublic'));
app.use(require('./src/routes/appMessaging'));
app.use(require('./src/routes/appSquadre'));
app.use(require('./src/routes/emergency'));
app.use(require('./src/routes/tempiSettore'));
app.use(require('./src/routes/addetti'));

// ==================== ERROR HANDLER ====================
app.use(errorHandler);

// ==================== STARTUP ====================
async function start() {
  try {
    const dbTest = await pool.query('SELECT NOW()');
    console.log(`[DB] Connesso: ${dbTest.rows[0].now}`);

    await runMigrations();
    console.log('[STARTUP] Migrazioni completate');

    const server = app.listen(config.PORT, () => {
      console.log(`[SERVER] Porta ${config.PORT}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`[SHUTDOWN] ${signal} ricevuto, chiudo connessioni...`);
      server.close(() => {
        pool.end(() => {
          console.log('[SHUTDOWN] Pool chiuso, esco.');
          process.exit(0);
        });
      });
      setTimeout(() => {
        console.error('[SHUTDOWN] Timeout, force exit');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[STARTUP] Errore fatale:', err.message);
    process.exit(1);
  }
}

start();
