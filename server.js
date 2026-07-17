const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3050;

// Resolve yt-dlp executable path depending on platform (Windows local vs Linux Render container)
let ytdlpPath = 'yt-dlp';

if (process.platform === 'win32') {
  ytdlpPath = 'C:\\Users\\motak\\.gemini\\antigravity-ide\\brain\\e4fa1d1d-76bd-4781-ba16-880dfeb5c54e\\scratch\\yt-dlp.exe';
} else {
  const localYtdlp = path.join(__dirname, 'yt-dlp');
  if (fs.existsSync(localYtdlp)) {
    ytdlpPath = localYtdlp;
  } else {
    try {
      execSync('which yt-dlp');
      ytdlpPath = 'yt-dlp';
    } catch (e) {
      console.log('yt-dlp not found globally. Downloading Linux binary on Render startup...');
      try {
        execSync(`curl -L -o "${localYtdlp}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`);
        execSync(`chmod +x "${localYtdlp}"`);
        ytdlpPath = localYtdlp;
        console.log('yt-dlp downloaded and made executable successfully!');
      } catch (err) {
        console.error('Failed to download yt-dlp on Render:', err);
      }
    }
  }
}

// Resolve ffmpeg path (needed for merge)
let ffmpegPath = 'ffmpeg';
if (process.platform === 'win32') {
  const winFfmpeg = 'C:\\Users\\motak\\Downloads\\ffmpeg\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe';
  if (fs.existsSync(winFfmpeg)) ffmpegPath = winFfmpeg;
}

// Temp directory for merge intermediates
const TMP_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

// Helper to proxy JSON requests to trackingo with browser headers
function proxyRequest(targetUrl, res) {
  const urlObj = new URL(targetUrl);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://' + urlObj.hostname + '/customer/track/' + urlObj.searchParams.get('key'),
      'X-Requested-With': 'XMLHttpRequest'
    }
  };

  https.get(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  }).on('error', (err) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
}

