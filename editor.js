// Reels Video Composer Engine - Cut & Insert Workflow

// State variables
let clip1 = { file: null, element: null, duration: 0 }; // Main Video
let cutStart = 0;
let cutEnd = 5;
let clip2 = { file: null, type: 'video', element: null, duration: 5 }; // Insertion Clip
let textOverlay = { value: '', color: '#ffffff', size: 28, showAt: 1, hideAt: 8 };

let isPlaying = false;
let currentTime = 0;
let totalDuration = 10;
let animationFrameId = null;
let isExporting = false;

// Audio Context variables for mixing during export
let audioCtx = null;
let audioDest = null;
let audioSource1 = null;
let audioSource2 = null;

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
const txtStart = document.getElementById('txtStart');
const txtEnd = document.getElementById('txtEnd');
const overlayText = document.getElementById('overlayText');

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

// Calculate composed timeline duration and update block percentages
function recalculateTimeline() {
  if (!clip1.element) {
    totalDuration = 0;
    timeTotal.textContent = "00:00";
    document.getElementById('totalOutputLen').textContent = "0.0s";
    return;
  }

  const clip1Len = clip1.duration;
  const clip2Len = clip2.duration;
  const cutLen = cutEnd - cutStart;

  // Composed Video Duration = Segment A + Segment B (Insert) + Segment C (Remaining)
  totalDuration = cutStart + clip2Len + (clip1Len - cutEnd);
  if (totalDuration < 0.1) totalDuration = 0.1;

  timeTotal.textContent = formatTime(totalDuration);
  document.getElementById('totalOutputLen').textContent = `${totalDuration.toFixed(1)}s`;
  document.getElementById('totalCutVal').textContent = `${cutLen.toFixed(1)}s`;

  // Timeline track block calculations
  const blockA = document.getElementById('blockMainPart1');
  const blockCut = document.getElementById('blockCutZone');
  const blockC = document.getElementById('blockMainPart2');
  const blockInsert = document.getElementById('blockInsert');
  const blockText = document.getElementById('blockText');

  // Segment A (Main Video before Cut)
  const pctA = (cutStart / totalDuration) * 100;
  if (blockA) {
    blockA.style.width = `${pctA}%`;
    blockA.style.left = '0%';
    blockA.textContent = `Main Part A (${cutStart.toFixed(1)}s)`;
  }

  // Segment B (Insertion Block) & Visual Cut Zone Gap
  const pctInsert = (clip2Len / totalDuration) * 100;
  if (blockInsert) {
    blockInsert.style.width = `${pctInsert}%`;
    blockInsert.style.left = `${pctA}%`;
    blockInsert.textContent = clip2.file ? `Insert (${clip2Len.toFixed(1)}s)` : 'Insertion Clip';
  }

  if (blockCut) {
    blockCut.style.width = `${pctInsert}%`;
    blockCut.style.left = `${pctA}%`;
  }

  // Segment C (Main Video after Cut)
  const pctC = ((clip1Len - cutEnd) / totalDuration) * 100;
  const pctC_Start = ((cutStart + clip2Len) / totalDuration) * 100;
  if (blockC) {
    blockC.style.width = `${pctC}%`;
    blockC.style.left = `${pctC_Start}%`;
    blockC.textContent = `Main Part C (${(clip1Len - cutEnd).toFixed(1)}s)`;
  }

  // Caption Overlay block
  if (blockText) {
    const textStart = textOverlay.showAt;
    const textEnd = Math.min(textOverlay.hideAt, totalDuration);
    const textLen = Math.max(0, textEnd - textStart);
    
    blockText.style.width = `${(textLen / totalDuration) * 100}%`;
    blockText.style.left = `${(textStart / totalDuration) * 100}%`;
    blockText.textContent = textOverlay.value ? `Caption: "${textOverlay.value}"` : 'Caption Text';
  }

  // Update text slider bounds
  txtStart.max = totalDuration;
  txtEnd.max = totalDuration;
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

// Render active preview frame depending on current time zone
let lastActiveSource = null;
function renderCanvas(isMuted = false) {
  if (!clip1.element) return;

  const clip2Len = clip2.duration;
  let activeSource = null;
  let activeType = 'video';
  let seekTime = 0;

  if (currentTime < cutStart) {
    // Segment A: Main Video (0 to cutStart)
    activeSource = clip1.element;
    seekTime = currentTime;
  } else if (currentTime < cutStart + clip2Len) {
    // Segment B: Insertion Clip (cutStart to cutStart + clip2Len)
    if (clip2.element) {
      activeSource = clip2.element;
      activeType = clip2.type;
      seekTime = currentTime - cutStart;
    }
  } else {
    // Segment C: Main Video (cutStart + clip2Len onwards)
    activeSource = clip1.element;
    seekTime = cutEnd + (currentTime - cutStart - clip2Len);
  }

  // Manage playback seeking and muting
  if (activeSource) {
    if (activeType === 'video') {
      const tolerance = isPlaying ? 0.35 : 0.05; // Larger tolerance during playback prevents constant seeking stutters
      if (Math.abs(activeSource.currentTime - seekTime) > tolerance) {
        activeSource.currentTime = seekTime;
      }
      
      // Handle HTML5 element volume and mute states
      if (isPlaying && !isExporting) {
        activeSource.muted = isMuted;
        if (activeSource.paused) {
          try { activeSource.play(); } catch(e) {}
        }
      }
    }
    
    drawFrame(activeSource, activeType);
  }

  // Mute/Pause inactive video elements during playback to prevent double audio overlay
  if (isPlaying && !isExporting) {
    if (activeSource === clip1.element) {
      if (clip2.element && clip2.type === 'video') {
        clip2.element.muted = true;
        clip2.element.pause();
      }
    } else if (activeSource === clip2.element) {
      if (clip1.element) {
        clip1.element.muted = true;
        clip1.element.pause();
      }
    }
  }

  // Draw Captions Text overlay
  if (currentTime >= textOverlay.showAt && currentTime <= textOverlay.hideAt && textOverlay.value) {
    ctx.fillStyle = textOverlay.color;
    ctx.font = `bold ${textOverlay.size}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(textOverlay.value, canvas.width / 2, canvas.height * 0.82);
    ctx.fillText(textOverlay.value, canvas.width / 2, canvas.height * 0.82);
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
    // Loop
    if (clip1.element) clip1.element.currentTime = 0;
    if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;
  }

  // Update time display and playhead position
  timeCurrent.textContent = formatTime(currentTime);
  playhead.style.left = `${(currentTime / totalDuration) * 100}%`;

  // Pre-seek / Warm up inactive video decoders 1.2 seconds before transition boundary to eliminate lag
  const clip2Len = clip2.duration;
  if (isPlaying && !isExporting) {
    if (currentTime < cutStart) {
      if (cutStart - currentTime < 1.2 && clip2.element && clip2.type === 'video') {
        if (Math.abs(clip2.element.currentTime - 0) > 0.1) {
          clip2.element.currentTime = 0;
        }
      }
    } else if (currentTime < cutStart + clip2Len) {
      if ((cutStart + clip2Len) - currentTime < 1.2 && clip1.element) {
        if (Math.abs(clip1.element.currentTime - cutEnd) > 0.2) {
          clip1.element.currentTime = cutEnd;
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
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    logToEditorConsole("Playback paused.");
  } else {
    isPlaying = true;
    btnPlayPause.textContent = '⏸ Pause';
    lastTime = 0;
    animationFrameId = requestAnimationFrame(playbackLoop);
    logToEditorConsole("Playback started.");
    
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
}

// Initialize Web Audio routes for final export
function initAudioPipeline() {
  if (audioCtx) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioDest = audioCtx.createMediaStreamDestination();

    if (clip1.element) {
      audioSource1 = audioCtx.createMediaElementSource(clip1.element);
      audioSource1.connect(audioCtx.destination);
      audioSource1.connect(audioDest);
    }

    if (clip2.element && clip2.type === 'video') {
      audioSource2 = audioCtx.createMediaElementSource(clip2.element);
      audioSource2.connect(audioCtx.destination);
      audioSource2.connect(audioDest);
    }
    
    logToEditorConsole("Web Audio routing pipeline initialized.", "success");
  } catch (e) {
    console.warn("AudioContext setup failed:", e);
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
    
    // Set default cut zone (first 5 seconds or less)
    cutStart = 0;
    cutEnd = Math.min(5, video.duration);

    // Enable sliders and set limits
    c1Start.disabled = false;
    c1End.disabled = false;
    c1Start.max = video.duration;
    c1End.max = video.duration;
    c1Start.value = 0;
    c1End.value = cutEnd;

    document.getElementById('clip1DurationText').textContent = `${video.duration.toFixed(1)}s`;
    document.getElementById('cutStartVal').textContent = '0.0s';
    document.getElementById('cutEndVal').textContent = `${cutEnd.toFixed(1)}s`;

    btnPlayPause.disabled = false;

    logToEditorConsole(`Main video loaded successfully. Length: ${video.duration.toFixed(1)}s`, "success");
    recalculateTimeline();
    renderCanvas(isMuted);
    initAudioPipeline();
  });
});

// Insertion Clip File selection handler
document.getElementById('clip2File').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading Insertion Clip: ${file.name}...`);
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
      clip2.duration = 5.0; // default duration
      c2Duration.value = 5.0;
      document.getElementById('c2DurVal').textContent = '5.0s';
      
      logToEditorConsole("Insertion clip loaded as static photo.", "success");
      recalculateTimeline();
      renderCanvas(isMuted);
    };
  } else {
    // Video
    clip2.type = 'video';
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = false;
    video.loop = false;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.addEventListener('loadedmetadata', () => {
      clip2.element = video;
      clip2.duration = video.duration;
      c2Duration.value = video.duration;
      document.getElementById('c2DurVal').textContent = `${video.duration.toFixed(1)}s`;

      logToEditorConsole(`Insertion clip loaded as video. Length: ${video.duration.toFixed(1)}s`, "success");
      recalculateTimeline();
      renderCanvas(isMuted);
      initAudioPipeline();
    });
  }
});

