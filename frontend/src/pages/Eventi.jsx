import { useState, useEffect, useMemo } from 'react';
import { Calendar, Trash2, MapPin, Search, Plus } from 'lucide-react';
import { API_BASE as _API_BASE } from '../services/api';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const API_BASE = `${_API_BASE}/api`;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function DateChip({ iso }) {
  if (!iso) return null;
  const d = new Date(iso);
  return (
    <div className="w-11 h-11 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-600 dark:text-brand-500 flex flex-col items-center justify-center shrink-0">
      <div className="text-2xs font-semibold leading-none uppercase">
        {d.toLocaleDateString('it-IT', { month: 'short' })}
      </div>
      <div className="text-base font-bold leading-none mt-0.5 tabular-nums">
        {d.getDate()}
      </div>
    </div>
  );
}

function statoVariant(stato) {
  const map = {
    bozza: 'neutral',
    in_corso: 'info',
    completato: 'success',
    annullato: 'danger',
  };
  return map[stato] || 'neutral';
}

function EventItem({ evento, onDelete }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors group">
      <DateChip iso={evento.data_inizio} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-content-primary truncate">
            {evento.nome_evento || evento.nome}
          </span>
          <Badge variant={statoVariant(evento.stato)} size="sm">
            {evento.stato || 'bozza'}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-content-tertiary">
          {evento.luogo && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {evento.luogo}
            </span>
          )}
          <span className="font-mono">{evento.codice_gara}</span>
          <span className="hidden sm:inline">{formatDate(evento.data_inizio)}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(evento)}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-danger-fg hover:bg-danger-bg"
        aria-label="Elimina evento"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function LocationGroup({ luogo, eventi, onDelete }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-content-tertiary" />
          <span className="text-sm font-semibold text-content-primary">{luogo}</span>
        </div>
        <Badge size="sm" variant="neutral">
          {eventi.length} {eventi.length === 1 ? 'evento' : 'eventi'}
        </Badge>
      </div>
      <div className="divide-y divide-border-subtle">
        {eventi.map(e => (
          <EventItem key={e.id} evento={e} onDelete={onDelete} />
        ))}
      </div>
    </Card>
  );
}

export default function Eventi() {
  const [eventi, setEventi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => { loadEventi(); }, []);

  async function loadEventi() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/eventi`);
      const data = await res.json();
      setEventi(data.sort((a, b) => new Date(b.data_inizio || 0) - new Date(a.data_inizio || 0)));
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(evento) {
    if (!confirm(`Eliminare "${evento.nome_evento}"?\n\nAttenzione: saranno rimossi anche piloti, tempi e prove collegate.`)) return;
    try {
      const res = await fetch(`${API_BASE}/eventi/${evento.id}`, { method: 'DELETE' });
      if (res.ok) loadEventi();
      else alert('Errore durante eliminazione');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return eventi;
    const q = query.toLowerCase();
    return eventi.filter(e =>
      (e.nome_evento || '').toLowerCase().includes(q) ||
      (e.luogo || '').toLowerCase().includes(q) ||
      (e.codice_gara || '').toLowerCase().includes(q)
    );
  }, [eventi, query]);

  const gruppi = useMemo(() => {
    const map = {};
    filtered.forEach(e => {
      const luogo = e.luogo || 'Senza localita';
      if (!map[luogo]) map[luogo] = [];
      map[luogo].push(e);
    });
    return Object.entries(map).sort((a, b) =>
      Math.max(...b[1].map(e => new Date(e.data_inizio || 0).getTime())) -
      Math.max(...a[1].map(e => new Date(e.data_inizio || 0).getTime()))
    );
  }, [filtered]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-heading-1">Eventi</h1>
          <p className="text-content-secondary mt-1 text-sm">
            {loading ? 'Caricamento…' : `${eventi.length} evento/i configurati`}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="hidden sm:block w-64">
            <Input
              leftIcon={<Search className="w-4 h-4" />}
              placeholder="Cerca evento…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton className="h-4 w-32 mb-3" />
                <div className="space-y-3">
                  {[...Array(2)].map((__, j) => (
                    <div key={j} className="flex items-center gap-4">
                      <Skeleton className="w-11 h-11 rounded-md" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : gruppi.length === 0 ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title={query ? 'Nessun evento trovato' : 'Nessun evento configurato'}
            description={query ? 'Prova con un altro termine di ricerca.' : 'Crea il tuo primo evento dal wizard di setup.'}
            action={!query && (
              <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => window.location.href = '/setup-gara'}>
                Nuovo evento
              </Button>
            )}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {gruppi.map(([luogo, eventi]) => (
            <LocationGroup key={luogo} luogo={luogo} eventi={eventi} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
