import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, TrendingUp, TrendingDown, Minus, Trophy, Target, HelpCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, LabelList } from 'recharts';

import { API_BASE } from '../services/api';

// Palette 8 colori contrastati
const COLORI = {
  tu: '#1f77b4',      // Blu scuro (pilota corrente)
  sopra: ['#2ca02c', '#17becf', '#9467bd'],  // Verde, Azzurro, Viola
  sotto: ['#d62728', '#ff7f0e', '#FFD700']   // Rosso, Arancione, Giallo
};

// Tooltip custom per grafico posizioni
const CustomTooltipPosizioni = ({ active, payload, label, legendaData }) => {
  if (!active || !payload || !legendaData) return null;
  
  // Ordina per posizione (valore più basso = posizione migliore)
  const sorted = [...payload]
    .filter(p => p.value !== null)
    .sort((a, b) => a.value - b.value);
  
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="font-bold text-white mb-2">{label}</p>
      {sorted.map((entry) => {
        const numStr = entry.dataKey.replace('p', '');
        const num = parseInt(numStr);
        const pilota = legendaData.find(l => l.num === num);
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.stroke }} />
            <span style={{ color: entry.stroke }} className="font-bold">#{num}</span>
            <span className="text-gray-300">{pilota?.nome || ''}</span>
            <span className="text-white font-mono ml-auto">{entry.value}°</span>
          </div>
        );
      })}
    </div>
  );
};

// Tooltip custom per grafico scostamenti
const CustomTooltipScostamenti = ({ active, payload, label, legendaData }) => {
  if (!active || !payload || !legendaData) return null;
  
  // Ordina per scostamento crescente (dall'alto al basso nel grafico con asse invertito)
  const sorted = [...payload]
    .filter(p => p.value !== null)
    .sort((a, b) => a.value - b.value);
  
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="font-bold text-white mb-2">{label}</p>
      {sorted.map((entry) => {
        const numStr = entry.dataKey.replace('t', '');
        const num = parseInt(numStr);
        const pilota = legendaData.find(l => l.num === num);
        const valStr = entry.value > 0 ? `+${entry.value.toFixed(2)}s` : `${entry.value.toFixed(2)}s`;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.stroke }} />
            <span style={{ color: entry.stroke }} className="font-bold">#{num}</span>
            <span className="text-gray-300">{pilota?.nome || ''}</span>
            <span className="text-white font-mono ml-auto">{valStr}</span>
          </div>
        );
      })}
    </div>
  );
};

// Tooltip custom per grafico cumulato
const CustomTooltipCumulato = ({ active, payload, label, legendaData }) => {
  if (!active || !payload || !legendaData) return null;
  
  // Ordina per valore cumulato crescente (dall'alto al basso nel grafico con asse invertito)
  const sorted = [...payload]
    .filter(p => p.value !== null)
    .sort((a, b) => a.value - b.value);
  
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="font-bold text-white mb-2">{label}</p>
      {sorted.map((entry) => {
        const numStr = entry.dataKey.replace('c', '');
        const num = parseInt(numStr);
        const pilota = legendaData.find(l => l.num === num);
        const valStr = entry.value > 0 ? `+${entry.value.toFixed(1)}s` : `${entry.value.toFixed(1)}s`;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.stroke }} />
            <span style={{ color: entry.stroke }} className="font-bold">#{num}</span>
            <span className="text-gray-300">{pilota?.nome || ''}</span>
            <span className="text-white font-mono ml-auto">{valStr}</span>
          </div>
        );
      })}
    </div>
  );
};

// Color palette per giro (base bg for bars, lighter variants for dark mode)
const GIRO_COLORS = [
  'bg-blue-500 dark:bg-blue-400',
  'bg-emerald-500 dark:bg-emerald-400',
  'bg-rose-500 dark:bg-rose-400',
  'bg-violet-500 dark:bg-violet-400',
  'bg-amber-500 dark:bg-amber-400',
];

