#!/usr/bin/env node
/**
 * ScentWise — Lightweight Local Dev Server
 * Serves static files from /public and routes /api/* to serverless functions.
 * No Vercel CLI needed.
 *
 * Usage: node scripts/dev-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (val && !process.env[key]) process.env[key] = val;
    }
  });
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const API_DIR = path.join(__dirname, '..', 'api');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(body || {}); }
    });
    req.on('error', () => resolve({}));
  });
}

// Minimal response object to mimic Vercel's API
function makeRes(httpRes) {
  const res = {
    _status: 200,
    _headers: {},
    _sent: false,
    statusCode: 200,
    status(code) { res._status = code; res.statusCode = code; return res; },
    setHeader(key, val) { res._headers[key] = val; return res; },
    getHeader(key) { return res._headers[key]; },
    json(data) {
      if (res._sent) return res;
      res._sent = true;
      const body = JSON.stringify(data);
      httpRes.writeHead(res._status, {
        ...res._headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      httpRes.end(body);
      return res;
    },
    send(data) {
      if (res._sent) return res;
      res._sent = true;
      httpRes.writeHead(res._status, res._headers);
      httpRes.end(data);
      return res;
    },
    redirect(location) {
      if (res._sent) return res;
      res._sent = true;
      httpRes.writeHead(302, { ...res._headers, Location: location });
      httpRes.end();
      return res;
    },
    end(data) {
      if (res._sent) return;
      res._sent = true;
      httpRes.writeHead(res._status, res._headers);
      httpRes.end(data);
    }
  };
  return res;
}

const server = http.createServer(async (req, httpRes) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    httpRes.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    });
    return httpRes.end();
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').replace(/\/$/, '');
    const apiFile = path.join(API_DIR, apiName + '.js');

    if (!fs.existsSync(apiFile)) {
      httpRes.writeHead(404, { 'Content-Type': 'application/json' });
      return httpRes.end(JSON.stringify({ error: `API endpoint not found: ${apiName}` }));
    }

    try {
      // Clear require cache for hot reload
      delete require.cache[require.resolve(apiFile)];
      const handler = require(apiFile);

      // Parse body for POST requests
      const body = req.method === 'POST' ? await parseBody(req) : {};

      // Build request object
      const apiReq = {
        method: req.method,
        url: req.url,
        headers: {
          ...req.headers,
          'x-real-ip': req.socket.remoteAddress || '127.0.0.1',
          'x-requested-with': req.headers['x-requested-with'] || '',
          origin: req.headers.origin || `http://localhost:${PORT}`,
          referer: req.headers.referer || `http://localhost:${PORT}/`,
        },
        query: parsed.query,
        body,
        socket: req.socket,
      };

      const res = makeRes(httpRes);

      // Handle Edge runtime (og.js)
      if (handler.config?.runtime === 'edge') {
        httpRes.writeHead(200, { 'Content-Type': 'text/plain' });
        return httpRes.end('OG image generation requires Vercel Edge Runtime. Use `npx vercel dev` for this endpoint.');
      }

      await handler(apiReq, res);

      // If handler didn't send a response
      if (!res._sent) {
        httpRes.writeHead(204);
        httpRes.end();
      }
    } catch (err) {
      console.error(`API error [${apiName}]:`, err.message);
      if (!httpRes.headersSent) {
        httpRes.writeHead(500, { 'Content-Type': 'application/json' });
        httpRes.end(JSON.stringify({ error: 'Internal server error', detail: err.message }));
      }
    }
    return;
  }

  // Static files
  let filePath = pathname;
  if (filePath === '/') filePath = '/index.html';
  if (filePath.endsWith('/')) filePath += 'index.html';

  const fullPath = path.join(PUBLIC_DIR, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    httpRes.writeHead(403);
    return httpRes.end('Forbidden');
  }

  if (!fs.existsSync(fullPath)) {
    // Try with .html extension
    const withHtml = fullPath + '.html';
    if (fs.existsSync(withHtml)) {
      const content = fs.readFileSync(withHtml);
      httpRes.writeHead(200, { 'Content-Type': 'text/html' });
      return httpRes.end(content);
    }
    // 404 page
    const page404 = path.join(PUBLIC_DIR, '404.html');
    if (fs.existsSync(page404)) {
      const content = fs.readFileSync(page404);
      httpRes.writeHead(404, { 'Content-Type': 'text/html' });
      return httpRes.end(content);
    }
    httpRes.writeHead(404, { 'Content-Type': 'text/plain' });
    return httpRes.end('Not Found');
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    const indexPath = path.join(fullPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      httpRes.writeHead(200, { 'Content-Type': 'text/html' });
      return httpRes.end(content);
    }
    httpRes.writeHead(404);
    return httpRes.end('Not Found');
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(fullPath);
  httpRes.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
  });
  httpRes.end(content);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  \x1b[1m\x1b[32m✓ ScentWise Dev Server running\x1b[0m');
  console.log('');
  console.log(`  \x1b[1mLocal:\x1b[0m   http://localhost:${PORT}`);
  console.log(`  \x1b[1mAPI:\x1b[0m     http://localhost:${PORT}/api/*`);
  console.log('');
  console.log('  \x1b[2mEnv loaded from .env\x1b[0m');
  console.log(`  \x1b[2mGemini:  ${process.env.GEMINI_API_KEY ? '✓ configured' : '✕ missing — AI features won\'t work'}\x1b[0m`);
  console.log(`  \x1b[2mRedis:   ${process.env.UPSTASH_REDIS_REST_URL ? '✓ configured' : '✕ using in-memory fallback'}\x1b[0m`);
  console.log('');
  console.log('  \x1b[2mPress Ctrl+C to stop\x1b[0m');
  console.log('');
});
