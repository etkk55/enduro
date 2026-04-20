import { useEffect, useState, useRef } from 'react';
import { API_BASE } from '../services/api';
import { pickDefaultEvent, setActiveEventId } from '../utils/activeEvent';
import { MapPin, Upload, Trash2, X, Search, RefreshCw, Users, Route as RouteIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { gpx } from '@tmcw/togeojson';

// Fix Leaflet icone di default (bug noto con Vite bundler)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Colori distinti per piloti selezionati
const PILOT_COLORS = ['#ef476f', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c', '#c084fc', '#84cc16'];

function makeMarkerIcon(numero, color) {
  const html = `
    <div style="background:${color}; color:#fff; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; border:3px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.4); font-family: 'JetBrains Mono', monospace;">
      ${numero}
    </div>`;
  return L.divIcon({
    className: 'pilot-marker',
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function Mappa() {
  const [eventi, setEventi] = useState([]);
  const [eventoSelezionato, setEventoSelezionato] = useState('');
  const [tabAttivo, setTabAttivo] = useState('live'); // 'live' | 'tracciato'
  const [tracciatoInfo, setTracciatoInfo] = useState(null);
  const [piloti, setPiloti] = useState([]);
  const [posizioniPiloti, setPosizioniPiloti] = useState({});  // {numero: {lat, lon, aggiornato}}
  const [pilotiSelezionati, setPilotiSelezionati] = useState([]);
  const [addetti, setAddetti] = useState([]);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  // Carica eventi al mount
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(r => r.json())
      .then(data => {
        setEventi(data);
        if (data.length > 0 && !eventoSelezionato) {
          setEventoSelezionato(pickDefaultEvent(data));
        }
      });
  }, []);

  // Memorizza evento attivo
  useEffect(() => {
    if (eventoSelezionato && eventi.length > 0) {
      const ev = eventi.find(e => e.id === eventoSelezionato);
      setActiveEventId(eventoSelezionato, ev?.codice_gara);
    }
  }, [eventoSelezionato, eventi]);

  // Carica dati evento (tracciato + piloti + addetti)
  useEffect(() => {
    if (!eventoSelezionato) return;
    caricaTracciato();
    caricaPiloti();
    caricaAddetti();
    caricaPosizioni();
  }, [eventoSelezionato]);

  // Polling live posizioni piloti (ogni 15s se tab=live)
  useEffect(() => {
    if (!eventoSelezionato || tabAttivo !== 'live') return;
    const interval = setInterval(() => {
      caricaPosizioni();
      caricaAddetti();
    }, 15000);
    return () => clearInterval(interval);
  }, [eventoSelezionato, tabAttivo]);

  async function caricaTracciato() {
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/tracciato`);
      const data = await res.json();
      setTracciatoInfo(data);
    } catch (err) { console.error(err); }
  }

  async function caricaPiloti() {
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/piloti`);
      const data = await res.json();
      setPiloti(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); setPiloti([]); }
  }

  async function caricaAddetti() {
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/addetti-live`);
      const data = await res.json();
      setAddetti(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); setAddetti([]); }
  }

  async function caricaPosizioni() {
    try {
      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/posizioni-piloti`);
      const data = await res.json();
      const map = {};
      if (Array.isArray(data)) {
        data.forEach(p => {
          if (p.numero != null) map[String(p.numero)] = p;
        });
      }
      setPosizioniPiloti(map);
    } catch (err) {
      console.error(err);
      setPosizioniPiloti({});
    }
  }

  async function handleGpxUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const geojson = gpx(xml);
      if (!geojson || !geojson.features || geojson.features.length === 0) {
        alert('File GPX non valido o vuoto');
        return;
      }

      const res = await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/tracciato`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracciato_geojson: geojson, tracciato_nome: file.name })
      });
      if (!res.ok) throw new Error('Errore salvataggio');
      caricaTracciato();
      alert('✅ Tracciato caricato e salvato');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
    setUploading(false);
  }

  async function rimuoviTracciato() {
    if (!confirm('Rimuovere il tracciato salvato?')) return;
    await fetch(`${API_BASE}/api/eventi/${eventoSelezionato}/tracciato`, { method: 'DELETE' });
    caricaTracciato();
  }

  const pilotiFiltered = piloti.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return String(p.numero_gara).includes(q) ||
           (p.cognome || '').toLowerCase().includes(q) ||
           (p.nome || '').toLowerCase().includes(q);
  }).slice(0, 50);

  function togglePilota(p) {
    const numero = String(p.numero_gara);
    setPilotiSelezionati(prev => {
      const idx = prev.findIndex(x => x.numero === numero);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= 10) {
        alert('Massimo 10 piloti selezionabili');
        return prev;
      }
      return [...prev, { numero, cognome: p.cognome, nome: p.nome, classe: p.classe }];
    });
  }

  const isPilotaSelezionato = (num) => pilotiSelezionati.some(x => x.numero === String(num));

  return (
    <div className="p-6 max-w-full mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mappa del Tracciato</h1>
            <p className="text-sm text-content-secondary">Carica il GPX e visualizza piloti/addetti live su mappa OpenStreetMap</p>
          </div>
        </div>
        <select
          value={eventoSelezionato}
          onChange={e => setEventoSelezionato(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm min-w-[260px]"
        >
          {eventi.map(e => (
            <option key={e.id} value={e.id}>{e.codice_gara} · {e.nome_evento}</option>
          ))}
        </select>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          onClick={() => setTabAttivo('live')}
          className={`px-4 py-2 font-semibold text-sm ${tabAttivo === 'live' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-content-tertiary'}`}
        >
          <MapPin className="w-4 h-4 inline mr-1" /> Mappa Live
        </button>
        <button
          onClick={() => setTabAttivo('tracciato')}
          className={`px-4 py-2 font-semibold text-sm ${tabAttivo === 'tracciato' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-content-tertiary'}`}
        >
          <RouteIcon className="w-4 h-4 inline mr-1" /> Gestione Tracciato GPX
        </button>
      </div>

      {tabAttivo === 'tracciato' && (
        <GpxTab
          tracciatoInfo={tracciatoInfo}
          uploading={uploading}
          onUpload={handleGpxUpload}
          onDelete={rimuoviTracciato}
        />
      )}

      {tabAttivo === 'live' && eventoSelezionato && (
        <LiveTab
          tracciatoGeojson={tracciatoInfo?.tracciato_geojson}
          piloti={piloti}
          addetti={addetti}
          posizioniPiloti={posizioniPiloti}
          pilotiSelezionati={pilotiSelezionati}
          togglePilota={togglePilota}
          isPilotaSelezionato={isPilotaSelezionato}
          pilotiFiltered={pilotiFiltered}
          query={query}
          setQuery={setQuery}
          onRefresh={() => { caricaPosizioni(); caricaAddetti(); }}
        />
      )}
    </div>
  );
}

