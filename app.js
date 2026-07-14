// MBR Trip Radar - Logic & tracking engine

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
let currentTrackingDomain = 'trkg.in';
let audioEnabled = true;

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
let stasisAlertSpoken = false;

// Geofence circle Leaflet layer reference
let geofenceCircle = null;

// Multi-language Translation Dictionaries
const translations = {
  en: {
    appTitle: "MBR TRIP RADAR",
    appSubtitle: "LIVE TRACKING, DROP ALERTS & TRAVEL TOOLS",
    badgeLabel: "Tracking Link Active",
    hudTitle: "Live Trip Radar",
    gpsLabel: "Current Position",
    speedLabel: "Current Speed",
    distLabel: "Distance to Drop",
    etaLabel: "ETA to Drop",
    targetLabel: "Target point",
    progressLabel: "Route Progress",
    waitingSignal: "Waiting for signal...",
    waiting: "Waiting...",
    tracking: "Tracking",
    alerts: "Alerts",
    dropPoint: "Drop Point",
    demo: "Demo",
    console: "Console",
    history: "History",
    connectTitle: "Connect Tracking URL",
    connectBtn: "Connect",
    waTitle: "WhatsApp Alerts Settings",
    enableBtn: "Enable",
    dropPointTitle: "Select Dropping Point",
    audioLabel: "Alarm Sounds & Voice:",
    enabledLabel: "Enabled",
    dropPointEmpty: "Connect a tracking link or start the demo to compile route drop points.",
    demoTitle: "Demo Simulation & Tests",
    startDemoBtn: "Start Demo Tracking",
    stasisBtn: "Simulate Stasis",
    testAlarmBtn: "🔊 Test Alarm & Voice",
    consoleTitle: "System Console Stream",
    saveLogsBtn: "Save Logs (.txt)",
    historyTitle: "Trip History Log (Last 10)",
    historyEmpty: "No completed trips in history yet.",
    shareTrip: "Share Trip",
    alarmThresholdLabel: "Wakeup Alarm timing:",
    none: "None"
  },
  kn: {
    appTitle: "ಎಂ.ಬಿ.ಆರ್ ಟ್ರಿಪ್ ರಾಡಾರ್",
    appSubtitle: "ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್, ಡ್ರಾಪ್ ಅಲರ್ಟ್‌ಗಳು ಮತ್ತು ಪ್ರಯಾಣ ಟೂಲ್ಸ್",
    badgeLabel: "ಟ್ರ್ಯಾಕಿಂಗ್ ಲಿಂಕ್ ಸಕ್ರಿಯವಾಗಿದೆ",
    hudTitle: "ಲೈವ್ ಟ್ರಿಪ್ ರಾಡಾರ್",
    gpsLabel: "ಪ್ರಸ್ತುತ ಜಿಪಿಎಸ್ ಸ್ಥಳ",
    speedLabel: "ಪ್ರಸ್ತುತ ವೇಗ",
    distLabel: "ಇಳಿಯುವ ದೂರ",
    etaLabel: "ಇಳಿಯುವ ಅಂದಾಜು ಸಮಯ",
    targetLabel: "ಗುರಿ ನಿಲ್ದಾಣ",
    progressLabel: "ಪ್ರಯಾಣದ ಪ್ರಗತಿ",
    waitingSignal: "ಸಿಗ್ನಲ್ಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ...",
    waiting: "ಕಾಯಲಾಗುತ್ತಿದೆ...",
    tracking: "ಟ್ರ್ಯಾಕಿಂಗ್",
    alerts: "ಎಚ್ಚರಿಕೆಗಳು",
    dropPoint: "ಇಳಿಯುವ ಸ್ಥಳ",
    demo: "ಡೆಮೊ",
    console: "ಕನ್ಸೋಲ್",
    history: "ಇತಿಹಾಸ",
    connectTitle: "ಟ್ರ್ಯಾಕಿಂಗ್ ಲಿಂಕ್ ಜೋಡಿಸಿ",
    connectBtn: "ಜೋಡಿಸಿ",
    waTitle: "ವಾಟ್ಸಾಪ್ ಎಚ್ಚರಿಕೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    enableBtn: "ಸಕ್ರಿಯಗೊಳಿಸಿ",
    dropPointTitle: "ಇಳಿಯುವ ನಿಲ್ದಾಣ ಆಯ್ಕೆಮಾಡಿ",
    audioLabel: "ಅಲಾರಾಂ ಧ್ವನಿಗಳು ಮತ್ತು ಧ್ವನಿ ಸಹಾಯಕ:",
    enabledLabel: "ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ",
    dropPointEmpty: "ನಿಲ್ದಾಣಗಳನ್ನು ಪಡೆಯಲು ಟ್ರ್ಯಾಕಿಂಗ್ ಜೋಡಿಸಿ ಅಥವಾ ಡೆಮೊ ಆರಂಭಿಸಿ.",
    demoTitle: "ಡೆಮೊ ಸಿಮ್ಯುಲೇಶನ್ ಮತ್ತು ಪರೀಕ್ಷೆಗಳು",
    startDemoBtn: "ಡೆಮೊ ಆರಂಭಿಸಿ",
    stasisBtn: "ನಿಲ್ಲಿಸಿ ಸಿಮ್ಯುಲೇಟ್ ಮಾಡಿ",
    testAlarmBtn: "🔊 ಧ್ವನಿ ಪರೀಕ್ಷಿಸಿ",
    consoleTitle: "ಸಿಸ್ಟಮ್ ಕನ್ಸೋಲ್ ಸ್ಟ್ರೀಮ್",
    saveLogsBtn: "ಲಾಗ್‌ಗಳನ್ನು ಉಳಿಸಿ",
    historyTitle: "ಪ್ರಯಾಣದ ಇತಿಹಾಸ (ಕೊನೆಯ 10)",
    historyEmpty: "ಇತಿಹಾಸದಲ್ಲಿ ಯಾವುದೇ ಪ್ರಯಾಣಗಳು ಲಭ್ಯವಿಲ್ಲ.",
    shareTrip: "ಪ್ರಯಾಣ ಹಂಚಿಕೊಳ್ಳಿ",
    alarmThresholdLabel: "ಅಲಾರಾಂ ಸಮಯದ ಮಿತಿ:",
    none: "ಯಾವುದೂ ಇಲ್ಲ"
  },
  te: {
    appTitle: "ఎమ్.బి.ఆర్ ట్రిప్ రాడార్",
    appSubtitle: "లైవ్ ట్రాకింగ్, డ్రాప్ అలర్ట్స్ & ట్రావెల్ టూల్స్",
    badgeLabel: "ట్రాకింగ్ లింక్ క్రియాశీలంగా ఉంది",
    hudTitle: "లైవ్ ట్రిప్ రాడార్",
    gpsLabel: "ప్రస్తుత స్థానం",
    speedLabel: "ప్రస్తుత వేగం",
    distLabel: "దిగే దూరం",
    etaLabel: "దిగే అంచనా సమయం",
    targetLabel: "లక్ష్య స్థానం",
    progressLabel: "ప్రయాణ పురోగతి",
    waitingSignal: "సిగ్నల్ కోసం వేచి ఉంది...",
    waiting: "వేచి ఉంది...",
    tracking: "ట్రాకింగ్",
    alerts: "హెచ్చరికలు",
    dropPoint: "దిగే స్థలం",
    demo: "డెమో",
    console: "కన్సోల్",
    history: "చరిత్ర",
    connectTitle: "ట్రాకింగ్ లింక్ కనెక్ట్ చేయండి",
    connectBtn: "కనెక్ట్",
    waTitle: "వాట్సాప్ హెచ్చరిక సెట్టింగులు",
    enableBtn: "సక్రియం చేయి",
    dropPointTitle: "దిగే స్థలాన్ని ఎంచుకోండి",
    audioLabel: "అలారం శబ్దాలు & వాయిస్ అసిస్టెంట్:",
    enabledLabel: "సక్రియం చేయబడింది",
    dropPointEmpty: "స్టేషన్లను పొందడానికి ట్రాకింగ్ లింక్ జోడించండి లేదా డెమో ప్రారంభించండి.",
    demoTitle: "డెమో సిమ్యులేషన్ & టెస్టులు",
    startDemoBtn: "డెమో ప్రారంభించు",
    stasisBtn: "నిలుపుదల సిమ్యులేట్ చేయి",
    testAlarmBtn: "🔊 శబ్దం పరీక్షించండి",
    consoleTitle: "సిస్టమ్ కన్సోల్ స్ట్రీమ్",
    saveLogsBtn: "లాగ్స్ సేవ్ చేయి",
    historyTitle: "ప్రయాణ చరిత్ర (చివరి 10)",
    historyEmpty: "చరిత్రలో ప్రయాణాలు ఏవీ లేవు.",
    shareTrip: "ప్రయాణాన్ని షేర్ చేయి",
    alarmThresholdLabel: "అలారం సమయ పరిమితి:",
    none: "ఏదీ లేదు"
  }
};

