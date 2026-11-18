// Starts its own Vite server and temporary accounts database; requires Edge.
import assert from 'node:assert/strict';
import { createServer as createViteServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'accounts-browser-'));
process.env.ULBRIS_DATA_DIR = join(output, 'data');
const app = await createViteServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await app.listen();
const origin = 'http://127.0.0.1:' + app.httpServer.address().port;
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debugPort = process.env.ACCOUNTS_DEBUG_PORT ?? 9267;
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
  await send('Page.navigate', { url: origin });
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
  const waitFor = async (expression, message) => {
    for(let i=0;i<200;i++) {
      if(await evaluate(expression).catch(()=>false))return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.fail(message ?? expression);
  };
  const click = async selector => {
    const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  const fill = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const shot = async name => {
    const result=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output, name+'.png'),Buffer.from(result.data,'base64'));
  };
  await waitFor('smokeGame.scene.isActive("MenuScene")','Menu ready after account initialization');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate('smokeWait()');
  assert.equal(await evaluate('document.querySelector(".account-badge strong").textContent'),'Viajante');
  const position=await evaluate(`(()=>{const r=document.querySelector('.account-badge').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right};})()`);
  assert.ok(position.x<=24&&position.y<=24&&position.right<350,'Profile stays in the desktop top-left corner');
  await evaluate(`(async()=>{
    const {saveRun}=await import('/src/systems/RunSave.js');
    const {default:Session}=await import('/src/systems/ShoppingSession.js');
    const guest=new Session({classId:'arthur'});guest.gold=9;saveRun(guest);
  })()`);
  await click('.account-badge');
  await waitFor('document.querySelector("#account-username")&&!document.querySelector(".account-dialog [disabled]")');
  await click('[data-mode="register"]');
  const username='Cavaleiro_Ulbris_1234567';
  const password='Senha de teste 123!';
  await fill('#account-username',username);
  await fill('#account-password',password);
  await fill('#account-confirm','Senha diferente');
  await click('.account-form [type="submit"]');
  assert.match(await evaluate('document.querySelector(".account-status").textContent'),/iguais/);
  await fill('#account-confirm',password);
  await shot('register-desktop');
  await click('.account-form [type="submit"]');
  await waitFor(`document.querySelector('.account-badge strong').textContent===${JSON.stringify(username)}&&!document.querySelector('dialog[open]')`,'Registration succeeds');
  await evaluate(`(async()=>{
    const {loadRun,saveRun}=await import('/src/systems/RunSave.js');
    const {default:Session}=await import('/src/systems/ShoppingSession.js');
    smokeAssert(loadRun().status==='empty','new account does not inherit guest save');
    const own=new Session({classId:'arthur'});own.gold=4;saveRun(own);
  })()`);
  await shot('menu-desktop');
  await click('.account-badge');
  await waitFor('Boolean(document.querySelector(".account-logout:not([disabled])"))');
  assert.equal(await evaluate('document.querySelector(".account-username").textContent'),username);
  await shot('profile-desktop');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor('!document.querySelector("dialog[open]")');
  assert.equal(await evaluate('smokeGame.scene.getScene("MenuScene").input.enabled'),true,'Closing restores game input');
  await evaluate('window.beforeAccountReload=true');
  await send('Page.reload');
  await waitFor(`(async()=>{if(window.beforeAccountReload)return false;
    window.smokeGame=(await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    return smokeGame.scene.isActive('MenuScene')&&document.querySelector('.account-badge strong')?.textContent===${JSON.stringify(username)};})()`,'Session survives a page reload');
  assert.equal(await evaluate(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');return loadRun().session.gold;})()`),4);
  assert.equal(await evaluate('document.cookie.includes("ulbris_session")'),false,'Session cookie is HttpOnly');
  assert.equal(await evaluate(`Object.values(localStorage).some(value=>value.includes(${JSON.stringify(password)}))`),false,'No password in browser storage');
  await evaluate(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');window.ownedSessionBeforeLogout=loadRun().session;})()`);
  await click('.account-badge');
  await waitFor('Boolean(document.querySelector(".account-logout:not([disabled])"))');
  await click('.account-logout');
  await waitFor('document.querySelector(".account-badge strong").textContent==="Viajante"&&!document.querySelector("dialog[open]")');
  assert.equal(await evaluate(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');return loadRun().session.gold;})()`),9,'Logout restores guest save');
  assert.equal(await evaluate(`(async()=>{const {saveRun}=await import('/src/systems/RunSave.js');return saveRun(ownedSessionBeforeLogout);})()`),false,
    'A late callback cannot move the old account session into the guest slot');
  assert.equal(await evaluate('smokeGame.scene.getScene("MenuScene").continueJourneyButton.label.text'),
    'Continuar como visitante','Guest save is explicitly separate from the signed-in journey');
  // A different account must not inherit the first account or the guest slot.
  await click('.account-badge');
  await waitFor('Boolean(document.querySelector("#account-username:not([readonly])"))');
  await click('[data-mode="register"]');
  await fill('#account-username','Outra_Conta'); await fill('#account-password',password); await fill('#account-confirm',password);
  await click('.account-form [type="submit"]');
  await waitFor('document.querySelector(".account-badge strong").textContent==="Outra_Conta"&&!document.querySelector("dialog[open]")');
  assert.equal(await evaluate('smokeGame.scene.getScene("MenuScene").continueJourneyButton'),null,'Another account sees no continue button');
  assert.equal(await evaluate(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');return loadRun().status;})()`),'empty');
  assert.equal(await evaluate(`(async()=>{const {saveRun}=await import('/src/systems/RunSave.js');return saveRun(ownedSessionBeforeLogout);})()`),false,
    'A different account cannot adopt the first account session');
  await click('.account-badge'); await waitFor('Boolean(document.querySelector(".account-logout:not([disabled])"))');
  await click('.account-logout');
  await waitFor('document.querySelector(".account-badge strong").textContent==="Viajante"&&!document.querySelector("dialog[open]")');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('.account-badge');
  await waitFor('Boolean(document.querySelector("#account-username:not([readonly])"))');
  await fill('#account-username',username.toLowerCase());
  await fill('#account-password','Senha incorreta');
  await click('.account-form [type="submit"]');
  await waitFor('document.querySelector(".account-status").textContent.includes("incorretos")');
  assert.ok(await evaluate('document.querySelector("dialog").open'),'Wrong password leaves login open');
  await fill('#account-password',password);
  await shot('login-mobile');
  await click('.account-form [type="submit"]');
  await waitFor(`document.querySelector('.account-badge strong').textContent===${JSON.stringify(username)}&&!document.querySelector('dialog[open]')`,'Login on mobile');
  assert.equal(await evaluate(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');return loadRun().session.gold;})()`),4,'Login restores the account save');
  await click('.account-badge');
  await waitFor('Boolean(document.querySelector(".account-logout:not([disabled])"))');
  const fits=await evaluate(`(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()`);
  assert.ok(fits,'Mobile profile fits the viewport');
  await shot('profile-mobile');
  for (const path of ['/server/accounts.js','/.local-data/accounts.sqlite']) {
    const response=await fetch(origin+path);
    assert.ok([403,404].includes(response.status),'Private server files are not exposed');
  }
  await click('.account-close');
  await waitFor('!document.querySelector("dialog[open]")&&smokeGame.scene.getScene("MenuScene").input.enabled');
  await evaluate(`(()=>{const button=smokeGame.scene.getScene('MenuScene').continueJourneyButton;
    button.emit('pointerdown',{id:1});button.emit('pointerup',{id:1});})()`);
  await waitFor('smokeGame.scene.isActive("ShopScene")','Continue restores the authenticated journey');
  await evaluate(`(()=>{const shop=smokeGame.scene.getScene('ShopScene');
    if(shop.session.gold!==4)throw new Error('correct account journey reaches shop');
    const button=shop.offersLayer.list[1].buyButton;
    button.emit('pointerdown',{id:1});button.emit('pointerup',{id:1});})()`);
  await waitFor(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');return loadRun().session.gold===1;})()`,'Gameplay autosaves into the account slot');
  assert.equal(await evaluate('document.querySelector(".account-widget").hidden'),true,'Account switching is hidden during gameplay');
  await evaluate(`(async()=>{const {getRunSync}=await import('/src/systems/RunSave.js');await getRunSync().flush();})()`);
  await evaluate('localStorage.clear();window.beforeAccountReload=true');
  await send('Page.reload');
  await waitFor(`(async()=>{if(window.beforeAccountReload)return false;
    window.smokeGame=(await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    if(!smokeGame.scene.isActive('MenuScene'))return false;
    const {loadRun,getRunSync}=await import('/src/systems/RunSave.js');
    return getRunSync()?.state().status==='saved'&&loadRun().session?.gold===1;})()`,'Database restores the journey after browser storage is cleared');
  await evaluate(`(()=>{const b=smokeGame.scene.getScene('MenuScene').continueJourneyButton;
    b.emit('pointerdown',{id:1});b.emit('pointerup',{id:1});})()`);
  await waitFor('smokeGame.scene.isActive("ShopScene")');
  await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['*/api/run']});
  await evaluate(`(()=>{const s=smokeGame.scene.getScene('ShopScene');s.session.toggleOfferLock(5);s.refreshStock();})()`);
  await waitFor(`(async()=>{const {getRunSync}=await import('/src/systems/RunSave.js');return getRunSync().state().status==='offline';})()`,'Disconnected API retains a pending copy');
  await send('Network.setBlockedURLs',{urls:[]});
  await evaluate('window.beforeAccountReload=true');
  await send('Page.reload');
  await waitFor(`(async()=>{if(window.beforeAccountReload)return false;
    window.smokeGame=(await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    if(!smokeGame.scene.isActive('MenuScene'))return false;
    const {loadRun,getRunSync}=await import('/src/systems/RunSave.js');
    return getRunSync()?.state().status==='saved'&&loadRun().session?.offers[5].locked;})()`,'Pending changes survive reload and reach the database');
  await evaluate(`(async()=>{
    const {getRunSync}=await import('/src/systems/RunSave.js');
    const sync=getRunSync(),response=await fetch('/api/run',{headers:{'X-Run-Owner':sync.owner}});
    const current=await response.json();const data=JSON.parse(current.raw);data.state.gold=2;
    const changed=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Run-Owner':sync.owner},
      body:JSON.stringify({revision:current.revision,raw:JSON.stringify(data),operationId:crypto.randomUUID()})});
    if(!changed.ok)throw new Error('other tab save');
    // Simulate the old tab making a late change, without refreshing its version.
    data.state.gold=3;sync.write(JSON.stringify(data));await sync.sending;
  })()`);
  assert.equal(await evaluate(`(async()=>{const {getRunSync}=await import('/src/systems/RunSave.js');return getRunSync().state().status;})()`),'conflict');
  await evaluate(`void smokeGame.scene.getScene('MenuScene').scene.restart()`);
  await waitFor('Boolean(smokeGame.scene.getScene("MenuScene").reloadJourneyButton?.active)');
  await evaluate(`(()=>{const b=smokeGame.scene.getScene('MenuScene').reloadJourneyButton;b.emit('pointerdown',{id:1});b.emit('pointerup',{id:1});})()`);
  await waitFor(`(async()=>{const {getRunSync,loadRun}=await import('/src/systems/RunSave.js');return getRunSync().state().status==='saved'&&loadRun().session?.gold===2;})()`,'Conflict action loads the database copy');
  assert.ok(await evaluate(`Object.keys(localStorage).some(key=>key.includes('.backup.'))`),'Conflict draft was backed up');
  await waitFor('Boolean(smokeGame.scene.getScene("MenuScene").continueJourneyButton?.active)','Menu finished rendering after conflict resolution');
  // With no visitor journey, logging out removes Continue completely, also after reload.
  await evaluate(`localStorage.removeItem('ulbris.current-run')`);
  await click('.account-badge'); await waitFor('Boolean(document.querySelector(".account-logout:not([disabled])"))');
  await click('.account-logout');
  await waitFor('document.querySelector(".account-badge strong").textContent==="Viajante"&&!document.querySelector("dialog[open]")');
  assert.equal(await evaluate('smokeGame.scene.getScene("MenuScene").continueJourneyButton'),null,'Logout hides the account journey');
  await evaluate('window.beforeAccountReload=true'); await send('Page.reload');
  await waitFor(`(async()=>{if(window.beforeAccountReload)return false;
    window.smokeGame=(await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    return smokeGame.scene.isActive('MenuScene');})()`);
  assert.equal(await evaluate('smokeGame.scene.getScene("MenuScene").continueJourneyButton'),null,'Account journey stays hidden after signed-out reload');
  await click('.account-badge'); await waitFor('Boolean(document.querySelector("#account-username:not([readonly])"))');
  await fill('#account-username',username); await fill('#account-password',password);
  await click('.account-form [type="submit"]');
  await waitFor(`document.querySelector('.account-badge strong').textContent===${JSON.stringify(username)}&&!document.querySelector('dialog[open]')`);
  await waitFor('Boolean(smokeGame.scene.getScene("MenuScene").continueJourneyButton?.active)');
  assert.equal(await evaluate(`(async()=>{const {loadRun}=await import('/src/systems/RunSave.js');return loadRun().session.gold;})()`),2,
    'Only logging back into the original account restores its full progress');
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log(JSON.stringify({result:'passed',screenshots:output,profilePosition:position}));
} finally {socket?.close();browser.kill();await app.close();}

