import { useEffect, useState } from 'react';
import { Users, MapPin, RefreshCw } from 'lucide-react';

import { API_BASE as _API_BASE } from '../services/api';
const API_URL = `${_API_BASE}/api`;

export default function Piloti() {
  const [piloti, setPiloti] = useState([]);
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [posizioniGPS, setPosizioniGPS] = useState({});
  const [caricandoGPS, setCaricandoGPS] = useState(false);

  useEffect(() => {
    // Carica eventi
    fetch(`${API_URL}/eventi`)
      .then(res => res.json())
      .then(data => setEventi(data))
      .catch(err => console.error('Errore caricamento eventi:', err));
  }, []);

  useEffect(() => {
    // Carica piloti
    fetch(`${API_URL}/piloti`)
      .then(res => res.json())
      .then(data => setPiloti(data))
      .catch(err => console.error('Errore caricamento piloti:', err));
  }, []);

  // Carica posizioni GPS quando cambia evento
  useEffect(() => {
    if (!eventoSelezionato) {
      setPosizioniGPS({});
      return;
    }
    
    caricaPosizioniGPS();
    
    // Polling ogni 30 secondi
    const interval = setInterval(caricaPosizioniGPS, 30000);
    return () => clearInterval(interval);
  }, [eventoSelezionato]);

  const caricaPosizioniGPS = async () => {
    if (!eventoSelezionato) return;
    
    setCaricandoGPS(true);
    try {
      const res = await fetch(`${API_URL}/eventi/${eventoSelezionato}/posizioni-piloti`);
      const data = await res.json();
      
      if (data.success && data.posizioni) {
        // Converti in oggetto per lookup veloce
        const posMap = {};
        data.posizioni.forEach(p => {
          posMap[p.numero_pilota] = p;
        });
        setPosizioniGPS(posMap);
      }
    } catch (err) {
      console.error('Errore caricamento posizioni:', err);
    }
    setCaricandoGPS(false);
  };

  // Calcola tempo trascorso
  const tempoTrascorso = (timestamp) => {
    if (!timestamp) return '-';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'ora';
    if (diffMin < 60) return `${diffMin} min fa`;
    const diffOre = Math.floor(diffMin / 60);
    if (diffOre < 24) return `${diffOre}h fa`;
    return `${Math.floor(diffOre / 24)}g fa`;
  };

  useEffect(() => {
    // Carica eventi
    fetch(`${API_URL}/eventi`)
      .then(res => res.json())
      .then(data => setEventi(data))
      .catch(err => console.error('Errore caricamento eventi:', err));
  }, []);

  useEffect(() => {
    // Carica piloti
    fetch(`${API_URL}/piloti`)
      .then(res => res.json())
      .then(data => setPiloti(data))
      .catch(err => console.error('Errore caricamento piloti:', err));
  }, []);

  // Filtra piloti per evento
  const pilotiFiltrati = eventoSelezionato
    ? piloti.filter(p => String(p.id_evento) === String(eventoSelezionato))
    : piloti;

  return (
    <div className="page">
      <h1>Gestione Piloti</h1>
      
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontWeight: '500' }}>Filtra per evento:</label>
          <select 
            value={eventoSelezionato}
            onChange={(e) => setEventoSelezionato(e.target.value)}
            style={{ 
              padding: '0.5rem', 
              borderRadius: '8px', 
              border: '1px solid #cbd5e0',
              minWidth: '250px'
            }}
          >
            <option value="">Tutti gli eventi</option>
            {eventi.map(evento => (
              <option key={evento.id} value={evento.id}>
                {evento.nome_evento}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Piloti Registrati ({pilotiFiltrati.length})</h2>
          {eventoSelezionato && (
            <button
              onClick={caricaPosizioniGPS}
              disabled={caricandoGPS}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                opacity: caricandoGPS ? 0.7 : 1
              }}
            >
              <RefreshCw size={16} className={caricandoGPS ? 'animate-spin' : ''} />
              Aggiorna GPS
            </button>
          )}
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Nome</th>
                <th>Cognome</th>
                <th>Email</th>
                <th>Evento</th>
                {eventoSelezionato && <th>📍 Ultima Posizione GPS</th>}
              </tr>
            </thead>
            <tbody>
              {pilotiFiltrati.map(pilota => {
                const evento = eventi.find(e => e.id === pilota.id_evento);
                const posGPS = posizioniGPS[pilota.numero_gara];
                return (
                  <tr key={pilota.id}>
                    <td>{pilota.numero_gara}</td>
                    <td>{pilota.nome}</td>
                    <td>{pilota.cognome}</td>
                    <td>{pilota.email || '-'}</td>
                    <td>{evento?.nome_evento || '-'}</td>
                    {eventoSelezionato && (
                      <td>
                        {posGPS ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a 
                              href={`https://www.google.com/maps?q=${posGPS.lat},${posGPS.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#4ade80', textDecoration: 'none' }}
                            >
                              📍 {parseFloat(posGPS.lat).toFixed(5)}, {parseFloat(posGPS.lon).toFixed(5)}
                            </a>
                            <span style={{ color: '#888', fontSize: '12px' }}>
                              ({tempoTrascorso(posGPS.created_at)})
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#666' }}>-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
