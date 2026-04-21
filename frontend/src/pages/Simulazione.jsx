import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, MapPin } from 'lucide-react';

const ControlloGara = lazy(() => import('./ControlloGara'));
const SimulazioneMappa = lazy(() => import('./SimulazioneMappa'));

const TABS = [
  { key: 'gara', label: 'Gara', icon: Activity },
  { key: 'mappa', label: 'Mappa', icon: MapPin },
];

export default function Simulazione() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [tab, setTab] = useState(params.get('tab') === 'mappa' ? 'mappa' : 'gara');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const t = q.get('tab');
    if (t && t !== tab && (t === 'gara' || t === 'mappa')) setTab(t);
  }, [location.search]);

  function selectTab(k) {
    setTab(k);
    navigate(`/simulazione?tab=${k}`, { replace: true });
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <nav className="flex border-b border-border-subtle bg-surface sticky top-0 z-30">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
              className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${active ? 'border-rose-600 text-rose-600' : 'border-transparent text-content-secondary hover:text-content-primary hover:border-border'}`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1">
        <Suspense fallback={<div className="p-8 text-center text-content-tertiary">Caricamento…</div>}>
          {tab === 'gara' ? <ControlloGara /> : <SimulazioneMappa />}
        </Suspense>
      </div>
    </div>
  );
}