let currentLanguage = 'en';

// Change App Interface Language
window.changeLanguage = function(lang) {
  if (!translations[lang]) return;
  currentLanguage = lang;
  localStorage.setItem('appLang', lang);
  document.getElementById('langSelect').value = lang;
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      if (el.tagName === 'INPUT') {
        el.placeholder = translations[lang][key];
      } else {
        const isPlaceholder = el.classList.contains('hud-placeholder');
        el.textContent = translations[lang][key];
        if (isPlaceholder) el.classList.add('hud-placeholder');
      }
    }
  });
  
  if (!selectedDropPoint) {
    document.getElementById('targetValue').textContent = translations[lang].none;
  }
  
  logToConsole(`Language changed to ${lang === 'en' ? 'English' : lang === 'kn' ? 'Kannada' : 'Telugu'}.`, "success");
};

// Web Notifications Fallback API
function initWebNotifications() {
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

function sendBrowserNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        body: message,
        icon: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        tag: "mbr-bus-alarm"
      });
      notification.onclick = function() {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn("Failed to fire browser notification", e);
    }
  }
}

// Share location read-only parsing parameters
function checkShareParameters() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('share') === 'true') {
    logToConsole("Shared trip view active. Settings disabled.", "info");
    
    // Hide quick-access row buttons and the bottom tab panel
    const grid = document.querySelector('.quick-access-grid');
    if (grid) grid.style.display = 'none';
    const panel = document.getElementById('accessPanel');
    if (panel) panel.style.display = 'none';
    
    const urlParam = params.get('url');
    if (urlParam) {
      document.getElementById('urlInput').value = urlParam;
      setTimeout(() => {
        handleUrlSubmit().then(() => {
          const dropIndex = parseInt(params.get('drop'));
          if (!isNaN(dropIndex)) {
            setTimeout(() => {
              const dropoffPoints = currentRoutePoints.filter(pt => pt.type === 'dropoff');
              if (dropoffPoints[dropIndex]) {
                selectDropPoint(dropoffPoints[dropIndex], dropIndex);
              }
            }, 1500);
          }
        });
      }, 500);
    }
  }
}

