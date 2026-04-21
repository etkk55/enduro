import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';
import { pickDefaultEvent, setActiveEventId } from '../utils/activeEvent';
import { Play, Pause, RotateCcw, AlertTriangle, Navigation, Activity } from 'lucide-react';

// Velocità simulazione (moltiplicatore)
const SPEED_PRESETS = [1, 2, 5, 10];
const PILOTI_COUNT_DEFAULT = 5;
const TRAIL_LEN = 14; // ultime N posizioni per scia
const TICK_MS = 80;  // polling rapido per movimento fluido

// Dati fittizi piloti per la simulazione
const NOMI_FAKE = [
  { nome: 'Marco', cognome: 'Rossi' }, { nome: 'Luca', cognome: 'Bianchi' },
  { nome: 'Andrea', cognome: 'Verdi' }, { nome: 'Paolo', cognome: 'Neri' },
  { nome: 'Giovanni', cognome: 'Russo' }, { nome: 'Matteo', cognome: 'Ferrari' },
  { nome: 'Alessandro', cognome: 'Esposito' }, { nome: 'Francesco', cognome: 'Romano' },
  { nome: 'Simone', cognome: 'Colombo' }, { nome: 'Davide', cognome: 'Ricci' },
  { nome: 'Enrico', cognome: 'Bruno' }, { nome: 'Fabio', cognome: 'Gallo' },
  { nome: 'Riccardo', cognome: 'Conti' }, { nome: 'Stefano', cognome: 'De Luca' },
  { nome: 'Michele', cognome: 'Mancini' }, { nome: 'Tommaso', cognome: 'Costa' },
  { nome: 'Nicola', cognome: 'Greco' }, { nome: 'Giulio', cognome: 'Bruno' },
  { nome: 'Daniele', cognome: 'Marino' }, { nome: 'Federico', cognome: 'Leone' },
  { nome: 'Emanuele', cognome: 'Villa' }, { nome: 'Lorenzo', cognome: 'Galli' },
  { nome: 'Filippo', cognome: 'Pellegrini' }, { nome: 'Giorgio', cognome: 'Fontana' },
  { nome: 'Roberto', cognome: 'Sanna' }, { nome: 'Carlo', cognome: 'Parisi' },
  { nome: 'Valerio', cognome: 'Serra' }, { nome: 'Alberto', cognome: 'Lombardi' },
  { nome: 'Mirko', cognome: 'Martini' }, { nome: 'Samuele', cognome: 'Barbieri' },
];
const CLASSI = ['Major', 'Expert', 'Sport', 'Junior'];
const CLASSE_COLOR = { Major: '#dc2626', Expert: '#d97706', Sport: '#2563eb', Junior: '#10b981' };
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

// Colore fisso per stato (velocità non più usata per il colore)
const COLOR_IN_MOTO = '#ef4444';   // rosso
const COLOR_FERMO   = '#9ca3af';   // grigio
const COLOR_FUORI   = '#0ea5e9';   // azzurro
const COLOR_ALLARME = '#dc2626';   // rosso scuro

// SVG DivIcon generator (restituisce HTML string) - colore fisso per stato
function markerSVG(p) {
  const { numero, stato, heading } = p;
  const col = stato === 'fuori_percorso' ? COLOR_FUORI
           : stato === 'allarme' ? COLOR_ALLARME
           : stato === 'fermo' ? COLOR_FERMO
           : COLOR_IN_MOTO;
  const isMoving = stato === 'in_moto' || stato === 'fuori_percorso';
  const isAlarm = stato === 'allarme';
  const size = isAlarm ? 56 : 44;
  const arrow = isMoving
    ? `<polygon points="22,4 38,36 22,27 6,36" fill="${col}" stroke="#fff" stroke-width="2.2" transform="rotate(${heading} 22 22)" />`
    : `<circle cx="22" cy="22" r="11" fill="${col}" stroke="#fff" stroke-width="2.8" />`;
  const pulse = isAlarm
    ? `<circle cx="22" cy="22" r="20" fill="none" stroke="${col}" stroke-width="2" opacity="0.8"><animate attributeName="r" values="18;28;18" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></circle>`
    : '';
  // Numero GRANDE e ben leggibile: 18px bold bianco, fondo scuro, bordo colorato
  return `
    <div class="sim-marker" style="position:relative;width:${Math.max(size,58)}px;height:${size+28}px;">
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:18px;font-weight:900;padding:3px 10px;border-radius:6px;border:2.5px solid ${col};white-space:nowrap;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.6);z-index:2;line-height:1;">#${numero}</div>
      <svg width="${size}" height="${size}" viewBox="0 0 44 44" style="position:absolute;top:26px;left:50%;transform:translateX(-50%);">
        ${pulse}
        ${arrow}
      </svg>
    </div>`;
}

