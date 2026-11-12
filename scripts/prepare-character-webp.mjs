// Re-encode character PNGs without changing dimensions, frames or transparency.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'character-webp-'));
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9252',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9252/json/list')).json()).find(p => p.type === 'page'); } catch {}
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Edge started');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    message.error ? callback.reject(message.error) : callback.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  const directory = 'public/assets/characters/arthur';
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.png'))) {
    const source = await readFile(join(directory, file));
    const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const image = new Image(); image.src = ${JSON.stringify('data:image/png;base64,' + source.toString('base64'))};
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return {width:image.width, height:image.height, data:canvas.toDataURL('image/webp', 0.9)};
    })()` });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    const { data, width, height } = result.result.value;
    assert.ok(data.startsWith('data:image/webp;'), 'WebP encoder available');
    const encoded = Buffer.from(data.split(',')[1], 'base64');
    await writeFile(join(directory, file.replace(/\.png$/, '.webp')), encoded);
    console.log(JSON.stringify({file, width, height, png:source.length, webp:encoded.length}));
  }
} finally { socket?.close(); browser.kill(); }
