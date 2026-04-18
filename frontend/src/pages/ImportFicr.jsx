import { useState, useEffect } from 'react';
import { Download, Search, Loader2, AlertCircle, CheckCircle, Calendar, MapPin, Plus } from 'lucide-react';

import { API_BASE as _API_BASE } from '../services/api';
const API_BASE = `${_API_BASE}/api`;

// TIPOLOGIE_GARA ora vengono caricate dinamicamente dall'API FICR /gare/
const ICONE_DEFAULT = ['🏆', '🎯', '🏁', '⭐', '🎖️', '🏅']; // Icone per gare 1,2,3,4,5,6

// Database manifestazioni conosciute
const MANIFESTAZIONI_DB = [
  {
    id: 'vestenanova-2025',
    nome: 'Vestenanova 2025',
    luogo: 'Vestenanova (VR)',
    data: '2025-10-26',
    anno: String(new Date().getFullYear()),
    equipe: '107',
    manifestazione: '303',
    giorno: '1'
  },
  {
    id: 'isola-vicentina-2025',
    nome: 'Isola Vicentina 2025',
    luogo: 'Isola Vicentina (VI)',
    data: '2025-11-16',
    anno: String(new Date().getFullYear()),
    equipe: '99',
    manifestazione: '11',
    giorno: '1'
  }
];