export default function SimulazioneMappa() {
  const [eventi, setEventi] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [tracciato, setTracciato] = useState(null); // Coordinates [[lon,lat], ...]
  const [piloti, setPiloti] = useState([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pilotiCount, setPilotiCount] = useState(PILOTI_COUNT_DEFAULT);
  const [selected, setSelected] = useState(null); // numero pilota per tooltip
  const [mapReady, setMapReady] = useState(false);
  const [alertsCount, setAlertsCount] = useState({ allarmi: 0, fuori: 0, fermi: 0, notifichePush: 0 });

  const mapRef = useRef(null);
  const leafletRef = useRef({ map: null, track: null, markers: new Map(), trails: new Map() });
  const pilotiRef = useRef([]); // stato simulazione senza rerender
  const tickRef = useRef(null);
  const lastNotificatoRef = useRef(new Set()); // id piloti già notificati come fuori percorso
  const speedRef = useRef(1); // letto dentro tick per evitare stale closure
  useEffect(() => { speedRef.current = speed; }, [speed]);

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
      .then(data => {
        const g = data?.tracciato_geojson;
        if (!g) { setTracciato(null); return; }
        // Accetta FeatureCollection (salvato da Mappa.jsx), Feature singolo, o LineString diretta
        let coords = null;
        if (g.type === 'FeatureCollection' && Array.isArray(g.features)) {
          const line = g.features.find(f => f?.geometry?.type === 'LineString')
                   || g.features.find(f => f?.geometry?.type === 'MultiLineString');
          if (line) {
            coords = line.geometry.type === 'MultiLineString'
              ? line.geometry.coordinates.flat()
              : line.geometry.coordinates;
          }
        } else if (g.type === 'Feature' && g.geometry?.coordinates) {
          coords = g.geometry.type === 'MultiLineString' ? g.geometry.coordinates.flat() : g.geometry.coordinates;
        } else if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
          coords = g.coordinates;
        } else if (Array.isArray(g.coordinates)) {
          coords = g.coordinates;
        }
        setTracciato(coords && coords.length > 1 ? coords : null);
      })
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
      setMapReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Disegna tracciato e zoom automatico quando sia mappa che tracciato sono pronti
  useEffect(() => {
    if (!mapReady) return;
    const { map, L, track } = leafletRef.current;
    if (!map || !L) return;
    if (track) { map.removeLayer(track); leafletRef.current.track = null; }
    if (!tracciato) return;
    const latlngs = tracciato.map(([lon, lat]) => [lat, lon]);
    const poly = L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
    leafletRef.current.track = poly;
    map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    // Safety: se la mappa non è ancora dimensionata correttamente, ri-fit dopo un tick
    setTimeout(() => { try { map.invalidateSize(); map.fitBounds(poly.getBounds(), { padding: [30, 30] }); } catch(e){} }, 150);
  }, [tracciato, mapReady]);

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

  function makeFakePilot(id, numero, idx, coords) {
    const [lon, lat] = coords[idx];
    const p = NOMI_FAKE[Math.floor(Math.random() * NOMI_FAKE.length)];
    return {
      id,
      numero,
      nome: p.nome,
      cognome: p.cognome,
      classe: CLASSI[Math.floor(Math.random() * CLASSI.length)],
      lat, lon,
      heading: 0,
      speedKmh: 40 + Math.random() * 40,
      stato: 'in_moto',
      trackIdx: idx,
      trail: [],
      statoFinoA: 0,
      progress: 0, // metrica usata per il ranking
      fpOffset: null,
    };
  }

  function initPiloti() {
    if (!tracciato || tracciato.length === 0) { alert('Nessun tracciato caricato. Caricalo dalla pagina Mappa.'); return; }
    const coords = tracciato;
    const list = [];
    for (let i = 0; i < pilotiCount; i++) {
      const idx = Math.floor(Math.random() * coords.length);
      list.push(makeFakePilot(i + 1, 10 + i, idx, coords));
    }
    pilotiRef.current = list;
    setPiloti(list);
  }

  function tick() {
    const lf = leafletRef.current;
    if (!lf.map || !lf.L || !tracciato) return;
    const L = lf.L;
    const coords = tracciato;
    const now = Date.now();
    let allarmi = 0, fuori = 0, fermi = 0;

    // Base: 1x ora molto lento (~0.018% tracciato per tick 80ms).
    const currentSpeed = speedRef.current;
    const baseStepPct = 0.00018 * currentSpeed;
    const baseStep = Math.max(1, Math.floor(coords.length * baseStepPct));
    // Lookahead per calcolo bearing: guarda avanti N punti per smoothare la direzione
    const lookahead = Math.max(3, Math.floor(coords.length * 0.005));

    pilotiRef.current = pilotiRef.current.map(p => {
      // Cambio stato random a intervalli
      if (now > p.statoFinoA) {
        const r = Math.random();
        if (r < 0.02) p.stato = 'allarme';
        else if (r < 0.06) p.stato = 'fuori_percorso';
        else if (r < 0.14) p.stato = 'fermo';
        else p.stato = 'in_moto';
        p.statoFinoA = now + 4000 + Math.random() * 12000;
      }

      const prevLat = p.lat, prevLon = p.lon;

      if (p.stato === 'in_moto') {
        // Avanza in SENSO ORARIO (index crescente su questo tracciato)
        const jitter = 0.75 + Math.random() * 0.5;
        const step = Math.max(1, Math.floor(baseStep * jitter));
        p.trackIdx = (p.trackIdx + step) % coords.length;
        p.progress = (p.progress || 0) + step;
        const [lon, lat] = coords[p.trackIdx];
        p.lat = lat; p.lon = lon;
        // Bearing target calcolato guardando avanti `lookahead` punti (evita rumore corte)
        const aheadIdx = (p.trackIdx + lookahead) % coords.length;
        const [aLon, aLat] = coords[aheadIdx];
        const targetHeading = bearing(lat, lon, aLat, aLon);
        // Smoothing angolare: EMA con weight 0.15 sul nuovo valore, considerando wrap 0/360
        const prev = p.heading ?? targetHeading;
        let delta = targetHeading - prev;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        p.heading = (prev + delta * 0.15 + 360) % 360;
        p.speedKmh = 30 + Math.random() * 60;
        p.fpOffset = null;
      } else if (p.stato === 'fuori_percorso') {
        // Sta fermo appena fuori dal tracciato (offset fisso ~20-60m perpendicolare al bearing)
        if (!p.fpOffset) {
          // Calcola offset perpendicolare alla direzione corrente
          const angle = ((p.heading || 0) + 90) * Math.PI / 180; // 90° a destra del moto
          const offsetM = (20 + Math.random() * 40) * (Math.random() < 0.5 ? 1 : -1);
          // 1 grado lat ≈ 111km; lon dipende da cos(lat)
          const [lon0, lat0] = coords[p.trackIdx];
          const dLat = (offsetM * Math.cos(angle)) / 111000;
          const dLon = (offsetM * Math.sin(angle)) / (111000 * Math.cos(lat0 * Math.PI / 180));
          p.fpOffset = { dLat, dLon };
          p.lat = lat0 + dLat;
          p.lon = lon0 + dLon;
        }
        // Jitter minimo per sembrare vivo
        p.lat += (Math.random() - 0.5) * 0.00002;
        p.lon += (Math.random() - 0.5) * 0.00002;
        p.speedKmh = 5 + Math.random() * 10;
        fuori++;
      } else if (p.stato === 'fermo') {
        p.speedKmh = 0;
        p.fpOffset = null;
        fermi++;
      } else if (p.stato === 'allarme') {
        p.speedKmh = 0;
        p.fpOffset = null;
        allarmi++;
      }

      // Trail aggiornato
      p.trail = [...p.trail, [p.lat, p.lon]].slice(-TRAIL_LEN);

      // Aggiorna marker sulla mappa
      let marker = lf.markers.get(p.id);
      const icon = L.divIcon({ html: markerSVG(p), className: 'sim-divicon', iconSize: [52, 74], iconAnchor: [26, 56] });
      if (!marker) {
        marker = L.marker([p.lat, p.lon], { icon }).addTo(lf.map);
        marker.on('click', () => setSelected(p.id));
        lf.markers.set(p.id, marker);
      } else {
        marker.setIcon(icon);
        // Tween: Leaflet non ha nativo. Aggiorno via CSS transition sul layer
        marker.setLatLng([p.lat, p.lon]);
      }

      // Aggiorna trail (colore fisso rosso/azzurro/grigio per stato)
      let trail = lf.trails.get(p.id);
      const trailColor = p.stato === 'fuori_percorso' ? COLOR_FUORI
                      : p.stato === 'fermo' || p.stato === 'allarme' ? COLOR_FERMO
                      : COLOR_IN_MOTO;
      if (trail) lf.map.removeLayer(trail);
      if (p.trail.length >= 2) {
        trail = L.polyline(p.trail, { color: trailColor, weight: 2.5, opacity: 0.5 }).addTo(lf.map);
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

  // Aggiornamento DINAMICO numero piloti: aggiunge/rimuove senza reset
  useEffect(() => {
    if (!tracciato || tracciato.length === 0) return;
    const current = pilotiRef.current;
    const target = pilotiCount;
    if (current.length === target) return;
    if (target > current.length) {
      // Aggiungi nuovi piloti in posizioni CASUALI lungo il tracciato
      const coords = tracciato;
      const newOnes = [];
      const existingIds = new Set(current.map(p => p.id));
      const existingNumbers = new Set(current.map(p => p.numero));
      let nextId = 1;
      let nextNumero = 10;
      for (let i = current.length; i < target; i++) {
        while (existingIds.has(nextId)) nextId++;
        while (existingNumbers.has(nextNumero)) nextNumero++;
        const idx = Math.floor(Math.random() * coords.length);
        newOnes.push(makeFakePilot(nextId, nextNumero, idx, coords));
        existingIds.add(nextId); existingNumbers.add(nextNumero);
        nextId++; nextNumero++;
      }
      pilotiRef.current = [...current, ...newOnes];
      setPiloti(pilotiRef.current);
    } else {
      // Rimuovi eccedenze (ultimi aggiunti)
      const daRimuovere = current.slice(target);
      const lf = leafletRef.current;
      daRimuovere.forEach(p => {
        const m = lf.markers.get(p.id); if (m) { lf.map.removeLayer(m); lf.markers.delete(p.id); }
        const t = lf.trails.get(p.id); if (t) { lf.map.removeLayer(t); lf.trails.delete(p.id); }
        lastNotificatoRef.current.delete(p.id);
      });
      pilotiRef.current = current.slice(0, target);
      setPiloti(pilotiRef.current);
    }
  }, [pilotiCount, tracciato]);

  const pilotaSel = piloti.find(p => p.id === selected);

  // Classifica calcolata live
  const classificaAssoluta = [...piloti].sort((a, b) => (b.progress || 0) - (a.progress || 0));
  const posAssoluta = new Map(classificaAssoluta.map((p, i) => [p.id, i + 1]));
  const posClasse = new Map();
  const perClasse = {};
  classificaAssoluta.forEach(p => {
    perClasse[p.classe] = perClasse[p.classe] || [];
    perClasse[p.classe].push(p);
    posClasse.set(p.id, perClasse[p.classe].length);
  });
  const statoLabel = {
    in_moto: 'In moto',
    fermo: 'Fermo',
    allarme: '🆘 Allarme',
    fuori_percorso: '⚠️ Fuori percorso'
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <style>{`
        /* Smoothing marker: transition CSS fa scorrere il transform che Leaflet applica */
        .leaflet-marker-icon.sim-divicon {
          transition: transform 120ms linear;
          will-change: transform;
        }
      `}</style>
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

        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-rose-600"><AlertTriangle className="w-3 h-3" /> {alertsCount.allarmi}</span>
          <span className="flex items-center gap-1 text-sky-600"><Navigation className="w-3 h-3" /> {alertsCount.fuori}</span>
          <span className="flex items-center gap-1 text-gray-500"><Activity className="w-3 h-3" /> {alertsCount.fermi}</span>
          <span className="text-content-tertiary">Push DdG: <b>{alertsCount.notifichePush}</b></span>
        </div>
      </header>

      {/* Mappa */}
      <div className="relative flex-1">
        <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 420 }} />

        {/* Tooltip pilota selezionato */}
        {pilotaSel && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[320px] bg-surface border border-border-subtle rounded-xl shadow-xl p-4 z-[500]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black">#{pilotaSel.numero}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: CLASSE_COLOR[pilotaSel.classe] }}>{pilotaSel.classe}</span>
                </div>
                <div className="text-base font-semibold">{pilotaSel.nome} {pilotaSel.cognome}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-content-tertiary hover:text-content-primary text-sm">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-surface-2 rounded-md p-2">
                <div className="text-xs text-content-tertiary">Classifica assoluta</div>
                <div className="font-black text-lg">{posAssoluta.get(pilotaSel.id)}° <span className="text-sm font-normal text-content-tertiary">/ {piloti.length}</span></div>
              </div>
              <div className="bg-surface-2 rounded-md p-2">
                <div className="text-xs text-content-tertiary">Classifica {pilotaSel.classe}</div>
                <div className="font-black text-lg">{posClasse.get(pilotaSel.id)}° <span className="text-sm font-normal text-content-tertiary">/ {(perClasse[pilotaSel.classe] || []).length}</span></div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs text-content-secondary">
              <div>Stato: <span className="font-semibold text-content-primary">{statoLabel[pilotaSel.stato]}</span></div>
              <div>Velocità: <span className="font-mono text-content-primary">{pilotaSel.speedKmh.toFixed(0)} km/h</span></div>
            </div>
          </div>
        )}

        {/* LEADERBOARD in alto a destra */}
        {piloti.length > 0 && (
          <div className="absolute top-4 right-4 w-[320px] max-h-[70vh] overflow-y-auto bg-surface/95 backdrop-blur-sm border border-border-subtle rounded-xl shadow-xl z-[400]">
            <div className="sticky top-0 bg-surface px-3 py-2 border-b border-border-subtle flex items-center justify-between">
              <div className="font-bold text-sm">🏆 Classifica assoluta</div>
              <div className="text-xs text-content-tertiary">{piloti.length} piloti</div>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-content-tertiary sticky top-[40px]">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold">Pos</th>
                  <th className="px-2 py-1 text-left font-semibold">#</th>
                  <th className="px-2 py-1 text-left font-semibold">Pilota</th>
                  <th className="px-2 py-1 text-left font-semibold">Classe</th>
                  <th className="px-2 py-1 text-right font-semibold">Cl.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {classificaAssoluta.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`cursor-pointer hover:bg-surface-2 ${selected === p.id ? 'bg-rose-50 dark:bg-rose-900/20' : ''}`}
                  >
                    <td className="px-2 py-1 font-bold">{posAssoluta.get(p.id)}°</td>
                    <td className="px-2 py-1 font-mono">#{p.numero}</td>
                    <td className="px-2 py-1 truncate max-w-[130px]">{p.nome} {p.cognome}</td>
                    <td className="px-2 py-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: CLASSE_COLOR[p.classe] }}>{p.classe[0]}</span>
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-content-tertiary">{posClasse.get(p.id)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LEGENDA */}
        <div className="absolute bottom-4 left-4 bg-surface/95 backdrop-blur-sm border border-border-subtle rounded-xl p-3 z-[400] shadow-lg text-xs max-w-[240px]">
          <div className="font-bold text-sm mb-2 text-content-primary">Legenda</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-red-500"></span>Pilota in moto (freccia direzione)</div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-gray-400"></span>Pilota fermo</div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>Allarme / SOS attivo</div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-sky-500"></span>Fuori percorso (notifica DdG)</div>
            <div className="flex items-center gap-2 pt-1 border-t border-border-subtle mt-1"><span className="inline-block w-4 h-0.5 bg-blue-600"></span>Tracciato GPX</div>
          </div>
        </div>

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
