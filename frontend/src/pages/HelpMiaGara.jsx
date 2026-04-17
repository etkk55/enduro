import { HelpCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HelpMiaGara() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-8 py-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-12 h-12" />
          <div>
            <h1 className="text-3xl font-bold">Guida La Mia Gara</h1>
            <p className="text-xl text-yellow-100">Come interpretare i grafici</p>
          </div>
        </div>
      </div>

      {/* Torna indietro */}
      <Link 
        to="/la-mia-gara" 
        className="inline-flex items-center gap-2 text-lg text-blue-600 hover:text-blue-800 font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Torna a La Mia Gara
      </Link>

      {/* GUIDA GRAFICI */}
      <div className="bg-white rounded-lg shadow-md p-6">

        {/* Grafico Posizioni */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">📈 Andamento Posizioni</h3>
          <p className="text-lg text-gray-600 mb-4">
            Mostra come cambia la tua posizione in classifica PS dopo PS. Più sei in alto, meglio è. 
            Se la tua linea sale verso l'alto, stai recuperando posizioni.
          </p>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-lg text-blue-800">
              <strong>Esempio:</strong> Se parti 50° e arrivi 30°, la tua linea sale verso l'alto nel grafico.
            </p>
          </div>
        </div>

        {/* Grafico Scostamenti */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">⏱️ Scostamenti Tempi PS</h3>
          <p className="text-lg text-gray-600 mb-4">
            Confronta i tempi di ogni PS rispetto alla <strong>mediana</strong> del gruppo selezionato. 
            La mediana è il valore centrale: metà dei piloti sono più veloci, metà più lenti.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="text-xl text-green-600 font-bold">↑ Sopra lo 0</span>
                <span className="text-lg text-gray-600">= più veloce della mediana</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-xl text-red-600 font-bold">↓ Sotto lo 0</span>
                <span className="text-lg text-gray-600">= più lento della mediana</span>
              </li>
            </ul>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-lg text-yellow-800">
              <strong>Picchi verso il basso</strong> indicano PS problematiche dove hai perso tempo rispetto al tuo standard.
            </p>
          </div>
        </div>

        {/* Grafico Cumulato */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">📊 Differenza Cumulata</h3>
          <p className="text-lg text-gray-600 mb-4">
            Somma progressiva degli scostamenti. Mostra chi accumula vantaggio o ritardo nel corso della gara.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="text-xl text-green-600 font-bold">Linea in alto</span>
                <span className="text-lg text-gray-600">= accumula vantaggio (costantemente più veloce)</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-xl text-red-600 font-bold">Linea in basso</span>
                <span className="text-lg text-gray-600">= accumula ritardo (costantemente più lento)</span>
              </li>
            </ul>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-lg text-green-800">
              <strong>Una linea che sale</strong> significa che stai guadagnando progressivamente sul gruppo.
            </p>
          </div>
        </div>

        {/* Selezione Piloti */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">👥 Selezione Piloti da Confrontare</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-lg text-gray-700 mb-3">Due modalità disponibili:</p>
            <ul className="space-y-4">
              <li>
                <span className="font-medium text-lg text-gray-700">Vicini in classifica finale:</span>
                <span className="text-lg text-gray-600"> Seleziona automaticamente i 3 piloti sopra e 3 sotto di te nella classifica finale.</span>
              </li>
              <li>
                <span className="font-medium text-lg text-gray-700">Seleziona piloti:</span>
                <span className="text-lg text-gray-600"> Digita il cognome per cercare e selezionare manualmente fino a 6 piloti da confrontare.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legenda Colori */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-700 mb-4">🎨 Legenda Colori</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded" style={{backgroundColor: '#1f77b4'}}></span>
                <span className="text-lg text-gray-700 font-medium">Blu = TU (la tua linea)</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-green-500"></span>
                <span className="w-6 h-6 rounded bg-cyan-400"></span>
                <span className="w-6 h-6 rounded bg-purple-500"></span>
                <span className="text-lg text-gray-600">Verde/Azzurro/Viola = piloti davanti a te</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-red-500"></span>
                <span className="w-6 h-6 rounded bg-orange-500"></span>
                <span className="w-6 h-6 rounded bg-yellow-400"></span>
                <span className="text-lg text-gray-600">Rosso/Arancione/Giallo = piloti dietro a te</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Torna indietro (bottom) */}
      <div className="text-center pb-8">
        <Link 
          to="/la-mia-gara" 
          className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium text-lg"
        >
          <ArrowLeft className="w-5 h-5" />
          Torna a La Mia Gara
        </Link>
      </div>
    </div>
  );
}
