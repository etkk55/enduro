import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Edit2, Save, X, FileText, Upload, Info, ParkingSquare } from 'lucide-react';
import { API_BASE as API_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input, { Label } from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { cn } from '../components/ui/utils';

const TIPI_DOC = {
  comunicato:   { label: 'Comunicati',   icon: MessageSquare,   prefix: 'COM', variant: 'brand'   },
  general_info: { label: 'General Info', icon: Info,            prefix: 'GEN', variant: 'success' },
  paddock_info: { label: 'Paddock Info', icon: ParkingSquare,   prefix: 'PAD', variant: 'warning' },
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
    if (saved) setGareRecenti(JSON.parse(saved));
    // Precarica il codice gara dall'evento attivo condiviso
    import('../utils/activeEvent').then(({ getActiveCodiceGara }) => {
      const cod = getActiveCodiceGara();
      if (cod && !codiceGara) setCodiceGara(cod);
    });
  }, []);

  useEffect(() => {
    if (codiceGara) {
      loadAllDocumenti();
      loadGareCollegate();
    } else {
      setDocumenti({ comunicato: [], general_info: [], paddock_info: [] });
      setStats({ comunicato: null, general_info: null, paddock_info: null });
      setGareCollegate([]); setGareSelezionate([]);
    }
  }, [codiceGara]);

  async function loadGareCollegate() {
    if (!codiceGara.includes('-')) {
      setGareCollegate([codiceGara]);
      setGareSelezionate([codiceGara]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/ddg/multi/${codiceGara}`);
      const data = await res.json();
      const codici = data.success && data.eventi?.length > 0
        ? data.eventi.map(e => e.codice_gara)
        : [codiceGara];
      setGareCollegate(codici);
      setGareSelezionate(codici);
    } catch {
      setGareCollegate([codiceGara]); setGareSelezionate([codiceGara]);
    }
  }

  const toggleGara = (c) => setGareSelezionate(prev => prev.includes(c) ? prev.filter(g => g !== c) : [...prev, c]);
  const salvaRecente = (c) => {
    if (!c) return;
    const nuove = [c, ...gareRecenti.filter(g => g !== c)].slice(0, 10);
    setGareRecenti(nuove);
    localStorage.setItem('gareRecentiComunicati', JSON.stringify(nuove));
  };

  function handlePdfChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Solo file PDF'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('PDF troppo grande (max 10MB)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPdfFile(ev.target.result.split(',')[1]); setPdfFileName(file.name); };
    reader.readAsDataURL(file);
  }

  async function loadAllDocumenti() {
    setLoading(true); setError('');
    try {
      const newDocs = { comunicato: [], general_info: [], paddock_info: [] };
      const newStats = { comunicato: null, general_info: null, paddock_info: null };
      for (const tipo of Object.keys(TIPI_DOC)) {
        const res = await fetch(`${API_URL}/api/comunicati/${codiceGara}?tipo=${tipo}`);
        const data = await res.json();
        if (data.success) newDocs[tipo] = data.comunicati || [];
        const sRes = await fetch(`${API_URL}/api/comunicati/${codiceGara}/stats?tipo=${tipo}`);
        const sData = await sRes.json();
        if (sData.success) newStats[tipo] = sData.stats;
      }
      setDocumenti(newDocs); setStats(newStats);
    } catch { setError('Errore di connessione'); } finally { setLoading(false); }
  }

  async function creaDocumento(e) {
    e.preventDefault();
    if (!codiceGara || !testoDocumento.trim()) { setError('Compila tutti i campi'); return; }
    if (gareSelezionate.length === 0) { setError('Seleziona almeno una gara'); return; }
    setLoading(true); setError('');
    try {
      let successi = 0, errori = [];
      for (const gara of gareSelezionate) {
        const body = { codice_gara: gara, testo: testoDocumento, tipo: tipoAttivo };
        if (pdfFile) { body.pdf_allegato = pdfFile; body.pdf_nome = pdfFileName; }
        try {
          const res = await fetch(`${API_URL}/api/comunicati`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (data.success) successi++; else errori.push(gara);
        } catch { errori.push(gara); }
      }
      if (successi > 0) {
        setTestoDocumento(''); setPdfFile(null); setPdfFileName('');
        salvaRecente(codiceGara);
        loadAllDocumenti();
        if (errori.length > 0) alert(`Inviato a ${successi} gare. Errore per: ${errori.join(', ')}`);
      } else setError('Errore invio');
    } catch { setError('Errore di connessione'); } finally { setLoading(false); }
  }

  async function eliminaDocumento(id) {
    if (!confirm('Eliminare questo documento?')) return;
    try {
      const res = await fetch(`${API_URL}/api/comunicati/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) loadAllDocumenti();
    } catch { alert('Errore'); }
  }

  async function salvaDocumento(id) {
    try {
      const res = await fetch(`${API_URL}/api/comunicati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: editText })
      });
      const data = await res.json();
      if (data.success) { setEditingId(null); setEditText(''); loadAllDocumenti(); }
    } catch { alert('Errore'); }
  }

  const tipoConfig = TIPI_DOC[tipoAttivo];
  const documentiAttivi = documenti[tipoAttivo] || [];
  const statsAttive = stats[tipoAttivo];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-heading-1">Bacheca Documenti</h1>
        <p className="text-content-secondary mt-1 text-sm">Comunicazioni Direzione Gara → Piloti</p>
      </div>

      {/* Type tabs */}
      <div className="inline-flex bg-surface-2 rounded-md p-0.5 w-full lg:w-auto">
        {Object.entries(TIPI_DOC).map(([tipo, conf]) => {
          const Icon = conf.icon;
          const isActive = tipoAttivo === tipo;
          const count = documenti[tipo]?.length || 0;
          return (
            <button
              key={tipo}
              onClick={() => setTipoAttivo(tipo)}
              className={cn(
                'flex-1 lg:flex-initial h-10 px-4 rounded-sm text-sm font-semibold transition-all inline-flex items-center justify-center gap-2',
                isActive ? 'bg-surface shadow-sm text-content-primary' : 'text-content-secondary hover:text-content-primary'
              )}
            >
              <Icon className="w-4 h-4" />
              {conf.label}
              {count > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1.5 text-2xs font-bold',
                  isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-500 dark:text-white' : 'bg-surface-3 text-content-secondary'
                )}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      {statsAttive && (
        <div className="grid grid-cols-3 gap-3">
          <Card><div className="p-4"><div className="text-overline mb-1">{tipoConfig.label} totali</div><div className="text-2xl font-bold font-mono tabular-nums">{statsAttive.totale_comunicati || 0}</div></div></Card>
          <Card><div className="p-4"><div className="text-overline mb-1">Ultimo numero</div><div className="text-2xl font-bold font-mono tabular-nums">#{statsAttive.ultimo_numero || 0}</div></div></Card>
          <Card><div className="p-4"><div className="text-overline mb-1">Piloti attivi</div><div className="text-2xl font-bold font-mono tabular-nums">{statsAttive.piloti_attivi || 0}</div></div></Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <div className="lg:col-span-1">
          <Card>
            <div className="p-5 border-b border-border-subtle">
              <h2 className="text-heading-2 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Nuovo {tipoConfig.label}
              </h2>
            </div>
            <form onSubmit={creaDocumento} className="p-5 space-y-4">
              <div>
                <Label required>Codice Gara</Label>
                <Input
                  value={codiceGara}
                  onChange={(e) => setCodiceGara(e.target.value.toUpperCase())}
                  placeholder="es. 303-1"
                  maxLength={20}
                />
                {gareRecenti.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {gareRecenti.map(g => (
                      <button
                        key={g} type="button"
                        onClick={() => setCodiceGara(g)}
                        className="inline-flex items-center h-6 px-2 rounded-md bg-surface-2 hover:bg-surface-3 text-xs font-mono text-content-secondary hover:text-content-primary transition-colors"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {gareCollegate.length > 1 && (
                <div className="bg-brand-50 dark:bg-brand-100/20 border border-brand-100 dark:border-brand-500/30 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="!mb-0">Invia a</Label>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setGareSelezionate([...gareCollegate])} className="text-2xs font-semibold text-brand-600 dark:text-brand-500 hover:underline">Tutte</button>
                      <span className="text-content-tertiary">·</span>
                      <button type="button" onClick={() => setGareSelezionate([])} className="text-2xs font-semibold text-content-tertiary hover:text-content-primary">Nessuna</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {gareCollegate.map(g => {
                      const on = gareSelezionate.includes(g);
                      return (
                        <button
                          key={g} type="button" onClick={() => toggleGara(g)}
                          className={cn(
                            'inline-flex items-center h-7 px-2.5 rounded-md text-xs font-mono font-semibold transition-colors',
                            on ? 'bg-brand-600 text-white' : 'bg-surface border border-border text-content-secondary hover:border-brand-500'
                          )}
                        >{g}</button>
                      );
                    })}
                  </div>
                  <p className="text-2xs text-content-tertiary mt-2">
                    {gareSelezionate.length} di {gareCollegate.length} gare selezionate
                  </p>
                </div>
              )}

              <div>
                <Label>Testo</Label>
                <textarea
                  value={testoDocumento}
                  onChange={(e) => setTestoDocumento(e.target.value)}
                  placeholder={`Scrivi ${tipoConfig.label.toLowerCase()}…`}
                  rows={5}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-content-primary placeholder:text-content-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <div className="text-right text-2xs text-content-tertiary mt-1 font-mono tabular-nums">
                  {testoDocumento.length} / 500
                </div>
              </div>

              <div>
                <Label>Allegato PDF (opzionale)</Label>
                {!pdfFile ? (
                  <label
                    className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-brand-500 hover:bg-surface-2 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePdfChange({ target: { files: [f] } }); }}
                  >
                    <Upload className="w-6 h-6 text-content-tertiary mb-1.5" />
                    <p className="text-xs font-medium text-content-secondary">Clicca o trascina PDF</p>
                    <p className="text-2xs text-content-tertiary mt-0.5">Max 10MB</p>
                    <input type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-success-bg border border-success-border rounded-md">
                    <FileText className="w-5 h-5 text-success-fg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate text-success-fg">{pdfFileName}</p>
                      <p className="text-2xs text-success-fg/70">PDF allegato</p>
                    </div>
                    <button type="button" onClick={() => { setPdfFile(null); setPdfFileName(''); }} className="p-1 text-danger-fg hover:bg-danger-bg rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-danger-bg border border-danger-border text-danger-fg px-3 py-2 rounded-md text-xs">
                  {error}
                </div>
              )}

              <Button
                type="submit" size="lg" className="w-full"
                disabled={loading || !codiceGara || !testoDocumento.trim() || gareSelezionate.length === 0}
                loading={loading}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {loading ? 'Invio…' : gareSelezionate.length > 1 ? `Invia a ${gareSelezionate.length} gare` : `Invia ${tipoConfig.label}`}
              </Button>
            </form>
          </Card>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-heading-2">Storico {codiceGara && <span className="text-content-tertiary font-normal font-mono">· {codiceGara}</span>}</h2>
          </div>

          {loading && documentiAttivi.length === 0 ? (
            <Card><div className="p-8 text-center text-content-secondary text-sm">Caricamento…</div></Card>
          ) : documentiAttivi.length === 0 ? (
            <Card>
              <EmptyState
                icon={tipoConfig.icon}
                title={codiceGara ? `Nessun ${tipoConfig.label.toLowerCase()}` : 'Inserisci un codice gara'}
                description={codiceGara ? 'Crea il primo documento dal form a sinistra.' : 'Per visualizzare i documenti serve un codice gara.'}
              />
            </Card>
          ) : (
            documentiAttivi.map(doc => (
              <Card key={doc.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={tipoConfig.variant} size="md" className="font-mono">
                        {tipoConfig.prefix} · {String(doc.numero).padStart(3, '0')}
                      </Badge>
                      <span className="text-xs text-content-tertiary font-mono tabular-nums">
                        {new Date(doc.data).toLocaleDateString('it-IT')} · {doc.ora}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {editingId === doc.id ? (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => salvaDocumento(doc.id)} aria-label="Salva">
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => { setEditingId(null); setEditText(''); }} aria-label="Annulla">
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => { setEditingId(doc.id); setEditText(doc.testo); }} aria-label="Modifica">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => eliminaDocumento(doc.id)} aria-label="Elimina" className="text-danger-fg">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === doc.id ? (
                    <textarea
                      value={editText} onChange={(e) => setEditText(e.target.value)}
                      rows={4} maxLength={500}
                      className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                  ) : (
                    <>
                      <p className="text-sm text-content-primary whitespace-pre-wrap leading-relaxed">{doc.testo}</p>
                      {doc.pdf_allegato && (
                        <button
                          onClick={() => { setCurrentPdf({ data: doc.pdf_allegato, nome: doc.pdf_nome }); setShowPdfModal(true); }}
                          className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-md bg-surface-2 hover:bg-surface-3 text-xs font-medium text-content-secondary hover:text-content-primary transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {doc.pdf_nome || 'Allegato.pdf'}
                        </button>
                      )}
                    </>
                  )}
                  {doc.letto_da && doc.letto_da.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <Badge variant="success" size="sm">Letto da {doc.letto_da.length} piloti</Badge>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowPdfModal(false)}>
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 h-14 border-b border-border-subtle">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-content-secondary" />
                <h3 className="text-sm font-semibold truncate">{currentPdf.nome || 'Documento.pdf'}</h3>
              </div>
              <div className="flex gap-2">
                <Button as="a" size="sm" variant="primary">
                  <a href={`data:application/pdf;base64,${currentPdf.data}`} download={currentPdf.nome || 'allegato.pdf'}>Scarica</a>
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowPdfModal(false)} aria-label="Chiudi">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={`data:application/pdf;base64,${currentPdf.data}`} className="w-full h-full border-0" title="PDF" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
