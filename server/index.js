import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createAccounts } from './accounts.js';
import { defaultDatabasePath } from './paths.js';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function createAppServer({ databasePath = defaultDatabasePath(),
  distPath = fileURLToPath(new URL('../dist/', import.meta.url)), ...options } = {}) {
  const accounts = createAccounts({ databasePath, ...options });
  const root = resolve(distPath);
  const inside = path => { const sub = relative(root, path); return !sub.startsWith('..') && !isAbsolute(sub); };
  const server = createServer(async (req, res) => {
    try {
      if (await accounts.handle(req, res)) return;
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = await realpath(resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`));
      if (!inside(file) || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end();
      else await pipeline(createReadStream(file), res);
    } catch {
      if (!res.headersSent) res.writeHead(404).end('Não encontrado.');
      else res.destroy();
    }
  });
  server.requestTimeout = 15000;
  server.on('close', () => accounts.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4173);
  const server = createAppServer();
  server.listen(port, host, () => console.log(`Ulbris: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
