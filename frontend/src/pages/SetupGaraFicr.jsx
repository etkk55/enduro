import { useState, useEffect } from 'react';
import { Search, Download, CheckCircle, AlertCircle, Loader2, Calendar, MapPin, Clock, Save, Settings, Trash2, Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';

import { API_BASE } from '../services/api';
import ProgressSteps from '../components/ui/ProgressSteps';

// ============================================================================
// XmlImportPanel
// Upload file XML FMI iscritti e importa i piloti in uno degli eventi gia'
// creati nel wizard. Parse client-side, POST a /api/eventi/:id/import-xml.
// ============================================================================
function XmlImportPanel({ eventiCreati }) {
  const [xmlFile, setXmlFile] = useState(null);
  const [xmlData, setXmlData] = useState(null);
  const [eventoTarget, setEventoTarget] = useState('');
  const [stato, setStato] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Preseleziona primo evento creato
  useEffect(() => {
    if (eventiCreati.length > 0 && !eventoTarget) {
      setEventoTarget(eventiCreati[0].id);
    }
  }, [eventiCreati, eventoTarget]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setXmlFile(file);
    setStato('idle');
    setMsg('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(ev.target.result, 'text/xml');
        const get = (tag) => doc.querySelector(tag)?.textContent?.trim() || '';
        const gara = {
          codice: get('codice_gara'),
          descrizione: get('descrizione'),
          luogo: get('luogo_evento'),
          data: get('data_evento'),
        };
        const piloti = [...doc.querySelectorAll('conduttore')].map(c => ({
          licenza: c.querySelector('licenza')?.textContent?.trim() || '',
          nome: c.querySelector('nome')?.textContent?.trim() || '',
          cognome: c.querySelector('cognome')?.textContent?.trim() || '',
          classe: c.querySelector('classe')?.textContent?.trim() || '',
          categoria: c.querySelector('categoria')?.textContent?.trim() || '',
          ngara: c.querySelector('ngara')?.textContent?.trim() || '',
          motoclub: c.querySelector('motoclub')?.textContent?.trim() || '',
          motociclo: c.querySelector('motociclo')?.textContent?.trim() || '',
          nazionalita: c.querySelector('nazionalita')?.textContent?.trim() || '',
          anno_nascita: c.querySelector('anno_nascita')?.textContent?.trim() || '',
          sesso: c.querySelector('sesso')?.textContent?.trim() || '',
        }));
        setXmlData({ gara, piloti });

        // Se il codice XML matcha uno degli eventi creati, preselezionalo
        if (gara.codice) {
          const match = eventiCreati.find(e => (e.codice_gara || '').includes(gara.codice) || gara.codice.includes(e.codice_gara || ''));
          if (match) setEventoTarget(match.id);
        }
      } catch (err) {
        setStato('error');
        setMsg('Errore parsing XML: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!eventoTarget) { setStato('error'); setMsg('Seleziona un evento di destinazione'); return; }
    if (!xmlData) { setStato('error'); setMsg('Carica prima un file XML'); return; }

    setStato('loading');
    setMsg('Importazione in corso...');
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoTarget}/import-xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piloti: xmlData.piloti })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore server');
      setStato('success');
      setMsg(`${data.importati} inseriti, ${data.aggiornati} aggiornati — Totale ${data.totale} piloti`);
    } catch (err) {
      setStato('error');
      setMsg(err.message);
    }
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-content-secondary" />
          <div className="text-left">
            <div className="text-sm font-semibold text-content-primary">Alternativa: Import da file XML FMI</div>
            <div className="text-xs text-content-tertiary">
              Usa questa opzione se hai un XML iscritti locale invece dei dati FICR API
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-content-tertiary" /> : <ChevronDown className="w-4 h-4 text-content-tertiary" />}
      </button>

      {expanded && (
        <div className="border-t border-border-subtle p-4 space-y-4">
          {/* Upload */}
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1.5">File XML iscritti</label>
            <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-brand-500 hover:bg-surface-2 transition-colors">
              <Upload className="w-5 h-5 text-content-tertiary mb-1" />
              <p className="text-xs font-medium text-content-secondary">
                {xmlFile ? xmlFile.name : 'Seleziona file .xml'}
              </p>
              <input type="file" accept=".xml" onChange={handleFile} className="hidden" />
            </label>
          </div>

          {/* Anteprima */}
          {xmlData && (
            <div className="bg-success-bg border border-success-border rounded-md p-3 text-xs text-success-fg">
              <div className="font-semibold">{xmlData.gara.codice} — {xmlData.gara.descrizione}</div>
              <div className="mt-0.5 opacity-80">
                {xmlData.gara.luogo} · {xmlData.gara.data}
              </div>
              <div className="mt-1 font-medium">
                {xmlData.piloti.length} piloti trovati
              </div>
            </div>
          )}

          {/* Target event (se piu' di uno) */}
          {eventiCreati.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1.5">Evento di destinazione</label>
              <select
                value={eventoTarget}
                onChange={(e) => setEventoTarget(e.target.value)}
                className="w-full h-9 px-3 pr-8 rounded-md border border-border bg-surface text-sm font-medium text-content-primary cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                {eventiCreati.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.codice_gara} — {ev.nome_evento}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={!xmlData || !eventoTarget || stato === 'loading'}
            className="w-full h-9 rounded-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {stato === 'loading' ? 'Importazione…' : 'Importa Piloti da XML'}
          </button>

          {msg && (
            <div className={`text-xs rounded-md px-3 py-2 ${
              stato === 'success' ? 'bg-success-bg text-success-fg border border-success-border'
              : stato === 'error' ? 'bg-danger-bg text-danger-fg border border-danger-border'
              : 'bg-surface-2 text-content-secondary'
            }`}>
              {msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SetupGaraFicr() {
  // === STEP 1-3: Selezione FICR e creazione eventi ===
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [gare, setGare] = useState([]);
  const [garaSelezionata, setGaraSelezionata] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [categorieSelezionate, setCategorieSelezionate] = useState([]);
  const [codiceFmi, setCodiceFmi] = useState('');
  const [codiciFmi, setCodiciFmi] = useState({}); // {1: 'FRIEN009', 2: 'FRIEP003', ...}
  const [nomeEvento, setNomeEvento] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [loadingCategorie, setLoadingCategorie] = useState(false);
  const [creando, setCreando] = useState(false);
  const [risultato, setRisultato] = useState(null);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState('');
  
  // === STEP 4: Struttura Gara (NUOVO) ===
  const [numGiri, setNumGiri] = useState(3);
  const [prove, setProve] = useState([
    { nome: 'Cross Test', finale: false },
    { nome: 'Enduro Test', finale: false }
  ]);
  const [psGenerate, setPsGenerate] = useState([]);
  const [showPreviewStruttura, setShowPreviewStruttura] = useState(false);
  const [salvandoStruttura, setSalvandoStruttura] = useState(false);
  
  // === STEP 5: Tempi Settore (era Step 4) ===
  const [eventiCreati, setEventiCreati] = useState([]); // Eventi creati dallo step 3
  const [tempiSettore, setTempiSettore] = useState({});
  const [salvandoTempi, setSalvandoTempi] = useState(false);
  
  // === STEP 6: GPS & Sicurezza (era Step 5) ===
  const [paddock1Lat, setPaddock1Lat] = useState('');
  const [paddock1Lon, setPaddock1Lon] = useState('');
  const [paddock2Lat, setPaddock2Lat] = useState('');
  const [paddock2Lon, setPaddock2Lon] = useState('');
  const [paddockRaggio, setPaddockRaggio] = useState(500);
  const [gpsFrequenza, setGpsFrequenza] = useState(30);
  const [allarmeFermoMinuti, setAllarmeFermoMinuti] = useState(10);
  const [codiceDdG, setCodiceDdG] = useState('');
  const [codiceAccesso, setCodiceAccesso] = useState('');
  const [codiceAccessoPubblico, setCodiceAccessoPubblico] = useState('');
  const [salvandoGPS, setSalvandoGPS] = useState(false);
  
  // === STEP 7: Import Pre-Gara (era Step 6) ===
  const [importandoFicr, setImportandoFicr] = useState({});
  const [importResult, setImportResult] = useState({});
  const [cancellandoPiloti, setCancellandoPiloti] = useState(false);
  
  // === Step corrente ===
  const [stepCorrente, setStepCorrente] = useState(1);
  const [garaEsistente, setGaraEsistente] = useState(false);
  const [verificandoGara, setVerificandoGara] = useState(false);

  // ========== STEP 1-3: Funzioni esistenti ==========
  
  const caricaGare = async () => {
    setLoading(true);
    setErrore('');
    setGare([]);
    setGaraSelezionata(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/ficr/gare/${anno}`);
      const data = await res.json();
      
      // API FICR restituisce {code, status, data:[...]}
      if (data.status && data.data) {
        // Mappa i campi FICR ai nostri campi
        const gareMappate = data.data.map(g => ({
          equipe: g.ma_CodiceEquipe || g.TeamCode,
          manifestazione: g.ma_Manifestazione,
          nome: g.ma_Descrizione || g.Description,  // Tipo campionato come titolo
          luogo: g.ma_Localita || g.Place,
          data: g.Data,
          organizzatore: g.ma_Organizzatore
        }));
        setGare(gareMappate);
      } else if (data.success && data.gare) {
        // Fallback per formato vecchio
        setGare(data.gare);
      } else {
        setErrore(data.error || data.message || 'Errore caricamento gare');
      }
    } catch (err) {
      setErrore('Errore connessione: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const caricaCategorie = async (gara) => {
    setLoadingCategorie(true);
    setCategorie([]);
    setCategorieSelezionate([]);
    
    try {
      const res = await fetch(
        `${API_BASE}/api/ficr/categorie/${anno}/${gara.equipe}/${gara.manifestazione}`
      );
      const data = await res.json();
      
      if (data.success && data.categorie) {
        setCategorie(data.categorie);
        setCategorieSelezionate(data.categorie.map(c => c.id));
      }
    } catch (err) {
      console.error('Errore categorie:', err);
    } finally {
      setLoadingCategorie(false);
    }
  };

  const selezionaGara = async (gara) => {
    setGaraSelezionata(gara);
    setNomeEvento(gara.nome || `${gara.luogo} - Gara`);
    setGaraEsistente(false);
    setEventiCreati([]);
    
    // Verifica se la gara esiste già nel DB
    setVerificandoGara(true);
    try {
      const res = await fetch(`${API_BASE}/api/eventi?ficr_codice_equipe=${gara.equipe}&ficr_manifestazione=${gara.manifestazione}&ficr_anno=${anno}`);
      const data = await res.json();
      
      if (res.ok && data.length > 0) {
        // Gara già configurata - carica dati esistenti
        setGaraEsistente(true);
        setEventiCreati(data);
        
        // Carica i dati del primo evento per popolare i campi
        const primo = data[0];
        if (primo.paddock1_lat) setPaddock1Lat(primo.paddock1_lat.toString());
        if (primo.paddock1_lon) setPaddock1Lon(primo.paddock1_lon.toString());
        if (primo.paddock2_lat) setPaddock2Lat(primo.paddock2_lat.toString());
        if (primo.paddock2_lon) setPaddock2Lon(primo.paddock2_lon.toString());
        if (primo.paddock_raggio) setPaddockRaggio(primo.paddock_raggio);
        if (primo.gps_frequenza) setGpsFrequenza(primo.gps_frequenza);
        if (primo.allarme_fermo_minuti) setAllarmeFermoMinuti(primo.allarme_fermo_minuti);
        if (primo.codice_ddg) setCodiceDdG(primo.codice_ddg);
        if (primo.codice_accesso) { setCodiceAccesso(primo.codice_accesso); setCodiceFmi(primo.codice_accesso); }
        // Carica codice accesso pubblico, default = codice_accesso (codice FMI)
        setCodiceAccessoPubblico(primo.codice_accesso_pubblico || primo.codice_accesso || '');
        
        // Seleziona le categorie già create
        const catIds = data.map(e => {
          const parts = e.codice_gara?.split('-');
          return parts ? parseInt(parts[1]) : null;
        }).filter(Boolean);
        setCategorieSelezionate(catIds);
        
        // Carica codici FMI dagli eventi esistenti
        const codici = {};
        for (const ev of data) {
          const catId = parseInt(ev.codice_gara?.split('-')[1]);
          if (catId && ev.codice_accesso) {
            codici[catId] = ev.codice_accesso;
          }
        }
        setCodiciFmi(codici);
        
        // Carica tempi settore dalla tabella separata
        const tempi = {};
        for (const ev of data) {
          try {
            const tempiRes = await fetch(`${API_BASE}/api/eventi/${ev.id}/tempi-settore`);
            if (tempiRes.ok) {
              const tempiData = await tempiRes.json();
              if (tempiData && tempiData.length > 0) {
                const t = tempiData[0];
                // Usa gli stessi nomi usati nello Step 5
                tempi[ev.codice_gara] = {
                  tempo_par_co1: t.tempo_par_co1 || 0,
                  tempo_co1_co2: t.tempo_co1_co2 || '',
                  tempo_co2_co3: t.tempo_co2_co3 || '',
                  tempo_co3_co4: t.tempo_co3_co4 || '',
                  tempo_co4_co5: t.tempo_co4_co5 || '',
                  tempo_co5_co6: t.tempo_co5_co6 || '',
                  tempo_co6_co7: t.tempo_co6_co7 || '',
                  tempo_co7_co8: t.tempo_co7_co8 || '',
                  tempo_co8_co9: t.tempo_co8_co9 || '',
                  tempo_co9_co10: t.tempo_co9_co10 || '',
                  tempo_ultimo_arr: t.tempo_ultimo_arr || '',
                  co1_attivo: t.co1_attivo,
                  co2_attivo: t.co2_attivo,
                  co3_attivo: t.co3_attivo,
                  co4_attivo: t.co4_attivo,
                  co5_attivo: t.co5_attivo,
                  co6_attivo: t.co6_attivo,
                  co7_attivo: t.co7_attivo,
                  co8_attivo: t.co8_attivo,
                  co9_attivo: t.co9_attivo,
                  co10_attivo: t.co10_attivo
                };
              }
            }
          } catch (e) {
            console.log('Errore caricamento tempi settore:', e);
          }
        }
        setTempiSettore(tempi);
      }
    } catch (err) {
      console.log('Errore verifica gara esistente:', err);
    }
    setVerificandoGara(false);
    
    caricaCategorie(gara);
    setStepCorrente(3);
  };

  const toggleCategoria = (cat) => {
    setCategorieSelezionate(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat].sort()
    );
  };

  const creaEventi = async () => {
    if (!garaSelezionata || categorieSelezionate.length === 0) {
      setErrore('Seleziona almeno una categoria');
      return;
    }
    
    setCreando(true);
    setErrore('');
    setRisultato(null);
    
    try {
      // 1. Carica tutti gli eventi esistenti
      const eventiRes = await fetch(`${API_BASE}/api/eventi`);
      const tuttiEventi = await eventiRes.json();
      
      // 2. Verifica quali codici_gara esistono già
      const codiciDaCreare = categorieSelezionate.map(cat => 
        `${garaSelezionata.manifestazione}-${cat}`
      );
      
      const eventiEsistenti = tuttiEventi.filter(ev => 
        codiciDaCreare.includes(ev.codice_gara)
      );
      
      const codiciEsistenti = eventiEsistenti.map(ev => ev.codice_gara);
      const codiciNuovi = codiciDaCreare.filter(c => !codiciEsistenti.includes(c));
      
      let eventiFinali = [...eventiEsistenti];
      
      // 3. Crea solo quelli nuovi (se ce ne sono)
      if (codiciNuovi.length > 0) {
        const categorieNuove = categorieSelezionate.filter(cat => 
          codiciNuovi.includes(`${garaSelezionata.manifestazione}-${cat}`)
        );
        
        if (categorieNuove.length > 0) {
          // Costruisco mappa nomi categorie da FICR
          const nomiCategorie = {};
          categorieNuove.forEach(catId => {
            const catInfo = categorie.find(c => c.id === catId);
            nomiCategorie[catId] = catInfo?.nome || nomeEvento;
          });
          
          const res = await fetch(`${API_BASE}/api/eventi/setup-da-ficr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anno,
              equipe: garaSelezionata.equipe,
              manifestazione: garaSelezionata.manifestazione,
              nome_evento: nomeEvento,
              nomi_categorie: nomiCategorie,  // Nomi specifici da FICR
              luogo: garaSelezionata.luogo,
              data_gara: garaSelezionata.data,
              codice_accesso_fmi: codiceFmi,  // p32: unico codice per tutte le categorie
              categorie_selezionate: categorieNuove,
              codici_fmi: Object.fromEntries(categorieNuove.map(c => [c, codiceFmi]))  // p32: stesso codice per tutti
            })
          });
          
          const data = await res.json();
          
          if (data.success && data.risultati?.eventi_creati) {
            eventiFinali = [...eventiFinali, ...data.risultati.eventi_creati];
          }
        }
      }
      
      // 4. Messaggio risultato
      if (eventiEsistenti.length > 0 && codiciNuovi.length === 0) {
        setRisultato({
          messaggio: `✅ Caricati ${eventiEsistenti.length} eventi esistenti`,
          eventi_creati: eventiEsistenti
        });
      } else if (eventiEsistenti.length > 0) {
        setRisultato({
          messaggio: `✅ ${eventiEsistenti.length} esistenti + ${codiciNuovi.length} nuovi`,
          eventi_creati: eventiFinali
        });
      } else {
        setRisultato({
          messaggio: `✅ Creati ${eventiFinali.length} nuovi eventi`,
          eventi_creati: eventiFinali
        });
      }
      
      setEventiCreati(eventiFinali);
      
      // Imposta default codice accesso pubblico = primo codice FMI
      if (!codiceAccessoPubblico && categorieSelezionate.length > 0) {
        const primoCodiceFmi = codiciFmi[categorieSelezionate[0]];
        if (primoCodiceFmi) {
          setCodiceAccessoPubblico(primoCodiceFmi);
        }
      }
      
      // 5. Carica tempi settore esistenti o inizializza
      const tempiInit = {};
      for (const ev of eventiFinali) {
        try {
          const tsRes = await fetch(`${API_BASE}/api/eventi/${ev.id}/tempi-settore`);
          const tsData = await tsRes.json();
          const existing = Array.isArray(tsData) ? tsData.find(t => t.codice_gara === ev.codice_gara) : null;
          
          if (existing) {
            tempiInit[ev.codice_gara] = {
              co1_attivo: existing.co1_attivo ?? true,
              co2_attivo: existing.co2_attivo ?? true,
              co3_attivo: existing.co3_attivo ?? false,
              co4_attivo: existing.co4_attivo ?? false,
              co5_attivo: existing.co5_attivo ?? false,
              co6_attivo: existing.co6_attivo ?? false,
              co7_attivo: existing.co7_attivo ?? false,
              co8_attivo: existing.co8_attivo ?? false,
              co9_attivo: existing.co9_attivo ?? false,
              co10_attivo: existing.co10_attivo ?? false,
              tempo_par_co1: existing.tempo_par_co1 || 0,
              tempo_co1_co2: existing.tempo_co1_co2 || '',
              tempo_co2_co3: existing.tempo_co2_co3 || '',
              tempo_co3_co4: existing.tempo_co3_co4 || '',
              tempo_co4_co5: existing.tempo_co4_co5 || '',
              tempo_co5_co6: existing.tempo_co5_co6 || '',
              tempo_co6_co7: existing.tempo_co6_co7 || '',
              tempo_co7_co8: existing.tempo_co7_co8 || '',
              tempo_co8_co9: existing.tempo_co8_co9 || '',
              tempo_co9_co10: existing.tempo_co9_co10 || '',
              tempo_ultimo_arr: existing.tempo_ultimo_arr || ''
            };
          } else {
            tempiInit[ev.codice_gara] = {
              co1_attivo: true, co2_attivo: true, co3_attivo: false,
              co4_attivo: false, co5_attivo: false, co6_attivo: false,
              co7_attivo: false, co8_attivo: false, co9_attivo: false, co10_attivo: false,
              tempo_par_co1: 0, tempo_co1_co2: '', tempo_co2_co3: '',
              tempo_co3_co4: '', tempo_co4_co5: '', tempo_co5_co6: '',
              tempo_co6_co7: '', tempo_co7_co8: '', tempo_co8_co9: '',
              tempo_co9_co10: '', tempo_ultimo_arr: ''
            };
          }
        } catch {
          tempiInit[ev.codice_gara] = {
            co1_attivo: true, co2_attivo: true, co3_attivo: false,
            co4_attivo: false, co5_attivo: false, co6_attivo: false,
            co7_attivo: false, co8_attivo: false, co9_attivo: false, co10_attivo: false,
            tempo_par_co1: 0, tempo_co1_co2: '', tempo_co2_co3: '',
            tempo_co3_co4: '', tempo_co4_co5: '', tempo_co5_co6: '',
            tempo_co6_co7: '', tempo_co7_co8: '', tempo_co8_co9: '',
            tempo_co9_co10: '', tempo_ultimo_arr: ''
          };
        }
      }
      setTempiSettore(tempiInit);
      
      // 6. Carica parametri GPS dal primo evento esistente
      if (eventiFinali.length > 0) {
        const primo = eventiFinali[0];
        setPaddock1Lat(primo.paddock1_lat || '');
        setPaddock1Lon(primo.paddock1_lon || '');
        setPaddock2Lat(primo.paddock2_lat || '');
        setPaddock2Lon(primo.paddock2_lon || '');
        setPaddockRaggio(primo.paddock_raggio || 500);
        setGpsFrequenza(primo.gps_frequenza || 30);
        setAllarmeFermoMinuti(primo.allarme_fermo_minuti || 10);
        setCodiceDdG(primo.codice_ddg || '');
        setCodiceAccesso(primo.codice_accesso || '');
        setCodiceAccessoPubblico(primo.codice_accesso_pubblico || '');
      }
      
      // Flusso: Configura -> Paddock & ERTA (step 6) -> Tempi CO (5) -> Import (7)
      setStepCorrente(6);

    } catch (err) {
      setErrore('Errore: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  const gareFiltrate = gare.filter(g => {
    const cerca = filtro.toLowerCase();
    return (
      (g.nome || '').toLowerCase().includes(cerca) ||
      (g.luogo || '').toLowerCase().includes(cerca) ||
      (g.descrizione || '').toLowerCase().includes(cerca)
    );
  });

  // ========== STEP 4: Struttura Gara (NUOVO) ==========
  
  // Genera lista PS quando cambiano giri o prove
  useEffect(() => {
    generaPS();
  }, [numGiri, prove]);

  const generaPS = () => {
    const ps = [];
    let numero = 1;
    
    // PS dei giri normali
    for (let giro = 1; giro <= numGiri; giro++) {
      for (const prova of prove) {
        if (prova.nome.trim()) {
          ps.push({
            numero,
            nome: prova.nome.trim(),
            giro,
            gruppo: prova.nome.trim(),
            isFinale: false
          });
          numero++;
        }
      }
    }
    
    // PS finali
    const finali = prove.filter(p => p.finale && p.nome.trim());
    for (const prova of finali) {
      ps.push({
        numero,
        nome: prova.nome.trim(),
        giro: 'finale',
        gruppo: prova.nome.trim(),
        isFinale: true
      });
      numero++;
    }
    
    setPsGenerate(ps);
  };

  const updateProva = (index, field, value) => {
    const newProve = [...prove];
    newProve[index] = { ...newProve[index], [field]: value };
    setProve(newProve);
  };

  const addProva = () => {
    setProve([...prove, { nome: '', finale: false }]);
  };

  const removeProva = (index) => {
    if (prove.length > 1) {
      setProve(prove.filter((_, i) => i !== index));
    }
  };

  const moveProva = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < prove.length) {
      const newProve = [...prove];
      [newProve[index], newProve[newIndex]] = [newProve[newIndex], newProve[index]];
      setProve(newProve);
    }
  };

  const salvaStrutturaGara = async () => {
    if (eventiCreati.length === 0) return;
    setSalvandoStruttura(true);
    
    try {
      // p32: Salva struttura PS per TUTTI gli eventi
      let successi = 0;
      let errori = [];
      
      for (const evento of eventiCreati) {
        try {
          const res = await fetch(`${API_BASE}/api/eventi/${evento.id}/struttura-ps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              numGiri, 
              prove,
              psGenerate 
            })
          });
          
          if (res.ok) {
            successi++;
            console.log(`✅ Struttura salvata per ${evento.codice_gara}`);
          } else {
            errori.push(evento.codice_gara);
            console.log(`⚠️ Errore struttura per ${evento.codice_gara}`);
          }
        } catch (e) {
          errori.push(evento.codice_gara);
          console.log(`⚠️ Errore struttura per ${evento.codice_gara}:`, e.message);
        }
      }
      
      console.log(`Struttura salvata: ${successi}/${eventiCreati.length} eventi`);

      // Nel nuovo flusso torna a step 7 (Import), non prosegue a CO
      setStepCorrente(7);
    } catch (err) {
      console.log('Errore salvataggio struttura:', err);
      setStepCorrente(7);
    } finally {
      setSalvandoStruttura(false);
    }
  };

  // ========== STEP 5: Tempi Settore (era Step 4) ==========
  
  const updateTempoSettore = (codiceGara, campo, valore) => {
    setTempiSettore(prev => ({
      ...prev,
      [codiceGara]: {
        ...prev[codiceGara],
        [campo]: valore
      }
    }));
  };

  const applicaATutte = () => {
    if (eventiCreati.length < 2) return;
    const primo = tempiSettore[eventiCreati[0].codice_gara];
    if (!primo) return;
    
    const nuoviTempi = {};
    eventiCreati.forEach(ev => {
      nuoviTempi[ev.codice_gara] = { ...primo };
    });
    setTempiSettore(nuoviTempi);
  };

  const salvaTempiSettore = async () => {
    setSalvandoTempi(true);
    setErrore('');
    
    try {
      for (const evento of eventiCreati) {
        const config = tempiSettore[evento.codice_gara];
        if (!config) continue;
        
        // Verifica che l'evento abbia un ID valido
        if (!evento.id) {
          console.error('Evento senza ID:', evento);
          throw new Error(`Evento ${evento.codice_gara} non ha ID valido`);
        }
        
        const url = `${API_BASE}/api/eventi/${evento.id}/tempi-settore`;
        console.log('Salvando tempi per:', evento.codice_gara, 'URL:', url);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codice_gara: evento.codice_gara,
            ...config
          })
        });
        
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
      }
      // Nel nuovo flusso torna a step 7 (Import) dopo salva
      setStepCorrente(7);
    } catch (err) {
      console.error('Errore salvataggio tempi:', err);
      setErrore('Errore salvataggio tempi: ' + err.message);
    } finally {
      setSalvandoTempi(false);
    }
  };

  // Helper per conversione minuti <-> hh:mm
  const minToHM = (min) => {
    if (!min) return { h: '', m: '' };
    const m = parseInt(min);
    return { h: Math.floor(m / 60).toString(), m: (m % 60).toString() };
  };

  const hmToMin = (h, m) => {
    const ore = parseInt(h) || 0;
    const minuti = parseInt(m) || 0;
    return ore * 60 + minuti;
  };

  // ========== STEP 6: GPS & Sicurezza (era Step 5) ==========
  
  const salvaParametriGPS = async () => {
    setSalvandoGPS(true);
    
    try {
      for (const evento of eventiCreati) {
        await fetch(`${API_BASE}/api/eventi/${evento.id}`, {
          method: 'PATCH',
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
            codice_accesso: codiceAccesso || null,
            codice_accesso_pubblico: codiceAccessoPubblico || null
          })
        });
      }
      // Flusso nuovo: Paddock & ERTA (6) -> Tempi CO (5) -> Import (7)
      setStepCorrente(5);
    } catch (err) {
      setErrore('Errore salvataggio GPS: ' + err.message);
    } finally {
      setSalvandoGPS(false);
    }
  };

  // ========== STEP 7: Import Pre-Gara (era Step 6) ==========
  
  const handleImportFicr = async (modalita, label) => {
    if (eventiCreati.length === 0) return;
    
    setImportandoFicr(prev => ({ ...prev, [modalita]: true }));
    setImportResult(prev => ({ ...prev, [modalita]: null }));
    
    try {
      // Usa il primo evento come riferimento
      const eventoId = eventiCreati[0].id;
      
      const res = await fetch(`${API_BASE}/api/eventi/${eventoId}/import-ficr-tutte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modalita })
      });
      
      const data = await res.json();
      
      if (res.ok) {
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

  // Import TEMPI per tutte le gare fratelle in UNA sola chiamata.
  // Usa poll-ficr-live che:
  //   1. Itera internamente sulle gare fratelle (same ficr_anno/equipe/manif)
  //   2. Auto-crea le prove_speciali da FICR listps se non esistono
  //   3. Scarica i tempi (clasps) e li salva nel DB
  const handleImportTempi = async () => {
    if (eventiCreati.length === 0) return;

    setImportandoFicr(prev => ({ ...prev, tempi: true }));
    setImportResult(prev => ({ ...prev, tempi: null }));

    try {
      // Basta chiamare poll-ficr-live per il primo evento: il backend itera su tutte le fratelle
      const eventoId = eventiCreati[0].id;
      const res = await fetch(`${API_BASE}/api/eventi/${eventoId}/poll-ficr-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const tempiTotali = data.totaleTempi || 0;
        const dettagli = Object.entries(data.risultati || {})
          .map(([codice, r]) => `${codice}: ${r.tempi || 0}${r.status === 'no_prove' ? ' (no PS)' : ''}`)
          .join(' | ');
        setImportResult(prev => ({
          ...prev,
          tempi: {
            success: tempiTotali > 0,
            message: tempiTotali > 0
              ? `Importati ${tempiTotali} tempi totali su ${Object.keys(data.risultati || {}).length} gare`
              : `Nessun tempo importato. Verifica che la FICR abbia i tempi disponibili.`,
            dettagli
          }
        }));
      } else {
        setImportResult(prev => ({
          ...prev,
          tempi: { success: false, message: `Errore: ${data.error || 'richiesta fallita'}` }
        }));
      }
    } catch (err) {
      setImportResult(prev => ({
        ...prev,
        tempi: { success: false, message: `Errore: ${err.message}` }
      }));
    }

    setImportandoFicr(prev => ({ ...prev, tempi: false }));
  };

  // Importa TUTTO in sequenza: entrylist -> startlist -> tempi
  // Nota: il vecchio 'program' era un doppione di 'entrylist' (stessa URL).
  const handleImportTutto = async () => {
    if (eventiCreati.length === 0) return;

    setImportandoFicr({ entrylist: false, startlist: false, tempi: false, tutto: true });
    setImportResult({});

    // Sequenza deliberata: serve che piloti esistano prima di scaricare tempi.
    await handleImportFicr('entrylist', 'Numeri');
    await handleImportFicr('startlist', 'Ordine');
    await handleImportTempi();

    setImportandoFicr(prev => ({ ...prev, tutto: false }));
  };

  const handleCancellaTutti = async () => {
    if (eventiCreati.length === 0) return;
    
    const conferma = window.confirm(
      `⚠️ ATTENZIONE!\n\nVuoi cancellare TUTTI i piloti da TUTTE le gare?\n\nQuesta azione è irreversibile!`
    );
    
    if (!conferma) return;
    
    setCancellandoPiloti(true);
    setImportResult({});
    
    try {
      const eventoId = eventiCreati[0].id;
      const res = await fetch(`${API_BASE}/api/eventi/${eventoId}/piloti-tutte`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setImportResult({
          cancella: { 
            success: true, 
            message: `🗑️ ${data.message}`
          }
        });
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

  // ========== RENDER ==========
  
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-heading-1">Setup Gara</h1>
        <p className="text-content-secondary mt-1 text-sm">Wizard configurazione completa evento da FICR</p>
      </div>

      {/* Progress Steps */}
      {/*
        ProgressSteps a 5 step logici, tutti mandatory per integrazione ERTA:
          Gara -> Configura -> Paddock & ERTA -> Tempi CO -> Import
        Mapping stepCorrente interno -> visuale:
          1, 2 -> 0 (Gara)
          3    -> 1 (Configura)
          6    -> 2 (Paddock & ERTA - config GPS/paddock + codici accesso ERTA)
          5    -> 3 (Tempi CO)
          4, 7 -> 4 (Import, con Struttura Gara opzionale)
      */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 mb-4">
        <ProgressSteps
          steps={['Gara', 'Configura', 'Paddock & ERTA', 'Tempi CO', 'Import']}
          currentStep={
            stepCorrente <= 2 ? 0 :
            stepCorrente === 3 ? 1 :
            stepCorrente === 6 ? 2 :
            stepCorrente === 5 ? 3 :
            4 // step 4 (Struttura opzionale) o 7 (Import) -> visuale Import
          }
          canNavigateTo={(visualIdx) => {
            if (visualIdx === 0) return true;
            if (visualIdx === 1) return garaEsistente || stepCorrente >= 3;
            // Step 2-4 richiedono che almeno un evento sia stato creato
            const eventiReady = eventiCreati.length > 0 || garaEsistente;
            return eventiReady;
          }}
          onStepClick={(visualIdx) => {
            if (visualIdx === 0) setStepCorrente(stepCorrente > 2 ? 2 : stepCorrente);
            else if (visualIdx === 1) setStepCorrente(3);
            else if (visualIdx === 2) setStepCorrente(6);
            else if (visualIdx === 3) setStepCorrente(5);
            else setStepCorrente(7);
          }}
        />
      </div>
      
      {/* Banner gara esistente */}
      {garaEsistente && (
        <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <div>
              <p className="font-bold text-green-800">Gara già configurata!</p>
              <p className="text-green-700 text-sm">
                {eventiCreati.length} categorie trovate. Clicca sullo step che vuoi modificare.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading verifica gara */}
      {verificandoGara && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="text-blue-800">Verifico se la gara esiste già nel database...</p>
          </div>
        </div>
      )}

      {/* STEP 1: Anno */}
      {stepCorrente === 1 && (
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="text-indigo-600" />
            1️⃣ Seleziona Anno
          </h2>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">Anno gara</label>
              <select 
                value={anno} 
                onChange={e => setAnno(parseInt(e.target.value))}
                className="border-2 border-border rounded-lg px-4 py-3 text-lg font-semibold focus:border-indigo-500 bg-surface text-content-primary"
              >
                {[2024, 2025, 2026, 2027].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { caricaGare(); setStepCorrente(2); }}
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Caricamento...' : 'Cerca Gare FICR →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Selezione Gara */}
      {stepCorrente === 2 && (
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="text-indigo-600" />
              2️⃣ Seleziona Gara FICR ({gare.length} trovate)
            </h2>
            <button
              onClick={() => setStepCorrente(1)}
              className="text-content-tertiary hover:text-content-secondary"
            >
              ← Cambia anno
            </button>
          </div>
          
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-tertiary" size={20} />
              <input
                type="text"
                placeholder="Filtra per nome o località..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-lg bg-surface text-content-primary placeholder:text-content-tertiary focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto mb-2" size={32} />
              <p>Caricamento gare FICR...</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {gareFiltrate.map((gara, idx) => (
                <div
                  key={idx}
                  onClick={() => selezionaGara(gara)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-indigo-500 hover:bg-indigo-50 ${
                    garaSelezionata?.manifestazione === gara.manifestazione 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-border-subtle'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-lg text-content-primary">{gara.nome || gara.descrizione}</p>
                      <p className="text-content-secondary">{gara.luogo}</p>
                      {gara.organizzatore && (
                        <p className="text-sm text-content-tertiary">Org: {gara.organizzatore}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-indigo-600">{gara.data}</p>
                      <p className="text-xs text-content-tertiary font-mono">{gara.equipe}/{gara.manifestazione}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Conferma e Crea Eventi */}
      {stepCorrente === 3 && garaSelezionata && (
        <div className="bg-yellow-50 rounded-xl shadow-lg p-6 border-4 border-yellow-400">
          <h2 className="text-xl font-bold text-yellow-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-yellow-600" />
            3️⃣ Conferma Gara e Categorie
          </h2>

          {loadingCategorie ? (
            <div className="text-center py-4">
              <Loader2 className="animate-spin mx-auto" />
              <p className="text-sm text-content-tertiary mt-2">Caricamento categorie...</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-content-secondary mb-2">Nome Evento</label>
                <input
                  type="text"
                  value={nomeEvento}
                  onChange={(e) => setNomeEvento(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg bg-surface text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </div>

              {categorie.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Categorie da creare ({categorieSelezionate.length} selezionate)
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {categorie.map(cat => (
                      <div key={cat.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border">
                        <input
                          type="checkbox"
                          checked={categorieSelezionate.includes(cat.id)}
                          onChange={() => toggleCategoria(cat.id)}
                          className="w-5 h-5"
                        />
                        <div className="flex-1">
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {garaSelezionata.manifestazione}-{cat.id}
                          </span>
                          <span className="ml-2 text-sm">{cat.nome}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* p32: Campo unico codice FMI per tutte le categorie */}
              {categorieSelezionate.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <label className="block text-sm font-bold mb-2 text-yellow-800">
                    🔑 Codice FMI per accesso ERTA (obbligatorio)
                  </label>
                  <input
                    type="text"
                    placeholder="es. NAZEN032"
                    value={codiceFmi}
                    onChange={(e) => setCodiceFmi(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border-2 border-yellow-400 rounded-lg text-lg uppercase font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                  />
                  <p className="text-xs text-yellow-700 mt-1">
                    Questo codice verrà usato per tutte le {categorieSelezionate.length} categorie selezionate
                  </p>
                </div>
              )}
            </>
          )}

          <div className="bg-white p-4 rounded-lg mb-4 text-sm">
            <h3 className="font-semibold mb-2">📋 Riepilogo:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p>📍 Località: <strong>{garaSelezionata.luogo}</strong></p>
              <p>📅 Data: <strong>{garaSelezionata.data}</strong></p>
              <p>🔑 FICR: <strong>{anno}/{garaSelezionata.equipe}/{garaSelezionata.manifestazione}</strong></p>
            </div>
            <p className="mt-2 text-sm">
              📂 Eventi: <strong>{categorieSelezionate.map(c => 
                `${garaSelezionata.manifestazione}-${c}`
              ).join(', ') || 'nessuno'}</strong>
            </p>
            {categorieSelezionate.length > 0 && (
              <p className="mt-1 text-sm">
                🎫 Codice ERTA: <strong className="font-mono">{codiceFmi || '⚠️ DA INSERIRE'}</strong>
                <span className="text-content-tertiary ml-2">(per tutte le {categorieSelezionate.length} categorie)</span>
              </p>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStepCorrente(2)}
              className="px-4 py-2 text-content-secondary hover:text-content-primary"
            >
              ← Indietro
            </button>
            <button
              onClick={creaEventi}
              disabled={creando || categorieSelezionate.length === 0 || !codiceFmi.trim()}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
            >
              {creando ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Creazione...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Crea Eventi →
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Struttura Gara (NUOVO) */}
      {stepCorrente === 4 && eventiCreati.length > 0 && (
        <div className="rounded-xl shadow-lg overflow-hidden" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '3px' }}>
          <div className="bg-white rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                🏁
              </div>
              <div>
                <h2 className="text-xl font-bold text-content-primary">4️⃣ Struttura Gara</h2>
                <p className="text-content-tertiary text-sm">Definisci giri e prove speciali per la curva di apprendimento</p>
              </div>
            </div>

            {/* Numero Giri */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6">
              <span className="font-semibold text-content-secondary">Numero giri</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNumGiri(Math.max(1, numGiri - 1))}
                  className="w-10 h-10 rounded-lg border-2 border-border bg-white text-xl font-bold hover:bg-gray-100 transition"
                >
                  −
                </button>
                <span className="w-12 text-center text-3xl font-bold" style={{ color: '#667eea' }}>
                  {numGiri}
                </span>
                <button
                  onClick={() => setNumGiri(Math.min(10, numGiri + 1))}
                  className="w-10 h-10 rounded-lg border-2 border-border bg-white text-xl font-bold hover:bg-gray-100 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Lista Prove */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-content-secondary">Prove nel giro (in ordine di percorrenza)</span>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#e8f4fd', color: '#0066cc' }}>
                  {prove.filter(p => p.nome.trim()).length} prove
                </span>
              </div>

              <div className="space-y-3">
                {prove.map((prova, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                      prova.finale 
                        ? 'bg-amber-50 border-amber-400' 
                        : 'bg-gray-50 border-border-subtle'
                    }`}
                  >
                    {/* Numero */}
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#667eea' }}>
                      {index + 1}
                    </span>

                    {/* Input */}
                    <input
                      type="text"
                      value={prova.nome}
                      onChange={(e) => updateProva(index, 'nome', e.target.value)}
                      placeholder="Nome prova (es. Cross Test Bosco)..."
                      className="flex-1 px-4 py-3 border-2 border-border-subtle rounded-lg text-base bg-surface text-content-primary placeholder:text-content-tertiary focus:border-brand-500 focus:outline-none"
                    />

                    {/* Finale toggle */}
                    <button
                      onClick={() => updateProva(index, 'finale', !prova.finale)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                        prova.finale
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-content-secondary border border-border hover:border-amber-400'
                      }`}
                    >
                      {prova.finale ? '⭐ Finale' : '☆ Finale'}
                    </button>

                    {/* Frecce */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveProva(index, -1)}
                        disabled={index === 0}
                        className="w-7 h-5 rounded text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-40"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveProva(index, 1)}
                        disabled={index === prove.length - 1}
                        className="w-7 h-5 rounded text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-40"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Rimuovi */}
                    <button
                      onClick={() => removeProva(index)}
                      disabled={prove.length <= 1}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-lg bg-red-100 text-red-500 hover:bg-red-200 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Aggiungi */}
              <button
                onClick={addProva}
                className="w-full mt-4 py-3 border-2 border-dashed border-border rounded-xl text-content-tertiary font-medium hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-2"
              >
                <span className="text-xl">+</span> Aggiungi prova
              </button>
            </div>

            {/* Toggle Anteprima */}
            <button
              onClick={() => setShowPreviewStruttura(!showPreviewStruttura)}
              className="w-full py-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {showPreviewStruttura ? '🔼 Nascondi' : '🔽 Mostra'} anteprima PS ({psGenerate.length} totali)
            </button>

            {/* Anteprima */}
            {showPreviewStruttura && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl max-h-80 overflow-y-auto">
                {Array.from({ length: numGiri }, (_, i) => i + 1).map(giro => (
                  <div key={giro} className="mb-4">
                    <div className="text-xs font-bold text-indigo-600 uppercase mb-2 tracking-wide">
                      Giro {giro}
                    </div>
                    {psGenerate
                      .filter(ps => ps.giro === giro)
                      .map(ps => (
                        <div
                          key={ps.numero}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg mb-2 border border-border-subtle"
                        >
                          <span className="px-3 py-1 rounded-lg text-white text-sm font-bold" style={{ background: '#667eea' }}>
                            PS{ps.numero}
                          </span>
                          <span className="flex-1 text-sm">{ps.nome}</span>
                        </div>
                      ))}
                  </div>
                ))}

                {/* Finali */}
                {psGenerate.filter(ps => ps.isFinale).length > 0 && (
                  <div className="border-t-2 border-dashed border-amber-400 pt-4 mt-4">
                    <div className="text-xs font-bold text-amber-600 uppercase mb-2 tracking-wide">
                      ⭐ PS Finali
                    </div>
                    {psGenerate
                      .filter(ps => ps.isFinale)
                      .map(ps => (
                        <div
                          key={ps.numero}
                          className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg mb-2 border-2 border-amber-400"
                        >
                          <span className="px-3 py-1 rounded-lg text-white text-sm font-bold bg-amber-500">
                            PS{ps.numero}
                          </span>
                          <span className="flex-1 text-sm font-medium">{ps.nome}</span>
                          <span className="text-xs text-amber-600 font-semibold">FINALE</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 rounded-xl flex items-start gap-3" style={{ background: '#e8f4fd' }}>
              <span className="text-lg">💡</span>
              <div className="text-sm" style={{ color: '#0066cc' }}>
                <strong>Curva di apprendimento:</strong> le PS con lo stesso nome verranno 
                raggruppate per mostrare come il pilota migliora (o peggiora) nei giri successivi.
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStepCorrente(7)}
                className="px-4 py-2 text-content-secondary hover:text-content-primary"
              >
                ← Torna all'Import
              </button>
              <button
                onClick={salvaStrutturaGara}
                disabled={salvandoStruttura}
                className="px-6 py-3 rounded-lg text-white font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {salvandoStruttura ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Salva e Continua →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Tempi Settore (era Step 4) */}
      {stepCorrente === 5 && eventiCreati.length > 0 && (
        <div className="bg-green-50 rounded-xl shadow-lg p-6 border-4 border-green-400">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-green-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-green-600" />
              5️⃣ Tempi Settore (Orari Teorici CO)
            </h2>
            {eventiCreati.length > 1 && (
              <button
                onClick={applicaATutte}
                className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                📋 Applica prima gara a tutte
              </button>
            )}
          </div>
          
          <p className="text-sm text-content-secondary mb-4">
            Configura i tempi di trasferimento (hh:mm) per calcolare gli orari teorici ai Controlli Orario.
          </p>
          
          <div className="space-y-6">
            {eventiCreati.map(evento => {
              const config = tempiSettore[evento.codice_gara] || {};
              const coList = [
                { num: 1, isPartenza: true },
                { num: 2, attivo: 'co2_attivo', tempo: 'tempo_co1_co2', label: 'CO1→CO2' },
                { num: 3, attivo: 'co3_attivo', tempo: 'tempo_co2_co3', label: 'CO2→CO3' },
                { num: 4, attivo: 'co4_attivo', tempo: 'tempo_co3_co4', label: 'CO3→CO4' },
                { num: 5, attivo: 'co5_attivo', tempo: 'tempo_co4_co5', label: 'CO4→CO5' },
                { num: 6, attivo: 'co6_attivo', tempo: 'tempo_co5_co6', label: 'CO5→CO6' },
                { num: 7, attivo: 'co7_attivo', tempo: 'tempo_co6_co7', label: 'CO6→CO7' },
                { num: 8, attivo: 'co8_attivo', tempo: 'tempo_co7_co8', label: 'CO7→CO8' },
                { num: 9, attivo: 'co9_attivo', tempo: 'tempo_co8_co9', label: 'CO8→CO9' },
                { num: 10, attivo: 'co10_attivo', tempo: 'tempo_co9_co10', label: 'CO9→CO10' },
              ];
              
              return (
                <div key={evento.codice_gara} className="bg-white rounded-lg p-4 shadow">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-content-primary text-lg">
                      🏁 {evento.codice_gara}
                      <span className="ml-2 text-sm font-normal text-indigo-600">
                        {evento.codice_gara.endsWith('-1') ? '(Campionato)' :
                         evento.codice_gara.endsWith('-2') ? '(Sprint/Training)' :
                         evento.codice_gara.endsWith('-3') ? '(Regolarità/Epoca)' : ''}
                      </span>
                    </h3>
                    <button
                      onClick={() => {
                        const co2Tempo = config.tempo_co1_co2 || 100;
                        const updated = { ...config };
                        ['tempo_co2_co3','tempo_co3_co4','tempo_co4_co5',
                         'tempo_co5_co6','tempo_co6_co7','tempo_co7_co8','tempo_co8_co9','tempo_co9_co10']
                          .forEach(k => { updated[k] = co2Tempo; });
                        setTempiSettore(prev => ({ ...prev, [evento.codice_gara]: updated }));
                      }}
                      className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 font-semibold"
                    >
                      ⚡ Applica CO2 a tutti i CO
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                    {coList.map(co => {
                      // CO1 = PARTENZA (sempre visibile, nessun tempo)
                      if (co.isPartenza) {
                        return (
                          <div key={co.num} className="p-3 rounded-lg border-2 border-blue-500 bg-blue-50 flex items-center justify-center">
                            <span className="text-lg font-bold text-blue-800">🚩 PARTENZA</span>
                          </div>
                        );
                      }
                      
                      const isAttivo = config[co.attivo] ?? (co.num <= 2);
                      const tempoVal = minToHM(config[co.tempo]);
                      
                      return (
                        <div key={co.num} className={`p-3 rounded-lg border-2 ${isAttivo ? 'border-green-500 bg-green-50' : 'border-border bg-gray-100'}`}>
                          <label className="flex items-center gap-2 mb-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isAttivo}
                              onChange={(e) => updateTempoSettore(evento.codice_gara, co.attivo, e.target.checked)}
                              className="w-5 h-5 text-green-600 rounded"
                            />
                            <span className="text-sm font-bold">CO{co.num}</span>
                          </label>
                          {isAttivo && (
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                type="number" min="0" max="23" placeholder="h"
                                value={tempoVal.h}
                                onChange={(e) => updateTempoSettore(evento.codice_gara, co.tempo, hmToMin(e.target.value, tempoVal.m))}
                                className="w-14 px-2 py-2 border-2 border-border rounded text-center text-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                              />
                              <span className="text-lg font-bold">:</span>
                              <input
                                type="number" min="0" max="59" placeholder="m"
                                value={tempoVal.m}
                                onChange={(e) => updateTempoSettore(evento.codice_gara, co.tempo, hmToMin(tempoVal.h, e.target.value))}
                                className="w-14 px-2 py-2 border-2 border-border rounded text-center text-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Arrivo */}
                  <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg border-2 border-red-300">
                    <span className="font-bold text-red-800 text-lg">🏁 Arrivo</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="23" placeholder="h"
                        value={minToHM(config.tempo_ultimo_arr).h}
                        onChange={(e) => updateTempoSettore(evento.codice_gara, 'tempo_ultimo_arr', hmToMin(e.target.value, minToHM(config.tempo_ultimo_arr).m))}
                        className="w-16 px-2 py-2 border-2 border-border rounded text-center text-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                      <span className="text-lg font-bold">:</span>
                      <input
                        type="number" min="0" max="59" placeholder="m"
                        value={minToHM(config.tempo_ultimo_arr).m}
                        onChange={(e) => updateTempoSettore(evento.codice_gara, 'tempo_ultimo_arr', hmToMin(minToHM(config.tempo_ultimo_arr).h, e.target.value))}
                        className="w-16 px-2 py-2 border-2 border-border rounded text-center text-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                    <span className="text-sm text-content-secondary">dall'ultimo CO</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStepCorrente(6)}
              className="px-4 py-2 text-content-secondary hover:text-content-primary"
            >
              ← Paddock &amp; ERTA
            </button>
            <button
              onClick={salvaTempiSettore}
              disabled={salvandoTempi}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
            >
              {salvandoTempi ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Salva e Continua →
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Paddock & ERTA (GPS + coordinate paddock + codici accesso ERTA) */}
      {stepCorrente === 6 && eventiCreati.length > 0 && (
        <div className="bg-surface border border-border-subtle border-l-4 border-l-warning-fg rounded-lg p-5 shadow-sm">
          <h2 className="text-heading-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-warning-fg" />
            Paddock &amp; ERTA
          </h2>
          <p className="text-xs text-content-tertiary mt-1 mb-4">
            Coordinate paddock, tracking GPS, allarmi e credenziali per l'app ERTA (piloti e DdG).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Paddock 1 */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                📍 Paddock Principale
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-content-tertiary">Latitudine</label>
                  <input
                    type="text"
                    value={paddock1Lat}
                    onChange={(e) => setPaddock1Lat(e.target.value)}
                    placeholder="46.1234"
                    className="w-full px-3 py-2 border border-border rounded-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-content-tertiary">Longitudine</label>
                  <input
                    type="text"
                    value={paddock1Lon}
                    onChange={(e) => setPaddock1Lon(e.target.value)}
                    placeholder="11.5678"
                    className="w-full px-3 py-2 border border-border rounded-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>
            </div>
            
            {/* Paddock 2 */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                📍 Paddock Secondario (opzionale)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-content-tertiary">Latitudine</label>
                  <input
                    type="text"
                    value={paddock2Lat}
                    onChange={(e) => setPaddock2Lat(e.target.value)}
                    placeholder="46.1234"
                    className="w-full px-3 py-2 border border-border rounded-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-content-tertiary">Longitudine</label>
                  <input
                    type="text"
                    value={paddock2Lon}
                    onChange={(e) => setPaddock2Lon(e.target.value)}
                    placeholder="11.5678"
                    className="w-full px-3 py-2 border border-border rounded-lg font-mono bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow">
              <label className="text-sm font-medium text-content-secondary mb-1 block">
                Raggio Paddock (metri)
              </label>
              <input
                type="number"
                value={paddockRaggio}
                onChange={(e) => setPaddockRaggio(parseInt(e.target.value) || 500)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <label className="text-sm font-medium text-content-secondary mb-1 block">
                Frequenza GPS (secondi)
              </label>
              <input
                type="number"
                value={gpsFrequenza}
                onChange={(e) => setGpsFrequenza(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <label className="text-sm font-medium text-content-secondary mb-1 block">
                Allarme Fermo (minuti)
              </label>
              <input
                type="number"
                value={allarmeFermoMinuti}
                onChange={(e) => setAllarmeFermoMinuti(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>
          
          {/* Codici accesso */}
          <div className="bg-white rounded-lg p-4 shadow mb-6">
            <h3 className="font-bold mb-3">🔐 Codici Accesso</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  Codice Direttore di Gara
                </label>
                <input
                  type="text"
                  value={codiceDdG}
                  onChange={(e) => setCodiceDdG(e.target.value.toUpperCase())}
                  placeholder="es. D03478"
                  className="w-full px-3 py-2 border border-border rounded-lg uppercase focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-content-tertiary mt-1">Per accesso Direttore di Gara</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  Codice Accesso Pubblico
                </label>
                <input
                  type="text"
                  value={codiceAccessoPubblico}
                  onChange={(e) => setCodiceAccessoPubblico(e.target.value.toUpperCase())}
                  placeholder="es. NAZEN032"
                  className="w-full px-3 py-2 border border-border rounded-lg uppercase focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-content-tertiary mt-1">Per visualizzazione classifica pubblica</p>
              </div>
            </div>
            <p className="text-xs text-content-tertiary mt-3">I codici piloti ERTA sono già impostati allo Step 3</p>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setStepCorrente(3)}
              className="px-4 py-2 text-content-secondary hover:text-content-primary"
            >
              ← Configura
            </button>
            <button
              onClick={salvaParametriGPS}
              disabled={salvandoGPS}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-orange-700 disabled:opacity-50"
            >
              {salvandoGPS ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Salva e Continua →
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: Import Pre-Gara (era Step 6) */}
      {stepCorrente === 7 && (
        <div className="bg-surface border border-border-subtle border-l-4 border-l-brand-500 rounded-lg p-5 shadow-sm">
          <h2 className="text-heading-2 flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-600 dark:text-brand-500" />
            Import Dati da FICR
          </h2>
          <p className="text-xs text-content-tertiary mt-1 mb-4">
            Importa dalla FICR per <span className="font-mono">{eventiCreati.map(e => e.codice_gara).join(', ')}</span>.
            I primi 3 bottoni coprono il pre-gara. Il 4° (Tempi) va usato durante o dopo la gara.
          </p>

          {/* Bottone IMPORTA TUTTO - shortcut che esegue i 4 import in sequenza */}
          <div className="bg-brand-50 dark:bg-brand-100/20 border-2 border-brand-500 rounded-lg p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-content-primary flex items-center gap-2">
                <span className="text-xl">🚀</span>
                Importa Tutto
              </h3>
              <p className="text-xs text-content-secondary mt-0.5">
                Esegue in sequenza: Numeri → Ordine → Tempi. Ideale post-gara per popolare tutto in un colpo solo.
              </p>
            </div>
            <button
              onClick={handleImportTutto}
              disabled={importandoFicr['tutto'] || importandoFicr['entrylist'] || importandoFicr['startlist'] || importandoFicr['tempi']}
              className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-bold shadow-sm transition-colors whitespace-nowrap"
            >
              {importandoFicr['tutto'] ? '⏳ Importando tutto...' : '🚀 Importa Tutto'}
            </button>
          </div>

          {/* 3 Bottoni Import: Numeri / Ordine / Tempi
              (T-5 Programma rimosso: era un doppione di T-2 entrylist) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* T-2: Numeri */}
            <div className="bg-white rounded-lg p-4 shadow border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">🔢</span>
                <div>
                  <h3 className="font-bold text-content-primary">T-2 Numeri</h3>
                  <p className="text-xs text-content-tertiary">2 giorni prima</p>
                </div>
              </div>
              <button
                onClick={() => handleImportFicr('entrylist', 'Numeri')}
                disabled={importandoFicr['entrylist'] || importandoFicr['tutto']}
                className="w-full px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-semibold"
              >
                {importandoFicr['entrylist'] ? '⏳ Importando...' : '🔢 Import Numeri'}
              </button>
              {importResult['entrylist'] && (
                <div className={`text-sm mt-2 ${importResult['entrylist'].success ? 'text-green-600' : 'text-red-600'}`}>
                  <p>{importResult['entrylist'].message}</p>
                  {importResult['entrylist'].dettagli && (
                    <p className="text-xs text-content-tertiary mt-1">{importResult['entrylist'].dettagli}</p>
                  )}
                </div>
              )}
            </div>
            
            {/* T-1: Ordine */}
            <div className="bg-white rounded-lg p-4 shadow border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">🏁</span>
                <div>
                  <h3 className="font-bold text-content-primary">T-1 Ordine</h3>
                  <p className="text-xs text-content-tertiary">1 giorno prima</p>
                </div>
              </div>
              <button
                onClick={() => handleImportFicr('startlist', 'Ordine')}
                disabled={importandoFicr['startlist'] || importandoFicr['tutto']}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                {importandoFicr['startlist'] ? '⏳ Importando...' : '🏁 Import Ordine'}
              </button>
              {importResult['startlist'] && (
                <div className={`text-sm mt-2 ${importResult['startlist'].success ? 'text-green-600' : 'text-red-600'}`}>
                  <p>{importResult['startlist'].message}</p>
                  {importResult['startlist'].dettagli && (
                    <p className="text-xs text-content-tertiary mt-1">{importResult['startlist'].dettagli}</p>
                  )}
                </div>
              )}
            </div>

            {/* T-0: Tempi (clasps) - post-gara */}
            <div className="bg-surface border border-border-subtle rounded-lg p-4 border-l-4 border-l-rose-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">⏱️</span>
                <div>
                  <h3 className="font-bold text-content-primary">T-0 Tempi</h3>
                  <p className="text-xs text-content-tertiary">Durante / dopo la gara</p>
                </div>
              </div>
              <button
                onClick={handleImportTempi}
                disabled={importandoFicr['tempi'] || importandoFicr['tutto']}
                className="w-full px-4 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-semibold transition-colors"
              >
                {importandoFicr['tempi'] ? '⏳ Importando...' : '⏱️ Import Tempi'}
              </button>
              {importResult['tempi'] && (
                <div className={`text-sm mt-2 ${importResult['tempi'].success ? 'text-success-fg' : 'text-danger-fg'}`}>
                  <p>{importResult['tempi'].message}</p>
                  {importResult['tempi'].dettagli && (
                    <p className="text-xs text-content-tertiary mt-1 break-words">{importResult['tempi'].dettagli}</p>
                  )}
                </div>
              )}
              <p className="text-2xs text-content-tertiary mt-2 italic">
                Scarica i tempi archiviati dalla FICR. Necessario per "La Mia Gara" e le classifiche.
              </p>
            </div>
          </div>

          {/* Import XML FMI - alternativa pre-gara quando la API FICR non basta */}
          <div className="mb-6">
            <XmlImportPanel eventiCreati={eventiCreati} />
          </div>

          {/* Struttura Gara - opzionale, migliora UX grafici (tipologie prove) */}
          <div className="mb-6 bg-surface-2 border border-border-subtle rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Settings className="w-4 h-4 text-content-secondary mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-content-primary">Struttura gara (opzionale)</h3>
                  <p className="text-xs text-content-tertiary mt-0.5">
                    Configura giri e tipologie prove (es. "Enduro Test", "Cross Test"). Non e' obbligatoria: il sistema crea le prove automaticamente da FICR. Serve solo se vuoi nomi tipologia nei grafici di "La Mia Gara".
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStepCorrente(4)}
                className="h-9 px-3 rounded-md border border-border bg-surface text-xs font-medium hover:bg-surface-3 transition-colors whitespace-nowrap"
              >
                Configura &rarr;
              </button>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStepCorrente(5)}
              className="px-4 py-2 text-content-secondary hover:text-content-primary"
            >
              ← Tempi CO
            </button>
            <button
              onClick={() => window.location.href = '/eventi'}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-700"
            >
              <CheckCircle size={20} />
              Setup Completato! →
            </button>
          </div>
        </div>
      )}

      {/* Errori */}
      {errore && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mt-4 flex items-center gap-2">
          <AlertCircle size={20} />
          {errore}
        </div>
      )}

      {/* Risultato creazione (step 3) */}
      {risultato && stepCorrente === 3 && (
        <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded-lg mt-4">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <CheckCircle size={20} />
            Eventi creati con successo!
          </div>
          <div className="text-sm">
            {risultato.eventi_creati?.map(e => (
              <p key={e.id}>✅ {e.codice_gara}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
