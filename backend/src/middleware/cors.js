const cors = require('cors');

// CORS - Environment-based origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Permissive during migration, but log unknown origins
      console.warn(`[CORS] Origin non in whitelist: ${origin}`);
      callback(null, true);
    }
  }
});

module.exports = corsMiddleware;