// Color coding app status indicators
function updateSystemStatus(status) {
  const badge = document.getElementById('telemetryBadge');
  const dot = badge ? badge.querySelector('.status-dot') : null;
  const connectBtn = document.getElementById('btnSubmitUrl');
  
  if (!badge || !dot) return;
  
  if (status === 'healthy') {
    badge.style.color = 'var(--status-green)';
    badge.style.borderColor = 'var(--status-green)';
    dot.style.background = 'var(--status-green)';
    if (connectBtn) {
      connectBtn.style.borderColor = 'var(--status-green)';
      connectBtn.style.color = 'var(--status-green)';
    }
    document.getElementById('badgeText').textContent = translations[currentLanguage].badgeLabel + " (Active)";
  } else if (status === 'error') {
    badge.style.color = 'var(--status-red)';
    badge.style.borderColor = 'var(--status-red)';
    dot.style.background = 'var(--status-red)';
    if (connectBtn) {
      connectBtn.style.borderColor = 'var(--status-red)';
      connectBtn.style.color = 'var(--status-red)';
    }
    document.getElementById('badgeText').textContent = "Signal Disconnected / Error";
  } else {
    // pending
    badge.style.color = 'var(--accent-gold)';
    badge.style.borderColor = 'var(--border-color)';
    dot.style.background = 'var(--accent-gold)';
    if (connectBtn) {
      connectBtn.style.borderColor = '';
      connectBtn.style.color = '';
    }
    document.getElementById('badgeText').textContent = translations[currentLanguage].badgeLabel;
  }
  
  checkWhatsAppConfiguration();
}

function checkWhatsAppConfiguration() {
  const enabled = document.getElementById('waEnabled').checked;
  const phone = document.getElementById('waPhone').value.trim();
  const apikey = document.getElementById('waApikey').value.trim();
  const badge = document.getElementById('telemetryBadge');
  const dot = badge ? badge.querySelector('.status-dot') : null;
  
  if (enabled && (!phone || !apikey)) {
    logToConsole("Warning: WhatsApp alerts enabled but credentials incomplete.", "error");
    if (badge && dot) {
      badge.style.color = 'var(--status-red)';
      badge.style.borderColor = 'var(--status-red)';
      dot.style.background = 'var(--status-red)';
      document.getElementById('badgeText').textContent = "WhatsApp Config Error";
    }
  }
}

// Geofence Circle overlay around selected station
function updateGeofenceCircle() {
  if (!map || !selectedDropPoint) {
    if (geofenceCircle) {
      map.removeLayer(geofenceCircle);
      geofenceCircle = null;
    }
    return;
  }
  
  if (geofenceCircle) {
    map.removeLayer(geofenceCircle);
  }
  
  const speedText = document.getElementById('speedValue').textContent;
  const speedVal = parseFloat(speedText) || 0;
  const currentSpeed = (speedVal > 10) ? speedVal : 60; // fallback to 60 km/h
  const thresholdMins = parseInt(document.getElementById('alarmThreshold').value) || 20;
  
  // Calculate radius in meters based on velocity (speed * 1000 / 60) * thresholdMins
  const radiusMeters = ((currentSpeed * 1000) / 60) * thresholdMins;
  
  const isDanger = speedVal > 60;
  const fenceClass = isDanger ? 'glowing-geofence danger' : 'glowing-geofence';
  const fenceColor = isDanger ? 'var(--status-red)' : 'var(--accent-gold)';
  
  geofenceCircle = L.circle([selectedDropPoint.lat, selectedDropPoint.lng], {
    radius: radiusMeters,
    color: fenceColor,
    fillColor: fenceColor,
    fillOpacity: 0.04,
    weight: 1.5,
    dashArray: '5, 5',
    className: fenceClass
  }).addTo(map);
}

// Journey progress bar calculations
function updateProgressBar(currentLat, currentLng) {
  if (!selectedDropPoint || !currentRoutePoints || currentRoutePoints.length === 0) {
    document.getElementById('progressContainer').style.display = 'none';
    return;
  }
  
  const startPt = currentRoutePoints[0];
  const totalDistance = getDistance(startPt.lat, startPt.lng, selectedDropPoint.lat, selectedDropPoint.lng);
  const remainingDistance = getDistance(currentLat, currentLng, selectedDropPoint.lat, selectedDropPoint.lng);
  
  let progressPercent = 0;
  if (totalDistance > 0) {
    progressPercent = Math.max(0, Math.min(100, ((totalDistance - remainingDistance) / totalDistance) * 100));
  }
  
  document.getElementById('progressContainer').style.display = 'block';
  document.getElementById('progressBar').style.width = `${progressPercent.toFixed(0)}%`;
  document.getElementById('progressText').textContent = `${progressPercent.toFixed(0)}%`;
}

// Client-side local trip history
function saveTripToHistory() {
  if (!selectedDropPoint) return;
  
  const history = JSON.parse(localStorage.getItem('tripHistory') || '[]');
  const now = new Date();
  const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const newTrip = {
    date: now.toLocaleDateString(),
    dropPoint: selectedDropPoint.name,
    arrival: timestampStr,
    status: "Arrived Safely"
  };
  
  // Prevent duplicate sequential saves
  if (history.length > 0 && history[0].dropPoint === newTrip.dropPoint && history[0].date === newTrip.date) {
    return;
  }
  
  history.unshift(newTrip);
  if (history.length > 10) history.pop();
  localStorage.setItem('tripHistory', JSON.stringify(history));
  renderHistoryList();
}

