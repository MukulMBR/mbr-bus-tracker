// MBR Bus Tracker - Logic & Telemetry Engine

// BRS Travels Nandyal to Bangalore Route (parsed from user screenshot data)
const BRS_ROUTE = [
  { name: "BRS Travels Office (Nandyal)", lat: 15.477755, lng: 78.487252, type: "boarding" },
  { name: "Santhiram Medical College", lat: 15.491609, lng: 78.416109, type: "boarding" },
  { name: "Panyam", lat: 15.510115, lng: 78.339317, type: "boarding" },
  { name: "Nandyala Check Post", lat: 15.797974, lng: 78.052045, type: "boarding" },
  { name: "C Camp", lat: 15.807209, lng: 78.042326, type: "boarding" },
  { name: "Bellary X Road (Kurnool)", lat: 15.824718, lng: 78.021147, type: "boarding" },
  { name: "Bial Airport Toll Gate (Bangalore)", lat: 13.20094, lng: 77.661001, type: "dropoff" },
  { name: "Yelhanka", lat: 13.095318, lng: 77.594419, type: "dropoff" },
  { name: "Hebbal Esteem Mall", lat: 13.050034, lng: 77.592879, type: "dropoff" },
  { name: "Nagavara", lat: 13.0402, lng: 77.624352, type: "dropoff" },
  { name: "Kalyan Nagar", lat: 13.026393, lng: 77.637193, type: "dropoff" },
  { name: "Ramamurthy Nagar", lat: 13.01318, lng: 77.662238, type: "dropoff" },
  { name: "Tin Factory", lat: 12.996823, lng: 77.669136, type: "dropoff" },
  { name: "Mahadevpura", lat: 12.988225, lng: 77.689431, type: "dropoff" },
  { name: "Marthahalli Kalamandir", lat: 12.960071, lng: 77.701371, type: "dropoff" },
  { name: "Marthahalli (Multiplex", lat: 12.950981, lng: 77.69972, type: "dropoff" },
  { name: "Bellandur", lat: 12.924325, lng: 77.673103, type: "dropoff" },
  { name: "Hsr Layout", lat: 12.922079, lng: 77.644953, type: "dropoff" },
  { name: "Silk Board", lat: 12.917287, lng: 77.622732, type: "dropoff" },
  { name: "Madiwala", lat: 12.921217, lng: 77.620336, type: "dropoff" },
  { name: "Dairy Circle", lat: 12.937105, lng: 77.601681, type: "dropoff" },
  { name: "Lalbagh", lat: 12.954143, lng: 77.585413, type: "dropoff" },
  { name: "Kalasipalyam", lat: 12.958947, lng: 77.577639, type: "dropoff" }
];

// App State
let map = null;
let busMarker = null;
let routeLine = null;
let selectedDropPoint = null;
let currentRoutePoints = [...BRS_ROUTE];
let currentTrackingKey = null;

let isLiveMode = false;
let isSimulationActive = false;
let trackingInterval = null;
let simStep = 0;
let simCoords = []; // Interpolated path coordinates

let lastLat = null;
let lastLng = null;
let stasisCount = 0; // Cycles without movement
let isStasisSimulated = false;

let alarmActive = false;
let alarmDismissed = false;
let buzzerInterval = null;
let audioCtx = null;
let logHistory = [];

