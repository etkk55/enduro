import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';
import { pickDefaultEvent, setActiveEventId } from '../utils/activeEvent';
import { Play, Pause, RotateCcw, Flag, AlertTriangle, Navigation, Activity } from 'lucide-react';

// Velocità simulazione (moltiplicatore)
const SPEED_PRESETS = [1, 2, 5, 10];
const PILOTI_COUNT_DEFAULT = 20;
const TRAIL_LEN = 10; // ultime N posizioni per scia
const TICK_MS = 500; // passo simulazione base
const FUORI_PERCORSO_THRESHOLD_M = 50; // > 50m dal tracciato

// Util: distanza Haversine (m)
function distMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Distanza minima punto-polilinea (approssimata via campionamento)
function distToTrack(lat, lon, coords) {
  if (!coords || coords.length === 0) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coords.length; i += 3) {
    const [plon, plat] = coords[i];
    const d = distMeters(lat, lon, plat, plon);
    if (d < min) min = d;
  }
  return min;
}

// Bearing (deg) tra due punti
function bearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Colore per velocità (km/h)
function colorForSpeed(kmh) {
  if (kmh < 5) return '#6b7280';       // grigio (fermo)
  if (kmh < 40) return '#22c55e';      // verde
  if (kmh < 80) return '#f59e0b';      // giallo
  return '#ef4444';                     // rosso veloce
}

// SVG DivIcon generator (restituisce HTML string)
function markerSVG(p) {
  const { numero, stato, heading, speedKmh } = p;
  const col = stato === 'fuori_percorso' ? '#0ea5e9'
           : stato === 'allarme' ? '#dc2626'
           : stato === 'fermo' ? '#9ca3af'
           : colorForSpeed(speedKmh);
  const isMoving = stato === 'in_moto' || stato === 'fuori_percorso';
  const isAlarm = stato === 'allarme';
  const size = isAlarm ? 48 : 36;
  const arrow = isMoving
    ? `<polygon points="18,4 30,28 18,22 6,28" fill="${col}" stroke="#fff" stroke-width="1.5" transform="rotate(${heading} 18 18)" />`
    : `<circle cx="18" cy="18" r="9" fill="${col}" stroke="#fff" stroke-width="2" />`;
  const pulse = isAlarm
    ? `<circle cx="18" cy="18" r="16" fill="none" stroke="${col}" stroke-width="2" opacity="0.8"><animate attributeName="r" values="14;22;14" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></circle>`
    : '';
  return `
    <div class="sim-marker" style="position:relative;width:${size}px;height:${size+14}px;">
      <div style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:3px;border:1px solid ${col};white-space:nowrap;letter-spacing:0.3px;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:2;">#${numero}</div>
      <svg width="${size}" height="${size}" viewBox="0 0 36 36" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);">
        ${pulse}
        ${arrow}
      </svg>
    </div>`;
}

