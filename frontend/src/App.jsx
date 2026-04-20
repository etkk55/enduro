import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard, Calendar, Users, Settings, Radio, Activity, User,
  MessageSquare, Bell, Download, LifeBuoy, Flag, Clock, Trophy, X,
  LifeBuoy as SafetyIcon, MapPin
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import CommandPalette from './components/CommandPalette';
import { cn } from './components/ui/utils';

// Eager - small and likely first page
import Dashboard from './pages/Dashboard';

// Lazy - load only when visited
const Eventi = lazy(() => import('./pages/Eventi'));
const Piloti = lazy(() => import('./pages/Piloti'));
const Tempi = lazy(() => import('./pages/Tempi'));
const Classifiche = lazy(() => import('./pages/Classifiche'));
const ImportFicr = lazy(() => import('./pages/ImportFicr'));
const LiveTiming = lazy(() => import('./pages/LiveTiming'));
const Comunicati = lazy(() => import('./pages/Comunicati'));
const ControlloGara = lazy(() => import('./pages/ControlloGara'));
const LaMiaGara = lazy(() => import('./pages/LaMiaGara'));
const HelpLive = lazy(() => import('./pages/HelpLive'));
const HelpMiaGara = lazy(() => import('./pages/HelpMiaGara'));
const Help = lazy(() => import('./pages/Help'));
const MessaggiPiloti = lazy(() => import('./pages/MessaggiPiloti'));
const SetupGaraFicr = lazy(() => import('./pages/SetupGaraFicr'));
const Addetti = lazy(() => import('./pages/Addetti'));
const Mappa = lazy(() => import('./pages/Mappa'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="inline-flex items-center gap-3 text-content-secondary">
        <svg className="animate-spin w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" className="opacity-75" />
        </svg>
        <span className="text-sm">Caricamento…</span>
      </div>
    </div>
  );
}

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/live', icon: Radio, label: 'Live Timing' },
      { to: '/mappa', icon: MapPin, label: 'Mappa Tracciato' },
    ],
  },
  {
    label: 'Gestione Gara',
    items: [
      { to: '/eventi', icon: Calendar, label: 'Eventi' },
      { to: '/piloti', icon: Users, label: 'Piloti' },
      { to: '/setup-gara', icon: Settings, label: 'Setup Gara' },
      { to: '/controllo-gara', icon: Activity, label: 'Simulazione Gara' },
      { to: '/import-ficr', icon: Download, label: 'Import FICR' },
    ],
  },
  {
    label: 'Tempi & Risultati',
    items: [
      { to: '/tempi', icon: Clock, label: 'Tempi' },
      { to: '/classifiche', icon: Trophy, label: 'Classifiche' },
    ],
  },
  {
    label: 'Comunicazione',
    items: [
      { to: '/comunicati', icon: MessageSquare, label: 'Comunicati' },
      { to: '/messaggi-piloti', icon: Bell, label: 'Messaggi Piloti' },
    ],
  },
  {
    label: 'Sicurezza',
    items: [
      { to: '/addetti', icon: SafetyIcon, label: 'Addetti al Percorso' },
    ],
  },
  {
    label: 'Pilota',
    items: [
      { to: '/la-mia-gara', icon: User, label: 'La Mia Gara' },
    ],
  },
  {
    label: 'Aiuto',
    items: [
      { to: '/help', icon: LifeBuoy, label: 'Help' },
    ],
  },
];

function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('darkMode');
    if (stored) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  return [darkMode, () => setDarkMode(v => !v)];
}

function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed.toString());
  }, [collapsed]);

  return [collapsed, () => setCollapsed(v => !v)];
}

function MobileDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in lg:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border-subtle animate-slide-up lg:hidden">
        <div className="h-14 flex items-center justify-between px-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <div className="text-sm font-semibold">Enduro FMI</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-content-secondary hover:text-content-primary" aria-label="Chiudi menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-3.5rem)]" onClick={onClose}>
          <nav className="py-3 px-2">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi}>
                {group.label && <div className="text-overline px-3 pt-5 pb-2">{group.label}</div>}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.to}
                      href={item.to}
                      className="flex items-center gap-3 h-10 px-3 rounded-md text-sm font-medium text-content-secondary hover:bg-surface-2 hover:text-content-primary transition-colors"
                    >
                      {Icon && <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />}
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

function AppLayout({ children, onOpenPalette }) {
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [collapsed, toggleCollapsed] = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base text-content-primary">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          groups={NAV_GROUPS}
          collapsed={collapsed}
          footer={(isCollapsed) => (
            <div className={cn('text-xs text-content-tertiary font-mono', isCollapsed ? 'text-center' : 'px-2')}>
              v1.2.00
            </div>
          )}
        />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main area */}
      <div className={cn('flex flex-col min-h-screen transition-[padding] duration-200', 'lg:pl-60', collapsed && 'lg:pl-16')}>
        <TopBar
          onToggleSidebar={toggleCollapsed}
          sidebarCollapsed={collapsed}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onOpenPalette={onOpenPalette}
        />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
        <Flag className="w-7 h-7 text-content-tertiary" />
      </div>
      <h1 className="text-heading-1 text-content-primary mb-2">Pagina non trovata</h1>
      <p className="text-content-secondary">La risorsa richiesta non esiste o e' stata spostata.</p>
    </div>
  );
}

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Router>
      <AppLayout onOpenPalette={() => setPaletteOpen(true)}>
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/eventi" element={<Eventi />} />
              <Route path="/piloti" element={<Piloti />} />
              <Route path="/controllo-gara" element={<ControlloGara />} />
              <Route path="/live" element={<LiveTiming />} />
              <Route path="/la-mia-gara" element={<LaMiaGara />} />
              <Route path="/help-live" element={<HelpLive />} />
              <Route path="/help-mia-gara" element={<HelpMiaGara />} />
              <Route path="/help" element={<Help />} />
              <Route path="/tempi" element={<Tempi />} />
              <Route path="/classifiche" element={<Classifiche />} />
              <Route path="/comunicati" element={<Comunicati />} />
              <Route path="/messaggi-piloti" element={<MessaggiPiloti />} />
              <Route path="/setup-gara" element={<SetupGaraFicr />} />
              <Route path="/addetti" element={<Addetti />} />
              <Route path="/mappa" element={<Mappa />} />
              <Route path="/import-ficr" element={<ImportFicr />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </AppLayout>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} groups={NAV_GROUPS} />
    </Router>
  );
}
