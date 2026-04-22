import { useLocation } from 'react-router-dom';
import { Moon, Sun, PanelLeftClose, PanelLeft, Menu, Search, Command, Rows3 } from 'lucide-react';
import Button from './ui/Button';
import { cn } from './ui/utils';
import { useDensity } from '../hooks/useDensity';
import { toast } from './ui/Toast';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', description: 'Panoramica generale' },
  '/eventi': { title: 'Eventi', description: 'Calendario gare' },
  '/piloti': { title: 'Piloti', description: 'Gestione e tracking' },
  '/setup-gara': { title: 'Setup Gara', description: 'Configurazione gara FICR' },
  '/controllo-gara': { title: 'Simulazione Gara', description: 'Simula lo svolgimento dell\'evento' },
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

export default function TopBar({ onToggleSidebar, sidebarCollapsed, darkMode, onToggleDarkMode, onOpenMobileMenu, onOpenPalette }) {
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Enduro FMI', description: '' };
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const { density, cycle: cycleDensity } = useDensity();
  const densityLabels = { lg: 'Grande', md: 'Normale', sm: 'Denso' };
  const densityOrder = ['lg', 'md', 'sm'];

  return (
    <header
      className={cn(
        'sticky top-0 z-20 h-14',
        'bg-surface/80 backdrop-blur-md border-b border-border-subtle',
        'flex items-center justify-between px-4 lg:px-6 gap-3'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenMobileMenu} aria-label="Apri menu">
          <Menu className="w-5 h-5" />
        </Button>

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
        {/* Command palette trigger */}
        <button
          onClick={onOpenPalette}
          className={cn(
            'hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-md border border-border bg-surface',
            'text-xs text-content-tertiary hover:text-content-primary hover:border-border-strong transition-colors'
          )}
          aria-label="Apri command palette"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Cerca…</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 h-5 text-2xs font-mono border border-border rounded bg-surface-2">
            {isMac ? <Command className="w-2.5 h-2.5" /> : 'Ctrl'}
            K
          </kbd>
        </button>

        {/* Mobile: search icon only */}
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenPalette} aria-label="Cerca">
          <Search className="w-[18px] h-[18px]" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const i = densityOrder.indexOf(density);
            const next = densityOrder[(i + 1) % densityOrder.length];
            cycleDensity();
            toast({ title: `Densità: ${densityLabels[next]}`, duration: 1400, variant: 'info' });
          }}
          aria-label={`Densità: ${densityLabels[density]} (click per cambiare)`}
          title={`Densità: ${densityLabels[density]} — click per cambiare`}
          className="hidden sm:inline-flex"
        >
          <Rows3 className="w-[18px] h-[18px]" />
        </Button>

        <Button variant="ghost" size="icon-sm" onClick={onToggleDarkMode} aria-label={darkMode ? 'Tema chiaro' : 'Tema scuro'}>
          {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </Button>
      </div>
    </header>
  );
}
