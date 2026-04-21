import { useEffect, useState } from 'react';
import { API_BASE } from '../services/api';
import { pickDefaultEvent, setActiveEventId } from '../utils/activeEvent';
import { Shield, Save, RotateCcw, Check, Loader2 } from 'lucide-react';

const PRIORITA_ROWS = [
  { p: 1, label: 'Emergenza Medica', icon: '🚨', color: 'rose' },
  { p: 2, label: 'Incidente / Caduta', icon: '💥', color: 'orange' },
  { p: 3, label: 'Ostacolo Percorso', icon: '⚠️', color: 'amber' },
  { p: 4, label: 'Guasto / Foratura', icon: '🔧', color: 'blue' },
  { p: 5, label: 'Info Non Urgente', icon: 'ℹ️', color: 'green' },
];

const RUOLI_AUTO = [
  { key: 'medico', label: 'Medico' },
  { key: 'resp_ps', label: 'Resp. PS' },
  { key: 'resp_trasf', label: 'Resp. Trasf.' },
];

const ADDETTI_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Top 1' },
  { value: 2, label: 'Top 2' },
  { value: 3, label: 'Top 3' },
  { value: 5, label: 'Top 5' },
];

function emptyRouting() {
  // Default: tutto "no" / addetti_vicini 0 per tutte le priorità (DdG sempre ON, fissa fuori tabella)
  const r = {};
  for (const { p } of PRIORITA_ROWS) {
    r[String(p)] = { medico: 'no', resp_ps: 'no', resp_trasf: 'no', addetti_vicini: 0 };
  }
  return r;
}

export default function SosRouting() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [routing, setRouting] = useState(emptyRouting());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(r => r.json())
      .then(data => {
        setEventi(data);
        if (data.length > 0 && !eventoSelezionato) setEventoSelezionato(pickDefaultEvent(data));
      });
  }, []);

  useEffect(() => {
    if (eventoSelezionato && eventi.length > 0) {
      const ev = eventi.find(e => e.id === eventoSelezionato);
      setActiveEventId(eventoSelezionato, ev?.codice_gara);
      loadConfig(eventoSelezionato);
    }
  }, [eventoSelezionato, eventi]);

  async function loadConfig(eventoId) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoId}/sos-routing`);
      const data = await res.json();
      if (data.sos_routing && typeof data.sos_routing === 'object') {
        // Merge con default per garantire tutte le chiavi
        const merged = emptyRouting();
        for (const p of Object.keys(merged)) {
          if (data.sos_routing[p]) merged[p] = { ...merged[p], ...data.sos_routing[p] };
        }
        setRouting(merged);
      } else {
        setRouting(emptyRouting());
      }
    } catch (err) {
      console.error('Errore caricamento config:', err);
      setRouting(emptyRouting());
    }
    setLoading(false);
  }

  function updateCell(p, key, value) {
    setRouting(prev => ({
      ...prev,
      [String(p)]: { ...prev[String(p)], [key]: value }
    }));
  }

  async function handleSave() {
    if (!eventoSelezionato) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/sos-routing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sos_routing: routing })
      });
      const data = await res.json();
      if (data.success) {
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 2500);
      }
    } catch (err) { alert('Errore salvataggio: ' + err.message); }
    setSaving(false);
  }

  function handleReset() {
    if (!confirm('Ripristinare tutti i valori a "No" (comportamento default: solo DdG riceve)?')) return;
    setRouting(emptyRouting());
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Routing SOS automatico</h1>
          <p className="text-sm text-content-secondary">Per ogni priorità scegli chi riceve automaticamente il SOS oltre al DdG.</p>
        </div>
      </header>

      <section className="bg-surface border border-border-subtle rounded-xl p-4">
        <label className="block text-xs font-semibold uppercase text-content-tertiary mb-1">Evento</label>
        <select
          value={eventoSelezionato}
          onChange={e => setEventoSelezionato(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
        >
          <option value="">— Seleziona evento —</option>
          {eventi.map(e => (
            <option key={e.id} value={e.id}>
              {e.codice_gara} · {e.nome_evento || ''}
            </option>
          ))}
        </select>
      </section>

      <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-content-secondary">
            <strong>DdG</strong> riceve sempre ogni SOS. Le colonne qui sotto attivano invii <strong>aggiuntivi</strong>.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded-md bg-surface-2 text-content-primary font-semibold hover:bg-surface-3 flex items-center gap-1"
              title="Ripristina default (tutti No)"
            >
              <RotateCcw className="w-3 h-3" /> Default
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !eventoSelezionato}
              className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : savedAt ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {savedAt ? 'Salvato' : saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-content-tertiary">Caricamento…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-content-tertiary">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Priorità</th>
                  <th className="text-center px-3 py-2 font-semibold">DdG</th>
                  {RUOLI_AUTO.map(r => (
                    <th key={r.key} className="text-center px-3 py-2 font-semibold">{r.label}</th>
                  ))}
                  <th className="text-center px-3 py-2 font-semibold">Addetti vicini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {PRIORITA_ROWS.map(row => {
                  const cfg = routing[String(row.p)] || {};
                  return (
                    <tr key={row.p} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md bg-${row.color}-100 text-${row.color}-700 text-base`}>{row.icon}</span>
                          <div>
                            <div className="font-semibold">P{row.p} · {row.label}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold">AUTO</span>
                      </td>
                      {RUOLI_AUTO.map(r => (
                        <td key={r.key} className="px-3 py-3 text-center">
                          <select
                            value={cfg[r.key] || 'no'}
                            onChange={e => updateCell(row.p, r.key, e.target.value)}
                            className="px-2 py-1 rounded-md border border-border bg-surface text-xs"
                          >
                            <option value="no">No</option>
                            <option value="auto">Auto</option>
                          </select>
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center">
                        <select
                          value={cfg.addetti_vicini ?? 0}
                          onChange={e => updateCell(row.p, 'addetti_vicini', parseInt(e.target.value))}
                          className="px-2 py-1 rounded-md border border-border bg-surface text-xs"
                        >
                          {ADDETTI_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-content-tertiary leading-relaxed">
        "Auto" invia push + alert nell'app ERTA del ruolo indicato quando arriva un SOS della priorità corrispondente.<br />
        "Addetti vicini" = quanti addetti generici con GPS noto più vicini al punto SOS vengono notificati (0 = nessuno).<br />
        Il DdG riceve sempre ogni SOS indipendentemente da questa configurazione.
      </p>
    </div>
  );
}
