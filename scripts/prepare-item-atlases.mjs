// Pack existing art without rescaling, rotating or trimming its source frames.
// Requires Edge (EDGE_PATH may override the default executable).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { itemArt } from '../src/data/itemArt.js';
import { allItems } from '../src/data/shopCatalog.js';

const border = 4; // 2 extruded pixels plus 2 transparent pixels between frames.
const groups = new Map();
for (const [id, art] of Object.entries(itemArt)) {
  const item = allItems.find(item => item.id === id);
  assert.ok(item, `Catalog definition missing: ${id}`);
  const pool = item.pool ?? 'general';
  assert.match(pool, /^[a-z0-9-]+$/);
  const bytes = await readFile(`public/assets/items/${art.file}.png`);
  const image = { id, name: item.name, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
    source: `data:image/png;base64,${bytes.toString('base64')}` };
  if (!groups.has(pool)) groups.set(pool, []);
  groups.get(pool).push(image);
}

function pack(images) {
  let best;
  const minimumArea = images.reduce((sum, image) => sum + (image.width + border * 2) * (image.height + border * 2), 0);
  const sorts = [
    (a, b) => b.width * b.height - a.width * a.height,
    (a, b) => b.height - a.height || b.width - a.width,
    (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
  ];
  // MaxRects: split empty rectangles around each placed image, then remove
  // contained spaces. Try several bins/orders to avoid large unused GPU areas.
  for (const maxWidth of [768, 1024, 1280, 1536, 1792, 2048]) for (const maxHeight of [1024, 1280, 1536, 1792, 2048]) {
    if (maxWidth * maxHeight < minimumArea) continue;
    for (const sort of sorts) {
      const sorted = [...images].sort((a, b) => sort(a, b) || a.id.localeCompare(b.id));
      let free = [{ x: 0, y: 0, w: maxWidth, h: maxHeight }];
      const frames = [];
      for (const image of sorted) {
        const w = image.width + border * 2, h = image.height + border * 2;
        const spaces = free.filter(r => r.w >= w && r.h >= h).sort((a, b) =>
          Math.min(a.w-w,a.h-h) - Math.min(b.w-w,b.h-h) || Math.max(a.w-w,a.h-h) - Math.max(b.w-w,b.h-h));
        if (!spaces.length) break;
        const placed = { x: spaces[0].x, y: spaces[0].y, w, h };
        frames.push({ id: image.id, x: placed.x + border, y: placed.y + border, w: image.width, h: image.height });
        const next = [];
        for (const r of free) {
          if (placed.x >= r.x+r.w || placed.x+w <= r.x || placed.y >= r.y+r.h || placed.y+h <= r.y) { next.push(r); continue; }
          if (placed.x > r.x) next.push({x:r.x,y:r.y,w:placed.x-r.x,h:r.h});
          if (placed.x+w < r.x+r.w) next.push({x:placed.x+w,y:r.y,w:r.x+r.w-placed.x-w,h:r.h});
          if (placed.y > r.y) next.push({x:r.x,y:r.y,w:r.w,h:placed.y-r.y});
          if (placed.y+h < r.y+r.h) next.push({x:r.x,y:placed.y+h,w:r.w,h:r.y+r.h-placed.y-h});
        }
        free = next.filter((r, i) => !next.some((other, j) => i !== j && r.x >= other.x && r.y >= other.y
          && r.x+r.w <= other.x+other.w && r.y+r.h <= other.y+other.h
          && (r.x !== other.x || r.y !== other.y || r.w !== other.w || r.h !== other.h || j < i)));
      }
      if (frames.length !== images.length) continue;
      const width = Math.ceil(Math.max(...frames.map(frame => frame.x+frame.w+border)) / 4) * 4;
      const height = Math.ceil(Math.max(...frames.map(frame => frame.y+frame.h+border)) / 4) * 4;
      const area = width * height;
      if (!best || area < best.area) best = { width, height, area, frames };
    }
  }
  assert.ok(best, 'Atlas exceeds 2048 px; split this item pool into multiple pages before adding more art');
  return best;
}

const output = await mkdtemp(join(tmpdir(), 'item-atlases-'));
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9253',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9253/json/list')).json()).find(p => p.type === 'page'); } catch {}
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
  await mkdir('public/assets/atlases', { recursive: true });
  const imports = [], entries = [];
  for (const [pool, images] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const packed = pack(images), key = `items-${pool}`;
    const atlas = { frames: Object.fromEntries(packed.frames.map(({ id, x, y, w, h }) => [id, {
      frame: { x, y, w, h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h },
    }])), meta: { image: `${key}.webp`, format: 'RGBA8888', size: { w: packed.width, h: packed.height }, scale: '1' } };
    const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const entries = ${JSON.stringify(images)}, packed = ${JSON.stringify(packed)};
      const canvas = document.createElement('canvas'); canvas.width = packed.width; canvas.height = packed.height;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
      const sources = new Map();
      for (const entry of entries) {
        const image = new Image(); image.src = entry.source; await image.decode(); sources.set(entry.id, image);
        const {x,y,w,h} = packed.frames.find(frame => frame.id === entry.id);
        context.drawImage(image, x, y);
        // Extend edge pixels outside the frame to avoid sampling neighboring art.
        context.drawImage(image, 0, 0, w, 1, x, y-2, w, 2);
        context.drawImage(image, 0, h-1, w, 1, x, y+h, w, 2);
        context.drawImage(image, 0, 0, 1, h, x-2, y, 2, h);
        context.drawImage(image, w-1, 0, 1, h, x+w, y, 2, h);
        for(const [sx,dx] of [[0,x-2],[w-1,x+w]]) for(const [sy,dy] of [[0,y-2],[h-1,y+h]]) context.drawImage(image,sx,sy,1,1,dx,dy,2,2);
      }
      const preview = document.createElement('canvas'); preview.width = 1440; preview.height = 90 + Math.ceil(entries.length/8)*190;
      const ctx = preview.getContext('2d'); ctx.fillStyle='#101f24'; ctx.fillRect(0,0,preview.width,preview.height);
      ctx.fillStyle='#e7d3a9'; ctx.font='bold 28px Arial'; ctx.fillText('ITENS — ${pool === 'general' ? 'GERAIS' : pool.toUpperCase()} | '+entries.length+' recortes de uma textura',24,42);
      ctx.font='16px Arial'; ctx.fillStyle='#b9c6ce'; ctx.fillText('Prévia para consulta • o jogo usa o atlas transparente, sem títulos ou cartões',24,69);
      entries.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).forEach((entry,i)=>{
        const x=(i%8)*180, y=90+Math.floor(i/8)*190;
        ctx.fillStyle='#1d3339'; ctx.fillRect(x+6,y+6,168,178);
        const ratio=Math.min(136/entry.width,132/entry.height);
        ctx.drawImage(sources.get(entry.id),x+90-entry.width*ratio/2,y+77-entry.height*ratio/2,entry.width*ratio,entry.height*ratio);
        ctx.font='14px Arial'; ctx.fillStyle='#e7d3a9'; ctx.textAlign='center';
        const words=entry.name.split(' '); let line='', lines=[];
        for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>158&&line){lines.push(line);line=word;}else line=next;}lines.push(line);
        lines.forEach((line,n)=>ctx.fillText(line,x+90,y+155+n*17)); ctx.textAlign='left';
      });
      return { webp: canvas.toDataURL('image/webp', 0.94), png: canvas.toDataURL('image/png'), preview: preview.toDataURL('image/png') };
    })()` });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    const encoded = result.result.value;
    assert.ok(encoded.webp.startsWith('data:image/webp;'));
    for (const format of ['png', 'webp']) await writeFile(`public/assets/atlases/${key}.${format}`, Buffer.from(encoded[format].split(',')[1], 'base64'));
    await writeFile(`public/assets/atlases/${key}.json`, JSON.stringify(atlas, null, 2) + '\n');
    await writeFile(`docs/art/items/${key}-preview.png`, Buffer.from(encoded.preview.split(',')[1], 'base64'));
    imports.push(`import atlas${imports.length} from '../../public/assets/atlases/${key}.json' with { type: 'json' };`);
    entries.push(`  { key: '${key}', pool: '${pool}', path: 'atlases/${key}.png', atlas: atlas${entries.length} },`);
    console.log(JSON.stringify({ pool, items: images.length, width: packed.width, height: packed.height,
      webpBytes: Buffer.from(encoded.webp.split(',')[1], 'base64').length }));
  }
  await writeFile('src/data/itemAtlases.js', '// Generated by scripts/prepare-item-atlases.mjs. Metadata is bundled; only the atlas image needs a request.\n' + imports.join('\n') + '\n\nexport const itemAtlases = [\n' + entries.join('\n') + '\n];\n');
} finally { socket?.close(); browser.kill(); }
