// Neon Tide Cover Studio — a tiny static server for trying the app.
//
// Serves the files under app/ at http://localhost:8080 with the content
// types a browser needs for HTML, CSS, ES modules and images. Nothing
// leaves the machine; it exists only so the editor can be opened over
// http (module scripts do not load from file:// in every browser).
//
//   node serve.ts

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), 'app');
const port = Number(process.env.PORT ?? 8080);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const file = join(appDir, rel === '' ? 'index.html' : rel);
    if (!file.startsWith(appDir)) throw new Error('outside app/');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Neon Tide Cover Studio at http://localhost:${port}`);
});
