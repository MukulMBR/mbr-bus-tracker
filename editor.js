// Reels Video Composer Engine

// State variables
let clip1 = { file: null, element: null, duration: 0, trimStart: 0, trimEnd: 5 };
let clip2 = { file: null, type: 'video', element: null, duration: 5 }; // default duration for images
let textOverlay = { value: '', color: '#ffffff', size: 28, showAt: 1, hideAt: 8 };

let isPlaying = false;
let currentTime = 0;
let totalDuration = 10;
let animationFrameId = null;
let isExporting = false;

// Audio Context variables
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

// Calculate total video duration and timeline blocks
function recalculateTimeline() {
  const clip1Len = clip1.trimEnd - clip1.trimStart;
  const clip2Len = clip2.duration;
  totalDuration = clip1Len + clip2Len;

  timeTotal.textContent = formatTime(totalDuration);
  document.getElementById('totalOutputLen').textContent = `${totalDuration.toFixed(1)}s`;

  // Update visual timeline block sizes
  const pct1 = (clip1Len / totalDuration) * 100;
  const pct2 = (clip2Len / totalDuration) * 100;

  const block1 = document.getElementById('blockClip1');
  const block2 = document.getElementById('blockClip2');
  const blockText = document.getElementById('blockText');

  if (block1) {
    block1.style.width = `${pct1}%`;
    block1.textContent = clip1.file ? `Clip 1 (${clip1Len.toFixed(1)}s)` : 'First Video Clip';
  }

  if (block2) {
    block2.style.width = `${pct2}%`;
    block2.style.marginLeft = `${pct1}%`;
    block2.textContent = clip2.file ? `Clip 2 (${clip2Len.toFixed(1)}s)` : 'Second Clip / Photo';
  }

  if (blockText) {
    const textStart = textOverlay.showAt;
    const textEnd = Math.min(textOverlay.hideAt, totalDuration);
    const textLen = Math.max(0, textEnd - textStart);
    
    blockText.style.width = `${(textLen / totalDuration) * 100}%`;
    blockText.style.marginLeft = `${(textStart / totalDuration) * 100}%`;
    blockText.textContent = textOverlay.value ? `Text: "${textOverlay.value}"` : 'Caption Text';
  }

  // Update slider bounds dynamically
  txtStart.max = totalDuration;
  txtEnd.max = totalDuration;
}

