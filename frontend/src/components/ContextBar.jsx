// Barra contestuale sticky sotto la TopBar.
// Mostra: evento attivo · orologio · piloti in gara · allarmi aperti.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, AlertCircle, CalendarDays } from 'lucide-react';
import { API_BASE } from '../services/api';
import { getActiveEventId, getActiveCodiceGara } from '../utils/activeEvent';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtData(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return ''; }
}

export default function ContextBar() {
  const now = useClock();
  const [evento, setEvento] = useState(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [pilotiCount, setPilotiCount] = useState(null);

  // Ricarica evento attivo al mount e quando cambia localStorage (altra pagina ha cambiato evento)
  useEffect(() => {
    let aborted = false;
    async function load() {
      const id = getActiveEventId();
      if (!id) { setEvento(null); return; }
      try {
        const res = await fetch(`${API_BASE}/api/eventi`);
        const data = await res.json();
        if (aborted) return;
        const ev = data.find(e => e.id === id) || null;
        setEvento(ev);
      } catch {}
    }
    load();
    const handler = () => load();
    window.addEventListener('storage', handler);
    window.addEventListener('enduro-active-event-changed', handler);
    return () => { aborted = true; window.removeEventListener('storage', handler); window.removeEventListener('enduro-active-event-changed', handler); };
  }, []);

  // Polling allarmi + piloti per l'evento attivo
  useEffect(() => {
    if (!evento?.codice_gara) { setAlertsCount(0); setPilotiCount(null); return; }
    let cancelled = false;
    async function tick() {
      try {
        const r = await fetch(`${API_BASE}/api/messaggi-piloti/${encodeURIComponent(evento.codice_gara)}`);
        const d = await r.json();
        if (cancelled) return;
        const msgs = Array.isArray(d?.messaggi) ? d.messaggi : (Array.isArray(d) ? d : []);
        setAlertsCount(msgs.filter(m => !m.letto && (m.tipo === 'sos' || m.tipo_emergenza)).length);
      } catch {}
      try {
        if (evento.id) {
          const rp = await fetch(`${API_BASE}/api/eventi/${evento.id}/piloti`);
          const dp = await rp.json();
          if (cancelled) return;
          const arr = Array.isArray(dp?.piloti) ? dp.piloti : (Array.isArray(dp) ? dp : []);
          setPilotiCount(arr.length);
        }
      } catch {}
    }
    tick();
    const t = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [evento?.codice_gara, evento?.id]);

  if (!evento) {
    return (
      <div className="sticky top-14 z-[15] h-10 bg-surface/90 backdrop-blur border-b border-border-subtle flex items-center px-4 lg:px-6 text-xs text-content-tertiary">
        Nessun evento attivo
      </div>
    );
  }

  const hh = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="sticky top-14 z-[15] h-10 bg-surface/90 backdrop-blur border-b border-border-subtle flex items-center gap-3 px-4 lg:px-6 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <CalendarDays className="w-3.5 h-3.5 text-content-tertiary flex-shrink-0" />
        <span className="font-semibold text-content-primary truncate">{evento.nome_evento || evento.codice_gara}</span>
        {evento.data_inizio && <span className="text-content-tertiary hidden md:inline">· {fmtData(evento.data_inizio)}</span>}
        {evento.luogo && <span className="text-content-tertiary hidden lg:inline">· {evento.luogo}</span>}
      </div>

      <span className="h-4 w-px bg-border-subtle hidden sm:inline" />

      {pilotiCount !== null && (
        <div className="flex items-center gap-1 text-content-secondary">
          <Users className="w-3.5 h-3.5 text-content-tertiary" />
          <span className="tabular-nums">{pilotiCount}</span>
          <span className="text-content-tertiary hidden md:inline">iscritti</span>
        </div>
      )}

      <Link
        to="/messaggi-piloti"
        className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-colors ${
          alertsCount > 0
            ? 'bg-danger-bg text-danger-fg animate-pulse'
            : 'text-content-tertiary hover:text-content-primary'
        }`}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span className="tabular-nums">{alertsCount}</span>
        <span className="hidden md:inline">allarmi</span>
      </Link>

      <div className="ml-auto flex items-center gap-1 text-content-primary font-mono tabular-nums">
        <Clock className="w-3.5 h-3.5 text-content-tertiary" />
        {hh}
      </div>
    </div>
  );
}
