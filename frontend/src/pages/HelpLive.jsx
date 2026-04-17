import { HelpCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HelpLive() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-8 py-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-12 h-12" />
          <div>
            <h1 className="text-3xl font-bold">Guida Live Timing</h1>
            <p className="text-xl text-yellow-100">Come interpretare la classifica e i tempi</p>
          </div>
        </div>
      </div>

      {/* Torna indietro */}
      <Link 
        to="/live" 
        className="inline-flex items-center gap-2 text-lg text-blue-600 hover:text-blue-800 font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Torna al Live Timing
      </Link>

      {/* GUIDA LIVE TIMING */}
      <div className="bg-white rounded-lg shadow-md p-6">
        
        {/* Controlli Replay */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">🎮 Controlli Replay</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700 w-40">⏮️ Reset</td>
                  <td className="py-3 text-lg text-gray-600">Torna a PS1</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">▶️ Play Auto</td>
                  <td className="py-3 text-lg text-gray-600">Avanza automaticamente una PS ogni 3 secondi</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">⏭️ Avanti</td>
                  <td className="py-3 text-lg text-gray-600">Passa alla PS successiva manualmente</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">📡 LIVE ON/OFF</td>
                  <td className="py-3 text-lg text-gray-600">ON = classifica finale in tempo reale. OFF = modalità replay per rivedere PS per PS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Classifica Live */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">📋 Classifica Live</h3>
          <p className="text-lg text-gray-600 mb-4">
            Mostra le prestazioni di ogni pilota nella singola speciale selezionata.
          </p>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-lg text-gray-700 mb-3">Colori sfondo riga:</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-green-500 rounded"></span>
                <span className="text-lg text-gray-600">Verde = hai guadagnato posizioni in questa PS</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-red-500 rounded"></span>
                <span className="text-lg text-gray-600">Rosso = hai perso posizioni in questa PS</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-white border border-gray-300 rounded"></span>
                <span className="text-lg text-gray-600">Bianco = posizione invariata</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Dettaglio Tempi */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">🔍 Dettaglio Tempi</h3>
          <p className="text-lg text-gray-600 mb-4">
            Clicca sulla casella tempi di un pilota per aprire il popup dettagliato.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="font-medium text-lg text-gray-700 mb-3">Colori sfondo nel popup:</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-green-400 rounded"></span>
                <span className="text-lg text-gray-600">Verde = piloti davanti a te</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-yellow-400 rounded"></span>
                <span className="text-lg text-gray-600">Giallo = piloti dietro di te</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-red-400 rounded"></span>
                <span className="text-lg text-gray-600">Rosso = TU</span>
              </li>
            </ul>
          </div>

          <p className="text-lg text-gray-600 mb-2">Informazioni mostrate:</p>
          <ul className="list-disc list-inside text-lg text-gray-600 mb-4 space-y-1">
            <li>Posizione assoluta e di classe</li>
            <li>Gap da chi ti precede e chi ti segue</li>
            <li>Tempi PS con confronto rispetto ai vicini</li>
          </ul>
        </div>

        {/* Come leggere casella tempo */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">📊 Come leggere la casella Tempo PS</h3>
          <div className="bg-gray-900 text-white rounded-lg p-6 font-mono text-center mb-4">
            <div className="text-green-400 text-lg">+2.3s</div>
            <div className="text-2xl font-bold">4:32.15</div>
            <div className="text-green-400 text-xl">+2</div>
            <div className="text-gray-400 text-lg">12°</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">+2.3s (in alto)</td>
                  <td className="py-3 text-lg text-gray-600">Distacco da chi ti precede</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">4:32.15</td>
                  <td className="py-3 text-lg text-gray-600">Tempo realizzato in questa PS</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">+2</td>
                  <td className="py-3 text-lg text-gray-600">Posizioni guadagnate (+) o perse (-) in questa PS</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-lg text-gray-700">12°</td>
                  <td className="py-3 text-lg text-gray-600">Posizione in questa PS</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <p className="text-lg text-blue-800">
              <strong>Colore del distacco:</strong><br/>
              🟢 Verde = hai recuperato tempo su chi ti precede<br/>
              🔴 Rosso = hai perso ulteriore tempo
            </p>
          </div>
        </div>
      </div>

      {/* Torna indietro (bottom) */}
      <div className="text-center pb-8">
        <Link 
          to="/live" 
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium text-lg"
        >
          <ArrowLeft className="w-5 h-5" />
          Torna al Live Timing
        </Link>
      </div>
    </div>
  );
}
