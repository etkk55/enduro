import { useState, useEffect } from 'react';
import { Clock, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { API_BASE as _API_BASE } from '../services/api';
const API_BASE = `${_API_BASE}/api`;

export default function Tempi() {
  const [eventi, setEventi] = useState([]);
  const [prove, setProve] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [provaSelezionata, setProvaSelezionata] = useState('');
  const [datiTempi, setDatiTempi] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEventi();
  }, []);

  // 🔧 FIX: Ricarica prove quando viene selezionato un nuovo evento
  useEffect(() => {
    if (eventoSelezionato) {
      loadProve();
    }
  }, [eventoSelezionato]);

  useEffect(() => {
    if (eventoSelezionato) {
      const proveFiltrate = prove.filter(p => p.id_evento === eventoSelezionato);
      if (proveFiltrate.length > 0 && !provaSelezionata) {
        setProvaSelezionata(proveFiltrate[0].id);
      }
    }
  }, [eventoSelezionato, prove]);

  useEffect(() => {
    if (provaSelezionata) {
      loadTempi(provaSelezionata);
    }
  }, [provaSelezionata]);

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

  const loadProve = async () => {
    try {
      const res = await fetch(`${API_BASE}/prove-speciali`);
      const data = await res.json();
      setProve(data);
    } catch (err) {
      console.error('Errore caricamento prove:', err);
    }
  };

  const loadTempi = async (idPs) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tempi/${idPs}`);
      const data = await res.json();
      setDatiTempi(data);
    } catch (err) {
      console.error('Errore caricamento tempi:', err);
    } finally {
      setLoading(false);
    }
  };

  const proveFiltrate = prove.filter(p => p.id_evento === eventoSelezionato);

  const renderVariazione = (variazione) => {
    if (!variazione) return <span className="text-gray-400">—</span>;
    
    if (variazione.tipo === 'up') {
      return (
        <div className="flex items-center gap-1 text-green-600 font-bold">
          <TrendingUp className="w-4 h-4" />
          <span>+{variazione.valore}</span>
        </div>
      );
    } else if (variazione.tipo === 'down') {
      return (
        <div className="flex items-center gap-1 text-red-600 font-bold">
          <TrendingDown className="w-4 h-4" />
          <span>-{variazione.valore}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Minus className="w-4 h-4" />
        </div>
      );
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header Pagina */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6 rounded-lg shadow-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Clock className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold">Cronometraggio Live</h1>
              <p className="text-slate-300 text-sm mt-1">Tempi e classifiche in tempo reale</p>
            </div>
          </div>
          <Trophy className="w-12 h-12 text-yellow-400 opacity-50" />
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              📅 Evento
            </label>
            <select
              value={eventoSelezionato}
              onChange={(e) => {
                setEventoSelezionato(e.target.value);
                setProvaSelezionata('');
                setDatiTempi(null);
              }}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            >
              {eventi.map((evento) => (
                <option key={evento.id} value={evento.id}>
                  {evento.nome_evento}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              🏁 Prova Speciale
            </label>
            <select
              value={provaSelezionata}
              onChange={(e) => setProvaSelezionata(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
            >
              {proveFiltrate.map((prova) => (
                <option key={prova.id} value={prova.id}>
                  {prova.nome_completo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Risultati */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4 font-medium">Caricamento dati...</p>
        </div>
      ) : datiTempi ? (
        <div className="space-y-0">
          {/* Title Banner */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 text-white px-8 py-5 rounded-t-xl shadow-lg">
            <h2 className="text-3xl font-bold text-center tracking-wide">
              {datiTempi.prova_info.nome_ps}
            </h2>
            <p className="text-center text-sm mt-1 opacity-90">
              {datiTempi.prova_info.nome_evento}
            </p>
          </div>

          {/* Tabelle Affiancate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 shadow-xl rounded-b-xl overflow-hidden">
            
            {/* COLONNA SINISTRA - Classifica della Prova */}
            <div className="bg-white border-r-2 border-gray-200">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold uppercase tracking-wider">
                    Classifica della Prova
                  </h3>
                  <span className="bg-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                    {datiTempi.classifica_della.length} piloti
                  </span>
                </div>
              </div>

              <div className="overflow-auto max-h-[800px]">
                <table className="w-full">
                  <thead className="bg-blue-50 sticky top-0 z-10">
                    <tr className="border-b-2 border-blue-200">
                      <th className="px-3 py-3 text-left text-xs font-bold text-blue-900 uppercase">Pos</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-blue-900 uppercase">N.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-blue-900 uppercase">Pilota</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-blue-900 uppercase">Classe</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-blue-900 uppercase">Moto</th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-blue-900 uppercase">Tempo</th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-blue-900 uppercase">Dist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datiTempi.classifica_della.map((row, idx) => (
                      <tr 
                        key={`della-${row.numero_gara}`} 
                        className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                          idx < 3 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center font-bold text-gray-700">
                          {row.posizione}°
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block bg-blue-600 text-white font-bold px-3 py-1 rounded-md text-sm">
                            {row.numero_gara}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{row.pilota}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-bold text-green-700">{row.classe || '-'}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700">{row.moto || '-'}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-blue-900 text-sm">
                          {row.tempo}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-gray-600 text-xs">
                          {row.distacco}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COLONNA DESTRA - Classifica Dopo la Prova */}
            <div className="bg-white">
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold uppercase tracking-wider">
                    Classifica Dopo la Prova
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-green-800 px-3 py-1 rounded-full text-sm font-bold">
                      {datiTempi.statistiche.piloti_classificati} piloti
                    </span>
                    {datiTempi.statistiche.ritirati > 0 && (
                      <span className="bg-red-700 px-3 py-1 rounded-full text-sm font-bold">
                        +{datiTempi.statistiche.ritirati} ritirati
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-auto max-h-[800px]">
                <table className="w-full">
                  <thead className="bg-green-50 sticky top-0 z-10">
                    <tr className="border-b-2 border-green-200">
                      <th className="px-3 py-3 text-left text-xs font-bold text-green-900 uppercase">Pos</th>
                      <th className="px-2 py-3 text-center text-xs font-bold text-green-900 uppercase">Var.</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-green-900 uppercase">N.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Pilota</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-green-900 uppercase">Classe</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-green-900 uppercase">Moto</th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-green-900 uppercase">Tempo Tot.</th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-green-900 uppercase">Dist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datiTempi.classifica_dopo.map((row, idx) => (
                      <tr 
                        key={`dopo-${row.numero_gara}`} 
                        className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${
                          idx < 3 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center font-bold text-gray-700">
                          {row.posizione}°
                        </td>
                        <td className="px-2 py-3 text-center">
                          {renderVariazione(row.variazione)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block bg-green-600 text-white font-bold px-3 py-1 rounded-md text-sm">
                            {row.numero_gara}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{row.pilota}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-bold text-green-700">{row.classe || '-'}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700">{row.moto || '-'}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-green-900 text-sm">
                          {row.tempo}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-gray-600 text-xs">
                          {row.distacco}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md py-20 text-center">
          <Clock className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">
            Seleziona un evento e una prova speciale per visualizzare i tempi
          </p>
        </div>
      )}
    </div>
  );
}