// Run a child process and resolve when it exits 0, reject otherwise
function runProcess(cmd, args) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; console.error(d.toString()); });
    proc.stdout.on('data', d => console.log(d.toString()));
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Exit ${code}: ${stderr.slice(-400)}`));
    });
  });
}

// Silently delete a file, ignore errors
function tryUnlink(f) { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {} }

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/track-journey') {
    const domain = parsedUrl.searchParams.get('domain') || 'trkg.in';
    const key = parsedUrl.searchParams.get('key');
    proxyRequest(`https://${domain}/api/live/journey_details?key=${key}&zoom_position=12&platform=mobile`, res);
  } else if (pathname === '/api/track-eta') {
    const domain = parsedUrl.searchParams.get('domain') || 'trkg.in';
    const key = parsedUrl.searchParams.get('key');
    proxyRequest(`https://${domain}/api/live/eta_map?current_status=true&key=${key}`, res);
  } else if (pathname === '/api/send-whatsapp') {
    const phone = parsedUrl.searchParams.get('phone');
    const apikey = parsedUrl.searchParams.get('apikey');
    const text = parsedUrl.searchParams.get('text');
    proxyRequest(`https://api.callmebot.com/whatsapp.php?phone=${phone}&apikey=${apikey}&text=${encodeURIComponent(text)}`, res);
  } else if (pathname === '/api/download-video') {
    const videoUrl = parsedUrl.searchParams.get('url');
    const type = parsedUrl.searchParams.get('type') || 'video'; // 'video' | 'audio'
    if (!videoUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url parameter');
      return;
    }

    const id = Date.now();
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    const tempFile = path.join(TMP_DIR, `dl_${id}.${ext}`);

    let ytdlpArgs;
    if (type === 'audio') {
      ytdlpArgs = ['--js-runtimes', 'node', '--extractor-args', 'youtube:player_client=android', '-f', 'bestaudio', '-x', '--audio-format', 'mp3', '-o', tempFile, videoUrl];
    } else {
      ytdlpArgs = ['--js-runtimes', 'node', '--extractor-args', 'youtube:player_client=android', '-f', 'best[ext=mp4]/best', '-o', tempFile, videoUrl];
      if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
        ytdlpArgs.push('--ffmpeg-location', ffmpegPath);
      }
    }

    (async () => {
      try {
        await runProcess(ytdlpPath, ytdlpArgs);
        if (!fs.existsSync(tempFile)) {
          throw new Error('Downloader produced no file.');
        }

        const stat = fs.statSync(tempFile);
        res.writeHead(200, {
          'Content-Type': type === 'audio' ? 'audio/mpeg' : 'video/mp4',
          'Content-Disposition': `attachment; filename="downloaded_${type}.${ext}"`,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });

        const stream = fs.createReadStream(tempFile);
        stream.pipe(res);

        stream.on('end', () => {
          tryUnlink(tempFile);
        });
      } catch (err) {
        console.error('Download failed:', err.message);
        tryUnlink(tempFile);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('Download failed: ' + err.message);
      }
    })();

  } else if (pathname === '/api/merge') {

    // ── Merge video + audio into one MP4 ──────────────────────────────────
    const videoUrl = parsedUrl.searchParams.get('url');
    if (!videoUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }

    const id    = Date.now();
    const vFile = path.join(TMP_DIR, `v_${id}.mp4`);
    const aFile = path.join(TMP_DIR, `a_${id}.m4a`);
    const oFile = path.join(TMP_DIR, `merged_${id}.mp4`);

    (async () => {
      try {
        // 1. Download video-only stream to disk
        await runProcess(ytdlpPath, [
          '--js-runtimes', 'node',
          '--extractor-args', 'youtube:player_client=android',
          '-f', 'bestvideo[ext=mp4]/bestvideo',
          '--no-playlist', '-o', vFile, videoUrl
        ]);

        if (!fs.existsSync(vFile)) throw new Error('Video download produced no file.');

        // 2. Download audio-only stream to disk
        await runProcess(ytdlpPath, [
          '--js-runtimes', 'node',
          '--extractor-args', 'youtube:player_client=android',
          '-f', 'bestaudio',
          '--no-playlist', '-o', aFile, videoUrl
        ]);

        if (!fs.existsSync(aFile)) throw new Error('Audio download produced no file.');

        // 3. Merge — copy video, encode audio as AAC, trim to shorter stream
        await runProcess(ffmpegPath, [
          '-i', vFile, '-i', aFile,
          '-c:v', 'copy', '-c:a', 'aac', '-shortest',
          '-y', oFile
        ]);

        if (!fs.existsSync(oFile)) throw new Error('ffmpeg merge produced no output file.');

        // 4. Stream merged file to client
        const stat = fs.statSync(oFile);
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="merged_output.mp4"',
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });

        const stream = fs.createReadStream(oFile);
        stream.pipe(res);

        stream.on('end', () => {
          // 5. Delete originals (only after successful stream) — keep none
          tryUnlink(vFile);
          tryUnlink(aFile);
          tryUnlink(oFile);
          console.log(`Merge complete, temp files cleaned up (id=${id})`);
        });

      } catch (err) {
        console.error('Merge failed:', err.message);
        // Do NOT delete originals on failure so user can retry
        tryUnlink(oFile); // clean any partial output
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: err.message }));
      }
    })();

  } else if (pathname === '/api/upload/video' || pathname === '/api/upload/audio') {
    // ── Receive raw binary upload (video or audio) ─────────────────────────
    const session = parsedUrl.searchParams.get('session');
    if (!session) { res.writeHead(400); res.end('Missing session'); return; }
    const isVideo = pathname.includes('video');
    const ext = isVideo ? 'mp4' : 'mp3';
    const outFile = path.join(TMP_DIR, `upload_${isVideo ? 'v' : 'a'}_${session}.${ext}`);
    const ws = fs.createWriteStream(outFile);
    req.pipe(ws);
    ws.on('finish', () => {
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }
    });
    ws.on('error', err => {
      tryUnlink(outFile);
      if (!res.headersSent) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
    });

  } else if (pathname === '/api/merge-uploaded') {
    // ── Merge previously uploaded video + audio files ─────────────────────
    const session = parsedUrl.searchParams.get('session');
    if (!session) { res.writeHead(400); res.end('Missing session'); return; }
    const vFile = path.join(TMP_DIR, `upload_v_${session}.mp4`);
    const aFile = path.join(TMP_DIR, `upload_a_${session}.mp3`);
    const oFile = path.join(TMP_DIR, `upload_merged_${session}.mp4`);

    if (!fs.existsSync(vFile) || !fs.existsSync(aFile)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload both video and audio files first.' }));
      return;
    }

    (async () => {
      try {
        await runProcess(ffmpegPath, [
          '-i', vFile, '-i', aFile,
          '-c:v', 'copy', '-c:a', 'aac', '-shortest',
          '-y', oFile
        ]);
        if (!fs.existsSync(oFile)) throw new Error('ffmpeg produced no output.');
        const stat = fs.statSync(oFile);
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="merged_output.mp4"',
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });
        const rs = fs.createReadStream(oFile);
        rs.pipe(res);
        rs.on('end', () => { tryUnlink(vFile); tryUnlink(aFile); tryUnlink(oFile); });
      } catch (err) {
        tryUnlink(oFile); // remove partial output; keep v+a so user can retry
        if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); }
        res.end(JSON.stringify({ error: err.message }));
      }
    })();

  } else {
    // Serve static files

    let fileSegment = pathname;
    if (pathname === '/') {
      fileSegment = 'index.html';
    } else if (pathname === '/editor') {
      fileSegment = 'editor.html';
    } else if (pathname === '/video-editor') {
      fileSegment = 'video-editor.html';
    } else if (pathname === '/video-downloader' || pathname === '/downloader') {
      fileSegment = 'downloader.html';

    }
    let filePath = path.join(__dirname, fileSegment);
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg') contentType = 'image/jpeg';
    else if (ext === '.ico') contentType = 'image/x-icon';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        const headers = { 'Content-Type': contentType };
        if (contentType === 'text/html') {
          headers['Cross-Origin-Opener-Policy'] = 'same-origin';
          headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        }
        res.writeHead(200, headers);
        res.end(content, 'utf-8');
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`MBR Motion Hub running at http://localhost:${PORT}`);
});
