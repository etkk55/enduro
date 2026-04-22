import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MessageSquare, MapPin, Check, CheckCheck, Volume2, VolumeX, RefreshCw, ExternalLink, Clock, Radio, SignalZero, Trash2 } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { API_BASE } from '../services/api';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Select, Label } from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import LiveDot from '../components/ui/LiveDot';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { cn } from '../components/ui/utils';

const TIPO_META = {
  sos:        { label: 'Emergenza SOS', variant: 'danger',  icon: AlertTriangle },
  pericolo:   { label: 'Pericolo',       variant: 'warning', icon: AlertTriangle },
  assistenza: { label: 'Assistenza',     variant: 'info',    icon: MessageSquare },
  info:       { label: 'Info',           variant: 'info',    icon: MessageSquare },
  altro:      { label: 'Messaggio',      variant: 'neutral', icon: MessageSquare },
};

export default function MessaggiPiloti() {
  const [eventi, setEventi] = useState([]);
  const [selectedEvento, setSelectedEvento] = useState('');
  const [codiceGara, setCodiceGara] = useState('');
  const [messaggi, setMessaggi] = useState([]);
  const [filtro, setFiltro] = useState('tutti');
  const [stats, setStats] = useState({ non_letti: 0, sos_attivi: 0 });
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lastSosCount, setLastSosCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const audioRef = useRef(null);
  const pollingRef = useRef(null);

  const [pilotiFermi, setPilotiFermi] = useState([]);
  const [pilotiSegnalePerso, setPilotiSegnalePerso] = useState([]);
  const [piloti, setPiloti] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(r => r.json())
      .then(setEventi)
      .catch(err => console.error('[MessaggiPiloti]', err));
  }, []);

  useEffect(() => {
    if (selectedEvento) {
      const ev = eventi.find(e => e.id === selectedEvento);
      if (ev) setCodiceGara(ev.codice_gara);
    }
  }, [selectedEvento, eventi]);

  useEffect(() => {
    if (codiceGara) {
      loadMessaggi();
      pollingRef.current = setInterval(loadMessaggi, 10000);
      return () => clearInterval(pollingRef.current);
    }
  }, [codiceGara]);

  useEffect(() => {
    if (selectedEvento) {
      loadPilotiEvento();
      loadPilotiFermi();
      const i = setInterval(loadPilotiFermi, 30000);
      return () => clearInterval(i);
    } else {
      setPilotiFermi([]); setPilotiSegnalePerso([]); setPiloti([]);
    }
  }, [selectedEvento]);

  async function loadPilotiEvento() {
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${selectedEvento}/piloti`);
      const data = await res.json();
      setPiloti(data || []);
    } catch (err) { console.error('[MessaggiPiloti]', err); }
  }

  async function loadPilotiFermi() {
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${selectedEvento}/piloti-fermi`);
      const data = await res.json();
      if (data.success) {
        setPilotiFermi(data.piloti_fermi || []);
        setPilotiSegnalePerso(data.piloti_segnale_perso || []);
        if ((data.piloti_fermi?.length > 0 || data.piloti_segnale_perso?.length > 0) && audioEnabled) {
          playAlarm();
        }
      }
    } catch (err) { console.error('[MessaggiPiloti]', err); }
  }

  const getPilotaInfo = (numero) => {
    const p = piloti.find(p => p.numero_gara === numero);
    return p ? `${p.cognome} ${p.nome}` : `Pilota #${numero}`;
  };

  async function loadMessaggi() {
    if (!codiceGara) return;
    try {
      const res = await fetch(`${API_BASE}/api/messaggi-piloti/${codiceGara}`);
      const data = await res.json();
      if (data.success) {
        setMessaggi(data.messaggi);
        setStats({ non_letti: data.non_letti, sos_attivi: data.sos_attivi });
        if (data.sos_attivi > lastSosCount && audioEnabled && lastSosCount > 0) playAlarm();
        setLastSosCount(data.sos_attivi);
        setLastSync(new Date());
      }
    } catch (err) { console.error('[MessaggiPiloti]', err); }
  }

  function playAlarm() {
    audioRef.current?.play().catch(() => {});
  }

  async function segnaLetto(id) {
    try {
      await fetch(`${API_BASE}/api/messaggi-piloti/${id}/letto`, { method: 'PATCH' });
      loadMessaggi();
    } catch (err) { console.error(err); }
  }

  async function segnaTuttiLetti() {
    try {
      await fetch(`${API_BASE}/api/messaggi-piloti/${codiceGara}/letti-tutti`, { method: 'PATCH' });
      loadMessaggi();
    } catch (err) { console.error(err); }
  }

  async function eliminaMessaggio(id) {
    if (!confirm('Eliminare definitivamente questo messaggio?')) return;
    try {
      await fetch(`${API_BASE}/api/messaggi-piloti/${id}`, { method: 'DELETE' });
      toast({ title: 'Messaggio eliminato', variant: 'success', duration: 2000 });
      loadMessaggi();
    } catch (err) { console.error(err); toast({ title: 'Errore eliminazione', variant: 'danger' }); }
  }

  async function eliminaBulk(stato) {
    const label = stato === 'letti' ? 'i messaggi già LETTI' : 'TUTTI i messaggi (letti e non letti)';
    if (!confirm(`Eliminare definitivamente ${label} di ${codiceGara}? L'operazione non è reversibile.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/messaggi-piloti/codice/${encodeURIComponent(codiceGara)}?stato=${stato}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast({ title: `${data.deleted} messaggi eliminati`, variant: 'success', duration: 2500 });
        loadMessaggi();
      } else {
        toast({ title: 'Errore eliminazione bulk', variant: 'danger' });
      }
    } catch (err) { console.error(err); toast({ title: 'Errore di rete', variant: 'danger' }); }
  }

  const messaggiFiltrati = messaggi.filter(m =>
    filtro === 'sos' ? m.tipo === 'sos' :
    filtro === 'non_letti' ? !m.letto :
    true
  );

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (ts) => new Date(ts).toLocaleDateString('it-IT');

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in space-y-4">
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19teleGm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+al4yFgX59foKHj5GQi4eCfXx8fYGFiImIhYJ/fX19foGEhoeGhIKAfn5+f4GDhYWFg4KAf39/gIGChYWFhIOBgIB/gIGCg4SEhIOCgYCAf4GBgoODg4ODgoGBgICAgYGCgoKCgoKBgYGAgIGBgoKCgoKCgYGBgIGBgYKCgoKCgYGBgYCBgYGCgoKCgoGBgYGAgYGBgoKCgoKBgYGBgIGBgYKCgoKCgYGBgYCBgYGCgoKCgoGBgYGAgYGBgoKCgoKBgYGBgA==" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-heading-1">Messaggi Piloti</h1>
          <p className="text-content-secondary text-sm mt-1 flex items-center gap-2">
            {codiceGara ? (
              <>
                <LiveDot tone="success" size="sm" />
                Aggiornamento ogni 10s{lastSync && ` · ${lastSync.toLocaleTimeString('it-IT')}`}
              </>
            ) : (
              'Seleziona un evento per iniziare'
            )}
          </p>
        </div>

        {/* SOS alert pill */}
        {stats.sos_attivi > 0 && (
          <div className="bg-danger-bg text-danger-fg border border-danger-border rounded-lg px-4 py-2.5 flex items-center gap-3">
            <LiveDot tone="danger" size="md" />
            <div>
              <div className="font-bold text-sm"><AnimatedNumber value={stats.sos_attivi} /> SOS attivi</div>
              <div className="text-xs opacity-80">Richieste emergenza in attesa</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><div className="p-4"><div className="text-overline mb-1">Totale</div><div className="text-2xl font-bold font-mono tabular-nums"><AnimatedNumber value={messaggi.length} /></div></div></Card>
        <Card><div className="p-4"><div className="text-overline mb-1">Non letti</div><div className={cn("text-2xl font-bold font-mono tabular-nums", stats.non_letti > 0 && "text-warning-fg")}><AnimatedNumber value={stats.non_letti} /></div></div></Card>
        <Card><div className="p-4"><div className="text-overline mb-1">SOS attivi</div><div className={cn("text-2xl font-bold font-mono tabular-nums", stats.sos_attivi > 0 && "text-danger-fg")}><AnimatedNumber value={stats.sos_attivi} /></div></div></Card>
        <Card><div className="p-4"><div className="text-overline mb-1">Piloti fermi</div><div className={cn("text-2xl font-bold font-mono tabular-nums", (pilotiFermi.length + pilotiSegnalePerso.length) > 0 && "text-warning-fg")}><AnimatedNumber value={pilotiFermi.length + pilotiSegnalePerso.length} /></div></div></Card>
      </div>

      {/* Filters & controls */}
      <Card>
        <div className="p-4 flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 min-w-0">
            <Label>Evento</Label>
            <Select value={selectedEvento} onChange={(e) => setSelectedEvento(e.target.value)}>
              <option value="">— Seleziona —</option>
              {eventi.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nome_evento} ({ev.codice_gara})</option>
              ))}
            </Select>
          </div>

          <div className="inline-flex bg-surface-2 rounded-md p-0.5 shrink-0">
            {[
              { key: 'tutti', label: `Tutti · ${messaggi.length}` },
              { key: 'sos', label: `SOS · ${messaggi.filter(m => m.tipo === 'sos').length}` },
              { key: 'non_letti', label: `Non letti · ${stats.non_letti}` }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={cn(
                  'h-8 px-3 rounded-sm text-xs font-semibold transition-colors',
                  filtro === f.key ? 'bg-surface text-content-primary shadow-sm' : 'text-content-secondary hover:text-content-primary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={audioEnabled ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setAudioEnabled(v => !v)}
              aria-label={audioEnabled ? 'Disattiva audio' : 'Attiva audio'}
              title={audioEnabled ? 'Audio attivo' : 'Audio disattivato'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={loadMessaggi} aria-label="Aggiorna">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {stats.non_letti > 0 && (
              <Button size="md" onClick={segnaTuttiLetti} leftIcon={<CheckCheck className="w-4 h-4" />}>
                Segna tutti letti
              </Button>
            )}
            {messaggi.length > 0 && (
              <>
                <Button size="md" variant="secondary" onClick={() => eliminaBulk('letti')} leftIcon={<Trash2 className="w-4 h-4" />}>
                  Elimina letti
                </Button>
                <Button size="md" variant="danger" onClick={() => eliminaBulk('tutti')} leftIcon={<Trash2 className="w-4 h-4" />}>
                  Elimina tutti
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* GPS signal lost alerts */}
      {pilotiSegnalePerso.length > 0 && (
        <Card className="border-danger-border bg-danger-bg/30">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <SignalZero className="w-5 h-5 text-danger-fg" />
              <h3 className="font-semibold text-danger-fg">Segnale GPS perso · {pilotiSegnalePerso.length}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {pilotiSegnalePerso.map((ps, i) => (
                <div key={i} className="bg-surface rounded-md p-3 border border-danger-border/50">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-content-primary text-sm">
                        <span className="font-mono text-danger-fg">#{ps.numero_pilota}</span> {getPilotaInfo(ps.numero_pilota)}
                      </div>
                      <div className="text-xs text-danger-fg mt-0.5">Nessun segnale da {ps.minuti_senza_segnale} min</div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => window.open(`https://www.google.com/maps?q=${ps.lat},${ps.lon}`, '_blank')} aria-label="Ultima posizione">
                      <MapPin className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Piloti fermi */}
      {pilotiFermi.length > 0 && (
        <Card className="border-warning-border bg-warning-bg/30">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-warning-fg" />
              <h3 className="font-semibold text-warning-fg">Piloti fermi fuori paddock · {pilotiFermi.length}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {pilotiFermi.map((pf, i) => (
                <div key={i} className="bg-surface rounded-md p-3 border border-warning-border/50">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-content-primary text-sm">
                        <span className="font-mono text-warning-fg">#{pf.numero_pilota}</span> {getPilotaInfo(pf.numero_pilota)}
                      </div>
                      <div className="text-xs text-warning-fg mt-0.5">Fermo da {pf.minuti_fermo} min</div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => window.open(`https://www.google.com/maps?q=${pf.lat},${pf.lon}`, '_blank')} aria-label="Mappa">
                      <MapPin className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Messages list */}
      {!codiceGara ? (
        <Card>
          <EmptyState
            icon={Radio}
            title="Seleziona un evento"
            description="Scegli l'evento in alto per vedere i messaggi dei piloti in diretta."
          />
        </Card>
      ) : messaggiFiltrati.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title={filtro !== 'tutti' ? 'Nessun messaggio con questo filtro' : 'Nessun messaggio ricevuto'}
            description={filtro !== 'tutti' ? 'Prova a rimuovere il filtro per vedere tutti.' : 'I messaggi dei piloti appariranno qui in tempo reale.'}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {messaggiFiltrati.map(msg => {
            const meta = TIPO_META[msg.tipo] || TIPO_META.altro;
            const Icon = meta.icon;
            return (
              <Card
                key={msg.id}
                className={cn(
                  'overflow-hidden transition-all',
                  msg.tipo === 'sos' && 'border-l-4 border-l-danger-fg',
                  msg.tipo === 'pericolo' && 'border-l-4 border-l-warning-fg',
                  !msg.letto && 'ring-1 ring-brand-500/30'
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-md flex items-center justify-center shrink-0',
                      msg.tipo === 'sos' && 'bg-danger-bg text-danger-fg',
                      msg.tipo === 'pericolo' && 'bg-warning-bg text-warning-fg',
                      (msg.tipo === 'assistenza' || msg.tipo === 'info') && 'bg-info-bg text-info-fg',
                      msg.tipo === 'altro' && 'bg-surface-2 text-content-secondary'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                          <span className="text-xs text-content-tertiary">
                            <span className="font-mono text-content-secondary">#{msg.numero_pilota}</span>
                            {' '}{msg.cognome} {msg.nome}
                            {msg.classe && <span className="ml-1 text-content-tertiary">· {msg.classe}</span>}
                          </span>
                        </div>
                        <span className="text-xs text-content-tertiary font-mono tabular-nums">
                          {formatTime(msg.created_at)} · {formatDate(msg.created_at)}
                        </span>
                      </div>

                      <p className="text-sm text-content-primary mt-2">{msg.testo}</p>

                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border-subtle flex-wrap">
                        {msg.gps_lat && msg.gps_lon ? (
                          <a
                            href={`https://www.google.com/maps?q=${msg.gps_lat},${msg.gps_lon}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-500 hover:underline font-mono"
                          >
                            <MapPin className="w-3 h-3" />
                            {parseFloat(msg.gps_lat).toFixed(5)}, {parseFloat(msg.gps_lon).toFixed(5)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-content-tertiary">GPS non disponibile</span>
                        )}

                        {!msg.letto ? (
                          <Button size="sm" variant="secondary" onClick={() => segnaLetto(msg.id)} leftIcon={<Check className="w-3.5 h-3.5" />}>
                            Segna letto
                          </Button>
                        ) : (
                          <span className="text-xs text-success-fg flex items-center gap-1">
                            <CheckCheck className="w-3.5 h-3.5" /> Letto
                          </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => eliminaMessaggio(msg.id)} leftIcon={<Trash2 className="w-3.5 h-3.5" />} className="text-danger-fg hover:bg-danger-bg">
                          Elimina
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
