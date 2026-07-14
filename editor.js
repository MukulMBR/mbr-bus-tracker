// MBR Reels Video Composer - From Scratch Clean Build

// 1. State Variables
let clip1 = { file: null, element: null, duration: 0, videoWidth: 0, videoHeight: 0 };
let clip2 = { file: null, element: null, type: 'video', duration: 4.0 };
let bgMusic = { file: null, element: null, duration: 0, volume: 0.5, isMuted: false, isSolo: false };

// Trimming & Cutting bounds
let trimStart = 0;
let trimEnd = 15;
let cutStart = 2;
let cutEnd = 6;

// Audio mixing
let mainAudioVolume = 1.0;
let mainAudioMuted = false;
let mainAudioSolo = false;

// Captions Layers list
let captions = [];
let activeCaptionId = null;

// Filters
let filterBrightness = 100;
let filterContrast = 100;
let filterSaturation = 100;

// Aspect Ratio and Crop/Pan offsets
let aspectRatio = '9:16';
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanMouseX = 0;
let startPanMouseY = 0;
let startPanOffsetX = 0;
let startPanOffsetY = 0;

// Playback and Render states
let isPlaying = false;
let currentTime = 0;
let totalDuration = 10;
let animationFrameId = null;
let isExporting = false;
let cancelExportFlag = false;
let timelineSegments = [];
let isMuted = false;

// DOM Elements
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnMute = document.getElementById('btnMute');
const btnExport = document.getElementById('btnExport');
const btnCancelExport = document.getElementById('btnCancelExport');
const timeCurrent = document.getElementById('currentTime');
const timeTotal = document.getElementById('totalDuration');
const playhead = document.getElementById('playhead');

// Step Sliders
const mainTrimStart = document.getElementById('mainTrimStart');
const mainTrimEnd = document.getElementById('mainTrimEnd');
const c1Start = document.getElementById('c1Start');
const c1End = document.getElementById('c1End');
const c2Duration = document.getElementById('c2Duration');

// Filter Sliders
const sliderBrightness = document.getElementById('sliderBrightness');
const sliderContrast = document.getElementById('sliderContrast');
const sliderSaturation = document.getElementById('sliderSaturation');

// Audio Controls
const mainVolume = document.getElementById('mainVolume');
const btnMuteMain = document.getElementById('btnMuteMain');
const btnSoloMain = document.getElementById('btnSoloMain');
const bgmFile = document.getElementById('bgmFile');
const bgmVolume = document.getElementById('bgmVolume');
const btnMuteBgm = document.getElementById('btnMuteBgm');
const btnSoloBgm = document.getElementById('btnSoloBgm');

// Captions Controls
const btnAddCaption = document.getElementById('btnAddCaption');
const captionsList = document.getElementById('captionsList');
const captionEditorPanel = document.getElementById('captionEditorPanel');
const captionText = document.getElementById('captionText');
const captionColor = document.getElementById('captionColor');
const captionSize = document.getElementById('captionSize');
const captionPosition = document.getElementById('captionPosition');
const captionStart = document.getElementById('captionStart');
const captionEnd = document.getElementById('captionEnd');