// Slider Input Listeners
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

// Text Overlay Configuration
overlayText.addEventListener('input', (e) => {
  textOverlay.value = e.target.value;
  recalculateTimeline();
  renderCanvas(isMuted);
});

document.getElementById('textColor').addEventListener('input', (e) => {
  textOverlay.color = e.target.value;
  renderCanvas(isMuted);
});

document.getElementById('textSize').addEventListener('input', (e) => {
  textOverlay.size = parseInt(e.target.value);
  renderCanvas(isMuted);
});

txtStart.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val >= textOverlay.hideAt) {
    txtStart.value = textOverlay.hideAt - 0.1;
    return;
  }
  textOverlay.showAt = val;
  document.getElementById('txtStartVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  renderCanvas(isMuted);
});

txtEnd.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val <= textOverlay.showAt) {
    txtEnd.value = textOverlay.showAt + 0.1;
    return;
  }
  textOverlay.hideAt = val;
  document.getElementById('txtEndVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  renderCanvas(isMuted);
});

// Playhead scrubbing handler
document.querySelector('.timeline-tracks').addEventListener('click', (e) => {
  if (!clip1.element) return;
  if (e.target.closest('.track-label')) return;
  
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left - 80; // offset track label
  const width = rect.width - 80;
  
  if (clickX >= 0 && clickX <= width) {
    const pct = clickX / width;
    currentTime = pct * totalDuration;
    timeCurrent.textContent = formatTime(currentTime);
    playhead.style.left = `${pct * 100}%`;

    renderCanvas(isMuted);
  }
});

