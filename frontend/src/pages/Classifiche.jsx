import { useState, useEffect, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { API_BASE as _API_BASE } from '../services/api';
import { Card } from '../components/ui/Card';
import { Select, Label } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import SegmentedControl from '../components/ui/SegmentedControl';

const API_BASE = `${_API_BASE}/api`;

function PositionBadge({ position }) {
  const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;
  if (medal) return <span className="text-2xl" aria-label={`Posizione ${position}`}>{medal}</span>;
  return <span className="font-mono tabular-nums font-semibold text-content-primary">{position}</span>;
}

function formatSeconds(sec) {
  if (sec === null || sec === undefined || isNaN(sec)) return '—';
  const s = Math.abs(sec);
  const mins = Math.floor(s / 60);
  const rest = s - mins * 60;
  if (mins === 0) return rest.toFixed(2);
  return `${mins}:${rest.toFixed(2).padStart(5, '0')}`;
}

export default function Classifiche() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [rawRighe, setRawRighe] = useState([]);
  const [numProve, setNumProve] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filtri
  const [filtroClasse, setFiltroClasse] = useState(''); // '' = tutte
  const [filtroTeam, setFiltroTeam] = useState('');
  const [filtroMoto, setFiltroMoto] = useState('');

  useEffect(() => { loadEventi(); }, []);
  useEffect(() => { if (eventoSelezionato) loadClassifica(eventoSelezionato); }, [eventoSelezionato]);

  async function loadEventi() {
    try {
      const res = await fetch(`${API_BASE}/eventi`);
      const data = await res.json();
      setEventi(data);
      if (data.length > 0) {
        const { pickDefaultEvent, setActiveEventId } = await import('../utils/activeEvent');
        const id = pickDefaultEvent(data);
        setEventoSelezionato(id);
        const ev = data.find(e => e.id === id);
        setActiveEventId(id, ev?.codice_gara);
      }
    } catch (err) { console.error('[Classifiche]', err); }
  }

  async function loadClassifica(idEvento) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/eventi/${idEvento}/classifica`);
      if (!res.ok) { setRawRighe([]); return; }
      const raw = await res.json();
      const righe = Array.isArray(raw) ? raw : [];
      setRawRighe(righe);
      setNumProve(righe[0]?.num_prove || 0);
      // Reset filtri al cambio evento
      setFiltroClasse(''); setFiltroTeam(''); setFiltroMoto('');
    } catch (err) {
      console.error('[Classifiche]', err);
      setRawRighe([]);
    } finally {
      setLoading(false);
    }
  }

  const classi = useMemo(() => {
    const s = new Set(rawRighe.map(r => r.classe).filter(Boolean));
    return Array.from(s).sort();
  }, [rawRighe]);
  const teams = useMemo(() => {
    const s = new Set(rawRighe.map(r => r.team).filter(Boolean));
    return Array.from(s).sort();
  }, [rawRighe]);
  const motoList = useMemo(() => {
    const s = new Set(rawRighe.map(r => r.moto).filter(Boolean));
    return Array.from(s).sort();
  }, [rawRighe]);

  // Pipeline: filtra -> ordina (ps_completate DESC, tempo ASC) -> posizione + distacco ricalcolati
  const classifica = useMemo(() => {
    const filtrati = rawRighe.filter(r => {
      if (filtroClasse && r.classe !== filtroClasse) return false;
      if (filtroTeam && r.team !== filtroTeam) return false;
      if (filtroMoto && r.moto !== filtroMoto) return false;
      // Escludi piloti senza alcun tempo registrato
      const ps = parseInt(r.ps_completate || 0);
      return ps > 0;
    });

    const ordinati = [...filtrati].sort((a, b) => {
      const psA = parseInt(a.ps_completate || 0);
      const psB = parseInt(b.ps_completate || 0);
      if (psB !== psA) return psB - psA;
      const tA = a.tempo_totale != null ? parseFloat(a.tempo_totale) : Infinity;
      const tB = b.tempo_totale != null ? parseFloat(b.tempo_totale) : Infinity;
      return tA - tB;
    });

    // Leader = chi ha il max ps_completate (primo della lista dopo il sort)
    const leaderPs = ordinati[0] ? parseInt(ordinati[0].ps_completate || 0) : 0;
    const leaderTime = ordinati[0] && parseFloat(ordinati[0].tempo_totale);

    return ordinati.map((r, idx) => {
      const psC = parseInt(r.ps_completate || 0);
      const tempoNum = parseFloat(r.tempo_totale || 0);
      const pilota = [r.cognome, r.nome].filter(Boolean).join(' ').trim() || 'Senza nome';
      let distacco = '—';
      if (idx > 0 && psC === leaderPs && leaderTime) {
        distacco = `+${formatSeconds(tempoNum - leaderTime)}`;
      } else if (idx > 0 && psC < leaderPs) {
        distacco = `-${leaderPs - psC} PS`;
      }
      return {
        ...r,
        posizione: idx + 1,
        pilota,
        tempo_totale_fmt: formatSeconds(tempoNum),
        ps_completate_num: psC,
        distacco,
      };
    });
  }, [rawRighe, filtroClasse, filtroTeam, filtroMoto]);

  const eventoCorrente = eventi.find(e => e.id === eventoSelezionato);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-heading-1">Classifica Generale</h1>
        <p className="text-content-secondary mt-1 text-sm">
          {eventoCorrente ? `${eventoCorrente.nome_evento} · ${eventoCorrente.luogo || '—'}` : 'Risultati ufficiali'}
        </p>
      </div>

      {/* Event selector */}
      <Card className="mb-4">
        <div className="p-4">
          <Label>Evento</Label>
          <Select value={eventoSelezionato} onChange={(e) => setEventoSelezionato(e.target.value)}>
            {eventi.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.nome_evento} — {new Date(ev.data_inizio).toLocaleDateString('it-IT')}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Filtri segmented (classe) + select (team, moto) */}
      {rawRighe.length > 0 && (
        <Card className="mb-5">
          <div className="p-4 space-y-3">
            {classi.length > 1 && (
              <div>
                <Label>Classe</Label>
                <div className="overflow-x-auto">
                  <SegmentedControl
                    value={filtroClasse}
                    onChange={setFiltroClasse}
                    options={[{ value: '', label: 'Tutte' }, ...classi.map(c => ({ value: c, label: c }))]}
                    size="sm"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teams.length > 1 && (
                <div>
                  <Label>Motoclub / Squadra</Label>
                  <Select value={filtroTeam} onChange={(e) => setFiltroTeam(e.target.value)}>
                    <option value="">Tutti ({teams.length})</option>
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
              )}
              {motoList.length > 1 && (
                <div>
                  <Label>Moto</Label>
                  <Select value={filtroMoto} onChange={(e) => setFiltroMoto(e.target.value)}>
                    <option value="">Tutte ({motoList.length})</option>
                    {motoList.map(m => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {loading ? (
        <Card><div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div></Card>
      ) : classifica.length === 0 ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title="Nessuna classifica disponibile"
            description="Non ci sono tempi registrati per i filtri selezionati."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2">
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-content-secondary uppercase tracking-wider w-16">Pos</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-content-secondary uppercase tracking-wider w-16">N.</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider">Pilota</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden md:table-cell">Classe</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden lg:table-cell">Motoclub</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden xl:table-cell">Moto</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-content-secondary uppercase tracking-wider w-20">PS</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider">Tempo</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider w-24">Distacco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {classifica.map((row) => {
                  const psOk = numProve > 0 && row.ps_completate_num === numProve;
                  return (
                    <tr
                      key={row.id || row.numero_gara}
                      className={`hover:bg-surface-2 transition-colors ${row.posizione <= 3 ? 'bg-warning-bg/30' : ''}`}
                    >
                      <td className="px-4 py-3 text-center"><PositionBadge position={row.posizione} /></td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-700 dark:text-brand-500 font-mono text-xs font-bold px-2">{row.numero_gara}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-content-primary">{row.pilota}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {row.classe && <Badge size="sm" variant="success">{row.classe}</Badge>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-content-secondary text-xs">{row.team || '—'}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-content-secondary text-xs">{row.moto || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {numProve > 0 ? (
                          <span className={`font-mono text-xs font-semibold ${psOk ? 'text-success-fg' : 'text-warning-fg'}`}>
                            {row.ps_completate_num}/{numProve}
                          </span>
                        ) : (
                          <span className="font-mono text-xs">{row.ps_completate_num}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono tabular-nums font-semibold text-content-primary">{row.tempo_totale_fmt}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono tabular-nums text-content-tertiary text-xs">{row.distacco}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border-subtle bg-surface-2 flex items-center justify-between text-xs text-content-tertiary flex-wrap gap-2">
            <span>Piloti classificati: <strong className="text-content-primary">{classifica.length}</strong>{numProve > 0 ? ` · PS totali: ${numProve}` : ''}</span>
            <span>Aggiornato: <span className="font-mono">{new Date().toLocaleString('it-IT')}</span></span>
          </div>
        </Card>
      )}
    </div>
  );
}
