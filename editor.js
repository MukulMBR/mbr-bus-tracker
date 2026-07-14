// Advanced Reels Video Composer Engine - Simple & Advanced Workflows

// Editor Mode State
let editorMode = 'simple'; // 'simple' or 'advanced'

// State variables
let clip1 = { file: null, element: null, duration: 0 }; // Main Video
let trimStart = 0;
let trimEnd = 15;

// Audio Mixer State
let mainAudioVolume = 1.0;
let mainAudioMuted = false;
let mainAudioSolo = false;

// BGM State
let bgMusic = { file: null, element: null, duration: 0, volume: 0.5, isMuted: false, isSolo: false };

// Primary Cut (kept for backward compatibility & easy workflow)
let cutStart = 0;
let cutEnd = 5;
let clip2 = { file: null, type: 'video', element: null, duration: 5 }; // Primary Insertion Clip

// Additional Cuts Array
let additionalCuts = [];

// Captions Array (Advanced)
let captions = [];
let activeCaptionId = null;

// Simple Caption State (Simple Mode)
let simpleCaption = {
  text: '',
  color: '#ffffff',
  size: 28,
  showAt: 1.0,
  hideAt: 8.0
};

// Playback and Render State
let isPlaying = false;
let currentTime = 0;
let totalDuration = 10;
let animationFrameId = null;
let isExporting = false;

// Segment List calculated dynamically
let timelineSegments = [];

// DOM Elements
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnMute = document.getElementById('btnMute');
const btnExport = document.getElementById('btnExport');
const timeCurrent = document.getElementById('currentTime');
const timeTotal = document.getElementById('totalDuration');
const playhead = document.getElementById('playhead');

// Controls Elements
const c1Start = document.getElementById('c1Start');
const c1End = document.getElementById('c1End');
const c2Duration = document.getElementById('c2Duration');
const mainTrimStart = document.getElementById('mainTrimStart');
const mainTrimEnd = document.getElementById('mainTrimEnd');

// Audio Controls DOM
const mainVolume = document.getElementById('mainVolume');
const btnMuteMain = document.getElementById('btnMuteMain');
const btnSoloMain = document.getElementById('btnSoloMain');
const bgmFile = document.getElementById('bgmFile');
const bgmVolume = document.getElementById('bgmVolume');
const btnMuteBgm = document.getElementById('btnMuteBgm');
const btnSoloBgm = document.getElementById('btnSoloBgm');

// Caption Controls DOM
const captionsList = document.getElementById('captionsList');
const captionEditorPanel = document.getElementById('captionEditorPanel');
const captionText = document.getElementById('captionText');
const captionColor = document.getElementById('captionColor');
const captionSize = document.getElementById('captionSize');
const captionFontFamily = document.getElementById('captionFontFamily');
const captionFontWeight = document.getElementById('captionFontWeight');
const captionPositionPreset = document.getElementById('captionPositionPreset');
const captionAnimation = document.getElementById('captionAnimation');
const captionStart = document.getElementById('captionStart');
const captionEnd = document.getElementById('captionEnd');

// Simple Caption DOM
const simpleOverlayText = document.getElementById('simpleOverlayText');
const simpleTextColor = document.getElementById('simpleTextColor');
const simpleTextSize = document.getElementById('simpleTextSize');
const simpleTxtStart = document.getElementById('simpleTxtStart');
const simpleTxtEnd = document.getElementById('simpleTxtEnd');

