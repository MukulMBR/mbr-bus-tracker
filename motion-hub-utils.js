// ─── MOTION HUB COMMON UTILS ───

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ─── LOCAL STORAGE TOOL CONFIGS HISTORY ───
const STORAGE_PREFIX = 'motion_hub_';

function getHubSetting(toolKey, settingKey, defaultValue) {
  try {
    const settings = JSON.parse(localStorage.getItem(STORAGE_PREFIX + toolKey) || '{}');
    return settings[settingKey] !== undefined ? settings[settingKey] : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setHubSetting(toolKey, settingKey, value) {
  try {
    const settings = JSON.parse(localStorage.getItem(STORAGE_PREFIX + toolKey) || '{}');
    settings[settingKey] = value;
    localStorage.setItem(STORAGE_PREFIX + toolKey, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to write local settings', e);
  }
}

// ─── SHARED FFMPEG INSTANCE ───
let sharedFfmpegInst = null;
let sharedFfmpegReady = false;

async function getSharedFfmpeg(setStep = () => {}) {
  if (!window.FFmpeg) {
    setStep('📥 Loading ffmpeg.wasm…');
    const sources = [
      '/libs/ffmpeg.min.js',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js',
      'https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js'
    ];
    let loaded = false;
    for (const url of sources) {
      try {
        await new Promise((ok, fail) => {
          const s = document.createElement('script');
          s.crossOrigin = 'anonymous';
          s.src = url;
          s.onload = ok;
          s.onerror = fail;
          document.head.appendChild(s);
        });
        loaded = true;
        break;
      } catch (e) {
        console.warn(`Failed to load from source: ${url}`);
      }
    }
    if (!loaded) {
      throw new Error('Failed to load ffmpeg.js from local server or CDNs.');
    }
  }
  
  if (!sharedFfmpegInst) {
    const { createFFmpeg } = FFmpeg;
    sharedFfmpegInst = createFFmpeg({
      corePath: '/libs/ffmpeg-core.js',
      log: false
    });
  }
  
  if (!sharedFfmpegReady) {
    setStep('⚙️ Initialising ffmpeg engine…');
    try {
      await sharedFfmpegInst.load();
      sharedFfmpegReady = true;
    } catch (err) {
      console.warn('Failed to load ffmpeg-core locally, falling back to CDNs…');
      const { createFFmpeg } = FFmpeg;
      try {
        sharedFfmpegInst = createFFmpeg({
          corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
          log: false
        });
        await sharedFfmpegInst.load();
        sharedFfmpegReady = true;
      } catch (err2) {
        console.warn('Failed to load from jsdelivr, trying unpkg…');
        sharedFfmpegInst = createFFmpeg({
          corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
          log: false
        });
        await sharedFfmpegInst.load();
        sharedFfmpegReady = true;
      }
    }
  }
  
  return sharedFfmpegInst;
}