// Logging
function logToEditorConsole(message, type = "info") {
  const box = document.getElementById('editorConsole');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Format seconds to MM:SS
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// 2. Aspect Ratio Settings
function setAspectRatio(ratio) {
  aspectRatio = ratio;
  const wrapper = document.getElementById('previewAspectWrapper');
  
  document.getElementById('btnRatioVertical').classList.remove('active');
  document.getElementById('btnRatioSquare').classList.remove('active');
  document.getElementById('btnRatioHorizontal').classList.remove('active');
  
  if (ratio === '9:16') {
    document.getElementById('btnRatioVertical').classList.add('active');
    wrapper.style.width = '270px';
    wrapper.style.height = '480px';
    canvas.width = 720;
    canvas.height = 1280;
  } else if (ratio === '1:1') {
    document.getElementById('btnRatioSquare').classList.add('active');
    wrapper.style.width = '360px';
    wrapper.style.height = '360px';
    canvas.width = 720;
    canvas.height = 720;
  } else if (ratio === '16:9') {
    document.getElementById('btnRatioHorizontal').classList.add('active');
    wrapper.style.width = '480px';
    wrapper.style.height = '270px';
    canvas.width = 1280;
    canvas.height = 720;
  }
  
  // Reset pan offsets
  panX = 0;
  panY = 0;
  
  logToEditorConsole(`Aspect ratio changed to ${ratio}.`);
  recalculateTimeline();
  renderCanvas();
}

// 3. Build Timeline segments list
function buildTimelineSegments() {
  timelineSegments = [];
  if (!clip1.element) return;

  // Segment A: trimStart -> cutStart
  const segADur = cutStart - trimStart;
  if (segADur > 0.05) {
    timelineSegments.push({
      type: 'main',
      start: trimStart,
      end: cutStart,
      duration: segADur
    });
  }

  // Segment B: Insertion replacement clip
  if (clip2.element) {
    timelineSegments.push({
      type: 'insert',
      duration: clip2.duration
    });
  } else {
    // Gap placeholder representing removed segment
    const cutDur = cutEnd - cutStart;
    if (cutDur > 0.05) {
      timelineSegments.push({
        type: 'gap',
        duration: cutDur
      });
    }
  }

  // Segment C: cutEnd -> trimEnd
  const segCDur = trimEnd - cutEnd;
  if (segCDur > 0.05) {
    timelineSegments.push({
      type: 'main',
      start: cutEnd,
      end: trimEnd,
      duration: segCDur
    });
  }

  totalDuration = timelineSegments.reduce((sum, s) => sum + s.duration, 0);
  if (totalDuration < 0.1) totalDuration = 0.1;
}

// Find segment at composed time index
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

// Recalculate metrics, bounds, and layout block positions
function recalculateTimeline() {
  buildTimelineSegments();

  if (!clip1.element) {
    totalDuration = 0;
    timeTotal.textContent = "00:00";
    return;
  }

  timeTotal.textContent = formatTime(totalDuration);

  // Update tracks timeline blocks
  const blockA = document.getElementById('blockMainPart1');
  const blockCut = document.getElementById('blockCutZone');
  const blockC = document.getElementById('blockMainPart2');
  const blockInsert = document.getElementById('blockInsert');
  const blockText = document.getElementById('blockText');

  let accumTime = 0;
  if (blockA) blockA.style.display = 'none';
  if (blockCut) blockCut.style.display = 'none';
  if (blockC) blockC.style.display = 'none';
  if (blockInsert) blockInsert.style.display = 'none';

  timelineSegments.forEach(s => {
    const blockWidth = `${(s.duration / totalDuration) * 100}%`;
    const blockLeft = `${(accumTime / totalDuration) * 100}%`;

    if (s.type === 'main') {
      if (accumTime === 0 && blockA) {
        blockA.style.width = blockWidth;
        blockA.style.left = blockLeft;
        blockA.style.display = 'flex';
        blockA.textContent = `Main Part A (${s.duration.toFixed(1)}s)`;
      } else if (blockC) {
        blockC.style.width = blockWidth;
        blockC.style.left = blockLeft;
        blockC.style.display = 'flex';
        blockC.textContent = `Main Part C (${s.duration.toFixed(1)}s)`;
      }
    } else if (s.type === 'insert') {
      if (blockInsert) {
        blockInsert.style.width = blockWidth;
        blockInsert.style.left = blockLeft;
        blockInsert.style.display = 'flex';
        blockInsert.textContent = `Replacement (${s.duration.toFixed(1)}s)`;
      }
      if (blockCut) {
        blockCut.style.width = blockWidth;
        blockCut.style.left = blockLeft;
        blockCut.style.display = 'flex';
      }
    } else if (s.type === 'gap') {
      if (blockCut) {
        blockCut.style.width = blockWidth;
        blockCut.style.left = blockLeft;
        blockCut.style.display = 'flex';
      }
    }
    accumTime += s.duration;
  });

  // Track Caption layer visualization
  if (blockText) {
    const activeCap = captions.find(c => c.id === activeCaptionId);
    if (activeCap) {
      const textLen = Math.max(0, activeCap.hideAt - activeCap.showAt);
      blockText.style.width = `${(textLen / totalDuration) * 100}%`;
      blockText.style.left = `${(activeCap.showAt / totalDuration) * 100}%`;
      blockText.textContent = `Text: "${activeCap.text}"`;
      blockText.style.display = 'block';
    } else {
      blockText.style.display = 'none';
    }
  }

  // Update dynamic rulers ticks
  const rulerGrid = document.querySelector('.ruler-grid');
  if (rulerGrid) {
    rulerGrid.innerHTML = '';
    const ticksCount = 5;
    for (let i = 0; i <= ticksCount; i++) {
      const tickSecVal = (i / ticksCount) * totalDuration;
      const tick = document.createElement('span');
      tick.className = 'ruler-tick';
      tick.textContent = `${tickSecVal.toFixed(1)}s`;
      rulerGrid.appendChild(tick);
    }
  }

  // Set sliders range max bounds
  mainTrimStart.max = clip1.duration;
  mainTrimEnd.max = clip1.duration;
  c1Start.max = clip1.duration;
  c1End.max = clip1.duration;
  
  captionStart.max = totalDuration;
  captionEnd.max = totalDuration;
}

// 4. Center Crop/Pan Frame drawing calculations
function drawFrame(mediaElement, type = 'video') {
  ctx.save();
  
  // Clean canvas first
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let sourceWidth = 0;
  let sourceHeight = 0;

  if (type === 'video') {
    sourceWidth = mediaElement.videoWidth;
    sourceHeight = mediaElement.videoHeight;
  } else {
    sourceWidth = mediaElement.width;
    sourceHeight = mediaElement.height;
  }

  if (!sourceWidth || !sourceHeight) {
    ctx.restore();
    return;
  }

  // Cover calculation
  const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;

  // Clamp panX and panY based on scale dimensions to avoid black margins
  const minPanX = canvas.width - scaledWidth;
  const minPanY = canvas.height - scaledHeight;

  if (panX > 0) panX = 0;
  if (panX < minPanX) panX = minPanX;
  if (panY > 0) panY = 0;
  if (panY < minPanY) panY = minPanY;

  // Apply basic filters to canvas context
  ctx.filter = `brightness(${filterBrightness}%) contrast(${filterContrast}%) saturate(${filterSaturation}%)`;

  ctx.drawImage(
    mediaElement, 
    0, 0, sourceWidth, sourceHeight,
    panX, panY, scaledWidth, scaledHeight
  );

  ctx.restore();
}

// 5. Volume Mixing preview control levels
function syncAudioMixer(activeEl) {
  if (!isPlaying || isExporting) return;

  const isMainSolo = mainAudioSolo;
  const isBgmSolo = bgMusic.isSolo;
  const anySoloActive = isMainSolo || isBgmSolo;

  let finalMainVol = mainAudioVolume;
  let finalBgmVol = bgMusic.volume;

  if (mainAudioMuted || (anySoloActive && !isMainSolo)) finalMainVol = 0;
  if (bgMusic.isMuted || (anySoloActive && !isBgmSolo)) finalBgmVol = 0;

  if (clip1.element) {
    clip1.element.volume = isMuted ? 0 : finalMainVol;
    clip1.element.muted = (activeEl !== clip1.element || isMuted || finalMainVol === 0);
  }

  if (clip2.element && clip2.type === 'video') {
    clip2.element.volume = isMuted ? 0 : finalMainVol;
    clip2.element.muted = (activeEl !== clip2.element || isMuted || finalMainVol === 0);
  }

  if (bgMusic.element) {
    bgMusic.element.volume = isMuted ? 0 : finalBgmVol;
    bgMusic.element.muted = (isMuted || finalBgmVol === 0);
  }
}

// 6. Canvas Text drawing
function drawCaptions() {
  captions.forEach(c => {
    if (currentTime >= c.showAt && currentTime <= c.hideAt && c.text) {
      ctx.save();
      ctx.fillStyle = c.color;
      ctx.font = `bold ${c.size}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let x = canvas.width / 2;
      let y = canvas.height * 0.82;
      
      if (c.position === 'top') {
        y = canvas.height * 0.15;
      } else if (c.position === 'center') {
        y = canvas.height * 0.5;
      }
      
      // Outline stroke shadow for contrast
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(c.text, x, y);
      ctx.fillText(c.text, x, y);
      
      // Box frame indicator around active selected caption
      if (c.id === activeCaptionId && !isExporting) {
        ctx.strokeStyle = '#3797f0';
        ctx.lineWidth = 2;
        const widthText = ctx.measureText(c.text).width;
        ctx.strokeRect(x - widthText / 2 - 10, y - c.size / 2 - 6, widthText + 20, c.size + 12);
      }

      ctx.restore();
    }
  });
}

// 7. Preview Render frame
function renderCanvas() {
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
  } else if (segment.type === 'insert') {
    activeSource = clip2.element;
    activeType = clip2.type;
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
  } else {
    // Gap placeholder: draw black screen
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (isPlaying && !isExporting) {
    // Pause other inactive elements
    if (activeSource !== clip1.element && clip1.element) clip1.element.pause();
    if (activeSource !== clip2.element && clip2.element && clip2.type === 'video') clip2.element.pause();
    syncAudioMixer(activeSource);
  }

  drawCaptions();
}

// 8. Playback Frame Loop
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
  }

  // Playback BGM track sync
  if (bgMusic.element) {
    if (bgMusic.element.paused) {
      try { bgMusic.element.play(); } catch(e) {}
    }
    if (Math.abs(bgMusic.element.currentTime - currentTime) > 0.3) {
      bgMusic.element.currentTime = currentTime;
    }
  }

  timeCurrent.textContent = formatTime(currentTime);
  playhead.style.left = `${(currentTime / totalDuration) * 100}%`;

  renderCanvas();
  animationFrameId = requestAnimationFrame(playbackLoop);
}

// Play/Pause Action
function togglePlayPause() {
  if (!clip1.element) return;

  if (isPlaying) {
    isPlaying = false;
    btnPlayPause.textContent = '▶ Play';
    if (clip1.element) clip1.element.pause();
    if (clip2.element && clip2.type === 'video') clip2.element.pause();
    if (bgMusic.element) bgMusic.element.pause();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    logToEditorConsole("Playback paused.");
  } else {
    isPlaying = true;
    btnPlayPause.textContent = '⏸ Pause';
    lastTime = 0;

    // Direct user-gesture playback initiation to bypass browser autoplay blocks
    const result = getSegmentAtTime(currentTime);
    if (result && result.segment) {
      const { segment, offset } = result;
      if (segment.type === 'main' && clip1.element) {
        clip1.element.play().catch(e => console.log("Play clip1 error:", e));
      } else if (segment.type === 'insert' && clip2.element && clip2.type === 'video') {
        clip2.element.play().catch(e => console.log("Play clip2 error:", e));
      }
    }
    if (bgMusic.element) {
      bgMusic.element.play().catch(e => console.log("Play BGM error:", e));
    }

    animationFrameId = requestAnimationFrame(playbackLoop);
    logToEditorConsole("Playback started.");
  }
}

// 9. Input & Control Event bindings

// Main Video Selection
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
    clip1.videoWidth = video.videoWidth;
    clip1.videoHeight = video.videoHeight;

    trimStart = 0;
    trimEnd = video.duration;
    cutStart = Math.min(2, video.duration);
    cutEnd = Math.min(6, video.duration);

    mainTrimStart.max = video.duration;
    mainTrimEnd.max = video.duration;
    mainTrimStart.value = 0;
    mainTrimEnd.value = video.duration;

    c1Start.disabled = false;
    c1End.disabled = false;
    c1Start.max = video.duration;
    c1End.max = video.duration;
    c1Start.value = cutStart;
    c1End.value = cutEnd;

    document.getElementById('clip1DurationText').textContent = `${video.duration.toFixed(1)}s`;
    document.getElementById('mainTrimStartVal').textContent = '0.0s';
    document.getElementById('mainTrimEndVal').textContent = `${video.duration.toFixed(1)}s`;
    document.getElementById('cutStartVal').textContent = `${cutStart.toFixed(1)}s`;
    document.getElementById('cutEndVal').textContent = `${cutEnd.toFixed(1)}s`;

    // Enable subsequent stages inputs
    document.getElementById('clip2File').disabled = false;
    document.getElementById('clip2FileLabel').classList.remove('disabled');
    btnAddCaption.disabled = false;
    btnPlayPause.disabled = false;
    btnExport.disabled = false;

    logToEditorConsole("Main video loaded successfully.", "success");
    recalculateTimeline();
    renderCanvas();
  });
});

// Replacement Clip/Photo selection
document.getElementById('clip2File').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading Replacement File: ${file.name}...`);
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
      clip2.duration = 4.0;
      c2Duration.value = 4.0;
      document.getElementById('c2DurVal').textContent = '4.0s';
      logToEditorConsole("Replacement photo loaded.", "success");
      recalculateTimeline();
      renderCanvas();
    };
  } else {
    clip2.type = 'video';
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.addEventListener('loadedmetadata', () => {
      clip2.element = video;
      clip2.duration = video.duration;
      c2Duration.value = video.duration;
      document.getElementById('c2DurVal').textContent = `${video.duration.toFixed(1)}s`;
      logToEditorConsole("Replacement video loaded.", "success");
      recalculateTimeline();
      renderCanvas();
    });
  }
});