// Restore state from localStorage on startup
function restoreTrackingSession() {
  if (localStorage.getItem('waPhone')) document.getElementById('waPhone').value = localStorage.getItem('waPhone');
  if (localStorage.getItem('waApikey')) document.getElementById('waApikey').value = localStorage.getItem('waApikey');
  if (localStorage.getItem('waEnabled')) document.getElementById('waEnabled').checked = localStorage.getItem('waEnabled') === 'true';
  if (localStorage.getItem('inputUrl')) document.getElementById('urlInput').value = localStorage.getItem('inputUrl');

  const autoResume = localStorage.getItem('autoResume') === 'true';
  const savedIndex = localStorage.getItem('savedDropPointIndex');
  
  if (autoResume) {
    logToConsole("Restoring previous tracking session...", "alert");
    const mode = localStorage.getItem('trackingMode');
    if (mode === 'live') {
      handleUrlSubmit().then(() => {
        if (savedIndex !== null) {
          const idx = parseInt(savedIndex);
          if (currentRoutePoints[idx]) {
            selectDropPoint(currentRoutePoints[idx], idx);
          }
        }
      });
    } else if (mode === 'demo') {
      loadDemoRoute();
      if (savedIndex !== null) {
        const idx = parseInt(savedIndex);
        if (currentRoutePoints[idx]) {
          selectDropPoint(currentRoutePoints[idx], idx);
        }
      }
    }
  }
}

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  initMap(currentRoutePoints);
  populateDropPoints(currentRoutePoints);
  setupEventListeners();
  restoreTrackingSession();
  logToConsole("System initialized. Paste a trkg.in URL or click 'Start Demo Tracking'.", "success");
});

// Initialize Leaflet Map
function initMap(routeData) {
  if (map) {
    map.remove();
  }

  // Find center point of route
  const avgLat = routeData.reduce((sum, p) => sum + p.lat, 0) / routeData.length;
  const avgLng = routeData.reduce((sum, p) => sum + p.lng, 0) / routeData.length;

  map = L.map('map', {
    zoomControl: false
  }).setView([avgLat, avgLng], 8);

  // Dark Carto Map tiles for premium styling
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Plot route path
  const pathPoints = routeData.map(pt => [pt.lat, pt.lng]);
  routeLine = L.polyline(pathPoints, {
    color: 'var(--accent-gold)',
    weight: 3,
    opacity: 0.6,
    dashArray: '8, 8'
  }).addTo(map);

  // Add route point markers
  routeData.forEach(pt => {
    const isBoarding = pt.type === 'boarding';
    L.circleMarker([pt.lat, pt.lng], {
      radius: isBoarding ? 5 : 6,
      fillColor: isBoarding ? '#0d0a07' : '#f59e0b',
      color: isBoarding ? 'var(--accent-gold)' : '#fff',
      weight: 1.5,
      fillOpacity: 1
    }).bindPopup(`<b>${pt.name}</b> (${pt.type})`).addTo(map);
  });
}