// Mini-chart "small multiple" per singolo pilota: mostra le performance del pilota
// sulle prove ripetute nei vari giri. G1 = riferimento, G2/G3/... = delta vs G1.
function PilotaProgressCard({ pilota, curvaData, isMe }) {
  // Costruisci dati per PS: { nomeProva, barre: [{ giro, tempo, delta, isRif }] }
  const provePS = Object.entries(curvaData).map(([nomeProva, datiGiri]) => {
    const sorted = [...datiGiri].sort((a, b) => a.giro - b.giro);
    const riferimento = sorted[0]?.tempi[pilota.num] ?? null;
    const barre = sorted.map(g => {
      const tempo = g.tempi[pilota.num] ?? null;
      const delta = (riferimento && tempo && g.giro !== sorted[0].giro) ? tempo - riferimento : null;
      return { giro: g.giro, tempo, delta, isRif: g.giro === sorted[0].giro };
    });
    return { nomeProva, barre };
  }).filter(ps => ps.barre.some(b => b.tempo !== null));

  // Nessun dato per questo pilota
  if (provePS.length === 0) {
    return (
      <div className="bg-surface-2 border border-border-subtle rounded-lg p-3 text-center opacity-50">
        <div className="h-40 flex items-center justify-center text-2xs text-content-tertiary">
          Nessun dato disponibile
        </div>
        <div className="mt-2 pt-2 border-t border-border-subtle text-xs font-semibold text-content-tertiary">
          #{pilota.num} · {pilota.nome}
        </div>
      </div>
    );
  }

  // Scala globale per pilota: baseline = minT * 0.98, top = maxT + piccolo margine
  const tempiTutti = provePS.flatMap(ps => ps.barre.map(b => b.tempo)).filter(t => t !== null);
  const maxT = Math.max(...tempiTutti);
  const minT = Math.min(...tempiTutti);
  const baseline = Math.max(0, minT - (maxT - minT) * 0.5);
  const topT = maxT + (maxT - minT) * 0.1;
  const barHeight = (tempo) => {
    if (!tempo) return 0;
    const h = ((tempo - baseline) / (topT - baseline)) * 100;
    return Math.max(4, Math.min(100, h));
  };

  const fmtDelta = (d) => {
    const abs = Math.abs(d);
    const str = abs < 10 ? abs.toFixed(2) : abs.toFixed(1);
    return (d < 0 ? '−' : '+') + str + 's';
  };

  return (
    <div className={`rounded-lg p-3 shadow-sm transition-all ${
      isMe
        ? 'bg-brand-50 dark:bg-brand-100/10 border-2 border-brand-500'
        : 'bg-surface border border-border-subtle'
    }`}>
      {/* Chart area */}
      <div className="flex items-end justify-around gap-3" style={{ height: '160px' }}>
        {provePS.map(ps => (
          <div key={ps.nomeProva} className="flex-1 flex items-end justify-center gap-1.5 h-full">
            {ps.barre.map(b => {
              const h = barHeight(b.tempo);
              const colorCls = GIRO_COLORS[(b.giro - 1) % GIRO_COLORS.length];
              return (
                <div key={b.giro} className="flex-1 max-w-[32px] flex flex-col items-center justify-end h-full">
                  {/* Delta label (above bar) */}
                  <div className="text-[10px] font-semibold leading-tight text-center h-7 flex flex-col justify-end items-center mb-1">
                    {b.isRif ? (
                      <span className="text-content-secondary">Rif.</span>
                    ) : b.delta !== null ? (
                      <span className={b.delta < 0 ? 'text-success-fg' : 'text-danger-fg'}>
                        {fmtDelta(b.delta)}
                      </span>
                    ) : (
                      <span className="text-content-tertiary">—</span>
                    )}
                  </div>
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t transition-all ${b.tempo ? colorCls : 'bg-surface-3'}`}
                    style={{ height: `${h}%` }}
                    title={b.tempo ? `G${b.giro}: ${Math.floor(b.tempo / 60)}:${(b.tempo % 60).toFixed(2).padStart(5, '0')}${b.delta !== null ? ` (${fmtDelta(b.delta)} vs G1)` : ' — riferimento'}` : `G${b.giro}: nessun dato`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* G labels under bars */}
      <div className="flex justify-around gap-3 mt-1.5 px-0">
        {provePS.map(ps => (
          <div key={ps.nomeProva} className="flex-1 flex justify-center gap-1.5">
            {ps.barre.map(b => (
              <div key={b.giro} className="flex-1 max-w-[32px] text-center text-[10px] font-semibold text-content-tertiary">
                G{b.giro}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* PS name labels (boxed) */}
      <div className="flex justify-around gap-2 mt-2">
        {provePS.map(ps => (
          <div key={ps.nomeProva} className="flex-1 text-center">
            <div className="inline-block max-w-full px-2 py-0.5 rounded border border-border-subtle text-[11px] font-semibold text-content-secondary truncate">
              {ps.nomeProva}
            </div>
          </div>
        ))}
      </div>

      {/* Pilot name at bottom (as in sketch) */}
      <div className="mt-3 pt-2 border-t border-border-subtle">
        <div className="inline-block w-full text-center px-2 py-1 rounded border border-border-subtle bg-surface-2">
          <span className={`text-xs font-semibold ${isMe ? 'text-brand-600 dark:text-brand-500' : 'text-content-primary'}`}>
            {isMe && <span className="mr-1">⭐</span>}
            #{pilota.num} · {pilota.nome}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LaMiaGara() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [replayData, setReplayData] = useState(null);
  const [numeroPilota, setNumeroPilota] = useState('');
  const [pilotaInfo, setPilotaInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graficoData, setGraficoData] = useState([]);
  const [graficoTempi, setGraficoTempi] = useState([]);
  const [graficoCumulato, setGraficoCumulato] = useState([]);
  const [radarData, setRadarData] = useState({ piloti: [], psStats: [], numPS: 0 }); // dati per SVG radar
  const [radarMinPercent, setRadarMinPercent] = useState(10); // slider 10-30%
  const [radarShowTempi, setRadarShowTempi] = useState(false); // toggle etichette tempi
  const [radarHover, setRadarHover] = useState(null); // num pilota in hover
  const [pilotiRadarVisibili, setPilotiRadarVisibili] = useState({}); // {num: true/false} - click toggle
  const [legendaData, setLegendaData] = useState([]);
  
  // Nuovi stati per selezione piloti
  const [modalitaSelezione, setModalitaSelezione] = useState('vicini'); // 'vicini' o 'manuale'
  const [pilotiSelezionati, setPilotiSelezionati] = useState([]); // array di {num, nome}
  const [ricercaPilota, setRicercaPilota] = useState('');
  const [mostraRicerca, setMostraRicerca] = useState(false);

  // === CURVA DI APPRENDIMENTO (isolata) ===
  const [curvaStrutturaPS, setCurvaStrutturaPS] = useState(null);
  const [curvaData, setCurvaData] = useState({});
  const [curvaScalaInvertita, setCurvaScalaInvertita] = useState(false);
  const [curvaPilotiVisibili, setCurvaPilotiVisibili] = useState({});
  const [curvaRicerca, setCurvaRicerca] = useState('');
  const [curvaProvaAttiva, setCurvaProvaAttiva] = useState(0);

  // Carica eventi
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(res => res.json())
      .then(data => setEventi(data))
      .catch(err => console.error('Errore caricamento eventi:', err));
  }, []);

  // Carica dati replay quando cambia evento
  useEffect(() => {
    if (!eventoSelezionato) {
      setReplayData(null);
      return;
    }
    
    setLoading(true);
    fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/export-replay`)
      .then(res => res.json())
      .then(data => {
        setReplayData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Errore caricamento replay:', err);
        setError('Errore caricamento dati');
        setLoading(false);
      });
  }, [eventoSelezionato]);

  // Formatta tempo mm:ss.cc
  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  // Parse tempo stringa -> secondi
  const parseTime = (timeStr) => {
    if (!timeStr || timeStr.includes('RIT')) return Infinity;
    const parts = timeStr.split(':');
    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  };

  // Cerca pilota e calcola info
  const cercaPilota = () => {
    if (!replayData || !numeroPilota) return;
    
    const num = parseInt(numeroPilota);
    // Usa sempre l'ultima PS per calcolare i vicini
    const ultimaPS = replayData.snapshots.length;
    const snapshot = replayData.snapshots[ultimaPS - 1];
    if (!snapshot) return;

    const pilota = snapshot.classifica.find(p => p.num === num);
    if (!pilota) {
      setError(`Pilota #${num} non trovato`);
      setPilotaInfo(null);
      return;
    }

    setError(null);

    // Classifica assoluta
    const classificaAttivi = snapshot.classifica.filter(p => p.stato === 'attivo');
    const posAssoluta = classificaAttivi.findIndex(p => p.num === num) + 1;
    const totaleAssoluto = classificaAttivi.length;

    // Piloti da confrontare: automatico (vicini) o manuale
    let pilotiSopra = [];
    let pilotiSotto = [];
    
    if (modalitaSelezione === 'vicini') {
      // Modalità automatica: 3 sopra e 3 sotto in classifica finale
      for (let i = 1; i <= 3; i++) {
        const idxSopra = posAssoluta - 1 - i;
        const idxSotto = posAssoluta - 1 + i;
        
        if (idxSopra >= 0 && classificaAttivi[idxSopra]) {
          const pSopra = classificaAttivi[idxSopra];
          const gap = parseTime(pilota.totale) - parseTime(pSopra.totale);
          pilotiSopra.unshift({
            pos: idxSopra + 1,
            num: pSopra.num,
            nome: `${pSopra.cognome} ${pSopra.nome}`,
            classe: pSopra.classe,
            team: pSopra.team,
            totale: pSopra.totale,
            gap: gap.toFixed(1)
          });
        }
        
        if (idxSotto < classificaAttivi.length && classificaAttivi[idxSotto]) {
          const pSotto = classificaAttivi[idxSotto];
          const gap = parseTime(pSotto.totale) - parseTime(pilota.totale);
          pilotiSotto.push({
            pos: idxSotto + 1,
            num: pSotto.num,
            nome: `${pSotto.cognome} ${pSotto.nome}`,
            classe: pSotto.classe,
            team: pSotto.team,
            totale: pSotto.totale,
            gap: gap.toFixed(1)
          });
        }
      }
    } else {
      // Modalità manuale: usa piloti selezionati
      pilotiSelezionati.forEach(ps => {
        if (ps.num === num) return; // Escludi te stesso
        const idx = classificaAttivi.findIndex(p => p.num === ps.num);
        if (idx < 0) return;
        const p = classificaAttivi[idx];
        const pilotaData = {
          pos: idx + 1,
          num: p.num,
          nome: `${p.cognome} ${p.nome}`,
          classe: p.classe,
          team: p.team,
          totale: p.totale,
          gap: Math.abs(parseTime(p.totale) - parseTime(pilota.totale)).toFixed(1)
        };
        if (idx + 1 < posAssoluta) {
          pilotiSopra.push(pilotaData);
        } else {
          pilotiSotto.push(pilotaData);
        }
      });
      // Ordina per posizione
      pilotiSopra.sort((a, b) => a.pos - b.pos);
      pilotiSotto.sort((a, b) => a.pos - b.pos);
    }

    // Classifica classe
    const pilotiClasse = classificaAttivi.filter(p => p.classe === pilota.classe);
    const posClasse = pilotiClasse.findIndex(p => p.num === num) + 1;
    const totaleClasse = pilotiClasse.length;

    // Variazione posizione (rispetto a PS precedente)
    let variazione = 0;
    if (ultimaPS > 1 && replayData.snapshots[ultimaPS - 2]) {
      const prevSnapshot = replayData.snapshots[ultimaPS - 2];
      const prevClassifica = prevSnapshot.classifica.filter(p => p.stato === 'attivo');
      const prevPos = prevClassifica.findIndex(p => p.num === num) + 1;
      if (prevPos > 0) {
        variazione = prevPos - posAssoluta;
      }
    }

    // Gap dal podio
    let gapPodio = null;
    if (posAssoluta > 3 && classificaAttivi[2]) {
      const terzo = classificaAttivi[2];
      gapPodio = (parseTime(pilota.totale) - parseTime(terzo.totale)).toFixed(1);
    }

    setPilotaInfo({
      num: pilota.num,
      nome: `${pilota.cognome} ${pilota.nome}`,
      classe: pilota.classe,
      team: pilota.team,
      moto: pilota.moto,
      totale: pilota.totale,
      posAssoluta,
      totaleAssoluto,
      posClasse,
      totaleClasse,
      variazione,
      pilotiSopra,
      pilotiSotto,
      gapPodio,
      tempoPS: pilota[`ps${ultimaPS}_time`]
    });

    // Calcola dati per grafico posizioni
    const pilotiDaTracciare = [
      ...pilotiSopra.map((p, idx) => ({ num: p.num, nome: p.nome, tipo: 'sopra', idx })),
      { num: num, nome: `${pilota.cognome} ${pilota.nome}`, tipo: 'tu', idx: 0 },
      ...pilotiSotto.map((p, idx) => ({ num: p.num, nome: p.nome, tipo: 'sotto', idx }))
    ];

    const datiGrafico = [];
    for (let psIdx = 0; psIdx < replayData.snapshots.length; psIdx++) {
      const snap = replayData.snapshots[psIdx];
      const classificaSnap = snap.classifica.filter(p => p.stato === 'attivo');
      
      const punto = { ps: `PS${psIdx + 1}` };
      pilotiDaTracciare.forEach(pt => {
        const pos = classificaSnap.findIndex(p => p.num === pt.num) + 1;
        punto[`p${pt.num}`] = pos > 0 ? pos : null;
      });
      datiGrafico.push(punto);
    }
    setGraficoData(datiGrafico);

    // Calcola dati legenda con posizione iniziale e finale
    const legenda = pilotiDaTracciare.map(pt => {
      const posInizio = datiGrafico[0]?.[`p${pt.num}`] || '-';
      const posFine = datiGrafico[datiGrafico.length - 1]?.[`p${pt.num}`] || '-';
      let colore;
      if (pt.tipo === 'tu') {
        colore = COLORI.tu;
      } else if (pt.tipo === 'sopra') {
        colore = COLORI.sopra[pt.idx] || COLORI.sopra[0];
      } else {
        colore = COLORI.sotto[pt.idx] || COLORI.sotto[0];
      }
      return {
        num: pt.num,
        nome: pt.nome,
        tipo: pt.tipo,
        colore,
        posInizio,
        posFine
      };
    });
    // Ordina per posizione finale
    legenda.sort((a, b) => (a.posFine || 999) - (b.posFine || 999));
    setLegendaData(legenda);

    // Calcola dati per grafico SCOSTAMENTI tempi PS (rispetto alla MEDIANA)
    const datiTempi = [];
    for (let psIdx = 0; psIdx < replayData.snapshots.length; psIdx++) {
      const snap = replayData.snapshots[psIdx];
      const psNum = psIdx + 1;
      
      // Raccogli tutti i tempi dei piloti da tracciare per questa PS
      const tempiPS = [];
      pilotiDaTracciare.forEach(pt => {
        const pilotaSnap = snap.classifica.find(p => p.num === pt.num);
        if (pilotaSnap && pilotaSnap[`ps${psNum}_time`]) {
          tempiPS.push(parseFloat(pilotaSnap[`ps${psNum}_time`]));
        }
      });
      
      // Calcola mediana
      let mediana = null;
      if (tempiPS.length > 0) {
        const sorted = [...tempiPS].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        mediana = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      
      const punto = { ps: `PS${psNum}` };
      pilotiDaTracciare.forEach(pt => {
        const pilotaSnap = snap.classifica.find(p => p.num === pt.num);
        if (pilotaSnap && pilotaSnap[`ps${psNum}_time`] && mediana) {
          const tempo = parseFloat(pilotaSnap[`ps${psNum}_time`]);
          // Scostamento: positivo = più lento della mediana, negativo = più veloce
          punto[`t${pt.num}`] = parseFloat((tempo - mediana).toFixed(2));
        } else {
          punto[`t${pt.num}`] = null;
        }
      });
      datiTempi.push(punto);
    }
    setGraficoTempi(datiTempi);

    // Calcola dati per grafico DIFFERENZA CUMULATA (rispetto alla mediana)
    const datiCumulato = [];
    const cumulati = {}; // {num: valoreCumulato}
    pilotiDaTracciare.forEach(pt => { cumulati[pt.num] = 0; });
    
    for (let psIdx = 0; psIdx < datiTempi.length; psIdx++) {
      const punto = { ps: datiTempi[psIdx].ps };
      pilotiDaTracciare.forEach(pt => {
        const scostamento = datiTempi[psIdx][`t${pt.num}`];
        if (scostamento !== null) {
          cumulati[pt.num] += scostamento;
        }
        punto[`c${pt.num}`] = parseFloat(cumulati[pt.num].toFixed(2));
      });
      datiCumulato.push(punto);
    }
    setGraficoCumulato(datiCumulato);

    // Calcola dati per grafico RADAR SVG
    const numPS = replayData.snapshots.length;
    
    // Calcola stats (min/max) per ogni PS
    const psStats = [];
    for (let psIdx = 0; psIdx < numPS; psIdx++) {
      const snap = replayData.snapshots[psIdx];
      const psNum = psIdx + 1;
      const tempi = pilotiDaTracciare
        .map(pt => {
          const pilotaSnap = snap.classifica.find(p => p.num === pt.num);
          return pilotaSnap && pilotaSnap[`ps${psNum}_time`] ? parseFloat(pilotaSnap[`ps${psNum}_time`]) : null;
        })
        .filter(t => t && t > 0);
      
      if (tempi.length > 0) {
        psStats.push({ min: Math.min(...tempi), max: Math.max(...tempi) });
      } else {
        psStats.push({ min: 0, max: 0 });
      }
    }
    
    // Prepara dati piloti con tempi per ogni PS
    const pilotiRadar = pilotiDaTracciare.map(pt => {
      const tempi = [];
      for (let psIdx = 0; psIdx < numPS; psIdx++) {
        const snap = replayData.snapshots[psIdx];
        const psNum = psIdx + 1;
        const pilotaSnap = snap.classifica.find(p => p.num === pt.num);
        const tempo = pilotaSnap && pilotaSnap[`ps${psNum}_time`] ? parseFloat(pilotaSnap[`ps${psNum}_time`]) : null;
        tempi.push(tempo);
      }
      return { ...pt, tempi };
    });
    
    setRadarData({ piloti: pilotiRadar, psStats, numPS });
    
    // Inizializza tutti i piloti come visibili nel radar
    const visibili = {};
    pilotiDaTracciare.forEach(pt => { visibili[pt.num] = true; });
    setPilotiRadarVisibili(visibili);
  };

  // Ricalcola quando cambia modalità o selezione manuale
  useEffect(() => {
    if (numeroPilota && replayData) {
      cercaPilota();
    }
  }, [modalitaSelezione, pilotiSelezionati]);

  // === CURVA: Carica struttura PS (separato, non blocca nulla) ===
  useEffect(() => {
    if (!eventoSelezionato) {
      setCurvaStrutturaPS(null);
      return;
    }
    fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/struttura-ps`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (data?.success) setCurvaStrutturaPS(data);
        else setCurvaStrutturaPS(null);
      });
  }, [eventoSelezionato]);

  // === CURVA: Calcola dati quando pilotaInfo è pronto ===
  useEffect(() => {
    if (!pilotaInfo || !replayData?.snapshots || legendaData.length === 0) {
      setCurvaData({});
      return;
    }
    
    const pilotiDaTracciare = legendaData;
    
    // Verifica che la struttura sia valida (almeno una PS con gruppo configurato)
    const haGruppiValidi = curvaStrutturaPS?.psGenerate?.some(ps => ps.gruppo);
    
    if (haGruppiValidi) {
      // Con struttura: raggruppa per tipo prova
      const proveUniche = [...new Set(curvaStrutturaPS.psGenerate.map(ps => ps.gruppo || ps.nome))];
      const curvaPerProva = {};
      
      proveUniche.forEach(nomeProva => {
        const psDelTipo = curvaStrutturaPS.psGenerate
          .filter(ps => (ps.gruppo || ps.nome) === nomeProva && ps.giro !== 'finale')
          .sort((a, b) => a.giro - b.giro);
        
        const datiGiri = psDelTipo.map(psInfo => {
          const snap = replayData.snapshots[psInfo.numero - 1];
          if (!snap) return null;
          
          const tempiPiloti = {};
          pilotiDaTracciare.forEach(pt => {
            const pilotaSnap = snap.classifica.find(p => p.num === pt.num);
            if (pilotaSnap && pilotaSnap[`ps${psInfo.numero}_time`]) {
              tempiPiloti[pt.num] = parseFloat(pilotaSnap[`ps${psInfo.numero}_time`]);
            }
          });
          
          return { giro: psInfo.giro, label: `Giro ${psInfo.giro}`, tempi: tempiPiloti, psNumero: psInfo.numero };
        }).filter(Boolean);
        
        if (datiGiri.length > 0) curvaPerProva[nomeProva] = datiGiri;
      });
      
      setCurvaData(curvaPerProva);
    } else {
      // Fallback: pattern alternato (2 prove per giro)
      // Usa nomi PS reali da replayData.prove se disponibili
      const numPS = replayData.snapshots.length;
      const numProvePerGiro = 2;
      const numGiri = Math.floor(numPS / numProvePerGiro);

      if (numGiri >= 2) {
        const curvaPerProva = {};
        for (let provaIdx = 0; provaIdx < numProvePerGiro; provaIdx++) {
          // Deriva il nome reale della PS dal primo giro (rimuove prefissi tipo "G1 ")
          const primoPsNumero = provaIdx + 1;
          const primoPs = replayData.prove?.find(p => p.numero === primoPsNumero || p.numero_ordine === primoPsNumero);
          const rawName = primoPs?.nome_ps || primoPs?.nome || `Prova ${provaIdx + 1}`;
          // Pulisce prefissi giro tipo "G1 " o "G1-"
          const nomeProva = rawName.replace(/^G\d+[\s\-\.]+/i, '').trim() || `Prova ${provaIdx + 1}`;
          const datiGiri = [];

          for (let giro = 1; giro <= numGiri; giro++) {
            const psIdx = (giro - 1) * numProvePerGiro + provaIdx;
            const snap = replayData.snapshots[psIdx];
            if (!snap) continue;

            const tempiPiloti = {};
            pilotiDaTracciare.forEach(pt => {
              const pilotaSnap = snap.classifica.find(p => p.num === pt.num);
              if (pilotaSnap && pilotaSnap[`ps${psIdx + 1}_time`]) {
                tempiPiloti[pt.num] = parseFloat(pilotaSnap[`ps${psIdx + 1}_time`]);
              }
            });

            datiGiri.push({ giro, label: `Giro ${giro}`, tempi: tempiPiloti, psNumero: psIdx + 1 });
          }

          if (datiGiri.length > 0) curvaPerProva[nomeProva] = datiGiri;
        }
        setCurvaData(curvaPerProva);
      } else {
        setCurvaData({});
      }
    }
    
    // Inizializza piloti visibili
    const curvaVisibili = {};
    pilotiDaTracciare.slice(0, 5).forEach(pt => { curvaVisibili[pt.num] = true; });
    setCurvaPilotiVisibili(curvaVisibili);
    
  }, [pilotaInfo, replayData, legendaData, curvaStrutturaPS]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-600 dark:text-brand-500" />
            La Mia Gara
          </h1>
          <p className="text-content-secondary mt-1 text-sm">Inserisci il tuo numero per analizzare la tua gara.</p>
        </div>
        <Link
          to="/help-mia-gara"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold bg-warning-bg text-warning-fg border border-warning-border hover:opacity-90 transition-opacity"
        >
          <HelpCircle className="w-4 h-4" />
          Help
        </Link>
      </div>

      {/* Selection */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1.5">Evento</label>
            <select
              value={eventoSelezionato}
              onChange={(e) => setEventoSelezionato(e.target.value)}
              className="w-full h-9 px-3 pr-8 rounded-md border border-border bg-surface text-sm font-medium cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              <option value="">Seleziona evento…</option>
              {eventi.map(e => (
                <option key={e.id} value={e.id}>{e.nome_evento}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1.5">Il tuo numero</label>
            <input
              type="number"
              value={numeroPilota}
              onChange={(e) => setNumeroPilota(e.target.value)}
              placeholder="Es. 104"
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Selezione modalità confronto */}
        {replayData && (
          <div className="mt-4 p-4 bg-surface-2 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-3">Confronta con:</label>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modalita"
                  value="vicini"
                  checked={modalitaSelezione === 'vicini'}
                  onChange={() => {
                    setModalitaSelezione('vicini');
                    setPilotiSelezionati([]);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">Vicini in classifica finale (±3 piloti)</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modalita"
                  value="manuale"
                  checked={modalitaSelezione === 'manuale'}
                  onChange={() => setModalitaSelezione('manuale')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">Seleziona piloti da confrontare</span>
              </label>

              {/* Autocomplete per selezione manuale */}
              {modalitaSelezione === 'manuale' && (
                <div className="ml-6 mt-2">
                  {/* Campo ricerca */}
                  <div className="relative">
                    <input
                      type="text"
                      value={ricercaPilota}
                      onChange={(e) => {
                        setRicercaPilota(e.target.value);
                        setMostraRicerca(e.target.value.length >= 2);
                      }}
                      onFocus={() => setMostraRicerca(ricercaPilota.length >= 2)}
                      placeholder="Digita cognome pilota..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {/* Lista risultati autocomplete */}
                    {mostraRicerca && ricercaPilota.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {replayData.snapshots[replayData.snapshots.length - 1].classifica
                          .filter(p => 
                            p.stato === 'attivo' && 
                            p.cognome.toLowerCase().includes(ricercaPilota.toLowerCase()) &&
                            p.num !== parseInt(numeroPilota) &&
                            !pilotiSelezionati.some(ps => ps.num === p.num)
                          )
                          .slice(0, 10)
                          .map(p => (
                            <div
                              key={p.num}
                              onClick={() => {
                                if (pilotiSelezionati.length < 6) {
                                  setPilotiSelezionati([...pilotiSelezionati, { 
                                    num: p.num, 
                                    nome: `${p.cognome} ${p.nome}` 
                                  }]);
                                }
                                setRicercaPilota('');
                                setMostraRicerca(false);
                              }}
                              className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between"
                            >
                              <span className="font-bold text-blue-600">#{p.num}</span>
                              <span className="text-gray-700">{p.cognome} {p.nome}</span>
                            </div>
                          ))
                        }
                        {replayData.snapshots[replayData.snapshots.length - 1].classifica
                          .filter(p => 
                            p.stato === 'attivo' && 
                            p.cognome.toLowerCase().includes(ricercaPilota.toLowerCase()) &&
                            p.num !== parseInt(numeroPilota) &&
                            !pilotiSelezionati.some(ps => ps.num === p.num)
                          ).length === 0 && (
                            <div className="px-4 py-2 text-gray-500">Nessun risultato</div>
                          )
                        }
                      </div>
                    )}
                  </div>

                  {/* Piloti selezionati */}
                  {pilotiSelezionati.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pilotiSelezionati.map(p => (
                        <div 
                          key={p.num}
                          className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                        >
                          <span className="font-bold">#{p.num}</span>
                          <span>{p.nome.split(' ')[0]}</span>
                          <button
                            onClick={() => setPilotiSelezionati(pilotiSelezionati.filter(ps => ps.num !== p.num))}
                            className="ml-1 text-blue-600 hover:text-red-600 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    {pilotiSelezionati.length}/6 piloti selezionati
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pulsante cerca */}
        <div className="mt-4">
          <button
            onClick={cercaPilota}
            disabled={!eventoSelezionato || !numeroPilota || loading}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Caricamento...' : 'Cerca la mia posizione'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Risultato */}
      {pilotaInfo && (
        <div className="space-y-4">
          {/* Header pilota */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-blue-600">#{pilotaInfo.num}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{pilotaInfo.nome}</h2>
                    <p className="text-gray-600">{pilotaInfo.moto}</p>
                    {pilotaInfo.team && <p className="text-gray-500">🏠 {pilotaInfo.team}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Classifica finale</div>
                <div className="text-3xl font-bold text-gray-900">{pilotaInfo.totale}</div>
              </div>
            </div>

            {/* Posizioni */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-sm text-blue-600 font-medium">ASSOLUTA</div>
                <div className="text-3xl font-bold text-blue-700">
                  {pilotaInfo.posAssoluta}°
                  <span className="text-lg text-blue-500">/{pilotaInfo.totaleAssoluto}</span>
                </div>
                {pilotaInfo.variazione !== 0 && (
                  <div className={`flex items-center justify-center gap-1 mt-1 ${pilotaInfo.variazione > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pilotaInfo.variazione > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="font-medium">{pilotaInfo.variazione > 0 ? '+' : ''}{pilotaInfo.variazione}</span>
                  </div>
                )}
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-sm text-purple-600 font-medium">CLASSE {pilotaInfo.classe}</div>
                <div className="text-3xl font-bold text-purple-700">
                  {pilotaInfo.posClasse}°
                  <span className="text-lg text-purple-500">/{pilotaInfo.totaleClasse}</span>
                </div>
              </div>
            </div>

            {/* Gap podio */}
            {pilotaInfo.gapPodio && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                <Trophy className="w-5 h-5 inline text-yellow-600 mr-2" />
                <span className="text-yellow-800">Gap dal podio: <strong>{pilotaInfo.gapPodio}s</strong></span>
              </div>
            )}
          </div>

          {/* Grafico andamento posizioni */}
          {graficoData.length > 0 && pilotaInfo && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📈 Andamento Posizioni</h3>
              <div style={{ width: '100%', height: 384 }}>
                <ResponsiveContainer width="100%" height={384}>
                  <LineChart data={graficoData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ps" />
                    <YAxis 
                      reversed 
                      domain={['dataMin - 2', 'dataMax + 2']}
                      label={{ value: 'Posizione', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltipPosizioni legendaData={legendaData} />} />
                    {/* Piloti sopra - palette verde/azzurro/viola */}
                    {pilotaInfo.pilotiSopra.map((p, idx) => (
                      <Line 
                        key={p.num}
                        type="monotone" 
                        dataKey={`p${p.num}`} 
                        name={`#${p.num}`}
                        stroke={COLORI.sopra[idx] || COLORI.sopra[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                    {/* Tu - blu scuro grassetto */}
                    <Line 
                      type="monotone" 
                      dataKey={`p${pilotaInfo.num}`} 
                      name={`⭐ #${pilotaInfo.num}`}
                      stroke={COLORI.tu}
                      strokeWidth={4}
                      dot={{ r: 6, fill: COLORI.tu }}
                    />
                    {/* Piloti sotto - palette rosso/arancione/giallo */}
                    {pilotaInfo.pilotiSotto.map((p, idx) => (
                      <Line 
                        key={p.num}
                        type="monotone" 
                        dataKey={`p${p.num}`} 
                        name={`#${p.num}`}
                        stroke={COLORI.sotto[idx] || COLORI.sotto[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Grafico scostamenti tempi PS */}
          {graficoTempi.length > 0 && pilotaInfo && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">⏱️ Scostamenti Tempi PS (rispetto alla mediana)</h3>
              <div style={{ width: '100%', height: 384 }}>
                <ResponsiveContainer width="100%" height={384}>
                  <LineChart data={graficoTempi} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ps" />
                    <YAxis 
                      reversed
                      domain={['dataMin - 2', 'dataMax + 2']}
                      tickFormatter={(val) => val > 0 ? `+${val.toFixed(1)}s` : `${val.toFixed(1)}s`}
                      label={{ value: 'Scostamento (s)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltipScostamenti legendaData={legendaData} />} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} strokeDasharray="3 3" label={{ value: 'Mediana', fill: '#666', fontSize: 10 }} />
                    {/* Piloti sopra - palette verde/azzurro/viola */}
                    {pilotaInfo.pilotiSopra.map((p, idx) => (
                      <Line 
                        key={p.num}
                        type="monotone" 
                        dataKey={`t${p.num}`} 
                        name={`#${p.num}`}
                        stroke={COLORI.sopra[idx] || COLORI.sopra[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                    {/* Tu - blu scuro grassetto */}
                    <Line 
                      type="monotone" 
                      dataKey={`t${pilotaInfo.num}`} 
                      name={`⭐ #${pilotaInfo.num}`}
                      stroke={COLORI.tu}
                      strokeWidth={4}
                      dot={{ r: 6, fill: COLORI.tu }}
                      connectNulls
                    />
                    {/* Piloti sotto - palette rosso/arancione/giallo */}
                    {pilotaInfo.pilotiSotto.map((p, idx) => (
                      <Line 
                        key={p.num}
                        type="monotone" 
                        dataKey={`t${p.num}`} 
                        name={`#${p.num}`}
                        stroke={COLORI.sotto[idx] || COLORI.sotto[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-500 mt-2 text-center">
                Sopra = più veloce della mediana, Sotto = più lento della mediana
              </p>
            </div>
          )}

          {/* Grafico differenza cumulata */}
          {graficoCumulato.length > 0 && pilotaInfo && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Differenza Cumulata (rispetto alla mediana)</h3>
              <div style={{ width: '100%', height: 384 }}>
                <ResponsiveContainer width="100%" height={384}>
                  <LineChart data={graficoCumulato} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ps" />
                    <YAxis 
                      reversed
                      tickFormatter={(val) => val > 0 ? `+${val.toFixed(0)}s` : `${val.toFixed(0)}s`}
                      label={{ value: 'Cumulato (s)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltipCumulato legendaData={legendaData} />} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} strokeDasharray="3 3" />
                    {/* Piloti sopra - palette verde/azzurro/viola */}
                    {pilotaInfo.pilotiSopra.map((p, idx) => (
                      <Line 
                        key={p.num}
                        type="monotone" 
                        dataKey={`c${p.num}`} 
                        name={`#${p.num}`}
                        stroke={COLORI.sopra[idx] || COLORI.sopra[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                    {/* Tu - blu scuro grassetto */}
                    <Line 
                      type="monotone" 
                      dataKey={`c${pilotaInfo.num}`} 
                      name={`⭐ #${pilotaInfo.num}`}
                      stroke={COLORI.tu}
                      strokeWidth={4}
                      dot={{ r: 6, fill: COLORI.tu }}
                    />
                    {/* Piloti sotto - palette rosso/arancione/giallo */}
                    {pilotaInfo.pilotiSotto.map((p, idx) => (
                      <Line 
                        key={p.num}
                        type="monotone" 
                        dataKey={`c${p.num}`} 
                        name={`#${p.num}`}
                        stroke={COLORI.sotto[idx] || COLORI.sotto[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-500 mt-2 text-center">
                Linea in alto = accumula vantaggio, Linea in basso = accumula ritardo
              </p>
            </div>
          )}

          {/* Grafico Radar Performance PS - SVG puro */}
          {radarData.piloti.length > 0 && pilotaInfo && (() => {
            const { piloti, psStats, numPS } = radarData;
            if (numPS < 2) return null;
            
            const centerX = 250, centerY = 250, maxRadius = 180;
            const minPercent = radarMinPercent / 100;
            
            // Funzione per formattare tempo
            const formatTempo = (sec) => {
              if (!sec) return '-';
              const min = Math.floor(sec / 60);
              const s = (sec % 60).toFixed(2);
              return `${min}'${s.padStart(5, '0')}`;
            };
            
            // Funzione per calcolare posizione radiale (0 = centro, 1 = esterno)
            const getRadialPos = (tempo, psIdx) => {
              const { min, max } = psStats[psIdx];
              if (!max || max === min) return 0.5;
              const scale = 1 - minPercent;
              return (1 - (tempo - min) / (max - min)) * scale + minPercent;
            };
            
            // Genera punti poligono per un pilota
            const getPolygonPoints = (pilota) => {
              const points = [];
              for (let i = 0; i < numPS; i++) {
                const tempo = pilota.tempi[i];
                const angle = (i * 2 * Math.PI / numPS) - Math.PI / 2;
                const r = tempo ? getRadialPos(tempo, i) * maxRadius : 0;
                points.push({
                  x: centerX + r * Math.cos(angle),
                  y: centerY + r * Math.sin(angle),
                  tempo,
                  ps: i + 1
                });
              }
              return points;
            };
            
            // Colori piloti
            const RADAR_COLORI = ['#22c55e', '#14b8a6', '#8b5cf6', '#1d4ed8', '#ef4444', '#f97316', '#eab308'];
            const getColore = (pilota) => {
              if (pilota.num === pilotaInfo.num) return '#1d4ed8';
              const idx = piloti.findIndex(p => p.num === pilota.num);
              return RADAR_COLORI[idx % RADAR_COLORI.length];
            };
            
            // Determina quali piloti sono "attivi"
            const hasSelection = Object.values(pilotiRadarVisibili).some(v => !v) || radarHover;
            
            return (
              <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4">🎯 Performance PS (Radar)</h3>
                
                {/* Controlli */}
                <div className="flex items-center gap-4 mb-4 flex-wrap justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Min:</span>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      value={radarMinPercent}
                      onChange={(e) => setRadarMinPercent(parseInt(e.target.value))}
                      className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm text-gray-500 w-10">{radarMinPercent}%</span>
                  </div>
                  <button
                    onClick={() => setRadarShowTempi(!radarShowTempi)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      radarShowTempi ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    ⏱️ Tempi
                  </button>
                </div>
                
                {/* Bottoni piloti */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {piloti.map((p, idx) => {
                    const colore = getColore(p);
                    const isVisible = pilotiRadarVisibili[p.num] !== false;
                    const isTu = p.num === pilotaInfo.num;
                    return (
                      <button
                        key={p.num}
                        onClick={() => setPilotiRadarVisibili(prev => ({ ...prev, [p.num]: !prev[p.num] }))}
                        onMouseEnter={() => setRadarHover(p.num)}
                        onMouseLeave={() => setRadarHover(null)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          isVisible ? 'text-white' : 'opacity-40'
                        }`}
                        style={{ backgroundColor: isVisible ? colore : '#9ca3af' }}
                      >
                        {isTu ? '⭐ ' : ''}#{p.num} {p.nome}
                      </button>
                    );
                  })}
                </div>
                
                {/* SVG Radar */}
                <div className="flex justify-center">
                  <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: '600px', height: 'auto' }}>
                    {/* Griglia circolare */}
                    {[0.25, 0.5, 0.75, 1].map((ratio) => (
                      <circle
                        key={ratio}
                        cx={centerX}
                        cy={centerY}
                        r={ratio * maxRadius}
                        fill="none"
                        stroke="#374151"
                        strokeWidth="1"
                        strokeDasharray={ratio === 1 ? '0' : '4,4'}
                      />
                    ))}
                    
                    {/* Assi e labels */}
                    {Array.from({ length: numPS }).map((_, i) => {
                      const angle = (i * 2 * Math.PI / numPS) - Math.PI / 2;
                      const x2 = centerX + maxRadius * Math.cos(angle);
                      const y2 = centerY + maxRadius * Math.sin(angle);
                      const labelX = centerX + (maxRadius + 25) * Math.cos(angle);
                      const labelY = centerY + (maxRadius + 25) * Math.sin(angle);
                      return (
                        <g key={i}>
                          <line x1={centerX} y1={centerY} x2={x2} y2={y2} stroke="#4b5563" strokeWidth="1" />
                          <text x={labelX} y={labelY} textAnchor="middle" fill="#374151" fontSize="12" fontWeight="bold">
                            PS{i + 1}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Poligoni piloti */}
                    {piloti
                      .filter(p => pilotiRadarVisibili[p.num] !== false)
                      .sort((a, b) => {
                        const aActive = radarHover === a.num;
                        const bActive = radarHover === b.num;
                        if (aActive && !bActive) return 1;
                        if (!aActive && bActive) return -1;
                        return 0;
                      })
                      .map((pilota) => {
                        const colore = getColore(pilota);
                        const points = getPolygonPoints(pilota);
                        const isHovered = radarHover === pilota.num;
                        const isTu = pilota.num === pilotaInfo.num;
                        const opacity = hasSelection && !isHovered && radarHover ? 0.2 : 1;
                        const strokeWidth = isHovered || isTu ? 3 : 1.5;
                        
                        const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ');
                        
                        return (
                          <g 
                            key={pilota.num} 
                            style={{ opacity, transition: 'opacity 0.2s' }}
                            onMouseEnter={() => setRadarHover(pilota.num)}
                            onMouseLeave={() => setRadarHover(null)}
                          >
                            <polygon
                              points={polyPoints}
                              fill={`${colore}22`}
                              stroke={colore}
                              strokeWidth={strokeWidth}
                              style={{ cursor: 'pointer' }}
                            />
                            {/* Punti */}
                            {points.map((p, i) => (
                              p.tempo && (
                                <g key={i}>
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={isHovered ? 5 : 3}
                                    fill={colore}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  {/* Etichetta tempo */}
                                  {(isHovered || radarShowTempi) && (
                                    <text
                                      x={p.x}
                                      y={p.y - 10}
                                      textAnchor="middle"
                                      fill={colore}
                                      fontSize="9"
                                      fontFamily="monospace"
                                    >
                                      {formatTempo(p.tempo)}
                                    </text>
                                  )}
                                </g>
                              )
                            ))}
                          </g>
                        );
                      })}
                    
                    {/* Centro */}
                    <circle cx={centerX} cy={centerY} r="4" fill="#6b7280" />
                    
                    {/* Labels LENTO/VELOCE */}
                    <text x={centerX + 50} y={centerY - 20} fill="#6b7280" fontSize="8">LENTO</text>
                    <text x={centerX + 50} y={centerY - maxRadius + 10} fill="#22c55e" fontSize="8" fontWeight="bold">VELOCE</text>
                  </svg>
                </div>
                
                {/* Legenda */}
                <div className="mt-4 p-3 bg-gray-800 rounded-lg text-sm text-gray-300">
                  <p className="font-bold mb-1">📖 Come leggere il grafico:</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span>• <span className="text-green-400">Esterno</span> = più veloce</span>
                    <span>• <span className="text-gray-400">Centro</span> = più lento</span>
                    <span>• <span className="text-blue-400">Forma grande</span> = costante</span>
                    <span>• <span className="text-yellow-400">Picchi</span> = PS forti</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Legenda unica compatta */}
          {legendaData.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h4 className="text-sm font-bold text-gray-600 mb-2">Legenda Piloti</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {legendaData.map((item) => (
                  <div key={item.num} className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: item.colore }}
                    />
                    <span className="font-bold text-sm" style={{ color: item.colore }}>
                      {item.tipo === 'tu' ? '⭐' : ''}{item.num}
                    </span>
                    <span className="text-gray-700 text-sm truncate">{item.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === PROGRESSIONE PER PILOTA (small multiples) === */}
          {Object.keys(curvaData).length > 0 && legendaData.length > 0 && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div>
                  <h3 className="text-heading-2">Progressione per pilota</h3>
                  <p className="text-xs text-content-tertiary mt-1">
                    Una mini-classifica personale per ogni pilota a confronto. Le barre mostrano i tempi di ciascun giro sulle prove ripetute, con il primo giro (G1) come riferimento.
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-content-tertiary mb-4 pb-3 border-b border-border-subtle">
                <span className="text-2xs font-semibold uppercase tracking-wider">Giri:</span>
                {(() => {
                  const nGiri = Math.max(...Object.values(curvaData).map(d => d.length));
                  const GIRO_LEGEND = [
                    { cls: 'bg-blue-500 dark:bg-blue-400' },
                    { cls: 'bg-emerald-500 dark:bg-emerald-400' },
                    { cls: 'bg-rose-500 dark:bg-rose-400' },
                    { cls: 'bg-violet-500 dark:bg-violet-400' },
                    { cls: 'bg-amber-500 dark:bg-amber-400' },
                  ];
                  return Array.from({ length: nGiri }).map((_, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded-sm ${GIRO_LEGEND[i % GIRO_LEGEND.length].cls}`} />
                      G{i + 1}{i === 0 && <span className="text-content-tertiary ml-0.5">(riferimento)</span>}
                    </span>
                  ));
                })()}
                <span className="flex items-center gap-1.5 ml-auto">
                  <span className="text-success-fg font-semibold">−</span> Miglioramento vs G1
                  <span className="text-danger-fg font-semibold ml-2">+</span> Peggioramento vs G1
                </span>
              </div>

              {/* Grid of mini-charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {legendaData.map((p) => (
                  <PilotaProgressCard
                    key={p.num}
                    pilota={p}
                    curvaData={curvaData}
                    isMe={p.num === pilotaInfo?.num}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