function GpxTab({ tracciatoInfo, uploading, onUpload, onDelete }) {
  const fileRef = useRef();
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="bg-surface border border-border-subtle rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5" /> Upload tracciato GPX
        </h2>
        <p className="text-sm text-content-tertiary mb-4">
          Carica il file GPX del tracciato di gara. Nelle gare enduro di solito ti viene fornito
          dall'organizzatore o può essere esportato da Strava/Komoot/Garmin.
        </p>
        <div
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onUpload(f); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-emerald-400 rounded-lg p-8 text-center cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <p className="font-semibold text-content-primary mb-1">
            {uploading ? 'Caricamento…' : 'Trascina qui il file GPX o clicca per selezionarlo'}
          </p>
          <p className="text-xs text-content-tertiary">File .gpx esportato da Garmin, Strava, Komoot…</p>
          <input
            ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
          />
        </div>
      </section>

      <section className="bg-surface border border-border-subtle rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3">Tracciato attuale</h2>
        {tracciatoInfo?.tracciato_geojson ? (
          <>
            <div className="text-sm space-y-2 mb-4">
              <p>📁 <strong>File:</strong> {tracciatoInfo.tracciato_nome || '(senza nome)'}</p>
              <p>🕒 <strong>Caricato:</strong> {tracciatoInfo.tracciato_updated_at ? new Date(tracciatoInfo.tracciato_updated_at).toLocaleString('it-IT') : '-'}</p>
              <p>📍 <strong>Punti:</strong> {tracciatoInfo.tracciato_geojson.features?.reduce((sum, f) => sum + (f.geometry?.coordinates?.length || 0), 0) || 0}</p>
            </div>
            <MappaPreview geojson={tracciatoInfo.tracciato_geojson} />
            <button
              onClick={onDelete}
              className="mt-4 px-4 py-2 rounded-md bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> Rimuovi tracciato
            </button>
          </>
        ) : (
          <p className="text-content-tertiary text-sm italic">Nessun tracciato caricato per questo evento.</p>
        )}
      </section>
    </div>
  );
}

