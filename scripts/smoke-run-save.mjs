// Run with Vite running: node scripts/smoke-preparation.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'run-save-browser-'));
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debugPort = process.env.RUN_SAVE_DEBUG_PORT ?? 9245;
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(output, 'profile')}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json())
      .find(p => p.type === 'page' && p.url === 'about:blank'); } catch {}
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
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))').catch(()=>false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.smokeGame = (await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    for(let i=0;i<200&&!document.querySelector('canvas');i++) await new Promise(resolve=>setTimeout(resolve,50));
    if(document.querySelectorAll('canvas').length!==1) throw new Error('Expected one game canvas, found '+document.querySelectorAll('canvas').length);
    window.smokeWait = async () => {
      for(let i=0;i<2;i++) await new Promise(requestAnimationFrame);
      const started = performance.now();
      while (smokeGame.scene.getScenes(false).some(scene => scene.load?.isLoading() || (scene.sys.isActive() && scene.assetsReady === false))) {
        if (performance.now() - started > 20000) throw new Error('Timed out loading scene assets');
        await new Promise(resolve => setTimeout(resolve, 20));
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

  const coordinates=expression=>evaluate(`(()=>{const point=${expression};const rect=document.querySelector('canvas').getBoundingClientRect();return {x:rect.x+point.x*rect.width/smokeGame.scale.width,y:rect.y+point.y*rect.height/smokeGame.scale.height};})()`);
  const tap=async(expression,touch=false)=>{
    const point=await coordinates(expression);
    if(touch){
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }else{
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    }
    await evaluate('smokeWait()');
  };
  const drag=async(id,destination,touch=false)=>{
    const from=await coordinates(`prep.boardView.views.find(v=>v.piece.id===${JSON.stringify(id)}).object`);
    const to=await coordinates(destination);
    if(touch)await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
    else await send('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',clickCount:1});
    await evaluate('smokeWait()');
    const same=Math.hypot(to.x-from.x,to.y-from.y)<1;
    for(let i=1;i<=6;i++){
      const point={x:from.x+(to.x-from.x)*i/6+(same&&i<6?18:0),y:from.y+(to.y-from.y)*i/6};
      if(touch)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
      else await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point,button:'left',buttons:1});
      await evaluate('smokeWait()');
    }
    if(touch)await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    else await send('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',clickCount:1});
    await evaluate('smokeWait()');
  };
  for (const [width,height,touch] of (process.argv.includes('--mobile') ? [[390,844,true]] : [[1440,900,false]])) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
    await send('Emulation.setTouchEmulationEnabled',{enabled:touch});
    await evaluate(`(async()=>{
      localStorage.clear();
      window.prep = await smokeStart('ShopScene',{classId:'arthur'});
    })()`);
    // Prepare a purchase; board movement and navigation use real pointer events.
    await evaluate(`(()=>{
      prep.session.buy('sword'); prep.refreshStock(); prep.boardView.refresh();
      prep.session.toggleOfferLock(5); prep.refreshStock();
    })()`);
    await evaluate('smokeWait()');
    await drag('sword',`({x:prep.preparationLayout.board.x+36,y:prep.preparationLayout.board.y+108})`,touch);
    await evaluate(`(async()=>{
      await new Promise(resolve=>setTimeout(resolve,350));
      const {loadRun}=await import('/src/systems/RunSave.js');
      const saved=loadRun();
      smokeAssert(saved.status==='ok','valid saved state');
      smokeAssert(saved.session.board.items[0].x===0,'drag persisted: '+JSON.stringify({item:prep.session.board.items[0],message:prep.lastMessage,active:smokeGame.scene.getScenes(true).map(s=>s.scene.key),layout:prep.preparationLayout,rect:document.querySelector('canvas').getBoundingClientRect().toJSON()}));
      smokeAssert(saved.session.offers[5].locked,'locked offer persisted');
      window.savedGold=prep.session.gold;
      window.savedBytes=new TextEncoder().encode(localStorage.getItem('ulbris.current-run')).length;
      await smokeStart('LobbyScene');
    })()`);
    const lobbyShot = await send('Page.captureScreenshot', { format: 'png' });
    const lobbyPath = join(output, `lobby-${width}.png`);
    await writeFile(lobbyPath, Buffer.from(lobbyShot.data, 'base64'));
    console.log(JSON.stringify({ screenshotPath: lobbyPath }));
    await tap('smokeGame.scene.getScene("LobbyScene").continueJourneyButton',touch);
    await evaluate(`(()=>{
      window.prep=smokeGame.scene.getScene('ShopScene');
      smokeAssert(prep.sys.isActive()&&prep.session.board.items[0].x===0,'continue restored board');
      smokeAssert(prep.session.gold===savedGold,'continue restored gold');
    })()`);
    const shopShot = await send('Page.captureScreenshot', { format: 'png' });
    const shopPath = join(output, `shop-${width}.png`);
    await writeFile(shopPath, Buffer.from(shopShot.data, 'base64'));
    console.log(JSON.stringify({ screenshotPath: shopPath }));
    await tap('prep.battleButton',touch);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('BattleScene'),'battle starts')`);
    // Reload the document during combat; save must remain at preparation.
    await send('Page.reload');
    for(let i=0;i<200;i++) {
      await new Promise(resolve=>setTimeout(resolve,50));
      if(await evaluate(`(async()=>{window.smokeGame=(await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
        return smokeGame.scene.isActive('MenuScene');})()`).catch(()=>false)) break;
    }
    await evaluate(`(async()=>{
      window.smokeWait=async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);
        for(let i=0;i<500&&smokeGame.scene.getScenes(false).some(s=>s.load?.isLoading()||(s.sys.isActive()&&s.assetsReady===false));i++)await new Promise(r=>setTimeout(r,20));
        for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);smokeGame.step(performance.now(),16);};
      window.smokeAssert=(condition,message)=>{if(!condition)throw new Error(message);};
      window.smokeStart=async(key,data)=>{for(const s of smokeGame.scene.getScenes(false))smokeGame.scene.stop(s.scene.key);
        smokeGame.scene.start(key,data);await smokeWait();return smokeGame.scene.getScene(key);};
      smokeAssert(!!smokeGame.scene.getScene('MenuScene').continueJourneyButton,'continue on fresh page');
    })()`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(output, `continue-${width}.png`);
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({ screenshotPath }));
    await tap('smokeGame.scene.getScene("MenuScene").continueJourneyButton',touch);
    await evaluate(`(()=>{
      window.prep=smokeGame.scene.getScene('ShopScene');
      smokeAssert(prep.session.round===1&&prep.session.pendingFusions===null,'resume before interrupted combat');
      smokeAssert(prep.session.board.items[0].x===0&&prep.session.offers[5].locked,'page reload preserves state');
    })()`);
    await evaluate(`(async()=>{await smokeStart('CharacterSelectScene');})()`);
    await tap('smokeGame.scene.getScene("CharacterSelectScene").selectButton',touch);
    await tap('smokeGame.scene.getScene("CharacterSelectScene").startButton',touch);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('ExitConfirmScene'),'replace requires confirmation')`);
    // Cancel through the modal, then verify the old save was not touched.
    await evaluate(`(async()=>{smokeGame.scene.getScene('ExitConfirmScene').close();await smokeWait();
      const {loadRun}=await import('/src/systems/RunSave.js');
      smokeAssert(loadRun().session.board.items.length===1,'cancel keeps old journey');})()`);
    await tap('smokeGame.scene.getScene("CharacterSelectScene").startButton',touch);
    await tap('({x:smokeGame.scale.width/2-140,y:720+(smokeGame.scale.height-1280)/2})',touch);
    await evaluate(`(()=>{
      window.prep=smokeGame.scene.getScene('ShopScene');
      smokeAssert(prep.sys.isActive()&&prep.session.board.items.length===0,'confirmed new journey');
    })()`);
    const metrics=await evaluate(`(async()=>{
      const {encodeRun,decodeRun,loadRun,clearRun}=await import('/src/systems/RunSave.js');
      const raw=localStorage.getItem('ulbris.current-run');
      const t=performance.now();for(let i=0;i<100;i++)localStorage.setItem('ulbris.current-run',raw);
      const writeMs=(performance.now()-t)/100;
      const r=performance.now();for(let i=0;i<100;i++)decodeRun(raw);
      const readMs=(performance.now()-r)/100;
      // Both terminal paths and victory choice survive the persistence boundary.
      const s=prep.session;s.wins=9;s.round=10;s.beginBattle();s.finishBattle('victory');
      const {saveRun}=await import('/src/systems/RunSave.js');saveRun(s,'victory');
      await smokeStart('LobbyScene');
      return {bytes:new TextEncoder().encode(raw).length,writeMs,decodeMs:readMs};
    })()`);
    await tap('smokeGame.scene.getScene("LobbyScene").continueJourneyButton',touch);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('VictoryChoiceScene'),'victory choice restored')`);
    await tap('smokeGame.scene.getScene("VictoryChoiceScene").continueButton',touch);
    await evaluate(`(async()=>{
      const {loadRun}=await import('/src/systems/RunSave.js');
      smokeAssert(loadRun().session.endless,'infinite saved immediately');
      const s=smokeGame.scene.getScene('ShopScene').session;s.lives=1;s.beginBattle();s.finishBattle('defeat');
      await smokeStart('RunEndScene',{session:s});
      smokeAssert(loadRun().status==='empty','terminal journey removed');
      localStorage.setItem('ulbris.current-run','broken');await smokeStart('MenuScene');
      smokeAssert(!smokeGame.scene.getScene('MenuScene').continueJourneyButton?.active,'invalid save not offered');
      localStorage.clear();
      await smokeStart('ItemCatalogScene');
    })()`);
    const catalogShot = await send('Page.captureScreenshot', { format: 'png' });
    const catalogPath = join(output, `catalog-${width}.png`);
    await writeFile(catalogPath, Buffer.from(catalogShot.data, 'base64'));
    console.log(JSON.stringify({ screenshotPath: catalogPath }));
    console.log(JSON.stringify({width,height,touch,...metrics}));
  }
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('Run save browser checks passed.');
} finally { socket?.close(); browser.kill(); }
