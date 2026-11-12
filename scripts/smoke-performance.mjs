// With Vite: node scripts/smoke-performance.mjs; built preview: add --production.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'performance-browser-'));
const production = process.argv.includes('--production');
const canvasOnly = process.argv.includes('--canvas');
const slow = process.argv.includes('--slow');
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=9237', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9237/json/list')).json()).find(p => p.type === 'page'); } catch {}
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Edge did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  const responses = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Network.responseReceived') responses.push(message.params.response);
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
  if (slow) {
    await send('Emulation.setHardwareConcurrencyOverride', { hardwareConcurrency: 4 });
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  if (process.argv.includes('--png')) {
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['*ulbris-logo.webp'] });
  }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{
    let namespace;
    Object.defineProperty(globalThis,'Phaser',{configurable:true,get:()=>namespace,set:value=>{
      namespace=value;const Game=value.Game;
      value.Game=class extends Game {constructor(config){super(config);globalThis.__testGame=this;}};
    }});
    if(${canvasOnly}){
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:getContext.call(this,type,...args);};
    }
    if(${slow})Object.defineProperty(navigator,'deviceMemory',{get:()=>4});
  })()` });
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await send('Page.bringToFront');
  await send('Page.navigate', { url: production ? 'http://127.0.0.1:4173/' : 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.smokeGame = await window.ulbris.enterGame('MenuScene');
    if(document.querySelectorAll('canvas').length!==1) throw new Error('Expected one game canvas');
    window.smokeWait = async () => {
      for(let i=0;i<2;i++) await new Promise(requestAnimationFrame);
      const started=performance.now();
      while(smokeGame.scene.getScenes(false).some(scene=>scene.load?.isLoading()||(scene.sys.isActive()&&scene.assetsReady===false))){
        if(performance.now()-started>25000)throw new Error('Timed out loading scene');
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      for(let i=0;i<3;i++) await new Promise(requestAnimationFrame);
      smokeGame.step(performance.now(),16);
    };
    window.smokeStart = async (key,data) => {
      for(const scene of smokeGame.scene.getScenes(false)) smokeGame.scene.stop(scene.scene.key);
      smokeGame.scene.start(key,data); await smokeWait();
      return smokeGame.scene.getScene(key);
    };
    window.smokeAssert = (condition,message) => { if(!condition) throw new Error(message); };
    window.smokeTap = object => { object.emit('pointerdown',{id:1}); object.emit('pointerup',{id:1}); };
    window.smokeAdvanceBattle = (battle,ms) => {
      const clock=battle.battleClock;
      try { battle.battleClock={tick:()=>ms}; battle.update(); }
      finally { battle.battleClock=clock; }
    };
    await smokeWait();
  })()`);


  await evaluate(`(async()=>{for(let i=0;i<100&&!smokeGame.scene.isActive('MenuScene');i++)await new Promise(r=>setTimeout(r,25));smokeAssert(smokeGame.scene.isActive('MenuScene'),'home loaded');smokeAssert(smokeGame.textures.exists('ulbris-logo'),'logo loaded');})()`);
  for(const sceneKey of ['MenuScene','LobbyScene']){
    await evaluate(`(async()=>{await smokeStart(${JSON.stringify(sceneKey)});return true;})()`);
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,sceneKey+'.png'),Buffer.from(shot.data,'base64'));
  }
  const result=await evaluate(`(async()=>{
    const sessionScene=smokeGame.scene.getScene('ShopScene');await smokeStart('ShopScene');const ShoppingSession=sessionScene.session.constructor;
    const catalogScene=await smokeStart('ItemCatalogScene');const first=smokeGame.scene.getScene('ItemInfoScene');const allItems=[];for(let page=0;page<3;page++){catalogScene.page=page;catalogScene.renderCatalog();const zones=catalogScene.children.list.filter(o=>o.type==='Zone');for(const zone of zones){smokeTap(zone);await smokeWait();if(smokeGame.scene.isActive('ItemInfoScene')){allItems.push(smokeGame.scene.getScene('ItemInfoScene').details.piece);smokeGame.scene.getScene('ItemInfoScene').close();await smokeWait();}}}
    const session=new ShoppingSession();session.gold=100;
    let scene=await smokeStart('ShopScene',{session});
    const cards=[...scene.offersLayer.list];
    smokeTap(cards[0].buyButton);smokeAssert(scene.offersLayer.list.every((card,i)=>card===cards[i]),'purchase reuses six cards');
    smokeTap(cards[1].buyButton);smokeTap(cards[2].lockButton);smokeAssert(scene.offersLayer.list[2]===cards[2],'lock reuses cards');
    session.gold=0;scene.refreshStock();smokeAssert(!cards[4].buyButton.input.enabled,'unaffordable state');
    session.gold=100;scene.refreshStock();smokeAssert(cards[4].buyButton.input.enabled,'affordability restored');
    session.board.move('bag','traveler-bag',0,0);session.board.move('item','sword',0,0);
    const battle=await smokeStart('BattleScene',{session});
    for(const fighter of Object.values(battle.combat.fighters)){fighter.maxHealth=10000;fighter.health=10000;}
    const art=battle.characters.player.art;
    for(let i=0;i<10;i++)battle.relayout();smokeAssert(battle.characters.player.art===art,'unchanged viewport reuses arena');
    let uiRefreshes=0;const refresh=battle.refreshCombat.bind(battle);battle.refreshCombat=()=>{uiRefreshes++;refresh();};
    const beforeTime=battle.combat.elapsedMs+battle.combat.accumulator;
    for(let i=0;i<120;i++){battle.battleClock={tick:()=>1000/60};battle.update();}
    smokeAssert(Math.abs(battle.combat.elapsedMs+battle.combat.accumulator-beforeTime-2000)<0.000001,'simulation keeps exact time');
    smokeAssert(uiRefreshes<85,'HUD avoids per-frame redraw');
    const time=Math.round(battle.combat.elapsedMs+battle.combat.accumulator-beforeTime);
    for(let i=0;i<3;i++){smokeTap(battle.speedButton);}
    const legend=battle.backpacks.player.legend.text;
    for(const item of allItems){const info=await smokeStart('ItemInfoScene',{item,sourceKey:'ShopScene'});smokeAssert(info.contentBottom<1080,'item information fits: '+item.id);}
    return {renderer:smokeGame.renderer.gl?'WebGL':'Canvas',uiRefreshes,simulatedMs:time,items:allItems.length,preFXDisabled:smokeGame.config.disablePreFX,postFXDisabled:smokeGame.config.disablePostFX};
  })()`);
  assert.deepEqual(errors,[],'Browser runtime errors');
  assert.equal(result.items, 34, 'All current items were reviewed');
  if (canvasOnly) assert.equal(result.renderer, 'Canvas');
  if (slow) assert.equal(result.postFXDisabled, true);
  if (process.argv.includes('--png')) assert.ok(responses.some(response=>response.url.endsWith('/ulbris-logo.png')&&response.status===200), 'PNG logo fallback loaded');
  console.log(JSON.stringify({passed:true,production,slow,pngFallback:process.argv.includes('--png'),result,screenshots:output}));
}finally{socket?.close();browser.kill();}