// Log logger
function logToEditorConsole(message, type = "info") {
  const box = document.getElementById('editorConsole');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Format seconds into MM:SS
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Switch between simple and advanced modes
function setEditorMode(mode) {
  editorMode = mode;
  logToEditorConsole(`Switched to ${mode.toUpperCase()} mode.`);

  // Toggle active styling on buttons
  const btnSimple = document.getElementById('btnSimpleMode');
  const btnAdv = document.getElementById('btnAdvancedMode');
  if (mode === 'simple') {
    btnSimple.classList.add('active-solo');
    btnAdv.classList.remove('active-solo');
    
    // Hide Advanced Cards
    document.getElementById('advTrimControls').style.display = 'none';
    document.getElementById('cardAdditionalCuts').style.display = 'none';
    document.getElementById('cardCaptionLayers').style.display = 'none';
    document.getElementById('cardBgm').style.display = 'none';
    
    // Show Simple Cards
    document.getElementById('cardSimpleCaption').style.display = 'block';
  } else {
    btnSimple.classList.remove('active-solo');
    btnAdv.classList.add('active-solo');
    
    // Show Advanced Cards
    document.getElementById('advTrimControls').style.display = 'block';
    document.getElementById('cardAdditionalCuts').style.display = 'block';
    document.getElementById('cardCaptionLayers').style.display = 'block';
    document.getElementById('cardBgm').style.display = 'block';
    
    // Hide Simple Cards
    document.getElementById('cardSimpleCaption').style.display = 'none';
  }

  // Sync timeline variables
  if (mode === 'simple' && clip1.element) {
    trimStart = 0;
    trimEnd = clip1.duration;
  }

  recalculateTimeline();
  renderCanvas(isMuted);
}

// Build sequential segments based on Main Video Trim and Cuts List
function buildTimelineSegments() {
  timelineSegments = [];
  if (!clip1.element) return;

  if (editorMode === 'simple') {
    // Simple Mode: ONLY uses trimStart=0, trimEnd=clip1.duration, and primary cut
    trimStart = 0;
    trimEnd = clip1.duration;
    
    if (clip2.file) {
      timelineSegments.push({
        type: 'main',
        start: 0,
        end: cutStart,
        duration: cutStart
      });
      timelineSegments.push({
        type: 'insert',
        id: 'primary',
        clip: clip2,
        cutStart: cutStart,
        cutEnd: cutEnd,
        duration: clip2.duration
      });
      if (cutEnd < clip1.duration) {
        timelineSegments.push({
          type: 'main',
          start: cutEnd,
          end: clip1.duration,
          duration: clip1.duration - cutEnd
        });
      }
    } else {
      // Just play the full main video
      timelineSegments.push({
        type: 'main',
        start: 0,
        end: clip1.duration,
        duration: clip1.duration
      });
    }
  } else {
    // Advanced Mode: uses trimStart, trimEnd, and additionalCuts
    const allCuts = [];
    if (clip2.file) {
      allCuts.push({
        id: 'primary',
        cutStart: cutStart,
        cutEnd: cutEnd,
        clip: clip2
      });
    }
    additionalCuts.forEach(c => {
      if (c.clip.file) {
        allCuts.push(c);
      }
    });

    // Sort cuts by start times
    allCuts.sort((a, b) => a.cutStart - b.cutStart);

    let currentMainPos = trimStart;

    allCuts.forEach(cut => {
      if (cut.cutStart < currentMainPos) {
        cut.cutStart = currentMainPos;
      }
      if (cut.cutEnd < cut.cutStart) {
        cut.cutEnd = cut.cutStart;
      }

      if (cut.cutStart < trimEnd) {
        const mainSegmentDur = cut.cutStart - currentMainPos;
        if (mainSegmentDur > 0.05) {
          timelineSegments.push({
            type: 'main',
            start: currentMainPos,
            end: cut.cutStart,
            duration: mainSegmentDur
          });
        }

        const endOfCut = Math.min(cut.cutEnd, trimEnd);
        timelineSegments.push({
          type: 'insert',
          id: cut.id,
          clip: cut.clip,
          cutStart: cut.cutStart,
          cutEnd: endOfCut,
          duration: cut.clip.duration
        });

        currentMainPos = endOfCut;
      }
    });

    if (currentMainPos < trimEnd) {
      timelineSegments.push({
        type: 'main',
        start: currentMainPos,
        end: trimEnd,
        duration: trimEnd - currentMainPos
      });
    }
  }

  totalDuration = timelineSegments.reduce((sum, s) => sum + s.duration, 0);
  if (totalDuration < 0.1) totalDuration = 0.1;
}

// Find segment active at current absolute composed time
function getSegmentAtTime(time) {
  let accumulated = 0;
  for (let i = 0; i < timelineSegments.length; i++) {
    const s = timelineSegments[i];
    if (time < accumulated + s.duration) {
      return { segment: s, offset: time - accumulated };
    }
    accumulated += s.duration;
  }
  if (timelineSegments.length > 0) {
    const last = timelineSegments[timelineSegments.length - 1];
    return { segment: last, offset: last.duration };
  }
  return null;
}

// Calculate composed timeline duration and update block percentages
function recalculateTimeline() {
  buildTimelineSegments();

  if (!clip1.element) {
    totalDuration = 0;
    timeTotal.textContent = "00:00";
    document.getElementById('totalOutputLen').textContent = "0.0s";
    return;
  }

  timeTotal.textContent = formatTime(totalDuration);
  document.getElementById('totalOutputLen').textContent = `${totalDuration.toFixed(1)}s`;

  // Visual block width positioning
  const blockA = document.getElementById('blockMainPart1');
  const blockCut = document.getElementById('blockCutZone');
  const blockC = document.getElementById('blockMainPart2');
  const blockInsert = document.getElementById('blockInsert');
  const blockText = document.getElementById('blockText');

  let accumTime = 0;

  // Initialize track display blocks
  if (blockA) { blockA.style.display = 'none'; }
  if (blockCut) { blockCut.style.display = 'none'; }
  if (blockC) { blockC.style.display = 'none'; }
  if (blockInsert) { blockInsert.style.display = 'none'; }

  timelineSegments.forEach(s => {
    if (s.type === 'main') {
      if (accumTime === 0 && blockA) {
        const pctA = (s.duration / totalDuration) * 100;
        blockA.style.width = `${pctA}%`;
        blockA.style.left = '0%';
        blockA.textContent = `Main Part A (${s.duration.toFixed(1)}s)`;
        blockA.style.display = 'flex';
      }
      else if (blockC) {
        const pctC = (s.duration / totalDuration) * 100;
        blockC.style.width = `${pctC}%`;
        blockC.style.left = `${(accumTime / totalDuration) * 100}%`;
        blockC.textContent = `Main Part C (${s.duration.toFixed(1)}s)`;
        blockC.style.display = 'flex';
      }
    } else if (s.id === 'primary') {
      const pctInsert = (s.duration / totalDuration) * 100;
      const leftPct = ((accumTime) / totalDuration) * 100;
      
      if (blockInsert) {
        blockInsert.style.width = `${pctInsert}%`;
        blockInsert.style.left = `${leftPct}%`;
        blockInsert.textContent = clip2.file ? `Insert (${s.duration.toFixed(1)}s)` : 'Insertion Clip';
        blockInsert.style.display = 'flex';
      }

      if (blockCut) {
        blockCut.style.width = `${pctInsert}%`;
        blockCut.style.left = `${leftPct}%`;
        blockCut.style.display = 'flex';
      }
    }
    accumTime += s.duration;
  });

  // Track Caption layer visualization on timeline
  if (blockText) {
    if (editorMode === 'simple') {
      const textVal = simpleOverlayText.value;
      if (textVal) {
        const textLen = Math.max(0, simpleCaption.hideAt - simpleCaption.showAt);
        blockText.style.width = `${(textLen / totalDuration) * 100}%`;
        blockText.style.left = `${(simpleCaption.showAt / totalDuration) * 100}%`;
        blockText.textContent = `Text: "${textVal}"`;
        blockText.style.display = 'block';
      } else {
        blockText.style.display = 'none';
      }
    } else {
      const activeCap = captions.find(c => c.id === activeCaptionId);
      if (activeCap) {
        const textStart = activeCap.showAt;
        const textEnd = Math.min(activeCap.hideAt, totalDuration);
        const textLen = Math.max(0, textEnd - textStart);
        
        blockText.style.width = `${(textLen / totalDuration) * 100}%`;
        blockText.style.left = `${(textStart / totalDuration) * 100}%`;
        blockText.textContent = `Text: "${activeCap.text}"`;
        blockText.style.display = 'block';
      } else {
        blockText.style.display = 'none';
      }
    }
  }

  // Update main sliders bounds
  mainTrimStart.max = clip1.duration;
  mainTrimEnd.max = clip1.duration;
  c1Start.max = clip1.duration;
  c1End.max = clip1.duration;
  
  simpleTxtStart.max = totalDuration;
  simpleTxtEnd.max = totalDuration;
}

// Draw a centered cropped video frame to 9:16 vertical ratio
function drawFrame(mediaElement, type = 'video') {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let mediaWidth = 0;
  let mediaHeight = 0;

  if (type === 'video') {
    mediaWidth = mediaElement.videoWidth;
    mediaHeight = mediaElement.videoHeight;
  } else {
    mediaWidth = mediaElement.width;
    mediaHeight = mediaElement.height;
  }

  if (!mediaWidth || !mediaHeight) return;

  const targetRatio = 9 / 16;
  const mediaRatio = mediaWidth / mediaHeight;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = mediaWidth;
  let sourceHeight = mediaHeight;

  if (mediaRatio > targetRatio) {
    sourceWidth = mediaHeight * targetRatio;
    sourceX = (mediaWidth - sourceWidth) / 2;
  } else {
    sourceHeight = mediaWidth / targetRatio;
    sourceY = (mediaHeight - sourceHeight) / 2;
  }

  ctx.drawImage(mediaElement, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
}

// Mute/Pause inactive clips and apply volume/mute/solo properties to active playing clips during preview (Simple/Advanced)
function syncMixerLevels(activeSource) {
  if (!isPlaying || isExporting) return;

  let finalMainVol = mainAudioVolume;
  let finalBgmVol = bgMusic.volume;

  if (editorMode === 'simple') {
    // Simple Mode: Just unmute the playing element and mute the other
    if (clip1.element) {
      clip1.element.volume = isMuted ? 0 : 1.0;
      clip1.element.muted = (activeSource !== clip1.element || isMuted);
    }
    if (clip2.element && clip2.type === 'video') {
      clip2.element.volume = isMuted ? 0 : 1.0;
      clip2.element.muted = (activeSource !== clip2.element || isMuted);
    }
    return;
  }

  // Advanced Mode: Apply full original mixer sliders + BGM + Solo overrides
  const isMainSoloActive = mainAudioSolo;
  const isBgmSoloActive = bgMusic.isSolo;
  const anySoloActive = isMainSoloActive || isBgmSoloActive;

  if (mainAudioMuted) finalMainVol = 0;
  if (anySoloActive && !isMainSoloActive) finalMainVol = 0;

  if (bgMusic.isMuted) finalBgmVol = 0;
  if (anySoloActive && !isBgmSoloActive) finalBgmVol = 0;

  if (clip1.element) {
    clip1.element.volume = isMuted ? 0 : finalMainVol;
    clip1.element.muted = (activeSource !== clip1.element || isMuted || finalMainVol === 0);
  }

  if (bgMusic.element) {
    bgMusic.element.volume = isMuted ? 0 : finalBgmVol;
    bgMusic.element.muted = (isMuted || finalBgmVol === 0);
  }

  additionalCuts.forEach(c => {
    if (c.clip.element && c.clip.type === 'video') {
      const isThisActive = (activeSource === c.clip.element);
      c.clip.element.volume = isMuted ? 0 : finalMainVol;
      c.clip.element.muted = (!isThisActive || isMuted || finalMainVol === 0);
    }
  });

  if (clip2.element && clip2.type === 'video') {
    const isThisActive = (activeSource === clip2.element);
    clip2.element.volume = isMuted ? 0 : finalMainVol;
    clip2.element.muted = (!isThisActive || isMuted || finalMainVol === 0);
  }
}

// Render active preview frame depending on current time segment
function renderCanvas(isMutedState = false) {
  if (!clip1.element) return;

  const result = getSegmentAtTime(currentTime);
  if (!result) return;

  const { segment, offset } = result;
  let activeSource = null;
  let activeType = 'video';
  let seekTime = 0;

  if (segment.type === 'main') {
    activeSource = clip1.element;
    seekTime = segment.start + offset;
  } else {
    activeSource = segment.clip.element;
    activeType = segment.clip.type;
    seekTime = offset;
  }

  if (activeSource) {
    if (activeType === 'video') {
      const tolerance = isPlaying ? 0.35 : 0.05;
      if (Math.abs(activeSource.currentTime - seekTime) > tolerance) {
        activeSource.currentTime = seekTime;
      }
      
      if (isPlaying && !isExporting) {
        if (activeSource.paused) {
          try { activeSource.play(); } catch(e) {}
        }
      }
    }
    drawFrame(activeSource, activeType);
  }

  // Synchronize playing states and volumes
  if (isPlaying && !isExporting) {
    if (activeSource !== clip1.element && clip1.element) clip1.element.pause();
    if (activeSource !== clip2.element && clip2.element && clip2.type === 'video') clip2.element.pause();
    additionalCuts.forEach(c => {
      if (activeSource !== c.clip.element && c.clip.element && c.clip.type === 'video') c.clip.element.pause();
    });

    syncMixerLevels(activeSource);
  }

  // Draw Captions Text overlay layers
  drawCaptions();
}

// Render active captions (Simple / Advanced)
function drawCaptions() {
  if (editorMode === 'simple') {
    const textVal = simpleOverlayText.value;
    const age = currentTime - simpleCaption.showAt;
    if (age >= 0 && currentTime <= simpleCaption.hideAt && textVal) {
      ctx.save();
      ctx.fillStyle = simpleCaption.color;
      ctx.font = `bold ${simpleCaption.size}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const x = canvas.width / 2;
      const y = canvas.height * 0.82;
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(textVal, x, y);
      ctx.fillText(textVal, x, y);
      ctx.restore();
    }
  } else {
    // Advanced caption layers
    captions.forEach(c => {
      const age = currentTime - c.showAt;
      if (age >= 0 && currentTime <= c.hideAt && c.text) {
        ctx.save();
        
        ctx.fillStyle = c.color;
        ctx.font = `${c.weight} ${c.size}px ${c.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let x = canvas.width / 2;
        let y = canvas.height * 0.82;
        
        if (c.positionMode === 'preset') {
          if (c.presetPosition === 'top') {
            y = canvas.height * 0.15;
          } else if (c.presetPosition === 'center') {
            y = canvas.height * 0.5;
          } else {
            y = canvas.height * 0.82;
          }
        } else {
          x = c.customX;
          y = c.customY;
        }
        
        const animDuration = 0.5;
        if (age < animDuration && c.animation !== 'none') {
          const t = age / animDuration;
          if (c.animation === 'fade') {
            ctx.globalAlpha = t;
          } else if (c.animation === 'slide') {
            const offsetY = (1 - t) * 45;
            y += offsetY;
          }
        }
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(c.text, x, y);
        ctx.fillText(c.text, x, y);
        
        if (c.id === activeCaptionId && !isExporting) {
          ctx.strokeStyle = '#3797f0';
          ctx.lineWidth = 2;
          const textWidth = ctx.measureText(c.text).width;
          ctx.strokeRect(x - textWidth / 2 - 10, y - c.size / 2 - 6, textWidth + 20, c.size + 12);
        }
        
        ctx.restore();
      }
    });
  }
}

// Playback frame loop
let lastTime = 0;
function playbackLoop(timestamp) {
  if (!isPlaying) return;
  if (!lastTime) lastTime = timestamp;

  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  currentTime += delta;

  if (currentTime >= totalDuration) {
    currentTime = 0;
    if (clip1.element) clip1.element.currentTime = trimStart;
    if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;
    if (bgMusic.element) bgMusic.element.currentTime = 0;
    additionalCuts.forEach(c => {
      if (c.clip.element && c.clip.type === 'video') c.clip.element.currentTime = 0;
    });
  }

  // Sync background music element
  if (editorMode === 'advanced' && bgMusic.element) {
    if (bgMusic.element.paused) {
      try { bgMusic.element.play(); } catch(e) {}
    }
    if (Math.abs(bgMusic.element.currentTime - currentTime) > 0.3) {
      bgMusic.element.currentTime = currentTime;
    }
  }

  // Update time display and playhead position
  timeCurrent.textContent = formatTime(currentTime);
  playhead.style.left = `${(currentTime / totalDuration) * 100}%`;

  // Pre-seek / Warm up upcoming video decoders 1.2s before transition
  if (isPlaying && !isExporting) {
    const nextResult = getSegmentAtTime(currentTime + 1.2);
    if (nextResult) {
      const { segment: nextSeg } = nextResult;
      const currentResult = getSegmentAtTime(currentTime);
      
      if (currentResult && currentResult.segment !== nextSeg) {
        if (nextSeg.type === 'main') {
          if (Math.abs(clip1.element.currentTime - nextSeg.start) > 0.25) {
            clip1.element.currentTime = nextSeg.start;
          }
        } else if (nextSeg.clip.element && nextSeg.clip.type === 'video') {
          if (Math.abs(nextSeg.clip.element.currentTime - 0) > 0.15) {
            nextSeg.clip.element.currentTime = 0;
          }
        }
      }
    }
  }

  renderCanvas(isMuted);
  animationFrameId = requestAnimationFrame(playbackLoop);
}

// Toggle Play/Pause
function togglePlayPause() {
  if (!clip1.element) return;

  if (isPlaying) {
    isPlaying = false;
    btnPlayPause.textContent = '▶ Play';
    if (clip1.element) clip1.element.pause();
    if (clip2.element && clip2.type === 'video') clip2.element.pause();
    if (bgMusic.element) bgMusic.element.pause();
    additionalCuts.forEach(c => {
      if (c.clip.element && c.clip.type === 'video') c.clip.element.pause();
    });
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    logToEditorConsole("Playback paused.");
  } else {
    isPlaying = true;
    btnPlayPause.textContent = '⏸ Pause';
    lastTime = 0;
    animationFrameId = requestAnimationFrame(playbackLoop);
    logToEditorConsole("Playback started.");
  }
}

// Main Video File selection handler
document.getElementById('clip1File').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading Main Video: ${file.name}...`);
  clip1.file = file;
  document.getElementById('clip1Name').textContent = file.name;
  document.getElementById('clip1Details').style.display = 'block';

  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = false;
  video.loop = false;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  video.addEventListener('loadedmetadata', () => {
    clip1.element = video;
    clip1.duration = video.duration;
    
    trimStart = 0;
    trimEnd = video.duration;
    cutStart = 0;
    cutEnd = Math.min(5, video.duration);

    // Setup input sliders
    mainTrimStart.max = video.duration;
    mainTrimEnd.max = video.duration;
    mainTrimStart.value = 0;
    mainTrimEnd.value = video.duration;

    c1Start.disabled = false;
    c1End.disabled = false;
    c1Start.max = video.duration;
    c1End.max = video.duration;
    c1Start.value = 0;
    c1End.value = cutEnd;

    document.getElementById('clip1DurationText').textContent = `${video.duration.toFixed(1)}s`;
    document.getElementById('mainTrimStartVal').textContent = '0.0s';
    document.getElementById('mainTrimEndVal').textContent = `${video.duration.toFixed(1)}s`;
    document.getElementById('cutStartVal').textContent = '0.0s';
    document.getElementById('cutEndVal').textContent = `${cutEnd.toFixed(1)}s`;

    btnPlayPause.disabled = false;

    logToEditorConsole(`Main video loaded. Length: ${video.duration.toFixed(1)}s`, "success");
    recalculateTimeline();
    renderCanvas(isMuted);
  });
});

// Primary Insertion selection
document.getElementById('clip2File').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading Primary Insertion: ${file.name}...`);
  clip2.file = file;
  document.getElementById('clip2Name').textContent = file.name;
  document.getElementById('clip2Details').style.display = 'block';

  const isImage = file.type.startsWith('image/');
  
  if (isImage) {
    clip2.type = 'image';
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      clip2.element = img;
      clip2.duration = 5.0;
      c2Duration.value = 5.0;
      document.getElementById('c2DurVal').textContent = '5.0s';
      recalculateTimeline();
      renderCanvas(isMuted);
    };
  } else {
    clip2.type = 'video';
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.loop = false;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.addEventListener('loadedmetadata', () => {
      clip2.element = video;
      clip2.duration = video.duration;
      c2Duration.value = video.duration;
      document.getElementById('c2DurVal').textContent = `${video.duration.toFixed(1)}s`;
      recalculateTimeline();
      renderCanvas(isMuted);
    });
  }
});