// Draw a centered video frame or image scaled to vertical 9:16 aspect ratio
function drawFrame(mediaElement, type = 'video') {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let mediaWidth = 0;
  let mediaHeight = 0;

  if (type === 'video') {
    mediaWidth = mediaElement.videoWidth;
    mediaHeight = mediaElement.videoHeight;
  } else {
    // Image uploader
    mediaWidth = mediaElement.width;
    mediaHeight = mediaElement.height;
  }

  if (!mediaWidth || !mediaHeight) return;

  // Center crop logic (9:16 target ratio)
  const targetRatio = 9 / 16;
  const mediaRatio = mediaWidth / mediaHeight;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = mediaWidth;
  let sourceHeight = mediaHeight;

  if (mediaRatio > targetRatio) {
    // Media is wider than 9:16 (landscape) -> Crop left & right edges
    sourceWidth = mediaHeight * targetRatio;
    sourceX = (mediaWidth - sourceWidth) / 2;
  } else {
    // Media is taller than 9:16 (portrait) -> Crop top & bottom edges
    sourceHeight = mediaWidth / targetRatio;
    sourceY = (mediaHeight - sourceHeight) / 2;
  }

  ctx.drawImage(mediaElement, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
}

// Render canvas preview frame
function renderCanvas() {
  const clip1Len = clip1.trimEnd - clip1.trimStart;

  if (currentTime < clip1Len) {
    // Render Clip 1
    if (clip1.element) {
      const seekTime = clip1.trimStart + currentTime;
      // Seek video to current timestamp safely
      if (Math.abs(clip1.element.currentTime - seekTime) > 0.15) {
        clip1.element.currentTime = seekTime;
      }
      drawFrame(clip1.element, 'video');
    } else {
      // Placeholder drawing
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '24px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('[First Clip Placeholder]', canvas.width / 2, canvas.height / 2);
    }
  } else {
    // Render Clip 2
    if (clip2.element) {
      if (clip2.type === 'video') {
        const seekTime = currentTime - clip1Len;
        if (Math.abs(clip2.element.currentTime - seekTime) > 0.15) {
          clip2.element.currentTime = seekTime;
        }
        drawFrame(clip2.element, 'video');
      } else {
        // Image
        drawFrame(clip2.element, 'image');
      }
    } else {
      // Placeholder drawing
      ctx.fillStyle = '#311042';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '24px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('[Second Clip Placeholder]', canvas.width / 2, canvas.height / 2);
    }
  }

  // Draw Caption Text Overlay
  if (currentTime >= textOverlay.showAt && currentTime <= textOverlay.hideAt && textOverlay.value) {
    ctx.fillStyle = textOverlay.color;
    ctx.font = `bold ${textOverlay.size}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add glowing stroke or shadow for outline legibility
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(textOverlay.value, canvas.width / 2, canvas.height * 0.82);
    ctx.fillText(textOverlay.value, canvas.width / 2, canvas.height * 0.82);
  }
}

// Playback frame loops
let lastTime = 0;
function playbackLoop(timestamp) {
  if (!isPlaying) return;
  if (!lastTime) lastTime = timestamp;

  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  currentTime += delta;

  if (currentTime >= totalDuration) {
    currentTime = 0;
    // Loop playback
    if (clip1.element) clip1.element.currentTime = clip1.trimStart;
    if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;
  }

  // Sync play states of underlying video tags to prevent audio desyncs
  const clip1Len = clip1.trimEnd - clip1.trimStart;
  if (currentTime < clip1Len) {
    if (clip1.element && clip1.element.paused) {
      try { clip1.element.play(); } catch(e) {}
    }
    if (clip2.element && clip2.type === 'video' && !clip2.element.paused) {
      clip2.element.pause();
    }
  } else {
    if (clip1.element && !clip1.element.paused) {
      clip1.element.pause();
    }
    if (clip2.element && clip2.type === 'video' && clip2.element.paused) {
      try { clip2.element.play(); } catch(e) {}
    }
  }

  // Update time and timeline playhead
  timeCurrent.textContent = formatTime(currentTime);
  playhead.style.left = `${(currentTime / totalDuration) * 100}%`;

  renderCanvas();
  animationFrameId = requestAnimationFrame(playbackLoop);
}

// Toggle Play / Pause
function togglePlayPause() {
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
    
    // Unlock AudioContext if needed
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
}

// Initialize Web Audio nodes once media starts
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
    console.warn("AudioContext setup failed (CORS or gesture lock):", e);
  }
}

// Media Selection Handlers
document.getElementById('clip1File').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading Clip 1: ${file.name}...`);
  clip1.file = file;
  document.getElementById('clip1Name').textContent = file.name;
  document.getElementById('clip1Details').style.display = 'block';

  // Create memory video element
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = false;
  video.loop = false;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  video.addEventListener('loadedmetadata', () => {
    clip1.element = video;
    clip1.duration = video.duration;
    clip1.trimStart = 0;
    clip1.trimEnd = Math.min(5, video.duration);

    // Setup slider ranges
    c1Start.max = video.duration;
    c1End.max = video.duration;
    c1Start.value = 0;
    c1End.value = clip1.trimEnd;

    document.getElementById('c1StartVal').textContent = '0.0s';
    document.getElementById('c1EndVal').textContent = `${clip1.trimEnd.toFixed(1)}s`;

    logToEditorConsole(`Clip 1 loaded. Length: ${video.duration.toFixed(1)}s`, "success");
    recalculateTimeline();
    renderCanvas();
    initAudioPipeline();
  });
});

document.getElementById('clip2File').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  logToEditorConsole(`Loading Clip 2: ${file.name}...`);
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
      clip2.duration = 5.0; // default duration for photo display
      c2Duration.value = 5.0;
      document.getElementById('c2DurVal').textContent = '5.0s';
      
      logToEditorConsole("Clip 2 loaded as static image.", "success");
      recalculateTimeline();
      renderCanvas();
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

      logToEditorConsole(`Clip 2 loaded as video. Length: ${video.duration.toFixed(1)}s`, "success");
      recalculateTimeline();
      renderCanvas();
      initAudioPipeline();
    });
  }
});

// Slider Interactions
c1Start.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val >= clip1.trimEnd) {
    c1Start.value = clip1.trimEnd - 0.1;
    return;
  }
  clip1.trimStart = val;
  document.getElementById('c1StartVal').textContent = `${val.toFixed(1)}s`;
  recalculateTimeline();
  currentTime = 0;
  renderCanvas();
});

