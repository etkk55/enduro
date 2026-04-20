import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { API_BASE as _API_BASE } from '../services/api';
import { Card } from '../components/ui/Card';
import { Select, Label } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const API_BASE = `${_API_BASE}/api`;

function PositionBadge({ position }) {
  const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;
  if (medal) {
    return <span className="text-2xl" aria-label={`Posizione ${position}`}>{medal}</span>;
  }
  return <span className="font-mono tabular-nums font-semibold text-content-primary">{position}</span>;
}

export default function Classifiche() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [classifica, setClassifica] = useState([]);
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      console.error('[Classifiche]', err);
    }
  }

  async function loadClassifica(idEvento) {
    setLoading(true);
    try {
      // Endpoint corretto: /api/eventi/:id/classifica (ritorna array di piloti con tempo_totale)
      const res = await fetch(`${API_BASE}/eventi/${idEvento}/classifica`);
      if (!res.ok) {
        console.error('[Classifiche] HTTP', res.status);
        setClassifica([]);
        return;
      }
      const raw = await res.json();

      // Filtra solo piloti con tempo_totale valido (hanno tempi registrati)
      const validi = (Array.isArray(raw) ? raw : [])
        .filter(r => r.tempo_totale !== null && !isNaN(parseFloat(r.tempo_totale)))
        .map(r => ({ ...r, tempo_num: parseFloat(r.tempo_totale) }))
        .sort((a, b) => a.tempo_num - b.tempo_num);

      const leaderTime = validi[0]?.tempo_num || 0;

      const normalized = validi.map((r, idx) => ({
        ...r,
        posizione: idx + 1,
        pilota: [r.cognome, r.nome].filter(Boolean).join(' ').trim() || 'Senza nome',
        tempo_totale: formatSeconds(r.tempo_num),
        distacco: idx === 0 ? '—' : `+${formatSeconds(r.tempo_num - leaderTime)}`,
      }));

      setClassifica(normalized);
    } catch (err) {
      console.error('[Classifiche]', err);
      setClassifica([]);
    } finally {
      setLoading(false);
    }
  }

  function formatSeconds(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '—';
    const s = Math.abs(sec);
    const mins = Math.floor(s / 60);
    const rest = s - mins * 60;
    if (mins === 0) return rest.toFixed(2);
    const restStr = rest.toFixed(2).padStart(5, '0');
    return `${mins}:${restStr}`;
  }

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
      <Card className="mb-5">
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

      {/* Results */}
      {loading ? (
        <Card>
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        </Card>
      ) : classifica.length === 0 ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title="Nessuna classifica disponibile"
            description="Non ci sono tempi registrati per questo evento."
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
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-content-secondary uppercase tracking-wider hidden lg:table-cell">Moto</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider">Tempo</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-content-secondary uppercase tracking-wider w-24">Distacco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {classifica.map((row) => (
                  <tr
                    key={row.numero_gara}
                    className={`hover:bg-surface-2 transition-colors ${
                      row.posizione <= 3 ? 'bg-warning-bg/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <PositionBadge position={row.posizione} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-700 dark:text-brand-500 font-mono text-xs font-bold px-2">
                        {row.numero_gara}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-content-primary">{row.pilota}</div>
                      {row.team && <div className="text-xs text-content-tertiary mt-0.5">{row.team}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {row.classe && <Badge size="sm" variant="success">{row.classe}</Badge>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-content-secondary">
                      {row.moto || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono tabular-nums font-semibold text-content-primary">
                        {row.tempo_totale}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono tabular-nums text-content-tertiary text-xs">
                        {row.distacco || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border-subtle bg-surface-2 flex items-center justify-between text-xs text-content-tertiary flex-wrap gap-2">
            <span>Piloti classificati: <strong className="text-content-primary">{classifica.length}</strong></span>
            <span>Aggiornato: <span className="font-mono">{new Date().toLocaleString('it-IT')}</span></span>
          </div>
        </Card>
      )}
    </div>
  );
}