// Original Audio Volume / Mute / Solo selectors
mainVolume.addEventListener('input', (e) => {
  mainAudioVolume = parseFloat(e.target.value);
});

btnMuteMain.addEventListener('click', () => {
  mainAudioMuted = !mainAudioMuted;
  btnMuteMain.classList.toggle('active-mute', mainAudioMuted);
  logToEditorConsole(`Original Video Audio Muted: ${mainAudioMuted}`);
});

btnSoloMain.addEventListener('click', () => {
  mainAudioSolo = !mainAudioSolo;
  btnSoloMain.classList.toggle('active-solo', mainAudioSolo);
  if (mainAudioSolo && bgMusic.isSolo) {
    bgMusic.isSolo = false;
    btnSoloBgm.classList.remove('active-solo');
  }
  logToEditorConsole(`Original Video Audio Solo: ${mainAudioSolo}`);
});

// Trim and Cut input sliders
mainTrimStart.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val >= trimEnd) {
    mainTrimStart.value = trimEnd - 0.1;
    return;
  }
  trimStart = val;
  document.getElementById('mainTrimStartVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas(isMuted);
});

mainTrimEnd.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val <= trimStart) {
    mainTrimEnd.value = trimStart + 0.1;
    return;
  }
  trimEnd = val;
  document.getElementById('mainTrimEndVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas(isMuted);
});

