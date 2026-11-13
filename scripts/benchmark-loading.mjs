// Compare the same real-click flow before/after loading changes. New profile per run.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const url = arg('url') ?? 'http://127.0.0.1:4173/';
const thinkMs = Number(arg('think') ?? 10000);
const output = await mkdtemp(join(tmpdir(), 'loading-benchmark-'));
const report = {label:arg('label'),url,thinkMs,slow:process.argv.includes('--slow'),errors:[]};
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9254',`--user-data-dir=${join(output,'profile')}`,'about:blank',
], {windowsHide:true,stdio:'ignore'});
let socket;
try {
  let page;
  for(let i=0;i<100&&!page;i++) {
    try { page=(await(await fetch('http://127.0.0.1:9254/json/list')).json()).find(p=>p.type==='page'); } catch {}
    if(!page) await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(page,'Edge started'); socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0; const pending=new Map();
  socket.onmessage=({data})=>{
    const message=JSON.parse(data);
    if(message.method==='Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails);
    if(!message.id)return;
    const callback=pending.get(message.id); if(!callback)return;
    pending.delete(message.id);clearTimeout(callback.timer);
    message.error?callback.reject(message.error):callback.resolve(message.result);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++serial,timer=setTimeout(()=>reject(new Error(`Timeout: ${method}`)),40000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
  };
  const wait=async expression=>{
    for(let i=0;i<600;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}
    assert.fail('Timed out: '+expression);
  };
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  if(process.argv.includes('--blocked-engine')) await send('Network.setBlockedURLs',{urls:['*assets/engine-*.js','*assets/main-*.js']});
  const width=Number(arg('width')??390),height=Number(arg('height')??844);
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
  if(report.slow){
    await send('Emulation.setCPUThrottlingRate',{rate:4});
    await send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:400000,uploadThroughput:100000});
  }
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    let namespace;
    Object.defineProperty(globalThis,'Phaser',{configurable:true,get:()=>namespace,set:value=>{
      namespace=value;const Game=value.Game;value.Game=class extends Game{constructor(config){super(config);window.benchGame=this;}};
    }});
  `});
  await send('Page.bringToFront');await send('Page.navigate',{url});
  await wait(`Boolean(window.ulbris?.menuReady || window.benchGame?.scene.isActive('MenuScene'))`);
  report.menu=await evaluate(`({ms:performance.now(),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.decodedBodySize,encoded:r.encodedBodySize,duration:r.duration}))})`);
  if(process.argv.includes('--screenshot')) {
    await wait(`document.querySelector('#front-logo')?.complete || window.benchGame?.scene.isActive('MenuScene')`);
    const shot=await send('Page.captureScreenshot',{format:'png'});
    report.menuScreenshot=join(output,'menu.png');await writeFile(report.menuScreenshot,Buffer.from(shot.data,'base64'));
  }
  const tap=async (sceneKey,label,selector)=>{
    const point=await evaluate(`(()=>{
      const element=document.querySelector(${JSON.stringify(selector)});
      if(element&&!document.querySelector('#front-menu')?.hidden){const r=element.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}
      const scene=benchGame.scene.getScene(${JSON.stringify(sceneKey)}),button=scene.children.list.find(o=>o.list?.some(c=>c.text===${JSON.stringify(label)}));
      if(!button)throw new Error('Missing '+${JSON.stringify(label)});
      const r=benchGame.canvas.getBoundingClientRect();return{x:r.x+(button.x-scene.cameras.main.scrollX)*r.width/benchGame.scale.width,y:r.y+(button.y-scene.cameras.main.scrollY)*r.height/benchGame.scale.height};
    })()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await new Promise(resolve=>setTimeout(resolve,60));
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  await tap('MenuScene','Iniciar','[data-action="start"]');
  await wait(`document.querySelector('#front-menu')?.dataset.screen==='lobby' || window.benchGame?.scene.isActive('LobbyScene')`);
  if(process.argv.includes('--blocked-engine')) {
    await tap('LobbyScene','Voltar','[data-action="back"]');
    await wait(`document.querySelector('#front-menu').dataset.screen==='home'`);
    assert.ok(await evaluate('!window.benchGame'),'Menu works without starting Phaser');
    report.nativeWithoutEngine=true;
  } else {
  const playAt=await evaluate('performance.now()');
  await tap('LobbyScene','Play','[data-action="play"]');
  await wait(`Boolean(window.benchGame?.scene.isActive('CharacterSelectScene') && benchGame.scene.getScene('CharacterSelectScene').assetsReady)`);
  report.selectionFromClickMs=(await evaluate('performance.now()'))-playAt;
  const selectAt=await evaluate('performance.now()');
  await tap('CharacterSelectScene','SELECIONAR','[data-no-dom-button]');
  await wait(`benchGame.scene.isActive('ShopScene') && benchGame.scene.getScene('ShopScene').assetsReady`);
  report.shopFromNavigationMs=await evaluate('performance.now()');report.shopFromClickMs=report.shopFromNavigationMs-selectAt;
  await evaluate(`(()=>{
    const shop=benchGame.scene.getScene('ShopScene'),session=shop.session;
    for(const id of ['traveler-bag','sword']){const error=session.buy(id);if(error)throw new Error(error);}
    for(const [kind,id] of [['bag','traveler-bag'],['item','sword']]){const error=session.board.move(kind,id,0,0);if(error)throw new Error(error);}
    shop.boardView.refresh();shop.refreshStock();
  })()`);
  await new Promise(resolve=>setTimeout(resolve,thinkMs));
  report.beforeBattle=await evaluate(`({ms:performance.now(),warmupReady:benchGame.registry.get('battleWarmupReady'),warmupError:benchGame.registry.get('battleWarmupError'),textures:benchGame.textures.getTextureKeys().filter(k=>k.startsWith('arthur-')),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.decodedBodySize,encoded:r.encodedBodySize,duration:r.duration}))})`);
  const battleAt=await evaluate('performance.now()');
  await tap('ShopScene','Batalhar','[data-no-dom-button]');
  await wait(`benchGame.scene.isActive('BattleScene') && benchGame.scene.getScene('BattleScene').assetsReady && Boolean(benchGame.scene.getScene('BattleScene').combat)`);
  report.battleFromClickMs=(await evaluate('performance.now()'))-battleAt;
  await new Promise(resolve=>setTimeout(resolve,150));
  report.afterBattle=await evaluate(`({ms:performance.now(),renderer:benchGame.renderer.gl?'WebGL':'Canvas',resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.decodedBodySize,encoded:r.encodedBodySize,duration:r.duration}))})`);
  const urls=report.afterBattle.resources.filter(r=>/\/arthur\/(battle-|attack-)/.test(r.url)).map(r=>r.url);
  assert.equal(new Set(urls).size,urls.length,'No duplicate background/foreground battle downloads');
  assert.ok(!report.beforeBattle.warmupError,'Background preparation did not fail');
  }
  assert.equal(report.errors.length,0,'No browser errors');
} finally {
  await writeFile(arg('output')??join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({output,menuMs:report.menu?.ms,menuBytes:report.menu?.resources.reduce((s,r)=>s+r.bytes,0),selectionMs:report.selectionFromClickMs,shopMs:report.shopFromClickMs,shopFromNavigationMs:report.shopFromNavigationMs,battleMs:report.battleFromClickMs,errors:report.errors.length}));
  socket?.close();browser.kill();
}
