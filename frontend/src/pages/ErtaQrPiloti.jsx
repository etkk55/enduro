import { useEffect, useState } from 'react';
import { API_BASE } from '../services/api';
import { pickDefaultEvent, setActiveEventId } from '../utils/activeEvent';
import { Card } from '../components/ui/Card';
import { Select, Label } from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Smartphone, Printer, ExternalLink, QrCode } from 'lucide-react';

const ERTA_URL = 'https://enduro-erta.vercel.app';

export default function ErtaQrPiloti() {
  const [eventi, setEventi] = useState([]);
  const [eventoId, setEventoId] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(r => r.json())
      .then(data => {
        setEventi(data);
        if (data.length > 0) {
          const id = pickDefaultEvent(data);
          setEventoId(id);
          const ev = data.find(e => e.id === id);
          if (ev) setActiveEventId(id, ev.codice_gara);
        }
      });
  }, []);

  const evento = eventi.find(e => e.id === eventoId);
  const codiceAccesso = evento?.codice_accesso_pubblico || evento?.codice_gara || '';
  const ertaUrl = codiceAccesso ? `${ERTA_URL}/?g=${encodeURIComponent(codiceAccesso)}` : ERTA_URL;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=2&ecc=H&data=${encodeURIComponent(ertaUrl)}`;

  function handlePrint() {
    if (!evento) return;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const dataFmt = evento.data_inizio
      ? new Date(evento.data_inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';

    const html = `<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8">
