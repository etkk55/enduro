const crypto = require('crypto');

// Funzione per generare token univoco
function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateDeviceToken };
