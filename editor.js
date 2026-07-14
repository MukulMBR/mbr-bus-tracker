// MBR Studio Editor - client-side video composer

const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('previewAspectWrapper');

const els = {
  btnPlayPause: document.getElementById('btnPlayPause'),
  btnMute: document.getElementById('btnMute'),
  btnExport: document.getElementById('btnExport'),
  btnCancelExport: document.getElementById('btnCancelExport'),
  btnRemoveClip2: document.getElementById('btnRemoveClip2'),
  btnResetPan: document.getElementById('btnResetPan'),
  btnResetFilters: document.getElementById('btnResetFilters'),
  btnRangeIntro: document.getElementById('btnRangeIntro'),
  btnRangeAtPlayhead: document.getElementById('btnRangeAtPlayhead'),
  btnRangeTail: document.getElementById('btnRangeTail'),
  timeCurrent: document.getElementById('currentTime'),
  timeTotal: document.getElementById('totalDuration'),
  playhead: document.getElementById('playhead'),
  mainTrimStart: document.getElementById('mainTrimStart'),
  mainTrimEnd: document.getElementById('mainTrimEnd'),
  c1Start: document.getElementById('c1Start'),
  c1End: document.getElementById('c1End'),
  c2Duration: document.getElementById('c2Duration'),
  sliderBrightness: document.getElementById('sliderBrightness'),
  sliderContrast: document.getElementById('sliderContrast'),
  sliderSaturation: document.getElementById('sliderSaturation'),
  mainVolume: document.getElementById('mainVolume'),
  btnMuteMain: document.getElementById('btnMuteMain'),
  btnSoloMain: document.getElementById('btnSoloMain'),
  bgmFile: document.getElementById('bgmFile'),
  bgmVolume: document.getElementById('bgmVolume'),
  btnMuteBgm: document.getElementById('btnMuteBgm'),
  btnSoloBgm: document.getElementById('btnSoloBgm'),
  btnAddCaption: document.getElementById('btnAddCaption'),
  captionsList: document.getElementById('captionsList'),
  captionEditorPanel: document.getElementById('captionEditorPanel'),
  captionText: document.getElementById('captionText'),
  captionColor: document.getElementById('captionColor'),
  captionSize: document.getElementById('captionSize'),
  captionPosition: document.getElementById('captionPosition'),
  captionStart: document.getElementById('captionStart'),
  captionEnd: document.getElementById('captionEnd')
};

let clip1 = emptyClip();
let clip2 = { ...emptyClip(), type: 'video', duration: 4 };
let bgMusic = { file: null, element: null, url: null, duration: 0, volume: 0.5, isMuted: false, isSolo: false };
let captions = [];
let activeCaptionId = null;
let trimStart = 0;
let trimEnd = 0;
let cutStart = 0;
let cutEnd = 0;
let filterBrightness = 100;
let filterContrast = 100;
let filterSaturation = 100;
let mainAudioVolume = 1;
let mainAudioMuted = false;
let mainAudioSolo = false;
let aspectRatio = '9:16';
let panX = 0;
let panY = 0;
let isPanning = false;
let isResizingCaption = false;
let startResizeSize = 32;
let startDistance = 100;
let startPanMouseX = 0;
let startPanMouseY = 0;
let startPanOffsetX = 0;
let startPanOffsetY = 0;
let isPlaying = false;
let currentTime = 0;
let totalDuration = 0;
let animationFrameId = null;
let lastTime = 0;
let isExporting = false;
let cancelExportFlag = false;
let timelineSegments = [];
let isMuted = false;

function emptyClip() {
  return { file: null, element: null, url: null, type: 'video', duration: 0, videoWidth: 0, videoHeight: 0 };
}

function byId(id) {
  return document.getElementById(id);
}

function logToEditorConsole(message, type = 'info') {
  const box = byId('editorConsole');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(secs) {
  if (!Number.isFinite(secs) || secs <= 0) return '00:00';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

function stopPlayback() {
  isPlaying = false;
  lastTime = 0;
  els.btnPlayPause.textContent = 'Play';
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (clip1.element) clip1.element.pause();
  if (clip2.element && clip2.type === 'video') clip2.element.pause();
  if (bgMusic.element) bgMusic.element.pause();
}

function revokeClip(clip) {
  if (clip.element && clip.element.pause) clip.element.pause();
  if (clip.url) URL.revokeObjectURL(clip.url);
}

function setAspectRatio(ratio) {
  aspectRatio = ratio;
  const sizes = {
    '9:16': { cssW: 270, cssH: 480, w: 720, h: 1280 },
    '1:1': { cssW: 360, cssH: 360, w: 900, h: 900 },
    '16:9': { cssW: 520, cssH: 293, w: 1280, h: 720 }
  };
  const size = sizes[ratio] || sizes['9:16'];

  document.querySelectorAll('.aspect-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ratio === ratio);
  });

  wrapper.style.width = `${size.cssW}px`;
  wrapper.style.height = `${size.cssH}px`;
  canvas.width = size.w;
  canvas.height = size.h;
  resetPan(false);
  logToEditorConsole(`Aspect ratio changed to ${aspectRatio}.`);
  renderCanvas();
}

window.setAspectRatio = setAspectRatio;

function resetPan(shouldRender = true) {
  panX = 0;
  panY = 0;
  if (shouldRender) {
    renderCanvas();
    logToEditorConsole('Crop centered.');
  }
}

function sanitizeTimelineBounds() {
  if (!clip1.element) return;
  trimStart = clamp(trimStart, 0, Math.max(0, clip1.duration - 0.1));
  trimEnd = clamp(trimEnd, trimStart + 0.1, clip1.duration);
  cutStart = clamp(cutStart, trimStart, Math.max(trimStart, trimEnd - 0.1));
  cutEnd = clamp(cutEnd, cutStart + 0.1, trimEnd);
}

function buildTimelineSegments() {
  timelineSegments = [];
  if (!clip1.element) {
    totalDuration = 0;
    return;
  }

  sanitizeTimelineBounds();
  const beforeDuration = cutStart - trimStart;
  if (beforeDuration > 0.03) {
    timelineSegments.push({ type: 'main', start: trimStart, end: cutStart, duration: beforeDuration });
  }

  if (clip2.element) {
    timelineSegments.push({ type: 'insert', start: 0, end: clip2.duration, duration: clip2.duration });
  } else {
    const removedDuration = cutEnd - cutStart;
    if (removedDuration > 0.03) {
      timelineSegments.push({ type: 'gap', start: cutStart, end: cutEnd, duration: removedDuration });
    }
  }

  const afterDuration = trimEnd - cutEnd;
  if (afterDuration > 0.03) {
    timelineSegments.push({ type: 'main', start: cutEnd, end: trimEnd, duration: afterDuration });
  }

  totalDuration = Math.max(0.1, timelineSegments.reduce((sum, segment) => sum + segment.duration, 0));
}

function getSegmentAtTime(time) {
  let accumulated = 0;
  for (const segment of timelineSegments) {
    if (time <= accumulated + segment.duration) {
      return { segment, offset: clamp(time - accumulated, 0, segment.duration) };
    }
    accumulated += segment.duration;
  }
  const last = timelineSegments[timelineSegments.length - 1];
  return last ? { segment: last, offset: last.duration } : null;
}

function syncSliderBounds() {
  if (!clip1.element) return;
  els.mainTrimStart.max = clip1.duration;
  els.mainTrimEnd.max = clip1.duration;
  els.c1Start.min = trimStart;
  els.c1Start.max = trimEnd;
  els.c1End.min = trimStart;
  els.c1End.max = trimEnd;
  els.c1Start.value = cutStart;
  els.c1End.value = cutEnd;
  els.mainTrimStart.value = trimStart;
  els.mainTrimEnd.value = trimEnd;
  els.captionStart.max = totalDuration;
  els.captionEnd.max = totalDuration;
}

function updateTimeLabels() {
  setText('mainTrimStartVal', `${trimStart.toFixed(1)}s`);
  setText('mainTrimEndVal', `${trimEnd.toFixed(1)}s`);
  setText('cutStartVal', `${cutStart.toFixed(1)}s`);
  setText('cutEndVal', `${cutEnd.toFixed(1)}s`);
  els.timeCurrent.textContent = formatTime(currentTime);
  els.timeTotal.textContent = formatTime(totalDuration);
}

function updatePlayhead() {
  const pct = totalDuration ? clamp(currentTime / totalDuration, 0, 1) : 0;
  const tracks = document.querySelector('.timeline-tracks');
  const trackBar = document.querySelector('.timeline-track .track-bar');
  if (!tracks || !trackBar) return;
  const tracksRect = tracks.getBoundingClientRect();
  const barRect = trackBar.getBoundingClientRect();
  els.playhead.style.left = `${barRect.left - tracksRect.left + (barRect.width * pct)}px`;
}

function placeBlock(block, leftSec, duration, label, display = 'flex') {
  if (!block || !totalDuration) return;
  block.style.left = `${(leftSec / totalDuration) * 100}%`;
  block.style.width = `${(duration / totalDuration) * 100}%`;
  block.style.display = display;
  block.textContent = label;
}

function recalculateTimeline() {
  buildTimelineSegments();
  currentTime = clamp(currentTime, 0, totalDuration);
  syncSliderBounds();
  updateTimeLabels();

  const blockA = byId('blockMainPart1');
  const blockCut = byId('blockCutZone');
  const blockC = byId('blockMainPart2');
  const blockInsert = byId('blockInsert');
  const blockText = byId('blockText');
  [blockA, blockCut, blockC, blockInsert].forEach(block => {
    if (block) block.style.display = 'none';
  });

  let accumulated = 0;
  let mainCount = 0;
  timelineSegments.forEach(segment => {
    if (segment.type === 'main') {
      mainCount += 1;
      placeBlock(mainCount === 1 ? blockA : blockC, accumulated, segment.duration, `Keep ${mainCount} (${segment.duration.toFixed(1)}s)`);
    } else if (segment.type === 'insert') {
      placeBlock(blockInsert, accumulated, segment.duration, `Replacement (${segment.duration.toFixed(1)}s)`);
      placeBlock(blockCut, accumulated, segment.duration, 'Replace Range');
    } else if (segment.type === 'gap') {
      placeBlock(blockCut, accumulated, segment.duration, 'Removed');
    }
    accumulated += segment.duration;
  });

  if (blockText) {
    const activeCap = captions.find(c => c.id === activeCaptionId);
    if (activeCap && totalDuration) {
      const start = clamp(activeCap.showAt, 0, totalDuration);
      const end = clamp(activeCap.hideAt, start + 0.1, totalDuration);
      placeBlock(blockText, start, end - start, activeCap.text || 'Caption', 'block');
    } else {
      blockText.style.display = 'none';
    }
  }

  const rulerGrid = document.querySelector('.ruler-grid');
  if (rulerGrid && totalDuration > 0) {
    rulerGrid.innerHTML = '';
    
    // Select subdivisions based on total duration length
    let majorStep = 1;
    let minorStep = 0.5;
    if (totalDuration > 15) { majorStep = 5; minorStep = 1; }
    if (totalDuration > 60) { majorStep = 10; minorStep = 5; }

    for (let t = 0; t <= totalDuration; t += minorStep) {
      const isMajor = Math.abs(t % majorStep) < 0.01;
      const tick = document.createElement('div');
      tick.className = `ruler-tick-mark ${isMajor ? 'major' : 'minor'}`;
      tick.style.left = `${(t / totalDuration) * 100}%`;
      
      if (isMajor) {
        const label = document.createElement('span');
        label.className = 'tick-label-text';
        label.textContent = `${t.toFixed(0)}s`;
        tick.appendChild(label);
      }
      rulerGrid.appendChild(tick);
    }
  }
  updatePlayhead();
}

function getMediaSize(mediaElement, type) {
  if (type === 'image') return { width: mediaElement.naturalWidth || mediaElement.width, height: mediaElement.naturalHeight || mediaElement.height };
  return { width: mediaElement.videoWidth, height: mediaElement.videoHeight };
}

function drawFrame(mediaElement, type = 'video') {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { width: sourceWidth, height: sourceHeight } = getMediaSize(mediaElement, type);
  if (!sourceWidth || !sourceHeight) {
    ctx.restore();
    return;
  }

  const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  const centerX = (canvas.width - scaledWidth) / 2;
  const centerY = (canvas.height - scaledHeight) / 2;
  const minX = canvas.width - scaledWidth;
  const minY = canvas.height - scaledHeight;
  const drawX = clamp(centerX + panX, Math.min(0, minX), 0);
  const drawY = clamp(centerY + panY, Math.min(0, minY), 0);

  ctx.filter = `brightness(${filterBrightness}%) contrast(${filterContrast}%) saturate(${filterSaturation}%)`;
  ctx.drawImage(mediaElement, 0, 0, sourceWidth, sourceHeight, drawX, drawY, scaledWidth, scaledHeight);
  ctx.restore();
}

function getWrappedLines(text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawCaptions() {
  captions.forEach(caption => {
    if (currentTime < caption.showAt || currentTime > caption.hideAt || !caption.text) return;

    ctx.save();
    ctx.fillStyle = caption.color;
    ctx.font = `bold ${caption.size}px Outfit, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const lines = getWrappedLines(caption.text, canvas.width * 0.86);
    const lineHeight = caption.size * 1.18;
    let y = canvas.height * 0.82;
    if (caption.position === 'top') y = canvas.height * 0.16;
    if (caption.position === 'center') y = canvas.height * 0.5;
    y -= ((lines.length - 1) * lineHeight) / 2;

    // Elastic pop-in bounce animation (0.35s duration)
    const age = currentTime - caption.showAt;
    let scaleVal = 1;
    let opacity = 1;
    if (age < 0.35) {
      const p = age / 0.35;
      scaleVal = Math.sin(p * Math.PI * 0.65) * 1.15;
      opacity = p;
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = Math.max(4, caption.size * 0.14);
    
    lines.forEach((line, index) => {
      const lineY = y + index * lineHeight;
      ctx.save();
      ctx.translate(canvas.width / 2, lineY);
      ctx.scale(scaleVal, scaleVal);
      ctx.globalAlpha = opacity;
      ctx.strokeText(line, 0, 0);
      ctx.fillText(line, 0, 0);
      ctx.restore();
    });

    if (caption.id === activeCaptionId && !isExporting) {
      const width = Math.max(...lines.map(line => ctx.measureText(line).width));
      const height = lines.length * lineHeight;
      const rightX = canvas.width / 2 + width / 2 + 16;
      const bottomY = y + (lines.length - 1) * lineHeight + caption.size / 2 + 8;
      
      // Draw selected boundary border
      ctx.strokeStyle = '#3797f0';
      ctx.lineWidth = 3;
      ctx.strokeRect(canvas.width / 2 - width / 2 - 16, y - caption.size / 2 - 8, width + 32, height + 16);

      // Draw resizing target circle handle at the bottom-right corner
      ctx.fillStyle = '#3797f0';
      ctx.beginPath();
      ctx.arc(rightX, bottomY, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawEmptyScreen(message = 'Choose a main video') {
  ctx.save();
  ctx.fillStyle = '#0f0c0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8e8e93';
  ctx.font = '28px Outfit, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function getFrameStateAtTime(time) {
  let accumulated = 0;
  for (let i = 0; i < timelineSegments.length; i++) {
    const s = timelineSegments[i];
    const segStart = accumulated;
    const segEnd = accumulated + s.duration;
    accumulated += s.duration;

    // Check transition crossfade with next segment
    const nextSeg = timelineSegments[i + 1];
    if (nextSeg) {
      const transitionWindow = 0.4; // 0.4s crossfade transition duration
      const boundary = segEnd;
      if (time >= boundary - transitionWindow / 2 && time <= boundary + transitionWindow / 2) {
        const progress = (time - (boundary - transitionWindow / 2)) / transitionWindow;
        
        // Outgoing segment details
        let outSource = null, outType = 'video', outSeek = 0;
        if (s.type === 'main') {
          outSource = clip1.element;
          outSeek = s.start + (s.duration - (boundary - time));
        } else if (s.type === 'insert') {
          outSource = clip2.element;
          outType = clip2.type;
          outSeek = s.duration - (boundary - time);
        }

        // Incoming segment details
        let inSource = null, inType = 'video', inSeek = 0;
        if (nextSeg.type === 'main') {
          inSource = clip1.element;
          inSeek = nextSeg.start + (time - boundary);
        } else if (nextSeg.type === 'insert') {
          inSource = clip2.element;
          inType = clip2.type;
          inSeek = time - boundary;
        }

        return {
          isTransition: true,
          progress,
          outSource, outType, outSeek,
          inSource, inType, inSeek
        };
      }
    }

    if (time <= segEnd) {
      let activeSource = null;
      let activeType = 'video';
      let seekTime = 0;
      if (s.type === 'main') {
        activeSource = clip1.element;
        seekTime = s.start + (time - segStart);
      } else if (s.type === 'insert') {
        activeSource = clip2.element;
        activeType = clip2.type;
        seekTime = time - segStart;
      }
      return {
        isTransition: false,
        activeSource, activeType, seekTime
      };
    }
  }

  // Fallback to last segment frame
  const last = timelineSegments[timelineSegments.length - 1];
  if (last) {
    let activeSource = null;
    let activeType = 'video';
    let seekTime = 0;
    if (last.type === 'main') {
      activeSource = clip1.element;
      seekTime = last.end;
    } else if (last.type === 'insert') {
      activeSource = clip2.element;
      activeType = clip2.type;
      seekTime = last.duration;
    }
    return {
      isTransition: false,
      activeSource, activeType, seekTime
    };
  }

  return null;
}

function renderCanvas() {
  if (!clip1.element || !timelineSegments.length) {
    drawEmptyScreen();
    return;
  }

  const state = getFrameStateAtTime(currentTime);
  if (!state) return;

  if (state.isTransition) {
    // 1. Draw outgoing frame first
    if (state.outSource) {
      if (state.outType === 'video') {
        const tolerance = isPlaying ? 0.35 : 0.06;
        if (Math.abs(state.outSource.currentTime - state.outSeek) > tolerance) {
          state.outSource.currentTime = clamp(state.outSeek, 0, state.outSource.duration || state.outSeek);
        }
        if (isPlaying && !isExporting && state.outSource.paused) {
          state.outSource.play().catch(() => {});
        }
      }
      ctx.save();
      drawFrame(state.outSource, state.outType);
      ctx.restore();
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw incoming frame on top with globalAlpha = progress
    if (state.inSource) {
      if (state.inType === 'video') {
        const tolerance = isPlaying ? 0.35 : 0.06;
        if (Math.abs(state.inSource.currentTime - state.inSeek) > tolerance) {
          state.inSource.currentTime = clamp(state.inSeek, 0, state.inSource.duration || state.inSeek);
        }
        if (isPlaying && !isExporting && state.inSource.paused) {
          state.inSource.play().catch(() => {});
        }
      }
      ctx.save();
      ctx.globalAlpha = state.progress;
      drawFrame(state.inSource, state.inType);
      ctx.restore();
    }

    if (isPlaying && !isExporting) {
      syncAudioMixer(state.inSource || state.outSource);
    }
  } else {
    // Normal single-source rendering
    const { activeSource, activeType, seekTime } = state;
    if (activeSource) {
      if (activeType === 'video') {
        const tolerance = isPlaying ? 0.35 : 0.06;
        if (Math.abs(activeSource.currentTime - seekTime) > tolerance) {
          activeSource.currentTime = clamp(seekTime, 0, activeSource.duration || seekTime);
        }
        if (isPlaying && !isExporting && activeSource.paused) {
          activeSource.play().catch(() => {});
        }
      }
      drawFrame(activeSource, activeType);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (isPlaying && !isExporting) {
      if (activeSource !== clip1.element && clip1.element) clip1.element.pause();
      if (activeSource !== clip2.element && clip2.element && clip2.type === 'video') clip2.element.pause();
      syncAudioMixer(activeSource);
    }
  }

  drawCaptions();
  updateTimeLabels();
  updatePlayhead();
}

function getMainVolume() {
  const anySoloActive = mainAudioSolo || bgMusic.isSolo;
  if (isMuted || mainAudioMuted || (anySoloActive && !mainAudioSolo)) return 0;
  return mainAudioVolume;
}

function getBgmVolume() {
  const anySoloActive = mainAudioSolo || bgMusic.isSolo;
  if (isMuted || bgMusic.isMuted || (anySoloActive && !bgMusic.isSolo)) return 0;
  return bgMusic.volume;
}

function syncAudioMixer(activeEl) {
  if (!isPlaying || isExporting) return;
  const mainVol = getMainVolume();
  const bgmVol = getBgmVolume();

  [clip1, clip2].forEach(clip => {
    if (!clip.element || clip.type !== 'video') return;
    clip.element.volume = mainVol;
    clip.element.muted = activeEl !== clip.element || mainVol === 0;
  });

  if (bgMusic.element) {
    bgMusic.element.volume = bgmVol;
    bgMusic.element.muted = bgmVol === 0;
  }
}

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

  if (bgMusic.element) {
    if (Math.abs(bgMusic.element.currentTime - currentTime) > 0.35) bgMusic.element.currentTime = currentTime % (bgMusic.duration || totalDuration);
    if (bgMusic.element.paused) bgMusic.element.play().catch(() => {});
  }

  renderCanvas();
  animationFrameId = requestAnimationFrame(playbackLoop);
}

function togglePlayPause() {
  if (!clip1.element || isExporting) return;
  if (isPlaying) {
    stopPlayback();
    logToEditorConsole('Playback paused.');
    return;
  }

  isPlaying = true;
  els.btnPlayPause.textContent = 'Pause';
  lastTime = 0;
  const result = getSegmentAtTime(currentTime);
  if (result?.segment.type === 'main') clip1.element.play().catch(() => {});
  if (result?.segment.type === 'insert' && clip2.element && clip2.type === 'video') clip2.element.play().catch(() => {});
  if (bgMusic.element) bgMusic.element.play().catch(() => {});
  animationFrameId = requestAnimationFrame(playbackLoop);
  logToEditorConsole('Playback started.');
}

function setEditorReady() {
  byId('clip2File').disabled = false;
  byId('clip2FileLabel').classList.remove('disabled');
  els.btnAddCaption.disabled = false;
  els.btnPlayPause.disabled = false;
  els.btnExport.disabled = false;
  if (els.btnRangeIntro) els.btnRangeIntro.disabled = false;
  if (els.btnRangeAtPlayhead) els.btnRangeAtPlayhead.disabled = false;
  if (els.btnRangeTail) els.btnRangeTail.disabled = false;
}

function handleMainVideo(file) {
  stopPlayback();
  revokeClip(clip1);
  clip1 = emptyClip();
  clip1.file = file;
  clip1.url = URL.createObjectURL(file);
  setText('clip1Name', file.name);
  byId('clip1Details').style.display = 'block';
  logToEditorConsole(`Loading main video: ${file.name}...`);

  const video = document.createElement('video');
  video.src = clip1.url;
  video.preload = 'metadata';
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.addEventListener('loadedmetadata', () => {
    clip1.element = video;
    clip1.duration = video.duration || 0;
    clip1.videoWidth = video.videoWidth;
    clip1.videoHeight = video.videoHeight;
    trimStart = 0;
    trimEnd = clip1.duration;
    cutStart = 0;
    cutEnd = Math.min(2, clip1.duration);
    if (cutEnd <= cutStart) cutEnd = Math.min(clip1.duration, cutStart + 0.1);
    currentTime = 0;
    setText('clip1DurationText', `${clip1.duration.toFixed(1)}s`);
    setEditorReady();
    recalculateTimeline();
    renderCanvas();
    logToEditorConsole('Main video loaded.', 'success');
  });
  video.addEventListener('error', () => logToEditorConsole('Could not load the selected video.', 'error'));
}

function handleReplacement(file) {
  stopPlayback();
  revokeClip(clip2);
  clip2 = { ...emptyClip(), file, url: URL.createObjectURL(file), type: file.type.startsWith('image/') ? 'image' : 'video', duration: 4 };
  setText('clip2Name', file.name);
  byId('clip2Details').style.display = 'block';
  logToEditorConsole(`Loading replacement: ${file.name}...`);

  if (clip2.type === 'image') {
    const img = new Image();
    img.onload = () => {
      clip2.element = img;
      clip2.duration = parseFloat(els.c2Duration.value) || 4;
      setText('c2DurVal', `${clip2.duration.toFixed(1)}s`);
      recalculateTimeline();
      renderCanvas();
      logToEditorConsole('Replacement image loaded.', 'success');
    };
    img.onerror = () => logToEditorConsole('Could not load the selected image.', 'error');
    img.src = clip2.url;
    return;
  }

  const video = document.createElement('video');
  video.src = clip2.url;
  video.preload = 'metadata';
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.addEventListener('loadedmetadata', () => {
    clip2.element = video;
    clip2.duration = Math.min(video.duration || 4, 60);
    els.c2Duration.value = clip2.duration;
    setText('c2DurVal', `${clip2.duration.toFixed(1)}s`);
    recalculateTimeline();
    renderCanvas();
    logToEditorConsole('Replacement video loaded.', 'success');
  });
  video.addEventListener('error', () => logToEditorConsole('Could not load the selected replacement video.', 'error'));
}

function removeReplacement() {
  stopPlayback();
  revokeClip(clip2);
  clip2 = { ...emptyClip(), type: 'video', duration: 4 };
  byId('clip2File').value = '';
  byId('clip2Details').style.display = 'none';
  els.c2Duration.value = 4;
  setText('c2DurVal', '4.0s');
  recalculateTimeline();
  renderCanvas();
  logToEditorConsole('Replacement removed.');
}

function renderBgmWaveform(audioBuffer) {
  const canvasWave = document.getElementById('bgmWaveformCanvas');
  if (!canvasWave) return;
  
  const width = canvasWave.clientWidth || 600;
  const height = canvasWave.clientHeight || 40;
  canvasWave.width = width;
  canvasWave.height = height;
  
  const ctxWave = canvasWave.getContext('2d');
  ctxWave.clearRect(0, 0, width, height);
  
  const rawData = audioBuffer.getChannelData(0); // get first channel
  const samples = Math.floor(width / 3); // Draw bars with spaces
  const blockSize = Math.floor(rawData.length / samples);
  const filteredData = [];
  
  for (let i = 0; i < samples; i++) {
    let blockStart = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum = sum + Math.abs(rawData[blockStart + j]);
    }
    filteredData.push(sum / blockSize);
  }
  
  // Normalize peaks
  const max = Math.max(...filteredData) || 1;
  const normalizedData = filteredData.map(val => val / max);
  
  // Draw waveform
  ctxWave.fillStyle = 'rgba(52, 211, 153, 0.4)';
  const barWidth = 2;
  const gap = 1;
  
  for (let i = 0; i < samples; i++) {
    const val = normalizedData[i] || 0;
    const barHeight = val * (height * 0.7);
    const x = i * (barWidth + gap);
    const y = (height - barHeight) / 2;
    ctxWave.fillRect(x, y, barWidth, barHeight);
  }
}

function handleBgm(file) {
  if (bgMusic.element) bgMusic.element.pause();
  if (bgMusic.url) URL.revokeObjectURL(bgMusic.url);
  bgMusic.file = file;
  bgMusic.url = URL.createObjectURL(file);
  setText('bgmName', file.name);
  byId('bgmDetails').style.display = 'block';
  
  const bgmTrackRow = byId('bgmTrackRow');
  if (bgmTrackRow) bgmTrackRow.style.display = 'flex';

  logToEditorConsole(`Loading BGM: ${file.name}...`);

  // Decode audio data for visual waveform
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    const offlineCtx = new (window.AudioContext || window.webkitAudioContext)();
    offlineCtx.decodeAudioData(arrayBuffer).then(audioBuffer => {
      renderBgmWaveform(audioBuffer);
      logToEditorConsole("BGM waveform rendered successfully.", "success");
    }).catch(err => {
      console.warn("Waveform decode failed:", err);
    });
  };
  reader.readAsArrayBuffer(file);

  const audio = document.createElement('audio');
  audio.src = bgMusic.url;
  audio.preload = 'metadata';
  audio.loop = true;
  audio.crossOrigin = 'anonymous';
  audio.addEventListener('loadedmetadata', () => {
    bgMusic.element = audio;
    bgMusic.duration = audio.duration || 0;
    logToEditorConsole('Background music loaded.', 'success');
  });
  audio.addEventListener('error', () => logToEditorConsole('Could not load the selected audio.', 'error'));
}

function renderCaptionsList() {
  els.captionsList.innerHTML = '';
  captions.forEach(caption => {
    const row = document.createElement('div');
    row.className = `caption-item-row ${caption.id === activeCaptionId ? 'active' : ''}`;
    const text = document.createElement('span');
    text.textContent = caption.text || '(Empty text)';
    const time = document.createElement('span');
    time.className = 'time-tag';
    time.textContent = `${caption.showAt.toFixed(1)}s - ${caption.hideAt.toFixed(1)}s`;
    row.append(text, time);
    row.addEventListener('click', () => selectCaption(caption.id));
    els.captionsList.appendChild(row);
  });
}

function selectCaption(id) {
  activeCaptionId = id;
  renderCaptionsList();
  const caption = captions.find(c => c.id === id);
  if (!caption) {
    els.captionEditorPanel.style.display = 'none';
    recalculateTimeline();
    renderCanvas();
    return;
  }

  els.captionEditorPanel.style.display = 'block';
  els.captionText.value = caption.text;
  els.captionColor.value = caption.color;
  els.captionSize.value = caption.size;
  els.captionPosition.value = caption.position;
  els.captionStart.max = totalDuration;
  els.captionEnd.max = totalDuration;
  els.captionStart.value = caption.showAt;
  els.captionEnd.value = caption.hideAt;
  setText('captionStartVal', `${caption.showAt.toFixed(1)}s`);
  setText('captionEndVal', `${caption.hideAt.toFixed(1)}s`);
  recalculateTimeline();
  renderCanvas();
}

function updateActiveCaption(mutator) {
  const caption = captions.find(c => c.id === activeCaptionId);
  if (!caption) return;
  mutator(caption);
  renderCaptionsList();
  recalculateTimeline();
  renderCanvas();
}

function seekTimelineFromEvent(e) {
  if (!clip1.element || !totalDuration || e.target.closest('.track-label')) return;
  const trackBar = document.querySelector('.timeline-track .track-bar');
  if (!trackBar) return;
  const rect = trackBar.getBoundingClientRect();
  const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  currentTime = pct * totalDuration;
  if (bgMusic.element) bgMusic.element.currentTime = currentTime % (bgMusic.duration || totalDuration);
  renderCanvas();
}

function resetFilters() {
  filterBrightness = 100;
  filterContrast = 100;
  filterSaturation = 100;
  els.sliderBrightness.value = 100;
  els.sliderContrast.value = 100;
  els.sliderSaturation.value = 100;
  setText('valBrightness', '100%');
  setText('valContrast', '100%');
  setText('valSaturation', '100%');
  renderCanvas();
  logToEditorConsole('Filters reset.');
}

function mediaCaptureStream(mediaElement) {
  return mediaElement.captureStream?.() || mediaElement.mozCaptureStream?.() || null;
}

function connectMediaAudio(audioCtx, destination, mediaElement, gainValue) {
  const stream = mediaCaptureStream(mediaElement);
  if (!stream || !stream.getAudioTracks().length) return false;
  const source = audioCtx.createMediaStreamSource(stream);
  const gain = audioCtx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  gain.connect(destination);
  return true;
}

function cleanupExport(audioCtx, overlay) {
  if (bgMusic.element) bgMusic.element.pause();
  [clip1, clip2].forEach(clip => {
    if (clip.element?.pause) clip.element.pause();
  });
  if (audioCtx) audioCtx.close().catch(() => {});
  overlay.style.display = 'none';
  isExporting = false;
  currentTime = 0;
  recalculateTimeline();
  renderCanvas();
}

async function exportVideo() {
  if (isExporting || !clip1.element || !canvas.captureStream || typeof MediaRecorder === 'undefined') {
    logToEditorConsole('Export is not available in this browser.', 'error');
    return;
  }

  stopPlayback();
  isExporting = true;
  cancelExportFlag = false;

  const overlay = byId('exportOverlay');
  const progText = byId('exportProgressText');
  const progBar = byId('exportProgressBar');
  overlay.style.display = 'flex';
  progText.textContent = 'Preparing render...';
  progBar.style.width = '0%';
  logToEditorConsole('Export started.', 'alert');

  const fps = 30;
  const canvasStream = canvas.captureStream(fps);
  const mixedStream = new MediaStream(canvasStream.getVideoTracks());
  let audioCtx = null;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const destination = audioCtx.createMediaStreamDestination();
    const mainVol = getMainVolume();
    const bgmVol = getBgmVolume();
    if (clip1.element && mainVol > 0) connectMediaAudio(audioCtx, destination, clip1.element, mainVol);
    if (clip2.element && clip2.type === 'video' && mainVol > 0) connectMediaAudio(audioCtx, destination, clip2.element, mainVol);
    if (bgMusic.element && bgmVol > 0) connectMediaAudio(audioCtx, destination, bgMusic.element, bgmVol);
    destination.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
  } catch (error) {
    logToEditorConsole('Audio mix unavailable; exporting video-only stream.', 'error');
    console.warn(error);
  }

  const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
  const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = e => {
    if (e.data?.size) chunks.push(e.data);
  };

  recorder.onstop = () => {
    if (cancelExportFlag) {
      cleanupExport(audioCtx, overlay);
      logToEditorConsole('Export cancelled.', 'error');
      return;
    }
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbr_studio_render_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    cleanupExport(audioCtx, overlay);
    logToEditorConsole('Video exported successfully.', 'success');
  };

  currentTime = 0;
  if (clip1.element) {
    clip1.element.currentTime = trimStart;
    clip1.element.muted = false;
    clip1.element.volume = getMainVolume();
  }
  if (clip2.element && clip2.type === 'video') {
    clip2.element.currentTime = 0;
    clip2.element.muted = false;
    clip2.element.volume = getMainVolume();
  }
  if (bgMusic.element) {
    bgMusic.element.currentTime = 0;
    bgMusic.element.muted = false;
    bgMusic.element.volume = getBgmVolume();
    bgMusic.element.play().catch(() => {});
  }

  recorder.start(500);
  const start = performance.now();

  function step() {
    if (cancelExportFlag || currentTime >= totalDuration) {
      if (recorder.state !== 'inactive') recorder.stop();
      return;
    }

    currentTime = Math.min(totalDuration, (performance.now() - start) / 1000);
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

      [clip1, clip2].forEach(clip => {
        if (clip.element?.pause && clip.element !== activeSource) clip.element.pause();
      });

      if (activeSource) {
        if (activeType === 'video') {
          if (Math.abs(activeSource.currentTime - seekTime) > 0.25) activeSource.currentTime = seekTime;
          if (activeSource.paused) activeSource.play().catch(() => {});
        }
        drawFrame(activeSource, activeType);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    drawCaptions();
    const pct = Math.round((currentTime / totalDuration) * 100);
    progText.textContent = `Rendering: ${pct}%`;
    progBar.style.width = `${pct}%`;
    setTimeout(step, 1000 / fps);
  }

  step();
}

els.btnPlayPause.addEventListener('click', togglePlayPause);
els.btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  els.btnMute.classList.toggle('is-muted', isMuted);
  els.btnMute.title = isMuted ? 'Unmute preview audio' : 'Mute preview audio';
  els.btnMute.setAttribute('aria-label', els.btnMute.title);
  els.btnMute.innerHTML = isMuted
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M18 9l4 4"></path><path d="M22 9l-4 4"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 6a8 8 0 0 1 0 12"></path></svg>';
  syncAudioMixer(getSegmentAtTime(currentTime)?.segment.type === 'insert' ? clip2.element : clip1.element);
});
els.btnExport.addEventListener('click', exportVideo);
els.btnCancelExport.addEventListener('click', () => { cancelExportFlag = true; });
els.btnRemoveClip2.addEventListener('click', removeReplacement);
els.btnResetPan.addEventListener('click', () => resetPan(true));
els.btnResetFilters.addEventListener('click', resetFilters);
if (els.btnRangeIntro) {
  els.btnRangeIntro.addEventListener('click', () => {
    if (!clip1.element) return;
    cutStart = trimStart;
    cutEnd = Math.min(trimEnd, trimStart + Math.min(2, trimEnd - trimStart));
    currentTime = 0;
    recalculateTimeline();
    renderCanvas();
    logToEditorConsole('Range set to the intro.');
  });
}
if (els.btnRangeAtPlayhead) {
  els.btnRangeAtPlayhead.addEventListener('click', () => {
    if (!clip1.element) return;
    const result = getSegmentAtTime(currentTime);
    const sourceTime = result?.segment.type === 'main' ? result.segment.start + result.offset : trimStart;
    cutStart = clamp(sourceTime, trimStart, trimEnd - 0.1);
    cutEnd = Math.min(trimEnd, cutStart + Math.min(4, trimEnd - cutStart));
    currentTime = 0;
    recalculateTimeline();
    renderCanvas();
    logToEditorConsole('Range set from the playhead.');
  });
}
if (els.btnRangeTail) {
  els.btnRangeTail.addEventListener('click', () => {
    if (!clip1.element) return;
    cutEnd = trimEnd;
    cutStart = Math.max(trimStart, trimEnd - Math.min(3, trimEnd - trimStart));
    currentTime = 0;
    recalculateTimeline();
    renderCanvas();
    logToEditorConsole('Range set to the ending.');
  });
}
document.querySelectorAll('.aspect-btn').forEach(btn => btn.addEventListener('click', () => setAspectRatio(btn.dataset.ratio)));

byId('clip1File').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleMainVideo(file);
});
byId('clip2File').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleReplacement(file);
});
els.bgmFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleBgm(file);
});

els.mainTrimStart.addEventListener('input', e => {
  trimStart = parseFloat(e.target.value);
  if (trimStart >= trimEnd) trimStart = trimEnd - 0.1;
  if (cutStart < trimStart) cutStart = trimStart;
  if (cutEnd <= cutStart) cutEnd = cutStart + 0.1;
  currentTime = 0;
  recalculateTimeline();
  renderCanvas();
});
els.mainTrimEnd.addEventListener('input', e => {
  trimEnd = parseFloat(e.target.value);
  if (trimEnd <= trimStart) trimEnd = trimStart + 0.1;
  if (cutEnd > trimEnd) cutEnd = trimEnd;
  if (cutStart >= cutEnd) cutStart = cutEnd - 0.1;
  currentTime = 0;
  recalculateTimeline();
  renderCanvas();
});
els.c1Start.addEventListener('input', e => {
  cutStart = parseFloat(e.target.value);
  if (cutStart >= cutEnd) cutStart = cutEnd - 0.1;
  currentTime = 0;
  recalculateTimeline();
  renderCanvas();
});
els.c1End.addEventListener('input', e => {
  cutEnd = parseFloat(e.target.value);
  if (cutEnd <= cutStart) cutEnd = cutStart + 0.1;
  currentTime = 0;
  recalculateTimeline();
  renderCanvas();
});
els.c2Duration.addEventListener('input', e => {
  clip2.duration = parseFloat(e.target.value);
  setText('c2DurVal', `${clip2.duration.toFixed(1)}s`);
  currentTime = 0;
  recalculateTimeline();
  renderCanvas();
});

els.sliderBrightness.addEventListener('input', e => {
  filterBrightness = parseInt(e.target.value, 10);
  setText('valBrightness', `${filterBrightness}%`);
  renderCanvas();
});
els.sliderContrast.addEventListener('input', e => {
  filterContrast = parseInt(e.target.value, 10);
  setText('valContrast', `${filterContrast}%`);
  renderCanvas();
});
els.sliderSaturation.addEventListener('input', e => {
  filterSaturation = parseInt(e.target.value, 10);
  setText('valSaturation', `${filterSaturation}%`);
  renderCanvas();
});

els.mainVolume.addEventListener('input', e => {
  mainAudioVolume = parseFloat(e.target.value);
  setText('valMainVolume', `${Math.round(mainAudioVolume * 100)}%`);
  syncAudioMixer(getSegmentAtTime(currentTime)?.segment.type === 'insert' ? clip2.element : clip1.element);
});
els.bgmVolume.addEventListener('input', e => {
  bgMusic.volume = parseFloat(e.target.value);
  setText('valBgmVolume', `${Math.round(bgMusic.volume * 100)}%`);
  syncAudioMixer(clip1.element);
});
els.btnMuteMain.addEventListener('click', () => {
  mainAudioMuted = !mainAudioMuted;
  els.btnMuteMain.classList.toggle('active-mute', mainAudioMuted);
  syncAudioMixer(clip1.element);
});
els.btnSoloMain.addEventListener('click', () => {
  mainAudioSolo = !mainAudioSolo;
  if (mainAudioSolo) bgMusic.isSolo = false;
  els.btnSoloMain.classList.toggle('active-solo', mainAudioSolo);
  els.btnSoloBgm.classList.toggle('active-solo', bgMusic.isSolo);
  syncAudioMixer(clip1.element);
});
els.btnMuteBgm.addEventListener('click', () => {
  bgMusic.isMuted = !bgMusic.isMuted;
  els.btnMuteBgm.classList.toggle('active-mute', bgMusic.isMuted);
  syncAudioMixer(clip1.element);
});
els.btnSoloBgm.addEventListener('click', () => {
  bgMusic.isSolo = !bgMusic.isSolo;
  if (bgMusic.isSolo) mainAudioSolo = false;
  els.btnSoloBgm.classList.toggle('active-solo', bgMusic.isSolo);
  els.btnSoloMain.classList.toggle('active-solo', mainAudioSolo);
  syncAudioMixer(clip1.element);
});

els.btnAddCaption.addEventListener('click', () => {
  const id = Date.now();
  captions.push({
    id,
    text: 'Reels Text',
    color: '#ffffff',
    size: 32,
    position: 'bottom',
    showAt: currentTime,
    hideAt: Math.min(totalDuration, currentTime + 4)
  });
  logToEditorConsole('Caption layer added.');
  selectCaption(id);
});
els.captionText.addEventListener('input', e => updateActiveCaption(caption => { caption.text = e.target.value; }));
els.captionColor.addEventListener('input', e => updateActiveCaption(caption => { caption.color = e.target.value; }));
els.captionSize.addEventListener('input', e => updateActiveCaption(caption => { caption.size = parseInt(e.target.value, 10); }));
els.captionPosition.addEventListener('change', e => updateActiveCaption(caption => { caption.position = e.target.value; }));
els.captionStart.addEventListener('input', e => updateActiveCaption(caption => {
  caption.showAt = clamp(parseFloat(e.target.value), 0, caption.hideAt - 0.1);
  setText('captionStartVal', `${caption.showAt.toFixed(1)}s`);
}));
els.captionEnd.addEventListener('input', e => updateActiveCaption(caption => {
  caption.hideAt = clamp(parseFloat(e.target.value), caption.showAt + 0.1, totalDuration);
  setText('captionEndVal', `${caption.hideAt.toFixed(1)}s`);
}));
byId('btnDeleteCaption').addEventListener('click', () => {
  if (!activeCaptionId) return;
  captions = captions.filter(caption => caption.id !== activeCaptionId);
  activeCaptionId = null;
  logToEditorConsole('Caption layer removed.');
  selectCaption(null);
});

document.querySelector('.timeline-tracks').addEventListener('click', seekTimelineFromEvent);
window.addEventListener('resize', updatePlayhead);

wrapper.addEventListener('mousedown', e => {
  if (!clip1.element) return;

  const rect = canvas.getBoundingClientRect();
  const canvasX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const canvasY = ((e.clientY - rect.top) / rect.height) * canvas.height;

  // Check if click hit active caption's resize handle
  const activeCap = captions.find(c => c.id === activeCaptionId);
  if (activeCap && currentTime >= activeCap.showAt && currentTime <= activeCap.hideAt) {
    ctx.save();
    ctx.font = `bold ${activeCap.size}px Outfit, Arial, sans-serif`;
    const lines = getWrappedLines(activeCap.text || 'Reels Text', canvas.width * 0.86);
    const lineHeight = activeCap.size * 1.18;
    let y = canvas.height * 0.82;
    if (activeCap.position === 'top') y = canvas.height * 0.16;
    if (activeCap.position === 'center') y = canvas.height * 0.5;
    y -= ((lines.length - 1) * lineHeight) / 2;
    
    const width = Math.max(...lines.map(line => ctx.measureText(line).width));
    const height = lines.length * lineHeight;
    const rightX = canvas.width / 2 + width / 2 + 16;
    const bottomY = y + (lines.length - 1) * lineHeight + activeCap.size / 2 + 8;
    ctx.restore();

    const distToHandle = Math.hypot(canvasX - rightX, canvasY - bottomY);
    if (distToHandle < 30) {
      isResizingCaption = true;
      startResizeSize = activeCap.size;
      const textCenterY = y + ((lines.length - 1) * lineHeight) / 2;
      startDistance = Math.hypot(canvasX - canvas.width / 2, canvasY - textCenterY) || 1;
      e.preventDefault();
      return;
    }
  }

  isPanning = true;
  startPanMouseX = e.clientX;
  startPanMouseY = e.clientY;
  startPanOffsetX = panX;
  startPanOffsetY = panY;
  e.preventDefault();
});

window.addEventListener('mousemove', e => {
  if (isResizingCaption) {
    const activeCap = captions.find(c => c.id === activeCaptionId);
    if (activeCap) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const canvasY = ((e.clientY - rect.top) / rect.height) * canvas.height;

      ctx.save();
      ctx.font = `bold ${activeCap.size}px Outfit, Arial, sans-serif`;
      const lines = getWrappedLines(activeCap.text || 'Reels Text', canvas.width * 0.86);
      const lineHeight = activeCap.size * 1.18;
      let y = canvas.height * 0.82;
      if (activeCap.position === 'top') y = canvas.height * 0.16;
      if (activeCap.position === 'center') y = canvas.height * 0.5;
      y -= ((lines.length - 1) * lineHeight) / 2;
      const textCenterY = y + ((lines.length - 1) * lineHeight) / 2;
      ctx.restore();

      const dist = Math.hypot(canvasX - canvas.width / 2, canvasY - textCenterY);
      const newSize = clamp(Math.round(startResizeSize * (dist / startDistance)), 16, 80);
      activeCap.size = newSize;
      
      els.captionSize.value = newSize;
      renderCanvas();
    }
    return;
  }

  if (!isPanning) return;
  const scaleX = canvas.width / wrapper.clientWidth;
  const scaleY = canvas.height / wrapper.clientHeight;
  panX = startPanOffsetX + ((e.clientX - startPanMouseX) * scaleX);
  panY = startPanOffsetY + ((e.clientY - startPanMouseY) * scaleY);
  renderCanvas();
});

window.addEventListener('mouseup', () => {
  if (isResizingCaption) {
    isResizingCaption = false;
    logToEditorConsole(`Caption resized to ${els.captionSize.value}px.`);
    return;
  }
  if (isPanning) {
    isPanning = false;
    logToEditorConsole(`Crop offset: ${panX.toFixed(0)}, ${panY.toFixed(0)}`);
  }
});

wrapper.addEventListener('touchstart', e => {
  if (!clip1.element || !e.touches.length) return;

  const rect = canvas.getBoundingClientRect();
  const canvasX = ((e.touches[0].clientX - rect.left) / rect.width) * canvas.width;
  const canvasY = ((e.touches[0].clientY - rect.top) / rect.height) * canvas.height;

  const activeCap = captions.find(c => c.id === activeCaptionId);
  if (activeCap && currentTime >= activeCap.showAt && currentTime <= activeCap.hideAt) {
    ctx.save();
    ctx.font = `bold ${activeCap.size}px Outfit, Arial, sans-serif`;
    const lines = getWrappedLines(activeCap.text || 'Reels Text', canvas.width * 0.86);
    const lineHeight = activeCap.size * 1.18;
    let y = canvas.height * 0.82;
    if (activeCap.position === 'top') y = canvas.height * 0.16;
    if (activeCap.position === 'center') y = canvas.height * 0.5;
    y -= ((lines.length - 1) * lineHeight) / 2;
    
    const width = Math.max(...lines.map(line => ctx.measureText(line).width));
    const height = lines.length * lineHeight;
    const rightX = canvas.width / 2 + width / 2 + 16;
    const bottomY = y + (lines.length - 1) * lineHeight + activeCap.size / 2 + 8;
    ctx.restore();

    const distToHandle = Math.hypot(canvasX - rightX, canvasY - bottomY);
    if (distToHandle < 35) {
      isResizingCaption = true;
      startResizeSize = activeCap.size;
      const textCenterY = y + ((lines.length - 1) * lineHeight) / 2;
      startDistance = Math.hypot(canvasX - canvas.width / 2, canvasY - textCenterY) || 1;
      return;
    }
  }

  isPanning = true;
  startPanMouseX = e.touches[0].clientX;
  startPanMouseY = e.touches[0].clientY;
  startPanOffsetX = panX;
  startPanOffsetY = panY;
});

window.addEventListener('touchmove', e => {
  if (!e.touches.length) return;

  if (isResizingCaption) {
    const activeCap = captions.find(c => c.id === activeCaptionId);
    if (activeCap) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = ((e.touches[0].clientX - rect.left) / rect.width) * canvas.width;
      const canvasY = ((e.touches[0].clientY - rect.top) / rect.height) * canvas.height;

      ctx.save();
      ctx.font = `bold ${activeCap.size}px Outfit, Arial, sans-serif`;
      const lines = getWrappedLines(activeCap.text || 'Reels Text', canvas.width * 0.86);
      const lineHeight = activeCap.size * 1.18;
      let y = canvas.height * 0.82;
      if (activeCap.position === 'top') y = canvas.height * 0.16;
      if (activeCap.position === 'center') y = canvas.height * 0.5;
      y -= ((lines.length - 1) * lineHeight) / 2;
      const textCenterY = y + ((lines.length - 1) * lineHeight) / 2;
      ctx.restore();

      const dist = Math.hypot(canvasX - canvas.width / 2, canvasY - textCenterY);
      const newSize = clamp(Math.round(startResizeSize * (dist / startDistance)), 16, 80);
      activeCap.size = newSize;
      
      els.captionSize.value = newSize;
      renderCanvas();
    }
    return;
  }

  if (!isPanning) return;
  const scaleX = canvas.width / wrapper.clientWidth;
  const scaleY = canvas.height / wrapper.clientHeight;
  panX = startPanOffsetX + ((e.touches[0].clientX - startPanMouseX) * scaleX);
  panY = startPanOffsetY + ((e.touches[0].clientY - startPanMouseY) * scaleY);
  renderCanvas();
});

window.addEventListener('touchend', () => {
  isPanning = false;
  isResizingCaption = false;
});

window.addEventListener('DOMContentLoaded', () => {
  setAspectRatio('9:16');
  recalculateTimeline();
  drawEmptyScreen();

  // Mock upload testing helper
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock_upload') || urlParams.get('video')) {
    logToEditorConsole("Running automated mock upload sequence...");
    fetch('/downloaded_video.mp4')
      .then(res => {
        if (!res.ok) throw new Error("Test video asset not found on server");
        return res.blob();
      })
      .then(blob => {
        const file = new File([blob], "downloaded_video.mp4", { type: "video/mp4" });
        handleMainVideo(file);
      })
      .catch(err => {
        logToEditorConsole(`Mock video load failed: ${err.message}`, "error");
      });
  }
});
