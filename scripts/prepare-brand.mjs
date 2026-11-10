// Run with Vite running: node scripts/smoke-preparation.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'brand-browser-'));
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=9238', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9238/json/list')).json()).find(p => p.type === 'page'); } catch {}
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

  const {readFile,readdir,mkdir,stat}=await import('node:fs/promises');
  const originalName=(await readdir('docs/brand')).find(name=>name.startsWith('Logo medieval')&&name.endsWith('.png'));
  const original=originalName ? `docs/brand/${originalName}` : null;
  assert.ok(original,'Logo source not found');
  const sourceImage=await readFile(original);
  const result=await evaluate(`(async()=>{
    const img=new Image();img.src=${JSON.stringify('data:image/png;base64,'+sourceImage.toString('base64'))};await img.decode();
    const source=document.createElement('canvas');source.width=img.width;source.height=img.height;
    const context=source.getContext('2d');context.drawImage(img,0,0);
    const pixels=context.getImageData(0,0,img.width,img.height).data;
    let left=img.width,top=img.height,right=-1,bottom=-1;
    for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++)if(pixels[(y*img.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const cropWidth=right-left+1,cropHeight=bottom-top+1;
    const canvas=document.createElement('canvas');canvas.width=Math.min(900,cropWidth);canvas.height=Math.round(canvas.width*cropHeight/cropWidth);
    canvas.getContext('2d').drawImage(img,left,top,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
    return {source:[img.width,img.height],crop:[left,top,cropWidth,cropHeight],width:canvas.width,height:canvas.height,webp:canvas.toDataURL('image/webp',0.94),png:canvas.toDataURL('image/png')};
  })()`);
  await mkdir('public/assets/brand',{recursive:true});
  for(const format of ['webp','png'])await writeFile('public/assets/brand/ulbris-logo.'+format,Buffer.from(result[format].split(',')[1],'base64'));
  console.log(JSON.stringify({source:result.source,crop:result.crop,size:[result.width,result.height],originalBytes:sourceImage.length,webpBytes:(await stat('public/assets/brand/ulbris-logo.webp')).size,pngBytes:(await stat('public/assets/brand/ulbris-logo.png')).size}));
}finally{socket?.close();browser.kill();}
