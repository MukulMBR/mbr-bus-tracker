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
  console.log('Ensuring latest yt-dlp binary is installed...');
  try {
    if (fs.existsSync(localYtdlp)) {
      fs.unlinkSync(localYtdlp);
    }
    execSync(`curl -L -o "${localYtdlp}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`);
    execSync(`chmod +x "${localYtdlp}"`);
    ytdlpPath = localYtdlp;
    console.log('Latest yt-dlp downloaded and made executable successfully!');
  } catch (err) {
    console.error('Failed to download latest yt-dlp, falling back to system command:', err);
    ytdlpPath = 'yt-dlp';
  }
}

// Resolve ffmpeg path (needed for merge)
let ffmpegPath = 'ffmpeg';
if (process.platform === 'win32') {
  const winFfmpeg = 'C:\\Users\\motak\\Downloads\\ffmpeg\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe';
  if (fs.existsSync(winFfmpeg)) ffmpegPath = winFfmpeg;
}
const ffmpegLocation = ffmpegPath && ffmpegPath !== 'ffmpeg' ? path.dirname(ffmpegPath) : null;
const cookiesPath = process.env.YT_DLP_COOKIES_PATH || path.join(__dirname, 'cookies.txt');

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

// Storage for tracking speed delta calculation
const yourBusLastLocations = new Map();

function fetchYourBusHtml(urlStr) {
  let targetUrl = (urlStr || '').trim();
  if (!targetUrl.startsWith('http')) {
    if (targetUrl.length <= 6) {
      targetUrl = `https://s.yourbus.in/?${targetUrl}`;
    } else {
      targetUrl = `http://reports.yourbus.in/trackbus/${targetUrl}`;
    }
  }

  return new Promise((resolve, reject) => {
    function follow(url, count = 0) {
      if (count > 5) return reject(new Error('Too many redirects'));
      const mod = url.startsWith('https:') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location;
          if (!loc.startsWith('http')) {
            const u = new URL(url);
            loc = u.origin + loc;
          }
          follow(loc, count + 1);
        } else {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            const mData = body.match(/const data = JSON\.parse\('(.*?)'\);/);
            if (mData) {
              try {
                const parsed = JSON.parse(mData[1]);
                resolve({ finalUrl: url, data: parsed });
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error('No embedded data JSON found in page'));
            }
          });
        }
      }).on('error', reject);
    }
    follow(targetUrl);
  });
}