export default function SimulazioneMappa() {
  const [eventi, setEventi] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [tracciato, setTracciato] = useState(null); // GeoJSON LineString
  const [piloti, setPiloti] = useState([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pilotiCount, setPilotiCount] = useState(PILOTI_COUNT_DEFAULT);
  const [flag, setFlag] = useState('verde'); // verde | gialla | rossa
  const [selected, setSelected] = useState(null); // numero pilota per tooltip
  const [alertsCount, setAlertsCount] = useState({ allarmi: 0, fuori: 0, fermi: 0, notifichePush: 0 });

  const mapRef = useRef(null);
  const leafletRef = useRef({ map: null, track: null, markers: new Map(), trails: new Map() });
  const pilotiRef = useRef([]); // stato simulazione senza rerender
  const tickRef = useRef(null);
  const lastNotificatoRef = useRef(new Set()); // id piloti già notificati come fuori percorso

  // Carica eventi
  useEffect(() => {
    fetch(`${API_BASE}/api/eventi`)
      .then(r => r.json())
      .then(data => {
        setEventi(data);
        if (data.length > 0) setEventoId(pickDefaultEvent(data));
      });
  }, []);

  // Carica tracciato al cambio evento
  useEffect(() => {
    if (!eventoId) return;
    const ev = eventi.find(e => e.id === eventoId);
    if (ev) setActiveEventId(eventoId, ev?.codice_gara);
    fetch(`${API_BASE}/api/eventi/${eventoId}/tracciato`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setTracciato(data?.tracciato_geojson || null))
      .catch(() => setTracciato(null));
    resetSimulation();
  }, [eventoId]);

  // Init mappa Leaflet (dynamic import)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current || leafletRef.current.map) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled) return;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([43.0, 12.5], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      leafletRef.current.map = map;
      leafletRef.current.L = L;
    })();
    return () => { cancelled = true; };
  }, []);

  // Disegna tracciato quando caricato
  useEffect(() => {
    const { map, L, track } = leafletRef.current;
    if (!map || !L) return;
    if (track) { map.removeLayer(track); leafletRef.current.track = null; }
    if (!tracciato || !tracciato.geometry?.coordinates) return;
    const coords = tracciato.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const poly = L.polyline(coords, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
    leafletRef.current.track = poly;
    map.fitBounds(poly.getBounds(), { padding: [30, 30] });
  }, [tracciato]);

  function resetSimulation() {
    stopSim();
    pilotiRef.current = [];
    setPiloti([]);
    lastNotificatoRef.current = new Set();
    setAlertsCount({ allarmi: 0, fuori: 0, fermi: 0, notifichePush: 0 });
    // Rimuovi markers/trails
    const lf = leafletRef.current;
    if (lf.map) {
      lf.markers.forEach(m => lf.map.removeLayer(m));
      lf.trails.forEach(t => lf.map.removeLayer(t));
      lf.markers.clear();
      lf.trails.clear();
    }
  }

  function initPiloti() {
    if (!tracciato?.geometry?.coordinates) { alert('Nessun tracciato caricato. Caricalo dalla pagina Mappa.'); return; }
    const coords = tracciato.geometry.coordinates; // [lon,lat]
    const list = [];
    for (let i = 0; i < pilotiCount; i++) {
      const idx = Math.floor((coords.length / pilotiCount) * i);
      const [lon, lat] = coords[idx];
      list.push({
        id: i + 1,
        numero: 10 + i,
        lat, lon,
        heading: 0,
        speedKmh: 40 + Math.random() * 40,
        stato: 'in_moto',
        trackIdx: idx,
        trail: [],
        statoFinoA: 0,
      });
    }
    pilotiRef.current = list;
    setPiloti(list);
  }

  function tick() {
    const lf = leafletRef.current;
    if (!lf.map || !lf.L || !tracciato?.geometry?.coordinates) return;
    const L = lf.L;
    const coords = tracciato.geometry.coordinates;
    const now = Date.now();
    let allarmi = 0, fuori = 0, fermi = 0;

    pilotiRef.current = pilotiRef.current.map(p => {
      // Cambio stato random a intervalli
      if (now > p.statoFinoA) {
        const r = Math.random();
        if (r < 0.03) p.stato = 'allarme';
        else if (r < 0.08) p.stato = 'fuori_percorso';
        else if (r < 0.18) p.stato = 'fermo';
        else p.stato = 'in_moto';
        p.statoFinoA = now + 5000 + Math.random() * 15000;
      }

      const prevLat = p.lat, prevLon = p.lon;

      if (p.stato === 'in_moto') {
        // Avanza lungo il tracciato
        const step = Math.max(1, Math.floor((p.speedKmh / 40) * speed));
        p.trackIdx = (p.trackIdx + step) % coords.length;
        const [lon, lat] = coords[p.trackIdx];
        p.heading = bearing(prevLat, prevLon, lat, lon);
        p.lat = lat; p.lon = lon;
        p.speedKmh = 30 + Math.random() * 60;
      } else if (p.stato === 'fuori_percorso') {
        // Drift casuale fuori dal tracciato
        const drift = 0.0003 * speed;
        p.lat += (Math.random() - 0.5) * drift;
        p.lon += (Math.random() - 0.5) * drift;
        p.heading = bearing(prevLat, prevLon, p.lat, p.lon) || p.heading;
        p.speedKmh = 10 + Math.random() * 20;
        fuori++;
      } else if (p.stato === 'fermo') {
        p.speedKmh = 0;
        fermi++;
      } else if (p.stato === 'allarme') {
        p.speedKmh = 0;
        allarmi++;
      }

      // Trail aggiornato
      p.trail = [...p.trail, [p.lat, p.lon]].slice(-TRAIL_LEN);

      // Aggiorna marker sulla mappa
      let marker = lf.markers.get(p.id);
      const icon = L.divIcon({ html: markerSVG(p), className: 'sim-divicon', iconSize: [36, 50], iconAnchor: [18, 42] });
      if (!marker) {
        marker = L.marker([p.lat, p.lon], { icon }).addTo(lf.map);
        marker.on('click', () => setSelected(p.id));
        lf.markers.set(p.id, marker);
      } else {
        marker.setIcon(icon);
        // Tween: Leaflet non ha nativo. Aggiorno via CSS transition sul layer
        marker.setLatLng([p.lat, p.lon]);
      }

      // Aggiorna trail
      let trail = lf.trails.get(p.id);
      const trailColor = p.stato === 'fuori_percorso' ? '#0ea5e9' : colorForSpeed(p.speedKmh);
      if (trail) lf.map.removeLayer(trail);
      if (p.trail.length >= 2) {
        trail = L.polyline(p.trail, { color: trailColor, weight: 2, opacity: 0.55 }).addTo(lf.map);
        lf.trails.set(p.id, trail);
      }

      return { ...p };
    });

    // Notifica DdG per piloti fuori percorso non ancora notificati
    let notifichePush = alertsCount.notifichePush;
    pilotiRef.current.forEach(p => {
      if (p.stato === 'fuori_percorso' && !lastNotificatoRef.current.has(p.id)) {
        lastNotificatoRef.current.add(p.id);
        notifichePush++;
        inviaNotificaFuoriPercorso(p);
      } else if (p.stato !== 'fuori_percorso' && lastNotificatoRef.current.has(p.id)) {
        lastNotificatoRef.current.delete(p.id);
      }
    });

    setPiloti([...pilotiRef.current]);
    setAlertsCount({ allarmi, fuori, fermi, notifichePush });
  }

  async function inviaNotificaFuoriPercorso(p) {
    const ev = eventi.find(e => e.id === eventoId);
    if (!ev?.codice_gara) return;
    try {
      await fetch(`${API_BASE}/api/app/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codice_accesso: ev.codice_accesso_pubblico || ev.codice_gara,
          numero_pilota: p.numero,
          testo: `[SIMULAZIONE] Pilota #${p.numero} fuori percorso`,
          tipo_emergenza: 'fuori_percorso',
          priorita: 3,
          gps_lat: p.lat,
          gps_lon: p.lon
        })
      });
    } catch (e) { /* non-bloccante */ }
  }

  function startSim() {
    if (pilotiRef.current.length === 0) initPiloti();
    if (tickRef.current) return;
    setRunning(true);
    tickRef.current = setInterval(tick, TICK_MS);
  }

  function stopSim() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setRunning(false);
  }

  useEffect(() => () => stopSim(), []);

  const pilotaSel = piloti.find(p => p.id === selected);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle bg-surface flex-wrap">
        <select
          value={eventoId}
          onChange={e => setEventoId(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-border bg-surface text-sm"
        >
          {eventi.map(e => <option key={e.id} value={e.id}>{e.codice_gara} · {e.nome_evento || ''}</option>)}
        </select>

        <div className="flex items-center gap-1">
          {!running ? (
            <button onClick={startSim} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1">
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          ) : (
            <button onClick={stopSim} className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 flex items-center gap-1">
              <Pause className="w-3.5 h-3.5" /> Pausa
            </button>
          )}
          <button onClick={() => { resetSimulation(); initPiloti(); }} className="px-3 py-1.5 rounded-md bg-surface-2 text-content-primary text-sm font-semibold hover:bg-surface-3 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        <div className="flex items-center gap-1 border-l border-border-subtle pl-3">
          <span className="text-xs text-content-tertiary">Velocità</span>
          {SPEED_PRESETS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-bold ${speed === s ? 'bg-rose-600 text-white' : 'bg-surface-2 text-content-secondary hover:bg-surface-3'}`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-l border-border-subtle pl-3">
          <span className="text-xs text-content-tertiary">Piloti</span>
          <input
            type="number"
            min="1" max="50"
            value={pilotiCount}
            onChange={e => setPilotiCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
            className="w-14 px-2 py-1 rounded border border-border bg-surface text-sm"
          />
        </div>

        <div className="flex items-center gap-1 border-l border-border-subtle pl-3">
          <Flag className="w-4 h-4 text-content-tertiary" />
          {[
            { v: 'verde', label: '🟢', title: 'In corso' },
            { v: 'gialla', label: '🟡', title: 'Neutralizzazione' },
            { v: 'rossa', label: '🔴', title: 'Bandiera rossa' },
          ].map(f => (
            <button
              key={f.v}
              title={f.title}
              onClick={() => setFlag(f.v)}
              className={`px-2 py-1 rounded text-base ${flag === f.v ? 'bg-surface-3' : 'hover:bg-surface-2'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-rose-600"><AlertTriangle className="w-3 h-3" /> {alertsCount.allarmi}</span>
          <span className="flex items-center gap-1 text-sky-600"><Navigation className="w-3 h-3" /> {alertsCount.fuori}</span>
          <span className="flex items-center gap-1 text-gray-500"><Activity className="w-3 h-3" /> {alertsCount.fermi}</span>
          <span className="text-content-tertiary">Push DdG: <b>{alertsCount.notifichePush}</b></span>
        </div>
      </header>

      {/* Flag banner */}
      {flag !== 'verde' && (
        <div className={`text-center text-sm font-bold py-1.5 ${flag === 'gialla' ? 'bg-yellow-500 text-yellow-900' : 'bg-red-600 text-white'}`}>
          {flag === 'gialla' ? '🟡 NEUTRALIZZAZIONE — Rallentare, nessun sorpasso' : '🔴 BANDIERA ROSSA — Rientrare ai box/Fermarsi in sicurezza'}
        </div>
      )}

      {/* Mappa */}
      <div className="relative flex-1">
        <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 420 }} />

        {/* Tooltip pilota selezionato */}
        {pilotaSel && (
          <div className="absolute top-4 right-4 w-64 bg-surface border border-border-subtle rounded-xl shadow-xl p-4 z-[400]">
            <div className="flex items-start justify-between mb-2">
              <div className="font-bold text-lg">#{pilotaSel.numero}</div>
              <button onClick={() => setSelected(null)} className="text-content-tertiary text-xs">✕</button>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-content-tertiary">Stato</span><span className="font-semibold">{pilotaSel.stato}</span></div>
              <div className="flex justify-between"><span className="text-content-tertiary">Velocità</span><span className="font-mono">{pilotaSel.speedKmh.toFixed(0)} km/h</span></div>
              <div className="flex justify-between"><span className="text-content-tertiary">Heading</span><span className="font-mono">{pilotaSel.heading.toFixed(0)}°</span></div>
              <div className="flex justify-between"><span className="text-content-tertiary">GPS</span><span className="font-mono text-xs">{pilotaSel.lat.toFixed(4)}, {pilotaSel.lon.toFixed(4)}</span></div>
            </div>
          </div>
        )}

        {!tracciato && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-xl p-6 max-w-md text-center">
              <Navigation className="w-10 h-10 text-content-tertiary mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-2">Tracciato non caricato</h3>
              <p className="text-sm text-content-secondary mb-3">Carica il tracciato GPX dell'evento nella pagina <strong>Mappa Tracciato</strong> per avviare la simulazione.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
