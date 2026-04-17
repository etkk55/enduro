import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { Home, Calendar, Users, Clock, Trophy, Download, Radio, MessageSquare, Activity, User, HelpCircle, Moon, Sun, Bell, Settings } from 'lucide-react';
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

function NavLink({ to, icon: Icon, children, darkMode }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
        isActive
          ? 'bg-blue-600 text-white'
          : darkMode 
            ? 'text-gray-300 hover:bg-gray-700'
            : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{children}</span>
    </Link>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const isLiveTiming = location.pathname === '/live';
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('darkMode', newValue.toString());
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b`}>
        <div className={`${isLiveTiming ? 'w-full px-4' : 'max-w-7xl mx-auto px-4'} py-4`}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <div>
              <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Enduro Events Platform</h1>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sistema Gestione Gare Enduro</p></div><span className={`text-sm font-mono font-bold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>FE v3.1.0-p37 | BE v3.1.0-p37</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className={`${isLiveTiming ? 'w-full px-4' : 'max-w-7xl mx-auto px-4'}`}>
          <div className="flex flex-wrap gap-2 py-3">
            <NavLink to="/" icon={Home} darkMode={darkMode}>Dashboard</NavLink>
            <NavLink to="/eventi" icon={Calendar} darkMode={darkMode}>Eventi</NavLink>
            <NavLink to="/piloti" icon={Users} darkMode={darkMode}>Piloti</NavLink>
            <NavLink to="/setup-gara" icon={Settings} darkMode={darkMode}>Setup Gara</NavLink>
            <NavLink to="/controllo-gara" icon={Activity} darkMode={darkMode}>Impostazione Gara</NavLink>
            <NavLink to="/live" icon={Radio} darkMode={darkMode}>Live Timing</NavLink>
            <NavLink to="/la-mia-gara" icon={User} darkMode={darkMode}>La Mia Gara</NavLink>
            <NavLink to="/comunicati" icon={MessageSquare} darkMode={darkMode}>Comunicati</NavLink>
            <NavLink to="/messaggi-piloti" icon={Bell} darkMode={darkMode}>Msg Piloti</NavLink>
            <NavLink to="/import-ficr" icon={Download} darkMode={darkMode}>Import FICR</NavLink>
            <Link
              to="/help"
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors font-bold"
            >
              <HelpCircle className="w-5 h-5" />
              <span>HELP</span>
            </Link>
            <button
              onClick={toggleDarkMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-bold ${
                darkMode 
                  ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500' 
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{darkMode ? 'LIGHT' : 'DARK'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content - Full width per LiveTiming */}
      <main className={`${isLiveTiming ? 'w-full px-2' : 'max-w-7xl mx-auto px-4'} py-8`}>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className={`${isLiveTiming ? 'w-full px-4' : 'max-w-7xl mx-auto px-4'} py-6`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">
              © 2025 Enduro Events Platform - Powered by FICR API
            </p>
            <div className="flex gap-4 text-sm text-gray-600">
              <a href="https://enduro.ficr.it" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                FICR Enduro
              </a>
              <span>•</span>
              <a href="https://github.com/etkk55" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
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
            <Route path="*" element={<div className="p-8 text-center"><h1 className="text-2xl font-bold text-gray-700">404 - Pagina non trovata</h1><p className="text-gray-500 mt-2">La pagina richiesta non esiste.</p></div>} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
}
