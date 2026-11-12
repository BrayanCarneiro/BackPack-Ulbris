// Export generated sources as small transparent game assets: node scripts/prepare-item-art.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'item-art-browser-'));
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=9243', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9243/json/list')).json()).find(p => p.type === 'page'); } catch {}
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Edge did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.id) {
      const callback = pending.get(message.id);
      if (!callback) return;
      pending.delete(message.id);
      message.error ? callback.reject(message.error) : callback.resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await send('Page.bringToFront');

  const { readFile, mkdir, stat } = await import('node:fs/promises');
  await mkdir('public/assets/items', { recursive: true });
  const { itemArt } = await import('../src/data/itemArt.js');
  const selected = process.argv.slice(2);
  for (const id of Object.keys(itemArt).filter(id => !selected.length || selected.includes(id))) {
    const maxEdge = ({ sword: 512, 'iron-sword': 512, 'leather-chestplate': 384, 'traveler-bag': 512, 'long-bag': 640,
      'vampiric-chestplate': 512, 'golden-crystal': 256,
      'iron-armor': 384, bow: 384, 'battle-axe': 384, 'flaming-daggers': 384, 'regeneration-potion': 256,
      'quick-daggers': 384, potion: 128, 'refined-iron': 128 })[id] ?? 256;
    const source = await readFile(`docs/art/items/${id}-source.png`);
    const result = await evaluate(`(async () => {
      const img = new Image(); img.src = ${JSON.stringify('data:image/png;base64,' + source.toString('base64'))}; await img.decode();
      const source = document.createElement('canvas'); source.width = img.width; source.height = img.height;
      const context = source.getContext('2d'); context.drawImage(img, 0, 0);
      const pixels = context.getImageData(0, 0, img.width, img.height).data;
      let left = img.width, top = img.height, right = -1, bottom = -1;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (pixels[(y * img.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
      const ratio = Math.min(1, ${maxEdge} / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(cropWidth * ratio); canvas.height = Math.round(cropHeight * ratio);
      const output = canvas.getContext('2d'); output.imageSmoothingQuality = 'high';
      output.drawImage(img, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      return { width: canvas.width, height: canvas.height, webp: canvas.toDataURL('image/webp', 0.94), png: canvas.toDataURL('image/png') };
    })()`);
    assert.ok(result.webp.startsWith('data:image/webp;'), 'WebP encoding supported');
    for (const format of ['webp', 'png']) await writeFile(`public/assets/items/${id}.${format}`, Buffer.from(result[format].split(',')[1], 'base64'));
    console.log(JSON.stringify({ id, width: result.width, height: result.height, bytes: (await stat(`public/assets/items/${id}.webp`)).size }));
  }
} finally { socket?.close(); browser.kill(); }
