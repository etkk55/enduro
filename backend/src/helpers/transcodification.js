const pool = require('../db/pool');

// Helper: Traduce codice FMI in array di codici FICR
async function traduciCodiceFMI(codiceFmi) {
  const result = await pool.query(
    'SELECT codice_ficr FROM codici_gara WHERE UPPER(codice_fmi) = $1',
    [codiceFmi.toUpperCase()]
  );
  return result.rows.map(r => r.codice_ficr);
}

// Helper: Cerca evento per codice (FMI o FICR)
async function cercaEventoPerCodice(codice) {
  const codiceUpper = codice.toUpperCase();

  // 1. Cerca direttamente per codice_accesso o codice_gara
  let eventoResult = await pool.query(
    'SELECT * FROM eventi WHERE UPPER(codice_accesso) = $1 OR UPPER(codice_gara) = $1',
    [codiceUpper]
  );

  if (eventoResult.rows.length > 0) {
    return eventoResult.rows;
  }

  // 2. Se non trovato, cerca transcodifica FMI -> FICR
  const codiciFicr = await traduciCodiceFMI(codiceUpper);

  if (codiciFicr.length > 0) {
    eventoResult = await pool.query(
      'SELECT * FROM eventi WHERE UPPER(codice_accesso) = ANY($1) OR UPPER(codice_gara) = ANY($1) ORDER BY codice_gara ASC',
      [codiciFicr.map(c => c.toUpperCase())]
    );
    return eventoResult.rows;
  }

  return [];
}

module.exports = { traduciCodiceFMI, cercaEventoPerCodice };
