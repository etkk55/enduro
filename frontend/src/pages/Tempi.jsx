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
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-heading-1">Cronometraggio</h1>
        <p className="text-content-secondary mt-1 text-sm">Classifica della prova e classifica cumulativa</p>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-lg p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1.5">Evento</label>
            <select
              value={eventoSelezionato}
              onChange={(e) => {
                setEventoSelezionato(e.target.value);
                setProvaSelezionata('');
                setDatiTempi(null);
              }}
              className="w-full h-9 px-3 pr-8 rounded-md border border-border bg-surface text-sm font-medium cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {eventi.map((evento) => (
                <option key={evento.id} value={evento.id}>{evento.nome_evento}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1.5">Prova Speciale</label>
            <select
              value={provaSelezionata}
              onChange={(e) => setProvaSelezionata(e.target.value)}
              className="w-full h-9 px-3 pr-8 rounded-md border border-border bg-surface text-sm font-medium cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%2394A3B8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {proveFiltrate.map((prova) => (
                <option key={prova.id} value={prova.id}>{prova.nome_completo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="inline-flex items-center gap-3 text-content-secondary">
            <svg className="animate-spin w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" className="opacity-75" />
            </svg>
            <span className="text-sm">Caricamento tempi…</span>
          </div>
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
        <div className="bg-surface border border-border-subtle rounded-lg py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-content-tertiary" />
          </div>
          <h3 className="text-heading-2 mb-1">Seleziona una prova</h3>
          <p className="text-content-secondary text-sm">Scegli evento e prova speciale per visualizzare i tempi.</p>
        </div>
      )}
    </div>
  );
}
