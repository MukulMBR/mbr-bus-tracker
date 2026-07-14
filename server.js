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
    if (!videoUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url parameter');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="downloaded_video.mp4"',
      'Access-Control-Allow-Origin': '*'
    });

    const { spawn } = require('child_process');
    let child;
    try {
      child = spawn(ytdlpPath, ['-o', '-', videoUrl]);
    } catch (err) {
      console.error('Failed to spawn child process:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to spawn video downloader');
      return;
    }

    child.on('error', (err) => {
      console.error('yt-dlp process error:', err);
    });

    child.stdout.pipe(res);

    child.stderr.on('data', (data) => {
      console.error(`yt-dlp stderr: ${data}`);
    });

    child.on('close', (code) => {
      console.log(`yt-dlp process exited with code ${code}`);
      res.end();
    });

    req.on('close', () => {
      child.kill();
    });
  } else {
    // Serve static files
    let fileSegment = pathname;
    if (pathname === '/') {
      fileSegment = 'index.html';
    } else if (pathname === '/editor') {
      fileSegment = 'editor.html';
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
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`MBR Bus Telemetry Server running at http://localhost:${PORT}`);
});
