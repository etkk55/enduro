import { useState, useEffect, useMemo } from 'react';
import { Trophy, Users, Building2 } from 'lucide-react';
import { API_BASE as _API_BASE } from '../services/api';
import { Card } from '../components/ui/Card';
import { Select, Label } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import SegmentedControl from '../components/ui/SegmentedControl';

const API_BASE = `${_API_BASE}/api`;

// Classi a soglia ridotta (femminili): costituita da 2 piloti invece di 3
const CLASSI_FEMMINILI = new Set(['MEF', 'FC', 'FU', 'FO', 'SF']);

// Punti per posizione in classe (replica logica ERTA)
function puntiPerPosizione(pos) {
  if (pos === 1) return 20;
  if (pos === 2) return 17;
  if (pos === 3) return 15;
  if (pos === 4) return 13;
  if (pos === 5) return 11;
  if (pos >= 6 && pos <= 15) return 16 - pos; // 6°=10 ... 15°=1
  return 0;
}

// Parse "m:ss.d" oppure "ss.d" -> secondi
function parseTempo(str) {
  if (!str || typeof str !== 'string') return Infinity;
  if (/RIT|DSQ/i.test(str)) return Infinity;
  const parts = str.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0]); const s = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(s)) return Infinity;
    return m * 60 + s;
  }
  const s = parseFloat(str);
  return isNaN(s) ? Infinity : s;
}