// Populate Drop Points list
function populateDropPoints(routeData) {
  const container = document.getElementById('dropPointsList');
  container.innerHTML = '';
  
  const dropoffPoints = routeData.filter(pt => pt.type === 'dropoff');
  
  if (dropoffPoints.length === 0) {
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No dropping points found in route.</div>`;
    return;
  }

  dropoffPoints.forEach((pt, index) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.id = `drop-pt-${index}`;
    div.innerHTML = `
      <span>${pt.name}</span>
      <span style="color: var(--accent-gold); font-size: 0.75rem;">Dropoff</span>
    `;
    div.addEventListener('click', () => selectDropPoint(pt, index));
    container.appendChild(div);
  });
}

// Select Dropping Point
function selectDropPoint(point, index) {
  selectedDropPoint = point;
  alarmDismissed = false;
  
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(`drop-pt-${index}`);
  if (el) el.classList.add('selected');
  
  document.getElementById('targetValue').textContent = point.name;
  
  // Play a brief confirmation chime to unlock AudioContext on mobile
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, actx.currentTime);
    osc.frequency.setValueAtTime(800, actx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.04, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.25);
  } catch(e) {}
  
  speakVoiceAlert(`Alarm set for ${point.name}.`);
  logToConsole(`Destination Set: ${point.name}. Alarm activated.`, "success");
  
  // Persist selected dropping destination
  localStorage.setItem('savedDropPointIndex', index);
  
  updateHUD();
}

// Calculate distance using Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Extract key from trkg.in URL
function extractKeyFromUrl(url) {
  const match = url.match(/\/([A-Z0-9]{6,8})(?:\?|$)/i);
  return match ? match[1] : null;
}

// Handle tracking URL submission
async function handleUrlSubmit() {
  const urlInput = document.getElementById('urlInput').value.trim();
  if (!urlInput) {
    alert("Please enter a tracking URL.");
    return;
  }

  const key = extractKeyFromUrl(urlInput);
  if (!key) {
    alert("Could not extract a valid tracking key from the URL. Ensure it matches 'trkg.in/BITLAA/XXXXXX'");
    return;
  }

  currentTrackingKey = key;
  logToConsole(`Connecting to Trackingo Session Key: ${key}...`, "success");
  
  // Save active tracking state
  localStorage.setItem('inputUrl', urlInput);
  localStorage.setItem('autoResume', 'true');
  localStorage.setItem('trackingMode', 'live');

  try {
    // Call our CORS proxy backend to load journey details
    const response = await fetch(`/api/track-journey?key=${key}`);
    const data = await response.json();

    if (data.status === 200 && data.journey_details) {
      logToConsole(`Connected successfully. Service: ${data.journey_details.service_number} (${data.journey_details.operator_name})`, "success");
      
      // Parse stations
      currentRoutePoints = data.all_service_places.map(pt => ({
        name: pt.sp_name,
        lat: pt.lat_long[0],
        lng: pt.lat_long[1],
        type: pt.stage_type
      }));

      isLiveMode = true;
      isSimulationActive = false;
      stopActiveInterval();

      // Redraw map and list dropping points
      initMap(currentRoutePoints);
      populateDropPoints(currentRoutePoints);

      // Start live polling loop (every 10 seconds)
      startLiveTrackingLoop();
    } else {
      logToConsole("Session returned error. Falling back to BRS Travels Demo route...", "alert");
      loadDemoRoute();
    }
  } catch (error) {
    console.error("CORS Proxy unavailable, loading local BRS Travels Demo route", error);
    logToConsole("CORS Server unavailable. Initialized local BRS Travels Demo route.", "alert");
    loadDemoRoute();
  }
}

function loadDemoRoute() {
  isLiveMode = false;
  currentRoutePoints = [...BRS_ROUTE];
  
  // Save active tracking state
  localStorage.setItem('autoResume', 'true');
  localStorage.setItem('trackingMode', 'demo');

  initMap(currentRoutePoints);
  populateDropPoints(currentRoutePoints);
  startDemoSimulation();
}

// Polling live telemetry
function startLiveTrackingLoop() {
  logToConsole("Live GPS tracking cycle active (10s intervals).", "success");
  
  pollLiveGPS();
  trackingInterval = setInterval(() => {
    pollLiveGPS();
  }, 10000);
}

async function pollLiveGPS() {
  if (!currentTrackingKey) return;
  
  try {
    const response = await fetch(`/api/track-eta?key=${currentTrackingKey}`);
    const data = await response.json();

    if (data.status === 200 && data.current_status_details) {
      const gps = data.current_status_details.lat_long;
      const speed = data.current_status_details.details.speed || 0;
      const locText = data.current_status_details.details.location || "N/A";
      const timestamp = data.current_status_details.details.timestamp || "";

      logToConsole(`GPS Update: Speed ${speed} km/h - ${locText}`, "success");
      updateBusPosition(gps[0], gps[1], speed, timestamp);
    }
  } catch (e) {
    logToConsole("Error polling live GPS data.", "error");
  }
}

// Interpolate coordinates for smooth Demo mode movement
function generateInterpolatedRoute(routeData) {
  const segments = [];
  const stepsPerSegment = 20;

  for (let i = 0; i < routeData.length - 1; i++) {
    const start = routeData[i];
    const end = routeData[i+1];
    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      segments.push({ lat, lng });
    }
  }
  segments.push(routeData[routeData.length - 1]);
  return segments;
}

function createBusIcon() {
  return L.divIcon({
    className: 'map-marker-bus-container',
    html: `
      <div class="bus-icon-glow">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="#10b981" stroke="#047857" stroke-width="1.5">
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <rect x="8" y="4" width="8" height="4" fill="#ffffff" opacity="0.8" rx="1" />
          <!-- Wheels -->
          <rect x="4" y="5" width="2" height="4" fill="#1e293b" rx="1" />
          <rect x="18" y="5" width="2" height="4" fill="#1e293b" rx="1" />
          <rect x="4" y="15" width="2" height="4" fill="#1e293b" rx="1" />
          <rect x="18" y="15" width="2" height="4" fill="#1e293b" rx="1" />
          <!-- Headlights -->
          <circle cx="8" cy="3" r="1.2" fill="#fbbf24" />
          <circle cx="16" cy="3" r="1.2" fill="#fbbf24" />
          <!-- Detailing lines -->
          <line x1="6" y1="10" x2="18" y2="10" stroke="#fff" opacity="0.35" />
          <line x1="6" y1="15" x2="18" y2="15" stroke="#fff" opacity="0.35" />
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Start local demo simulation
function startDemoSimulation() {
  stopActiveInterval();
  isSimulationActive = true;
  document.getElementById('btnStart').disabled = true;
  document.getElementById('btnStasis').disabled = false;
  
  simCoords = generateInterpolatedRoute(currentRoutePoints);

  // Align simulation starting position with the last known live GPS location (Dhone, near Kurnool: 15.46533, 77.89449)
  const targetStartLat = 15.46533;
  const targetStartLng = 77.89449;
  let closestIndex = 0;
  let minDiff = Infinity;
  
  for (let i = 0; i < simCoords.length; i++) {
    const diff = Math.abs(simCoords[i].lat - targetStartLat) + Math.abs(simCoords[i].lng - targetStartLng);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  simStep = closestIndex;
  const start = simCoords[simStep];
  lastLat = start.lat;
  lastLng = start.lng;

  if (busMarker) {
    map.removeLayer(busMarker);
  }

  busMarker = L.marker([start.lat, start.lng], { icon: createBusIcon() }).addTo(map);
  map.setView([start.lat, start.lng], 9);
  
  logToConsole("Demo tracking active. Commencing from last known live location near Kurnool.", "success");

  trackingInterval = setInterval(() => {
    if (!isSimulationActive) return;
    
    let lat, lng;
    if (isStasisSimulated) {
      lat = lastLat;
      lng = lastLng;
    } else {
      if (simStep < simCoords.length - 1) {
        simStep++;
      }
      const pt = simCoords[simStep];
      lat = pt.lat;
      lng = pt.lng;
    }

    const speed = isStasisSimulated ? 0 : Math.floor(55 + Math.random() * 20);
    updateBusPosition(lat, lng, speed, new Date().toLocaleTimeString());

  }, 2000);
}

// Move bus on map and check warnings
function updateBusPosition(lat, lng, speed, timestamp) {
  if (!busMarker) {
    busMarker = L.marker([lat, lng], { icon: createBusIcon() }).addTo(map);
  }

  // Calculate movement angle for rotation (bearing in degrees)
  let angle = 0;
  if (lastLat !== null && (lastLat !== lat || lastLng !== lng)) {
    const dLng = lng - lastLng;
    const dLat = lat - lastLat;
    angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  }

  busMarker.setLatLng([lat, lng]);
  map.panTo([lat, lng]);

  // Apply rotation to the SVG element
  const busIconEl = busMarker.getElement() ? busMarker.getElement().querySelector('.bus-icon-glow') : null;
  if (busIconEl) {
    busIconEl.style.transform = `rotate(${angle}deg)`;
  }

  document.getElementById('gpsValue').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  document.getElementById('speedValue').textContent = `${speed} km/h`;
  document.getElementById('timeValue').textContent = timestamp;

  // Stasis checking
  if (lastLat === lat && lastLng === lng) {
    stasisCount++;
    if (stasisCount >= 2) {
      triggerStasisWarning(lat, lng);
    }
  } else {
    stasisCount = 0;
    if (busMarker.getElement()) {
      busMarker.getElement().classList.remove('stasis');
    }
  }

  lastLat = lat;
  lastLng = lng;

  updateHUD();
}

function triggerStasisWarning(lat, lng) {
  if (busMarker && busMarker.getElement()) {
    busMarker.getElement().classList.add('stasis');
  }
  
  const alertMsg = `STASIS ALERT: Bus stationary at coordinates [${lat.toFixed(5)}, ${lng.toFixed(5)}] for 20 minutes.`;
  logToConsole(alertMsg, "error");
  
  speakVoiceAlert("Warning: The bus has been stationary for 20 minutes. There may be a traffic delay or breakdown ahead.");
  sendWhatsAppAlert(`STASIS WARNING: Bus is stationary at coordinates [${lat.toFixed(5)}, ${lng.toFixed(5)}] for 20 minutes.`);
}

function formatDuration(mins) {
  if (mins <= 0) return "Arrived";
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs} hr ${remainingMins} mins` : `${hrs} hr`;
}

function updateHUD() {
  if (!busMarker || !selectedDropPoint) return;

  const currentPos = busMarker.getLatLng();
  const dist = getDistance(currentPos.lat, currentPos.lng, selectedDropPoint.lat, selectedDropPoint.lng);
  
  document.getElementById('distValue').textContent = `${dist.toFixed(1)} km`;

  // Estimate ETA based on current speed (or fallback to average 60km/h)
  const speedText = document.getElementById('speedValue').textContent;
  const speedVal = parseFloat(speedText) || 60;
  const currentSpeed = speedVal > 15 ? speedVal : 60;
  
  const etaMins = Math.round((dist / currentSpeed) * 60);
  document.getElementById('etaValue').textContent = formatDuration(etaMins);

  // Trigger wakeup alarm when ETA is less than or equal to 20 minutes
  if (etaMins <= 20 && etaMins > 0 && !alarmActive && !alarmDismissed) {
    triggerArrivalAlarm(etaMins);
  }
}

function triggerArrivalAlarm(etaMins) {
  alarmActive = true;
  document.getElementById('alarmOverlay').style.display = 'flex';

  const alarmDesc = document.querySelector('#alarmOverlay p');
  if (alarmDesc) {
    alarmDesc.textContent = `The bus is estimated to arrive at ${selectedDropPoint.name} in ${formatDuration(etaMins)}.`;
  }

  playBuzzerSound();
  
  const voiceMsg = `Attention: You are approaching ${selectedDropPoint.name}. Estimated arrival is in ${formatDuration(etaMins)}. Please prepare to deboard.`;
  speakVoiceAlert(voiceMsg);

  logToConsole(`ARRIVAL ALARM: Approaching ${selectedDropPoint.name} in ${formatDuration(etaMins)}!`, "error");
  sendWhatsAppAlert(`ARRIVAL ALARM: Bus approaching ${selectedDropPoint.name}! Estimated arrival: ${formatDuration(etaMins)}.`);
}

function stopAlarm() {
  alarmActive = false;
  alarmDismissed = true;
  
  if (buzzerInterval) {
    clearInterval(buzzerInterval);
    buzzerInterval = null;
  }
  
  document.getElementById('alarmOverlay').style.display = 'none';
  logToConsole("Alarm dismissed by user.", "success");
}

// Speak voice warning
function speakVoiceAlert(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// Synthesize alarm sound beeps
function playBuzzerSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const playBeep = () => {
      if (!alarmActive) {
        if (buzzerInterval) {
          clearInterval(buzzerInterval);
          buzzerInterval = null;
        }
        return;
      }
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    };

    // Play first beep immediately
    playBeep();
    
    // Schedule repeating beeps every 800ms
    buzzerInterval = setInterval(playBeep, 800);
  } catch (e) {
    console.error("Audio Synthesis error", e);
  }
}

// Simulate Stasis Toggle
function toggleStasis() {
  isStasisSimulated = !isStasisSimulated;
  const btn = document.getElementById('btnStasis');
  
  if (isStasisSimulated) {
    btn.textContent = "Resume Movement";
    btn.style.background = 'var(--accent-bronze)';
    logToConsole("Simulation: Simulating traffic stasis.", "alert");
  } else {
    btn.textContent = "Simulate Stasis";
    btn.style.background = 'transparent';
    btn.style.border = '1px solid var(--accent-gold)';
    btn.style.color = 'var(--accent-gold)';
    stasisCount = 0;
    logToConsole("Simulation: Movement resumed.", "success");
  }
}

function stopActiveInterval() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  alarmDismissed = false;
  if (buzzerInterval) {
    clearInterval(buzzerInterval);
    buzzerInterval = null;
  }
  localStorage.setItem('autoResume', 'false');
}

function sendWhatsAppAlert(message) {
  const enabled = document.getElementById('waEnabled').checked;
  const phone = document.getElementById('waPhone').value.trim();
  const apikey = document.getElementById('waApikey').value.trim();
  
  if (!enabled || !phone || !apikey) return;
  
  logToConsole(`Sending WhatsApp alert to ${phone}...`, "success");
  
  fetch(`/api/send-whatsapp?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(message)}`)
    .then(res => res.json())
    .then(data => {
      logToConsole("WhatsApp alert sent successfully.", "success");
    })
    .catch(err => {
      console.error(err);
      logToConsole("Failed to send WhatsApp alert.", "error");
    });
}

function logToConsole(message, type = "") {
  const box = document.getElementById('consoleBox');
  const div = document.createElement('div');
  const timestamp = new Date().toLocaleTimeString();
  div.className = `console-line ${type}`;
  div.textContent = `[${timestamp}] ${message}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  
  // Save log locally
  logHistory.push(`[${timestamp}] [${type.toUpperCase() || "INFO"}] ${message}`);
}

function setupEventListeners() {
  document.getElementById('btnSubmitUrl').addEventListener('click', handleUrlSubmit);
  document.getElementById('btnStart').addEventListener('click', () => {
    isLiveMode = false;
    loadDemoRoute();
  });
  document.getElementById('btnStasis').addEventListener('click', toggleStasis);
  document.getElementById('btnStopAlarm').addEventListener('click', stopAlarm);
  
  // Save input changes dynamically to localStorage to prevent tab unload resets
  document.getElementById('waPhone').addEventListener('input', (e) => localStorage.setItem('waPhone', e.target.value.trim()));
  document.getElementById('waApikey').addEventListener('input', (e) => localStorage.setItem('waApikey', e.target.value.trim()));
  document.getElementById('waEnabled').addEventListener('change', (e) => localStorage.setItem('waEnabled', e.target.checked));
  document.getElementById('urlInput').addEventListener('input', (e) => localStorage.setItem('inputUrl', e.target.value.trim()));
  
  // Test Alarm & Speech System
  document.getElementById('btnTestAlarm').addEventListener('click', () => {
    logToConsole("Testing alarm and speech systems...", "alert");
    
    // Play a brief 1.5 second test of the siren buzzer
    alarmActive = true;
    playBuzzerSound();
    speakVoiceAlert("System Check: MBR Bus Telemetry voice engine is active and ready.");
    
    setTimeout(() => {
      alarmActive = false;
      if (buzzerInterval) {
        clearInterval(buzzerInterval);
        buzzerInterval = null;
      }
      logToConsole("Audio and speech system test completed.", "success");
    }, 1500);
  });

  // Local log downloader
  document.getElementById('btnDownloadLog').addEventListener('click', () => {
    if (logHistory.length === 0) {
      alert("No logs captured yet.");
      return;
    }
    const logContent = logHistory.join('\r\n');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbr_bus_tracker_log_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logToConsole("System logs downloaded locally.", "success");
  });
}
