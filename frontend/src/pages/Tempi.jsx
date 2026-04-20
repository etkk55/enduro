import { useState, useEffect, useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { API_BASE as _API_BASE } from '../services/api';
import { Card } from '../components/ui/Card';
import { Select, Label } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import PodiumBadge from '../components/ui/PodiumBadge';
import RaceTime from '../components/ui/RaceTime';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

const API_BASE = `${_API_BASE}/api`;

function formatSeconds(sec) {
  if (sec === null || sec === undefined || isNaN(sec)) return '—';
  const s = Math.abs(sec);
  const mins = Math.floor(s / 60);
  const rest = s - mins * 60;
  if (mins === 0) return rest.toFixed(2);
  return `${mins}:${rest.toFixed(2).padStart(5, '0')}`;
}

export default function Tempi() {
  const [eventi, setEventi] = useState([]);
  const [prove, setProve] = useState([]);
  const [tempiFlat, setTempiFlat] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [provaSelezionata, setProvaSelezionata] = useState('');
  const [filtroClasse, setFiltroClasse] = useState('');
  const [loadingEventi, setLoadingEventi] = useState(true);
  const [loadingProve, setLoadingProve] = useState(false);
  const [loadingTempi, setLoadingTempi] = useState(false);
  const [errore, setErrore] = useState('');

  // 1. Load eventi
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/eventi`);
        const data = await res.json();
        setEventi(data);
        if (data.length > 0) {
          const { pickDefaultEvent } = await import('../utils/activeEvent');
          setEventoSelezionato(pickDefaultEvent(data));
        }
      } catch (e) {
        console.error('[Tempi]', e);
        setErrore('Errore caricamento eventi');
      } finally {
        setLoadingEventi(false);
      }
    })();
  }, []);

  // Memorizza evento attivo al cambio
  useEffect(() => {
    if (eventoSelezionato && eventi.length > 0) {
      const ev = eventi.find(e => e.id === eventoSelezionato);
      import('../utils/activeEvent').then(({ setActiveEventId }) => {
        setActiveEventId(eventoSelezionato, ev?.codice_gara);
      });
    }
  }, [eventoSelezionato, eventi]);

  // 2. Load prove when event changes
  useEffect(() => {
    if (!eventoSelezionato) { setProve([]); setProvaSelezionata(''); return; }
    (async () => {
      setLoadingProve(true);
      try {
        const res = await fetch(`${API_BASE}/eventi/${eventoSelezionato}/prove`);
        const data = await res.json();
        const sorted = Array.isArray(data) ? data.sort((a, b) => (a.numero_ordine || 0) - (b.numero_ordine || 0)) : [];
        setProve(sorted);
        setProvaSelezionata(sorted[0]?.id || '');
      } catch (e) {
        console.error('[Tempi]', e);
        setProve([]);
      } finally {
        setLoadingProve(false);
      }
    })();
  }, [eventoSelezionato]);

  // 3. Load tempi when prova changes
  useEffect(() => {
    if (!provaSelezionata) { setTempiFlat([]); return; }
    (async () => {
      setLoadingTempi(true);
      setFiltroClasse('');
      try {
        const res = await fetch(`${API_BASE}/prove/${provaSelezionata}/tempi`);
        const data = await res.json();
        setTempiFlat(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[Tempi]', e);
        setTempiFlat([]);
      } finally {
        setLoadingTempi(false);
      }
    })();
  }, [provaSelezionata]);

  // Compute ranking client-side
  const classifica = useMemo(() => {
    const validi = tempiFlat
      .filter(t => !t.ritirato && !t.squalificato && t.tempo_secondi !== null)
      .map(t => {
        const tempo = parseFloat(t.tempo_secondi) || 0;
        const penalita = parseFloat(t.penalita_secondi) || 0;
        return {
          ...t,
          tempo_totale_num: tempo + penalita,
          tempo_num: tempo,
          penalita_num: penalita,
          pilota: [t.cognome, t.nome].filter(Boolean).join(' ').trim(),
        };
      })
      .sort((a, b) => a.tempo_totale_num - b.tempo_totale_num);

    const leader = validi[0]?.tempo_totale_num || 0;
    return validi.map((r, idx) => ({
      ...r,
      posizione: idx + 1,
      gap: idx === 0 ? null : r.tempo_totale_num - leader,
    }));
  }, [tempiFlat]);

  const ritirati = useMemo(() => tempiFlat.filter(t => t.ritirato || t.squalificato), [tempiFlat]);

  const classi = useMemo(() => {
    const s = new Set(tempiFlat.map(t => t.classe).filter(Boolean));
    return Array.from(s).sort();
  }, [tempiFlat]);

  const classificaFiltrata = useMemo(() => {
    if (!filtroClasse) return classifica;
    return classifica
      .filter(r => r.classe === filtroClasse)
      .map((r, idx, arr) => ({
        ...r,
        posizione_classe: idx + 1,
        gap_classe: idx === 0 ? null : r.tempo_totale_num - arr[0].tempo_totale_num,
      }));
  }, [classifica, filtroClasse]);

  const provaCorrente = prove.find(p => p.id === provaSelezionata);
  const eventoCorrente = eventi.find(e => e.id === eventoSelezionato);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-heading-1">Tempi</h1>
        <p className="text-content-secondary mt-1 text-sm">
          Classifica della singola prova speciale
          {provaCorrente && eventoCorrente && (
            <> · <span className="font-mono text-content-secondary">{provaCorrente.nome_ps}</span> · {eventoCorrente.nome_evento}</>
          )}
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Evento</Label>
            <Select
              value={eventoSelezionato}
              onChange={(e) => setEventoSelezionato(e.target.value)}
              disabled={loadingEventi}
            >
              {loadingEventi && <option>Caricamento…</option>}
              {!loadingEventi && eventi.length === 0 && <option value="">Nessun evento</option>}
              {eventi.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nome_evento}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Prova Speciale</Label>
            <Select
              value={provaSelezionata}
              onChange={(e) => setProvaSelezionata(e.target.value)}
              disabled={loadingProve || prove.length === 0}
            >
              {loadingProve && <option>Caricamento…</option>}
              {!loadingProve && prove.length === 0 && <option value="">Nessuna prova</option>}
              {prove.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome_ps} {p.stato && p.stato !== 'non_iniziata' ? `· ${p.stato}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Classe</Label>
            <Select value={filtroClasse} onChange={(e) => setFiltroClasse(e.target.value)} disabled={classi.length === 0}>
              <option value="">Tutte le classi{classi.length ? ` · ${classi.length}` : ''}</option>
              {classi.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      {classifica.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card><div className="p-4"><div className="text-overline mb-1">Piloti al traguardo</div><div className="text-xl font-bold font-mono tabular-nums">{classifica.length}</div></div></Card>
          <Card><div className="p-4"><div className="text-overline mb-1">Ritirati</div><div className={`text-xl font-bold font-mono tabular-nums ${ritirati.length > 0 ? 'text-warning-fg' : ''}`}>{ritirati.length}</div></div></Card>
          <Card><div className="p-4"><div className="text-overline mb-1">Miglior tempo</div><div className="text-xl font-bold font-mono tabular-nums">{classifica[0] ? formatSeconds(classifica[0].tempo_totale_num) : '—'}</div></div></Card>
          <Card><div className="p-4"><div className="text-overline mb-1">Gap 1°-ultimo</div><div className="text-xl font-bold font-mono tabular-nums">{classifica.length > 1 ? `+${formatSeconds(classifica[classifica.length - 1].tempo_totale_num - classifica[0].tempo_totale_num)}` : '—'}</div></div></Card>
        </div>
      )}

      {/* Results */}
      {errore ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Errore"
            description={errore}
          />
        </Card>
      ) : loadingTempi ? (
        <Card>
          <div className="p-4 space-y-2.5">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        </Card>
      ) : classificaFiltrata.length === 0 ? (
        <Card>
          <EmptyState
            icon={Clock}
            title={tempiFlat.length === 0 ? 'Nessun tempo registrato' : 'Nessun pilota con questa classe'}
            description={tempiFlat.length === 0 ? 'Questa prova non ha ancora tempi. Importa dalla FICR o inserisci manualmente.' : 'Prova con un\'altra classe.'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2">
                  <th className="px-3 py-3 text-center text-2xs font-semibold text-content-secondary uppercase tracking-wider w-14">Pos</th>
                  <th className="px-3 py-3 text-center text-2xs font-semibold text-content-secondary uppercase tracking-wider w-16">N.</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider">Pilota</th>
                  <th className="px-3 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden md:table-cell">Classe</th>
                  <th className="px-3 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider">Tempo</th>
                  <th className="px-3 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden sm:table-cell">Penalita</th>
                  <th className="px-3 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider w-24">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {classificaFiltrata.map(row => {
                  const pos = filtroClasse ? row.posizione_classe : row.posizione;
                  const gap = filtroClasse ? row.gap_classe : row.gap;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-surface-2 transition-colors ${
                        pos === 1 ? 'bg-amber-50/60 dark:bg-amber-900/10' :
                        pos === 2 ? 'bg-slate-50/60 dark:bg-slate-800/20' :
                        pos === 3 ? 'bg-orange-50/60 dark:bg-orange-900/10' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <PodiumBadge position={pos} size="md" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.25rem] h-6 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-700 dark:text-brand-500 font-mono text-xs font-bold px-1.5">
                          {row.numero_gara}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-content-primary truncate">{row.pilota}</div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {row.classe && <Badge size="sm" variant="neutral">{row.classe}</Badge>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <RaceTime time={row.tempo_totale_num} size="sm" />
                      </td>
                      <td className="px-3 py-3 text-right hidden sm:table-cell">
                        {row.penalita_num > 0 ? (
                          <span className="font-mono tabular-nums text-warning-fg text-xs">+{row.penalita_num.toFixed(2)}</span>
                        ) : (
                          <span className="text-content-tertiary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {gap === null ? (
                          <span className="font-mono tabular-nums text-content-secondary text-xs">—</span>
                        ) : (
                          <span className="font-mono tabular-nums text-danger-fg text-xs">+{formatSeconds(gap)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Ritirati section */}
          {ritirati.length > 0 && !filtroClasse && (
            <div className="px-5 py-3 border-t border-border-subtle bg-warning-bg/30">
              <div className="text-overline text-warning-fg mb-1.5">{ritirati.length} {ritirati.length === 1 ? 'pilota ritirato' : 'piloti ritirati'}</div>
              <div className="flex flex-wrap gap-1">
                {ritirati.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-surface border border-border text-2xs">
                    <span className="font-mono font-semibold">#{r.numero_gara}</span>
                    <span className="text-content-secondary">{r.cognome} {r.nome}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-3 border-t border-border-subtle bg-surface-2 flex items-center justify-between text-xs text-content-tertiary flex-wrap gap-2">
            <span>Risultati: <strong className="text-content-primary">{classificaFiltrata.length}</strong>{filtroClasse && ` · filtro classe "${filtroClasse}"`}</span>
            <span>Aggiornato: <span className="font-mono">{new Date().toLocaleTimeString('it-IT')}</span></span>
          </div>
        </Card>
      )}
    </div>
  );
}