// Trim and Cut Sliders listener events
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
  renderCanvas();
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
  renderCanvas();
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
  renderCanvas();
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
  renderCanvas();
});

c2Duration.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  clip2.duration = val;
  document.getElementById('c2DurVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas();
});

// Filters Sliders listener events
sliderBrightness.addEventListener('input', (e) => {
  filterBrightness = e.target.value;
  document.getElementById('valBrightness').textContent = `${filterBrightness}%`;
  renderCanvas();
});

sliderContrast.addEventListener('input', (e) => {
  filterContrast = e.target.value;
  document.getElementById('valContrast').textContent = `${filterContrast}%`;
  renderCanvas();
});

sliderSaturation.addEventListener('input', (e) => {
  filterSaturation = e.target.value;
  document.getElementById('valSaturation').textContent = `${filterSaturation}%`;
  renderCanvas();
});

// Audio controls
mainVolume.addEventListener('input', (e) => {
  mainAudioVolume = parseFloat(e.target.value);
  document.getElementById('valMainVolume').textContent = `${(mainAudioVolume * 100).toFixed(0)}%`;
});

btnMuteMain.addEventListener('click', () => {
  mainAudioMuted = !mainAudioMuted;
  btnMuteMain.classList.toggle('active-mute', mainAudioMuted);
  logToEditorConsole(`Main track muted: ${mainAudioMuted}`);
});

