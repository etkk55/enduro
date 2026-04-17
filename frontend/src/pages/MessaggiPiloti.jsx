import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MessageSquare, MapPin, Check, CheckCheck, Filter, Volume2, VolumeX, RefreshCw, ExternalLink, Clock } from 'lucide-react';

import { API_BASE } from '../services/api';

export default function MessaggiPiloti() {
  const [eventi, setEventi] = useState([]);
  const [selectedEvento, setSelectedEvento] = useState('');
  const [codiceGara, setCodiceGara] = useState('');
  const [messaggi, setMessaggi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('tutti'); // tutti, sos, non_letti
  const [stats, setStats] = useState({ non_letti: 0, sos_attivi: 0 });
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lastSosCount, setLastSosCount] = useState(0);
  const audioRef = useRef(null);
  const pollingRef = useRef(null);
  
  // NUOVO Chat 21: Piloti fermi
  const [pilotiFermi, setPilotiFermi] = useState([]);
  const [pilotiSegnalePerso, setPilotiSegnalePerso] = useState([]);
  const [piloti, setPiloti] = useState([]);

  // Carica eventi
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(res => res.json())
      .then(data => setEventi(data))
      .catch(err => console.error('Errore caricamento eventi:', err));
  }, []);

  // Quando cambia evento selezionato
  useEffect(() => {
    if (selectedEvento) {
      const evento = eventi.find(e => e.id === selectedEvento);
      if (evento) {
        setCodiceGara(evento.codice_gara);
      }
    }
  }, [selectedEvento, eventi]);

  // Polling messaggi
  useEffect(() => {
    if (codiceGara) {
      loadMessaggi();
      // Polling ogni 10 secondi
      pollingRef.current = setInterval(loadMessaggi, 10000);
      return () => clearInterval(pollingRef.current);
    }
  }, [codiceGara]);

  // NUOVO Chat 21: Carica piloti e piloti fermi
  useEffect(() => {
    if (selectedEvento) {
      loadPilotiEvento();
      loadPilotiFermi();
      const interval = setInterval(loadPilotiFermi, 30000); // ogni 30 sec
      return () => clearInterval(interval);
    } else {
      setPilotiFermi([]);
      setPilotiSegnalePerso([]);
      setPiloti([]);
    }
  }, [selectedEvento]);

  const loadPilotiEvento = async () => {
    if (!selectedEvento) return;
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${selectedEvento}/piloti`);
      const data = await res.json();
      setPiloti(data || []);
    } catch (err) {
      console.error('Errore caricamento piloti:', err);
    }
  };

  const loadPilotiFermi = async () => {
    if (!selectedEvento) return;
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${selectedEvento}/piloti-fermi`);
      const data = await res.json();
      if (data.success) {
        setPilotiFermi(data.piloti_fermi || []);
        setPilotiSegnalePerso(data.piloti_segnale_perso || []);
        // Suona allarme se ci sono piloti fermi o segnale perso
        if ((data.piloti_fermi?.length > 0 || data.piloti_segnale_perso?.length > 0) && audioEnabled) {
          playAlarm();
        }
      }
    } catch (err) {
      console.error('Errore caricamento piloti fermi:', err);
    }
  };

  const getPilotaInfo = (numero) => {
    const p = piloti.find(p => p.numero_gara === numero);
    return p ? `${p.cognome} ${p.nome}` : `Pilota #${numero}`;
  };

  const loadMessaggi = async () => {
    if (!codiceGara) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/messaggi-piloti/${codiceGara}`);
      const data = await response.json();
      
      if (data.success) {
        setMessaggi(data.messaggi);
        setStats({ non_letti: data.non_letti, sos_attivi: data.sos_attivi });
        
        // Alert sonoro per nuovi SOS
        if (data.sos_attivi > lastSosCount && audioEnabled && lastSosCount > 0) {
          playAlarm();
        }
        setLastSosCount(data.sos_attivi);
      }
    } catch (err) {
      console.error('Errore caricamento messaggi:', err);
    }
  };

  const playAlarm = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const segnaLetto = async (id) => {
    try {
      await fetch(`${API_BASE}/api/messaggi-piloti/${id}/letto`, { method: 'PUT' });
      loadMessaggi();
    } catch (err) {
      console.error('Errore:', err);
    }
  };

  const segnaTuttiLetti = async () => {
    if (!codiceGara) return;
    try {
      await fetch(`${API_BASE}/api/messaggi-piloti/${codiceGara}/letti-tutti`, { method: 'PUT' });
      loadMessaggi();
    } catch (err) {
      console.error('Errore:', err);
    }
  };

  const apriMappa = (lat, lon) => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
  };

  // Filtra messaggi
  const messaggiFiltrati = messaggi.filter(m => {
    if (filtro === 'sos') return m.tipo === 'sos';
    if (filtro === 'non_letti') return !m.letto;
    return true;
  });

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'sos': return '🆘';
      case 'assistenza': return '🔧';
      case 'pericolo': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '💬';
    }
  };

  const getTipoLabel = (tipo) => {
    switch (tipo) {
      case 'sos': return 'EMERGENZA SOS';
      case 'assistenza': return 'Richiesta Assistenza';
      case 'pericolo': return 'Segnalazione Pericolo';
      case 'info': return 'Richiesta Info';
      default: return 'Altro';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('it-IT');
  };

  return (
    <div className="space-y-6">
      {/* Audio Alarm */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19teleGm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+al4yFgX59foKHj5GQi4eCfXx8fYGFiImIhYJ/fX19foGEhoeGhIKAfn5+f4GDhYWFg4KAf39/gIGChYWFhIOBgIB/gIGCg4SEhIOCgYCAf4GBgoODg4ODgoGBgICAgYGCgoKCgoKBgYGAgIGBgoKCgoKCgYGBgIGBgYKCgoKCgYGBgYCBgYGCgoKCgoGBgYGAgYGBgoKCgoKBgYGBgIGBgYKCgoKCgYGBgYCBgYGCgoKCgoGBgYGAgYGBgoKCgoKBgYGBgA==" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            Messaggi Piloti
          </h1>
          <p className="text-gray-600 mt-1">Comunicazioni ricevute dai piloti durante la gara</p>
        </div>

        {/* Alert SOS attivi */}
        {stats.sos_attivi > 0 && (
          <div className="bg-red-100 border-2 border-red-500 rounded-lg px-4 py-3 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-bold text-red-700">{stats.sos_attivi} SOS ATTIVI!</p>
              <p className="text-sm text-red-600">Richieste emergenza in attesa</p>
            </div>
          </div>
        )}
      </div>

      {/* Selezione Evento */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Seleziona Evento</label>
            <select
              value={selectedEvento}
              onChange={(e) => setSelectedEvento(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleziona --</option>
              {eventi.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nome_evento} ({e.codice_gara})
                </option>
              ))}
            </select>
          </div>

          {/* Filtri */}
          <div className="flex gap-2">
            <button
              onClick={() => setFiltro('tutti')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtro === 'tutti' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tutti ({messaggi.length})
            </button>
            <button
              onClick={() => setFiltro('sos')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtro === 'sos' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🆘 SOS ({messaggi.filter(m => m.tipo === 'sos').length})
            </button>
            <button
              onClick={() => setFiltro('non_letti')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtro === 'non_letti' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Non letti ({stats.non_letti})
            </button>
          </div>

          {/* Audio Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-lg ${audioEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
            title={audioEnabled ? 'Audio attivo' : 'Audio disattivato'}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadMessaggi}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Aggiorna"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Segna tutti letti */}
          {stats.non_letti > 0 && (
            <button
              onClick={segnaTuttiLetti}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Segna tutti letti
            </button>
          )}
        </div>
      </div>

      {/* CRITICO: Segnale GPS Perso (telefono rotto/spento) */}
      {pilotiSegnalePerso.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="font-bold text-red-800 text-lg">
              📵 {pilotiSegnalePerso.length} SEGNALE GPS PERSO!
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pilotiSegnalePerso.map((ps, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border-2 border-red-400 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-red-700">#{ps.numero_pilota} {getPilotaInfo(ps.numero_pilota)}</p>
                    <p className="text-red-600 font-medium">
                      Nessun segnale da {ps.minuti_senza_segnale} min!
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps?q=${ps.lat},${ps.lon}`, '_blank')}
                    className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                  >
                    📍 Ultima pos.
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ultima: {parseFloat(ps.lat).toFixed(5)}, {parseFloat(ps.lon).toFixed(5)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NUOVO Chat 21: Allarmi Piloti Fermi */}
      {pilotiFermi.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6 text-orange-600 animate-pulse" />
            <h3 className="font-bold text-orange-800 text-lg">
              ⚠️ {pilotiFermi.length} PILOTI FERMI FUORI PADDOCK
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pilotiFermi.map((pf, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-orange-300 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">#{pf.numero_pilota} {getPilotaInfo(pf.numero_pilota)}</p>
                    <p className="text-orange-700 font-medium">
                      Fermo da {pf.minuti_fermo} minuti
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps?q=${pf.lat},${pf.lon}`, '_blank')}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                  >
                    📍 Mappa
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {parseFloat(pf.lat).toFixed(5)}, {parseFloat(pf.lon).toFixed(5)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista Messaggi */}
      {!codiceGara ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Seleziona un evento per vedere i messaggi dei piloti</p>
        </div>
      ) : messaggiFiltrati.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nessun messaggio {filtro !== 'tutti' ? 'con questo filtro' : 'ricevuto'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messaggiFiltrati.map(msg => (
            <div
              key={msg.id}
              className={`bg-white rounded-lg shadow overflow-hidden ${
                msg.tipo === 'sos' ? 'border-l-4 border-red-500' :
                msg.tipo === 'pericolo' ? 'border-l-4 border-orange-500' :
                'border-l-4 border-blue-500'
              } ${!msg.letto ? 'ring-2 ring-blue-300' : ''}`}
            >
              <div className={`px-4 py-3 ${
                msg.tipo === 'sos' ? 'bg-red-50' :
                msg.tipo === 'pericolo' ? 'bg-orange-50' :
                'bg-gray-50'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTipoIcon(msg.tipo)}</span>
                    <div>
                      <p className={`font-bold ${msg.tipo === 'sos' ? 'text-red-700' : 'text-gray-900'}`}>
                        {getTipoLabel(msg.tipo)}
                      </p>
                      <p className="text-sm text-gray-600">
                        #{msg.numero_pilota} {msg.cognome} {msg.nome} • {msg.classe}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{formatTime(msg.created_at)}</p>
                    <p className="text-xs text-gray-500">{formatDate(msg.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="text-gray-800">{msg.testo}</p>

                {/* GPS e Azioni */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t">
                  {msg.gps_lat && msg.gps_lon ? (
                    <button
                      onClick={() => apriMappa(msg.gps_lat, msg.gps_lon)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <MapPin className="w-4 h-4" />
                      {parseFloat(msg.gps_lat).toFixed(5)}, {parseFloat(msg.gps_lon).toFixed(5)}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">📍 GPS non disponibile</span>
                  )}

                  {!msg.letto ? (
                    <button
                      onClick={() => segnaLetto(msg.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
                    >
                      <Check className="w-4 h-4" />
                      Segna letto
                    </button>
                  ) : (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCheck className="w-4 h-4" />
                      Letto
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Polling */}
      {codiceGara && (
        <p className="text-center text-sm text-gray-500">
          Aggiornamento automatico ogni 10 secondi • Ultimo controllo: {new Date().toLocaleTimeString('it-IT')}
        </p>
      )}
    </div>
  );
}