// ============================================================
// COMPONENTE IMPORT XML
// ============================================================
function XmlImport() {
  const [xmlFile, setXmlFile] = useState(null);
  const [xmlData, setXmlData] = useState(null); // { gara, piloti }
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [stato, setStato] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/eventi`)
      .then(r => r.json())
      .then(data => setEventi(Array.isArray(data) ? data : data.eventi || []))
      .catch(() => {});
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setXmlFile(file);
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
        setMsg('');
      } catch(err) {
        setMsg('❌ Errore parsing XML: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!eventoSelezionato) { setMsg('⚠️ Seleziona un evento di destinazione'); return; }
    if (!xmlData) { setMsg('⚠️ Carica prima un file XML'); return; }
    setStato('loading');
    setMsg('Importazione in corso...');
    try {
      const res = await fetch(`${API_BASE}/eventi/${eventoSelezionato}/import-xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piloti: xmlData.piloti })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore server');
      setStato('success');
      setMsg(`✅ ${data.importati} inseriti, ${data.aggiornati} aggiornati — Totale: ${data.totale} piloti`);
    } catch(err) {
      setStato('error');
      setMsg('❌ ' + err.message);
    }
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5">
      <h2 className="text-xl font-semibold mb-4">📂 Import file XML FMI</h2>

      {/* Upload file */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-content-secondary mb-2">File XML iscritti</label>
        <input
          type="file"
          accept=".xml"
          onChange={handleFile}
          className="block w-full text-sm text-content-tertiary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
        />
      </div>

      {/* Anteprima dati gara */}
      {xmlData && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="font-semibold text-green-800">{xmlData.gara.codice} — {xmlData.gara.descrizione}</p>
          <p className="text-sm text-green-700">📍 {xmlData.gara.luogo} | 📅 {xmlData.gara.data}</p>
          <p className="text-sm text-green-700 mt-1">👥 <strong>{xmlData.piloti.length}</strong> piloti trovati</p>
        </div>
      )}

      {/* Selezione evento */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-content-secondary mb-2">Evento di destinazione</label>
        <select
          value={eventoSelezionato}
          onChange={e => setEventoSelezionato(e.target.value)}
          className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-green-500"
        >
          <option value="">— Seleziona evento —</option>
          {eventi.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.nome_evento} — {ev.data_inizio?.substring(0,10)}
            </option>
          ))}
        </select>
      </div>

      {/* Bottone import */}
      <button
        onClick={handleImport}
        disabled={!xmlData || !eventoSelezionato || stato === 'loading'}
        className="w-full py-3 px-6 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {stato === 'loading' ? '⏳ Importazione...' : '📥 Importa Piloti'}
      </button>

      {msg && (
        <p className={`mt-3 text-center text-sm font-semibold ${stato === 'success' ? 'text-green-700' : stato === 'error' ? 'text-red-600' : 'text-content-secondary'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}

export default function ImportFicr() {
  const [modalita, setModalita] = useState('ricerca'); // 'ricerca' | 'manuale'
  const [step, setStep] = useState(1);
  
  // Ricerca
  const [termineRicerca, setTermineRicerca] = useState('');
  const [manifestazioneSelezionata, setManifestazioneSelezionata] = useState(null);
  const [manifestazioniFICR, setManifestazioniFICR] = useState([]);
  
  // Parametri manuali
  const [params, setParams] = useState({
    anno: String(new Date().getFullYear()),
    equipe: '107',
    manifestazione: '',
    giorno: '1',
    nomeDisplay: '',
    data: '',
    luogo: ''
  });

  // Gare trovate
  const [gare, setGare] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Import
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState([]);
  const [eventiCreati, setEventiCreati] = useState([]);
  const [caricandoIscritti, setCaricandoIscritti] = useState(false);
  const [iscrittiMsg, setIscrittiMsg] = useState('');

  // Carica manifestazioni da FICR
  const caricaManifestazioniFICR = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://apienduro.ficr.it/END/mpcache-30/get/schedule/${new Date().getFullYear()}/*/*`);
      const json = await res.json();
      const gare = json.data || [];
      
      // Trasforma in formato utilizzabile
      const gareMappate = gare.map(g => ({
        id: `${g.ma_CodiceEquipe}-${g.ma_Manifestazione}`,
        nome: g.Description || g.ma_Descrizione,
        luogo: g.Place || g.ma_Localita,
        data: g.ma_Data?.split('T')[0] || '',
        anno: String(g.Year || g.ma_Anno),
        equipe: String(g.TeamCode || g.ma_CodiceEquipe),
        manifestazione: String(g.ShowID || g.ma_Manifestazione),
        giorno: '1'
      }));
      
      setManifestazioniFICR(gareMappate);
      
    } catch (err) {
      setError('Errore caricamento gare FICR: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Carica lista gare all'avvio
  useEffect(() => {
    if (modalita === 'ricerca') {
      caricaManifestazioniFICR();
    }
  }, [modalita]);

  // Filtra manifestazioni per ricerca
  const manifestazioniFiltrate = manifestazioniFICR.filter(m => {
    const search = termineRicerca.toLowerCase();
    return m.nome.toLowerCase().includes(search) || 
           m.luogo.toLowerCase().includes(search) ||
           m.data.includes(search);
  });

  const handleSelezionaManifestazione = (manif) => {
    setManifestazioneSelezionata(manif);
    setParams({
      anno: manif.anno,
      equipe: manif.equipe,
      manifestazione: manif.manifestazione,
      giorno: manif.giorno,
      nomeDisplay: manif.nome,
      data: manif.data,
      luogo: manif.luogo
    });
  };

  const handleEsplora = async () => {
    setLoading(true);
    setError('');
    setGare([]);

    try {
      // STEP 1: Carica lista gare dinamicamente dall'API FICR
      const gareUrl = `https://apienduro.ficr.it/END/mpcache-60/get/gare/${params.anno}/${params.equipe}/${params.manifestazione}`;
      console.log('[FICR] Carico gare:', gareUrl);
      
      const gareRes = await fetch(gareUrl);
      const gareData = await gareRes.json();
      
      if (!gareData?.data || gareData.data.length === 0) {
        setError('Nessuna gara trovata per questa manifestazione');
        setLoading(false);
        return;
      }
      
      // Trasforma gare API in formato utilizzabile
      const tipologieGara = gareData.data.map(g => ({
        codice: g.Gara,
        nome: g.Descr,
        icona: ICONE_DEFAULT[g.Gara - 1] || '🏁'
      }));
      
      console.log('[FICR] Gare trovate:', tipologieGara);

      // STEP 2: Per ogni gara, cerca le prove disponibili
      const risultati = [];

      for (const tip of tipologieGara) {
        const prove = [];
        
        // Chat 17: Carica nomi prove da API listps (CT1, ET1, etc.)
        let mappaPS = {};
        try {
          const listpsUrl = `https://apienduro.ficr.it/END/mpcache-30/get/listps/${params.anno}/${params.equipe}/${params.manifestazione}/${tip.codice}`;
          const listpsRes = await fetch(listpsUrl);
          const listpsData = await listpsRes.json();
          (listpsData?.data || []).forEach(ps => {
            // Estrae nome tra apici: "Cross Test 1 ''Collina Verde''" → "Collina Verde"
            const nomeMatch = ps.Descr?.match(/''([^']+)''/);
            const nomePista = nomeMatch ? nomeMatch[1] : '';
            mappaPS[ps.Rilevazione] = nomePista ? `${ps.Sigla} ${nomePista}` : ps.Sigla;
          });
          console.log(`[FICR] Mappa PS per ${tip.nome}:`, mappaPS);
        } catch(e) { console.log('listps non disponibile, uso nomi default'); }

        for (let p = 2; p <= 20; p++) {
          try {
            const url = `https://apienduro.ficr.it/END/mpcache-5/get/clasps/${params.anno}/${params.equipe}/${params.manifestazione}/${tip.codice}/${p}/1/*/*/*/*/*`;
            const res = await fetch(url);
            const data = await res.json();

            if (data?.data?.clasdella?.length > 0) {
              const firstItem = data.data.clasdella[0];
              const nomePs = mappaPS[p] || firstItem.ps || `Prova ${p}`;

              prove.push({
                numero: p,
                nome: nomePs,
                piloti: data.data.clasdella.length
              });
            }
          } catch (e) {
            console.log(`${tip.nome} prova ${p}: non disponibile`);
          }
        }

        risultati.push({
          tipologia: tip,
          prove: prove  // può essere vuoto se gara non ancora corsa
        });
      }

      if (risultati.length === 0) {
        setError('Nessuna gara trovata per questa manifestazione');
      } else {
        setGare(risultati);
        setStep(2);
      }
    } catch (err) {
      setError('Errore: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress([]);

    try {
      for (const gara of gare) {
        // Nome evento con località
        const nomeEvento = `${params.luogo} - ${gara.tipologia.nome}`;

        setProgress(prev => [...prev, {
          gara: gara.tipologia.nome,
          status: 'creating',
          msg: 'Creazione evento...'
        }]);

        // Crea evento
        const evRes = await fetch(`${API_BASE}/eventi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome_evento: nomeEvento,
            codice_gara: `${params.manifestazione}-${gara.tipologia.codice}`,
            data_inizio: params.data,
            data_fine: params.data,
            luogo: params.luogo,
            descrizione: `${params.nomeDisplay} - ${gara.tipologia.nome}`,
            ficr_anno: parseInt(params.anno),
            ficr_codice_equipe: parseInt(params.equipe),
            ficr_manifestazione: parseInt(params.manifestazione)
          })
        });

        if (!evRes.ok) {
          const errData = await evRes.json();
          throw new Error(`Errore creazione evento: ${errData.error}`);
        }

        const evData = await evRes.json();
        const evId = evData.id;
        setEventiCreati(prev => [...prev, { id_evento: evId, gara: gara.tipologia, codice: gara.tipologia.codice }]);

        setProgress(prev => prev.map(p =>
          p.gara === gara.tipologia.nome
            ? { ...p, status: 'importing', msg: `Importo ${gara.prove.length} prove...` }
            : p
        ));

        let ok = 0;
        let errori = [];
        
        for (const prova of gara.prove) {
          try {
            // Crea PS
            const psRes = await fetch(`${API_BASE}/prove-speciali`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nome_ps: prova.nome,
                numero_ordine: prova.numero,
                id_evento: evId
              })
            });

            if (!psRes.ok) {
              const errData = await psRes.json();
              errori.push(`PS${prova.numero}: ${errData.error}`);
              continue;
            }
            
            const psData = await psRes.json();

            // Import dati
            const impRes = await fetch(`${API_BASE}/import-ficr`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                anno: parseInt(params.anno),
                codiceEquipe: parseInt(params.equipe),
                manifestazione: parseInt(params.manifestazione),
                giorno: parseInt(params.giorno),
                prova: prova.numero,
                categoria: gara.tipologia.codice,
                id_evento: evId,
                id_ps: psData.id
              })
            });

            if (impRes.ok) {
              const importData = await impRes.json();
              console.log(`PS${prova.numero}: ${importData.piloti_importati} piloti, ${importData.tempi_importati} tempi`);
              ok++;
            } else {
              const errData = await impRes.json();
              errori.push(`Import PS${prova.numero}: ${errData.error}`);
            }
          } catch (e) {
            console.error('Errore prova:', e);
            errori.push(`PS${prova.numero}: ${e.message}`);
          }
        }

        const statusMsg = errori.length > 0 
          ? `⚠️ ${ok}/${gara.prove.length} prove (${errori.length} errori)`
          : `✅ ${ok}/${gara.prove.length} prove importate`;

        setProgress(prev => prev.map(p =>
          p.gara === gara.tipologia.nome
            ? { ...p, status: 'done', msg: statusMsg, errori }
            : p
        ));
      }
    } catch (err) {
      setError('Errore import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCaricaIscritti = async () => {
    setCaricandoIscritti(true);
    setIscrittiMsg('');
    let totale = 0;
    try {
      // Se eventiCreati è vuoto (eventi già esistenti), li cerco dal backend
      let evDaUsare = eventiCreati;
      if (evDaUsare.length === 0) {
        const evRes = await fetch(`${API_BASE}/eventi`);
        const evList = await evRes.json();
        // Cerca eventi con codice gara che corrisponde alla manifestazione
        evDaUsare = gare.map(g => {
          const codice = `${params.manifestazione}-${g.tipologia.codice}`;
          const trovato = evList.find(e => e.codice_gara === codice);
          return trovato ? { id_evento: trovato.id, gara: g.tipologia, codice: parseInt(trovato.codice_gara.split('-')[1]) } : null;
        }).filter(Boolean);
      }

      console.log('[DEBUG] evDaUsare:', JSON.stringify(evDaUsare));
      for (const ev of evDaUsare) {
        const res = await fetch(`${API_BASE}/eventi/${ev.id_evento}/import-piloti-ficr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          totale += (data.pilotiImportati || 0) + (data.pilotiAggiornati || 0);
        } else {
          const errData = await res.json();
          setIscrittiMsg(`❌ Errore server: ${errData.error}`);
          setCaricandoIscritti(false);
          return;
        }
      }
      setIscrittiMsg(`✅ ${totale} iscritti caricati`);
    } catch (err) {
      setIscrittiMsg(`❌ Errore: ${err.message}`);
    } finally {
      setCaricandoIscritti(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="text-heading-1">Import FICR</h1>
        <p className="text-content-secondary mt-1 text-sm">Importa manifestazioni, piloti e tempi dal sistema FICR</p>
      </div>

      {/* STEP 1: Selezione */}
      {step === 1 && (
        <div>
          {/* Tab Modalità */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setModalita('ricerca')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                modalita === 'ricerca'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-content-secondary hover:bg-gray-200'
              }`}
            >
              <Search className="w-5 h-5 inline mr-2" />
              Cerca Manifestazione
            </button>
            <button
              onClick={() => setModalita('manuale')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                modalita === 'manuale'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-content-secondary hover:bg-gray-200'
              }`}
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Inserimento Manuale
            </button>
            <button
              onClick={() => setModalita('xml')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                modalita === 'xml'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-content-secondary hover:bg-gray-200'
              }`}
            >
              📂 Import file XML
            </button>
          </div>

          {/* MODALITÀ XML */}
          {modalita === 'xml' && (
            <XmlImport />
          )}

          {/* MODALITÀ RICERCA */}
          {modalita === 'ricerca' && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5">
              <h2 className="text-xl font-semibold mb-4">Seleziona Manifestazione</h2>
              
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Cerca per nome, luogo o data..."
                  value={termineRicerca}
                  onChange={(e) => setTermineRicerca(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-border rounded-lg text-lg focus:border-brand-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="space-y-3">
                {manifestazioniFiltrate.length === 0 ? (
                  <div className="text-center py-12 text-content-tertiary">
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Nessuna manifestazione trovata</p>
                    <p className="text-sm mt-2">Prova a cercare con un termine diverso o usa l'inserimento manuale</p>
                  </div>
                ) : (
                  manifestazioniFiltrate.map((manif) => (
                    <button
                      key={manif.id}
                      onClick={() => handleSelezionaManifestazione(manif)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        manifestazioneSelezionata?.id === manif.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-border-subtle hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-content-primary">{manif.nome}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-content-secondary">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(manif.data).toLocaleDateString('it-IT', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {manif.luogo}
                            </div>
                          </div>
                        </div>
                        {manifestazioneSelezionata?.id === manif.id && (
                          <CheckCircle className="w-6 h-6 text-brand-600 dark:text-brand-500" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {manifestazioneSelezionata && (
                <button
                  onClick={handleEsplora}
                  disabled={loading}
                  className="w-full mt-6 bg-brand-600 text-white py-4 rounded-lg hover:bg-brand-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-lg font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Esplorazione in corso...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      Cerca Gare
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* MODALITÀ MANUALE */}
          {modalita === 'manuale' && (
            <div className="bg-surface border border-border-subtle rounded-lg p-5">
              <h2 className="text-xl font-semibold mb-4">Inserimento Manuale</h2>
              
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  ℹ️ Usa questa modalità solo se la manifestazione non è presente nell'elenco. Serve conoscere i codici FICR.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Anno</label>
                  <input
                    type="text"
                    value={params.anno}
                    onChange={e => setParams({ ...params, anno: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Codice Equipe *</label>
                  <input
                    type="text"
                    value={params.equipe}
                    onChange={e => setParams({ ...params, equipe: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="es: 107"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Manifestazione *</label>
                  <input
                    type="text"
                    value={params.manifestazione}
                    onChange={e => setParams({ ...params, manifestazione: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="es: 303"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Giorno</label>
                  <input
                    type="text"
                    value={params.giorno}
                    onChange={e => setParams({ ...params, giorno: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome Evento *</label>
                  <input
                    type="text"
                    value={params.nomeDisplay}
                    onChange={e => setParams({ ...params, nomeDisplay: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="es: Vestenanova 2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data *</label>
                  <input
                    type="date"
                    value={params.data}
                    onChange={e => setParams({ ...params, data: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Luogo *</label>
                  <input
                    type="text"
                    value={params.luogo}
                    onChange={e => setParams({ ...params, luogo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="es: Vestenanova (VR)"
                  />
                </div>
              </div>

              <button
                onClick={handleEsplora}
                disabled={loading || !params.manifestazione || !params.nomeDisplay}
                className="w-full bg-brand-600 text-white py-3 rounded-lg hover:bg-brand-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Esplorazione in corso...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Esplora Tutte le Gare
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Conferma e Import */}
      {step === 2 && gare.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <h2 className="text-xl font-semibold mb-4">Gare Trovate</h2>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{params.nomeDisplay}</strong> | {params.data} | {params.luogo}
            </p>
            <p className="text-sm text-brand-700 dark:text-brand-500 mt-1">
              {gare.length} gare, {gare.reduce((sum, g) => sum + g.prove.length, 0)} prove totali
            </p>
          </div>

          {gare.map((gara, idx) => (
            <div key={idx} className="mb-4 border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{gara.tipologia.icona}</span>
                <h3 className="text-lg font-bold">
                  {gara.tipologia.nome} ({gara.prove.length} prove)
                </h3>
              </div>
              <div className="space-y-1">
                {gara.prove.length === 0 ? (
                  <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                    ⏳ Gara non ancora iniziata — le prove si caricheranno in diretta
                  </div>
                ) : (
                  gara.prove.map((p, i) => (
                    <div key={i} className="text-sm bg-gray-50 p-2 rounded flex justify-between">
                      <span>Prova {p.numero}: {p.nome}</span>
                      <span className="text-content-secondary">{p.piloti} piloti</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep(1);
                setGare([]);
                setError('');
              }}
              className="px-6 py-3 border-2 border-border rounded-lg hover:bg-gray-50 font-semibold"
            >
              Indietro
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-lg font-semibold"
            >
              {importing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Import in corso...
                </>
              ) : (
                <>
                  <Download className="w-6 h-6" />
                  Importa Tutto
                </>
              )}
            </button>
          </div>

          {progress.length > 0 && (
            <div className="mt-6 space-y-2">
              {progress.map((p, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    p.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.status === 'done' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Loader2 className="w-5 h-5 animate-spin text-brand-600 dark:text-brand-500" />
                    )}
                    <span className="font-semibold">{p.gara}</span>
                  </div>
                  <p className="text-sm mt-1">{p.msg}</p>
                </div>
              ))}
              {progress.length > 0 && progress.every(p => p.status === 'done') && (
                <div className="mt-4">
                  <button
                    onClick={handleCaricaIscritti}
                    disabled={caricandoIscritti}
                    className="w-full bg-brand-600 text-white py-3 rounded-lg hover:bg-brand-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-semibold"
                  >
                    {caricandoIscritti ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Caricamento iscritti...</>
                    ) : (
                      '👥 Carica Iscritti Pre-Gara'
                    )}
                  </button>
                  {iscrittiMsg && (
                    <p className="mt-2 text-center text-sm font-semibold">{iscrittiMsg}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