function MappaPreview({ geojson }) {
  const ref = useRef();
  const mapRef = useRef();
  useEffect(() => {
    if (!ref.current || !geojson) return;
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    // Pulisci layer esistenti (eccetto tile)
    map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
    const layer = L.geoJSON(geojson, {
      style: { color: '#ef476f', weight: 4, opacity: 0.85 }
    }).addTo(map);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
  }, [geojson]);
  return <div ref={ref} style={{ height: 260, borderRadius: 8, overflow: 'hidden' }} />;
}

function LiveTab({ tracciatoGeojson, piloti, addetti, posizioniPiloti, pilotiSelezionati, togglePilota, isPilotaSelezionato, pilotiFiltered, query, setQuery, onRefresh }) {
  const mapContainerRef = useRef();
  const mapRef = useRef();
  const markersRef = useRef(new Map()); // key: "p:<numero>" or "a:<id>"

  // Init mappa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, {
      center: [45.5, 11.5], // default nord Italia
      zoom: 8
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, []);

  // Render tracciato
  useEffect(() => {
    if (!mapRef.current || !tracciatoGeojson) return;
    const map = mapRef.current;
    // Rimuovi tracciato precedente
    map.eachLayer(l => {
      if (l instanceof L.GeoJSON) map.removeLayer(l);
    });
    const layer = L.geoJSON(tracciatoGeojson, {
      style: { color: '#ef476f', weight: 4, opacity: 0.75 }
    }).addTo(map);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }, [tracciatoGeojson]);

  // Render markers piloti + addetti
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const markers = markersRef.current;

    // Piloti selezionati
    pilotiSelezionati.forEach((p, idx) => {
      const pos = posizioniPiloti[p.numero];
      const key = `p:${p.numero}`;
      if (!pos || pos.lat == null || pos.lon == null) {
        const existing = markers.get(key);
        if (existing) { map.removeLayer(existing); markers.delete(key); }
        return;
      }
      const color = PILOT_COLORS[idx % PILOT_COLORS.length];
      const icon = makeMarkerIcon(p.numero, color);
      const latlng = [parseFloat(pos.lat), parseFloat(pos.lon)];
      const existing = markers.get(key);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
      } else {
        const m = L.marker(latlng, { icon })
          .bindPopup(`<strong>#${p.numero} ${p.cognome || ''} ${p.nome || ''}</strong><br>${p.classe || ''}${pos.aggiornato ? '<br><small>Agg: ' + new Date(pos.aggiornato).toLocaleTimeString('it-IT') + '</small>' : ''}`)
          .addTo(map);
        markers.set(key, m);
      }
    });
    // Rimuovi piloti deselezionati
    markers.forEach((m, key) => {
      if (key.startsWith('p:')) {
        const num = key.slice(2);
        if (!pilotiSelezionati.some(p => p.numero === num)) {
          map.removeLayer(m);
          markers.delete(key);
        }
      }
    });

    // Addetti (sempre visibili, colore per ruolo)
    const ruoloCol = { medico: '#ec4899', resp_ps: '#f59e0b', resp_trasf: '#3b82f6', addetto: '#6b7280' };
    const ruoloIco = { medico: '🩺', resp_ps: '🏁', resp_trasf: '🛣️', addetto: '👷' };
    addetti.forEach(a => {
      const key = `a:${a.id}`;
      if (a.ultima_lat == null || a.ultima_lon == null) {
        const existing = markers.get(key);
        if (existing) { map.removeLayer(existing); markers.delete(key); }
        return;
      }
      const latlng = [parseFloat(a.ultima_lat), parseFloat(a.ultima_lon)];
      const color = ruoloCol[a.ruolo] || '#6b7280';
      const emoji = ruoloIco[a.ruolo] || '👷';
      const html = `<div style="background:${color}; color:#fff; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:3px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.4); font-size:14px;">${emoji}</div>`;
      const icon = L.divIcon({ className: 'addetto-marker', html, iconSize: [30, 30], iconAnchor: [15, 15] });
      const existing = markers.get(key);
      if (existing) {
        existing.setLatLng(latlng);
      } else {
        const m = L.marker(latlng, { icon })
          .bindPopup(`<strong>${emoji} ${a.nome} ${a.cognome}</strong><br>${a.nome_ps || a.nome_settore || ''}<br>${a.telefono ? '📞 ' + a.telefono : ''}${a.online ? '<br>🟢 Online' : ''}`)
          .addTo(map);
        markers.set(key, m);
      }
    });
  }, [pilotiSelezionati, posizioniPiloti, addetti]);

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4" style={{ minHeight: 600 }}>
      {/* Sidebar: selezione piloti */}
      <section className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col">
        <h3 className="font-semibold mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Piloti da tracciare</span>
          <button onClick={onRefresh} className="p-1 hover:bg-surface-2 rounded" title="Aggiorna posizioni">
            <RefreshCw className="w-4 h-4 text-content-tertiary" />
          </button>
        </h3>
        {pilotiSelezionati.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3 pb-3 border-b border-border-subtle">
            {pilotiSelezionati.map((p, i) => (
              <span key={p.numero} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-white" style={{ background: PILOT_COLORS[i % PILOT_COLORS.length] }}>
                #{p.numero} {p.cognome}
                <button onClick={() => togglePilota({ numero_gara: p.numero })} className="ml-1 hover:bg-black/20 rounded-full">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
          <input
            type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca # o cognome"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-surface text-sm"
          />
        </div>
        <div className="overflow-y-auto flex-1" style={{ maxHeight: 500 }}>
          {pilotiFiltered.map(p => {
            const sel = isPilotaSelezionato(p.numero_gara);
            const pos = posizioniPiloti[String(p.numero_gara)];
            return (
              <button
                key={p.id}
                onClick={() => togglePilota(p)}
                className={`w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 ${sel ? 'bg-emerald-100 dark:bg-emerald-950 border border-emerald-500' : 'hover:bg-surface-2 border border-transparent'}`}
              >
                <span className="text-xs font-mono font-bold w-10">#{p.numero_gara}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.cognome} {p.nome}</div>
                  <div className="text-xs text-content-tertiary truncate">{p.classe || ''} {pos ? '· 📍' : ''}</div>
                </div>
              </button>
            );
          })}
          {pilotiFiltered.length === 0 && <p className="text-xs text-content-tertiary text-center p-4">Nessun pilota trovato</p>}
        </div>
      </section>

      {/* Mappa */}
      <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div ref={mapContainerRef} style={{ height: 600, width: '100%' }} />
      </section>
    </div>
  );
}
