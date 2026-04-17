const { ficrAxios } = require('../config');
const config = require('../config');

// FICR standard headers (for direct fetch/axios calls)
const FICR_HEADERS = {
  'Referer': 'https://enduro.ficr.it/',
  'Origin': 'https://enduro.ficr.it',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
};

module.exports = { ficrAxios, FICR_HEADERS, FICR_BASE_URL: config.FICR_BASE_URL };
