import { useState, useEffect } from 'react';
import { Trophy, Flag } from 'lucide-react';

import { API_BASE as _API_BASE } from '../services/api';
const API_BASE = `${_API_BASE}/api`;

export default function Classifiche() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [classifica, setClassifica] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEventi();
  }, []);

  useEffect(() => {
    if (eventoSelezionato) {
      loadClassifica(eventoSelezionato);
    }
  }, [eventoSelezionato]);

  const loadEventi = async () => {
    try {
      const res = await fetch(`${API_BASE}/eventi`);
      const data = await res.json();
      setEventi(data);
      if (data.length > 0) {
        setEventoSelezionato(data[0].id);
      }
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
    }
  };

  const loadClassifica = async (idEvento) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/classifiche/${idEvento}`);
      const data = await res.json();
      setClassifica(data);
    } catch (err) {
      console.error('Errore caricamento classifica:', err);
    } finally {
      setLoading(false);
    }
  };

  const eventoCorrente = eventi.find(e => e.id === eventoSelezionato);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white px-8 py-6 rounded-lg shadow-xl mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Trophy className="w-12 h-12 drop-shadow-lg" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Classifica Generale</h1>
              <p className="text-yellow-100 text-sm mt-1 font-medium">Risultati ufficiali</p>
            </div>
          </div>
          <Flag className="w-16 h-16 text-yellow-200 opacity-40" />
        </div>
      </div>

      {/* Filtro Evento */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-100">
        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
          📅 Seleziona Evento
        </label>
        <select
          value={eventoSelezionato}
          onChange={(e) => setEventoSelezionato(e.target.value)}
          className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl font-semibold text-lg focus:border-yellow-500 focus:ring-4 focus:ring-yellow-200 transition-all shadow-sm"
        >
          {eventi.map((evento) => (
            <option key={evento.id} value={evento.id}>
              {evento.nome_evento} - {new Date(evento.data_inizio).toLocaleDateString('it-IT')}
            </option>
          ))}
        </select>
      </div>

      {/* Classifica */}
      {loading ? (
        <div className="text-center py-24">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-yellow-500 mx-auto"></div>
          <p className="text-gray-500 mt-6 font-semibold text-lg">Caricamento classifica...</p>
        </div>
      ) : classifica.length > 0 ? (
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-gray-200">
          {/* Header Classifica */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold uppercase tracking-wide mb-2">
                🏆 Classifica Generale Assoluta
              </h2>
              {eventoCorrente && (
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-yellow-300">
                    {eventoCorrente.nome_evento}
                  </p>
                  <p className="text-sm text-gray-300">
                    {eventoCorrente.luogo} • {new Date(eventoCorrente.data_inizio).toLocaleDateString('it-IT')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tabella Stile FICR */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider border-r border-blue-500">
                    Pos
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider border-r border-blue-500">
                    N.
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">
                    Pilota
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider border-r border-blue-500">
                    Classe
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border-r border-blue-500">
                    Moto
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider border-r border-blue-500">
                    Tempo
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    Dist.
                  </th>
                </tr>
              </thead>
              <tbody>
                {classifica.map((row, idx) => (
                  <tr
                    key={row.numero_gara}
                    className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } ${idx < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 font-semibold' : ''}`}
                  >
                    {/* Posizione */}
                    <td className="px-4 py-4 text-center border-r border-gray-200">
                      {row.posizione === 1 && (
                        <div className="flex flex-col items-center">
                          <span className="text-4xl">🥇</span>
                        </div>
                      )}
                      {row.posizione === 2 && (
                        <div className="flex flex-col items-center">
                          <span className="text-4xl">🥈</span>
                        </div>
                      )}
                      {row.posizione === 3 && (
                        <div className="flex flex-col items-center">
                          <span className="text-4xl">🥉</span>
                        </div>
                      )}
                      {row.posizione > 3 && (
                        <span className="text-xl font-bold text-gray-700">{row.posizione}</span>
                      )}
                    </td>

                    {/* Numero */}
                    <td className="px-4 py-4 text-center border-r border-gray-200">
                      <span className="inline-flex items-center justify-center bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-base shadow-md min-w-[60px]">
                        {row.numero_gara}
                      </span>
                    </td>

                    {/* Pilota */}
                    <td className="px-6 py-4 border-r border-gray-200">
                      <div className="font-bold text-gray-900 text-base uppercase tracking-wide">
                        {row.pilota}
                      </div>
                      {row.team && (
                        <div className="text-xs text-gray-500 mt-1">{row.team}</div>
                      )}
                    </td>

                    {/* Classe */}
                    <td className="px-4 py-4 text-center border-r border-gray-200">
                      <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-md text-sm border border-green-300">
                        {row.classe || '-'}
                      </span>
                    </td>

                    {/* Moto */}
                    <td className="px-6 py-4 border-r border-gray-200">
                      <div className="font-semibold text-gray-800 text-sm uppercase">
                        {row.moto || '-'}
                      </div>
                    </td>

                    {/* Tempo */}
                    <td className="px-5 py-4 text-center border-r border-gray-200">
                      <span className="font-mono font-bold text-lg text-blue-900">
                        {row.tempo_totale}
                      </span>
                    </td>

                    {/* Distacco */}
                    <td className="px-5 py-4 text-center">
                      <span className="font-mono font-semibold text-base text-red-600">
                        {row.distacco || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer con statistiche */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-200 px-8 py-5 border-t-2 border-slate-300">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-6">
                <span className="font-bold text-gray-700">
                  Piloti classificati: <span className="text-blue-600 text-lg">{classifica.length}</span>
                </span>
                {classifica[0]?.totale_prove && (
                  <span className="font-bold text-gray-700">
                    Prove totali: <span className="text-green-600 text-lg">{classifica[0].totale_prove}</span>
                  </span>
                )}
              </div>
              <span className="font-medium text-gray-600">
                Aggiornato: <strong className="text-gray-900">{new Date().toLocaleString('it-IT')}</strong>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg py-24 text-center">
          <Trophy className="w-24 h-24 text-gray-300 mx-auto mb-6" />
          <p className="text-gray-500 text-xl font-medium">
            Nessun dato disponibile per questo evento
          </p>
        </div>
      )}
    </div>
  );
}