c1Start.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val >= cutEnd) {
    c1Start.value = cutEnd - 0.1;
    return;
  }
  cutStart = val;
  document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas(isMuted);
});

c1End.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val <= cutStart) {
    c1End.value = cutStart + 0.1;
    return;
  }
  cutEnd = val;
  document.getElementById('cutEndVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas(isMuted);
});

c2Duration.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  clip2.duration = val;
  document.getElementById('c2DurVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas(isMuted);
});

// Additional Cut Zones list controller
document.getElementById('btnAddCut').addEventListener('click', () => {
  if (!clip1.element) {
    alert("Please upload the Main Video (Step 1) first.");
    return;
  }

  const newCutId = Date.now();
  const newCut = {
    id: newCutId,
    cutStart: Math.min(clip1.duration - 2, Math.max(0, currentTime)),
    cutEnd: Math.min(clip1.duration, Math.max(2, currentTime + 3)),
    clip: {
      file: null,
      type: 'video',
      element: null,
      duration: 3
    }
  };

  additionalCuts.push(newCut);
  logToEditorConsole("Additional cut zone slot added.");
  renderAdditionalCutsList();
  recalculateTimeline();
  renderCanvas(isMuted);
});

function renderAdditionalCutsList() {
  const list = document.getElementById('additionalCutsList');
  list.innerHTML = '';

  additionalCuts.forEach(c => {
    const card = document.createElement('div');
    card.className = 'cut-item-card';
    card.innerHTML = `
      <h4>✂️ Extra Cut Slot</h4>
      <button class="delete-cut-btn" title="Remove Cut">✕</button>
      
      <div class="slider-group" style="margin-top: 4px;">
        <div class="slider-labels">
          <span>Starts: <strong>${c.cutStart.toFixed(1)}s</strong></span>
          <span>Ends: <strong>${c.cutEnd.toFixed(1)}s</strong></span>
        </div>
        <input type="range" class="cut-start-slider" min="0" max="${clip1.duration}" step="0.1" value="${c.cutStart}" />
        <input type="range" class="cut-end-slider" min="0" max="${clip1.duration}" step="0.1" value="${c.cutEnd}" />
      </div>

      <div class="file-input-wrapper" style="margin-top: 8px;">
        <input type="file" class="cut-file-input" accept="video/*,image/*" id="input_${c.id}" />
        <label for="input_${c.id}" class="file-label" style="padding: 6px; font-size: 0.72rem; cursor: pointer;">Choose Insertion file</label>
      </div>
      <div class="cut-details" style="display: none; margin-top: 6px;">
        <span class="filename cut-filename"></span>
        <div class="slider-group">
          <div class="slider-labels">
            <span>Insert Length: <strong>${c.clip.duration.toFixed(1)}s</strong></span>
          </div>
          <input type="range" class="cut-dur-slider" min="1" max="15" step="0.1" value="${c.clip.duration}" />
        </div>
      </div>
    `;

    const startSlider = card.querySelector('.cut-start-slider');
    const endSlider = card.querySelector('.cut-end-slider');
    const fileInput = card.querySelector('.cut-file-input');
    const durSlider = card.querySelector('.cut-dur-slider');
    const detailsDiv = card.querySelector('.cut-details');
    const filenameSpan = card.querySelector('.cut-filename');

    if (c.clip.file) {
      detailsDiv.style.display = 'block';
      filenameSpan.textContent = c.clip.file.name;
      card.querySelector('.file-label').textContent = "Change Insertion File";
    }

    startSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val >= c.cutEnd) {
        startSlider.value = c.cutEnd - 0.1;
        return;
      }
      c.cutStart = val;
      recalculateTimeline();
      renderCanvas(isMuted);
    });

    endSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val <= c.cutStart) {
        endSlider.value = c.cutStart + 0.1;
        return;
      }
      c.cutEnd = val;
      recalculateTimeline();
      renderCanvas(isMuted);
    });

    durSlider.addEventListener('input', (e) => {
      c.clip.duration = parseFloat(e.target.value);
      recalculateTimeline();
      renderCanvas(isMuted);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      c.clip.file = file;
      filenameSpan.textContent = file.name;
      detailsDiv.style.display = 'block';
      card.querySelector('.file-label').textContent = "Change Insertion File";

      const isImage = file.type.startsWith('image/');
      if (isImage) {
        c.clip.type = 'image';
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          c.clip.element = img;
          c.clip.duration = 5.0;
          durSlider.value = 5.0;
          recalculateTimeline();
          renderCanvas(isMuted);
        };
      } else {
        c.clip.type = 'video';
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.loop = false;
        video.playsInline = true;
        video.addEventListener('loadedmetadata', () => {
          c.clip.element = video;
          c.clip.duration = video.duration;
          durSlider.max = video.duration;
          durSlider.value = video.duration;
          recalculateTimeline();
          renderCanvas(isMuted);
        });
      }
    });

    card.querySelector('.delete-cut-btn').addEventListener('click', () => {
      additionalCuts = additionalCuts.filter(x => x.id !== c.id);
      logToEditorConsole("Additional cut zone removed.");
      renderAdditionalCutsList();
      recalculateTimeline();
      renderCanvas(isMuted);
    });

    list.appendChild(card);
  });
}