btnPlayPause.addEventListener('click', togglePlayPause);

// Mute controls
let isMuted = false;
btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  btnMute.textContent = isMuted ? '🔇' : '🔊';
  logToEditorConsole(`Mute state toggled: ${isMuted}`);
});

// 🚀 EXPORT COMPILATION ENGINE
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

  // Show progress modal
  const overlay = document.getElementById('exportOverlay');
  const progText = document.getElementById('exportProgressText');
  const progBar = document.getElementById('exportProgressBar');
  overlay.style.display = 'flex';
  progText.textContent = "Initializing render...";
  progBar.style.width = '0%';

  logToEditorConsole("--- INITIALIZING COMPILATION EXPORT ---", "alert");

  // Capture canvas video tracks
  const canvasStream = canvas.captureStream(30); // 30 FPS
  
  // Combine audio track if initialized
  let mixedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

  if (audioCtx && audioDest) {
    audioDest.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
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

    overlay.style.display = 'none';
    isExporting = false;
    currentTime = 0;
    renderCanvas(isMuted);
    logToEditorConsole("Video exported and downloaded successfully!", "success");
  };

  currentTime = 0;
  recorder.start();

  const fps = 30;
  const interval = 1000 / fps;
  
  if (clip1.element) clip1.element.currentTime = 0;
  if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;

  // Let video buffers seek
  await new Promise(r => setTimeout(r, 800));

  const renderTimer = setInterval(() => {
    if (currentTime >= totalDuration) {
      clearInterval(renderTimer);
      recorder.stop();
      return;
    }

    currentTime += 1 / fps;
    renderCanvas(true); // Export with muted canvas elements to prevent duplicate echo

    // Update progress bars
    const progress = (currentTime / totalDuration) * 100;
    progText.textContent = `Compiling frames: ${progress.toFixed(0)}%`;
    progBar.style.width = `${progress}%`;
  }, interval);
});

