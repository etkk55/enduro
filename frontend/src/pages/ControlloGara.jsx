import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Play, Pause, Square, RotateCcw, Radio, ExternalLink, Trash2, MapPin, Save, Clock, Download } from 'lucide-react';

import { API_BASE, SIMULATOR_URL as SIMULATORE_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input, { Select, Label } from '../components/ui/Input';
import LiveDot from '../components/ui/LiveDot';

export default function ControlloGara() {
  // Stati eventi
  const [eventi, setEventi] = useState([]);
  const [loadingEventi, setLoadingEventi] = useState(true);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [eventoInfo, setEventoInfo] = useState(null);
  
  // Stati simulazione
  const [fonteDati, setFonteDati] = useState('simulatore');
  const [statoSimulazione, setStatoSimulazione] = useState(null);
  const [logEventi, setLogEventi] = useState([]);
  
  // Parametri SEMPLIFICATI
  const [batchSize, setBatchSize] = useState(10);
  const [intervalloSecondi, setIntervalloSecondi] = useState(5);
  const [sovrapposizione, setSovrapposizione] = useState(70);
  
  // NUOVO Chat 21: Parametri Paddock e GPS
  const [paddock1Lat, setPaddock1Lat] = useState('');
  const [paddock1Lon, setPaddock1Lon] = useState('');
  const [paddock2Lat, setPaddock2Lat] = useState('');
  const [paddock2Lon, setPaddock2Lon] = useState('');
  const [paddockRaggio, setPaddockRaggio] = useState(500);
  const [gpsFrequenza, setGpsFrequenza] = useState(30);
  const [allarmeFermoMinuti, setAllarmeFermoMinuti] = useState(10);
  const [codiceDdG, setCodiceDdG] = useState(''); // Codice accesso Direzione Gara
  const [codiceAccesso, setCodiceAccesso] = useState(''); // Codice accesso Piloti
  const [codiceAccessoPubblico, setCodiceAccessoPubblico] = useState(''); // NUOVO Chat 22: Accesso Pubblico ERTA
  const [salvandoParametri, setSalvandoParametri] = useState(false);
  
  // NUOVO Chat 20: Tempi Settore
  const [gareFratelle, setGareFratelle] = useState([]);
  const [tempiSettore, setTempiSettore] = useState({});
  const [salvandoTempi, setSalvandoTempi] = useState(false);
  
  // NUOVO Chat 20: Import XML e Orari FICR
  const [importandoFicr, setImportandoFicr] = useState({}); // {program: true, entrylist: false, startlist: false}
  const [importResult, setImportResult] = useState({});
  const [cancellandoPiloti, setCancellandoPiloti] = useState(false);
  
  // NUOVO Chat 21: Parametri API FICR
  const [ficrAnno, setFicrAnno] = useState(new Date().getFullYear());
  const [ficrCodiceEquipe, setFicrCodiceEquipe] = useState('');
  const [ficrManifestazione, setFicrManifestazione] = useState('');
  
  // DMS Converter states
  const [showDmsConverter, setShowDmsConverter] = useState(null); // 'paddock1' | 'paddock2' | null
  const [dmsGradi, setDmsGradi] = useState('');
  const [dmsPrimi, setDmsPrimi] = useState('');
  const [dmsSecondi, setDmsSecondi] = useState('');
  const [dmsTarget, setDmsTarget] = useState('lat'); // 'lat' | 'lon'
  
  // Converti DMS in decimale
  const convertDmsToDecimal = () => {
    const gradi = parseFloat(dmsGradi) || 0;
    const primi = parseFloat(dmsPrimi) || 0;
    const secondi = parseFloat(dmsSecondi) || 0;
    
    const decimale = gradi + (primi / 60) + (secondi / 3600);
    const risultato = decimale.toFixed(6);
    
    // Applica al campo corretto
    if (showDmsConverter === 'paddock1') {
      if (dmsTarget === 'lat') setPaddock1Lat(risultato);
      else setPaddock1Lon(risultato);
    } else if (showDmsConverter === 'paddock2') {
      if (dmsTarget === 'lat') setPaddock2Lat(risultato);
      else setPaddock2Lon(risultato);
    }
    
    // Reset e chiudi
    setDmsGradi('');
    setDmsPrimi('');
    setDmsSecondi('');
    setShowDmsConverter(null);
  };
  
  // Carica eventi
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(res => res.json())
      .then(data => {
        setEventi(data);
        setLoadingEventi(false);
      })
      .catch(err => {
        console.error('Errore caricamento eventi:', err);
        setLoadingEventi(false);
      });
  }, []);
  
  // Quando cambia evento, carica info
  useEffect(() => {
    if (!eventoSelezionato) {
      setEventoInfo(null);
      // Reset parametri paddock
      setPaddock1Lat('');
      setPaddock1Lon('');
      setPaddock2Lat('');
      setPaddock2Lon('');
      setPaddockRaggio(500);
      setGpsFrequenza(30);
      setAllarmeFermoMinuti(10);
      setCodiceDdG('');
      setCodiceAccesso('');
      return;
    }
    
    const evento = eventi.find(e => e.id === eventoSelezionato);
    if (evento) {
      // Carica parametri paddock dall'evento
      setPaddock1Lat(evento.paddock1_lat || '');
      setPaddock1Lon(evento.paddock1_lon || '');
      setPaddock2Lat(evento.paddock2_lat || '');
      setPaddock2Lon(evento.paddock2_lon || '');
      setPaddockRaggio(evento.paddock_raggio || 500);
      setGpsFrequenza(evento.gps_frequenza || 30);
      setAllarmeFermoMinuti(evento.allarme_fermo_minuti || 10);
      setCodiceDdG(evento.codice_ddg || '');
      // Codice accesso piloti: usa codice_accesso se presente, altrimenti codice_gara
      setCodiceAccesso(evento.codice_accesso || evento.codice_gara || '');
      // NUOVO Chat 22: Carica codice accesso pubblico
      setCodiceAccessoPubblico(evento.codice_accesso_pubblico || '');
      // NUOVO: Carica parametri FICR
      setFicrAnno(evento.ficr_anno || new Date().getFullYear());
      setFicrCodiceEquipe(evento.ficr_codice_equipe || '');
      setFicrManifestazione(evento.ficr_manifestazione || '');
      
      // Conta piloti
      fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/piloti`)
        .then(res => res.json())
        .then(piloti => {
          setEventoInfo({
            ...evento,
            numPiloti: piloti.length
          });
          
          // Aggiungi log locale
          aggiungiLogLocale('📋', 'EVENTO', `Selezionato: ${evento.nome_evento}`);
          aggiungiLogLocale('📊', 'INFO', `${piloti.length} piloti, ${piloti.length} in classifica`);
        })
        .catch(err => console.error('Errore caricamento piloti:', err));
    }
  }, [eventoSelezionato, eventi]);
  
  // NUOVO Chat 20: Carica gare fratelle e tempi settore
  useEffect(() => {
    if (!eventoSelezionato) {
      setGareFratelle([]);
      setTempiSettore({});
      return;
    }
    
    const evento = eventi.find(e => e.id === eventoSelezionato);
    if (!evento) return;
    
    // Trova gare fratelle (stesso prefisso, es. 303-1, 303-2, 303-3) e ordina per codice
    const prefisso = evento.codice_gara.split('-')[0];
    const fratelle = eventi
      .filter(e => e.codice_gara.startsWith(prefisso + '-'))
      .sort((a, b) => a.codice_gara.localeCompare(b.codice_gara));
    setGareFratelle(fratelle);
    
    // Carica tempi settore per questo evento
    fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/tempi-settore`)
      .then(res => res.json())
      .then(data => {
        const tempiMap = {};
        data.forEach(ts => {
          tempiMap[ts.codice_gara] = {
            co1_attivo: ts.co1_attivo ?? true,
            co2_attivo: ts.co2_attivo ?? true,
            co3_attivo: ts.co3_attivo ?? false,
            co4_attivo: ts.co4_attivo ?? false,
            co5_attivo: ts.co5_attivo ?? false,
            co6_attivo: ts.co6_attivo ?? false,
            co7_attivo: ts.co7_attivo ?? false,
            tempo_par_co1: ts.tempo_par_co1 || '',
            tempo_co1_co2: ts.tempo_co1_co2 || '',
            tempo_co2_co3: ts.tempo_co2_co3 || '',
            tempo_co3_co4: ts.tempo_co3_co4 || '',
            tempo_co4_co5: ts.tempo_co4_co5 || '',
            tempo_co5_co6: ts.tempo_co5_co6 || '',
            tempo_co6_co7: ts.tempo_co6_co7 || '',
            tempo_ultimo_arr: ts.tempo_ultimo_arr || ''
          };
        });
        
        // Inizializza gare senza configurazione
        fratelle.forEach(g => {
          if (!tempiMap[g.codice_gara]) {
            tempiMap[g.codice_gara] = {
              co1_attivo: true, co2_attivo: true, co3_attivo: false,
              co4_attivo: false, co5_attivo: false, co6_attivo: false, co7_attivo: false,
              tempo_par_co1: '', tempo_co1_co2: '', tempo_co2_co3: '',
              tempo_co3_co4: '', tempo_co4_co5: '', tempo_co5_co6: '', tempo_co6_co7: '',
              tempo_ultimo_arr: ''
            };
          }
        });
        
        setTempiSettore(tempiMap);
      })
      .catch(err => console.error('Errore caricamento tempi settore:', err));
  }, [eventoSelezionato, eventi]);
  
  // POLLING stato simulazione (ogni 2 secondi)
  useEffect(() => {
    const fetchStatus = () => {
      fetch(`${SIMULATORE_URL}/simulator/status`)
        .then(res => res.json())
        .then(data => {
          setStatoSimulazione(data);
        })
        .catch(err => console.error('Errore status:', err));
    };
    
    fetchStatus(); // Chiamata iniziale
    const interval = setInterval(fetchStatus, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // POLLING log dal server (ogni 3 secondi)
  useEffect(() => {
    const fetchLog = () => {
      fetch(`${SIMULATORE_URL}/simulator/log`)
        .then(res => res.json())
        .then(data => {
          if (data.log && data.log.length > 0) {
            setLogEventi(data.log);
          }
        })
        .catch(err => console.error('Errore log:', err));
    };
    
    fetchLog(); // Chiamata iniziale
    const interval = setInterval(fetchLog, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Aggiungi log locale (per eventi frontend)
  const aggiungiLogLocale = (icona, tipo, messaggio) => {
    const log = {
      timestamp: new Date().toLocaleTimeString('it-IT'),
      icona,
      tipo,
      messaggio
    };
    setLogEventi(prev => [log, ...prev.slice(0, 99)]);
  };
  
  // Handlers
  const handleInit = async () => {
    if (!eventoSelezionato) return;
    
    aggiungiLogLocale('🚀', 'AVVIO', 'Inizializzazione simulazione...');
    
    try {
      const res = await fetch(`${SIMULATORE_URL}/simulator/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento_id: eventoSelezionato,
          batch_size: batchSize,
          intervallo_secondi: intervalloSecondi,
          sovrapposizione: sovrapposizione / 100
        })
      });
      
      const data = await res.json();
      if (data.success) {
        aggiungiLogLocale('✅', 'PRONTO', `${data.tempiTotali} tempi in coda, ${data.piloti} piloti`);
        aggiungiLogLocale('⚙️', 'CONFIG', `${batchSize} tempi ogni ${intervalloSecondi}s, Sovr ${sovrapposizione}%`);
      } else {
        aggiungiLogLocale('❌', 'ERRORE', data.error);
      }
    } catch (err) {
      aggiungiLogLocale('❌', 'ERRORE', err.message);
    }
  };
  
  const handleStart = async () => {
    try {
      const res = await fetch(`${SIMULATORE_URL}/simulator/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        aggiungiLogLocale('▶️', 'AVVIATO', 'Simulazione in corso...');
      }
    } catch (err) {
      aggiungiLogLocale('❌', 'ERRORE', err.message);
    }
  };
  
  const handlePause = async () => {
    try {
      const res = await fetch(`${SIMULATORE_URL}/simulator/pause`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        aggiungiLogLocale(data.inPausa ? '⏸️' : '▶️', data.inPausa ? 'PAUSA' : 'RIPRESO', '');
      }
    } catch (err) {
      aggiungiLogLocale('❌', 'ERRORE', err.message);
    }
  };
  
  const handleStop = async () => {
    try {
      const res = await fetch(`${SIMULATORE_URL}/simulator/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        aggiungiLogLocale('⏹️', 'STOP', `Fermato a ${data.tempiRilasciati} tempi`);
      }
    } catch (err) {
      aggiungiLogLocale('❌', 'ERRORE', err.message);
    }
  };
  
  const handleReset = async () => {
    try {
      const res = await fetch(`${SIMULATORE_URL}/simulator/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: eventoSelezionato })
      });
      const data = await res.json();
      if (data.success) {
        aggiungiLogLocale('🔄', 'RESET', 'Simulazione resettata');
      }
    } catch (err) {
      aggiungiLogLocale('❌', 'ERRORE', err.message);
    }
  };
  
  const clearLog = () => {
    setLogEventi([]);
  };
  
  // NUOVO Chat 21: Salva parametri Paddock/GPS
  const salvaParametriGPS = async () => {
    if (!eventoSelezionato) return;
    
    setSalvandoParametri(true);
    try {
      // Salva parametri GPS/Paddock
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/parametri-gps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paddock1_lat: paddock1Lat || null,
          paddock1_lon: paddock1Lon || null,
          paddock2_lat: paddock2Lat || null,
          paddock2_lon: paddock2Lon || null,
          paddock_raggio: paddockRaggio,
          gps_frequenza: gpsFrequenza,
          allarme_fermo_minuti: allarmeFermoMinuti,
          codice_ddg: codiceDdG || null,
          // Parametri FICR
          ficr_anno: ficrAnno || null,
          ficr_codice_equipe: ficrCodiceEquipe || null,
          ficr_manifestazione: ficrManifestazione || null,
          // NUOVO Chat 22: Accesso pubblico ERTA
          codice_accesso_pubblico: codiceAccessoPubblico || null
        })
      });
      
      // Salva codice accesso piloti
      if (codiceAccesso) {
        await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/codice-accesso`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codice_accesso: codiceAccesso })
        });
      }
      
      const data = await res.json();
      if (data.success) {
        aggiungiLogLocale('✅', 'SALVATO', 'Parametri aggiornati');
        // Aggiorna evento in memoria
        setEventi(prevEventi => prevEventi.map(e => 
          e.id === eventoSelezionato ? { 
            ...e, 
            ...data.evento,
            ficr_anno: ficrAnno,
            ficr_codice_equipe: ficrCodiceEquipe,
            ficr_manifestazione: ficrManifestazione
          } : e
        ));
      } else {
        aggiungiLogLocale('❌', 'ERRORE', data.error);
      }
    } catch (err) {
      aggiungiLogLocale('❌', 'ERRORE', err.message);
    }
    setSalvandoParametri(false);
  };
  
  // NUOVO Chat 20: Salva tempi settore per tutte le gare
  const salvaTempiSettore = async () => {
    if (!eventoSelezionato) return;
    
    setSalvandoTempi(true);
    let errori = 0;
    
    for (const [codice_gara, config] of Object.entries(tempiSettore)) {
      try {
        const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/tempi-settore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codice_gara,
            co1_attivo: config.co1_attivo, co2_attivo: config.co2_attivo, co3_attivo: config.co3_attivo,
            co4_attivo: config.co4_attivo, co5_attivo: config.co5_attivo, co6_attivo: config.co6_attivo, co7_attivo: config.co7_attivo,
            tempo_par_co1: config.tempo_par_co1 ? parseInt(config.tempo_par_co1) : null,
            tempo_co1_co2: config.tempo_co1_co2 ? parseInt(config.tempo_co1_co2) : null,
            tempo_co2_co3: config.tempo_co2_co3 ? parseInt(config.tempo_co2_co3) : null,
            tempo_co3_co4: config.tempo_co3_co4 ? parseInt(config.tempo_co3_co4) : null,
            tempo_co4_co5: config.tempo_co4_co5 ? parseInt(config.tempo_co4_co5) : null,
            tempo_co5_co6: config.tempo_co5_co6 ? parseInt(config.tempo_co5_co6) : null,
            tempo_co6_co7: config.tempo_co6_co7 ? parseInt(config.tempo_co6_co7) : null,
            tempo_ultimo_arr: config.tempo_ultimo_arr ? parseInt(config.tempo_ultimo_arr) : null
          })
        });
        
        if (!res.ok) errori++;
      } catch (err) {
        errori++;
        console.error('Errore salvataggio tempi:', err);
      }
    }
    
    if (errori === 0) {
      aggiungiLogLocale('✅', 'SALVATO', 'Tempi settore aggiornati');
    } else {
      aggiungiLogLocale('⚠️', 'PARZIALE', `Salvati con ${errori} errori`);
    }
    
    setSalvandoTempi(false);
  };
  
  // Helper per aggiornare tempi settore
  const updateTempoSettore = (codice_gara, field, value) => {
    setTempiSettore(prev => ({
      ...prev,
      [codice_gara]: {
        ...prev[codice_gara],
        [field]: value
      }
    }));
  };
  
  // NUOVO: Applica configurazione prima gara a tutte le altre
  const applicaATutte = () => {
    if (gareFratelle.length < 2) return;
    const primaGara = gareFratelle[0].codice_gara;
    const configPrima = tempiSettore[primaGara];
    if (!configPrima) return;
    
    const nuoviTempi = { ...tempiSettore };
    gareFratelle.slice(1).forEach(gara => {
      nuoviTempi[gara.codice_gara] = { ...configPrima };
    });
    setTempiSettore(nuoviTempi);
    aggiungiLogLocale('📋', 'COPIATO', `Configurazione ${primaGara} applicata a tutte`);
  };
  
  // Formatta tempo rimanente
  const formatTempoRimanente = (secondi) => {
    if (!secondi) return '--:--';
    const min = Math.floor(secondi / 60);
    const sec = secondi % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };
  
  // Calcola progresso
  const progresso = statoSimulazione?.percentuale || 0;
  const tempiRilasciati = statoSimulazione?.tempiRilasciati || 0;
  const tempiTotali = statoSimulazione?.tempiTotali || 0;
  const inEsecuzione = statoSimulazione?.inEsecuzione || false;
  const inPausa = statoSimulazione?.inPausa || false;
  
  // NUOVO Chat 22: Import FICR per TUTTE le gare fratelle
  const handleImportFicrTutte = async (modalita, label) => {
    if (!eventoSelezionato) return;
    
    const evento = eventi.find(e => e.id === eventoSelezionato);
    if (!evento?.ficr_codice_equipe || !evento?.ficr_manifestazione) {
      setImportResult(prev => ({
        ...prev,
        [modalita]: { success: false, message: '❌ Configura prima i parametri FICR (sotto) e salva' }
      }));
      return;
    }
    
    setImportandoFicr(prev => ({ ...prev, [modalita]: true }));
    setImportResult(prev => ({ ...prev, [modalita]: null }));
    
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/import-ficr-tutte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modalita })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Costruisci messaggio dettagliato per gara
        const dettagli = Object.entries(data.risultati || {})
          .map(([codice, r]) => `${codice}: ${r.created || 0}+${r.updated || 0}`)
          .join(' | ');
        
        setImportResult(prev => ({
          ...prev,
          [modalita]: { 
            success: true, 
            message: `✅ ${data.message}`,
            dettagli 
          }
        }));
        aggiungiLogLocale('✅', `IMPORT ${label}`, data.message);
        
        // Ricarica info evento
        const pilotiRes = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/piloti`);
        const piloti = await pilotiRes.json();
        setEventoInfo(prev => prev ? { ...prev, numPiloti: piloti.length } : prev);
      } else {
        setImportResult(prev => ({
          ...prev,
          [modalita]: { success: false, message: `❌ ${data.error}` }
        }));
      }
    } catch (err) {
      setImportResult(prev => ({
        ...prev,
        [modalita]: { success: false, message: `❌ ${err.message}` }
      }));
    }
    
    setImportandoFicr(prev => ({ ...prev, [modalita]: false }));
  };

  // NUOVO Chat 22: Cancella piloti da TUTTE le gare fratelle
  const handleCancellaTutti = async () => {
    if (!eventoSelezionato) return;
    
    const evento = eventi.find(e => e.id === eventoSelezionato);
    const conferma = window.confirm(
      `⚠️ ATTENZIONE!\n\nVuoi cancellare TUTTI i piloti da TUTTE le gare (${gareFratelle.map(g => g.codice_gara).join(', ')})?\n\nQuesta azione è irreversibile!`
    );
    
    if (!conferma) return;
    
    setCancellandoPiloti(true);
    setImportResult({});
    
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/piloti-tutte`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const dettagli = Object.entries(data.risultati || {})
          .map(([codice, count]) => `${codice}: ${count}`)
          .join(' | ');
        
        setImportResult({
          cancella: { 
            success: true, 
            message: `🗑️ ${data.message}`,
            dettagli
          }
        });
        aggiungiLogLocale('🗑️', 'CANCELLAZIONE', data.message);
        
        // Ricarica info evento
        const pilotiRes = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/piloti`);
        const piloti = await pilotiRes.json();
        setEventoInfo(prev => prev ? { ...prev, numPiloti: piloti.length } : prev);
      } else {
        setImportResult({
          cancella: { success: false, message: `❌ ${data.error}` }
        });
      }
    } catch (err) {
      setImportResult({
        cancella: { success: false, message: `❌ ${err.message}` }
      });
    }
    
    setCancellandoPiloti(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-heading-1">Controllo Gara</h1>
        <p className="text-content-secondary mt-1 text-sm">Configurazione evento, GPS, simulazione e fonte dati live</p>
      </div>

      {/* Event + source */}
      <Card>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label>Evento</Label>
            <Select value={eventoSelezionato} onChange={(e) => setEventoSelezionato(e.target.value)}>
              <option value="">— Seleziona evento —</option>
              {eventi.map(ev => {
                const d = ev.data_inizio || ev.data_evento;
                const fmt = d ? new Date(d).toLocaleDateString('it-IT') : 'N/D';
                return <option key={ev.id} value={ev.id}>{ev.nome_evento} · {fmt}</option>;
              })}
            </Select>
            {eventoInfo && (
              <div className="mt-2.5 flex items-center gap-3 text-xs text-content-tertiary">
                {eventoInfo.luogo && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {eventoInfo.luogo}</span>}
                <Badge size="sm" variant="neutral">{eventoInfo.numPiloti} piloti</Badge>
              </div>
            )}
          </div>

          <div>
            <Label>Fonte dati</Label>
            <div className="inline-flex bg-surface-2 rounded-md p-0.5 w-full">
              <button
                onClick={() => setFonteDati('simulatore')}
                className={`flex-1 h-9 px-3 rounded-sm text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  fonteDati === 'simulatore' ? 'bg-surface shadow-sm text-content-primary' : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                <Settings className="w-3.5 h-3.5" /> Simulatore
              </button>
              <button
                onClick={() => setFonteDati('ficr')}
                className={`flex-1 h-9 px-3 rounded-sm text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  fonteDati === 'ficr' ? 'bg-surface shadow-sm text-content-primary' : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                <Radio className="w-3.5 h-3.5" /> FICR Live
              </button>
            </div>
          </div>
        </div>
      </Card>
      
      {/* === SEZIONE 1: IMPORT DATI PRE-GARA === */}
      {eventoSelezionato && (
        <div className="bg-surface border border-border-subtle border-l-4 border-l-brand-500 rounded-lg p-5 shadow-sm">
          <h2 className="text-heading-2 flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-600 dark:text-brand-500" />
            Import dati pre-gara
          </h2>
          <p className="text-xs text-content-tertiary mt-1 mb-4">
            Importa piloti da FICR per tutte le gare: <span className="font-mono">{gareFratelle.map(g => g.codice_gara).join(', ') || 'nessuna'}</span>
          </p>
          
          {/* 3 Bottoni Import per timing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* T-5: Programma */}
            <div className="bg-white rounded-lg p-4 shadow border-l-4 border-yellow-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="font-bold text-gray-800">T-5 Programma</h3>
                  <p className="text-xs text-gray-500">5 giorni prima</p>
                </div>
              </div>
              <button
                onClick={() => handleImportFicrTutte('program', 'Programma')}
                disabled={importandoFicr['program']}
                className="w-full px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-semibold transition-colors"
              >
                {importandoFicr['program'] ? '⏳ Importando...' : '📋 Import Programma'}
              </button>
              {importResult['program'] && (
                <div className={`text-sm mt-2 ${importResult['program'].success ? 'text-green-600' : 'text-red-600'}`}>
                  <p>{importResult['program'].message}</p>
                  {importResult['program'].dettagli && (
                    <p className="text-xs text-gray-500 mt-1">{importResult['program'].dettagli}</p>
                  )}
                </div>
              )}
            </div>
            
            {/* T-2: Numeri */}
            <div className="bg-white rounded-lg p-4 shadow border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔢</span>
                <div>
                  <h3 className="font-bold text-gray-800">T-2 Numeri</h3>
                  <p className="text-xs text-gray-500">2 giorni prima</p>
                </div>
              </div>
              <button
                onClick={() => handleImportFicrTutte('entrylist', 'Numeri')}
                disabled={importandoFicr['entrylist']}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
              >
                {importandoFicr['entrylist'] ? '⏳ Importando...' : '🔢 Import Numeri'}
              </button>
              {importResult['entrylist'] && (
                <div className={`text-sm mt-2 ${importResult['entrylist'].success ? 'text-green-600' : 'text-red-600'}`}>
                  <p>{importResult['entrylist'].message}</p>
                  {importResult['entrylist'].dettagli && (
                    <p className="text-xs text-gray-500 mt-1">{importResult['entrylist'].dettagli}</p>
                  )}
                </div>
              )}
            </div>
            
            {/* T-1: Ordine Partenza */}
            <div className="bg-white rounded-lg p-4 shadow border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏁</span>
                <div>
                  <h3 className="font-bold text-gray-800">T-1 Ordine</h3>
                  <p className="text-xs text-gray-500">1 giorno prima</p>
                </div>
              </div>
              <button
                onClick={() => handleImportFicrTutte('startlist', 'Ordine Partenza')}
                disabled={importandoFicr['startlist']}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-colors"
              >
                {importandoFicr['startlist'] ? '⏳ Importando...' : '🏁 Import Ordine'}
              </button>
              {importResult['startlist'] && (
                <div className={`text-sm mt-2 ${importResult['startlist'].success ? 'text-green-600' : 'text-red-600'}`}>
                  <p>{importResult['startlist'].message}</p>
                  {importResult['startlist'].dettagli && (
                    <p className="text-xs text-gray-500 mt-1">{importResult['startlist'].dettagli}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Riga inferiore: Cancella + Indicatore FICR */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Tasto Cancella */}
            <button
              onClick={handleCancellaTutti}
              disabled={cancellandoPiloti}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {cancellandoPiloti ? '⏳ Cancellando...' : '🗑️ Cancella Tutti Piloti'}
            </button>
            
            {/* Risultato cancellazione */}
            {importResult['cancella'] && (
              <div className={`text-sm ${importResult['cancella'].success ? 'text-green-600' : 'text-red-600'}`}>
                <p>{importResult['cancella'].message}</p>
                {importResult['cancella'].dettagli && (
                  <p className="text-xs text-gray-500">{importResult['cancella'].dettagli}</p>
                )}
              </div>
            )}
            
            {/* Indicatore FICR */}
            <div className="p-3 bg-white rounded-lg">
              {ficrCodiceEquipe && ficrManifestazione ? (
                <p className="text-sm text-green-600">
                  ✅ FICR: {ficrAnno}/{ficrCodiceEquipe}/{ficrManifestazione}
                </p>
              ) : (
                <p className="text-sm text-orange-600">
                  ⚠️ Configura FICR in "Configurazione GPS"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === SEZIONE 2: TEMPI SETTORE (VERDE) === */}
      {eventoSelezionato && gareFratelle.length > 0 && (
        <div className="bg-surface border border-border-subtle border-l-4 border-l-success-fg rounded-lg p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-heading-2 flex items-center gap-2">
              <Clock className="w-6 h-6 text-green-600" />
              ⏱️ Tempi Settore (Orari Teorici CO)
            </h2>
            {gareFratelle.length > 1 && (
              <button
                onClick={applicaATutte}
                className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                📋 Applica {gareFratelle[0]?.codice_gara} a tutte
              </button>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Configura i tempi di trasferimento (hh:mm) per calcolare automaticamente gli orari teorici dei piloti ai Controlli Orario.
          </p>
          
          <div className="space-y-4">
            {gareFratelle.map(gara => {
              const config = tempiSettore[gara.codice_gara] || {};
              const coList = [
                { num: 1, attivo: 'co1_attivo', tempo: 'tempo_par_co1', label: 'da PAR' },
                { num: 2, attivo: 'co2_attivo', tempo: 'tempo_co1_co2', label: 'da CO1' },
                { num: 3, attivo: 'co3_attivo', tempo: 'tempo_co2_co3', label: 'da CO2' },
                { num: 4, attivo: 'co4_attivo', tempo: 'tempo_co3_co4', label: 'da CO3' },
                { num: 5, attivo: 'co5_attivo', tempo: 'tempo_co4_co5', label: 'da CO4' },
                { num: 6, attivo: 'co6_attivo', tempo: 'tempo_co5_co6', label: 'da CO5' },
                { num: 7, attivo: 'co7_attivo', tempo: 'tempo_co6_co7', label: 'da CO6' },
              ];
              
              // Helper per convertire minuti in hh:mm
              const minToHM = (min) => {
                if (!min) return { h: '', m: '' };
                const m = parseInt(min);
                return { h: Math.floor(m / 60).toString(), m: (m % 60).toString() };
              };
              
              // Helper per convertire hh:mm in minuti
              const hmToMin = (h, m) => {
                const ore = parseInt(h) || 0;
                const minuti = parseInt(m) || 0;
                return ore * 60 + minuti;
              };
              
              return (
                <div key={gara.codice_gara} className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">
                    🏁 {gara.codice_gara} - {gara.nome_evento.split(' - ')[1] || gara.nome_evento}
                  </h3>
                  
                  <div className="flex flex-wrap gap-3">
                    {coList.map(co => {
                      const isAttivo = config[co.attivo] ?? (co.num <= 2);
                      const tempoVal = minToHM(config[co.tempo]);
                      return (
                        <div key={co.num} className="flex flex-col bg-white rounded p-2 border">
                          <label className="flex items-center gap-1 mb-1">
                            <input
                              type="checkbox"
                              checked={isAttivo}
                              onChange={(e) => updateTempoSettore(gara.codice_gara, co.attivo, e.target.checked)}
                              className="w-3 h-3 text-blue-600 rounded"
                            />
                            <span className="text-xs font-medium">CO{co.num}</span>
                          </label>
                          {isAttivo && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min="0" max="23" placeholder="h"
                                value={tempoVal.h}
                                onChange={(e) => updateTempoSettore(gara.codice_gara, co.tempo, hmToMin(e.target.value, tempoVal.m))}
                                className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                              />
                              <span className="text-xs">:</span>
                              <input
                                type="number" min="0" max="59" placeholder="m"
                                value={tempoVal.m}
                                onChange={(e) => updateTempoSettore(gara.codice_gara, co.tempo, hmToMin(tempoVal.h, e.target.value))}
                                className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                              />
                              <span className="text-xs text-gray-400">{co.label}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Arrivo */}
                    <div className="flex flex-col bg-green-50 rounded p-2 border border-green-200">
                      <span className="text-xs font-medium mb-1">🏁 Arrivo</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="23" placeholder="h"
                          value={minToHM(config.tempo_ultimo_arr).h}
                          onChange={(e) => updateTempoSettore(gara.codice_gara, 'tempo_ultimo_arr', hmToMin(e.target.value, minToHM(config.tempo_ultimo_arr).m))}
                          className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                        />
                        <span className="text-xs">:</span>
                        <input
                          type="number" min="0" max="59" placeholder="m"
                          value={minToHM(config.tempo_ultimo_arr).m}
                          onChange={(e) => updateTempoSettore(gara.codice_gara, 'tempo_ultimo_arr', hmToMin(minToHM(config.tempo_ultimo_arr).h, e.target.value))}
                          className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                        />
                        <span className="text-xs text-gray-400">da ultimo CO</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pulsante Salva */}
          <div className="flex justify-end mt-4">
            <button
              onClick={salvaTempiSettore}
              disabled={salvandoTempi}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-5 h-5" />
              {salvandoTempi ? 'Salvataggio...' : 'Salva Tempi Settore'}
            </button>
          </div>
        </div>
      )}

      {/* === SEZIONE 3: CONFIGURAZIONE GPS (ARANCIONE) === */}
      {eventoSelezionato && (
        <div className="bg-surface border border-border-subtle border-l-4 border-l-warning-fg rounded-lg p-5 shadow-sm">
          <h2 className="text-heading-2 mb-4 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-orange-600" />
            📍 Configurazione GPS e Sicurezza
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Paddock 1 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-700">📍 Paddock 1 (Principale)</h3>
                <button
                  onClick={() => { setShowDmsConverter('paddock1'); setDmsTarget('lat'); }}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  Converti DMS →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Latitudine</label>
                  <input
                    type="text"
                    placeholder="es. 45.4321"
                    value={paddock1Lat}
                    onChange={(e) => setPaddock1Lat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Longitudine</label>
                  <input
                    type="text"
                    placeholder="es. 11.1234"
                    value={paddock1Lon}
                    onChange={(e) => setPaddock1Lon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Paddock 2 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-700">📍 Paddock 2 (Secondario)</h3>
                <button
                  onClick={() => { setShowDmsConverter('paddock2'); setDmsTarget('lat'); }}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  Converti DMS →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Latitudine</label>
                  <input
                    type="text"
                    placeholder="es. 45.4321"
                    value={paddock2Lat}
                    onChange={(e) => setPaddock2Lat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Longitudine</label>
                  <input
                    type="text"
                    placeholder="es. 11.1234"
                    value={paddock2Lon}
                    onChange={(e) => setPaddock2Lon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Convertitore DMS */}
          {showDmsConverter && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-purple-800">
                  🧭 Converti Gradi° Primi' Secondi" → Decimale
                </h4>
                <button
                  onClick={() => setShowDmsConverter(null)}
                  className="text-purple-600 hover:text-purple-800"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-purple-600 mb-1">Per</label>
                  <select
                    value={dmsTarget}
                    onChange={(e) => setDmsTarget(e.target.value)}
                    className="px-3 py-2 border border-purple-300 rounded-lg text-sm"
                  >
                    <option value="lat">Latitudine</option>
                    <option value="lon">Longitudine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-purple-600 mb-1">Gradi°</label>
                  <input
                    type="number"
                    value={dmsGradi}
                    onChange={(e) => setDmsGradi(e.target.value)}
                    placeholder="45"
                    className="w-20 px-3 py-2 border border-purple-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-purple-600 mb-1">Primi'</label>
                  <input
                    type="number"
                    value={dmsPrimi}
                    onChange={(e) => setDmsPrimi(e.target.value)}
                    placeholder="34"
                    className="w-20 px-3 py-2 border border-purple-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-purple-600 mb-1">Secondi"</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dmsSecondi}
                    onChange={(e) => setDmsSecondi(e.target.value)}
                    placeholder="57.5"
                    className="w-24 px-3 py-2 border border-purple-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={convertDmsToDecimal}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  Converti →
                </button>
              </div>
              <p className="text-xs text-purple-600 mt-2">
                Inserisci {showDmsConverter === 'paddock1' ? 'Paddock 1' : 'Paddock 2'} • 
                Es: 45° 34' 57.5" = 45.582639
              </p>
            </div>
          )}
          
          {/* Parametri */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raggio Paddock (metri)
              </label>
              <input
                type="number"
                min="100"
                max="1000"
                value={paddockRaggio}
                onChange={(e) => setPaddockRaggio(parseInt(e.target.value) || 500)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Area sicura (default 500m)</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequenza GPS (secondi)
              </label>
              <select
                value={gpsFrequenza}
                onChange={(e) => setGpsFrequenza(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value={30}>30 secondi</option>
                <option value={45}>45 secondi</option>
                <option value={60}>60 secondi</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Intervallo invio posizione</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allarme Fermo (minuti)
              </label>
              <select
                value={allarmeFermoMinuti}
                onChange={(e) => setAllarmeFermoMinuti(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value={10}>10 minuti</option>
                <option value={12}>12 minuti</option>
                <option value={15}>15 minuti</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Soglia allarme pilota fermo</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Codice Accesso Piloti
              </label>
              <input
                type="text"
                value={codiceAccesso}
                onChange={(e) => setCodiceAccesso(e.target.value.toUpperCase())}
                placeholder="es. VENE001"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 uppercase"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">Codice per login piloti su ERTA (preimpostato da FICR)</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Codice Accesso DdG
              </label>
              <input
                type="text"
                value={codiceDdG}
                onChange={(e) => setCodiceDdG(e.target.value.toUpperCase())}
                placeholder="es. D03478"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 uppercase"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">Codice per login Direzione Gara su ERTA (se vuoto: 0)</p>
            </div>
            
            {/* NUOVO Chat 22: Accesso Pubblico */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🌐 Accesso Pubblico (codici FMI)
              </label>
              <input
                type="text"
                value={codiceAccessoPubblico}
                onChange={(e) => setCodiceAccessoPubblico(e.target.value.toUpperCase())}
                placeholder="es. VENE015, VENE005"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 uppercase"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">Codici FMI per accesso pubblico ERTA (separati da virgola per gare multiple)</p>
            </div>
          </div>
          
          {/* NUOVO Chat 21: Configurazione API FICR */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-medium text-purple-800 mb-3 flex items-center gap-2">
              📡 Configurazione API FICR
            </h3>
            <p className="text-sm text-purple-600 mb-4">
              Parametri per importare dati dalla startlist FICR
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anno
                </label>
                <input
                  type="number"
                  value={ficrAnno}
                  onChange={(e) => setFicrAnno(parseInt(e.target.value) || new Date().getFullYear())}
                  placeholder="2025"
                  min={2020}
                  max={2030}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice Equipe
                </label>
                <input
                  type="text"
                  value={ficrCodiceEquipe}
                  onChange={(e) => setFicrCodiceEquipe(e.target.value)}
                  placeholder="es. 107 (Veneto)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">107=VEN, 99=TAA, etc.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manifestazione
                </label>
                <input
                  type="text"
                  value={ficrManifestazione}
                  onChange={(e) => setFicrManifestazione(e.target.value)}
                  placeholder="es. 303"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            {ficrCodiceEquipe && ficrManifestazione ? (
              <p className="text-sm text-green-600 mt-3">
                ✅ FICR configurato: {ficrAnno}/{ficrCodiceEquipe}/{ficrManifestazione}
              </p>
            ) : (
              <p className="text-sm text-orange-600 mt-3">
                ⚠️ Configura i parametri FICR per abilitare l'import
              </p>
            )}
          </div>
          
          {/* Pulsante Salva */}
          <div className="flex justify-end">
            <button
              onClick={salvaParametriGPS}
              disabled={salvandoParametri}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-5 h-5" />
              {salvandoParametri ? 'Salvataggio...' : 'Salva Parametri'}
            </button>
          </div>
        </div>
      )}

      {/* === SEZIONE 4: PARAMETRI SIMULAZIONE (VIOLA) === */}
      {fonteDati === 'simulatore' && (
        <div className="bg-surface border border-border-subtle border-l-4 border-l-brand-500 rounded-lg p-5 shadow-sm">
          <h2 className="text-heading-2 mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            🎮 Parametri Simulazione
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Batch Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tempi per ciclo (3-50)
              </label>
              <input
                type="number"
                min="3"
                max="50"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(3, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            {/* Intervallo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Intervallo secondi (1-90)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={intervalloSecondi}
                onChange={(e) => setIntervalloSecondi(Math.max(1, Math.min(90, parseInt(e.target.value) || 5)))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            {/* Sovrapposizione */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sovrapposizione PS
              </label>
              <select
                value={sovrapposizione}
                onChange={(e) => setSovrapposizione(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value={50}>50%</option>
                <option value={60}>60%</option>
                <option value={70}>70%</option>
                <option value={80}>80%</option>
                <option value={90}>90%</option>
              </select>
            </div>
          </div>
          
          {/* Pulsanti controllo */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => { handleInit(); }}
              disabled={!eventoSelezionato || inEsecuzione}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings className="w-5 h-5" />
              Inizializza
            </button>
            
            <button
              onClick={handleStart}
              disabled={!statoSimulazione?.inizializzato || (inEsecuzione && !inPausa)}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-5 h-5" />
              Avvia
            </button>
            
            <button
              onClick={handlePause}
              disabled={!inEsecuzione}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg transition-colors ${
                inPausa
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Pause className="w-5 h-5" />
              {inPausa ? 'Riprendi' : 'Pausa'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={!inEsecuzione}
              className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
            
            <button
              onClick={handleReset}
              disabled={inEsecuzione && !inPausa}
              className="flex items-center gap-2 px-5 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>
          
          {/* Barra progresso */}
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progresso: {progresso}%</span>
              <span>{tempiRilasciati}/{tempiTotali} tempi</span>
              <span className="flex items-center gap-1">
                ⏱️ {formatTempoRimanente(statoSimulazione?.tempoRimanente)}
              </span>
            </div>
            <div className="w-full h-4 bg-gray-300 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  inEsecuzione ? 'bg-green-500' : inPausa ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progresso}%` }}
              />
            </div>
            {statoSimulazione?.psCorrente && (
              <div className="mt-2 text-sm text-gray-600">
                PS corrente: <span className="font-bold">PS{statoSimulazione.psCorrente}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Flusso Dati - ALTEZZA AUMENTATA */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-600" />
            Flusso Dati ({logEventi.length} eventi)
          </h2>
          <button
            onClick={clearLog}
            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
        
        {/* Log container con altezza aumentata */}
        <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
          {logEventi.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Nessun evento. Seleziona un evento e avvia la simulazione.
            </div>
          ) : (
            logEventi.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 py-1 border-b border-gray-800 last:border-0">
                <span className="text-gray-500 w-20 flex-shrink-0">{log.timestamp}</span>
                <span className="w-6">{log.icona}</span>
                <span className={`font-bold w-24 flex-shrink-0 ${
                  log.tipo === 'ERRORE' ? 'text-red-400' :
                  log.tipo === 'AVVIATO' || log.tipo === 'START' ? 'text-green-400' :
                  log.tipo === 'BATCH' ? 'text-blue-400' :
                  log.tipo === 'STOP' || log.tipo === 'PAUSA' ? 'text-yellow-400' :
                  log.tipo === 'RESET' ? 'text-orange-400' :
                  log.tipo === 'COMPLETATO' ? 'text-purple-400' :
                  'text-gray-300'
                }`}>
                  {log.tipo}
                </span>
                <span className="text-gray-300 flex-1">{log.messaggio}</span>
                {log.dettaglio && (
                  <span className="text-gray-500">{log.dettaglio}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Link a Live Timing */}
      <div className="flex justify-center">
        <Link
          to="/live"
          className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
        >
          <ExternalLink className="w-5 h-5" />
          <span className="text-lg font-medium">Apri Live Timing</span>
        </Link>
      </div>
    </div>
  );
}
