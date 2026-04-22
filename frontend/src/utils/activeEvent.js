// Gestione "evento attivo" condiviso tra tutte le pagine tramite localStorage.
// Quando l'utente seleziona una gara in qualsiasi dropdown, la memorizziamo come default
// così ogni altra pagina la propone già preselezionata.

const KEY = 'enduro_active_event_id';
const KEY_CODICE = 'enduro_active_event_codice';

export function getActiveEventId() {
  try { return localStorage.getItem(KEY) || null; }
  catch { return null; }
}

export function setActiveEventId(id, codiceGara) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    if (codiceGara) localStorage.setItem(KEY_CODICE, codiceGara);
    // Notifica sincrona nella stessa tab: l'evento 'storage' parte solo tra tab diverse
    try { window.dispatchEvent(new CustomEvent('enduro-active-event-changed', { detail: { id, codiceGara } })); } catch {}
  } catch {}
}

export function getActiveCodiceGara() {
  try { return localStorage.getItem(KEY_CODICE) || null; }
  catch { return null; }
}

// Ritorna l'evento default da usare in una pagina:
// - Se activeId è presente E esiste nella lista eventi → activeId
// - Altrimenti: primo evento della lista (ordinamento come arriva dall'API)
export function pickDefaultEvent(eventi) {
  if (!Array.isArray(eventi) || eventi.length === 0) return '';
  const activeId = getActiveEventId();
  if (activeId && eventi.some(e => e.id === activeId)) return activeId;
  return eventi[0].id;
}