btnSoloMain.addEventListener('click', () => {
  mainAudioSolo = !mainAudioSolo;
  btnSoloMain.classList.toggle('active-solo', mainAudioSolo);
  if (mainAudioSolo && bgMusic.isSolo) {
    bgMusic.isSolo = false;
    btnSoloBgm.classList.remove('active-solo');
  }
});

// BGM Music Selector
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
    logToEditorConsole("BGM loaded successfully.", "success");
  });
});

bgmVolume.addEventListener('input', (e) => {
  bgMusic.volume = parseFloat(e.target.value);
  document.getElementById('valBgmVolume').textContent = `${(bgMusic.volume * 100).toFixed(0)}%`;
});

btnMuteBgm.addEventListener('click', () => {
  bgMusic.isMuted = !bgMusic.isMuted;
  btnMuteBgm.classList.toggle('active-mute', bgMusic.isMuted);
  logToEditorConsole(`BGM track muted: ${bgMusic.isMuted}`);
});

btnSoloBgm.addEventListener('click', () => {
  bgMusic.isSolo = !bgMusic.isSolo;
  btnSoloBgm.classList.toggle('active-solo', bgMusic.isSolo);
  if (bgMusic.isSolo && mainAudioSolo) {
    mainAudioSolo = false;
    btnSoloMain.classList.remove('active-solo');
  }
});

