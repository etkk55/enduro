import { useState, useEffect, Fragment, useRef, useCallback } from 'react';
import { Radio, Play, Square, SkipForward, RotateCcw, Clock, TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle } from 'lucide-react';

// Lookup EQUIPE per manifestazione (MANIF -> EQUIPE)
const EQUIPE_LOOKUP = {
  303: 107,  // Vestenanova -> Veneto
  11: 99,    // Isola Vicentina -> Trentino
  5: 99,     // Enego -> Trentino
  4: 99      // Enego Minienduro -> Trentino
};

import { API_BASE, SIMULATOR_URL as SIMULATORE_URL } from '../services/api';

// p35: Larghezze default colonne
const DEFAULT_COLUMN_WIDTHS = {
  pos: 60, var: 45, numero: 70, pilota: 250, moto: 140, classe: 60, totale: 120
};

// Funzione per formattare tempo da secondi a mm:ss.d
const formatTime = (seconds) => {
  if (!seconds || seconds === 'None' || isNaN(parseFloat(seconds))) return null;
  const totalSec = parseFloat(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
};

// FIX Chat 16: Conta PS completate per un pilota
const countPSCompletate = (pilota, numProve) => {
  let count = 0;
  for (let i = 1; i <= numProve; i++) {
    const psKey = `ps${i}`;
    const psTimeKey = `ps${i}_time`;
    // Una PS è completata se ha un tempo valido (non null, non RIT)
    if (pilota[psTimeKey] && pilota[psTimeKey] !== null) {
      count++;
    }
  }
  return count;
};

// FIX Chat 16: Parse tempo totale per ordinamento
const parseTempoTotale = (totaleStr) => {
  if (!totaleStr || totaleStr.includes('RIT')) return Infinity;
  const parts = totaleStr.split(':');
  if (parts.length !== 2) return Infinity;
  const minutes = parseInt(parts[0]);
  const seconds = parseFloat(parts[1]);
  return minutes * 60 + seconds;
};

// FIX Chat 16: Calcola tempo totale in secondi per ordinamento
const calcolaTempoSecondi = (pilota, numProve) => {
  let totale = 0;
  for (let i = 1; i <= numProve; i++) {
    const psTimeKey = `ps${i}_time`;
    const tempo = pilota[psTimeKey];
    if (tempo && tempo !== null) {
      totale += parseFloat(tempo);
    }
  }
  return totale || Infinity;
};

// NUOVO Chat 19: Filtra classifica per classe e ricalcola gap
const filtraPerClasse = (classifica, filtroClasse, filtroMoto, numProve) => {
  let pilotiFiltrati = classifica;
  
  // p35: Filtra per classe (Set)
  if (filtroClasse && filtroClasse.size > 0) {
    pilotiFiltrati = pilotiFiltrati.filter(p => filtroClasse.has(p.classe));
  }
  
  // p35: Filtra per moto (Set)
  if (filtroMoto && filtroMoto.size > 0) {
    pilotiFiltrati = pilotiFiltrati.filter(p => filtroMoto.has(p.moto));
  }
  
  if (pilotiFiltrati.length === 0 || pilotiFiltrati.length === classifica.length) return pilotiFiltrati;
  
  // Ricalcola gap rispetto al primo dei filtrati
  const primo = pilotiFiltrati[0];
  return pilotiFiltrati.map(pilota => {
    const pilotaRicalcolato = { ...pilota };
    for (let i = 1; i <= numProve; i++) {
      const timeKey = `ps${i}_time`;
      const gapKey = `ps${i}`;
      if (pilota[timeKey] && primo[timeKey]) {
        const gap = parseFloat(pilota[timeKey]) - parseFloat(primo[timeKey]);
        pilotaRicalcolato[gapKey] = gap === 0 ? '0.0' : gap.toFixed(1);
      }
    }
    return pilotaRicalcolato;
  });
};

// p35: Calcola punti per posizione in classe (come ERTA)
const calcolaPuntiClasse = (posizione) => {
  if (posizione === 1) return 20;
  if (posizione === 2) return 17;
  if (posizione === 3) return 15;
  if (posizione === 4) return 13;
  if (posizione === 5) return 11;
  if (posizione >= 6 && posizione <= 15) return 16 - posizione; // 6°=10, 7°=9...15°=1
  return 0;
};

// p35: Classi femminili (soglia ≥2 invece di ≥3)
const CLASSI_FEMMINILI = ['MEF', 'FC', 'FU', 'FO', 'SF'];

// FIX Chat 16: Ordina classifica per PS completate (desc) poi tempo totale (asc)
const ordinaClassifica = (classifica, numProve, isGaraConclusa) => {
  return [...classifica].sort((a, b) => {
    const psA = countPSCompletate(a, numProve);
    const psB = countPSCompletate(b, numProve);
    
    // Prima ordina per PS completate (decrescente)
    if (psB !== psA) {
      return psB - psA;
    }
    
    // A parità di PS, ordina per tempo totale calcolato (crescente)
    const tempoA = calcolaTempoSecondi(a, numProve);
    const tempoB = calcolaTempoSecondi(b, numProve);
    return tempoA - tempoB;
  });
};

// FIX Chat 16: Calcola tempo totale sommando i tempi delle PS completate
const calcolaTempoTotale = (pilota, numProve) => {
  let totale = 0;
  let psCompletate = 0;
  
  for (let i = 1; i <= numProve; i++) {
    const psTimeKey = `ps${i}_time`;
    const tempo = pilota[psTimeKey];
    if (tempo && tempo !== null) {
      totale += parseFloat(tempo);
      psCompletate++;
    }
  }
  
  if (psCompletate === 0) return '--';
  
  const minutes = Math.floor(totale / 60);
  const seconds = (totale % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, '0')}`;
};

// FIX Chat 16: Formatta display totale (tempo calcolato o RIT a fine gara)
const getDisplayTotale = (pilota, numProve, isGaraConclusa) => {
  const psCompletate = countPSCompletate(pilota, numProve);
  
  // Se gara conclusa e non tutte PS completate -> RIT
  if (isGaraConclusa && psCompletate < numProve) {
    return `RIT (${psCompletate}/${numProve})`;
  }
  
  // Altrimenti mostra tempo calcolato
  return calcolaTempoTotale(pilota, numProve);
};

// NUOVO p34: Applica ordinamento personalizzato (click su colonne)
const applicaOrdinamentoPersonalizzato = (classifica, sortBy, sortDirection, numProve) => {
  if (sortBy === 'totale') {
    // Ordinamento default: già fatto da ordinaClassifica
    return classifica;
  }
  
  return [...classifica].sort((a, b) => {
    let valA, valB;
    
    if (sortBy === 'pilota') {
      valA = (a.cognome || '').toLowerCase();
      valB = (b.cognome || '').toLowerCase();
    } else if (sortBy === 'numero') {
      valA = parseInt(a.numero_gara) || 999;
      valB = parseInt(b.numero_gara) || 999;
    } else if (sortBy === 'classe') {
      valA = (a.classe || '').toLowerCase();
      valB = (b.classe || '').toLowerCase();
    } else if (sortBy === 'moto') {
      valA = (a.moto || '').toLowerCase();
      valB = (b.moto || '').toLowerCase();
    } else if (sortBy.startsWith('ps')) {
      // Ordinamento per PS specifica (ps1, ps2, ...)
      const psNum = parseInt(sortBy.replace('ps', ''));
      const psTimeKey = `ps${psNum}_time`;
      valA = a[psTimeKey] ? parseFloat(a[psTimeKey]) : 999999;
      valB = b[psTimeKey] ? parseFloat(b[psTimeKey]) : 999999;
    } else {
      return 0;
    }
    
    // Confronto
    let result;
    if (typeof valA === 'string') {
      result = valA.localeCompare(valB);
    } else {
      result = valA - valB;
    }
    
    return sortDirection === 'desc' ? -result : result;
  });
};

// NUOVO Chat 21: Funzioni per calcolo orari teorici CO
const parseOrario = (orarioStr) => {
  if (!orarioStr) return null;
  const [ore, minuti] = orarioStr.split(':').map(Number);
  return ore * 60 + minuti; // Ritorna minuti totali
};

const formatOrarioMinuti = (minuti) => {
  if (minuti === null || minuti === undefined) return '--:--';
  const ore = Math.floor(minuti / 60);
  const min = minuti % 60;
  return `${ore.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
};

const calcolaOrariTeorici = (pilota, tempiSettore) => {
  const orarioPar = parseOrario(pilota.orario_partenza);
  if (orarioPar === null) return { co1: null, co2: null, co3: null, co4: null, co5: null, co6: null, co7: null, arr: null };
  
  // tempi_settore sono in minuti
  const tempoPar = tempiSettore?.tempo_par_co1 || 0;
  const tempoCo1 = tempiSettore?.tempo_co1_co2 || 0;
  const tempoCo2 = tempiSettore?.tempo_co2_co3 || 0;
  const tempoCo3 = tempiSettore?.tempo_co3_co4 || 0;
  const tempoCo4 = tempiSettore?.tempo_co4_co5 || 0;
  const tempoCo5 = tempiSettore?.tempo_co5_co6 || 0;
  const tempoCo6 = tempiSettore?.tempo_co6_co7 || 0;
  const tempoArr = tempiSettore?.tempo_ultimo_arr || 0;
  
  const co1 = tempiSettore?.co1_attivo ? orarioPar + tempoPar : null;
  const co2 = tempiSettore?.co2_attivo ? (co1 ?? orarioPar) + tempoCo1 : null;
  const co3 = tempiSettore?.co3_attivo ? (co2 ?? co1 ?? orarioPar) + tempoCo2 : null;
  const co4 = tempiSettore?.co4_attivo ? (co3 ?? co2 ?? co1 ?? orarioPar) + tempoCo3 : null;
  const co5 = tempiSettore?.co5_attivo ? (co4 ?? co3 ?? co2 ?? co1 ?? orarioPar) + tempoCo4 : null;
  const co6 = tempiSettore?.co6_attivo ? (co5 ?? co4 ?? co3 ?? co2 ?? co1 ?? orarioPar) + tempoCo5 : null;
  const co7 = tempiSettore?.co7_attivo ? (co6 ?? co5 ?? co4 ?? co3 ?? co2 ?? co1 ?? orarioPar) + tempoCo6 : null;
  const arr = (co7 ?? co6 ?? co5 ?? co4 ?? co3 ?? co2 ?? co1 ?? orarioPar) + tempoArr;
  
  return { co1, co2, co3, co4, co5, co6, co7, arr };
};

const ordinaPilotiOrari = (piloti, ordinamento) => {
  return [...piloti].sort((a, b) => {
    switch (ordinamento) {
      case 'numero':
        return (a.numero_gara || 0) - (b.numero_gara || 0);
      case 'alfabetico':
        return (a.cognome || '').localeCompare(b.cognome || '');
      case 'orario':
      default:
        const orarioA = parseOrario(a.orario_partenza) || 9999;
        const orarioB = parseOrario(b.orario_partenza) || 9999;
        return orarioA - orarioB;
    }
  });
};

export default function LiveTiming() {
  // Stati per eventi dinamici
  const [eventi, setEventi] = useState([]);
  const [loadingEventi, setLoadingEventi] = useState(true);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  
  // Stati esistenti (invariati)
  const [replayData, setReplayData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [gridMode, setGridMode] = useState(true); // Griglia attiva di default
  const [garaConclusa, setGaraConclusa] = useState(false); // Conferma manuale fine gara
  const [selectedPilota, setSelectedPilota] = useState(null);
  
  // NUOVO Chat 15: Stati per modalità Live polling
  const [liveMode, setLiveMode] = useState(false);
  const [replayMode, setReplayMode] = useState(false); // p29: Modalità replay
  const [lastSync, setLastSync] = useState(null);
  const [prevLiveClassifica, setPrevLiveClassifica] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(5); // Intervallo refresh 1-15 secondi
  
  // NUOVO Chat 19: Filtro per classe
  const [filtroClasse, setFiltroClasse] = useState(new Set()); // p35: Set vuoto = tutte
  const [filtroMoto, setFiltroMoto] = useState(new Set()); // p35: Filtro moto
  const [showClasseFilter, setShowClasseFilter] = useState(false);
  const [showMotoFilter, setShowMotoFilter] = useState(false);
  
  // p36 FIX: Inizializza filtri con TUTTE le classi/moto quando i dati arrivano
  useEffect(() => {
    if (replayData?.snapshots?.length > 0) {
      const lastSnapshot = replayData.snapshots[replayData.snapshots.length - 1];
      const classifica = lastSnapshot?.classifica || [];
      
      // Popola filtroClasse con tutte le classi (solo se vuoto)
      const tutteClassi = new Set(classifica.map(p => p.classe).filter(Boolean));
      if (filtroClasse.size === 0 && tutteClassi.size > 0) {
        setFiltroClasse(tutteClassi);
      }
      
      // Popola filtroMoto con tutte le moto (solo se vuoto)
      const tutteMoto = new Set(classifica.map(p => p.moto).filter(Boolean));
      if (filtroMoto.size === 0 && tutteMoto.size > 0) {
        setFiltroMoto(tutteMoto);
      }
    }
  }, [replayData]);
  
  // NUOVO p34: Ordinamento cliccabile colonne (default = totale)
  const [sortBy, setSortBy] = useState('totale'); // 'totale' | 'pilota' | 'numero' | 'classe' | 'ps1' | 'ps2' ...
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  
  // p35: Colonne ridimensionabili
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('livetiming_column_widths');
      return saved ? { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COLUMN_WIDTHS };
    } catch { return { ...DEFAULT_COLUMN_WIDTHS }; }
  });
  const [resizing, setResizing] = useState(null);
  const [selectedCols, setSelectedCols] = useState(new Set()); // p35: Selezione multipla colonne
  const tableRef = useRef(null);
  
  // p35: Handler resize colonne (supporta selezione multipla)
  const handleResizeStart = useCallback((col, e) => {
    e.preventDefault();
    const cols = selectedCols.has(col) ? Array.from(selectedCols) : [col];
    setResizing({ col, startX: e.clientX, startWidths: Object.fromEntries(cols.map(c => [c, columnWidths[c] || 100])), cols });
  }, [columnWidths, selectedCols]);
  
  const handleResizeMove = useCallback((e) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    setColumnWidths(prev => {
      const updated = { ...prev };
      resizing.cols.forEach(c => {
        updated[c] = Math.max(40, (resizing.startWidths[c] || 100) + diff);
      });
      localStorage.setItem('livetiming_column_widths', JSON.stringify(updated));
      return updated;
    });
  }, [resizing]);
  
  const handleResizeEnd = useCallback(() => setResizing(null), []);
  
  // p35: Click su header per selezionare/deselezionare colonna (Ctrl+click)
  const handleColSelect = useCallback((col, e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedCols(prev => {
        const next = new Set(prev);
        if (next.has(col)) next.delete(col);
        else next.add(col);
        return next;
      });
    }
  }, []);
  
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);
  
  // NUOVO Chat 21: Tab Orari Partenza
  const [activeTab, setActiveTab] = useState('classifica'); // 'classifica' | 'classi' | 'motoclub' | 'squadre' | 'orari'
  
  // p36 FIX: Reset filtri al cambio tab (ripristina a TUTTE)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Resetta a TUTTE le classi/moto disponibili
    if (replayData?.snapshots?.length > 0) {
      const lastSnapshot = replayData.snapshots[replayData.snapshots.length - 1];
      const classifica = lastSnapshot?.classifica || [];
      setFiltroClasse(new Set(classifica.map(p => p.classe).filter(Boolean)));
      setFiltroMoto(new Set(classifica.map(p => p.moto).filter(Boolean)));
    } else {
      setFiltroClasse(new Set());
      setFiltroMoto(new Set());
    }
  };
  
  const [pilotiOrari, setPilotiOrari] = useState([]);
  const [ordinamentoOrari, setOrdinamentoOrari] = useState('orario'); // 'orario' | 'numero' | 'alfabetico'
  const [loadingOrari, setLoadingOrari] = useState(false);
  const [tempiSettoreOrari, setTempiSettoreOrari] = useState(null);

  // NUOVO: Carica eventi dal database al mount
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(res => res.json())
      .then(data => {
        setEventi(data);
        if (data.length > 0) {
          setEventoSelezionato(data[0].id);
        }
        setLoadingEventi(false);
      })
      .catch(err => {
        console.error('Errore caricamento eventi:', err);
        setLoadingEventi(false);
      });
  }, []);

  // MODIFICATO: Usa API_BASE invece di URL hardcoded
  useEffect(() => {
    if (!eventoSelezionato) return;
    
    setLoading(true);
    setCurrentStep(0);
    setIsPlaying(false);
    setGaraConclusa(false); // Reset conferma fine gara
    
    fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/export-replay`)
      .then(res => res.json())
      .then(data => {
        setPrevLiveClassifica(replayData?.snapshots?.[replayData.snapshots.length - 1]?.classifica || null);
          setReplayData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Errore caricamento replay:', err);
        setReplayData(null);
        setLoading(false);
      });
  }, [eventoSelezionato]);

  // NUOVO Chat 21: Carica piloti e tempi settore per tab Orari
  useEffect(() => {
    if (!eventoSelezionato) return;
    
    setLoadingOrari(true);
    
    // Carica piloti
    const pilotiPromise = fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/piloti`)
      .then(res => res.json());
    
    // Carica tempi settore
    const tempiPromise = fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/tempi-settore`)
      .then(res => res.json());
    
    Promise.all([pilotiPromise, tempiPromise])
      .then(([piloti, tempi]) => {
        setPilotiOrari(piloti || []);
        // I tempi settore possono essere un array (multiple gare) o singolo
        // Trova i tempi settore corrispondenti alla gara selezionata
        if (Array.isArray(tempi)) {
          const eventoObj = eventi.find(e => e.id === eventoSelezionato);
          const codiceGara = eventoObj?.codice_gara;
          const tempiMatch = codiceGara 
            ? tempi.find(t => t.codice_gara === codiceGara) || tempi[0]
            : tempi[0];
          setTempiSettoreOrari(tempiMatch);
        } else {
          setTempiSettoreOrari(tempi);
        }
        setLoadingOrari(false);
      })
      .catch(err => {
        console.error('Errore caricamento dati orari:', err);
        setPilotiOrari([]);
        setTempiSettoreOrari(null);
        setLoadingOrari(false);
      });
  }, [eventoSelezionato]);

  // LIVE polling: chiama FICR -> DB -> display
  // p36 FIX: Separare le due chiamate - export-replay deve essere eseguito SEMPRE
  // p37 FIX: AbortController + race condition fix su setPrevLiveClassifica
  useEffect(() => {
    if (!liveMode || !eventoSelezionato) return;
    const controller = new AbortController();

    const interval = setInterval(async () => {
      // 1. PROVA ad aggiornare da FICR (puo' fallire per CORS, non blocca)
      try {
        await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/poll-ficr-live`, {
          method: 'POST', signal: controller.signal
        });
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('[LIVE] poll-ficr-live fallito (CORS?):', err.message);
      }

      // 2. SEMPRE leggi DB e mostra (indipendente dal punto 1)
      try {
        const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/export-replay`, {
          signal: controller.signal
        });
        const data = await res.json();
        // p37: usa callback form per leggere il valore corrente di replayData (no stale closure)
        setReplayData(prev => {
          setPrevLiveClassifica(prev?.snapshots?.[prev.snapshots.length - 1]?.classifica || null);
          return data;
        });
        setCurrentStep(data.snapshots.length - 1);
        setLastSync(new Date());
      } catch (err) {
        if (err.name !== 'AbortError') console.error('[LIVE] Errore export-replay:', err);
      }
    }, refreshInterval * 1000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [liveMode, eventoSelezionato, refreshInterval]);

  // ============================================
  // DA QUI IN POI: CODICE ORIGINALE INVARIATO
  // ============================================

  useEffect(() => {
    if (!isPlaying || !replayData) return;

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= replayData.snapshots.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        setLastUpdate(new Date());
        return prev + 1;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying, replayData]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    setLastUpdate(null);
    setGaraConclusa(false); // Reset conferma fine gara
  };
  const handleNext = () => {
    if (currentStep < replayData.snapshots.length - 1) {
      setCurrentStep(currentStep + 1);
      setLastUpdate(new Date());
    }
  };

  // NUOVO p34: Handler click colonna per ordinamento
  const handleSortClick = (column) => {
    if (sortBy === column) {
      // Toggle direzione se stessa colonna
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuova colonna: imposta e default asc (tranne totale che è già ordinato)
      setSortBy(column);
      setSortDirection('asc');
    }
  };
  
  // Reset ordinamento a default quando cambia evento
  useEffect(() => {
    setSortBy('totale');
    setSortDirection('asc');
  }, [eventoSelezionato]);

  // CHAT 22: Bottone SIMULA - fa Init + Start + LIVE ON in un click
  const [simulaLoading, setSimulaLoading] = useState(false);
  
  // p26: Stato per polling FICR reale
  const [pollFicrLoading, setPollFicrLoading] = useState(false);

  // p36 FIX: export-replay eseguito SEMPRE, indipendente da poll-ficr-live
  const handlePollFicrLive = async () => {
    if (!eventoSelezionato) return;
    setPollFicrLoading(true);
    
    // 1. PROVA ad aggiornare da FICR (può fallire, non blocca)
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/poll-ficr-live`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!data.success) {
        console.warn('[POLL-FICR] Non success:', data.error);
      }
    } catch (err) {
      console.warn('[POLL-FICR] Fallito (CORS?):', err.message);
    }
    
    // 2. SEMPRE ricarica i dati dal DB
    try {
      const replayRes = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/export-replay`);
      const replayData = await replayRes.json();
      setReplayData(replayData);
      setCurrentStep(replayData.snapshots.length - 1);
      setLastSync(new Date());
    } catch (err) {
      console.error('[POLL-FICR] Errore export-replay:', err.message);
    }
    
    setPollFicrLoading(false);
  };

  
  const handleSimula = async () => {
    if (!eventoSelezionato) return;
    
    setSimulaLoading(true);
    try {
      // 1. Init simulazione con parametri default
      const initRes = await fetch(`${SIMULATORE_URL}/simulator/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento_id: eventoSelezionato,
          batch_size: 10,
          intervallo_secondi: 5,
          sovrapposizione: 0.7
        })
      });
      const initData = await initRes.json();
      
      if (!initData.success) {
        alert('Errore init: ' + initData.error);
        setSimulaLoading(false);
        return;
      }
      
      // 2. Avvia simulazione
      await fetch(`${SIMULATORE_URL}/simulator/start`, { method: 'POST' });
      
      // 3. Attiva LIVE ON
      setLiveMode(true);
      setLastSync(new Date());
      
    } catch (err) {
      alert('Errore simulazione: ' + err.message);
    }
    setSimulaLoading(false);
  };

  // Verifica se la gara è conclusa (conferma manuale)
  const isGaraConclusa = garaConclusa;

  const getStatoProva = (provaNum) => {
    const snapshot = replayData.snapshots[currentStep];
    // Se gara confermata conclusa, tutte le prove sono completate
    if (isGaraConclusa) return 'completata';
    
    // Chat 17: Calcola stato basandosi sui tempi REALI nella classifica
    const classifica = snapshot?.classifica || [];
    const totPiloti = replayData.piloti?.length || classifica.length || 186;
    if (totPiloti === 0) return 'da_svolgere';
    
    const psTimeKey = `ps${provaNum}_time`;
    const pilotiConTempo = classifica.filter(p => p[psTimeKey] && p[psTimeKey] > 0).length;
    
    if (pilotiConTempo === 0) return 'da_svolgere';
    if (pilotiConTempo >= totPiloti * 0.9) return 'completata'; // 90%+ = completata
    return 'live';
  };

  const getStatoProvaIcon = (stato) => {
    switch(stato) {
      case 'completata': return '✅';
      case 'live': return '🔴';
      case 'da_svolgere': return '⚪';
      case 'conclusa': return '🏁';
      default: return '⚪';
    }
  };

  const getStatoProvaLabel = (stato) => {
    switch(stato) {
      case 'completata': return 'Completata';
      case 'live': return 'LIVE';
      case 'da_svolgere': return 'Da svolgere';
      case 'conclusa': return 'GARA CONCLUSA';
      default: return '';
    }
  };

  const getStatoProvaColor = (stato) => {
    switch(stato) {
      case 'completata': return 'text-green-600';
      case 'live': return 'text-red-600 font-bold animate-pulse';
      case 'da_svolgere': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getPosColor = (variazione, psNum, gap) => {
    // FIX Chat 13: Se prova non fatta, nessun colore di sfondo
    if (!gap || gap === '--' || gap === null) return '';
    
    // PS1: sempre grigio (nessuna variazione possibile)
    if (psNum === 1) return 'bg-gray-100 text-gray-900';
    
    if (!variazione || variazione === 0) return 'bg-gray-100 text-gray-900';
    if (variazione > 0) return 'bg-green-100 text-green-900';
    if (variazione < 0) return 'bg-red-100 text-red-900';
    return 'bg-gray-100 text-gray-900';
  };

  const getDistaccoColor = (pilota, psNum, currentSnapshot, prevSnapshot) => {
    // PS1: sempre nero (nessun confronto possibile)
    if (psNum === 1) return 'text-gray-900';
    
    // Primo pilota: sempre nero
    if (pilota.pos === 1) return 'text-gray-900';
    
    const currentPS = pilota[`ps${psNum}`];
    if (!currentPS || currentPS === '0.0' || currentPS === '--') return 'text-gray-900';
    
    // Trova chi precede ATTUALMENTE questo pilota
    const pilotaDavanti = currentSnapshot.classifica.find(p => p.pos === pilota.pos - 1);
    if (!pilotaDavanti) return 'text-gray-900';
    
    // Cerca lo stesso pilota e chi lo precedeva nello snapshot precedente
    if (!prevSnapshot) return 'text-gray-900';
    
    const pilotaPrev = prevSnapshot.classifica.find(p => p.num === pilota.num);
    const pilotaDavantiPrev = prevSnapshot.classifica.find(p => p.num === pilotaDavanti.num);
    
    if (!pilotaPrev || !pilotaDavantiPrev) return 'text-gray-900';
    
    // Calcola gap precedente tra questo pilota e chi lo precede ORA
    // Usa tempi totali in secondi (parsing del formato M:SS.S)
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    };
    
    const gapPrecedente = parseTime(pilotaPrev.totale) - parseTime(pilotaDavantiPrev.totale);
    const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
    
    // Confronta: gap diminuito = verde, aumentato = rosso
    if (Math.abs(gapCorrente - gapPrecedente) < 0.1) return 'text-gray-900'; // Stabile
    if (gapCorrente < gapPrecedente) return 'text-green-600 font-bold'; // Recuperato
    return 'text-red-600 font-bold'; // Perso
  };

  const renderVariazione = (var_value, psNum) => {
    // PS1: sempre linea neutra (nessuna variazione)
    if (psNum === 1) {
      return (
        <div className="flex items-center justify-center gap-1 text-gray-400">
          <Minus className="w-6 h-6" />
        </div>
      );
    }

    if (!var_value || var_value === 0) {
      return (
        <div className="flex items-center justify-center gap-1 text-gray-500">
          <Minus className="w-6 h-6" />
        </div>
      );
    }
    if (var_value > 0) {
      return (
        <div className="flex items-center justify-center gap-1 text-green-600">
          <TrendingUp className="w-6 h-6" />
          <span className="text-2xl font-bold">+{var_value}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-1 text-red-600">
        <TrendingDown className="w-6 h-6" />
        <span className="text-2xl font-bold">{var_value}</span>
      </div>
    );
  };

  const hasGapCritico = (pilota, currentSnapshot) => {
    // Ultimo pilota non ha nessuno dietro
    if (pilota.pos === currentSnapshot.classifica.length) return false;
    
    // Trova chi segue questo pilota
    const pilotaDietro = currentSnapshot.classifica.find(p => p.pos === pilota.pos + 1);
    if (!pilotaDietro) return false;
    
    // Calcola gap con chi segue (parsing tempi totali)
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    };
    
    const gap = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
    
    // Gap critico se chi segue è a meno di 0.5 secondi
    return gap < 0.5;
  };

  // Funzione per ottenere numero in parentesi (uniforme)
  const getCircledNumber = (num) => {
    if (!num || num < 1) return '';
    return `(${num})`;
  };

  const renderPSCell = (pilota, psNum, currentSnapshot, prevSnapshot, debugMode, gridMode, onClick) => {
    const psKey = `ps${psNum}`;
    const gap = pilota[psKey];
    const psTimeKey = `ps${psNum}_time`;
    const tempo = pilota[psTimeKey];
    // FIX Chat 13: Usa variazione specifica per questa PS
    const varKey = `var${psNum}`;
    const variazione = pilota[varKey];
    // FIX Chat 13: Posizione specifica per questa PS
    const posKey = `pos${psNum}`;
    const posizionePS = pilota[posKey];
    
    // FIX Chat 16: Mostra '--' invece di 'RIT' se il pilota non ha tempo per questa PS
    // (significa che i tempi non sono ancora arrivati, non che è ritirato)
    const isRitSenzaTempo = gap === 'RIT' && !tempo;
    const displayGap = isRitSenzaTempo ? '--' : (gap || '--');
    
    const isBestTime = displayGap === '0.0';
    const distaccoColor = getDistaccoColor(pilota, psNum, currentSnapshot, prevSnapshot);
    
    return (
      <td 
        key={psNum} 
        style={{ width: columnWidths[`ps${psNum}`] || 100, minWidth: 60 }}
        className={`px-2 py-2 text-center cursor-pointer hover:bg-blue-50 transition-colors ${getPosColor(variazione, psNum, displayGap)} ${gridMode ? 'border border-gray-300' : ''}`}
        onClick={() => onClick(pilota, psNum)}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            {isBestTime && <Trophy className="w-3 h-3 text-yellow-500" />}
            <span className={`font-mono text-xl ${distaccoColor}`}>
              {displayGap}
            </span>
            {hasGapCritico(pilota, currentSnapshot) && (
              <AlertTriangle className="w-3 h-3 text-red-500" />
            )}
          </div>
          {tempo && (
            <span className="text-[20px] text-gray-500 font-mono">
              {formatTime(tempo)}
            </span>
          )}
          {/* Frecce variazione + posizione PS (solo se prova fatta con tempo valido) */}
          {gap && gap !== '--' && gap !== null && gap !== 'RIT' && tempo && (
            <div className="flex items-center gap-1">
              <span className={`text-[18px] font-mono ${variazione > 0 ? 'text-green-600' : variazione < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {variazione > 0 ? `↑${variazione}` : variazione < 0 ? `↓${Math.abs(variazione)}` : '—'}
              </span>
              {posizionePS && (
                <span className="text-[16px] text-blue-600 font-bold">
                  {getCircledNumber(posizionePS)}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
    );
  };

  // Funzione COMBINATA: info assolute + classe per la PS specifica
  const getPilotaInfoCombined = (pilotaNum, psNum, replayData) => {
    if (!replayData || psNum < 1 || replayData.snapshots.length === 0) return null;
    
    const currentSnapshot = replayData.snapshots[Math.min(psNum - 1, replayData.snapshots.length - 1)];
    const prevSnapshot = psNum > 1 && replayData.snapshots.length > 1 ? replayData.snapshots[Math.min(psNum - 2, replayData.snapshots.length - 2)] : null;
    
    // Trova il pilota nello snapshot corrente
    const pilota = currentSnapshot.classifica.find(p => p.num === pilotaNum);
    if (!pilota) return null;

    const parseTime = (timeStr) => {
      if (!timeStr || timeStr.includes('RIT')) return Infinity;
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    };

    // Calcola variazione posizione ASSOLUTA
    let variazionePosAssoluta = 0;
    if (prevSnapshot) {
      const pilotaPrev = prevSnapshot.classifica.find(p => p.num === pilotaNum);
      if (pilotaPrev) {
        variazionePosAssoluta = pilotaPrev.pos - pilota.pos; // positivo = guadagnato, negativo = perso
      }
    }

    // Totale piloti attivi
    const totaleAssoluto = currentSnapshot.classifica.filter(p => p.stato === 'attivo').length;

    const result = {
      pilota: `${pilota.cognome} ${pilota.nome}`,
      classe: pilota.classe,
      moto: pilota.moto,
      team: pilota.team,
      psNum: psNum,
      tempoTotale: pilota.totale,
      tempoPS: pilota[`ps${psNum}_time`],
      // ASSOLUTA
      posizione: pilota.pos,
      totaleAssoluto: totaleAssoluto,
      variazionePosAssoluta: variazionePosAssoluta,
      assoluta: {
        davanti: null,
        dietro: null,
        podio: null
      },
      // CLASSE
      posizioneClasse: null,
      totaleClasse: null,
      variazionePosClasse: 0,
      classifica: {
        davanti: null,
        dietro: null,
        podio: null
      }
    };

    // ========== ASSOLUTA ==========
    // Chi precede in assoluto
    if (pilota.pos > 1) {
      const pilotaDavanti = currentSnapshot.classifica.find(p => p.pos === pilota.pos - 1);
      if (pilotaDavanti && prevSnapshot) {
        const pilotaPrev = prevSnapshot.classifica.find(p => p.num === pilota.num);
        const pilotaDavantiPrev = prevSnapshot.classifica.find(p => p.num === pilotaDavanti.num);
        
        if (pilotaPrev && pilotaDavantiPrev) {
          const gapPrecedente = parseTime(pilotaPrev.totale) - parseTime(pilotaDavantiPrev.totale);
          const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
          const variazione = (gapCorrente - gapPrecedente).toFixed(1);
          
          result.assoluta.davanti = {
            posizione: pilotaDavanti.pos,
            nome: `${pilotaDavanti.cognome} ${pilotaDavanti.nome}`,
            classe: pilotaDavanti.classe,
            team: pilotaDavanti.team,
            tempoTotale: pilotaDavanti.totale,
            tempoPS: pilotaDavanti[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: variazione,
            staPerdendo: gapCorrente > gapPrecedente
          };
        }
      } else if (pilotaDavanti) {
        // PS1: nessun prevSnapshot, mostra solo gap
        const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
        result.assoluta.davanti = {
          posizione: pilotaDavanti.pos,
          nome: `${pilotaDavanti.cognome} ${pilotaDavanti.nome}`,
          classe: pilotaDavanti.classe,
          team: pilotaDavanti.team,
            tempoTotale: pilotaDavanti.totale,
            tempoPS: pilotaDavanti[`ps${psNum}_time`],
          gap: gapCorrente.toFixed(1),
          variazione: '0',
          staPerdendo: false
        };
      }
    }

    // Chi segue in assoluto
    const pilotiAttivi = currentSnapshot.classifica.filter(p => p.stato === 'attivo');
    if (pilota.pos < pilotiAttivi.length) {
      const pilotaDietro = currentSnapshot.classifica.find(p => p.pos === pilota.pos + 1 && p.stato === 'attivo');
      if (pilotaDietro && prevSnapshot) {
        const pilotaPrev = prevSnapshot.classifica.find(p => p.num === pilota.num);
        const pilotaDietroPrev = prevSnapshot.classifica.find(p => p.num === pilotaDietro.num);
        
        if (pilotaPrev && pilotaDietroPrev) {
          const gapPrecedente = parseTime(pilotaDietroPrev.totale) - parseTime(pilotaPrev.totale);
          const gapCorrente = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
          const variazione = (gapPrecedente - gapCorrente).toFixed(1);
          
          result.assoluta.dietro = {
            posizione: pilotaDietro.pos,
            nome: `${pilotaDietro.cognome} ${pilotaDietro.nome}`,
            classe: pilotaDietro.classe,
            team: pilotaDietro.team,
            tempoTotale: pilotaDietro.totale,
            tempoPS: pilotaDietro[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: variazione,
            staRecuperando: gapCorrente < gapPrecedente
          };
        }
      } else if (pilotaDietro) {
        const gapCorrente = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
        result.assoluta.dietro = {
          posizione: pilotaDietro.pos,
          nome: `${pilotaDietro.cognome} ${pilotaDietro.nome}`,
          classe: pilotaDietro.classe,
          team: pilotaDietro.team,
            tempoTotale: pilotaDietro.totale,
            tempoPS: pilotaDietro[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
          variazione: '0',
          staRecuperando: false
        };
      }
    }

    // Gap dal podio
    if (pilota.pos > 3) {
      const terzoPosto = currentSnapshot.classifica.find(p => p.pos === 3);
      if (terzoPosto) {
        const gapPodio = parseTime(pilota.totale) - parseTime(terzoPosto.totale);
        result.assoluta.podio = {
          gap: gapPodio.toFixed(1),
          tempoTotale: terzoPosto.totale,
          nome: `${terzoPosto.cognome} ${terzoPosto.nome}`
        };
      }
    }

    // ========== CLASSE ==========
    if (pilota.classe) {
      const pilotiClasse = currentSnapshot.classifica
        .filter(p => p.classe === pilota.classe && p.stato === 'attivo')
        .sort((a, b) => parseTime(a.totale) - parseTime(b.totale));
      
      const pilotiClassePrev = prevSnapshot ? prevSnapshot.classifica
        .filter(p => p.classe === pilota.classe && p.stato === 'attivo')
        .sort((a, b) => parseTime(a.totale) - parseTime(b.totale)) : [];

      const posizioneClasse = pilotiClasse.findIndex(p => p.num === pilota.num) + 1;
      result.posizioneClasse = posizioneClasse;
      result.totaleClasse = pilotiClasse.length;

      // Calcola variazione posizione CLASSE
      if (pilotiClassePrev.length > 0) {
        const posizioneClassePrev = pilotiClassePrev.findIndex(p => p.num === pilota.num) + 1;
        if (posizioneClassePrev > 0) {
          result.variazionePosClasse = posizioneClassePrev - posizioneClasse; // positivo = guadagnato
        }
      }

      // Chi precede in classe
      if (posizioneClasse > 1) {
        const pilotaDavanti = pilotiClasse[posizioneClasse - 2];
        if (pilotaDavanti && prevSnapshot) {
          const pilotaPrev = pilotiClassePrev.find(p => p.num === pilota.num);
          const pilotaDavantiPrev = pilotiClassePrev.find(p => p.num === pilotaDavanti.num);
          
          if (pilotaPrev && pilotaDavantiPrev) {
            const gapPrecedente = parseTime(pilotaPrev.totale) - parseTime(pilotaDavantiPrev.totale);
            const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
            const variazione = (gapCorrente - gapPrecedente).toFixed(1);
            
            result.classifica.davanti = {
              posizioneClasse: posizioneClasse - 1,
              nome: `${pilotaDavanti.cognome} ${pilotaDavanti.nome}`,
              team: pilotaDavanti.team,
            tempoTotale: pilotaDavanti.totale,
            tempoPS: pilotaDavanti[`ps${psNum}_time`],
              gap: gapCorrente.toFixed(1),
              variazione: variazione,
              staPerdendo: gapCorrente > gapPrecedente
            };
          }
        } else if (pilotaDavanti) {
          const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
          result.classifica.davanti = {
            posizioneClasse: posizioneClasse - 1,
            nome: `${pilotaDavanti.cognome} ${pilotaDavanti.nome}`,
            team: pilotaDavanti.team,
            tempoTotale: pilotaDavanti.totale,
            tempoPS: pilotaDavanti[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: '0',
            staPerdendo: false
          };
        }
      }

      // Chi segue in classe
      if (posizioneClasse < pilotiClasse.length) {
        const pilotaDietro = pilotiClasse[posizioneClasse];
        if (pilotaDietro && prevSnapshot) {
          const pilotaPrev = pilotiClassePrev.find(p => p.num === pilota.num);
          const pilotaDietroPrev = pilotiClassePrev.find(p => p.num === pilotaDietro.num);
          
          if (pilotaPrev && pilotaDietroPrev) {
            const gapPrecedente = parseTime(pilotaDietroPrev.totale) - parseTime(pilotaPrev.totale);
            const gapCorrente = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
            const variazione = (gapPrecedente - gapCorrente).toFixed(1);
            
            result.classifica.dietro = {
              posizioneClasse: posizioneClasse + 1,
              nome: `${pilotaDietro.cognome} ${pilotaDietro.nome}`,
              team: pilotaDietro.team,
            tempoTotale: pilotaDietro.totale,
            tempoPS: pilotaDietro[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
              variazione: variazione,
              staRecuperando: gapCorrente < gapPrecedente
            };
          }
        } else if (pilotaDietro) {
          const gapCorrente = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
          result.classifica.dietro = {
            posizioneClasse: posizioneClasse + 1,
            nome: `${pilotaDietro.cognome} ${pilotaDietro.nome}`,
            team: pilotaDietro.team,
            tempoTotale: pilotaDietro.totale,
            tempoPS: pilotaDietro[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: '0',
            staRecuperando: false
          };
        }
      }

      // Gap dal podio classe (se fuori dai primi 3)
      if (posizioneClasse > 3 && pilotiClasse.length >= 3) {
        const terzoPostoClasse = pilotiClasse[2]; // indice 2 = 3° posto
        if (terzoPostoClasse) {
          const gapPodioClasse = parseTime(pilota.totale) - parseTime(terzoPostoClasse.totale);
          result.classifica.podio = {
            gap: gapPodioClasse.toFixed(1),
            tempoTotale: terzoPostoClasse.totale,
            nome: `${terzoPostoClasse.cognome} ${terzoPostoClasse.nome}`
          };
        }
      }
    }

    return result;
  };

  const getPilotaInfo = (pilota, currentSnapshot, prevSnapshot) => {
    if (!prevSnapshot) return null;

    const parseTime = (timeStr) => {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    };

    const result = {
      pilota: `${pilota.cognome} ${pilota.nome}`,
      posizione: pilota.pos,
      davanti: null,
      dietro: null,
      podio: null
    };

    // Chi precede ATTUALMENTE
    if (pilota.pos > 1) {
      const pilotaDavanti = currentSnapshot.classifica.find(p => p.pos === pilota.pos - 1);
      if (pilotaDavanti) {
        const pilotaPrev = prevSnapshot.classifica.find(p => p.num === pilota.num);
        const pilotaDavantiPrev = prevSnapshot.classifica.find(p => p.num === pilotaDavanti.num);
        
        if (pilotaPrev && pilotaDavantiPrev) {
          const gapPrecedente = parseTime(pilotaPrev.totale) - parseTime(pilotaDavantiPrev.totale);
          const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
          const variazione = (gapCorrente - gapPrecedente).toFixed(1);
          
          result.davanti = {
            posizione: pilotaDavanti.pos,
            nome: `${pilotaDavanti.cognome} ${pilotaDavanti.nome}`,
            tempoTotale: pilotaDavanti.totale,
            tempoPS: pilotaDavanti[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: variazione,
            staPerdendo: gapCorrente > gapPrecedente
          };
        }
      }
    }

    // Chi segue ATTUALMENTE
    if (pilota.pos < currentSnapshot.classifica.length) {
      const pilotaDietro = currentSnapshot.classifica.find(p => p.pos === pilota.pos + 1);
      if (pilotaDietro) {
        const pilotaPrev = prevSnapshot.classifica.find(p => p.num === pilota.num);
        const pilotaDietroPrev = prevSnapshot.classifica.find(p => p.num === pilotaDietro.num);
        
        if (pilotaPrev && pilotaDietroPrev) {
          const gapPrecedente = parseTime(pilotaDietroPrev.totale) - parseTime(pilotaPrev.totale);
          const gapCorrente = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
          const variazione = (gapPrecedente - gapCorrente).toFixed(1);
          
          result.dietro = {
            posizione: pilotaDietro.pos,
            nome: `${pilotaDietro.cognome} ${pilotaDietro.nome}`,
            tempoTotale: pilotaDietro.totale,
            tempoPS: pilotaDietro[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: variazione,
            staRecuperando: gapCorrente < gapPrecedente
          };
        }
      }
    }

    // Gap dal podio (se fuori dai primi 3)
    if (pilota.pos > 3) {
      const terzoPosto = currentSnapshot.classifica.find(p => p.pos === 3);
      if (terzoPosto) {
        const gapPodio = parseTime(pilota.totale) - parseTime(terzoPosto.totale);
        result.podio = {
          gap: gapPodio.toFixed(1),
          tempoTotale: terzoPosto.totale,
          nome: `${terzoPosto.cognome} ${terzoPosto.nome}`
        };
      }
    }

    return result;
  };

  // Funzione per ottenere info pilota nella sua CLASSE
  const getPilotaInfoClasse = (pilota, currentSnapshot, prevSnapshot) => {
    if (!prevSnapshot || !pilota.classe) return null;

    const parseTime = (timeStr) => {
      if (!timeStr || timeStr.includes('RIT')) return Infinity;
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    };

    // Filtra piloti della stessa classe e ordina per tempo
    const pilotiClasse = currentSnapshot.classifica
      .filter(p => p.classe === pilota.classe && p.stato === 'attivo')
      .sort((a, b) => parseTime(a.totale) - parseTime(b.totale));
    
    const pilotiClassePrev = prevSnapshot.classifica
      .filter(p => p.classe === pilota.classe && p.stato === 'attivo')
      .sort((a, b) => parseTime(a.totale) - parseTime(b.totale));

    // Trova posizione in classe
    const posizioneClasse = pilotiClasse.findIndex(p => p.num === pilota.num) + 1;
    const posizioneClassePrev = pilotiClassePrev.findIndex(p => p.num === pilota.num) + 1;

    const result = {
      pilota: `${pilota.cognome} ${pilota.nome}`,
      classe: pilota.classe,
      posizioneClasse,
      totaleClasse: pilotiClasse.length,
      variazionePosClasse: posizioneClassePrev > 0 ? posizioneClassePrev - posizioneClasse : 0,
      davanti: null,
      dietro: null
    };

    // Chi precede in classe
    if (posizioneClasse > 1) {
      const pilotaDavanti = pilotiClasse[posizioneClasse - 2];
      if (pilotaDavanti) {
        const pilotaPrev = pilotiClassePrev.find(p => p.num === pilota.num);
        const pilotaDavantiPrev = pilotiClassePrev.find(p => p.num === pilotaDavanti.num);
        
        if (pilotaPrev && pilotaDavantiPrev) {
          const gapPrecedente = parseTime(pilotaPrev.totale) - parseTime(pilotaDavantiPrev.totale);
          const gapCorrente = parseTime(pilota.totale) - parseTime(pilotaDavanti.totale);
          const variazione = (gapCorrente - gapPrecedente).toFixed(1);
          
          result.davanti = {
            posizioneClasse: posizioneClasse - 1,
            nome: `${pilotaDavanti.cognome} ${pilotaDavanti.nome}`,
            tempoTotale: pilotaDavanti.totale,
            tempoPS: pilotaDavanti[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: variazione,
            staPerdendo: gapCorrente > gapPrecedente
          };
        }
      }
    }

    // Chi segue in classe
    if (posizioneClasse < pilotiClasse.length) {
      const pilotaDietro = pilotiClasse[posizioneClasse];
      if (pilotaDietro) {
        const pilotaPrev = pilotiClassePrev.find(p => p.num === pilota.num);
        const pilotaDietroPrev = pilotiClassePrev.find(p => p.num === pilotaDietro.num);
        
        if (pilotaPrev && pilotaDietroPrev) {
          const gapPrecedente = parseTime(pilotaDietroPrev.totale) - parseTime(pilotaPrev.totale);
          const gapCorrente = parseTime(pilotaDietro.totale) - parseTime(pilota.totale);
          const variazione = (gapPrecedente - gapCorrente).toFixed(1);
          
          result.dietro = {
            posizioneClasse: posizioneClasse + 1,
            nome: `${pilotaDietro.cognome} ${pilotaDietro.nome}`,
            tempoTotale: pilotaDietro.totale,
            tempoPS: pilotaDietro[`ps${psNum}_time`],
            gap: gapCorrente.toFixed(1),
            variazione: variazione,
            staRecuperando: gapCorrente < gapPrecedente
          };
        }
      }
    }

    return result;
  };

  // NUOVO: Loading eventi
  if (loadingEventi) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento eventi...</p>
        </div>
      </div>
    );
  }

  // Nessun evento disponibile
  if (eventi.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-warning-bg text-warning-fg flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-heading-1 mb-1">Nessun evento disponibile</h2>
          <p className="text-content-secondary text-sm">Importa prima un evento da FICR per iniziare.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 text-content-secondary">
            <svg className="animate-spin w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" className="opacity-75" />
            </svg>
            <span className="text-sm">Caricamento dati replay…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!replayData || !replayData.snapshots || replayData.snapshots.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-warning-bg text-warning-fg flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-heading-1 mb-1">Nessun dato per questa gara</h2>
          <p className="text-content-secondary text-sm mb-5">Seleziona un'altra gara o recupera i tempi dalla FICR.</p>
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
            <select
              value={eventoSelezionato}
              onChange={(e) => setEventoSelezionato(e.target.value)}
              className="h-9 px-3 pr-8 rounded-md border border-border bg-surface text-sm font-medium cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-w-[200px]"
            >
              {eventi.map(evento => (
                <option key={evento.id} value={evento.id}>{evento.nome_evento}</option>
              ))}
            </select>
            <button
              onClick={handlePollFicrLive}
              disabled={!eventoSelezionato || pollFicrLoading}
              className="h-9 px-4 rounded-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pollFicrLoading ? 'Scarico…' : 'Aggiorna da FICR'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSnapshot = replayData.snapshots[currentStep];
  const prevSnapshot = currentStep > 0 ? replayData.snapshots[currentStep - 1] : null;
  // MODIFICATO: Usa nome evento dal database invece di lookup hardcoded
  const eventoCorrente = eventi.find(e => e.id === eventoSelezionato);
  const nomeEvento = eventoCorrente?.nome_evento || 'Evento';

  return (
    <div className="w-full px-3 lg:px-6 py-4 space-y-4">
      {/* Event header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-600 dark:text-brand-500 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-heading-1 truncate">{nomeEvento}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-content-secondary">
              <span>{isGaraConclusa ? 'Gara conclusa' : currentSnapshot.descrizione}</span>
              <span className="text-content-tertiary">·</span>
              <span className="font-mono tabular-nums">Step {currentStep + 1}/{replayData.snapshots.length}</span>
              {liveMode && lastSync && (
                <>
                  <span className="text-content-tertiary">·</span>
                  <span className="flex items-center gap-1 text-success-fg">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    Sync {lastSync.toLocaleTimeString('it-IT')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-surface border border-border-subtle rounded-lg p-3 flex items-center gap-2 flex-wrap">
        {/* Event selector */}
        <select
          value={eventoSelezionato}
          onChange={(e) => setEventoSelezionato(e.target.value)}
          className="h-9 px-3 pr-8 rounded-md border border-border bg-surface text-content-primary text-sm font-medium cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 max-w-xs truncate"
        >
          {eventi.map(evento => (
            <option key={evento.id} value={evento.id}>{evento.nome_evento}</option>
          ))}
        </select>

        <div className="w-px h-6 bg-border-subtle" />

        {/* Mode toggles: segmented control */}
        <div className="inline-flex bg-surface-2 rounded-md p-0.5">
          <button
            onClick={() => { setReplayMode(!replayMode); if (!replayMode) setLiveMode(false); }}
            disabled={liveMode}
            className={`h-8 px-3 rounded-sm text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              replayMode
                ? 'bg-surface shadow-sm text-content-primary'
                : 'text-content-secondary hover:text-content-primary disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay
          </button>
          <button
            onClick={() => { setLiveMode(!liveMode); if (!liveMode) { setReplayMode(false); handlePollFicrLive(); } }}
            className={`h-8 px-3 rounded-sm text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              liveMode
                ? 'bg-danger-fg text-white shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${liveMode ? 'bg-white animate-pulse' : 'bg-danger-fg'}`} />
            Live
          </button>
        </div>

        {/* Replay contextual controls */}
        {replayMode && (
          <>
            <div className="w-px h-6 bg-border-subtle" />
            <button
              onClick={handleReset}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-content-secondary hover:bg-surface-2 hover:text-content-primary transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="h-9 px-3.5 rounded-md bg-brand-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-brand-700 shadow-sm"
            >
              {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pausa' : 'Play'}
            </button>
            <button
              onClick={handleNext}
              disabled={currentStep >= replayData.snapshots.length - 1}
              className="h-9 px-3 rounded-md border border-border text-sm font-medium inline-flex items-center gap-1.5 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Avanti
            </button>
          </>
        )}

        {/* Live contextual controls */}
        {liveMode && (
          <>
            <div className="w-px h-6 bg-border-subtle" />
            <label className="text-xs text-content-secondary font-medium">Refresh</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="h-9 px-2.5 pr-7 rounded-md border border-border bg-surface text-sm font-medium cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.25rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {[1,2,3,5,10].map(sec => <option key={sec} value={sec}>{sec}s</option>)}
            </select>
            {currentStep === replayData.snapshots.length - 1 && (
              <button
                onClick={() => setGaraConclusa(!garaConclusa)}
                className={`h-9 px-3.5 rounded-md text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  garaConclusa
                    ? 'bg-success-fg text-white'
                    : 'bg-warning-bg text-warning-fg border border-warning-border'
                }`}
              >
                {garaConclusa ? '✓ Gara conclusa' : 'Fine gara'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Stato Prove */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h2 className="text-heading-2 text-content-primary">Prove Speciali</h2>
          
          {/* p35: Filtri CL e Moto - spostati qui */}
          <div className="flex gap-3">
            {/* Filtro Classe */}
            <div className="relative">
              <button
                onClick={() => { setShowClasseFilter(!showClasseFilter); setShowMotoFilter(false); }}
                className={`px-5 py-3 border-3 rounded-xl font-bold text-lg flex items-center gap-2 transition-all ${
                  filtroClasse.size > 0 
                    ? 'border-purple-600 bg-purple-500 text-white shadow-lg' 
                    : 'border-purple-400 bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                🏷️ CL {filtroClasse.size > 0 ? `(${filtroClasse.size})` : '▼'}
              </button>
              {showClasseFilter && (
                <div className="absolute top-full right-0 mt-2 bg-white border-3 border-purple-300 rounded-xl shadow-2xl z-50 min-w-[160px] max-h-[350px] overflow-y-auto">
                  <div className="p-3 border-b-2 flex gap-3 bg-purple-50">
                    <button onClick={() => setFiltroClasse(new Set())} className="px-3 py-1 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600">Reset</button>
                    <button onClick={() => setFiltroClasse(new Set([...new Set(currentSnapshot?.classifica?.map(p => p.classe).filter(Boolean))]))} className="px-3 py-1 bg-green-500 text-white rounded-lg font-bold text-sm hover:bg-green-600">Tutte</button>
                  </div>
                  {[...new Set(currentSnapshot?.classifica?.map(p => p.classe).filter(Boolean))].sort().map(classe => (
                    <label key={classe} className="flex items-center gap-3 px-4 py-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-purple-600"
                        checked={filtroClasse.has(classe)}
                        onChange={() => {
                          const next = new Set(filtroClasse);
                          if (next.has(classe)) next.delete(classe);
                          else next.add(classe);
                          setFiltroClasse(next);
                        }}
                      />
                      <span className="text-lg font-semibold">{classe}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            {/* Filtro Moto */}
            <div className="relative">
              <button
                onClick={() => { setShowMotoFilter(!showMotoFilter); setShowClasseFilter(false); }}
                className={`px-5 py-3 border-3 rounded-xl font-bold text-lg flex items-center gap-2 transition-all ${
                  filtroMoto.size > 0 
                    ? 'border-green-600 bg-green-500 text-white shadow-lg' 
                    : 'border-green-400 bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                🏍️ Moto {filtroMoto.size > 0 ? `(${filtroMoto.size})` : '▼'}
              </button>
              {showMotoFilter && (
                <div className="absolute top-full right-0 mt-2 bg-white border-3 border-green-300 rounded-xl shadow-2xl z-50 min-w-[180px] max-h-[350px] overflow-y-auto">
                  <div className="p-3 border-b-2 flex gap-3 bg-green-50">
                    <button onClick={() => setFiltroMoto(new Set())} className="px-3 py-1 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600">Reset</button>
                    <button onClick={() => setFiltroMoto(new Set([...new Set(currentSnapshot?.classifica?.map(p => p.moto).filter(Boolean))]))} className="px-3 py-1 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">Tutte</button>
                  </div>
                  {[...new Set(currentSnapshot?.classifica?.map(p => p.moto).filter(Boolean))].sort().map(moto => (
                    <label key={moto} className="flex items-center gap-3 px-4 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-green-600"
                        checked={filtroMoto.has(moto)}
                        onChange={() => {
                          const next = new Set(filtroMoto);
                          if (next.has(moto)) next.delete(moto);
                          else next.add(moto);
                          setFiltroMoto(next);
                        }}
                      />
                      <span className="text-lg font-semibold">{moto}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {replayData.prove.map((prova, idx) => {
            const stato = getStatoProva(idx + 1);
            return (
              <div
                key={prova.id}
                className={`p-3 rounded-lg border-2 transition-all ${
                  stato === 'completata' ? 'bg-green-50 border-green-300' :
                  stato === 'live' ? 'bg-red-50 border-red-400 animate-pulse' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-5xl mb-1">{getStatoProvaIcon(stato)}</div>
                  <div className="font-semibold text-xl text-gray-800">{prova.nome?.split(' ')[0]}</div>
                  <div className="text-sm text-gray-600">{prova.nome?.split(' ').slice(1).join(' ')}</div>
                  <div className={`text-lg mt-1 ${getStatoProvaColor(stato)}`}>
                    {getStatoProvaLabel(stato)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NUOVO Chat 21: Tabs Classifica / Orari - AGGIORNATO p35 con 5 tab */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="flex flex-wrap">
          <button
            onClick={() => handleTabChange('classifica')}
            className={`flex-1 min-w-[120px] px-4 py-3 text-lg font-bold transition-colors border-b-4 ${
              activeTab === 'classifica'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            🏁 Live
          </button>
          <button
            onClick={() => handleTabChange('classi')}
            className={`flex-1 min-w-[120px] px-4 py-3 text-lg font-bold transition-colors border-b-4 ${
              activeTab === 'classi'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            🏆 Classi
          </button>
          <button
            onClick={() => handleTabChange('motoclub')}
            className={`flex-1 min-w-[120px] px-4 py-3 text-lg font-bold transition-colors border-b-4 ${
              activeTab === 'motoclub'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            🏢 MotoClub
          </button>
          <button
            onClick={() => handleTabChange('squadre')}
            className={`flex-1 min-w-[120px] px-4 py-3 text-lg font-bold transition-colors border-b-4 ${
              activeTab === 'squadre'
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            👥 Squadre
          </button>
          <button
            onClick={() => handleTabChange('orari')}
            className={`flex-1 min-w-[120px] px-4 py-3 text-lg font-bold transition-colors border-b-4 ${
              activeTab === 'orari'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            🕐 Orari
          </button>
        </div>
        
        {/* TAB CLASSIFICA */}
        {activeTab === 'classifica' && (
          <>
            <div className="bg-gray-100 px-6 py-4 border-b">
              <h2 className="text-5xl font-bold text-gray-800">
                Classifica {filtroClasse.size > 0 || filtroMoto.size > 0 ? 'Filtrata' : 'Live'}
              </h2>
              <p className="text-xl text-gray-600 mt-1">
                {filtroClasse.size > 0 || filtroMoto.size > 0
                  ? `${filtraPerClasse(currentSnapshot.classifica, filtroClasse, filtroMoto, replayData.prove.length).length} piloti filtrati`
                  : `${currentSnapshot.classifica.length} piloti`
                } • Prova {currentSnapshot.prova_corrente}/{replayData.prove.length}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full ${gridMode ? 'border-collapse border-2 border-gray-400' : ''}`} style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gray-200 sticky top-0">
                  <tr className={gridMode ? 'border-b-2 border-gray-600' : ''}>
                    <th style={{ width: columnWidths.pos, position: 'relative' }} className={`px-3 py-3 text-left text-lg font-bold text-gray-700 uppercase ${gridMode ? 'border border-gray-400' : ''}`}>
                      Pos
                      <div onMouseDown={(e) => handleResizeStart('pos', e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'pos' ? '#3b82f6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'} onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'pos' ? '#3b82f6' : 'transparent'} />
                    </th>
                    <th style={{ width: columnWidths.var, position: 'relative' }} className={`px-2 py-3 text-center text-lg font-bold text-gray-700 uppercase ${gridMode ? 'border border-gray-400' : ''}`}>
                      △
                      <div onMouseDown={(e) => handleResizeStart('var', e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'var' ? '#3b82f6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'} onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'var' ? '#3b82f6' : 'transparent'} />
                    </th>
                    <th 
                      onClick={() => handleSortClick('numero')}
                      style={{ width: columnWidths.numero, position: 'relative' }}
                      className={`px-3 py-3 text-left text-lg font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-300 select-none ${gridMode ? 'border border-gray-400' : ''} ${sortBy === 'numero' ? 'bg-blue-100' : ''}`}
                    >
                      N° <span className="text-gray-400">{sortBy === 'numero' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart('numero', e); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'numero' ? '#3b82f6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'} onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'numero' ? '#3b82f6' : 'transparent'} />
                    </th>
                    <th 
                      onClick={() => handleSortClick('pilota')}
                      style={{ maxWidth: '300px', width: columnWidths.pilota, position: 'relative' }}
                      className={`px-4 py-3 text-left text-lg font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-300 select-none ${gridMode ? 'border border-gray-400' : ''} ${sortBy === 'pilota' ? 'bg-blue-100' : ''}`}
                    >
                      Pilota <span className="text-gray-400">{sortBy === 'pilota' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      <div 
                        onMouseDown={(e) => { e.stopPropagation(); handleResizeStart('pilota', e); }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'pilota' ? '#3b82f6' : 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'}
                        onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'pilota' ? '#3b82f6' : 'transparent'}
                      />
                    </th>
                    <th 
                      onClick={() => handleSortClick('moto')}
                      style={{ width: columnWidths.moto, position: 'relative' }}
                      className={`px-2 py-3 text-left text-lg font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-300 select-none ${gridMode ? 'border border-gray-400' : ''} ${sortBy === 'moto' ? 'bg-blue-100' : ''}`}
                    >
                      Moto <span className="text-gray-400">{sortBy === 'moto' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      <div 
                        onMouseDown={(e) => { e.stopPropagation(); handleResizeStart('moto', e); }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'moto' ? '#3b82f6' : 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'}
                        onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'moto' ? '#3b82f6' : 'transparent'}
                      />
                    </th>
                    <th 
                      onClick={() => handleSortClick('classe')}
                      style={{ width: columnWidths.classe, position: 'relative' }}
                      className={`px-2 py-3 text-center text-lg font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-300 select-none ${gridMode ? 'border border-gray-400' : ''} ${sortBy === 'classe' ? 'bg-blue-100' : ''}`}
                    >
                      Cl <span className="text-gray-400">{sortBy === 'classe' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart('classe', e); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'classe' ? '#3b82f6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'} onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'classe' ? '#3b82f6' : 'transparent'} />
                    </th>
                    {replayData.prove.map((prova, idx) => {
                      const psKey = `ps${idx + 1}`;
                      const psWidth = columnWidths[psKey] || 100;
                      const isSelected = selectedCols.has(psKey);
                      return (
                        <th 
                          key={prova.id} 
                          onClick={(e) => { if (e.ctrlKey || e.metaKey) handleColSelect(psKey, e); else handleSortClick(psKey); }}
                          style={{ width: psWidth, minWidth: 60, position: 'relative' }}
                          className={`px-2 py-3 text-center text-lg font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-300 select-none ${gridMode ? 'border border-gray-400' : ''} ${sortBy === psKey ? 'bg-blue-100' : ''} ${isSelected ? 'bg-yellow-200' : ''}`}
                        >
                          PS{idx + 1} <span className="text-gray-400">{sortBy === psKey ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                          <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(psKey, e); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === psKey ? '#3b82f6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'} onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === psKey ? '#3b82f6' : 'transparent'} />
                        </th>
                      );
                    })}
                    <th 
                      onClick={() => handleSortClick('totale')}
                      style={{ width: columnWidths.totale, position: 'relative' }}
                      className={`px-3 py-3 text-right text-lg font-bold text-gray-700 uppercase min-w-[120px] cursor-pointer hover:bg-gray-300 select-none ${gridMode ? 'border border-gray-400' : ''} ${sortBy === 'totale' ? 'bg-blue-100' : ''}`}
                    >
                      Totale <span className="text-gray-400">{sortBy === 'totale' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart('totale', e); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.col === 'totale' ? '#3b82f6' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#93c5fd'} onMouseLeave={(e) => e.currentTarget.style.background = resizing?.col === 'totale' ? '#3b82f6' : 'transparent'} />
                    </th>
                  </tr>
                </thead>
                <tbody>
              {/* FIX Chat 16: Ordina classifica per PS completate -> tempo totale */}
              {/* NUOVO Chat 19: Supporto filtro per classe */}
              {/* NUOVO p34: Supporto ordinamento cliccabile */}
              {(() => {
                const numProve = replayData.prove.length;
                const isUltimaProva = currentSnapshot.prova_corrente === numProve;
                const isGaraFinita = isUltimaProva && garaConclusa;
                const classificaOrdinata = ordinaClassifica(currentSnapshot.classifica, numProve, isGaraFinita);
                // p34: Applica ordinamento personalizzato se diverso da default
                const classificaConSort = applicaOrdinamentoPersonalizzato(classificaOrdinata, sortBy, sortDirection, numProve);
                // NUOVO Chat 19: Applica filtro classe se selezionato
                const classificaDaUsare = filtraPerClasse(classificaConSort, filtroClasse, filtroMoto, numProve);
                
                return classificaDaUsare.map((pilota, idx) => {
                const isPodio = idx < 3;
                const displayTotale = getDisplayTotale(pilota, numProve, isGaraFinita);
                // Calcola variazione posizione (anche filtrata per classe)
                let varPosizione = 0;
                if (prevSnapshot) {
                  const prevClassificaOrdinata = ordinaClassifica(prevSnapshot.classifica, numProve, false);
                  const prevClassificaFiltrata = filtraPerClasse(prevClassificaOrdinata, filtroClasse, filtroMoto, numProve);
                  const prevIdx = prevClassificaFiltrata.findIndex(p => p.num === pilota.num);
                  if (prevIdx >= 0) {
                    varPosizione = prevIdx - idx; // positivo = guadagnato, negativo = perso
                  }
                }
                return (
                  <tr
                    key={pilota.num}
                    className={`${gridMode ? 'border-b-2 border-gray-400' : 'border-b'} hover:bg-blue-50 transition-colors ${
                      isPodio ? (
                        idx === 0 ? 'bg-yellow-50' :
                        idx === 1 ? 'bg-gray-100' :
                        'bg-orange-50'
                      ) : ''
                    }`}
                  >
                    <td className={`px-3 py-2 ${gridMode ? 'border border-gray-300' : ''}`}>
                      <div className="flex items-center gap-2">
                        {isPodio && (
                          <Trophy className={`w-5 h-5 ${
                            idx === 0 ? 'text-yellow-500' :
                            idx === 1 ? 'text-gray-400' :
                            'text-orange-400'
                          }`} />
                        )}
                        <span className="font-bold text-gray-900 text-2xl">{idx + 1}°</span>
                      </div>
                    </td>

                    <td className={`px-2 py-2 text-center ${gridMode ? 'border border-gray-300' : ''}`}>
                      {renderVariazione(varPosizione, currentSnapshot.prova_corrente)}
                    </td>

                    <td className={`px-3 py-2 ${gridMode ? 'border border-gray-300' : ''}`}>
                      <div className="inline-block bg-red-600 text-white font-bold px-3 py-1 rounded text-xl">
                        {pilota.num}
                      </div>
                    </td>

                    <td className={`px-4 py-2 ${gridMode ? 'border border-gray-300' : ''}`} style={{ width: columnWidths.pilota }}>
                      <div className="font-semibold text-gray-900 text-2xl">{pilota.cognome} {pilota.nome}</div>
                    </td>

                    <td className={`px-2 py-2 text-left ${gridMode ? 'border border-gray-300' : ''}`} style={{ width: columnWidths.moto }}>
                      {pilota.moto && (
                        <span className="text-lg text-gray-600">{pilota.moto}</span>
                      )}
                    </td>

                    <td className={`px-2 py-2 text-center ${gridMode ? 'border border-gray-300' : ''}`}>
                      <span className="text-lg font-bold text-purple-700 bg-purple-100 px-1 py-0.5 rounded">
                        {pilota.classe}
                      </span>
                    </td>

                    {replayData.prove.map((prova, idx) => (
                      <Fragment key={prova.id}>
                        {renderPSCell(pilota, idx + 1, currentSnapshot, prevSnapshot, debugMode, gridMode, (p, ps) => {
                          const info = getPilotaInfoCombined(p.num, ps, replayData);
                          if (info) setSelectedPilota(info);
                        })}
                      </Fragment>
                    ))}

                    <td className={`px-3 py-2 text-right min-w-[120px] ${gridMode ? 'border border-gray-300' : ''}`}>
                      <span className="font-mono font-bold text-blue-900 text-2xl">
                        {displayTotale}
                      </span>
                    </td>
                  </tr>
                );
              });
              })()}
            </tbody>
          </table>
        </div>
          </>
        )}
        
        {/* TAB CLASSI - p35 */}
        {activeTab === 'classi' && currentSnapshot && (
          <div className="p-6">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">🏆 Classifica per Classi</h2>
            <p className="text-gray-600 mb-4">Seleziona una classe per vedere la classifica dedicata</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {[...new Set(currentSnapshot.classifica?.map(p => p.classe).filter(Boolean))].sort().map(classe => (
                <button
                  key={classe}
                  onClick={() => setFiltroClasse(new Set([classe]))}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    filtroClasse.has(classe) && filtroClasse.size === 1
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  {classe} ({currentSnapshot.classifica.filter(p => p.classe === classe).length})
                </button>
              ))}
              <button
                onClick={() => setFiltroClasse(new Set())}
                className="px-4 py-2 rounded-lg font-bold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Tutte
              </button>
            </div>
            {/* Tabella classifica filtrata */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-purple-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center">Pos</th>
                    <th className="px-4 py-3 text-center">N°</th>
                    <th className="px-4 py-3 text-left">Pilota</th>
                    <th className="px-4 py-3 text-center">Classe</th>
                    <th className="px-4 py-3 text-center">Punti</th>
                    <th className="px-4 py-3 text-right">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const numProve = replayData?.prove?.length || 0;
                    let dati = [...(currentSnapshot?.classifica || [])];
                    
                    // Filtra per classe se selezionata
                    if (filtroClasse.size > 0) {
                      dati = dati.filter(p => filtroClasse.has(p.classe));
                    }
                    
                    // Ordina per tempo
                    dati = dati.map(p => ({
                      ...p,
                      tempoSec: parseTempoTotale(p.totale)
                    })).sort((a, b) => a.tempoSec - b.tempoSec);
                    
                    return dati.map((p, idx) => (
                      <tr key={p.num} className={`border-b ${idx < 3 ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3 text-center font-bold text-xl">{idx + 1}°</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-red-600 text-white px-2 py-1 rounded font-bold">{p.num}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{p.cognome} {p.nome}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">{p.classe}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{calcolaPuntiClasse(idx + 1)}</td>
                        <td className="px-4 py-3 text-right font-mono">{getDisplayTotale(p, numProve, false)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* TAB MOTOCLUB - p35 */}
        {activeTab === 'motoclub' && currentSnapshot && (
          <div className="p-6">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">🏢 Classifica per MotoClub</h2>
            <p className="text-gray-600 mb-4">Seleziona un MotoClub per vedere i suoi piloti</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {[...new Set(currentSnapshot.classifica?.map(p => p.team || p.motoclub).filter(Boolean))].sort().map(mc => (
                <button
                  key={mc}
                  onClick={() => setFiltroMoto(new Set([mc]))}
                  className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                    filtroMoto.has(mc) && filtroMoto.size === 1
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {mc} ({currentSnapshot.classifica.filter(p => (p.team || p.motoclub) === mc).length})
                </button>
              ))}
              <button
                onClick={() => setFiltroMoto(new Set())}
                className="px-4 py-2 rounded-lg font-bold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Tutti
              </button>
            </div>
            {/* Tabella classifica filtrata */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-green-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center">Pos</th>
                    <th className="px-4 py-3 text-center">N°</th>
                    <th className="px-4 py-3 text-left">Pilota</th>
                    <th className="px-4 py-3 text-center">Classe</th>
                    <th className="px-4 py-3 text-left">MotoClub</th>
                    <th className="px-4 py-3 text-right">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const numProve = replayData?.prove?.length || 0;
                    let dati = [...(currentSnapshot?.classifica || [])];
                    
                    // Filtra per motoclub se selezionato
                    if (filtroMoto.size > 0) {
                      dati = dati.filter(p => filtroMoto.has(p.team || p.motoclub));
                    }
                    
                    // Ordina per tempo
                    dati = dati.map(p => ({
                      ...p,
                      tempoSec: parseTempoTotale(p.totale)
                    })).sort((a, b) => a.tempoSec - b.tempoSec);
                    
                    return dati.map((p, idx) => (
                      <tr key={p.num} className={`border-b ${idx < 3 ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3 text-center font-bold text-xl">{idx + 1}°</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-red-600 text-white px-2 py-1 rounded font-bold">{p.num}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{p.cognome} {p.nome}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">{p.classe}</span>
                        </td>
                        <td className="px-4 py-3 text-green-700 font-semibold">{p.team || p.motoclub || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono">{getDisplayTotale(p, numProve, false)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* TAB SQUADRE - p35 */}
        {activeTab === 'squadre' && currentSnapshot && (
          <div className="p-6">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">👥 Classifica Squadre MotoClub</h2>
            <p className="text-gray-600 mb-4">
              Top 3 piloti per MotoClub • Classe costituita: ≥3 piloti (≥2 femminili) • 
              <span className="text-green-600 font-bold"> Verde</span> = porta punti, 
              <span className="text-red-600 font-bold"> Rosso</span> = classe non costituita
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-orange-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center">Pos</th>
                    <th className="px-4 py-3 text-left">MotoClub</th>
                    <th className="px-4 py-3 text-center">Punti</th>
                    <th className="px-4 py-3 text-left">Piloti (Top 3)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const numProve = replayData?.prove?.length || 0;
                    const classificaRaw = currentSnapshot?.classifica || []; const classifica = ordinaClassifica(classificaRaw, numProve, true);
                    
                    // Step 1: Conta piloti per classe
                    const conteggioClassi = {};
                    classifica.forEach(p => {
                      const classe = p.classe || 'N/D';
                      conteggioClassi[classe] = (conteggioClassi[classe] || 0) + 1;
                    });
                    
                    // Step 2: Determina classi costituite
                    const classiCostituite = {};
                    Object.keys(conteggioClassi).forEach(classe => {
                      const soglia = CLASSI_FEMMINILI.includes(classe) ? 2 : 3;
                      classiCostituite[classe] = conteggioClassi[classe] >= soglia;
                    });
                    
                    // Step 3: Calcola posizione in classe e punti
                    const pilotiConPunti = [];
                    const classi = [...new Set(classifica.map(p => p.classe).filter(c => c))];
                    
                    classi.forEach(classe => {
                      const pilotiClasse = classifica
                        .filter(p => p.classe === classe)
                        .map(p => ({ ...p, tempoSec: parseTempoTotale(p.totale) }))
                        .sort((a, b) => a.tempoSec - b.tempoSec);
                      
                      const isCostituta = classiCostituite[classe];
                      
                      pilotiClasse.forEach((p, idx) => {
                        pilotiConPunti.push({
                          ...p,
                          posInClasse: idx + 1,
                          classeCostituta: isCostituta,
                          punti: isCostituta ? calcolaPuntiClasse(idx + 1) : 0
                        });
                      });
                    });
                    
                    // Step 4: Raggruppa per MotoClub
                    const motoClubMap = {};
                    pilotiConPunti.forEach(p => {
                      const mc = p.team || p.motoclub || 'Senza MotoClub';
                      if (!motoClubMap[mc]) motoClubMap[mc] = [];
                      motoClubMap[mc].push(p);
                    });
                    
                    const squadre = [];
                    Object.keys(motoClubMap).forEach(mc => {
                      const piloti = motoClubMap[mc].sort((a, b) => {
                        if (b.punti !== a.punti) return b.punti - a.punti;
                        return classifica.findIndex(x => x.num === a.num) - 
                               classifica.findIndex(x => x.num === b.num);
                      });
                      
                      const top3 = piloti.slice(0, 3);
                      const totPunti = top3.reduce((sum, p) => sum + p.punti, 0);
                      const migliorPosAss = Math.min(...piloti.map(p => 
                        classifica.findIndex(x => x.num === p.num) + 1
                      ));
                      
                      squadre.push({ motoclub: mc, piloti: top3, totPunti, migliorPosAss });
                    });
                    
                    // Step 5: Ordina squadre
                    squadre.sort((a, b) => {
                      if (b.totPunti !== a.totPunti) return b.totPunti - a.totPunti;
                      return a.migliorPosAss - b.migliorPosAss;
                    });
                    
                    return squadre.map((sq, idx) => (
                      <tr key={sq.motoclub} className={`border-b ${idx < 3 ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3 text-center font-bold text-2xl">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}°`}
                        </td>
                        <td className="px-4 py-3 font-bold text-lg">{sq.motoclub}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold text-xl">{sq.totPunti}</span>
                        </td>
                        <td className="px-4 py-3">
                          {sq.piloti.map(p => (
                            <div key={p.num} className={`${p.classeCostituta ? 'text-green-700' : 'text-red-500'}`}>
                              <span className="font-bold">#{p.num}</span> {p.cognome} 
                              <span className="text-gray-500 text-sm ml-1">{p.classe}</span>
                              <span className="font-bold ml-2">({p.punti}pt)</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* TAB ORARI PARTENZA E CO */}
        {activeTab === 'orari' && (
          <>
            <div className="bg-blue-50 px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-4xl font-bold text-gray-800">
                    Orari Partenza e Controlli Orario
                  </h2>
                  <p className="text-xl text-gray-600 mt-1">
                    {pilotiOrari.length} piloti iscritti
                  </p>
                </div>
                
                {/* Bottoni ordinamento */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setOrdinamentoOrari('orario')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      ordinamentoOrari === 'orario'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    🕐 Per Orario
                  </button>
                  <button
                    onClick={() => setOrdinamentoOrari('numero')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      ordinamentoOrari === 'numero'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    🔢 Per Numero
                  </button>
                  <button
                    onClick={() => setOrdinamentoOrari('alfabetico')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      ordinamentoOrari === 'alfabetico'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    🔤 Alfabetico
                  </button>
                </div>
              </div>
            </div>
            
            {loadingOrari ? (
              <div className="p-8 text-center text-xl text-gray-500">
                Caricamento orari...
              </div>
            ) : pilotiOrari.length === 0 ? (
              <div className="p-8 text-center text-xl text-gray-500">
                Nessun pilota con orario di partenza
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-800 text-white sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-center text-lg font-bold">#</th>
                      <th className="px-3 py-3 text-center text-lg font-bold">N°</th>
                      <th className="px-4 py-3 text-left text-lg font-bold">Pilota</th>
                      <th className="px-2 py-3 text-center text-lg font-bold">Classe</th>
                      <th className="px-3 py-3 text-center text-lg font-bold bg-green-700">PAR</th>
                      {tempiSettoreOrari?.co1_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO1</th>
                      )}
                      {tempiSettoreOrari?.co2_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO2</th>
                      )}
                      {tempiSettoreOrari?.co3_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO3</th>
                      )}
                      {tempiSettoreOrari?.co4_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO4</th>
                      )}
                      {tempiSettoreOrari?.co5_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO5</th>
                      )}
                      {tempiSettoreOrari?.co6_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO6</th>
                      )}
                      {tempiSettoreOrari?.co7_attivo && (
                        <th className="px-3 py-3 text-center text-lg font-bold bg-blue-700">CO7</th>
                      )}
                      <th className="px-3 py-3 text-center text-lg font-bold bg-red-700">ARR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordinaPilotiOrari(pilotiOrari, ordinamentoOrari).map((pilota, idx) => {
                      const orari = calcolaOrariTeorici(pilota, tempiSettoreOrari);
                      return (
                        <tr 
                          key={pilota.id || idx}
                          className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}
                        >
                          <td className="px-3 py-3 text-center text-lg font-semibold text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-block bg-gray-800 text-white font-bold text-xl px-3 py-1 rounded">
                              {pilota.numero_gara}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-xl text-gray-900">
                              {pilota.cognome?.toUpperCase()} {pilota.nome}
                            </div>
                            {pilota.team && (
                              <div className="text-sm text-gray-500">{pilota.team}</div>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="inline-block bg-purple-100 text-purple-800 font-semibold px-2 py-1 rounded text-sm">
                              {pilota.classe || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center bg-green-50">
                            <span className="font-mono font-bold text-xl text-green-700">
                              {pilota.orario_partenza || '--:--'}
                            </span>
                          </td>
                          {tempiSettoreOrari?.co1_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co1)}
                              </span>
                            </td>
                          )}
                          {tempiSettoreOrari?.co2_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co2)}
                              </span>
                            </td>
                          )}
                          {tempiSettoreOrari?.co3_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co3)}
                              </span>
                            </td>
                          )}
                          {tempiSettoreOrari?.co4_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co4)}
                              </span>
                            </td>
                          )}
                          {tempiSettoreOrari?.co5_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co5)}
                              </span>
                            </td>
                          )}
                          {tempiSettoreOrari?.co6_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co6)}
                              </span>
                            </td>
                          )}
                          {tempiSettoreOrari?.co7_attivo && (
                            <td className="px-3 py-3 text-center bg-blue-50">
                              <span className="font-mono font-bold text-xl text-blue-700">
                                {formatOrarioMinuti(orari.co7)}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-3 text-center bg-red-50">
                            <span className="font-mono font-bold text-xl text-red-700">
                              {formatOrarioMinuti(orari.arr)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-3xl font-bold mb-4">Legenda</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 rounded"></div>
            <span>Posizione migliorata</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-100 rounded"></div>
            <span>Posizione peggiorata</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>Miglior tempo prova</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>Gap critico (&lt;0.5 sec da chi segue)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">+1.5</span>
            <span>Sei a 1.5 sec da chi ti precede e stai recuperando terreno</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-bold">+3.2</span>
            <span>Sei a 3.2 sec da chi ti precede ma stai perdendo terreno</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-5xl">✅</span>
            <span>Prova completata</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-5xl">🔴</span>
            <span>In corso (LIVE)</span>
          </div>
        </div>
      </div>

      {/* Popup UNIFICATO - Assoluta + Classe */}
      {selectedPilota && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPilota(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 pb-4 border-b-2 border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-gray-900">
                    🏁 {selectedPilota.pilota}
                  </h3>
                  {selectedPilota.moto && (
                    <p className="text-lg text-gray-500">{selectedPilota.moto}</p>
                  )}
                  {selectedPilota.team && (
                    <p className="text-md text-gray-400">🏠 {selectedPilota.team}</p>
                  )}
                </div>
                <span className="text-4xl font-bold text-blue-700">
                  PS{selectedPilota.psNum}
                </span>
              </div>
            </div>

            {/* SEZIONE ASSOLUTA */}
            <div className="mb-8 p-4 border-4 border-blue-500 rounded-xl bg-blue-50/30">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-2xl font-bold text-blue-800">
                  📊 CLASSIFICA ASSOLUTA
                </h4>
                <span className="text-2xl font-bold text-blue-800">
                  {selectedPilota.posizione}°/{selectedPilota.totaleAssoluto}
                </span>
              </div>
              {selectedPilota.variazionePosAssoluta !== 0 && (
                <p className={`text-xl font-bold mb-3 ${selectedPilota.variazionePosAssoluta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedPilota.variazionePosAssoluta > 0 
                    ? `▲ HAI GUADAGNATO ${selectedPilota.variazionePosAssoluta} POSIZIONI`
                    : `▼ HAI PERSO ${Math.abs(selectedPilota.variazionePosAssoluta)} POSIZIONI`
                  }
                </p>
              )}
              {selectedPilota.variazionePosAssoluta === 0 && selectedPilota.psNum > 1 && (
                <p className="text-xl font-bold mb-3 text-gray-500">
                  ● POSIZIONE INVARIATA
                </p>
              )}
              
              {/* Chi precede in assoluto */}
              {selectedPilota.assoluta.davanti ? (
                <div className="mb-3 p-3 bg-green-100 rounded-lg border border-green-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold text-green-900">
                        ⬆️ {selectedPilota.assoluta.davanti.posizione}° {selectedPilota.assoluta.davanti.nome} ({selectedPilota.assoluta.davanti.classe})
                      </p>
                      {selectedPilota.assoluta.davanti.team && (
                        <p className="text-sm text-green-700">🏠 {selectedPilota.assoluta.davanti.team}</p>
                      )}
                    </div>
                    <span className="text-lg font-mono font-bold text-green-900">{selectedPilota.assoluta.davanti.tempoTotale}</span>
                  </div>
                  {selectedPilota.assoluta.davanti.tempoPS && selectedPilota.tempoPS && (
                    <div className="flex justify-between items-center text-green-800">
                      <span className="font-mono">PS{selectedPilota.psNum} = {formatTime(selectedPilota.assoluta.davanti.tempoPS)}</span>
                      <span className="font-mono">
                        guadagnato = {(parseFloat(selectedPilota.assoluta.davanti.tempoPS) - parseFloat(selectedPilota.tempoPS)).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className={`text-lg ${selectedPilota.assoluta.davanti.staPerdendo ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedPilota.assoluta.davanti.variazione !== '0' && (
                        <span>
                          {selectedPilota.assoluta.davanti.staPerdendo ? '⚠️ stai perdendo' : '✅ hai recuperato'} {Math.abs(parseFloat(selectedPilota.assoluta.davanti.variazione))}s
                        </span>
                      )}
                    </span>
                    <span className="text-lg font-mono font-bold">Gap = {selectedPilota.assoluta.davanti.gap}s</span>
                  </div>
                </div>
              ) : selectedPilota.posizione === 1 ? (
                <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                  <p className="text-lg font-bold text-yellow-800">🥇 Sei PRIMO in assoluto!</p>
                </div>
              ) : null}


              {/* Pilota corrente */}
              <div className="mb-3 p-4 bg-red-200 rounded-lg border-2 border-red-400">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xl font-bold text-red-900 uppercase">
                    {selectedPilota.pilota} ({selectedPilota.classe})
                  </p>
                  <span className="text-xl font-mono font-bold text-red-900">{selectedPilota.tempoTotale}</span>
                </div>
                {selectedPilota.tempoPS && (
                  <p className="text-lg font-mono text-red-800">
                    PS{selectedPilota.psNum} = {formatTime(selectedPilota.tempoPS)}
                  </p>
                )}
              </div>
              {/* Chi segue in assoluto */}
              {selectedPilota.assoluta.dietro && (
                <div className="mb-3 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold text-yellow-900">
                        ⬇️ {selectedPilota.assoluta.dietro.posizione}° {selectedPilota.assoluta.dietro.nome} ({selectedPilota.assoluta.dietro.classe})
                      </p>
                      {selectedPilota.assoluta.dietro.team && (
                        <p className="text-sm text-yellow-700">🏠 {selectedPilota.assoluta.dietro.team}</p>
                      )}
                    </div>
                    <span className="text-lg font-mono font-bold text-yellow-900">{selectedPilota.assoluta.dietro.tempoTotale}</span>
                  </div>
                  {selectedPilota.assoluta.dietro.tempoPS && selectedPilota.tempoPS && (
                    <div className="flex justify-between items-center text-yellow-800">
                      <span className="font-mono">PS{selectedPilota.psNum} = {formatTime(selectedPilota.assoluta.dietro.tempoPS)}</span>
                      <span className="font-mono">
                        guadagnato = {(parseFloat(selectedPilota.assoluta.dietro.tempoPS) - parseFloat(selectedPilota.tempoPS)).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className={`text-lg ${selectedPilota.assoluta.dietro.staRecuperando ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedPilota.assoluta.dietro.variazione !== '0' && (
                        <span>
                          {selectedPilota.assoluta.dietro.staRecuperando ? '⚠️ ti sta recuperando' : '✅ hai guadagnato'} {Math.abs(parseFloat(selectedPilota.assoluta.dietro.variazione))}s
                        </span>
                      )}
                    </span>
                    <span className="text-lg font-mono font-bold">Gap = {selectedPilota.assoluta.dietro.gap}s</span>
                  </div>
                </div>
              )}

              {/* Gap dal podio */}
              {selectedPilota.assoluta.podio && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                  <p className="text-lg text-yellow-800">
                    🥉 Gap dal podio: <strong>{selectedPilota.assoluta.podio.gap}s</strong> da {selectedPilota.assoluta.podio.nome}
                  </p>
                </div>
              )}
              {selectedPilota.posizione <= 3 && selectedPilota.posizione > 1 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-300">
                  <p className="text-lg font-bold text-green-800">🏆 Sei sul podio!</p>
                </div>
              )}
            </div>

            {/* SEZIONE CLASSE */}
            {selectedPilota.classe && (
              <div className="mb-4 p-4 border-4 border-purple-500 rounded-xl bg-purple-50/30">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-2xl font-bold text-purple-800">
                    {selectedPilota.posizioneClasse <= 3 ? '🏆' : '📊'} CLASSIFICA CLASSE {selectedPilota.classe}
                  </h4>
                  <span className="text-2xl font-bold text-purple-800">
                    {selectedPilota.posizioneClasse}°/{selectedPilota.totaleClasse}
                  </span>
                </div>
                {selectedPilota.variazionePosClasse !== 0 && (
                  <p className={`text-xl font-bold mb-3 ${selectedPilota.variazionePosClasse > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedPilota.variazionePosClasse > 0 
                      ? `▲ HAI GUADAGNATO ${selectedPilota.variazionePosClasse} POSIZIONI`
                      : `▼ HAI PERSO ${Math.abs(selectedPilota.variazionePosClasse)} POSIZIONI`
                    }
                  </p>
                )}
                {selectedPilota.variazionePosClasse === 0 && selectedPilota.psNum > 1 && (
                  <p className="text-xl font-bold mb-3 text-gray-500">
                    ● POSIZIONE INVARIATA
                  </p>
                )}
                
                {/* Chi precede in classe */}
                {selectedPilota.classifica.davanti ? (
                  <div className="mb-3 p-3 bg-green-100 rounded-lg border border-green-300">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-lg font-bold text-green-900">
                          ⬆️ {selectedPilota.classifica.davanti.posizioneClasse}° {selectedPilota.classifica.davanti.nome}
                        </p>
                        {selectedPilota.classifica.davanti.team && (
                          <p className="text-sm text-green-700">🏠 {selectedPilota.classifica.davanti.team}</p>
                        )}
                      </div>
                      <span className="text-lg font-mono font-bold text-green-900">{selectedPilota.classifica.davanti.tempoTotale}</span>
                    </div>
                    {selectedPilota.classifica.davanti.tempoPS && selectedPilota.tempoPS && (
                      <div className="flex justify-between items-center text-green-800">
                        <span className="font-mono">PS{selectedPilota.psNum} = {formatTime(selectedPilota.classifica.davanti.tempoPS)}</span>
                        <span className="font-mono">
                          guadagnato = {(parseFloat(selectedPilota.classifica.davanti.tempoPS) - parseFloat(selectedPilota.tempoPS)).toFixed(2)}s
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className={`text-lg ${selectedPilota.classifica.davanti.staPerdendo ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedPilota.classifica.davanti.variazione !== '0' && (
                          <span>
                            {selectedPilota.classifica.davanti.staPerdendo ? '⚠️ stai perdendo' : '✅ hai recuperato'} {Math.abs(parseFloat(selectedPilota.classifica.davanti.variazione))}s
                          </span>
                        )}
                      </span>
                      <span className="text-lg font-mono font-bold">Gap = {selectedPilota.classifica.davanti.gap}s</span>
                    </div>
                  </div>
                ) : selectedPilota.posizioneClasse === 1 ? (
                  <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                    <p className="text-lg font-bold text-yellow-800">🥇 Sei PRIMO nella tua classe!</p>
                  </div>
                ) : null}


                {/* Pilota corrente classe */}
                <div className="mb-3 p-4 bg-red-200 rounded-lg border-2 border-red-400">
                  <div className="flex justify-between items-center mb-1">
                  <p className="text-xl font-bold text-red-900 uppercase">
                      {selectedPilota.pilota}
                    </p>
                    <span className="text-xl font-mono font-bold text-red-900">{selectedPilota.tempoTotale}</span>
                  </div>
                  {selectedPilota.tempoPS && (
                    <p className="text-lg font-mono text-red-800">
                      PS{selectedPilota.psNum} = {formatTime(selectedPilota.tempoPS)}
                    </p>
                  )}
                </div>
                {/* Chi segue in classe */}
                {selectedPilota.classifica.dietro && (
                  <div className="mb-3 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-lg font-bold text-yellow-900">
                          ⬇️ {selectedPilota.classifica.dietro.posizioneClasse}° {selectedPilota.classifica.dietro.nome}
                        </p>
                        {selectedPilota.classifica.dietro.team && (
                          <p className="text-sm text-yellow-700">🏠 {selectedPilota.classifica.dietro.team}</p>
                        )}
                      </div>
                      <span className="text-lg font-mono font-bold text-yellow-900">{selectedPilota.classifica.dietro.tempoTotale}</span>
                    </div>
                    {selectedPilota.classifica.dietro.tempoPS && selectedPilota.tempoPS && (
                      <div className="flex justify-between items-center text-yellow-800">
                        <span className="font-mono">PS{selectedPilota.psNum} = {formatTime(selectedPilota.classifica.dietro.tempoPS)}</span>
                        <span className="font-mono">
                          guadagnato = {(parseFloat(selectedPilota.classifica.dietro.tempoPS) - parseFloat(selectedPilota.tempoPS)).toFixed(2)}s
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className={`text-lg ${selectedPilota.classifica.dietro.staRecuperando ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedPilota.classifica.dietro.variazione !== '0' && (
                          <span>
                            {selectedPilota.classifica.dietro.staRecuperando ? '⚠️ ti sta recuperando' : '✅ hai guadagnato'} {Math.abs(parseFloat(selectedPilota.classifica.dietro.variazione))}s
                          </span>
                        )}
                      </span>
                      <span className="text-lg font-mono font-bold">Gap = {selectedPilota.classifica.dietro.gap}s</span>
                    </div>
                  </div>
                )}

                {/* Gap dal podio classe */}
                {selectedPilota.classifica.podio && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                    <p className="text-lg text-yellow-800">
                      🥉 Gap dal podio classe: <strong>{selectedPilota.classifica.podio.gap}s</strong> da {selectedPilota.classifica.podio.nome}
                    </p>
                  </div>
                )}
                {selectedPilota.posizioneClasse <= 3 && selectedPilota.posizioneClasse > 1 && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-300">
                    <p className="text-lg font-bold text-green-800">🏆 Sei sul podio di classe!</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedPilota(null)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold text-xl"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
