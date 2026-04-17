const { Pool } = require('pg');

// PostgreSQL Pool - Railway provides DATABASE_URL as environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  application_name: 'enduro-backend'
});

module.exports = pool;