// BGM selection uploader
bgmFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading BGM: ${file.name}...`);
  bgMusic.file = file;
  document.getElementById('bgmName').textContent = file.name;
  document.getElementById('bgmDetails').style.display = 'block';

  const audio = document.createElement('audio');
  audio.src = URL.createObjectURL(file);
  audio.loop = true;
  audio.crossOrigin = 'anonymous';

  audio.addEventListener('loadedmetadata', () => {
    bgMusic.element = audio;
    bgMusic.duration = audio.duration;
    logToEditorConsole(`BGM Audio loaded successfully.`, "success");
  });
});

bgmVolume.addEventListener('input', (e) => {
  bgMusic.volume = parseFloat(e.target.value);
});

btnMuteBgm.addEventListener('click', () => {
  bgMusic.isMuted = !bgMusic.isMuted;
  btnMuteBgm.classList.toggle('active-mute', bgMusic.isMuted);
  logToEditorConsole(`BGM Audio Muted: ${bgMusic.isMuted}`);
});

btnSoloBgm.addEventListener('click', () => {
  bgMusic.isSolo = !bgMusic.isSolo;
  btnSoloBgm.classList.toggle('active-solo', bgMusic.isSolo);
  if (bgMusic.isSolo && mainAudioSolo) {
    mainAudioSolo = false;
    btnSoloMain.classList.remove('active-solo');
  }
  logToEditorConsole(`BGM Audio Solo: ${bgMusic.isSolo}`);
});

// Simple Caption Event bindings
simpleOverlayText.addEventListener('input', (e) => {
  simpleCaption.text = e.target.value;
  recalculateTimeline();
  renderCanvas(isMuted);
});

simpleTextColor.addEventListener('input', (e) => {
  simpleCaption.color = e.target.value;
  renderCanvas(isMuted);
});

simpleTextSize.addEventListener('input', (e) => {
  simpleCaption.size = parseInt(e.target.value);
  renderCanvas(isMuted);
});

simpleTxtStart.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val >= simpleCaption.hideAt) {
    simpleTxtStart.value = simpleCaption.hideAt - 0.1;
    return;
  }
  simpleCaption.showAt = val;
  document.getElementById('simpleTxtStartVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  renderCanvas(isMuted);
});

simpleTxtEnd.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val <= simpleCaption.showAt) {
    simpleTxtEnd.value = simpleCaption.showAt + 0.1;
    return;
  }
  simpleCaption.hideAt = val;
  document.getElementById('simpleTxtEndVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  renderCanvas(isMuted);
});

// Captions Multi-Layer Manager Panel (Advanced)
document.getElementById('btnAddCaption').addEventListener('click', () => {
  const id = Date.now();
  const newCap = {
    id,
    text: 'Tap to type...',
    color: '#ffffff',
    size: 28,
    weight: 'bold',
    fontFamily: 'Outfit, sans-serif',
    showAt: Math.max(0, currentTime),
    hideAt: Math.min(totalDuration, currentTime + 5),
    positionMode: 'preset',
    presetPosition: 'bottom',
    customX: canvas.width / 2,
    customY: canvas.height * 0.82,
    animation: 'none'
  };

  captions.push(newCap);
  logToEditorConsole("New Caption layer added.");
  selectCaption(id);
});

function renderCaptionsList() {
  captionsList.innerHTML = '';
  captions.forEach(c => {
    const row = document.createElement('div');
    row.className = `caption-item-row ${c.id === activeCaptionId ? 'active' : ''}`;
    row.innerHTML = `
      <span>🔤 ${c.text || '(Empty Text)'}</span>
      <span class="time-tag">${c.showAt.toFixed(1)}s - ${c.hideAt.toFixed(1)}s</span>
    `;
    row.addEventListener('click', () => {
      selectCaption(c.id);
    });
    captionsList.appendChild(row);
  });
}

function selectCaption(id) {
  activeCaptionId = id;
  renderCaptionsList();

  const c = captions.find(x => x.id === id);
  if (!c) {
    captionEditorPanel.style.display = 'none';
    return;
  }

  captionEditorPanel.style.display = 'block';
  captionText.value = c.text;
  captionColor.value = c.color;
  captionSize.value = c.size;
  captionFontFamily.value = c.fontFamily;
  captionFontWeight.value = c.weight;
  captionPositionPreset.value = c.positionMode === 'preset' ? c.presetPosition : 'custom';
  captionAnimation.value = c.animation;
  
  captionStart.max = totalDuration;
  captionEnd.max = totalDuration;
  captionStart.value = c.showAt;
  captionEnd.value = c.hideAt;

  document.getElementById('captionStartVal').textContent = `${c.showAt.toFixed(1)}s`;
  document.getElementById('captionEndVal').textContent = `${c.hideAt.toFixed(1)}s`;

  recalculateTimeline();
  renderCanvas(isMuted);
}

// Caption Editor Panel Change events
captionText.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.text = e.target.value;
    renderCaptionsList();
    renderCanvas(isMuted);
  }
});

captionColor.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.color = e.target.value;
    renderCanvas(isMuted);
  }
});

captionSize.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.size = parseInt(e.target.value);
    renderCanvas(isMuted);
  }
});

captionFontFamily.addEventListener('change', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.fontFamily = e.target.value;
    renderCanvas(isMuted);
  }
});

captionFontWeight.addEventListener('change', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.weight = e.target.value;
    renderCanvas(isMuted);
  }
});

captionPositionPreset.addEventListener('change', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    const val = e.target.value;
    if (val === 'custom') {
      active.positionMode = 'custom';
      active.customX = canvas.width / 2;
      active.customY = canvas.height * 0.82;
    } else {
      active.positionMode = 'preset';
      active.presetPosition = val;
    }
    renderCanvas(isMuted);
  }
});

captionAnimation.addEventListener('change', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.animation = e.target.value;
    renderCanvas(isMuted);
  }
});

captionStart.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    const val = parseFloat(e.target.value);
    if (val >= active.hideAt) {
      captionStart.value = active.hideAt - 0.1;
      return;
    }
    active.showAt = val;
    document.getElementById('captionStartVal').textContent = `${val.toFixed(1)}s`;
    recalculateTimeline();
    renderCanvas(isMuted);
  }
});

captionEnd.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    const val = parseFloat(e.target.value);
    if (val <= active.showAt) {
      captionEnd.value = active.showAt + 0.1;
      return;
    }
    active.hideAt = val;
    document.getElementById('captionEndVal').textContent = `${val.toFixed(1)}s`;
    recalculateTimeline();
    renderCanvas(isMuted);
  }
});

document.getElementById('btnDeleteCaption').addEventListener('click', () => {
  if (activeCaptionId) {
    captions = captions.filter(x => x.id !== activeCaptionId);
    logToEditorConsole("Caption layer deleted.");
    activeCaptionId = null;
    selectCaption(null);
  }
});

// Playhead scrubbing
document.querySelector('.timeline-tracks').addEventListener('click', (e) => {
  if (!clip1.element) return;
  if (e.target.closest('.track-label')) return;
  
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left - 80;
  const width = rect.width - 80;
  
  if (clickX >= 0 && clickX <= width) {
    const pct = clickX / width;
    currentTime = pct * totalDuration;
    timeCurrent.textContent = formatTime(currentTime);
    playhead.style.left = `${pct * 100}%`;

    if (bgMusic.element) {
      bgMusic.element.currentTime = currentTime;
    }
    renderCanvas(isMuted);
  }
});

btnPlayPause.addEventListener('click', togglePlayPause);

// Speaker Mute indicator
btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  btnMute.textContent = isMuted ? '🔇' : '🔊';
  
  if (clip1.element) clip1.element.muted = isMuted;
  if (bgMusic.element) bgMusic.element.muted = isMuted;
  additionalCuts.forEach(c => {
    if (c.clip.element) c.clip.element.muted = isMuted;
  });
  if (clip2.element) clip2.element.muted = isMuted;

  logToEditorConsole(`Master Audio speaker muted: ${isMuted}`);
});

// Canvas caption drag listener
let activeDraggedCaption = null;
function setupCanvasDragging() {
  const getCanvasCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const handleStart = (e) => {
    if (!clip1.element) return;
    if (editorMode === 'simple') return; // Canvas dragging only enabled in Advanced Mode

    const { x, y } = getCanvasCoords(e);

    // Check hit collision box for any active caption
    for (let i = captions.length - 1; i >= 0; i--) {
      const c = captions[i];
      if (currentTime >= c.showAt && currentTime <= c.hideAt && c.text) {
        ctx.save();
        ctx.font = `${c.weight} ${c.size}px ${c.fontFamily}`;
        const textWidth = ctx.measureText(c.text).width;
        ctx.restore();
        
        let capX = canvas.width / 2;
        let capY = canvas.height * 0.82;
        
        if (c.positionMode === 'preset') {
          if (c.presetPosition === 'top') capY = canvas.height * 0.15;
          else if (c.presetPosition === 'center') capY = canvas.height * 0.5;
          else capY = canvas.height * 0.82;
        } else {
          capX = c.customX;
          capY = c.customY;
        }

        const halfW = textWidth / 2 + 15;
        const halfH = c.size / 2 + 10;

        if (x >= capX - halfW && x <= capX + halfW && y >= capY - halfH && y <= capY + halfH) {
          activeDraggedCaption = c;
          c.positionMode = 'custom';
          c.customX = x;
          c.customY = y;
          selectCaption(c.id);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleMove = (e) => {
    if (!activeDraggedCaption) return;
    const { x, y } = getCanvasCoords(e);
    
    activeDraggedCaption.customX = Math.max(20, Math.min(canvas.width - 20, x));
    activeDraggedCaption.customY = Math.max(20, Math.min(canvas.height - 20, y));

    captionPositionPreset.value = 'custom';
    renderCanvas(isMuted);
    e.preventDefault();
  };

  const handleEnd = () => {
    if (activeDraggedCaption) {
      activeDraggedCaption = null;
      logToEditorConsole("Caption position adjusted via drag.");
    }
  };

  canvas.addEventListener('mousedown', handleStart);
  canvas.addEventListener('touchstart', handleStart, { passive: false });
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('mouseup', handleEnd);
  window.addEventListener('touchend', handleEnd);
}

// Playhead blocks drag interactions
function setupTimelineDragging() {
  const tracks = document.querySelector('.timeline-tracks');
  if (!tracks) return;

  let activeDrag = null;

  function handleStart(e, element, actionType) {
    if (!clip1.element) return;
    e.preventDefault();
    e.stopPropagation();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    
    activeDrag = {
      element,
      action: actionType,
      startX: clientX,
      startVals: {
        cutStart,
        cutEnd,
        trimStart,
        trimEnd,
        clip2Duration: clip2.duration
      }
    };

    element.style.cursor = 'grabbing';
    document.body.style.cursor = 'col-resize';
  }

  const bindBlockDrag = (element, id) => {
    if (!element) return;

    const startHandler = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const rect = element.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const pct = clickX / rect.width;

      let action = 'move';
      if (id === 'MainPart1') {
        action = pct < 0.15 ? 'left' : 'right'; // Left edge trims start, right adjusts cutStart
      } else if (id === 'MainPart2') {
        action = pct > 0.85 ? 'right' : 'left'; // Right edge trims end, left adjusts cutEnd
      } else {
        if (pct < 0.15) action = 'left';
        else if (pct > 0.85) action = 'right';
        else action = 'move';
      }

      handleStart(e, element, action);
    };

    element.addEventListener('mousedown', startHandler);
    element.addEventListener('touchstart', startHandler, { passive: false });
  };

  bindBlockDrag(document.getElementById('blockMainPart1'), 'MainPart1');
  bindBlockDrag(document.getElementById('blockMainPart2'), 'MainPart2');
  bindBlockDrag(document.getElementById('blockCutZone'), 'CutZone');
  bindBlockDrag(document.getElementById('blockInsert'), 'Insert');
  bindBlockDrag(document.getElementById('blockText'), 'Text');

  const moveHandler = (e) => {
    if (!activeDrag) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const deltaX = clientX - activeDrag.startX;
    
    const trackWidth = tracks.getBoundingClientRect().width - 80;
    if (trackWidth <= 0) return;

    const deltaTime = (deltaX / trackWidth) * totalDuration;
    const vals = activeDrag.startVals;
    const id = activeDrag.element.id;

    if (id === 'blockMainPart1') {
      if (activeDrag.action === 'left' && editorMode === 'advanced') {
        let val = vals.trimStart + deltaTime;
        if (val < 0) val = 0;
        if (val >= cutStart) val = cutStart - 0.1;
        trimStart = val;
        mainTrimStart.value = val;
        document.getElementById('mainTrimStartVal').textContent = `${val.toFixed(1)}s`;
      } else {
        let val = vals.cutStart + deltaTime;
        if (val <= trimStart) val = trimStart + 0.1;
        if (val >= cutEnd) val = cutEnd - 0.1;
        cutStart = val;
        c1Start.value = val;
        document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
      }
    } 
    else if (id === 'blockMainPart2') {
      if (activeDrag.action === 'right' && editorMode === 'advanced') {
        let val = vals.trimEnd + deltaTime;
        if (val <= cutEnd) val = cutEnd + 0.1;
        if (val > clip1.duration) val = clip1.duration;
        trimEnd = val;
        mainTrimEnd.value = val;
        document.getElementById('mainTrimEndVal').textContent = `${val.toFixed(1)}s`;
      } else {
        let val = vals.cutEnd + deltaTime;
        if (val <= cutStart) val = cutStart + 0.1;
        if (val >= trimEnd) val = trimEnd - 0.1;
        cutEnd = val;
        c1End.value = val;
        document.getElementById('cutEndVal').textContent = `${val.toFixed(1)}s`;
      }
    } 
    else if (id === 'blockCutZone') {
      if (activeDrag.action === 'left') {
        let val = vals.cutStart + deltaTime;
        if (val < trimStart) val = trimStart;
        if (val >= cutEnd) val = cutEnd - 0.1;
        cutStart = val;
        c1Start.value = val;
        document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
      } else if (activeDrag.action === 'right') {
        let val = vals.cutEnd + deltaTime;
        if (val <= cutStart) val = cutStart + 0.1;
        if (val > trimEnd) val = trimEnd;
        cutEnd = val;
        c1End.value = val;
        document.getElementById('cutEndVal').textContent = `${val.toFixed(1)}s`;
      } else {
        const cutLen = vals.cutEnd - vals.cutStart;
        let newStart = vals.cutStart + deltaTime;
        let newEnd = newStart + cutLen;
        
        if (newStart < trimStart) {
          newStart = trimStart;
          newEnd = newStart + cutLen;
        }
        if (newEnd > trimEnd) {
          newEnd = trimEnd;
          newStart = newEnd - cutLen;
        }

        cutStart = newStart;
        cutEnd = newEnd;
        c1Start.value = newStart;
        c1End.value = newEnd;
        document.getElementById('cutStartVal').textContent = `${newStart.toFixed(1)}s`;
        document.getElementById('cutEndVal').textContent = `${newEnd.toFixed(1)}s`;
      }
    } 
    else if (id === 'blockInsert') {
      if (activeDrag.action === 'left') {
        let val = vals.cutStart + deltaTime;
        if (val < trimStart) val = trimStart;
        if (val >= cutEnd) val = cutEnd - 0.1;
        cutStart = val;
        c1Start.value = val;
        document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
      } else if (activeDrag.action === 'right') {
        let val = vals.clip2Duration + deltaTime;
        if (val < 1) val = 1;
        if (val > 15) val = 15;
        clip2.duration = val;
        c2Duration.value = val;
        document.getElementById('c2DurVal').textContent = `${val.toFixed(1)}s`;
      } else {
        const cutLen = vals.cutEnd - vals.cutStart;
        let newStart = vals.cutStart + deltaTime;
        let newEnd = newStart + cutLen;
        
        if (newStart < trimStart) {
          newStart = trimStart;
          newEnd = newStart + cutLen;
        }
        if (newEnd > trimEnd) {
          newEnd = trimEnd;
          newStart = newEnd - cutLen;
        }

        cutStart = newStart;
        cutEnd = newEnd;
        c1Start.value = newStart;
        c1End.value = newEnd;
        document.getElementById('cutStartVal').textContent = `${newStart.toFixed(1)}s`;
        document.getElementById('cutEndVal').textContent = `${newEnd.toFixed(1)}s`;
      }
    } 
    else if (id === 'blockText') {
      if (editorMode === 'simple') {
        const startShow = simpleCaption.showAt;
        const startHide = simpleCaption.hideAt;
        const capDuration = startHide - startShow;

        if (activeDrag.action === 'left') {
          let val = startShow + deltaTime;
          if (val < 0) val = 0;
          if (val >= startHide) val = startHide - 0.1;
          simpleCaption.showAt = val;
          simpleTxtStart.value = val;
          document.getElementById('simpleTxtStartVal').textContent = `${val.toFixed(1)}s`;
        } else if (activeDrag.action === 'right') {
          let val = startHide + deltaTime;
          if (val <= startShow) val = startShow + 0.1;
          if (val > totalDuration) val = totalDuration;
          simpleCaption.hideAt = val;
          simpleTxtEnd.value = val;
          document.getElementById('simpleTxtEndVal').textContent = `${val.toFixed(1)}s`;
        } else {
          let newShow = startShow + deltaTime;
          let newHide = newShow + capDuration;
          if (newShow < 0) {
            newShow = 0;
            newHide = capDuration;
          }
          if (newHide > totalDuration) {
            newHide = totalDuration;
            newShow = newHide - capDuration;
          }
          simpleCaption.showAt = newShow;
          simpleCaption.hideAt = newHide;
          simpleTxtStart.value = newShow;
          simpleTxtEnd.value = newHide;
          document.getElementById('simpleTxtStartVal').textContent = `${newShow.toFixed(1)}s`;
          document.getElementById('simpleTxtEndVal').textContent = `${newHide.toFixed(1)}s`;
        }
      } else {
        const activeCap = captions.find(x => x.id === activeCaptionId);
        if (activeCap) {
          const startShow = activeCap.showAt;
          const startHide = activeCap.hideAt;
          const capDuration = startHide - startShow;

          if (activeDrag.action === 'left') {
            let val = startShow + deltaTime;
            if (val < 0) val = 0;
            if (val >= startHide) val = startHide - 0.1;
            activeCap.showAt = val;
          } else if (activeDrag.action === 'right') {
            let val = startHide + deltaTime;
            if (val <= startShow) val = startShow + 0.1;
            if (val > totalDuration) val = totalDuration;
            activeCap.hideAt = val;
          } else {
            let newShow = startShow + deltaTime;
            let newHide = newShow + capDuration;
            if (newShow < 0) {
              newShow = 0;
              newHide = capDuration;
            }
            if (newHide > totalDuration) {
              newHide = totalDuration;
              newShow = newHide - capDuration;
            }
            activeCap.showAt = newShow;
            activeCap.hideAt = newHide;
          }
          selectCaption(activeCap.id);
        }
      }
    }

    recalculateTimeline();
    renderCanvas(isMuted);
  };

  const endHandler = () => {
    if (!activeDrag) return;
    activeDrag.element.style.cursor = 'grab';
    document.body.style.cursor = 'default';
    activeDrag = null;
    logToEditorConsole("Timeline boundaries updated via drag.");
  };

  window.addEventListener('mousemove', moveHandler);
  window.addEventListener('touchmove', moveHandler, { passive: false });
  window.addEventListener('mouseup', endHandler);
  window.addEventListener('touchend', endHandler);
}

// 🚀 EXPORT COMPILATION ENGINE (Simple & Advanced Audio pipelines)
btnExport.addEventListener('click', async () => {
  if (isExporting) return;
  
  if (!clip1.element) {
    alert("Please upload the Main Video (Step 1) before exporting.");
    return;
  }

  isExporting = true;
  isPlaying = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  btnPlayPause.textContent = '▶ Play';

  const overlay = document.getElementById('exportOverlay');
  const progText = document.getElementById('exportProgressText');
  const progBar = document.getElementById('exportProgressBar');
  overlay.style.display = 'flex';
  progText.textContent = "Initializing render...";
  progBar.style.width = '0%';

  logToEditorConsole("--- INITIALIZING COMPILATION EXPORT ---", "alert");

  // Capture canvas video tracks
  const canvasStream = canvas.captureStream(30);
  let mixedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

  // Initialize temporary AudioContext ONLY during export to prevent startup audio-blocks
  let exportAudioCtx = null;
  let exportAudioDest = null;
  let exportSource1 = null;
  let exportSource2 = null;
  let exportSourceBgm = null;
  
  if (editorMode === 'advanced' && (clip1.element || bgMusic.element)) {
    try {
      exportAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      exportAudioDest = exportAudioCtx.createMediaStreamDestination();
      
      const isMainSoloActive = mainAudioSolo;
      const isBgmSoloActive = bgMusic.isSolo;
      const anySoloActive = isMainSoloActive || isBgmSoloActive;

      const mainMixVol = (mainAudioMuted || (anySoloActive && !isMainSoloActive)) ? 0 : mainAudioVolume;
      const bgmMixVol = (bgMusic.isMuted || (anySoloActive && !isBgmSoloActive)) ? 0 : bgMusic.volume;

      if (clip1.element) {
        exportSource1 = exportAudioCtx.createMediaElementSource(clip1.element);
        const gainNode = exportAudioCtx.createGain();
        gainNode.gain.value = mainMixVol;
        exportSource1.connect(gainNode);
        gainNode.connect(exportAudioCtx.destination);
        gainNode.connect(exportAudioDest);
      }

      if (bgMusic.element) {
        exportSourceBgm = exportAudioCtx.createMediaElementSource(bgMusic.element);
        const gainNode = exportAudioCtx.createGain();
        gainNode.gain.value = bgmMixVol;
        exportSourceBgm.connect(gainNode);
        gainNode.connect(exportAudioCtx.destination);
        gainNode.connect(exportAudioDest);
      }

      exportAudioDest.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
    } catch (e) {
      console.warn("Export Web Audio pipeline failed:", e);
    }
  }

  let options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm' };
  }

  const recordedChunks = [];
  const recorder = new MediaRecorder(mixedStream, options);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  recorder.onstop = () => {
    progText.textContent = "Compiling file stream...";
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbr_reels_composed_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close export AudioContext safely
    if (exportAudioCtx) {
      exportAudioCtx.close();
    }

    overlay.style.display = 'none';
    isExporting = false;
    currentTime = 0;
    renderCanvas(isMuted);
    logToEditorConsole("Video exported and downloaded successfully!", "success");
  };

  if (editorMode === 'advanced' && bgMusic.element) {
    bgMusic.element.currentTime = 0;
    try { bgMusic.element.play(); } catch(e) {}
  }

  currentTime = 0;
  recorder.start();

  const fps = 30;
  const interval = 1000 / fps;
  
  if (clip1.element) clip1.element.currentTime = trimStart;
  if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;
  additionalCuts.forEach(c => {
    if (c.clip.element && c.clip.type === 'video') c.clip.element.currentTime = 0;
  });

  await new Promise(r => setTimeout(r, 800));

  const renderTimer = setInterval(() => {
    if (currentTime >= totalDuration) {
      clearInterval(renderTimer);
      recorder.stop();
      if (bgMusic.element) bgMusic.element.pause();
      return;
    }

    currentTime += 1 / fps;
    
    // Render frame
    const result = getSegmentAtTime(currentTime);
    if (result && result.segment) {
      const { segment, offset } = result;
      let activeSource = null;
      let activeType = 'video';
      let seekTime = 0;

      if (segment.type === 'main') {
        activeSource = clip1.element;
        seekTime = segment.start + offset;
      } else {
        activeSource = segment.clip.element;
        activeType = segment.clip.type;
        seekTime = offset;
      }

      if (activeSource) {
        if (activeType === 'video') {
          if (Math.abs(activeSource.currentTime - seekTime) > 0.2) {
            activeSource.currentTime = seekTime;
          }
          activeSource.muted = true; // Mute active playing element speaker output during export
          if (activeSource.paused) {
            try { activeSource.play(); } catch(e) {}
          }
        }
        drawFrame(activeSource, activeType);
      }
    }
    
    drawCaptions();

    const progress = (currentTime / totalDuration) * 100;
    progText.textContent = `Compiling frames: ${progress.toFixed(0)}%`;
    progBar.style.width = `${progress}%`;
  }, interval);
});

// Initial boot configurations
window.addEventListener('DOMContentLoaded', () => {
  ctx.fillStyle = '#0f0c0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8e8e93';
  ctx.font = '22px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('Composer Screen (9:16)', canvas.width / 2, canvas.height / 2);
  
  // Set default mode on start
  setEditorMode('simple');
  
  setupTimelineDragging();
  setupCanvasDragging();
});