function handleYourBusJourney(inputUrl, key, res) {
  const target = inputUrl || key;
  fetchYourBusHtml(target)
    .then(({ data }) => {
      if (data.error) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ status: 400, error: data.error }));
      }

      const s = data.service || {};
      const v = data.vehicle || {};
      const loc = v.location || {};

      const busLat = parseFloat(loc.lat) || 0;
      const busLng = parseFloat(loc.lng) || 0;

      const servicePlaces = [];
      
      if (Array.isArray(data.positions) && data.positions.length > 0) {
        data.positions.forEach(pt => {
          servicePlaces.push({
            sp_name: `${pt.name || 'Station'} (${pt.estimatedTime || pt.scheduleTime || ''})`,
            lat_long: [parseFloat(pt.lat) || busLat, parseFloat(pt.lng) || busLng],
            stage_type: pt.status === 'DEPARTED' ? 'boarding' : 'dropoff'
          });
        });
      } else {
        const srcName = s.source || 'Tirupati';
        const dstName = s.destination || 'Koteshwara';

        if (srcName.toLowerCase().includes('tirupati') || dstName.toLowerCase().includes('koteshwara')) {
          servicePlaces.push({ sp_name: `🚩 Tirupati Main Bus Stand (Boarding: 07:30 PM)`, lat_long: [13.6288, 79.4192], stage_type: "boarding" });
          servicePlaces.push({ sp_name: `📍 Palamaner Bus Stop (Drop Station)`, lat_long: [13.2000, 78.7500], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `📍 Kolar Bypass (Drop Station)`, lat_long: [13.1367, 78.1292], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `📍 Bengaluru Hoskote Toll (Drop Station)`, lat_long: [13.0720, 77.7980], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `📍 Tumakuru Bypass (Drop Station)`, lat_long: [13.3392, 77.1017], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `📍 Shivamogga KSRTC Bus Stand (Drop Station)`, lat_long: [13.9299, 75.5681], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `📍 Kundapura Bus Stand (Drop Station)`, lat_long: [13.6268, 74.6934], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `🏁 Koteshwara Junction (Final Drop: 08:55 AM)`, lat_long: [13.6157, 74.7001], stage_type: "dropoff" });
        } else {
          servicePlaces.push({ sp_name: `🚩 ${srcName} (Boarding: ${s.startTime || 'Scheduled'})`, lat_long: [busLat + 0.05, busLng - 0.05], stage_type: "boarding" });
          servicePlaces.push({ sp_name: `📍 Mid-Route Dropping Point 1`, lat_long: [busLat + 0.02, busLng - 0.02], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `📍 Mid-Route Dropping Point 2`, lat_long: [busLat - 0.02, busLng + 0.02], stage_type: "dropoff" });
          servicePlaces.push({ sp_name: `🏁 ${dstName} (Final Drop: ${s.endTime || 'Scheduled'})`, lat_long: [busLat - 0.05, busLng + 0.05], stage_type: "dropoff" });
        }
      }

      const vInfo = data.vehicleInfo || {};
      const operatorName = vInfo.operatorName || (s.name ? s.name : (s.operatorId ? `${s.operatorId} Bus Service` : "Operator info unavailable"));
      const vehicleNum = vInfo.registrationNumber || v.number || "Vehicle # unavailable";
      const rawContact = (Array.isArray(vInfo.contactNumber) && vInfo.contactNumber.length > 0) ? vInfo.contactNumber[0] : (v.contact || "");
      const contactNum = rawContact ? String(rawContact) : "";

      const responseObj = {
        status: 200,
        journey_details: {
          service_number: s.number || data.ybServiceNo || s.name || "Live Service",
          operator_name: operatorName,
          vehicle_number: vehicleNum,
          contact_number: contactNum,
          source: s.source || "Boarding Point",
          destination: s.destination || "Dropping Point",
          start_time: s.startTime || "",
          end_time: s.endTime || "",
          date: data.doj || ""
        },
        all_service_places: servicePlaces
      };

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(responseObj));
    })
    .catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ status: 500, error: err.message }));
    });
}

function handleTileProxy(pathname, res) {
  const parts = pathname.replace('/api/tile/', '').split('/');
  if (parts.length === 3) {
    const z = parts[0];
    const x = parts[1];
    const y = parts[2].replace('.png', '');
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    
    const reqOpts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MBR-Trip-Radar/1.0'
      }
    };

    https.get(tileUrl, reqOpts, (tRes) => {
      if (tRes.statusCode === 200) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        tRes.pipe(res);
      } else {
        res.writeHead(tRes.statusCode || 404);
        res.end();
      }
    }).on('error', () => {
      res.writeHead(500);
      res.end();
    });
  } else {
    res.writeHead(400);
    res.end();
  }
}

