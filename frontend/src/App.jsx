import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Calendar, Users, Settings, Radio, Activity, User,
  MessageSquare, Bell, Download, LifeBuoy, Flag, Clock, Trophy, X
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import { cn } from './components/ui/utils';

import Dashboard from './pages/Dashboard';
import Eventi from './pages/Eventi';
import Piloti from './pages/Piloti';
import Tempi from './pages/Tempi';
import Classifiche from './pages/Classifiche';
import ImportFicr from './pages/ImportFicr';
import LiveTiming from './pages/LiveTiming';
import Comunicati from './pages/Comunicati';
import ControlloGara from './pages/ControlloGara';
import LaMiaGara from './pages/LaMiaGara';
import HelpLive from './pages/HelpLive';
import HelpMiaGara from './pages/HelpMiaGara';
import Help from './pages/Help';
import MessaggiPiloti from './pages/MessaggiPiloti';
import SetupGaraFicr from './pages/SetupGaraFicr';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/live', icon: Radio, label: 'Live Timing' },
    ],
  },
  {
    label: 'Gestione Gara',
    items: [
      { to: '/eventi', icon: Calendar, label: 'Eventi' },
      { to: '/piloti', icon: Users, label: 'Piloti' },
      { to: '/setup-gara', icon: Settings, label: 'Setup Gara' },
      { to: '/controllo-gara', icon: Activity, label: 'Controllo Gara' },
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

function AppLayout({ children }) {
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [collapsed, toggleCollapsed] = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base text-content-primary">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar groups={NAV_GROUPS} collapsed={collapsed} />
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
        />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
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
  return (
    <Router>
      <AppLayout>
        <ErrorBoundary>
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
            <Route path="/import-ficr" element={<ImportFicr />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </AppLayout>
    </Router>
  );
}