// Initial boot
window.addEventListener('DOMContentLoaded', () => {
  ctx.fillStyle = '#0f0c0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8e8e93';
  ctx.font = '22px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('Composer Screen (9:16)', canvas.width / 2, canvas.height / 2);
  recalculateTimeline();
  setupTimelineDragging();
});

// Interactive Timeline Drag and Adjust Engine
function setupTimelineDragging() {
  const tracks = document.querySelector('.timeline-tracks');
  if (!tracks) return;

  let activeDrag = null; // { element: HTMLElement, action: 'left'|'right'|'move', startX: number, startVals: {} }

  function handleStart(e, element, actionType) {
    if (!clip1.element) return; // Main video must be loaded
    e.preventDefault();
    e.stopPropagation();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    
    // Store starting values
    const startVals = {
      cutStart,
      cutEnd,
      clip2Duration: clip2.duration,
      showAt: textOverlay.showAt,
      hideAt: textOverlay.hideAt
    };

    activeDrag = {
      element,
      action: actionType,
      startX: clientX,
      startVals
    };

    element.style.cursor = 'grabbing';
    document.body.style.cursor = 'col-resize';
  }

  // Bind mouse and touch starts
  const bindBlockDrag = (element, id) => {
    if (!element) return;

    const startHandler = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const rect = element.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const pct = clickX / rect.width;

      let action = 'move';
      if (id === 'MainPart1') {
        action = 'right'; // Adjust cutStart
      } else if (id === 'MainPart2') {
        action = 'left'; // Adjust cutEnd
      } else {
        // Cut zone, Insert block, or Text block
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

  // Move listener
  const moveHandler = (e) => {
    if (!activeDrag) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const deltaX = clientX - activeDrag.startX;
    
    const trackWidth = tracks.getBoundingClientRect().width - 80; // exclude label offset
    if (trackWidth <= 0) return;

    const deltaTime = (deltaX / trackWidth) * totalDuration;
    const vals = activeDrag.startVals;
    const id = activeDrag.element.id;

    if (id === 'blockMainPart1') {
      // Adjust cutStart (Segment A end)
      let val = vals.cutStart + deltaTime;
      if (val < 0) val = 0;
      if (val >= cutEnd) val = cutEnd - 0.1;
      cutStart = val;
      c1Start.value = val;
      document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
    } 
    else if (id === 'blockMainPart2') {
      // Adjust cutEnd (Segment C start)
      let val = vals.cutEnd + deltaTime;
      if (val <= cutStart) val = cutStart + 0.1;
      if (val > clip1.duration) val = clip1.duration;
      cutEnd = val;
      c1End.value = val;
      document.getElementById('cutEndVal').textContent = `${val.toFixed(1)}s`;
    } 
    else if (id === 'blockCutZone') {
      if (activeDrag.action === 'left') {
        let val = vals.cutStart + deltaTime;
        if (val < 0) val = 0;
        if (val >= cutEnd) val = cutEnd - 0.1;
        cutStart = val;
        c1Start.value = val;
        document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
      } else if (activeDrag.action === 'right') {
        let val = vals.cutEnd + deltaTime;
        if (val <= cutStart) val = cutStart + 0.1;
        if (val > clip1.duration) val = clip1.duration;
        cutEnd = val;
        c1End.value = val;
        document.getElementById('cutEndVal').textContent = `${val.toFixed(1)}s`;
      } else {
        // Move entire cut zone
        const cutLen = vals.cutEnd - vals.cutStart;
        let newStart = vals.cutStart + deltaTime;
        let newEnd = newStart + cutLen;
        
        if (newStart < 0) {
          newStart = 0;
          newEnd = cutLen;
        }
        if (newEnd > clip1.duration) {
          newEnd = clip1.duration;
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
        // Adjust cutStart
        let val = vals.cutStart + deltaTime;
        if (val < 0) val = 0;
        if (val >= cutEnd) val = cutEnd - 0.1;
        cutStart = val;
        c1Start.value = val;
        document.getElementById('cutStartVal').textContent = `${val.toFixed(1)}s`;
      } else if (activeDrag.action === 'right') {
        // Adjust insert clip duration
        let val = vals.clip2Duration + deltaTime;
        if (val < 1) val = 1;
        if (val > 15) val = 15;
        clip2.duration = val;
        c2Duration.value = val;
        document.getElementById('c2DurVal').textContent = `${val.toFixed(1)}s`;
      } else {
        // Move entire insert segment (which shifts cutStart and cutEnd together)
        const cutLen = vals.cutEnd - vals.cutStart;
        let newStart = vals.cutStart + deltaTime;
        let newEnd = newStart + cutLen;
        
        if (newStart < 0) {
          newStart = 0;
          newEnd = cutLen;
        }
        if (newEnd > clip1.duration) {
          newEnd = clip1.duration;
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
      if (activeDrag.action === 'left') {
        let val = vals.showAt + deltaTime;
        if (val < 0) val = 0;
        if (val >= textOverlay.hideAt) val = textOverlay.hideAt - 0.1;
        textOverlay.showAt = val;
        txtStart.value = val;
        document.getElementById('txtStartVal').textContent = `${val.toFixed(1)}s`;
      } else if (activeDrag.action === 'right') {
        let val = vals.hideAt + deltaTime;
        if (val <= textOverlay.showAt) val = textOverlay.showAt + 0.1;
        if (val > totalDuration) val = totalDuration;
        textOverlay.hideAt = val;
        txtEnd.value = val;
        document.getElementById('txtEndVal').textContent = `${val.toFixed(1)}s`;
      } else {
        // Move entire text span
        const textLen = vals.hideAt - vals.showAt;
        let newStart = vals.showAt + deltaTime;
        let newEnd = newStart + textLen;

        if (newStart < 0) {
          newStart = 0;
          newEnd = textLen;
        }
        if (newEnd > totalDuration) {
          newEnd = totalDuration;
          newStart = newEnd - textLen;
        }

        textOverlay.showAt = newStart;
        textOverlay.hideAt = newEnd;
        txtStart.value = newStart;
        txtEnd.value = newEnd;
        document.getElementById('txtStartVal').textContent = `${newStart.toFixed(1)}s`;
        document.getElementById('txtEndVal').textContent = `${newEnd.toFixed(1)}s`;
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
    logToEditorConsole("Timeline elements updated via drag.");
  };

  window.addEventListener('mousemove', moveHandler);
  window.addEventListener('touchmove', moveHandler, { passive: false });
  window.addEventListener('mouseup', endHandler);
  window.addEventListener('touchend', endHandler);
}