// 10. Captions layers manager
btnAddCaption.addEventListener('click', () => {
  const id = Date.now();
  const newCap = {
    id,
    text: 'Reels Text',
    color: '#ffffff',
    size: 28,
    position: 'bottom',
    showAt: Math.max(0, currentTime),
    hideAt: Math.min(totalDuration, currentTime + 4)
  };

  captions.push(newCap);
  logToEditorConsole("Caption layer added.");
  selectCaption(id);
});

function renderCaptionsList() {
  captionsList.innerHTML = '';
  captions.forEach(c => {
    const row = document.createElement('div');
    row.className = `caption-item-row ${c.id === activeCaptionId ? 'active' : ''}`;
    row.innerHTML = `
      <span>🔤 ${c.text || '(Empty text)'}</span>
      <span class="time-tag">${c.showAt.toFixed(1)}s - ${c.hideAt.toFixed(1)}s</span>
    `;
    row.addEventListener('click', () => selectCaption(c.id));
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
  captionPosition.value = c.position;
  
  captionStart.max = totalDuration;
  captionEnd.max = totalDuration;
  captionStart.value = c.showAt;
  captionEnd.value = c.hideAt;

  document.getElementById('captionStartVal').textContent = `${c.showAt.toFixed(1)}s`;
  document.getElementById('captionEndVal').textContent = `${c.hideAt.toFixed(1)}s`;

  recalculateTimeline();
  renderCanvas();
}

captionText.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.text = e.target.value;
    renderCaptionsList();
    renderCanvas();
  }
});