function formatSec(sec) {
  if (!isFinite(sec)) return '—';
  const s = Math.abs(sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m === 0 ? rest.toFixed(1) : `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

function PositionBadge({ position }) {
  const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;
  if (medal) return <span className="text-2xl" aria-label={`Posizione ${position}`}>{medal}</span>;
  return <span className="font-mono tabular-nums font-semibold text-content-primary">{position}</span>;
}

// Conta PS completate (ha tempo valido) su array prove
function countPSCompletate(p, numProve) {
  let c = 0;
  for (let i = 1; i <= numProve; i++) {
    const v = p[`ps${i}_time`];
    if (v && parseFloat(v) > 0) c++;
  }
  return c;
}

// ============================================================================
// Tabella piloti (usata per vista Classi e Club)
// ============================================================================
function TabellaPiloti({ piloti, numProve }) {
  if (piloti.length === 0) {
    return (
      <Card>
        <EmptyState icon={Trophy} title="Nessun risultato" description="Nessun pilota corrisponde ai filtri selezionati." />
      </Card>
    );
  }
  const leaderTempo = piloti[0]?.tempoSec ?? Infinity;
  const leaderPs = piloti[0]?.psCompletate ?? 0;

  return (
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
            {piloti.map((p, idx) => {
              const pos = idx + 1;
              let dist = '—';
              if (idx > 0) {
                if (p.psCompletate < leaderPs) dist = `-${leaderPs - p.psCompletate} PS`;
                else if (isFinite(p.tempoSec) && isFinite(leaderTempo)) dist = `+${formatSec(p.tempoSec - leaderTempo)}`;
              }
              const psOk = numProve > 0 && p.psCompletate === numProve;
              return (
                <tr key={`${p.num}-${idx}`} className={`hover:bg-surface-2 transition-colors ${pos <= 3 ? 'bg-warning-bg/30' : ''}`}>
                  <td className="px-4 py-3 text-center"><PositionBadge position={pos} /></td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-700 dark:text-brand-500 font-mono text-xs font-bold px-2">{p.num}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-content-primary">{p.cognome} {p.nome}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.classe && <Badge size="sm" variant="success">{p.classe}</Badge>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-content-secondary text-xs">{p.team || '—'}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-content-secondary text-xs">{p.moto || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {numProve > 0 ? (
                      <span className={`font-mono text-xs font-semibold ${psOk ? 'text-success-fg' : 'text-warning-fg'}`}>
                        {p.psCompletate}/{numProve}
                      </span>
                    ) : <span className="font-mono text-xs">{p.psCompletate}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono tabular-nums font-semibold text-content-primary">{p.totale || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono tabular-nums text-content-tertiary text-xs">{dist}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-border-subtle bg-surface-2 flex items-center justify-between text-xs text-content-tertiary flex-wrap gap-2">
        <span>Piloti: <strong className="text-content-primary">{piloti.length}</strong>{numProve > 0 ? ` · PS totali: ${numProve}` : ''}</span>
        <span>Aggiornato: <span className="font-mono">{new Date().toLocaleString('it-IT')}</span></span>
      </div>
    </Card>
  );
}

// ============================================================================
// Card Squadra (raggruppamento per MotoClub con punti)
// ============================================================================
function SquadraCard({ pos, squadra }) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const podio = pos <= 3;
  return (
    <Card className={`overflow-hidden ${podio ? 'border-warning-border bg-warning-bg/10' : ''}`}>
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-3">
        <div className="flex-shrink-0">
          {podio ? <span className="text-3xl">{medals[pos]}</span> : <span className="text-xl font-bold text-content-primary">{pos}°</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-content-primary truncate">{squadra.motoclub}</div>
          <div className="text-xs text-content-tertiary">{squadra.pilotiCostituti}/{squadra.piloti.length} piloti a punti</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums text-content-primary">{squadra.totPunti}</div>
          <div className="text-2xs text-content-tertiary uppercase tracking-wider">Punti</div>
        </div>
      </div>
      <div className="divide-y divide-border-subtle">
        {squadra.piloti.map(p => (
          <div key={p.num} className={`px-4 py-2 flex items-center gap-3 text-sm ${p.classeCostituta ? '' : 'opacity-60'}`}>
            <span className="font-mono text-xs text-content-tertiary">#{p.num}</span>
            <span className="flex-1 truncate">
              <span className="font-semibold text-content-primary">{p.cognome}</span>
              <span className="text-xs text-content-tertiary ml-2">{p.classe}{!p.classeCostituta ? ' · non costituita' : ''}</span>
            </span>
            <span className={`font-mono font-bold ${p.classeCostituta ? 'text-content-primary' : 'text-content-tertiary'}`}>{p.classeCostituta ? p.punti : 0}pt</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Main
// ============================================================================
export default function Classifiche() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [classificaGen, setClassificaGen] = useState([]); // array piloti con ps1_time..
  const [numProve, setNumProve] = useState(0);
  const [loading, setLoading] = useState(false);

  // Tab + filtri
  const [vista, setVista] = useState('classi'); // 'classi' | 'club' | 'squadre'
  const [filtroClasse, setFiltroClasse] = useState('');
  const [filtroTeam, setFiltroTeam] = useState('');

  useEffect(() => { loadEventi(); }, []);
  useEffect(() => { if (eventoSelezionato) loadDati(eventoSelezionato); }, [eventoSelezionato]);

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

  async function loadDati(idEvento) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/eventi/${idEvento}/export-replay`);
      if (!res.ok) { setClassificaGen([]); setNumProve(0); return; }
      const data = await res.json();
      const prove = data.prove || [];
      setNumProve(prove.length);
      const snapshots = data.snapshots || [];
      // Prendi l'ultimo snapshot con piloti attivi, altrimenti l'ultimo
      const snap = [...snapshots].reverse().find(s => s.classifica?.some(p => p.stato === 'attivo')) || snapshots[snapshots.length - 1];
      setClassificaGen(snap?.classifica || []);
      setFiltroClasse(''); setFiltroTeam('');
    } catch (err) {
      console.error('[Classifiche]', err);
      setClassificaGen([]);
      setNumProve(0);
    } finally { setLoading(false); }
  }

  // Memoized
  const classi = useMemo(() => [...new Set(classificaGen.map(p => p.classe).filter(Boolean))].sort(), [classificaGen]);
  const teams = useMemo(() => [...new Set(classificaGen.map(p => p.team).filter(Boolean))].sort(), [classificaGen]);

  // Dati arricchiti con psCompletate + tempoSec
  const classificaEnriched = useMemo(() => {
    return classificaGen.map(p => ({
      ...p,
      psCompletate: countPSCompletate(p, numProve),
      tempoSec: parseTempo(p.totale),
    }));
  }, [classificaGen, numProve]);

  // Vista Classi/Club: filtra e ordina (PS desc, tempo asc)
  const classificaIndividuale = useMemo(() => {
    let dati = [...classificaEnriched];
    if (filtroClasse) dati = dati.filter(p => p.classe === filtroClasse);
    if (filtroTeam) dati = dati.filter(p => p.team === filtroTeam);
    dati.sort((a, b) => {
      if (b.psCompletate !== a.psCompletate) return b.psCompletate - a.psCompletate;
      return a.tempoSec - b.tempoSec;
    });
    return dati;
  }, [classificaEnriched, filtroClasse, filtroTeam]);

  // Vista Squadre: punti per motoclub
  const classificaSquadre = useMemo(() => {
    if (classificaEnriched.length === 0) return [];
    // Conteggio per classe
    const countPerClasse = {};
    classificaEnriched.forEach(p => {
      const c = p.classe || 'N/D';
      countPerClasse[c] = (countPerClasse[c] || 0) + 1;
    });
    // Costituite: classe con almeno 3 (2 se femminile)
    const classiCostituite = {};
    Object.keys(countPerClasse).forEach(c => {
      const soglia = CLASSI_FEMMINILI.has(c) ? 2 : 3;
      classiCostituite[c] = countPerClasse[c] >= soglia;
    });
    // Ordina per classe e assegna punti
    const classi = [...new Set(classificaEnriched.map(p => p.classe).filter(Boolean))];
    const pilotiConPunti = [];
    classi.forEach(classe => {
      const pilotiClasse = classificaEnriched
        .filter(p => p.classe === classe)
        .sort((a, b) => a.tempoSec - b.tempoSec);
      const costituta = classiCostituite[classe];
      pilotiClasse.forEach((p, i) => {
        const posInClasse = i + 1;
        pilotiConPunti.push({
          ...p,
          posInClasse,
          classeCostituta: costituta,
          punti: costituta ? puntiPerPosizione(posInClasse) : 0,
        });
      });
    });
    // Raggruppa per motoclub
    const byMotoclub = {};
    pilotiConPunti.forEach(p => {
      const mc = p.team || 'Senza MotoClub';
      byMotoclub[mc] = byMotoclub[mc] || [];
      byMotoclub[mc].push(p);
    });
    // Calcola classifica squadre
    const arr = Object.keys(byMotoclub).map(mc => {
      const piloti = byMotoclub[mc].sort((a, b) => {
        if (b.punti !== a.punti) return b.punti - a.punti;
        return a.tempoSec - b.tempoSec;
      });
      const top3 = piloti.slice(0, 3);
      const totPunti = top3.reduce((s, p) => s + p.punti, 0);
      const pilotiCostituti = top3.filter(p => p.classeCostituta).length;
      const migliorTempoAss = Math.min(...top3.map(p => p.tempoSec));
      return { motoclub: mc, piloti: top3, totPunti, pilotiCostituti, migliorTempoAss };
    });
    arr.sort((a, b) => {
      if (b.totPunti !== a.totPunti) return b.totPunti - a.totPunti;
      return a.migliorTempoAss - b.migliorTempoAss;
    });
    return arr;
  }, [classificaEnriched]);

  const eventoCorrente = eventi.find(e => e.id === eventoSelezionato);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-heading-1 flex items-center gap-2"><Trophy className="w-6 h-6 text-warning-fg" /> Classifica Generale</h1>
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

      {/* Tab selector */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <SegmentedControl
          value={vista}
          onChange={setVista}
          options={[
            { value: 'classi', label: 'Classi', icon: <Trophy className="w-3.5 h-3.5 inline" /> },
            { value: 'club', label: 'Club', icon: <Building2 className="w-3.5 h-3.5 inline" /> },
            { value: 'squadre', label: 'Squadre', icon: <Users className="w-3.5 h-3.5 inline" /> },
          ]}
        />
      </div>

      {/* Filtri contestuali */}
      {(vista === 'classi' || vista === 'club') && classificaGen.length > 0 && (
        <Card className="mb-5">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vista === 'classi' && classi.length > 0 && (
              <div>
                <Label>Classe</Label>
                <Select value={filtroClasse} onChange={(e) => setFiltroClasse(e.target.value)}>
                  <option value="">Tutte le classi ({classi.length})</option>
                  {classi.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            )}
            {vista === 'club' && teams.length > 0 && (
              <div>
                <Label>Motoclub</Label>
                <Select value={filtroTeam} onChange={(e) => setFiltroTeam(e.target.value)}>
                  <option value="">Tutti i Motoclub ({teams.length})</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <Card><div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div></Card>
      ) : classificaGen.length === 0 ? (
        <Card>
          <EmptyState icon={Trophy} title="Nessuna classifica disponibile" description="Non ci sono tempi registrati per questo evento." />
        </Card>
      ) : vista === 'squadre' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {classificaSquadre.map((sq, i) => <SquadraCard key={sq.motoclub} pos={i + 1} squadra={sq} />)}
        </div>
      ) : (
        <TabellaPiloti piloti={classificaIndividuale} numProve={numProve} />
      )}
    </div>
  );
}