<title>QR ERTA Piloti — ${esc(evento.nome_evento || evento.codice_gara)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, system-ui, Arial, sans-serif; color: #111; }
  body { display: flex; flex-direction: column; min-height: calc(297mm - 24mm); }

  .header {
    display: flex; align-items: center; gap: 14px;
    padding-bottom: 10mm;
    border-bottom: 0.5mm solid #dc2626;
  }
  .header img { width: 18mm; height: 18mm; object-fit: contain; }
  .header .title {
    font-size: 18pt; font-weight: 900; color: #dc2626; letter-spacing: 0.3px; line-height: 1.05;
  }
  .header .sub { font-size: 10pt; color: #555; margin-top: 1mm; }

  .event-card {
    margin-top: 6mm;
    padding: 5mm 6mm;
    background: #fef2f2;
    border: 0.3mm solid #fca5a5;
    border-radius: 2mm;
  }
  .event-name { font-size: 14pt; font-weight: 800; color: #111; }
  .event-meta { font-size: 9.5pt; color: #555; margin-top: 1mm; }
  .event-code {
    display: inline-block;
    margin-top: 2mm;
    padding: 1mm 3mm;
    background: #111; color: #fff;
    border-radius: 1.5mm;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 11pt; font-weight: 700; letter-spacing: 0.5px;
  }

  .main {
    display: grid;
    grid-template-columns: 62mm 1fr;
    gap: 8mm;
    margin-top: 7mm;
    align-items: start;
  }

  .qr-block { text-align: center; }
  .qr-box {
    display: inline-block;
    padding: 3mm;
    background: #fff;
    border: 0.5mm solid #dc2626;
    border-radius: 2mm;
  }
  .qr-box img { width: 56mm; height: 56mm; display: block; }
  .qr-label {
    margin-top: 2mm;
    font-size: 10pt; font-weight: 800; color: #dc2626;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .qr-url {
    margin-top: 1mm;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 7pt; color: #666;
    word-break: break-all;
  }

  .steps h2 {
    margin: 0 0 3mm;
    font-size: 12pt; font-weight: 800;
    color: #dc2626;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .steps ol {
    margin: 0; padding-left: 5mm;
    font-size: 10pt; line-height: 1.5;
  }
  .steps li { margin-bottom: 1.5mm; }
  .steps li b { color: #111; }

  .features {
    margin-top: 8mm;
    padding: 5mm 6mm;
    background: #f3f4f6;
    border-radius: 2mm;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3mm 8mm;
    font-size: 9.5pt;
    color: #222;
  }
  .features h3 {
    grid-column: span 2;
    margin: 0 0 2mm;
    font-size: 11pt; font-weight: 800; color: #111;
  }
  .features div { display: flex; align-items: flex-start; gap: 2mm; }
  .features div::before { content: '✓'; color: #16a34a; font-weight: 900; }

  .tips {
    margin-top: 6mm;
    padding: 4mm 5mm;
    background: #fffbeb;
    border-left: 1mm solid #f59e0b;
    border-radius: 1.5mm;
    font-size: 9pt; color: #78350f;
  }
  .tips b { color: #92400e; }

  .footer {
    margin-top: auto; padding-top: 6mm;
    border-top: 0.3mm dashed #ccc;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8pt; color: #888;
  }

  @media print { .no-print { display: none !important; } }
</style>
</head><body>
  <div class="header">
    <img src="/fmi-logo.png" alt="FMI" onerror="this.style.display='none'" />
    <div>
      <div class="title">ERTA — App Pilota</div>
      <div class="sub">Enduro Race-Time Assistant · Federazione Motociclistica Italiana</div>
    </div>
  </div>

  <div class="event-card">
    <div class="event-name">${esc(evento.nome_evento || evento.codice_gara)}</div>
    <div class="event-meta">
      ${dataFmt ? `📅 ${esc(dataFmt)}` : ''}
      ${evento.luogo ? ` &nbsp;·&nbsp; 📍 ${esc(evento.luogo)}` : ''}
    </div>
    ${codiceAccesso ? `<div class="event-code">Codice gara: ${esc(codiceAccesso)}</div>` : ''}
  </div>

  <div class="main">
    <div class="qr-block">
      <div class="qr-box"><img src="${qrSrc}" alt="QR ERTA" /></div>
      <div class="qr-label">Inquadra il QR<br/>con la fotocamera</div>
      <div class="qr-url">${esc(ertaUrl)}</div>
    </div>

    <div class="steps">
      <h2>Come attivare ERTA sul tuo telefono</h2>
      <ol>
        <li><b>Inquadra il QR</b> qui a sinistra con la fotocamera del telefono e tocca la notifica che compare.</li>
        <li>Si apre l'app web ERTA ${codiceAccesso ? 'con il <b>codice gara già precompilato</b>' : 'con il form di login'}. Inserisci la tua <b>Licenza FMI</b> e conferma.</li>
        <li>Al primo avvio consenti <b>Posizione</b> (sempre) e <b>Notifiche</b>: servono per il tracciamento GPS e per ricevere comunicazioni dalla DdG.</li>
        <li><b>Aggiungi ERTA alla schermata Home</b>:
          <br/>• iPhone Safari: tocca l'icona <b>Condividi</b> → <b>Aggiungi a Home</b>
          <br/>• Android Chrome: i tre puntini → <b>Aggiungi a schermata Home</b>
        </li>
        <li>Apri l'app dall'icona sul telefono: il login resta salvato, non servirà ri-scansionare il QR.</li>
      </ol>
    </div>
  </div>

  <div class="features">
    <h3>Cosa puoi fare con ERTA</h3>
    <div>Vedere i tuoi <b>tempi live</b> dopo ogni prova speciale</div>
    <div>Confrontarti con gli <b>amici e compagni di squadra</b></div>
    <div>Ricevere <b>comunicati ufficiali</b> della Direzione Gara</div>
    <div>Inviare un <b>SOS con GPS</b> in caso di incidente o guasto</div>
    <div>Consultare <b>programma gara</b>, iscritti e classifiche</div>
    <div>Visualizzare la <b>mappa del tracciato</b> GPX</div>
  </div>

  <div class="tips">
    <b>⚠️ Importante</b> · Tieni il telefono con te durante la gara, con la batteria carica. Il GPS viene inviato automaticamente per la tua sicurezza. Se perdi il segnale, la Direzione Gara riceverà un avviso e potrà intervenire rapidamente.
  </div>

  <div class="footer">
    <span>ERTA · enduro-erta.vercel.app</span>
    <span>Generato ${new Date().toLocaleString('it-IT')}</span>
  </div>

  <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Il browser ha bloccato la stampa. Consenti i popup per questo sito.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
          <QrCode className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-heading-1">QR ERTA per i Piloti</h1>
          <p className="text-sm text-content-secondary mt-0.5">Genera e stampa il volantino con QR e istruzioni per far attivare ERTA ai piloti iscritti all'evento.</p>
        </div>
      </header>

      <Card className="mb-5">
        <div className="p-4">
          <Label>Evento</Label>
          <Select value={eventoId} onChange={(e) => {
            setEventoId(e.target.value);
            const ev = eventi.find(x => x.id === e.target.value);
            if (ev) setActiveEventId(e.target.value, ev.codice_gara);
          }}>
            {eventi.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.nome_evento} — {new Date(ev.data_inizio).toLocaleDateString('it-IT')}
              </option>
            ))}
          </Select>
          {evento && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-content-tertiary">Codice gara:</span>
                <code className="font-mono bg-surface-2 px-2 py-0.5 rounded font-bold">{codiceAccesso || '—'}</code>
              </div>
              <div className="flex items-center gap-2 break-all">
                <span className="text-content-tertiary">URL ERTA:</span>
                <a href={ertaUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-brand-600 hover:underline flex items-center gap-1 text-xs">
                  {ertaUrl} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </Card>

      {evento && (
        <Card className="mb-5">
          <div className="p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 p-3 bg-white border-2 border-rose-500 rounded-lg">
              <img src={qrSrc} alt="QR ERTA" className="w-56 h-56" />
            </div>
            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 justify-center md:justify-start">
                  <Smartphone className="w-5 h-5 text-rose-600" /> Anteprima QR pilota
                </h2>
                <p className="text-sm text-content-secondary mt-1">Il QR porta alla pagina di login ERTA con il codice gara <b>{codiceAccesso}</b> già precompilato. Il pilota dovrà solo inserire la sua Licenza FMI.</p>
              </div>
              <div className="flex gap-2 justify-center md:justify-start">
                <Button variant="primary" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
                  Stampa volantino A4
                </Button>
                <Button variant="secondary" leftIcon={<ExternalLink className="w-4 h-4" />} onClick={() => window.open(ertaUrl, '_blank')}>
                  Apri ERTA
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2">Cosa contiene il volantino A4</h3>
          <ul className="text-sm text-content-secondary space-y-1 list-disc pl-5">
            <li>Header con logo FMI e titolo "ERTA — App Pilota"</li>
            <li>Box evento con nome, data, luogo e <b>codice gara evidenziato</b></li>
            <li>QR code grande (≈56mm) con URL pre-compilato</li>
            <li>5 passi numerati per l'attivazione (scansione, login, permessi, Home, uso)</li>
            <li>Elenco funzionalità ("Cosa puoi fare con ERTA")</li>
            <li>Avviso sulla sicurezza GPS</li>
          </ul>
          <p className="text-xs text-content-tertiary mt-3">Suggerimento: stampa una copia e attaccala sulla bacheca del paddock, oppure distribuiscila ai piloti iscritti via email / stampa al briefing.</p>
        </div>
      </Card>
    </div>
  );
}
