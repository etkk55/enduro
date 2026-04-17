import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Trash2, MapPin } from 'lucide-react';

import { API_BASE as _API_BASE } from '../services/api';
const API_BASE = `${_API_BASE}/api`;

// p32: Colori per località (alternati)
const COLORI_LOCALITA = [
  'bg-blue-50 border-l-4 border-l-blue-400',
  'bg-green-50 border-l-4 border-l-green-400',
  'bg-amber-50 border-l-4 border-l-amber-400',
  'bg-purple-50 border-l-4 border-l-purple-400',
  'bg-rose-50 border-l-4 border-l-rose-400',
  'bg-cyan-50 border-l-4 border-l-cyan-400',
  'bg-orange-50 border-l-4 border-l-orange-400',
  'bg-indigo-50 border-l-4 border-l-indigo-400',
];

export default function Eventi() {
  const [eventi, setEventi] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEventi();
  }, []);

  const loadEventi = async () => {
    try {
      const res = await fetch(`${API_BASE}/eventi`);
      const data = await res.json();
      // p32: Ordina per data (più recenti prima), poi per località
      const sorted = data.sort((a, b) => {
        const dataA = new Date(a.data_inizio);
        const dataB = new Date(b.data_inizio);
        if (dataB - dataA !== 0) return dataB - dataA;
        return (a.luogo || '').localeCompare(b.luogo || '');
      });
      setEventi(sorted);
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
    } finally {
      setLoading(false);
    }
  };

  // p32: Raggruppa eventi per località
  const eventiRaggruppati = useMemo(() => {
    const gruppi = {};
    eventi.forEach(ev => {
      const luogo = ev.luogo || 'Senza località';
      if (!gruppi[luogo]) gruppi[luogo] = [];
      gruppi[luogo].push(ev);
    });
    // Ordina gruppi per data più recente
    return Object.entries(gruppi).sort((a, b) => {
      const dataA = Math.max(...a[1].map(e => new Date(e.data_inizio).getTime()));
      const dataB = Math.max(...b[1].map(e => new Date(e.data_inizio).getTime()));
      return dataB - dataA;
    });
  }, [eventi]);

  // p32: Mappa località -> colore
  const coloriMappa = useMemo(() => {
    const mappa = {};
    eventiRaggruppati.forEach(([luogo], idx) => {
      mappa[luogo] = COLORI_LOCALITA[idx % COLORI_LOCALITA.length];
    });
    return mappa;
  }, [eventiRaggruppati]);

  const eliminaEvento = async (id, nome) => {
    if (!confirm(`Eliminare l'evento "${nome}"?\n\nATTENZIONE: Verranno eliminate anche tutte le prove speciali, piloti e tempi collegati!`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/eventi/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('Evento eliminato con successo');
        loadEventi();
      } else {
        alert('Errore durante l\'eliminazione');
      }
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Eventi</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 text-white sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Nome Evento</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Luogo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Codice</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {eventiRaggruppati.map(([luogo, eventiGruppo], groupIdx) => (
                <>
                  {/* p32: Riga vuota separatore tra gruppi (non prima del primo) */}
                  {groupIdx > 0 && (
                    <tr key={`spacer-${luogo}`}>
                      <td colSpan={5} className="h-4 bg-gray-700"></td>
                    </tr>
                  )}
                  {/* p32: Header separatore per località */}
                  <tr key={`header-${luogo}`} className={`${coloriMappa[luogo]} bg-opacity-80`}>
                    <td colSpan={5} className="px-6 py-2">
                      <div className="flex items-center gap-2 font-bold text-gray-700">
                        <MapPin className="w-4 h-4" />
                        {luogo}
                        <span className="text-xs font-normal text-gray-500">
                          ({eventiGruppo.length} {eventiGruppo.length === 1 ? 'evento' : 'eventi'})
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* p32: Righe eventi con colore località */}
                  {eventiGruppo.map((evento) => (
                    <tr key={evento.id} className={`${coloriMappa[luogo]} hover:brightness-95 transition-all`}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{evento.nome_evento}</div>
                        {evento.descrizione && (
                          <div className="text-sm text-gray-500">{evento.descrizione}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(evento.data_inizio).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {evento.luogo}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {evento.codice_gara}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => eliminaEvento(evento.id, evento.nome_evento)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>

          {eventiRaggruppati.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nessun evento trovato
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
