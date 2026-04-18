import { useLocation } from 'react-router-dom';
import { Moon, Sun, PanelLeftClose, PanelLeft, Menu } from 'lucide-react';
import Button from './ui/Button';
import { cn } from './ui/utils';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', description: 'Panoramica generale' },
  '/eventi': { title: 'Eventi', description: 'Calendario gare' },
  '/piloti': { title: 'Piloti', description: 'Gestione e tracking' },
  '/setup-gara': { title: 'Setup Gara', description: 'Configurazione gara FICR' },
  '/controllo-gara': { title: 'Controllo Gara', description: 'Pannello operativo' },
  '/live': { title: 'Live Timing', description: 'Classifica in tempo reale' },
  '/la-mia-gara': { title: 'La Mia Gara', description: 'Vista pilota' },
  '/tempi': { title: 'Tempi', description: 'Gestione tempi' },
  '/classifiche': { title: 'Classifiche', description: 'Risultati ufficiali' },
  '/comunicati': { title: 'Comunicati', description: 'Bollettini di gara' },
  '/messaggi-piloti': { title: 'Messaggi Piloti', description: 'SOS e comunicazioni' },
  '/import-ficr': { title: 'Import FICR', description: 'Importazione dati FICR' },
  '/help': { title: 'Help', description: 'Documentazione' },
  '/help-live': { title: 'Help Live Timing', description: 'Guida Live Timing' },
  '/help-mia-gara': { title: 'Help La Mia Gara', description: 'Guida pilota' },
};

export default function TopBar({ onToggleSidebar, sidebarCollapsed, darkMode, onToggleDarkMode, onOpenMobileMenu }) {
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Enduro FMI', description: '' };

  return (
    <header
      className={cn(
        'sticky top-0 z-20 h-14',
        'bg-surface/80 backdrop-blur-md border-b border-border-subtle',
        'flex items-center justify-between px-4 lg:px-6'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Apri menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Desktop collapse */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Espandi menu' : 'Comprimi menu'}
        >
          {sidebarCollapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
        </Button>

        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-content-primary truncate">{pageInfo.title}</h1>
          {pageInfo.description && (
            <p className="text-2xs text-content-tertiary hidden sm:block">{pageInfo.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="hidden md:inline-flex text-2xs font-mono text-content-tertiary px-2 py-1 rounded bg-surface-2">
          FE 3.1.0 · BE 3.1.0
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onToggleDarkMode} aria-label={darkMode ? 'Tema chiaro' : 'Tema scuro'}>
          {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </Button>
      </div>
    </header>
  );
}