c1End.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val <= clip1.trimStart) {
    c1End.value = clip1.trimStart + 0.1;
    return;
  }
  clip1.trimEnd = val;
  document.getElementById('c1EndVal').textContent = `${val.toFixed(1)}s`;
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

// Text Overlay Configuration
overlayText.addEventListener('input', (e) => {
  textOverlay.value = e.target.value;
  recalculateTimeline();
  renderCanvas();
});

document.getElementById('textColor').addEventListener('input', (e) => {
  textOverlay.color = e.target.value;
  renderCanvas();
});

document.getElementById('textSize').addEventListener('input', (e) => {
  textOverlay.size = parseInt(e.target.value);
  renderCanvas();
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
  renderCanvas();
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
  renderCanvas();
});

// Playhead Scrubbing inside Timeline Ruler
document.querySelector('.timeline-tracks').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left - 80; // offset track label width
  const width = rect.width - 80;
  
  if (clickX >= 0 && clickX <= width) {
    const pct = clickX / width;
    currentTime = pct * totalDuration;
    timeCurrent.textContent = formatTime(currentTime);
    playhead.style.left = `${pct * 100}%`;
    
    // Seek active video frames in background
    const clip1Len = clip1.trimEnd - clip1.trimStart;
    if (currentTime < clip1Len) {
      if (clip1.element) clip1.element.currentTime = clip1.trimStart + currentTime;
    } else {
      if (clip2.element && clip2.type === 'video') {
        clip2.element.currentTime = currentTime - clip1Len;
      }
    }

    renderCanvas();
  }
});

btnPlayPause.addEventListener('click', togglePlayPause);

// Mute controls
let isMuted = false;
btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  if (clip1.element) clip1.element.muted = isMuted;
  if (clip2.element && clip2.type === 'video') clip2.element.muted = isMuted;
  btnMute.textContent = isMuted ? '🔇' : '🔊';
  logToEditorConsole(`Speaker Muted: ${isMuted}`);
});

// 🚀 EXPORT COMPILATION ENGINE
btnExport.addEventListener('click', async () => {
  if (isExporting) return;
  
  if (!clip1.file && !clip2.file) {
    alert("Please upload at least one video or photo asset before exporting.");
    return;
  }

  isExporting = true;
  isPlaying = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  btnPlayPause.textContent = '▶ Play';

  // Show compilation modal
  const overlay = document.getElementById('exportOverlay');
  const progText = document.getElementById('exportProgressText');
  const progBar = document.getElementById('exportProgressBar');
  overlay.style.display = 'flex';
  progText.textContent = "Initializing render...";
  progBar.style.width = '0%';

  logToEditorConsole("--- INITIALIZING COMPILATION EXPORT ---", "alert");

  // Capture canvas video tracks
  const canvasStream = canvas.captureStream(30); // 30 FPS
  
  // Connect Audio Context tracks if present
  let mixedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

  if (audioCtx && audioDest) {
    audioDest.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
  }

  // Choose MIME formats
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
    
    // Force browser down-stream
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
    renderCanvas();
    logToEditorConsole("Video exported and downloaded successfully!", "success");
  };

  // Start rendering sequence step-by-step
  currentTime = 0;
  recorder.start();

  const fps = 30;
  const interval = 1000 / fps;
  
  // Seek first clips to correct start positions
  if (clip1.element) clip1.element.currentTime = clip1.trimStart;
  if (clip2.element && clip2.type === 'video') clip2.element.currentTime = 0;

  // Let video buffers seek
  await new Promise(r => setTimeout(r, 800));

  const renderTimer = setInterval(() => {
    if (currentTime >= totalDuration) {
      clearInterval(renderTimer);
      recorder.stop();
      return;
    }

    // Advance frame time
    currentTime += 1 / fps;
    renderCanvas();

    // Update loader metrics
    const progress = (currentTime / totalDuration) * 100;
    progText.textContent = `Compiling frames: ${progress.toFixed(0)}%`;
    progBar.style.width = `${progress}%`;
  }, interval);
});

// Draw canvas skeleton on initial boot
window.addEventListener('DOMContentLoaded', () => {
  ctx.fillStyle = '#0f0c0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8e8e93';
  ctx.font = '22px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('Composer Screen (9:16)', canvas.width / 2, canvas.height / 2);
  recalculateTimeline();
});
