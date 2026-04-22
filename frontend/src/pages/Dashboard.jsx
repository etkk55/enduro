import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Users, Activity, ArrowRight, Radio, Settings, Download, Trophy, MapPin, Clock,
  AlertTriangle, Navigation, MessageSquare, Flag
} from 'lucide-react';
import { getEventi, getPiloti } from '../services/api';
import { API_BASE } from '../services/api';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import LiveDot from '../components/ui/LiveDot';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { getActiveEventId } from '../utils/activeEvent';

// ============================================================
// Hero card — evento attivo in primo piano, gradient brand
// ============================================================
function HeroActiveEvent({ evento, loading }) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent p-6 mb-6">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }
  if (!evento) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-default bg-surface-2/50 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-content-tertiary">
            <Flag className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-content-primary">Nessun evento attivo</h2>
            <p className="text-sm text-content-secondary mt-1">Seleziona un evento da una delle pagine (Eventi, Piloti…) per attivarlo come contesto di lavoro.</p>
          </div>
          <Button as={Link} to="/eventi" variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>Vai agli eventi</Button>
        </div>
      </div>
    );
  }
  const dataFmt = evento.data_inizio ? new Date(evento.data_inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/15 via-brand-500/5 to-surface p-6 mb-6 shadow-sm">
      {/* Decoro geometrico */}
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-0 right-6 text-brand-500/5 pointer-events-none" aria-hidden="true">
        <Trophy className="w-32 h-32" />
      </div>

      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <LiveDot tone="brand" size="sm" />
            <span className="text-overline text-brand-700 dark:text-brand-500">Evento attivo</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-content-primary leading-tight">{evento.nome_evento || evento.codice_gara}</h2>
          <div className="flex items-center gap-3 mt-2 text-sm text-content-secondary flex-wrap">
            {dataFmt && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-content-tertiary" /> {dataFmt}</span>}
            {evento.luogo && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-content-tertiary" /> {evento.luogo}</span>}
            {evento.codice_gara && <span className="font-mono text-content-tertiary">{evento.codice_gara}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button as={Link} to="/live" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>Live Timing</Button>
          <Button as={Link} to="/messaggi-piloti" variant="secondary">Allarmi</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Counter tiles — stile ERTA DdG (icone colorate su fondo bg/10)
// ============================================================
function CounterTile({ label, value, icon: Icon, tone, to }) {
  const toneMap = {
    danger:  { bg: 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15', ico: 'bg-rose-500 text-white', num: 'text-rose-600 dark:text-rose-400' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15', ico: 'bg-amber-500 text-white', num: 'text-amber-700 dark:text-amber-400' },
    info:    { bg: 'bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/15', ico: 'bg-sky-500 text-white', num: 'text-sky-700 dark:text-sky-400' },
    success: { bg: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15', ico: 'bg-emerald-500 text-white', num: 'text-emerald-700 dark:text-emerald-400' },
  };
  const t = toneMap[tone] || toneMap.info;
  const content = (
    <div className={`rounded-xl border ${t.bg} p-4 transition-colors cursor-pointer`}>
      <div className="flex items-start justify-between mb-1">
        <div className={`w-9 h-9 rounded-lg ${t.ico} flex items-center justify-center shadow-sm`}>
          <Icon className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-content-tertiary">{label}</div>
      </div>
      <div className={`text-3xl font-black tabular-nums leading-none mt-3 ${t.num}`}>{value}</div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function StatCard({ label, value, icon: Icon, trend, tone = 'brand', loading, animated }) {
  const toneMap = {
    brand: 'text-brand-600 dark:text-brand-500 bg-brand-50 dark:bg-brand-100',
    success: 'text-success-fg bg-success-bg',
    warning: 'text-warning-fg bg-warning-bg',
    neutral: 'text-content-secondary bg-surface-2',
  };
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardBody className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-overline mb-2">{label}</div>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-display font-mono tabular-nums">
              {animated && typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
            </div>
          )}
          {trend && (
            <div className="mt-2 text-caption flex items-center gap-1">
              {trend}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
            <Icon className="w-5 h-5" strokeWidth={2} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function QuickActionCard({ to, icon: Icon, title, description }) {
  return (
    <Link to={to} className="group">
      <Card interactive className="h-full">
        <CardBody>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-2 text-content-secondary flex items-center justify-center shrink-0 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="text-sm font-semibold text-content-primary">{title}</div>
                <ArrowRight className="w-4 h-4 text-content-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs text-content-secondary">{description}</div>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function EventRow({ evento }) {
  const dataFmt = evento.data_inizio
    ? new Date(evento.data_inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const statoVariant = {
    bozza: 'neutral',
    in_corso: 'info',
    completato: 'success',
    annullato: 'danger',
  }[evento.stato] || 'neutral';

  return (
    <Link
      to="/eventi"
      className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2 rounded-md -mx-1 transition-colors"
    >
      <div className="w-10 h-10 rounded-md bg-brand-50 dark:bg-brand-100 text-brand-600 dark:text-brand-500 flex flex-col items-center justify-center shrink-0">
        <div className="text-2xs font-medium leading-none uppercase">
          {evento.data_inizio ? new Date(evento.data_inizio).toLocaleDateString('it-IT', { month: 'short' }) : '—'}
        </div>
        <div className="text-sm font-bold leading-none mt-0.5">
          {evento.data_inizio ? new Date(evento.data_inizio).getDate() : '—'}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-content-primary truncate">
          {evento.nome_evento || evento.nome}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-content-tertiary">
          {evento.luogo && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {evento.luogo}
            </span>
          )}
          <span className="shrink-0">·</span>
          <span className="font-mono shrink-0">{evento.codice_gara}</span>
        </div>
      </div>
      <Badge variant={statoVariant} size="sm">{evento.stato || 'bozza'}</Badge>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ eventi: [], piloti: 0, loading: true });
  const [counters, setCounters] = useState({ sos: 0, fermi: 0, gpsPersi: 0, messaggi: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [eventiRes, pilotiRes] = await Promise.all([getEventi(), getPiloti()]);
        if (!cancelled) {
          setStats({
            eventi: eventiRes.data || [],
            piloti: (pilotiRes.data || []).length,
            loading: false,
          });
        }
      } catch (e) {
        console.error('[Dashboard]', e);
        if (!cancelled) setStats(s => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Polling contatori live evento attivo
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const id = getActiveEventId();
      if (!id) return;
      const ev = stats.eventi.find(e => e.id === id);
      if (!ev?.codice_gara) return;
      try {
        const r = await fetch(`${API_BASE}/api/messaggi-piloti/${encodeURIComponent(ev.codice_gara)}`);
        const d = await r.json();
        if (cancelled) return;
        const msgs = Array.isArray(d?.messaggi) ? d.messaggi : (Array.isArray(d) ? d : []);
        const sos = msgs.filter(m => !m.letto && (m.tipo === 'sos' || m.tipo_emergenza)).length;
        const messaggi = msgs.filter(m => !m.letto).length;
        setCounters(c => ({ ...c, sos, messaggi }));
      } catch {}
      try {
        const r2 = await fetch(`${API_BASE}/api/ddg/multi/${encodeURIComponent(ev.codice_gara)}`);
        const d2 = await r2.json();
        if (cancelled) return;
        const fermi = Array.isArray(d2?.piloti_fermi) ? d2.piloti_fermi.length : 0;
        const gpsPersi = Array.isArray(d2?.piloti_segnale_perso) ? d2.piloti_segnale_perso.length : 0;
        setCounters(c => ({ ...c, fermi, gpsPersi }));
      } catch {}
    };
    tick();
    const t = setInterval(tick, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [stats.eventi]);

  const activeEventId = getActiveEventId();
  const eventoAttivo = stats.eventi.find(e => e.id === activeEventId) || null;

  const eventiRecenti = [...stats.eventi]
    .sort((a, b) => new Date(b.data_inizio || 0) - new Date(a.data_inizio || 0))
    .slice(0, 5);

  const eventiAttivi = stats.eventi.filter(e => e.stato === 'in_corso').length;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-heading-1 text-content-primary">Benvenuto</h1>
        <p className="text-content-secondary mt-1">Panoramica del tuo sistema di timing.</p>
      </div>

      {/* Hero evento attivo */}
      <HeroActiveEvent evento={eventoAttivo} loading={stats.loading} />

      {/* Counter tiles live — stile ERTA DdG (visibili solo se c'e' un evento attivo) */}
      {eventoAttivo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <CounterTile label="SOS" value={counters.sos} icon={AlertTriangle} tone="danger" to="/messaggi-piloti" />
          <CounterTile label="Piloti fermi" value={counters.fermi} icon={Clock} tone="warning" to="/piloti" />
          <CounterTile label="GPS persi" value={counters.gpsPersi} icon={Navigation} tone="danger" to="/piloti" />
          <CounterTile label="Messaggi" value={counters.messaggi} icon={MessageSquare} tone="info" to="/messaggi-piloti" />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Eventi totali"
          value={stats.loading ? '—' : stats.eventi.length}
          icon={Calendar}
          tone="brand"
          loading={stats.loading}
          animated
        />
        <StatCard
          label="Piloti registrati"
          value={stats.loading ? '—' : stats.piloti}
          icon={Users}
          tone="neutral"
          loading={stats.loading}
          animated
        />
        <StatCard
          label="Eventi in corso"
          value={stats.loading ? '—' : eventiAttivi}
          icon={Activity}
          tone={eventiAttivi > 0 ? 'success' : 'neutral'}
          loading={stats.loading}
          animated
          trend={eventiAttivi > 0 ? <span className="flex items-center gap-1 text-success-fg"><LiveDot tone="success" size="sm" /> In diretta</span> : null}
        />
        <StatCard
          label="Stato sistema"
          value="Online"
          icon={Radio}
          tone="success"
          trend={<span className="flex items-center gap-1.5"><LiveDot tone="success" size="sm" /> Operativo</span>}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Eventi recenti */}
        <div className="lg:col-span-2">
          <Card>
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h2 className="text-heading-2">Eventi recenti</h2>
                <p className="text-caption mt-0.5">Ultime gare configurate</p>
              </div>
              <Button as={Link} variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                <Link to="/eventi">Vedi tutti</Link>
              </Button>
            </div>
            <CardBody className="p-2">
              {stats.loading ? (
                <div className="space-y-3 px-3 py-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-md" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : eventiRecenti.length === 0 ? (
                <div className="py-8 px-4 text-center text-content-tertiary text-sm">
                  Nessun evento configurato.
                </div>
              ) : (
                eventiRecenti.map(e => <EventRow key={e.id} evento={e} />)
              )}
            </CardBody>
          </Card>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-overline mb-3">Azioni rapide</h2>
          <div className="space-y-3">
            <QuickActionCard
              to="/live"
              icon={Radio}
              title="Live Timing"
              description="Classifica in tempo reale"
            />
            <QuickActionCard
              to="/setup-gara"
              icon={Settings}
              title="Setup nuova gara"
              description="Wizard completo FICR"
            />
            <QuickActionCard
              to="/import-ficr"
              icon={Download}
              title="Import FICR"
              description="Iscritti, tempi, prove"
            />
            <QuickActionCard
              to="/classifiche"
              icon={Trophy}
              title="Classifiche"
              description="Risultati ufficiali"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
