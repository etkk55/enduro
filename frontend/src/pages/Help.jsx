import { HelpCircle, Home, Calendar, Users, Activity, Radio, User, Clock, Trophy, MessageSquare, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-8 py-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-12 h-12" />
          <div>
            <h1 className="text-3xl font-bold">Guida Generale</h1>
            <p className="text-xl text-yellow-100">Panoramica delle sezioni della piattaforma</p>
          </div>
        </div>
      </div>

      {/* Sezioni */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-content-primary mb-6 pb-2 border-b-2 border-blue-500">
          📋 Sezioni della Piattaforma
        </h2>

        <div className="space-y-4">
          {/* Dashboard */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-brand-100 dark:bg-brand-500/20 p-3 rounded-lg">
              <Home className="w-8 h-8 text-brand-600 dark:text-brand-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Dashboard</h3>
              <p className="text-lg text-content-secondary">Panoramica generale con statistiche degli eventi, piloti registrati e stato del sistema.</p>
            </div>
          </div>

          {/* Eventi */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-green-100 p-3 rounded-lg">
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Eventi</h3>
              <p className="text-lg text-content-secondary">Gestione degli eventi/gare. Crea, modifica ed elimina eventi con le relative prove speciali.</p>
            </div>
          </div>

          {/* Piloti */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Piloti</h3>
              <p className="text-lg text-content-secondary">Anagrafica piloti iscritti. Visualizza numero, nome, classe, motoclub e moto di ogni partecipante.</p>
            </div>
          </div>

          {/* Controllo Gara */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Controllo Gara</h3>
              <p className="text-lg text-content-secondary">Pannello di controllo per la gestione della gara in corso. Monitora lo stato e gestisci le operazioni.</p>
            </div>
          </div>

          {/* Live Timing */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-red-100 p-3 rounded-lg">
              <Radio className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Live Timing</h3>
              <p className="text-lg text-content-secondary">Classifica in tempo reale con modalità replay. Visualizza tempi, gap e variazioni posizione per ogni PS.</p>
              <Link to="/help-live" className="text-lg text-brand-600 dark:text-brand-500 hover:underline mt-1 inline-block">
                → Guida dettagliata Live Timing
              </Link>
            </div>
          </div>

          {/* La Mia Gara */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-brand-100 dark:bg-brand-500/20 p-3 rounded-lg">
              <User className="w-8 h-8 text-brand-600 dark:text-brand-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">La Mia Gara</h3>
              <p className="text-lg text-content-secondary">Analisi personalizzata per pilota. Inserisci il tuo numero e visualizza grafici di andamento, scostamenti e confronto con i vicini in classifica.</p>
              <Link to="/help-mia-gara" className="text-lg text-brand-600 dark:text-brand-500 hover:underline mt-1 inline-block">
                → Guida dettagliata La Mia Gara
              </Link>
            </div>
          </div>

          {/* Tempi */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-cyan-100 p-3 rounded-lg">
              <Clock className="w-8 h-8 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Tempi</h3>
              <p className="text-lg text-content-secondary">Inserimento e gestione dei tempi delle prove speciali. Modifica manuale dei tempi registrati.</p>
            </div>
          </div>

          {/* Classifiche */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Trophy className="w-8 h-8 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Classifiche</h3>
              <p className="text-lg text-content-secondary">Classifiche ufficiali assolute e per classe. Esporta in vari formati per pubblicazione.</p>
            </div>
          </div>

          {/* Comunicati */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-pink-100 p-3 rounded-lg">
              <MessageSquare className="w-8 h-8 text-pink-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Comunicati</h3>
              <p className="text-lg text-content-secondary">Gestione comunicati ufficiali della gara. Pubblica avvisi, penalità e informazioni per i partecipanti.</p>
            </div>
          </div>

          {/* Import FICR */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Download className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-primary">Import FICR</h3>
              <p className="text-lg text-content-secondary">Importa dati direttamente dal sistema FICR. Sincronizza piloti, tempi e classifiche con i dati ufficiali della federazione.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Link rapidi */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-content-primary mb-4">🔗 Guide Specifiche</h2>
        <div className="flex flex-wrap gap-4">
          <Link 
            to="/help-live" 
            className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors text-lg"
          >
            <Radio className="w-6 h-6" />
            Guida Live Timing
          </Link>
          <Link 
            to="/help-mia-gara" 
            className="flex items-center gap-2 bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-500 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors text-lg"
          >
            <User className="w-6 h-6" />
            Guida La Mia Gara
          </Link>
        </div>
      </div>
    </div>
  );
}
