const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3050;

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
      'Referer': 'https://trkg.in/customer/track/' + urlObj.searchParams.get('key'),
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
    const key = parsedUrl.searchParams.get('key');
    proxyRequest(`https://trkg.in/api/live/journey_details?key=${key}&zoom_position=12&platform=mobile`, res);
  } else if (pathname === '/api/track-eta') {
    const key = parsedUrl.searchParams.get('key');
    proxyRequest(`https://trkg.in/api/live/eta_map?current_status=true&key=${key}`, res);
  } else if (pathname === '/api/send-whatsapp') {
    const phone = parsedUrl.searchParams.get('phone');
    const apikey = parsedUrl.searchParams.get('apikey');
    const text = parsedUrl.searchParams.get('text');
    proxyRequest(`https://api.callmebot.com/whatsapp.php?phone=${phone}&apikey=${apikey}&text=${encodeURIComponent(text)}`, res);
  } else {
    // Serve static files
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
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