function handleYourBusEta(inputUrl, key, res) {
  const target = inputUrl || key;
  fetchYourBusHtml(target)
    .then(({ data }) => {
      const s = data.service || {};
      const v = data.vehicle || {};
      const loc = v.location || {};

      const busLat = parseFloat(loc.lat) || 0;
      const busLng = parseFloat(loc.lng) || 0;

      let calculatedSpeed = 45;
      const prev = yourBusLastLocations.get(key || target);
      const nowTs = loc.timeStamp ? loc.timeStamp * 1000 : Date.now();
      if (prev && prev.ts && nowTs > prev.ts) {
        const distKm = getDistanceKm(prev.lat, prev.lng, busLat, busLng);
        const hours = (nowTs - prev.ts) / (1000 * 3600);
        if (hours > 0) {
          const spd = distKm / hours;
          if (spd >= 0 && spd <= 140) calculatedSpeed = Math.round(spd);
        }
      }
      yourBusLastLocations.set(key || target, { lat: busLat, lng: busLng, ts: nowTs });

      const responseObj = {
        status: 200,
        current_status_details: {
          lat_long: [busLat, busLng],
          details: {
            speed: calculatedSpeed,
            location: `Bus ${v.number || ''} (${s.source || ''} ➔ ${s.destination || ''})`,
            updated_at: loc.gpsTimeStamp || new Date().toISOString()
          }
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(responseObj));
    })
    .catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ status: 500, error: err.message }));
    });
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/track-journey') {
    const domain = parsedUrl.searchParams.get('domain') || '';
    const key = parsedUrl.searchParams.get('key') || '';
    const rawUrl = parsedUrl.searchParams.get('url') || '';

    if (domain.includes('yourbus') || rawUrl.includes('yourbus') || key.startsWith('2N') || key.length === 4) {
      handleYourBusJourney(rawUrl, key, res);
    } else {
      proxyRequest(`https://${domain || 'trkg.in'}/api/live/journey_details?key=${key}&zoom_position=12&platform=mobile`, res);
    }
  } else if (pathname === '/api/track-eta') {
    const domain = parsedUrl.searchParams.get('domain') || '';
    const key = parsedUrl.searchParams.get('key') || '';
    const rawUrl = parsedUrl.searchParams.get('url') || '';

    if (domain.includes('yourbus') || rawUrl.includes('yourbus') || key.startsWith('2N') || key.length === 4) {
      handleYourBusEta(rawUrl, key, res);
    } else {
      proxyRequest(`https://${domain || 'trkg.in'}/api/live/eta_map?current_status=true&key=${key}`, res);
    }
  } else if (pathname.startsWith('/api/tile/')) {
    handleTileProxy(pathname, res);
  } else if (pathname === '/api/send-whatsapp') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let phone, apikey, text;
      try {
        const payload = JSON.parse(body);
        phone = payload.phone;
        apikey = payload.apikey;
        text = payload.text;
      } catch (e) {
        phone = parsedUrl.searchParams.get('phone');
        apikey = parsedUrl.searchParams.get('apikey');
        text = parsedUrl.searchParams.get('text');
      }

      if (!phone || !apikey || !text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing phone, apikey, or text' }));
        return;
      }

      proxyRequest(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(text)}`, res);
    });
    return;
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

    const quality = parsedUrl.searchParams.get('quality') || 'best';

    let ytdlpArgs = ['--js-runtimes', 'node:' + process.execPath];
    if (type === 'audio') {
      let formatStr = 'bestaudio';
      ytdlpArgs.push('-f', formatStr, '-x', '--audio-format', 'mp3');
      if (quality === '192k') {
        ytdlpArgs.push('--audio-quality', '192K');
      } else if (quality === '128k') {
        ytdlpArgs.push('--audio-quality', '128K');
      } else if (quality === '96k') {
        ytdlpArgs.push('--audio-quality', '96K');
      } else {
        ytdlpArgs.push('--audio-quality', '320K');
      }
      ytdlpArgs.push('-o', tempFile);
    } else {
      let formatStr = 'bestvideo+bestaudio/best';
      if (quality === '1080p') {
        formatStr = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
      } else if (quality === '720p') {
        formatStr = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
      } else if (quality === '480p') {
        formatStr = 'bestvideo[height<=480]+bestaudio/best[height<=480]/best';
      } else if (quality === '360p') {
        formatStr = 'bestvideo[height<=360]+bestaudio/best[height<=360]/best';
      }
      ytdlpArgs.push('-f', formatStr, '--merge-output-format', 'mp4', '-o', tempFile);
    }
    if (ffmpegLocation) {
      ytdlpArgs.push('--ffmpeg-location', ffmpegLocation);
    }
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      ytdlpArgs.push('--cookies', cookiesPath);
    }
    ytdlpArgs.push(videoUrl);

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
        let clientMsg = err.message || '';
        const isBotOrCookieErr = /confirm.*bot|sign in|cookies|auth|forbidden|403/i.test(clientMsg);
        if (isBotOrCookieErr) {
          clientMsg = "This video requires additional authentication and could not be downloaded";
        } else {
          clientMsg = "Download failed: " + clientMsg;
        }
        res.end(clientMsg);
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
        const vArgs = [
          '--js-runtimes', 'node:' + process.execPath,
          '-f', 'bestvideo[ext=mp4]/bestvideo',
          '--no-playlist', '-o', vFile
        ];
        if (ffmpegLocation) vArgs.push('--ffmpeg-location', ffmpegLocation);
        if (cookiesPath && fs.existsSync(cookiesPath)) {
          vArgs.push('--cookies', cookiesPath);
        }
        vArgs.push(videoUrl);
        await runProcess(ytdlpPath, vArgs);

        if (!fs.existsSync(vFile)) throw new Error('Video download produced no file.');

        // 2. Download audio-only stream to disk
        const aArgs = [
          '--js-runtimes', 'node:' + process.execPath,
          '-f', 'bestaudio',
          '--no-playlist', '-o', aFile
        ];
        if (ffmpegLocation) aArgs.push('--ffmpeg-location', ffmpegLocation);
        if (cookiesPath && fs.existsSync(cookiesPath)) {
          aArgs.push('--cookies', cookiesPath);
        }
        aArgs.push(videoUrl);
        await runProcess(ytdlpPath, aArgs);

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
        let clientMsg = err.message || '';
        const isBotOrCookieErr = /confirm.*bot|sign in|cookies|auth|forbidden|403/i.test(clientMsg);
        if (isBotOrCookieErr) {
          clientMsg = "This video requires additional authentication and could not be downloaded";
        }
        res.end(JSON.stringify({ error: clientMsg }));
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

  } else if (pathname === '/api/wav-to-mp3') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }
    const id = Date.now();
    const wavFile = path.join(TMP_DIR, `conv_${id}.wav`);
    const mp3File = path.join(TMP_DIR, `conv_${id}.mp3`);
    
    const writeStream = fs.createWriteStream(wavFile);
    req.pipe(writeStream);
    
    writeStream.on('finish', async () => {
      try {
        const args = ['-i', wavFile, '-codec:a', 'libmp3lame', '-qscale:a', '2', '-y', mp3File];
        await runProcess(ffmpegPath, args);
        
        if (!fs.existsSync(mp3File)) {
          throw new Error('ffmpeg failed to convert to mp3');
        }
        
        const stat = fs.statSync(mp3File);
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="output.mp3"',
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });
        
        const readStream = fs.createReadStream(mp3File);
        readStream.pipe(res);
        readStream.on('end', () => {
          tryUnlink(wavFile);
          tryUnlink(mp3File);
        });
      } catch (err) {
        console.error('WAV to MP3 conversion failed:', err.message);
        tryUnlink(wavFile);
        tryUnlink(mp3File);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('Conversion failed: ' + err.message);
      }
    });

  } else {
    // Serve static files

    let fileSegment = pathname;
    if (pathname === '/') {
      fileSegment = 'index.html';
    } else if (pathname === '/editor') {
      fileSegment = 'editor.html';
    } else if (pathname === '/video-editor') {
      fileSegment = 'video-editor.html';
    } else if (pathname === '/audio-trimmer' || pathname === '/trimmer') {
      fileSegment = 'audio-trimmer.html';
    } else if (pathname === '/video-downloader' || pathname === '/downloader') {
      fileSegment = 'downloader.html';
    } else if (pathname === '/video-trimmer') {
      fileSegment = 'video-trimmer.html';
    } else if (pathname === '/audio-extractor') {
      fileSegment = 'audio-extractor.html';
    } else if (pathname === '/video-compressor') {
      fileSegment = 'video-compressor.html';
    } else if (pathname === '/gif-maker') {
      fileSegment = 'gif-maker.html';
    } else if (pathname === '/screen-recorder') {
      fileSegment = 'screen-recorder.html';
    } else if (pathname === '/tts-studio') {
      fileSegment = 'tts-studio.html';
    } else if (pathname === '/watermark') {
      fileSegment = 'watermark-studio.html';
    } else if (pathname === '/subtitles') {
      fileSegment = 'subtitle-generator.html';
    } else if (pathname === '/thumbnails') {
      fileSegment = 'thumbnail-generator.html';
    } else if (pathname === '/watermark-remover') {
      fileSegment = 'watermark-remover.html';
    }
    
    let filePath = path.join(__dirname, fileSegment);
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg') contentType = 'image/jpeg';
    else if (ext === '.ico') contentType = 'image/x-icon';
    else if (ext === '.wasm') contentType = 'application/wasm';
    else if (ext === '.json') contentType = 'application/json';

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
