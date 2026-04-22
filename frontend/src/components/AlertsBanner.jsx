// Banner compatto che mostra allarmi SOS non letti per una gara.
// Si auto-aggiorna ogni 15s. Click -> naviga a /messaggi-piloti.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function AlertsBanner({ codiceGara }) {
  const [count, setCount] = useState(0);
  const [sample, setSample] = useState([]); // ultimi 3 SOS non letti per preview

  useEffect(() => {
    if (!codiceGara) { setCount(0); setSample([]); return; }
    let cancelled = false;
    async function tick() {
      try {
        const r = await fetch(`${API_BASE}/api/messaggi-piloti/${encodeURIComponent(codiceGara)}`);
        const d = await r.json();
        if (cancelled) return;
        const msgs = Array.isArray(d?.messaggi) ? d.messaggi : (Array.isArray(d) ? d : []);
        const nonLetti = msgs.filter(m => !m.letto && (m.tipo === 'sos' || m.tipo_emergenza));
        setCount(nonLetti.length);
        setSample(nonLetti.slice(0, 3));
      } catch {}
    }
    tick();
    const t = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [codiceGara]);

  if (count === 0) return null;

  return (
    <Link
      to="/messaggi-piloti"
      className="block rounded-lg border-2 border-danger-border bg-danger-bg/80 px-4 py-3 hover:bg-danger-bg transition-colors animate-pulse-slow shadow-sm"
      aria-label={`${count} allarmi attivi, clicca per gestirli`}
    >
      <div className="flex items-center gap-3 text-danger-fg">
        <AlertCircle className="w-6 h-6 flex-shrink-0" strokeWidth={2.5} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight">
            {count} {count === 1 ? 'allarme attivo' : 'allarmi attivi'}
          </div>
          <div className="text-xs mt-0.5 opacity-80 truncate">
            {sample.map(m => `#${m.numero_pilota} ${m.cognome || ''}`).filter(Boolean).join(' · ') || 'Clicca per vedere e gestire'}
          </div>
        </div>
        <span className="inline-flex items-center text-xs font-semibold gap-1">
          Gestisci <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
