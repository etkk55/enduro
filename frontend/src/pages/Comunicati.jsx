import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Edit2, Save, X, FileText, Upload, Info, ParkingSquare } from 'lucide-react';

import { API_BASE as API_URL } from '../services/api';

const TIPI_DOC = {
  comunicato: { label: 'Comunicati', icon: MessageSquare, color: 'blue', prefix: 'COM' },
  general_info: { label: 'General Info', icon: Info, color: 'green', prefix: 'GEN' },
  paddock_info: { label: 'Paddock Info', icon: ParkingSquare, color: 'amber', prefix: 'PAD' }
};

export default function Comunicati() {
  const [codiceGara, setCodiceGara] = useState('');
  const [tipoAttivo, setTipoAttivo] = useState('comunicato');
  const [testoDocumento, setTestoDocumento] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [documenti, setDocumenti] = useState({ comunicato: [], general_info: [], paddock_info: [] });
  const [stats, setStats] = useState({ comunicato: null, general_info: null, paddock_info: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [gareRecenti, setGareRecenti] = useState([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [currentPdf, setCurrentPdf] = useState({ data: '', nome: '' });
  const [gareCollegate, setGareCollegate] = useState([]);
  const [gareSelezionate, setGareSelezionate] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('gareRecentiComunicati');
    if (saved) {
      setGareRecenti(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (codiceGara) {
      loadAllDocumenti();
      loadGareCollegate();
    } else {
      setDocumenti({ comunicato: [], general_info: [], paddock_info: [] });
      setStats({ comunicato: null, general_info: null, paddock_info: null });
      setGareCollegate([]);
      setGareSelezionate([]);
    }
  }, [codiceGara]);

  const loadGareCollegate = async () => {
    if (!codiceGara || !codiceGara.includes('-')) {
      setGareCollegate([codiceGara]);
      setGareSelezionate([codiceGara]);
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/ddg/multi/${codiceGara}`);
      const data = await res.json();
      
      if (data.success && data.eventi && data.eventi.length > 0) {
        const codici = data.eventi.map(e => e.codice_gara);
        setGareCollegate(codici);
        setGareSelezionate(codici);
      } else {
        setGareCollegate([codiceGara]);
        setGareSelezionate([codiceGara]);
      }
    } catch (err) {
      setGareCollegate([codiceGara]);
      setGareSelezionate([codiceGara]);
    }
  };

  const toggleGaraSelezionata = (codice) => {
    if (gareSelezionate.includes(codice)) {
      setGareSelezionate(gareSelezionate.filter(g => g !== codice));
    } else {
      setGareSelezionate([...gareSelezionate, codice]);
    }
  };

  const selezionaTutte = () => setGareSelezionate([...gareCollegate]);
  const deselezionaTutte = () => setGareSelezionate([]);

  const salvaCodiceGaraRecente = (codice) => {
    if (!codice) return;
    const nuoveGare = [codice, ...gareRecenti.filter(g => g !== codice)].slice(0, 10);
    setGareRecenti(nuoveGare);
    localStorage.setItem('gareRecentiComunicati', JSON.stringify(nuoveGare));
  };

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Solo file PDF sono ammessi');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('PDF troppo grande (max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPdfFile(event.target.result.split(',')[1]);
      setPdfFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const rimuoviPdf = () => {
    setPdfFile(null);
    setPdfFileName('');
  };

  const loadAllDocumenti = async () => {
    if (!codiceGara) return;
    setLoading(true);
    setError('');
    
    try {
      const newDocs = { comunicato: [], general_info: [], paddock_info: [] };
      const newStats = { comunicato: null, general_info: null, paddock_info: null };
      
      for (const tipo of Object.keys(TIPI_DOC)) {
        const res = await fetch(`${API_URL}/api/comunicati/${codiceGara}?tipo=${tipo}`);
        const data = await res.json();
        if (data.success) {
          newDocs[tipo] = data.comunicati || [];
        }
        
        const statsRes = await fetch(`${API_URL}/api/comunicati/${codiceGara}/stats?tipo=${tipo}`);
        const statsData = await statsRes.json();
        if (statsData.success) {
          newStats[tipo] = statsData.stats;
        }
      }
      
      setDocumenti(newDocs);
      setStats(newStats);
    } catch (err) {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const creaDocumento = async (e) => {
    e.preventDefault();
    
    if (!codiceGara || !testoDocumento.trim()) {
      setError('Compila tutti i campi');
      return;
    }

    if (gareSelezionate.length === 0) {
      setError('Seleziona almeno una gara destinataria');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let successi = 0;
      let errori = [];

      for (const gara of gareSelezionate) {
        try {
          const body = {
            codice_gara: gara,
            testo: testoDocumento,
            tipo: tipoAttivo
          };

          if (pdfFile) {
            body.pdf_allegato = pdfFile;
            body.pdf_nome = pdfFileName;
          }

          const res = await fetch(`${API_URL}/api/comunicati`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          const data = await res.json();

          if (data.success) {
            successi++;
          } else {
            errori.push(gara);
          }
        } catch (err) {
          errori.push(gara);
        }
      }

      if (successi > 0) {
        setTestoDocumento('');
        setPdfFile(null);
        setPdfFileName('');
        salvaCodiceGaraRecente(codiceGara);
        loadAllDocumenti();
        
        if (errori.length > 0) {
          alert(`✅ ${TIPI_DOC[tipoAttivo].label} inviato a ${successi} gare.\n⚠️ Errore per: ${errori.join(', ')}`);
        } else if (successi > 1) {
          alert(`✅ ${TIPI_DOC[tipoAttivo].label} inviato a ${successi} gare!`);
        }
      } else {
        setError('Errore invio documento');
      }
    } catch (err) {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const eliminaDocumento = async (id) => {
    if (!confirm('Eliminare questo documento?')) return;

    try {
      const res = await fetch(`${API_URL}/api/comunicati/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        loadAllDocumenti();
      } else {
        alert('Errore eliminazione');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  const iniziaModifica = (doc) => {
    setEditingId(doc.id);
    setEditText(doc.testo);
  };

  const annullaModifica = () => {
    setEditingId(null);
    setEditText('');
  };

  const salvaDocumento = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/comunicati/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: editText })
      });

      const data = await res.json();

      if (data.success) {
        setEditingId(null);
        setEditText('');
        loadAllDocumenti();
      } else {
        alert('Errore modifica');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  const apriPdfModal = (pdfData, pdfNome) => {
    setCurrentPdf({ data: pdfData, nome: pdfNome });
    setShowPdfModal(true);
  };

  const chiudiPdfModal = () => {
    setShowPdfModal(false);
    setCurrentPdf({ data: '', nome: '' });
  };

  const getColorClasses = (tipo) => {
    const colors = {
      comunicato: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', border: 'border-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
      general_info: { bg: 'bg-green-600', hover: 'hover:bg-green-700', border: 'border-green-500', light: 'bg-green-50', text: 'text-green-600' },
      paddock_info: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', border: 'border-amber-500', light: 'bg-amber-50', text: 'text-amber-600' }
    };
    return colors[tipo] || colors.comunicato;
  };

  const tipoConfig = TIPI_DOC[tipoAttivo];
  const colorClasses = getColorClasses(tipoAttivo);
  const documentiAttivi = documenti[tipoAttivo] || [];
  const statsAttive = stats[tipoAttivo];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className={`bg-gradient-to-r ${tipoAttivo === 'comunicato' ? 'from-purple-600 via-blue-600 to-indigo-700' : tipoAttivo === 'general_info' ? 'from-green-600 via-emerald-600 to-teal-700' : 'from-amber-500 via-orange-500 to-yellow-600'} text-white px-8 py-6 rounded-lg shadow-xl mb-6`}>
        <div className="flex items-center gap-4">
          <MessageSquare className="w-12 h-12" />
          <div>
            <h1 className="text-3xl font-bold">Bacheca Documenti</h1>
            <p className="text-purple-100 mt-1">Direzione Gara → Piloti</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {Object.entries(TIPI_DOC).map(([tipo, config]) => {
          const Icon = config.icon;
          const isActive = tipoAttivo === tipo;
          const cols = getColorClasses(tipo);
          return (
            <button
              key={tipo}
              onClick={() => setTipoAttivo(tipo)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all ${
                isActive 
                  ? `${cols.bg} text-white shadow-lg` 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              {config.label}
              {documenti[tipo]?.length > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-gray-400 text-white'}`}>
                  {documenti[tipo].length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats Bar */}
      {statsAttive && (
        <div className={`bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 ${colorClasses.border}`}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className={`text-3xl font-bold ${colorClasses.text}`}>{statsAttive.totale_comunicati}</div>
              <div className="text-sm text-gray-600">{tipoConfig.label} Totali</div>
            </div>
            <div>
              <div className={`text-3xl font-bold ${colorClasses.text}`}>#{statsAttive.ultimo_numero || 0}</div>
              <div className="text-sm text-gray-600">Ultimo Numero</div>
            </div>
            <div>
              <div className={`text-3xl font-bold ${colorClasses.text}`}>{statsAttive.piloti_attivi || 0}</div>
              <div className="text-sm text-gray-600">Piloti Attivi</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Nuovo Documento */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Send className={`w-5 h-5 ${colorClasses.text}`} />
              Nuovo {tipoConfig.label}
            </h2>

            <form onSubmit={creaDocumento} className="space-y-4">
              {/* Codice Gara */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Codice Gara
                </label>
                <input
                  type="text"
                  value={codiceGara}
                  onChange={(e) => setCodiceGara(e.target.value.toUpperCase())}
                  placeholder="es. 303-1"
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:${colorClasses.border} focus:ring-2 focus:ring-blue-200`}
                  maxLength={20}
                />
                
                {gareRecenti.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gareRecenti.map(gara => (
                      <button
                        key={gara}
                        type="button"
                        onClick={() => setCodiceGara(gara)}
                        className={`px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:${colorClasses.light} hover:${colorClasses.text} transition-colors`}
                      >
                        {gara}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selezione Gare Destinatarie */}
              {gareCollegate.length > 1 && (
                <div className={`${colorClasses.light} border ${colorClasses.border} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <label className={`block text-sm font-bold ${colorClasses.text}`}>
                      📨 Invia a:
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selezionaTutte}
                        className={`text-xs px-2 py-1 ${colorClasses.bg} text-white rounded ${colorClasses.hover}`}
                      >
                        Tutte
                      </button>
                      <button
                        type="button"
                        onClick={deselezionaTutte}
                        className="text-xs px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                      >
                        Nessuna
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gareCollegate.map(gara => (
                      <label
                        key={gara}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          gareSelezionate.includes(gara)
                            ? `${colorClasses.bg} text-white`
                            : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={gareSelezionate.includes(gara)}
                          onChange={() => toggleGaraSelezionata(gara)}
                          className="sr-only"
                        />
                        <span className="font-medium text-sm">{gara}</span>
                        {gareSelezionate.includes(gara) && (
                          <span className="text-xs">✓</span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className={`text-xs ${colorClasses.text} mt-2`}>
                    {gareSelezionate.length} di {gareCollegate.length} gare selezionate
                  </p>
                </div>
              )}

              {/* Testo Documento */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Testo {tipoConfig.label}
                </label>
                <textarea
                  value={testoDocumento}
                  onChange={(e) => setTestoDocumento(e.target.value)}
                  placeholder={`Scrivi ${tipoConfig.label.toLowerCase()}...`}
                  rows={6}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
                  maxLength={500}
                />
                <div className="text-right text-sm text-gray-500 mt-1">
                  {testoDocumento.length} / 500
                </div>
              </div>

              {/* Upload PDF */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Allegato PDF (opzionale)
                </label>
                {!pdfFile ? (
                  <label 
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:${colorClasses.border} hover:${colorClasses.light} transition-colors`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handlePdfChange({ target: { files: [file] } });
                    }}
                  >
                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Clicca o trascina PDF</p>
                    <p className="text-xs text-gray-500 mt-1">Max 10MB</p>
                    <input type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{pdfFileName}</p>
                        <p className="text-xs text-gray-600">PDF allegato</p>
                      </div>
                    </div>
                    <button type="button" onClick={rimuoviPdf} className="p-2 text-red-600 hover:bg-red-100 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !codiceGara || !testoDocumento.trim() || gareSelezionate.length === 0}
                className={`w-full ${colorClasses.bg} text-white font-bold py-3 px-6 rounded-lg ${colorClasses.hover} disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2`}
              >
                <Send className="w-5 h-5" />
                {loading ? 'Invio...' : gareSelezionate.length > 1 
                  ? `Invia a ${gareSelezionate.length} Gare`
                  : `Invia ${tipoConfig.label}`}
              </button>
            </form>
          </div>
        </div>

        {/* Lista Documenti */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">
            Storico {tipoConfig.label} {codiceGara && `- ${codiceGara}`}
          </h2>

          {loading && documentiAttivi.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Caricamento...</div>
          ) : documentiAttivi.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {codiceGara ? `Nessun ${tipoConfig.label.toLowerCase()} per questa gara` : 'Inserisci un codice gara per vedere i documenti'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documentiAttivi.map((doc) => (
                <div key={doc.id} className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-l-4 ${colorClasses.border}`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`${colorClasses.bg} text-white font-bold px-4 py-2 rounded-lg text-lg`}>
                          {tipoConfig.prefix} #{doc.numero}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{new Date(doc.data).toLocaleDateString('it-IT')}</div>
                          <div>{doc.ora}</div>
                        </div>
                      </div>

                      {editingId === doc.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => salvaDocumento(doc.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Salva">
                            <Save className="w-5 h-5" />
                          </button>
                          <button onClick={annullaModifica} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Annulla">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => iniziaModifica(doc)} className={`p-2 ${colorClasses.text} hover:${colorClasses.light} rounded-lg`} title="Modifica">
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => eliminaDocumento(doc.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Elimina">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === doc.id ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className={`w-full px-4 py-2 border-2 ${colorClasses.border} rounded-lg focus:ring-2 focus:ring-blue-200 resize-none`}
                        rows={4}
                        maxLength={500}
                      />
                    ) : (
                      <div>
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{doc.testo}</p>
                        
                        {doc.pdf_allegato && (
                          <button
                            onClick={() => apriPdfModal(doc.pdf_allegato, doc.pdf_nome)}
                            className={`inline-flex items-center gap-2 mt-4 px-4 py-2 ${colorClasses.light} border ${colorClasses.border} ${colorClasses.text} rounded-lg hover:bg-opacity-75 transition-colors font-medium`}
                          >
                            <FileText className="w-5 h-5" />
                            {doc.pdf_nome || 'Allegato.pdf'}
                          </button>
                        )}
                      </div>
                    )}

                    {doc.letto_da && doc.letto_da.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          ✓ Letto da {doc.letto_da.length} piloti
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal PDF Viewer */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={chiudiPdfModal}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-bold text-gray-800">{currentPdf.nome || 'Documento.pdf'}</h3>
              </div>
              <div className="flex gap-2">
                <a
                  href={`data:application/pdf;base64,${currentPdf.data}`}
                  download={currentPdf.nome || 'allegato.pdf'}
                  className={`px-4 py-2 ${colorClasses.bg} text-white rounded-lg ${colorClasses.hover} font-medium`}
                >
                  Scarica
                </a>
                <button onClick={chiudiPdfModal} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={`data:application/pdf;base64,${currentPdf.data}`} className="w-full h-full border-0" title="PDF Viewer" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
