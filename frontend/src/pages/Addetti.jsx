import { useEffect, useState } from 'react';
import { API_BASE } from '../services/api';
import { pickDefaultEvent, setActiveEventId } from '../utils/activeEvent';
import { Users, Plus, Trash2, RefreshCw, QrCode, Printer, X, Phone, MapPin, Stethoscope, Flag, Route as RouteIcon, HardHat } from 'lucide-react';

// URL base dell'app ERTA (PWA pilota/addetto)
const ERTA_URL = 'https://enduro-erta.vercel.app';

const RUOLI = [
  { value: 'medico', label: '🩺 Medico di Gara', icon: Stethoscope, color: 'rose' },
  { value: 'resp_ps', label: '🏁 Responsabile PS', icon: Flag, color: 'amber' },
  { value: 'resp_trasf', label: '🛣️ Responsabile Trasferimenti', icon: RouteIcon, color: 'blue' },
  { value: 'addetto', label: '👷 Addetto', icon: HardHat, color: 'gray' }
];

function ruoloInfo(ruolo) {
  return RUOLI.find(r => r.value === ruolo) || RUOLI[3];
}

export default function Addetti() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [proveSpeciali, setProveSpeciali] = useState([]);
  const [addetti, setAddetti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    ruolo: 'addetto', nome: '', cognome: '', telefono: '',
    id_ps: '', nome_settore: '', note: ''
  });
  const [savingForm, setSavingForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [qrAddetto, setQrAddetto] = useState(null);

  // Carica eventi al mount (con default evento attivo)
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(r => r.json())
      .then(data => {
        setEventi(data);
        if (data.length > 0 && !eventoSelezionato) setEventoSelezionato(pickDefaultEvent(data));
      });
  }, []);

  // Memorizza evento attivo al cambio
  useEffect(() => {
    if (eventoSelezionato && eventi.length > 0) {
      const ev = eventi.find(e => e.id === eventoSelezionato);
      setActiveEventId(eventoSelezionato, ev?.codice_gara);
    }
  }, [eventoSelezionato, eventi]);

  // Carica addetti + prove speciali al cambio evento
  useEffect(() => {
    if (!eventoSelezionato) return;
    loadAddetti();
    fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/prove`)
      .then(r => r.json())
      .then(setProveSpeciali)
      .catch(() => setProveSpeciali([]));
  }, [eventoSelezionato]);

  async function loadAddetti() {
    if (!eventoSelezionato) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/addetti`);
      const data = await res.json();
      setAddetti(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function handlePrintAllQR() {
    if (!addetti || addetti.length === 0) return;
    const evento = eventi.find(e => e.id === eventoSelezionato);
    const nomeEvento = evento?.nome_evento || evento?.codice_gara || 'Evento';
    const ruoloEmoji = { medico: '🩺', resp_ps: '🏁', resp_trasf: '🛣️', addetto: '👷' };
    const ruoloLabel = { medico: 'Medico di Gara', resp_ps: 'Responsabile PS', resp_trasf: 'Resp. Trasferimenti', addetto: 'Addetto' };

    // Ordina: medico, resp_ps, resp_trasf, addetto — poi cognome
    const ordine = { medico: 0, resp_ps: 1, resp_trasf: 2, addetto: 3 };
    const sorted = [...addetti].sort((a, b) => {
      const dr = (ordine[a.ruolo] ?? 9) - (ordine[b.ruolo] ?? 9);
      if (dr !== 0) return dr;
      return (a.cognome || '').localeCompare(b.cognome || '');
    });

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const cards = sorted.map(a => {
      const url = `${ERTA_URL}/?t=${a.token}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(url)}`;
      const dettaglio = a.nome_ps ? `PS: ${a.nome_ps}` : (a.nome_settore ? a.nome_settore : '');
      return `
        <div class="card">
          <div class="card-head">
            <span class="ruolo">${ruoloEmoji[a.ruolo] || '👷'} ${ruoloLabel[a.ruolo] || 'Addetto'}</span>
          </div>
          <div class="nome">${esc(a.nome)} ${esc(a.cognome)}</div>
          ${dettaglio ? `<div class="det">${esc(dettaglio)}</div>` : '<div class="det">&nbsp;</div>'}
          <img class="qr" src="${qrSrc}" alt="QR" />
          <div class="istruz">Inquadra con la fotocamera</div>
          ${a.telefono ? `<div class="tel">📞 ${esc(a.telefono)}</div>` : ''}
        </div>`;
    }).join('');

    // Riempi l'ultima pagina con card vuote per avere sempre griglia completa
    const vuote = (8 - (sorted.length % 8)) % 8;
    const fillers = Array.from({ length: vuote }, () => '<div class="card empty"></div>').join('');

    const html = `<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8">
<title>QR Addetti — ${esc(nomeEvento)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; color: #111; }
  .intestazione { text-align: center; padding: 6mm 0 3mm; border-bottom: 1px dashed #bbb; margin-bottom: 4mm; }
  .intestazione h1 { margin: 0; font-size: 14pt; }
  .intestazione .sub { font-size: 10pt; color: #666; margin-top: 2px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 66mm;
    gap: 0;
  }
  .card {
    border: 1px dashed #888;
    padding: 4mm 3mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    page-break-inside: avoid;
  }
  .card.empty { border-style: dashed; border-color: #ddd; }
  /* Segni di taglio agli angoli di ogni card */
  .card::before, .card::after {
    content: '';
    position: absolute;
    background: #000;
  }
  .card::before { top: 0; left: 0; width: 5mm; height: 0.3mm; box-shadow: 0 66mm 0 #000; }
  .card::after { top: 0; left: 0; width: 0.3mm; height: 5mm; box-shadow: calc(100% - 0.3mm) 0 0 #000; }
  .card-head .ruolo {
    font-size: 8pt;
    background: #fde2e2;
    color: #991b1b;
    padding: 1mm 2mm;
    border-radius: 2mm;
    font-weight: 600;
  }
  .nome { font-size: 11pt; font-weight: 700; margin-top: 2mm; line-height: 1.2; }
  .det { font-size: 8pt; color: #666; margin-top: 1mm; line-height: 1.1; min-height: 3mm; }
  .qr { width: 38mm; height: 38mm; margin: 2mm 0 1mm; }
  .istruz { font-size: 7pt; color: #888; margin-top: 0.5mm; }
  .tel { font-size: 8pt; color: #333; margin-top: 1mm; font-family: monospace; }
  /* Segni taglio nei 4 angoli del foglio */
  .crop { position: fixed; width: 8mm; height: 8mm; }
  .crop.tl { top: 2mm; left: 2mm; border-top: 0.3mm solid #000; border-left: 0.3mm solid #000; }
  .crop.tr { top: 2mm; right: 2mm; border-top: 0.3mm solid #000; border-right: 0.3mm solid #000; }
  .crop.bl { bottom: 2mm; left: 2mm; border-bottom: 0.3mm solid #000; border-left: 0.3mm solid #000; }
  .crop.br { bottom: 2mm; right: 2mm; border-bottom: 0.3mm solid #000; border-right: 0.3mm solid #000; }
  @media print {
    .no-print { display: none; }
  }
</style>
</head><body>
  <div class="crop tl"></div><div class="crop tr"></div>
  <div class="crop bl"></div><div class="crop br"></div>
  <div class="intestazione">
    <h1>QR Accesso ERTA — ${esc(nomeEvento)}</h1>
    <div class="sub">${sorted.length} addetti · Stampato il ${new Date().toLocaleDateString('it-IT')}</div>
  </div>
  <div class="grid">${cards}${fillers}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  function resetForm() {
    setForm({ ruolo: 'addetto', nome: '', cognome: '', telefono: '', id_ps: '', nome_settore: '', note: '' });
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eventoSelezionato) return alert('Seleziona prima un evento');
    if (!form.nome.trim() || !form.cognome.trim()) return alert('Nome e Cognome obbligatori');
    setSavingForm(true);
    try {
      const url = editingId
        ? `${API_BASE}/api/addetti/${editingId}`
        : `${API_BASE}/api/eventi/${eventoSelezionato}/addetti`;
      const method = editingId ? 'PATCH' : 'POST';
      const body = {
        ruolo: form.ruolo,
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        telefono: form.telefono.trim() || null,
        id_ps: form.ruolo === 'resp_ps' ? (form.id_ps || null) : null,
        // Punto di presidio: sia per 'resp_trasf' (settore) sia per 'addetto' (zona)
        nome_settore: (form.ruolo === 'resp_trasf' || form.ruolo === 'addetto')
          ? (form.nome_settore.trim() || null)
          : null,
        note: form.note.trim() || null
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert('Errore: ' + (data.error || 'impossibile salvare'));
      } else {
        resetForm();
        await loadAddetti();
      }
    } catch (err) {
      alert('Errore: ' + err.message);
    }
    setSavingForm(false);
  }

  function handleEdit(a) {
    setEditingId(a.id);
    setForm({
      ruolo: a.ruolo,
      nome: a.nome,
      cognome: a.cognome,
      telefono: a.telefono || '',
      id_ps: a.id_ps || '',
      nome_settore: a.nome_settore || '',
      note: a.note || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(a) {
    if (!confirm(`Eliminare ${a.nome} ${a.cognome} (${ruoloInfo(a.ruolo).label})?`)) return;
    const res = await fetch(`${API_BASE}/api/addetti/${a.id}`, { method: 'DELETE' });
    if (res.ok) await loadAddetti();
  }

  async function handleRegenToken(a) {
    if (!confirm(`Rigenerare il codice QR per ${a.nome} ${a.cognome}?\nIl vecchio QR non sarà più valido.`)) return;
    const res = await fetch(`${API_BASE}/api/addetti/${a.id}/regen-token`, { method: 'POST' });
    if (res.ok) {
      const updated = await res.json();
      await loadAddetti();
      setQrAddetto(updated);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Addetti al Percorso</h1>
            <p className="text-sm text-content-secondary">Medici, responsabili e addetti che ricevono i messaggi di servizio</p>
          </div>
        </div>
        <select
          value={eventoSelezionato}
          onChange={e => setEventoSelezionato(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm min-w-[240px]"
        >
          {eventi.map(e => (
            <option key={e.id} value={e.id}>{e.codice_gara} · {e.nome_evento}</option>
          ))}
        </select>
      </header>

      {/* FORM */}
      <section className="bg-surface border border-border-subtle rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {editingId ? (<><RefreshCw className="w-5 h-5 text-amber-500" /> Modifica addetto</>) : (<><Plus className="w-5 h-5 text-rose-500" /> Nuovo addetto</>)}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Ruolo</label>
            <select
              value={form.ruolo}
              onChange={e => setForm({ ...form, ruolo: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
            >
              {RUOLI.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Nome *</label>
              <input
                type="text" value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Cognome *</label>
              <input
                type="text" value={form.cognome}
                onChange={e => setForm({ ...form, cognome: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Telefono (per contatto diretto DdG)</label>
            <input
              type="tel" value={form.telefono}
              onChange={e => setForm({ ...form, telefono: e.target.value })}
              placeholder="+39 347 1234567"
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
            />
          </div>
          {form.ruolo === 'resp_ps' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Prova Speciale assegnata</label>
              <select
                value={form.id_ps}
                onChange={e => setForm({ ...form, id_ps: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
              >
                <option value="">— Seleziona PS —</option>
                {proveSpeciali.map(p => <option key={p.id} value={p.id}>PS{p.numero_ordine} · {p.nome_ps}</option>)}
              </select>
            </div>
          )}
          {form.ruolo === 'resp_trasf' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Settore / Tratto trasferimento</label>
              <input
                type="text" value={form.nome_settore}
                onChange={e => setForm({ ...form, nome_settore: e.target.value })}
                placeholder="Es. Nord / Km 10-15"
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
              />
            </div>
          )}
          {form.ruolo === 'addetto' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Zona / Punto di presidio</label>
              <input
                type="text" value={form.nome_settore}
                onChange={e => setForm({ ...form, nome_settore: e.target.value })}
                placeholder="Es. Bivio PS3 / Traguardo"
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
              />
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Note</label>
            <input
              type="text" value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
              placeholder="Opzionale"
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md bg-surface-2 text-content-secondary text-sm hover:bg-surface-3">
                Annulla
              </button>
            )}
            <button
              type="submit" disabled={savingForm || !eventoSelezionato}
              className="px-5 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
            >
              {savingForm ? 'Salvataggio…' : (editingId ? 'Aggiorna' : 'Aggiungi addetto')}
            </button>
          </div>
        </form>
      </section>

      {/* LISTA */}
      <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-lg font-semibold">Addetti registrati ({addetti.length})</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintAllQR}
              disabled={addetti.length === 0}
              className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1"
              title="Stampa tutti i QR code su A4 (8 per pagina, con segni di taglio)"
            >
              <Printer className="w-3 h-3" /> Stampa tutti i QR
            </button>
            <button onClick={loadAddetti} className="text-xs text-content-tertiary hover:text-content-primary flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Aggiorna
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-content-tertiary">Caricamento…</div>
        ) : addetti.length === 0 ? (
          <div className="p-8 text-center text-content-tertiary">
            Nessun addetto registrato. Aggiungine uno con il form qui sopra.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {addetti.map(a => {
              const info = ruoloInfo(a.ruolo);
              return (
                <li key={a.id} className="p-4 hover:bg-surface-2/50 flex items-center gap-4 flex-wrap">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-${info.color}-100 text-${info.color}-700`}>
                    <info.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{a.nome} {a.cognome}</div>
                    <div className="text-xs text-content-tertiary">
                      {info.label}
                      {a.nome_ps && <> · PS: {a.nome_ps}</>}
                      {a.nome_settore && <> · {a.nome_settore}</>}
                    </div>
                    <div className="text-xs text-content-tertiary mt-0.5 flex items-center gap-3 flex-wrap">
                      {a.telefono && (
                        <a href={`tel:${a.telefono}`} className="flex items-center gap-1 hover:text-content-primary">
                          <Phone className="w-3 h-3" /> {a.telefono}
                        </a>
                      )}
                      {a.online && (
                        <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                        </span>
                      )}
                      {a.ultima_posizione_at && !a.online && (
                        <span className="inline-flex items-center gap-1 text-content-tertiary">
                          <MapPin className="w-3 h-3" /> vista {new Date(a.ultima_posizione_at).toLocaleTimeString('it-IT')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQrAddetto(a)}
                      className="px-3 py-1.5 rounded-md bg-rose-100 text-rose-700 text-xs font-semibold hover:bg-rose-200 flex items-center gap-1"
                      title="Mostra QR code per accesso ERTA"
                    >
                      <QrCode className="w-4 h-4" /> QR
                    </button>
                    <button
                      onClick={() => handleEdit(a)}
                      className="px-3 py-1.5 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      className="px-3 py-1.5 rounded-md bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* QR MODAL */}
      {qrAddetto && (
        <QRModal addetto={qrAddetto} onClose={() => setQrAddetto(null)} onRegen={() => handleRegenToken(qrAddetto)} />
      )}
    </div>
  );
}

function QRModal({ addetto, onClose, onRegen }) {
  const url = `${ERTA_URL}/?t=${addetto.token}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
  const info = ruoloInfo(addetto.ruolo);

  function handlePrint() {
    const win = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html><head><title>QR ${addetto.cognome} ${addetto.nome}</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 24px; margin-bottom: 6px; }
        h2 { font-size: 16px; color: #666; margin: 0 0 24px; font-weight: normal; }
        img { display: block; margin: 20px auto; }
        .token { font-family: monospace; font-size: 11px; color: #888; margin-top: 12px; word-break: break-all; }
        .footer { margin-top: 40px; font-size: 14px; color: #444; }
      </style></head><body>
        <h1>${addetto.nome} ${addetto.cognome}</h1>
        <h2>${info.label}</h2>
        <img src="${qrSrc}" width="400" height="400" />
        <div class="footer">Scansiona con la fotocamera per accedere ad ERTA</div>
        <div class="token">${url}</div>
        <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{addetto.nome} {addetto.cognome}</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-content-secondary mb-4">{info.label}</p>
        <div className="flex justify-center mb-4 bg-white p-4 rounded-lg">
          <img src={qrSrc} alt="QR code accesso ERTA" className="max-w-full" width="300" height="300" />
        </div>
        <p className="text-xs text-content-tertiary break-all font-mono mb-4 p-2 bg-surface-2 rounded">{url}</p>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex-1 px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Stampa
          </button>
          <button onClick={onRegen} className="px-4 py-2 rounded-md bg-surface-2 text-content-secondary text-sm hover:bg-surface-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Rigenera
          </button>
        </div>
        <p className="text-xs text-content-tertiary mt-3">
          L'addetto scansiona questo QR con la fotocamera. Si apre ERTA e si registra in 2 secondi.
        </p>
      </div>
    </div>
  );
}