captionColor.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.color = e.target.value;
    renderCanvas();
  }
});

captionSize.addEventListener('input', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.size = parseInt(e.target.value);
    renderCanvas();
  }
});

captionPosition.addEventListener('change', (e) => {
  const active = captions.find(x => x.id === activeCaptionId);
  if (active) {
    active.position = e.target.value;
    renderCanvas();
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
    renderCanvas();
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
    renderCanvas();
  }
});

document.getElementById('btnDeleteCaption').addEventListener('click', () => {
  if (activeCaptionId) {
    captions = captions.filter(x => x.id !== activeCaptionId);
    logToEditorConsole("Caption layer removed.");
    activeCaptionId = null;
    selectCaption(null);
  }
});

// Playhead Scrubbing click
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
    renderCanvas();
  }
});

// Speaker mute
btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  btnMute.textContent = isMuted ? '🔇' : '🔊';
  if (clip1.element) clip1.element.muted = isMuted;
  if (clip2.element && clip2.type === 'video') clip2.element.muted = isMuted;
  if (bgMusic.element) bgMusic.element.muted = isMuted;
});

// 11. Canvas Drag-to-Pan (Crop Frame) coordinates
const wrapper = document.getElementById('previewAspectWrapper');

wrapper.addEventListener('mousedown', (e) => {
  if (!clip1.element) return;
  isPanning = true;
  startPanMouseX = e.clientX;
  startPanMouseY = e.clientY;
  startPanOffsetX = panX;
  startPanOffsetY = panY;
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  const dx = e.clientX - startPanMouseX;
  const dy = e.clientY - startPanMouseY;
  panX = startPanOffsetX + dx;
  panY = startPanOffsetY + dy;
  renderCanvas();
});

window.addEventListener('mouseup', () => {
  if (isPanning) {
    isPanning = false;
    logToEditorConsole(`Panning adjusted: offset X: ${panX.toFixed(0)}, Y: ${panY.toFixed(0)}`);
  }
});

// Touch support for crop panning
wrapper.addEventListener('touchstart', (e) => {
  if (!clip1.element) return;
  isPanning = true;
  startPanMouseX = e.touches[0].clientX;
  startPanMouseY = e.touches[0].clientY;
  startPanOffsetX = panX;
  startPanOffsetY = panY;
});

window.addEventListener('touchmove', (e) => {
  if (!isPanning) return;
  const dx = e.touches[0].clientX - startPanMouseX;
  const dy = e.touches[0].clientY - startPanMouseY;
  panX = startPanOffsetX + dx;
  panY = startPanOffsetY + dy;
  renderCanvas();
});

window.addEventListener('touchend', () => {
  isPanning = false;
});

