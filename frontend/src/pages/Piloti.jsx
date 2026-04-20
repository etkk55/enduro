import { useEffect, useState, useMemo } from 'react';
import { Users, MapPin, RefreshCw, Search, ExternalLink, X } from 'lucide-react';
import { API_BASE as _API_BASE } from '../services/api';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input, { Select, Label } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const API_URL = `${_API_BASE}/api`;

function tempoTrascorso(timestamp) {
  if (!timestamp) return '—';
  const diffMin = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMin < 1) return 'ora';
  if (diffMin < 60) return `${diffMin}m fa`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

function GpsCell({ posGPS }) {
  if (!posGPS) return <span className="text-content-tertiary text-xs">—</span>;
  const { lat, lon, created_at } = posGPS;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lon}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-500 hover:underline font-mono"
    >
      <MapPin className="w-3 h-3" />
      {parseFloat(lat).toFixed(4)}, {parseFloat(lon).toFixed(4)}
      <span className="text-content-tertiary font-sans">· {tempoTrascorso(created_at)}</span>
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

export default function Piloti() {
  const [piloti, setPiloti] = useState([]);
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [filtroClasse, setFiltroClasse] = useState('');
  const [filtroMoto, setFiltroMoto] = useState('');
  const [filtroMotoclub, setFiltroMotoclub] = useState('');
  const [posizioniGPS, setPosizioniGPS] = useState({});
  const [caricandoGPS, setCaricandoGPS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_URL}/eventi`).then(r => r.json()),
      fetch(`${API_URL}/piloti`).then(r => r.json()),
    ]).then(async ([ev, pl]) => {
      if (cancelled) return;
      setEventi(ev);
      setPiloti(pl);
      if (ev.length > 0 && !eventoSelezionato) {
        const { pickDefaultEvent } = await import('../utils/activeEvent');
        setEventoSelezionato(pickDefaultEvent(ev));
      }
      setLoading(false);
    }).catch(err => {
      console.error('[Piloti]', err);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!eventoSelezionato) { setPosizioniGPS({}); return; }
    caricaGps();
    const interval = setInterval(caricaGps, 30000);
    return () => clearInterval(interval);
  }, [eventoSelezionato]);

  // Reset dependent filters when event changes
  useEffect(() => {
    setFiltroClasse('');
    setFiltroMoto('');
    setFiltroMotoclub('');
  }, [eventoSelezionato]);

  async function caricaGps() {
    if (!eventoSelezionato) return;
    setCaricandoGPS(true);
    try {
      const res = await fetch(`${API_URL}/eventi/${eventoSelezionato}/posizioni-piloti`);
      const data = await res.json();
      if (data.success && data.posizioni) {
        const map = {};
        data.posizioni.forEach(p => { map[p.numero_pilota] = p; });
        setPosizioniGPS(map);
      }
    } catch (err) {
      console.error('[Piloti GPS]', err);
    } finally {
      setCaricandoGPS(false);
    }
  }

  // Piloti scoped by event first (for filter option lists)
  const pilotiScopedByEvento = useMemo(() => {
    return eventoSelezionato
      ? piloti.filter(pl => String(pl.id_evento) === String(eventoSelezionato))
      : piloti;
  }, [piloti, eventoSelezionato]);

  // Unique values for filter dropdowns (sorted)
  const classi = useMemo(() => {
    const s = new Set(pilotiScopedByEvento.map(p => p.classe).filter(Boolean));
    return Array.from(s).sort();
  }, [pilotiScopedByEvento]);
  const moto = useMemo(() => {
    const s = new Set(pilotiScopedByEvento.map(p => p.moto).filter(Boolean));
    return Array.from(s).sort();
  }, [pilotiScopedByEvento]);
  const motoclub = useMemo(() => {
    const s = new Set(pilotiScopedByEvento.map(p => p.motoclub).filter(Boolean));
    return Array.from(s).sort();
  }, [pilotiScopedByEvento]);

  // Final filtered list
  const pilotiFiltrati = useMemo(() => {
    let p = pilotiScopedByEvento;
    if (filtroClasse) p = p.filter(pl => pl.classe === filtroClasse);
    if (filtroMoto) p = p.filter(pl => pl.moto === filtroMoto);
    if (filtroMotoclub) p = p.filter(pl => pl.motoclub === filtroMotoclub);
    if (query.trim()) {
      const q = query.toLowerCase();
      p = p.filter(pl =>
        String(pl.numero_gara).includes(q) ||
        (pl.nome || '').toLowerCase().includes(q) ||
        (pl.cognome || '').toLowerCase().includes(q) ||
        (pl.classe || '').toLowerCase().includes(q) ||
        (pl.moto || '').toLowerCase().includes(q) ||
        (pl.motoclub || '').toLowerCase().includes(q)
      );
    }
    return p;
  }, [pilotiScopedByEvento, query, filtroClasse, filtroMoto, filtroMotoclub]);

  const activeFilters = [
    filtroClasse && { key: 'classe', label: `Classe: ${filtroClasse}`, clear: () => setFiltroClasse('') },
    filtroMoto && { key: 'moto', label: `Moto: ${filtroMoto}`, clear: () => setFiltroMoto('') },
    filtroMotoclub && { key: 'mc', label: `MotoClub: ${filtroMotoclub}`, clear: () => setFiltroMotoclub('') },
    query.trim() && { key: 'q', label: `"${query}"`, clear: () => setQuery('') },
  ].filter(Boolean);

  const clearAllFilters = () => {
    setFiltroClasse(''); setFiltroMoto(''); setFiltroMotoclub(''); setQuery('');
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-heading-1">Piloti</h1>
          <p className="text-content-secondary mt-1 text-sm">
            {loading ? 'Caricamento…' : `${pilotiFiltrati.length.toLocaleString('it-IT')} / ${pilotiScopedByEvento.length.toLocaleString('it-IT')} piloti`}
            {eventoSelezionato && ' · GPS refresh 30s'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="p-4 space-y-3">
          {/* Row 1: search + evento + GPS action */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto] gap-3 items-end">
            <div>
              <Label>Cerca</Label>
              <Input
                leftIcon={<Search className="w-4 h-4" />}
                placeholder="Numero, nome, cognome, motoclub…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div>
              <Label>Evento</Label>
              <Select value={eventoSelezionato} onChange={(e) => setEventoSelezionato(e.target.value)}>
                <option value="">Tutti gli eventi</option>
                {eventi.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.nome_evento}</option>
                ))}
              </Select>
            </div>
            {eventoSelezionato && (
              <Button
                variant="secondary"
                onClick={caricaGps}
                loading={caricandoGPS}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Aggiorna GPS
              </Button>
            )}
          </div>

          {/* Row 2: classe + moto + motoclub */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Classe</Label>
              <Select value={filtroClasse} onChange={(e) => setFiltroClasse(e.target.value)}>
                <option value="">Tutte le classi{classi.length ? ` · ${classi.length}` : ''}</option>
                {classi.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Moto</Label>
              <Select value={filtroMoto} onChange={(e) => setFiltroMoto(e.target.value)}>
                <option value="">Tutte le moto{moto.length ? ` · ${moto.length}` : ''}</option>
                {moto.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label>MotoClub</Label>
              <Select value={filtroMotoclub} onChange={(e) => setFiltroMotoclub(e.target.value)}>
                <option value="">Tutti i motoclub{motoclub.length ? ` · ${motoclub.length}` : ''}</option>
                {motoclub.map(mc => <option key={mc} value={mc}>{mc}</option>)}
              </Select>
            </div>
          </div>

          {/* Active filters chips */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-2xs text-content-tertiary uppercase font-semibold tracking-wider">Filtri attivi:</span>
              {activeFilters.map(f => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="inline-flex items-center gap-1 h-6 pl-2 pr-1.5 rounded-md bg-brand-50 dark:bg-brand-100/20 text-brand-700 dark:text-brand-500 text-xs font-medium border border-brand-100 dark:border-brand-500/30 hover:bg-brand-100 transition-colors"
                >
                  {f.label}
                  <X className="w-3 h-3" />
                </button>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-xs font-medium text-content-tertiary hover:text-content-primary transition-colors ml-1"
              >
                Azzera tutti
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : pilotiFiltrati.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nessun pilota trovato"
            description={activeFilters.length > 0 ? 'Prova a rimuovere qualche filtro.' : 'Importa i piloti da FICR o XML.'}
            action={activeFilters.length > 0 ? <Button variant="secondary" onClick={clearAllFilters}>Azzera filtri</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2">
                  <th className="px-4 py-2.5 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider w-16">#</th>
                  <th className="px-4 py-2.5 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider">Pilota</th>
                  <th className="px-4 py-2.5 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden md:table-cell">Classe</th>
                  <th className="px-4 py-2.5 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden lg:table-cell">Moto</th>
                  <th className="px-4 py-2.5 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden lg:table-cell">Evento</th>
                  {eventoSelezionato && (
                    <th className="px-4 py-2.5 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider">GPS</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {pilotiFiltrati.map(p => {
                  const ev = eventi.find(e => e.id === p.id_evento);
                  const posGPS = posizioniGPS[p.numero_gara];
                  return (
                    <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs tabular-nums font-semibold text-content-primary">
                        {p.numero_gara}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-content-primary">{p.cognome} {p.nome}</div>
                        {p.motoclub && (
                          <div className="text-2xs text-content-tertiary">{p.motoclub}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {p.classe && <Badge size="sm" variant="neutral">{p.classe}</Badge>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-content-secondary">
                        {p.moto || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-content-tertiary truncate max-w-xs">
                        {ev?.nome_evento || '—'}
                      </td>
                      {eventoSelezionato && (
                        <td className="px-4 py-3">
                          <GpsCell posGPS={posGPS} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