function renderHistoryList() {
  const listEl = document.getElementById('historyList');
  if (!listEl) return;
  
  const history = JSON.parse(localStorage.getItem('tripHistory') || '[]');
  if (history.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;" data-i18n="historyEmpty">
        No completed trips in history yet.
      </div>`;
    return;
  }
  
  listEl.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-header">
        <span>📅 ${item.date}</span>
        <span style="color: var(--status-green);">● ${item.status}</span>
      </div>
      <div class="history-body">
        <strong>Drop Station:</strong> ${item.dropPoint}<br>
        <strong>Arrival Time:</strong> ${item.arrival}
      </div>
    </div>
  `).join('');
}

// Restore state from localStorage on startup
function restoreTrackingSession() {
  if (localStorage.getItem('waPhone')) document.getElementById('waPhone').value = localStorage.getItem('waPhone');
  if (localStorage.getItem('waApikey')) document.getElementById('waApikey').value = localStorage.getItem('waApikey');
  if (localStorage.getItem('waEnabled')) document.getElementById('waEnabled').checked = localStorage.getItem('waEnabled') === 'true';
  if (localStorage.getItem('inputUrl')) document.getElementById('urlInput').value = localStorage.getItem('inputUrl');
  if (localStorage.getItem('alarmThreshold')) document.getElementById('alarmThreshold').value = localStorage.getItem('alarmThreshold');
  
  const savedAudio = localStorage.getItem('audioEnabled');
  if (savedAudio !== null) {
    audioEnabled = savedAudio === 'true';
  } else {
    audioEnabled = true;
  }
  updateSoundButtonUI();

  const autoResume = localStorage.getItem('autoResume') === 'true';
  const savedIndex = localStorage.getItem('savedDropPointIndex');
  
  if (autoResume) {
    logToConsole("Restoring previous tracking session...", "alert");
    const mode = localStorage.getItem('trackingMode');
    if (mode === 'live') {
      handleUrlSubmit().then(() => {
        if (savedIndex !== null) {
          const idx = parseInt(savedIndex);
          const dropoffPoints = currentRoutePoints.filter(pt => pt.type === 'dropoff');
          if (dropoffPoints[idx]) {
            selectDropPoint(dropoffPoints[idx], idx);
          }
        }
      });
    } else if (mode === 'demo') {
      loadDemoRoute();
      if (savedIndex !== null) {
        const idx = parseInt(savedIndex);
        const dropoffPoints = currentRoutePoints.filter(pt => pt.type === 'dropoff');
        if (dropoffPoints[idx]) {
          selectDropPoint(dropoffPoints[idx], idx);
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
  initBottomSheet();

  // Load language settings
  const savedLang = localStorage.getItem('appLang') || 'en';
  changeLanguage(savedLang);

  // Initialize browser notification APIs
  initWebNotifications();

  // Parse shareable coordinates link
  checkShareParameters();

  // Render trip log histories
  renderHistoryList();

  // Run URL Parser test cases suite to log verification
  runUrlParserTests();

  logToConsole("System initialized. Paste a tracking URL or click 'Start Demo Tracking'.", "success");
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
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([avgLat, avgLng], 8);

  // CartoDB Dark Matter base map tiles (Sleek dark theme)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Bounding box lock for route region (Karnataka/Andhra Pradesh) to prevent map drift
  if (routeData && routeData.length > 0) {
    const lats = routeData.map(p => p.lat);
    const lngs = routeData.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // Bounds with 1.5 degrees of padding
    const bounds = L.latLngBounds(
      [minLat - 1.5, minLng - 1.5],
      [maxLat + 1.5, maxLng + 1.5]
    );
    map.setMaxBounds(bounds);
    map.on('drag', () => {
      map.panInsideBounds(bounds, { animate: false });
    });
  }

  // Plot stations
  routeData.forEach((pt, index) => {
    const isBoarding = pt.type === 'boarding';
    
    L.circleMarker([pt.lat, pt.lng], {
      radius: isBoarding ? 8 : 6,
      fillColor: isBoarding ? '#f59e0b' : '#3b82f6',
      color: '#fff',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.95
    })
    .bindPopup(`<strong>${pt.name}</strong><br>${isBoarding ? 'Boarding checkpoint' : 'Dropping destination'}`)
    .addTo(map);
  });

  // Plot actual highway route geometry via OSRM
  drawRouteLine(routeData);
}

// Fetch and draw driving route using OSRM API
async function drawRouteLine(points) {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  
  try {
    // Downsample coordinates to avoid URL length limitations (max 80 points)
    const maxPoints = 80;
    let sampledPoints = points;
    if (points.length > maxPoints) {
      sampledPoints = [];
      const step = Math.ceil(points.length / maxPoints);
      for (let i = 0; i < points.length; i += step) {
        sampledPoints.push(points[i]);
      }
      if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
        sampledPoints.push(points[points.length - 1]);
      }
    }
    
    const coordsString = sampledPoints.map(p => `${p.lng},${p.lat}`).join(';');
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const routeGeoJSON = data.routes[0].geometry;
      const latlngs = routeGeoJSON.coordinates.map(coord => [coord[1], coord[0]]);
      routeLine = L.polyline(latlngs, { color: 'var(--accent-gold)', weight: 3, opacity: 0.85 }).addTo(map);
    } else {
      drawStraightLineRoute(points);
    }
  } catch (e) {
    console.error("OSRM highway pathing failed. Falling back to straight lines.", e);
    drawStraightLineRoute(points);
  }
}

function drawStraightLineRoute(points) {
  const latlngs = points.map(p => [p.lat, p.lng]);
  routeLine = L.polyline(latlngs, { color: 'var(--accent-gold)', dashArray: '5, 8', weight: 3 }).addTo(map);
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
  updateGeofenceCircle();
  if (busMarker) {
    const pos = busMarker.getLatLng();
    updateProgressBar(pos.lat, pos.lng);
  }
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

// Provider adapter list for future operator extensions
const PROVIDER_ADAPTERS = [
  {
    name: "QueryParamsTracker",
    match: (host) => host.includes('special-tracker.com'),
    extract: (urlObj) => urlObj.searchParams.get('id') || urlObj.searchParams.get('key')
  }
];

// Generic tracking URL parser
function parseTrackingUrl(urlStr) {
  let cleanUrl = urlStr.trim();
  if (!cleanUrl) return null;
  
  // Prepend protocol if missing to allow valid URL parsing
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  
  try {
    const urlObj = new URL(cleanUrl);
    const host = urlObj.hostname;
    
    // 1. Check custom provider adapters
    for (const adapter of PROVIDER_ADAPTERS) {
      if (adapter.match(host)) {
        const key = adapter.extract(urlObj);
        if (key) return { domain: host, key };
      }
    }
    
    // 2. Default fallback: extract last non-empty path segment as the key
    const paths = urlObj.pathname.split('/').filter(Boolean);
    if (paths.length > 0) {
      const key = paths[paths.length - 1];
      return { domain: host, key };
    }
  } catch (e) {
    console.error("Failed to parse URL", e);
  }
  return null;
}

// Automated parser test suite
function runUrlParserTests() {
  const tests = [
    { input: "http://trkg.in/BITLAA/FJFYCQ", expectedDomain: "trkg.in", expectedKey: "FJFYCQ" },
    { input: "https://tkbs.in/QHgT", expectedDomain: "tkbs.in", expectedKey: "QHgT" },
    { input: "https://some-travels.com/track/route/K3J2H1", expectedDomain: "some-travels.com", expectedKey: "K3J2H1" },
    { input: "smvt.in/abc12", expectedDomain: "smvt.in", expectedKey: "abc12" },
    { input: "http://www.trkg.in/BITLAA/FJFYCQ?zoom=12", expectedDomain: "www.trkg.in", expectedKey: "FJFYCQ" }
  ];
  
  logToConsole("=== RUNNING URL PARSER TESTS ===", "info");
  let passed = 0;
  tests.forEach((t, i) => {
    const res = parseTrackingUrl(t.input);
    if (res && res.domain === t.expectedDomain && res.key === t.expectedKey) {
      logToConsole(`Test ${i + 1} PASSED: ${t.input} -> domain: ${res.domain}, key: ${res.key}`, "success");
      passed++;
    } else {
      logToConsole(`Test ${i + 1} FAILED: ${t.input} -> Expected domain: ${t.expectedDomain}, key: ${t.expectedKey}.`, "error");
    }
  });
  logToConsole(`=== TEST SUMMARY: ${passed}/${tests.length} PASSED ===`, "info");
}

// Handle tracking URL submission
async function handleUrlSubmit() {
  const urlInput = document.getElementById('urlInput').value.trim();
  if (!urlInput) {
    alert("Please enter a tracking URL.");
    return;
  }

  const parsed = parseTrackingUrl(urlInput);
  if (!parsed) {
    alert("Could not extract a valid tracking key from the URL.");
    return;
  }

  currentTrackingDomain = parsed.domain;
  currentTrackingKey = parsed.key;
  logToConsole(`Connecting to ${currentTrackingDomain} Session Key: ${currentTrackingKey}...`, "success");
  
  // Save active tracking state
  localStorage.setItem('inputUrl', urlInput);
  localStorage.setItem('autoResume', 'true');
  localStorage.setItem('trackingMode', 'live');

  try {
    // Call our CORS proxy backend to load journey details
    const response = await fetch(`/api/track-journey?domain=${currentTrackingDomain}&key=${currentTrackingKey}`);
    const data = await response.json();

    if (data.status === 200 && data.journey_details) {
      logToConsole(`Connected successfully. Service: ${data.journey_details.service_number} (${data.journey_details.operator_name})`, "success");
      updateSystemStatus('healthy');
      
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
      const errorMsg = "This tracking link couldn't be found or is no longer active.";
      logToConsole(errorMsg, "error");
      alert(errorMsg);
      updateSystemStatus('error');
      loadDemoRoute();
    }
  } catch (error) {
    console.error("CORS Proxy fetch failed", error);
    const errorMsg = "This tracking link couldn't be found or is no longer active.";
    logToConsole(errorMsg, "error");
    alert(errorMsg);
    updateSystemStatus('error');
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
  updateSystemStatus('healthy');
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
    const response = await fetch(`/api/track-eta?domain=${currentTrackingDomain}&key=${currentTrackingKey}`);
    const data = await response.json();

    if (data.status === 200 && data.current_status_details) {
      const gps = data.current_status_details.lat_long;
      const speed = data.current_status_details.details.speed || 0;
      const locText = data.current_status_details.details.location || "N/A";
      const timestamp = data.current_status_details.details.timestamp || "";

      logToConsole(`GPS Update: Speed ${speed} km/h - ${locText}`, "success");
      updateSystemStatus('healthy');
      updateBusPosition(gps[0], gps[1], speed, timestamp);
    } else {
      updateSystemStatus('error');
    }
  } catch (e) {
    logToConsole("Error polling live GPS data.", "error");
    updateSystemStatus('error');
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
    map.setView([lat, lng], 12);
  } else {
    busMarker.setLatLng([lat, lng]);
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom < 12 ? 12 : currentZoom;
    map.setView([lat, lng], targetZoom);
  }

  // Calculate movement angle for rotation (bearing in degrees)
  let angle = 0;
  if (lastLat !== null && (lastLat !== lat || lastLng !== lng)) {
    const dLng = lng - lastLng;
    const dLat = lat - lastLat;
    angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  }

  // Apply rotation to the SVG element
  const busIconEl = busMarker.getElement() ? busMarker.getElement().querySelector('.bus-icon-glow') : null;
  if (busIconEl) {
    busIconEl.style.transform = `rotate(${angle}deg)`;
  }

  const gpsEl = document.getElementById('gpsValue');
  if (gpsEl) {
    gpsEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    gpsEl.classList.remove('hud-placeholder');
  }

  const speedEl = document.getElementById('speedValue');
  if (speedEl) {
    speedEl.textContent = `${speed} km/h`;
    speedEl.classList.remove('hud-placeholder');
  }

  const timeEl = document.getElementById('timeValue');
  if (timeEl) {
    timeEl.textContent = timestamp;
    timeEl.classList.remove('hud-placeholder');
  }

  // Stasis checking
  if (lastLat === lat && lastLng === lng) {
    stasisCount++;
    if (stasisCount >= 2) {
      triggerStasisWarning(lat, lng);
    }
  } else {
    stasisCount = 0;
    stasisAlertSpoken = false; // Reset stasis voice lock when movement resumes
    if (busMarker.getElement()) {
      busMarker.getElement().classList.remove('stasis');
    }
  }

  lastLat = lat;
  lastLng = lng;

  updateHUD();
  updateProgressBar(lat, lng);
  updateGeofenceCircle();
}

function triggerStasisWarning(lat, lng) {
  if (busMarker && busMarker.getElement()) {
    busMarker.getElement().classList.add('stasis');
  }
  
  const alertMsg = `STASIS ALERT: Bus stationary at coordinates [${lat.toFixed(5)}, ${lng.toFixed(5)}] for 20 minutes.`;
  logToConsole(alertMsg, "error");
  
  if (!stasisAlertSpoken) {
    speakVoiceAlert("Warning: The bus has been stationary for 20 minutes. There may be a traffic delay or breakdown ahead.");
    stasisAlertSpoken = true;
  }
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

  const distEl = document.getElementById('distValue');
  if (distEl) {
    distEl.textContent = `${dist.toFixed(1)} km`;
    distEl.classList.remove('hud-placeholder');
  }

  // Estimate ETA based on current speed (or fallback to average 60km/h)
  const speedText = document.getElementById('speedValue').textContent;
  const speedVal = parseFloat(speedText) || 60;
  const currentSpeed = speedVal > 15 ? speedVal : 60;
  
  const etaMins = Math.round((dist / currentSpeed) * 60);
  
  const etaEl = document.getElementById('etaValue');
  if (etaEl) {
    etaEl.textContent = formatDuration(etaMins);
    etaEl.classList.remove('hud-placeholder');
  }

  // Save trip log on destination arrival
  if (dist <= 0.1) {
    saveTripToHistory();
  }

  // Trigger wakeup alarm dynamically based on user setting (default 20 mins)
  const alarmThreshold = parseInt(document.getElementById('alarmThreshold').value) || 20;
  if (etaMins <= alarmThreshold && etaMins > 0 && !alarmActive && !alarmDismissed) {
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

  // Web Notification fallback alert
  sendBrowserNotification("MBR Telemetry: Destination Approaching!", `Estimated arrival at ${selectedDropPoint.name} in ${formatDuration(etaMins)}.`);

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
  if (!audioEnabled) return;

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
  if (!audioEnabled) return;

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

  // Reset status indicators to pending
  updateSystemStatus('pending');

  // Remove Leaflet geofence circle overlays
  if (geofenceCircle) {
    map.removeLayer(geofenceCircle);
    geofenceCircle = null;
  }

  // Hide progress bar container
  document.getElementById('progressContainer').style.display = 'none';

  // Reset HUD DOM elements back to skeleton placeholders
  const gpsEl = document.getElementById('gpsValue');
  if (gpsEl) {
    gpsEl.textContent = "Waiting for signal...";
    gpsEl.classList.add('hud-placeholder');
  }

  const speedEl = document.getElementById('speedValue');
  if (speedEl) {
    speedEl.textContent = "Waiting...";
    speedEl.classList.add('hud-placeholder');
  }

  const distEl = document.getElementById('distValue');
  if (distEl) {
    distEl.textContent = "Waiting...";
    distEl.classList.add('hud-placeholder');
  }

  const etaEl = document.getElementById('etaValue');
  if (etaEl) {
    etaEl.textContent = "Waiting...";
    etaEl.classList.add('hud-placeholder');
  }

  const timeEl = document.getElementById('timeValue');
  if (timeEl) {
    timeEl.textContent = "Waiting...";
    timeEl.classList.add('hud-placeholder');
  }

  const targetEl = document.getElementById('targetValue');
  if (targetEl) {
    targetEl.textContent = "None";
  }
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
  document.getElementById('waPhone').addEventListener('input', (e) => {
    localStorage.setItem('waPhone', e.target.value.trim());
    checkWhatsAppConfiguration();
  });
  document.getElementById('waApikey').addEventListener('input', (e) => {
    localStorage.setItem('waApikey', e.target.value.trim());
    checkWhatsAppConfiguration();
  });
  document.getElementById('waEnabled').addEventListener('change', (e) => {
    localStorage.setItem('waEnabled', e.target.checked);
    checkWhatsAppConfiguration();
  });
  document.getElementById('urlInput').addEventListener('input', (e) => localStorage.setItem('inputUrl', e.target.value.trim()));
  document.getElementById('alarmThreshold').addEventListener('change', (e) => {
    localStorage.setItem('alarmThreshold', e.target.value);
    updateGeofenceCircle();
  });
  
  // Global Sound Mute Toggle Listener
  document.getElementById('btnSoundToggle').addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    localStorage.setItem('audioEnabled', audioEnabled);
    updateSoundButtonUI();
    logToConsole(`Sound toggle: ${audioEnabled ? 'UNMUTED' : 'MUTED'}`, "success");
    
    // Play a brief confirmation beep if unmuted
    if (audioEnabled) {
      try {
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, actx.currentTime);
        gain.gain.setValueAtTime(0.04, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.2);
      } catch (e) {}
    }
  });
  
  // Search drop points list filter
  document.getElementById('searchDropPoints').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#dropPointsList .list-item').forEach(el => {
      const name = el.querySelector('.item-name').textContent.toLowerCase();
      if (name.includes(q)) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });
  });

  // Share Live Trip Button Listener
  document.getElementById('btnShareTrip').addEventListener('click', () => {
    const urlInput = document.getElementById('urlInput').value.trim();
    const dropIndex = currentRoutePoints.filter(pt => pt.type === 'dropoff').findIndex(pt => pt.name === (selectedDropPoint ? selectedDropPoint.name : ''));
    const shareUrl = new URL(window.location.origin + window.location.pathname);
    shareUrl.searchParams.set('share', 'true');
    if (urlInput) shareUrl.searchParams.set('url', urlInput);
    if (dropIndex !== -1) shareUrl.searchParams.set('drop', dropIndex);
    
    navigator.clipboard.writeText(shareUrl.toString()).then(() => {
      logToConsole("Shareable location link copied to clipboard!", "success");
      alert("Shareable read-only trip link copied to clipboard!");
    }).catch(() => {
      alert(`Share link: ${shareUrl.toString()}`);
    });
  });

  // Test Alarm & Speech System
  document.getElementById('btnTestAlarm').addEventListener('click', () => {
    logToConsole("Testing alarm and speech systems...", "alert");
    
    // Play a brief 1.5 second test of the siren buzzer
    alarmActive = true;
    playBuzzerSound();
    speakVoiceAlert("System Check: MBR Trip Radar voice engine is active and ready.");
    
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
    a.download = `mbr_trip_radar_log_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logToConsole("System logs downloaded locally.", "success");
  });

  // Video Downloader Modal controls
  const dlModal = document.getElementById('dlModal');
  const btnDlOpen = document.getElementById('btnDlOpen');
  const btnDlClose = document.getElementById('btnDlClose');
  const btnDlSubmit = document.getElementById('btnDlSubmit');
  const dlUrlInput = document.getElementById('dlUrlInput');
  const dlLoading = document.getElementById('dlLoading');
  const btnDlClear = document.getElementById('btnDlClear');
  const btnDlPaste = document.getElementById('btnDlPaste');
  const dlAutoDetectTooltip = document.getElementById('dlAutoDetectTooltip');
  const btnDlAutoPaste = document.getElementById('btnDlAutoPaste');
  const btnDlClearHistory = document.getElementById('btnDlClearHistory');

  // Download History Helper Functions
  function saveUrlToHistory(url) {
    let history = JSON.parse(localStorage.getItem('instaDlHistory') || '[]');
    // Filter out duplicates
    history = history.filter(item => item !== url);
    history.unshift(url);
    if (history.length > 5) history.pop();
    localStorage.setItem('instaDlHistory', JSON.stringify(history));
    renderDlHistory();
  }

  function renderDlHistory() {
    const container = document.getElementById('dlHistoryContainer');
    const list = document.getElementById('dlHistoryList');
    if (!container || !list) return;

    const history = JSON.parse(localStorage.getItem('instaDlHistory') || '[]');
    if (history.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    history.forEach(url => {
      const row = document.createElement('div');
      row.className = 'dl-history-row';
      row.innerHTML = `
        <span class="dl-history-url" title="${url}">${url}</span>
        <button class="dl-history-dl-btn" data-url="${url}" title="Re-download">📥 Download</button>
      `;

      // Attach re-download click event to row download button
      row.querySelector('.dl-history-dl-btn').addEventListener('click', (e) => {
        const targetUrl = e.target.getAttribute('data-url');
        dlUrlInput.value = targetUrl;
        if (btnDlClear) btnDlClear.style.display = 'block';
        if (dlAutoDetectTooltip) dlAutoDetectTooltip.style.display = 'none';
        btnDlSubmit.click();
      });

      list.appendChild(row);
    });
  }

  // Clear History
  if (btnDlClearHistory) {
    btnDlClearHistory.addEventListener('click', () => {
      localStorage.removeItem('instaDlHistory');
      renderDlHistory();
      logToConsole("Download history cleared.", "success");
    });
  }

  // Render history on page startup
  renderDlHistory();

  if (btnDlOpen && dlModal) {
    btnDlOpen.addEventListener('click', async () => {
      dlModal.style.display = 'flex';
      dlUrlInput.value = '';
      if (btnDlClear) btnDlClear.style.display = 'none';
      if (dlAutoDetectTooltip) dlAutoDetectTooltip.style.display = 'none';
      dlUrlInput.focus();

      // Attempt clipboard auto-detection
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clipText = await navigator.clipboard.readText();
          const cleanText = clipText.trim();
          
          // Basic pattern matching common video hosts
          const isVideoUrl = /(instagram\.com|youtube\.com|youtu\.be|facebook\.com|twitter\.com|x\.com|tiktok\.com|reel)/i.test(cleanText);
          
          if (isVideoUrl && dlAutoDetectTooltip && btnDlAutoPaste) {
            dlAutoDetectTooltip.style.display = 'flex';
            
            // Re-bind click trigger to avoid multiple click events stacking up
            btnDlAutoPaste.replaceWith(btnDlAutoPaste.cloneNode(true));
            const newBtn = document.getElementById('btnDlAutoPaste');
            newBtn.addEventListener('click', () => {
              dlUrlInput.value = cleanText;
              if (btnDlClear) btnDlClear.style.display = 'block';
              dlAutoDetectTooltip.style.display = 'none';
              logToConsole("Auto-filled link from clipboard", "info");
            });
          }
        }
      } catch (err) {
        console.log("Clipboard read blocked or unsupported: ", err);
      }
    });
  }

  if (btnDlClose && dlModal) {
    btnDlClose.addEventListener('click', () => {
      dlModal.style.display = 'none';
      dlLoading.style.display = 'none';
    });
  }

  if (dlModal) {
    dlModal.addEventListener('click', (e) => {
      if (e.target === dlModal) {
        dlModal.style.display = 'none';
        dlLoading.style.display = 'none';
      }
    });
  }

  // Clear button toggle visibility
  if (dlUrlInput && btnDlClear) {
    dlUrlInput.addEventListener('input', () => {
      btnDlClear.style.display = dlUrlInput.value.trim() ? 'block' : 'none';
    });

    btnDlClear.addEventListener('click', () => {
      dlUrlInput.value = '';
      btnDlClear.style.display = 'none';
      dlUrlInput.focus();
    });
  }

  // Auto-paste from system clipboard
  if (btnDlPaste && dlUrlInput) {
    btnDlPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        dlUrlInput.value = text.trim();
        if (btnDlClear) btnDlClear.style.display = dlUrlInput.value ? 'block' : 'none';
        if (dlAutoDetectTooltip) dlAutoDetectTooltip.style.display = 'none';
        logToConsole("Pasted link from clipboard", "info");
      } catch (err) {
        console.warn("Failed to read clipboard:", err);
        alert("Please paste the link manually or grant clipboard permission in your browser.");
      }
    });
  }

  if (btnDlSubmit) {
    btnDlSubmit.addEventListener('click', () => {
      const url = dlUrlInput.value.trim();
      if (!url) {
        alert("Please paste a valid video URL.");
        return;
      }

      logToConsole(`Initializing video download: ${url}`, "info");
      dlLoading.style.display = 'flex';
      btnDlSubmit.disabled = true;
      btnDlSubmit.textContent = 'Processing...';

      // Save to local history
      saveUrlToHistory(url);

      if (dlAutoDetectTooltip) dlAutoDetectTooltip.style.display = 'none';

      // Set window.location.href to download API (triggers native file download prompt)
      window.location.href = `/api/download-video?url=${encodeURIComponent(url)}`;

      // Reset loading states after 8 seconds
      setTimeout(() => {
        dlLoading.style.display = 'none';
        btnDlSubmit.disabled = false;
        btnDlSubmit.textContent = 'Download Video';
      }, 8000);
    });
  }
}

// Toggle and select quick-access tabs
window.selectTab = function(tabId) {
  const panel = document.getElementById('accessPanel');
  const targetPanel = document.getElementById(`panel${tabId}`);
  const targetBtn = document.getElementById(`btnTab${tabId}`);
  
  if (!panel || !targetPanel || !targetBtn) return;
  
  const isCurrentlyActive = targetBtn.classList.contains('active');
  
  // 1. Deactivate all buttons
  document.querySelectorAll('.access-btn').forEach(btn => btn.classList.remove('active'));
  // 2. Hide all content panels
  document.querySelectorAll('.panel-content-item').forEach(p => p.style.display = 'none');
  
  if (isCurrentlyActive) {
    // Toggle off the main wrapper
    panel.style.display = 'none';
  } else {
    // Toggle on the main wrapper & show selected panel
    panel.style.display = 'block';
    targetPanel.style.display = 'block';
    targetBtn.classList.add('active');
    
    // Auto-expand mobile bottom sheet drawer if it's currently collapsed so user sees the panel contents
    const sheet = document.querySelector('.panel-left');
    if (sheet && !sheet.classList.contains('sheet-expanded') && window.innerWidth <= 992) {
      sheet.classList.add('sheet-expanded');
    }
  }
};

// Initialize mobile bottom sheet gestures and tap interactions
function initBottomSheet() {
  const sheet = document.querySelector('.panel-left');
  const handle = document.getElementById('sheetHandle');
  if (!sheet || !handle) return;
  
  // Slide up/down drawer toggle on clicking handle
  handle.addEventListener('click', () => {
    sheet.classList.toggle('sheet-expanded');
  });
  
  // Touch dragging gesture controls for slide-up sheet on mobile
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  
  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    isDragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    // Check offsets dynamically
    if (diff > 0) { // Dragging drawer down
      sheet.style.transform = `translateY(${diff}px)`;
    } else { // Dragging drawer up
      sheet.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });
  
  document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    
    const diff = currentY - startY;
    sheet.style.transform = ''; // Clear inline styles to let CSS configuration execute
    
    if (diff < -60) {
      sheet.classList.add('sheet-expanded');
    } else if (diff > 60) {
      sheet.classList.remove('sheet-expanded');
    }
  }, { passive: true });
}

// Sound button UI update helper
function updateSoundButtonUI() {
  const btn = document.getElementById('btnSoundToggle');
  if (!btn) return;
  if (audioEnabled) {
    btn.textContent = "🔊";
    btn.style.borderColor = "var(--accent-gold)";
    btn.style.color = "var(--accent-gold)";
    btn.title = "Mute alarm sounds";
  } else {
    btn.textContent = "🔇";
    btn.style.borderColor = "var(--border-color)";
    btn.style.color = "var(--text-muted)";
    btn.title = "Unmute alarm sounds";
  }
}