// 12. 🚀 EXPORT RENDER COMPILATION WITH AUDIO MIXING & CANCEL
btnExport.addEventListener('click', async () => {
  if (isExporting || !clip1.element) return;

  isExporting = true;
  cancelExportFlag = false;
  isPlaying = false;
  btnPlayPause.textContent = '▶ Play';
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  const overlay = document.getElementById('exportOverlay');
  const progText = document.getElementById('exportProgressText');
  const progBar = document.getElementById('exportProgressBar');
  overlay.style.display = 'flex';
  progText.textContent = "Initializing render track mixer...";
  progBar.style.width = '0%';

  logToEditorConsole("--- EXPORT COMPILATION STARTED ---", "alert");

  // Capture canvas video tracks
  const canvasStream = canvas.captureStream(30);
  let mixedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

  // Initialize Temporary AudioContext ONLY for export mixing to prevent cold-starts issues
  let exportAudioCtx = null;
  let exportAudioDest = null;
  let exportSource1 = null;
  let exportSourceBgm = null;

  try {
    exportAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    exportAudioDest = exportAudioCtx.createMediaStreamDestination();

    const isMainSolo = mainAudioSolo;
    const isBgmSolo = bgMusic.isSolo;
    const anySoloActive = isMainSolo || isBgmSolo;

    const mainMixVol = (mainAudioMuted || (anySoloActive && !isMainSolo)) ? 0 : mainAudioVolume;
    const bgmMixVol = (bgMusic.isMuted || (anySoloActive && !isBgmSolo)) ? 0 : bgMusic.volume;

    if (clip1.element) {
      exportSource1 = exportAudioCtx.createMediaElementSource(clip1.element);
      const gainMain = exportAudioCtx.createGain();
      gainMain.gain.setValueAtTime(mainMixVol, exportAudioCtx.currentTime);
      exportSource1.connect(gainMain);
      gainMain.connect(exportAudioCtx.destination);
      gainMain.connect(exportAudioDest);
    }

    if (bgMusic.element) {
      exportSourceBgm = exportAudioCtx.createMediaElementSource(bgMusic.element);
      const gainBgm = exportAudioCtx.createGain();
      gainBgm.gain.setValueAtTime(bgmMixVol, exportAudioCtx.currentTime);
      exportSourceBgm.connect(gainBgm);
      gainBgm.connect(exportAudioCtx.destination);
      gainBgm.connect(exportAudioDest);
    }

    exportAudioDest.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
  } catch (e) {
    console.warn("Export AudioContext build failed:", e);
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
    // If canceled mid-process, discard blobs and return
    if (cancelExportFlag) {
      logToEditorConsole("Export cancelled by user.", "error");
      if (exportAudioCtx) exportAudioCtx.close();
      overlay.style.display = 'none';
      isExporting = false;
      currentTime = 0;
      renderCanvas();
      return;
    }

    progText.textContent = "Packing WebM stream...";
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mbr_reels_render_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (exportAudioCtx) exportAudioCtx.close();
    overlay.style.display = 'none';
    isExporting = false;
    currentTime = 0;
    renderCanvas();
    logToEditorConsole("Video exported successfully!", "success");
  };

  if (bgMusic.element) {
    bgMusic.element.currentTime = 0;
    try { bgMusic.element.play(); } catch(e) {}
  }

  currentTime = 0;
  recorder.start();

  const fps = 30;
  const interval = 1000 / fps;
  if (clip1.element) clip1.element.currentTime = trimStart;
  if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;

  // Let buffers initialize briefly
  await new Promise(r => setTimeout(r, 800));

  const exportTimer = setInterval(() => {
    if (cancelExportFlag) {
      clearInterval(exportTimer);
      recorder.stop();
      if (bgMusic.element) bgMusic.element.pause();
      return;
    }

    if (currentTime >= totalDuration) {
      clearInterval(exportTimer);
      recorder.stop();
      if (bgMusic.element) bgMusic.element.pause();
      return;
    }

    currentTime += 1 / fps;

    // Render export frame
    const result = getSegmentAtTime(currentTime);
    if (result) {
      const { segment, offset } = result;
      let activeSource = null;
      let activeType = 'video';
      let seekTime = 0;

      if (segment.type === 'main') {
        activeSource = clip1.element;
        seekTime = segment.start + offset;
      } else if (segment.type === 'insert') {
        activeSource = clip2.element;
        activeType = clip2.type;
        seekTime = offset;
      }

      if (activeSource) {
        if (activeType === 'video') {
          if (Math.abs(activeSource.currentTime - seekTime) > 0.25) {
            activeSource.currentTime = seekTime;
          }
          activeSource.muted = true; // Mute preview speaker during render
          if (activeSource.paused) {
            try { activeSource.play(); } catch(e) {}
          }
        }
        drawFrame(activeSource, activeType);
      }
    }

    drawCaptions();

    const pct = (currentTime / totalDuration) * 100;
    progText.textContent = `Compiling: ${pct.toFixed(0)}%`;
    progBar.style.width = `${pct}%`;
  }, interval);
});

// Cancel Export Event handler
btnCancelExport.addEventListener('click', () => {
  cancelExportFlag = true;
});

// Initial boot
window.addEventListener('DOMContentLoaded', () => {
  ctx.fillStyle = '#0f0c0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8e8e93';
  ctx.font = '20px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('Reels Composing Screen', canvas.width / 2, canvas.height / 2);
  
  setAspectRatio('9:16');
});
