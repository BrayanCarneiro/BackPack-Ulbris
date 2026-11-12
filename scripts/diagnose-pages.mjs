// Start `npm run preview` first, or pass the deployed Pages URL.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allItems } from '../src/data/shopCatalog.js';

const url = process.argv.find(arg => /^https?:/.test(arg)) ?? 'http://127.0.0.1:4173/';
const output = await mkdtemp(join(tmpdir(), 'pages-diagnostics-'));
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', ...(process.argv.includes('--webgl') ? ['--enable-unsafe-swiftshader'] : ['--disable-gpu']), '--no-first-run', '--remote-debugging-port=9251',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
const report = { url, errors: [], failedRequests: [], battles: [] };
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9251/json/list')).json()).find(p => p.type === 'page'); } catch {}
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Edge started');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.loadingFailed') report.failedRequests.push(message.params);
    if (message.method === 'Fetch.requestPaused') {
      void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'image/webp' }], body: 'aW52YWxpZC13ZWJw' });
    }
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    clearTimeout(callback.timeout);
    message.error ? callback.reject(message.error) : callback.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 30000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  if (process.argv.includes('--corrupt')) await send('Fetch.enable', { patterns: [{ urlPattern: '*assets/*.webp' }] });
  if (process.argv.includes('--png')) await send('Network.setBlockedURLs', { urls: ['*assets/*.webp'] });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  if (process.argv.includes('--slow')) {
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 400000, uploadThroughput: 100000 });
  }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    let namespace;
    Object.defineProperty(globalThis, 'Phaser', { configurable: true, get: () => namespace, set: value => {
      namespace = value; const Game = value.Game;
      value.Game = class extends Game { constructor(config) { super(config); globalThis.testGame = this; } };
    }});
    if (${process.argv.includes('--canvas')}) {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/i.test(type) ? null : getContext.call(this, type, ...args); };
    }
    window.startupLongTasks = [];
    new PerformanceObserver(list => startupLongTasks.push(...list.getEntries().map(e => ({start: e.startTime, duration: e.duration})))).observe({type: 'longtask', buffered: true});
  ` });
  await send('Page.navigate', { url });
  for (let i = 0; i < 300; i++) {
    if (await evaluate(`Boolean(window.testGame?.scene.isActive('MenuScene'))`)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  report.startup = await evaluate(`({ menuReady: testGame.scene.isActive('MenuScene'), ms: performance.now(), renderer: testGame.renderer.gl ? 'WebGL' : 'Canvas', resources: performance.getEntriesByType('resource').map(e => ({url: e.name, bytes: e.decodedBodySize, duration: e.duration})), longTasks: startupLongTasks })`);
  assert.ok(report.startup.menuReady, 'Menu loaded');
  if (process.argv.includes('--lazy')) {
    const imageURLs = report.startup.resources.filter(r => /\.(webp|png)$/.test(r.url)).map(r => r.url);
    assert.ok(imageURLs.length > 0 && imageURLs.every(url => url.includes('ulbris-logo.')), 'Startup requests only the logo (including fallback attempts)');
  }
  if (!process.argv.includes('--startup-only')) {
  if (await evaluate('Boolean(window.ulbris)')) await evaluate("window.ulbris.enterGame('MenuScene').then(()=>true)");
  // Real pointer events verify input routing, including scale on a mobile viewport.
  const tap = async (sceneKey, text) => {
    const point = await evaluate(`(() => {
      const scene = testGame.scene.getScene(${JSON.stringify(sceneKey)});
      const button = scene.children.list.find(o => o.list?.some(c => c.text === ${JSON.stringify(text)}) || (o.text === ${JSON.stringify(text)} && o.input));
      if (!button) throw new Error('Missing button: ' + ${JSON.stringify(text)});
      const rect = testGame.canvas.getBoundingClientRect();
      return {x: rect.x + (button.x - scene.cameras.main.scrollX) * rect.width / testGame.scale.width, y: rect.y + (button.y - scene.cameras.main.scrollY) * rect.height / testGame.scale.height};
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 60));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 150));
  };
  await tap('MenuScene', 'Iniciar');
  report.menuClickable = await evaluate(`testGame.scene.isActive('LobbyScene')`);
  assert.ok(report.menuClickable, 'Menu click opens lobby');
  await evaluate(`(async () => {
    window.frame = async () => { for (let i=0;i<4;i++) await new Promise(requestAnimationFrame); };
    window.stageLoads = [];
    window.startScene = async (key, data) => {
      for (const scene of testGame.scene.getScenes(true)) testGame.scene.stop(scene.scene.key);
      const started = performance.now(), count = performance.getEntriesByType('resource').length;
      testGame.scene.start(key, data);
      while (!testGame.scene.isActive(key) || testGame.scene.getScene(key).assetsReady === false) {
        if (performance.now() - started > 25000) throw new Error('Loading timed out: ' + key);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      stageLoads.push({key, ms:performance.now() - started, resources:performance.getEntriesByType('resource').slice(count).map(r => ({url:r.name, bytes:r.decodedBodySize}))});
      await frame();
    };
    await startScene('CharacterSelectScene');
    if (${process.argv.includes('--lazy')} && (testGame.textures.exists('arthur-battle-body') || testGame.textures.exists('items-general'))) throw new Error('Selection loaded unrelated image groups');
    await startScene('ShopScene');
    window.testSession = testGame.scene.getScene('ShopScene').session;
    await startScene('ItemCatalogScene');
    window.catalogItems = [...testGame.scene.getScene('ItemCatalogScene').filteredItems];
  })()`);
  if (process.argv.includes('--retry')) {
    await send('Network.setBlockedURLs', {urls:['*assets/characters/arthur/attack-normal.*']});
    await evaluate(`(() => {
      testSession.buy('traveler-bag'); testSession.buy('sword');
      testSession.board.move('bag','traveler-bag',0,0); testSession.board.move('item','sword',0,0);
      window.beforeRetry = JSON.stringify(testSession);
      for (const scene of testGame.scene.getScenes(true)) testGame.scene.stop(scene.scene.key);
      testGame.scene.start('BattleScene', {session:testSession});
    })()`);
    let retryReady = false;
    for(let i=0;i<200;i++) {
      retryReady = await evaluate(`Boolean(testGame.scene.getScene('BattleScene').assetRetry)`);
      if(retryReady) break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(retryReady, 'Failed image group offers retry');
    assert.ok(await evaluate(`!testGame.scene.getScene('BattleScene').combat && beforeRetry === JSON.stringify(testSession)`), 'Battle has not started and session is preserved during loading failure');
    await send('Network.setBlockedURLs', {urls:[]});
    await tap('BattleScene','Tentar novamente');
    await evaluate(`(async () => {
      const started = performance.now();
      while (!testGame.scene.getScene('BattleScene').assetsReady) {
        if(performance.now()-started>15000) throw new Error('Retry did not recover');
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      if(testGame.scene.getScene('BattleScene').session !== testSession) throw new Error('Retry lost session');
    })()`);
    report.recoveryPassed = true;
  }
  for (const id of (process.argv.includes('--stages-only') ? ['sword'] : allItems.filter(item => item.kind !== 'bag').map(item => item.id))) {
    try {
      const result = await evaluate(`(async () => {
        const piece = catalogItems.find(item => item.id === ${JSON.stringify(id)});
        testSession.board.bags = [{id:'test-bag',width:8,height:8,x:0,y:0}];
        testSession.board.items = [{...piece, catalogId:piece.id,x:0,y:0}];
        await startScene('BattleScene', { session: testSession });
        const battle = testGame.scene.getScene('BattleScene');
        for(let i=0;i<20;i++) { battle.battleClock = {tick:()=>100}; battle.update(); }
        // Exercise the same equipment as enemy, with real Phaser Graphics/Shapes.
        const EnemyView = battle.backpacks.enemy.constructor;
        new EnemyView(battle, 0, testSession.board, 'TEST ENEMY');
        return {active: battle.scene.isActive(), views: battle.backpacks.player.itemViews.length};
      })()`);
      report.battles.push({ id, ...result });
    } catch (error) { report.battles.push({ id, error: error.message }); }
  }
  // Repeated real clicks catch dialogs that leave shop input paused/disabled.
  await evaluate(`(async () => { await startScene('ShopScene'); })()`);
  for (let i = 0; i < 5; i++) {
    const point = await evaluate(`(() => {
      const shop = testGame.scene.getScene('ShopScene');
      const bounds = shop.offersLayer.list[0].infoZone.getBounds(), rect = testGame.canvas.getBoundingClientRect();
      return {x:rect.x + bounds.centerX * rect.width / testGame.scale.width, y:rect.y + bounds.centerY * rect.height / testGame.scale.height};
    })()`);
    await send('Input.dispatchMouseEvent', {type:'mousePressed', ...point, button:'left', clickCount:1});
    await send('Input.dispatchMouseEvent', {type:'mouseReleased', ...point, button:'left', clickCount:1});
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(await evaluate(`testGame.scene.isActive('ItemInfoScene')`), 'Offer opens item details');
    await tap('ItemInfoScene', 'Fechar');
    assert.ok(await evaluate(`testGame.scene.isActive('ShopScene') && testGame.scene.getScene('ShopScene').input.enabled`), 'Closing details restores shop input');
  }
  report.modalCycles = 5;
  report.stages = await evaluate('stageLoads');
  if (process.argv.includes('--atlas')) {
    report.atlas = await evaluate(`(() => {
      const texture = testGame.textures.get('items-general');
      return {frames:texture.getFrameNames().length, sources:texture.source.length};
    })()`);
    assert.equal(report.atlas.frames, 31, 'All equipment frames are present');
    assert.equal(report.atlas.sources, 1, 'All equipment shares a single source texture');
    assert.ok(report.stages.flatMap(stage => stage.resources).every(r => !/\/assets\/items\//.test(r.url)), 'No individual equipment image requests');
    if (!process.argv.includes('--png') && !process.argv.includes('--corrupt')) {
      assert.equal(report.stages.find(stage => stage.key === 'ShopScene').resources.length, 1, 'Shop loads exactly one atlas image');
    }
  }
  if (process.argv.includes('--lazy')) {
    for (const key of ['CharacterSelectScene', 'ShopScene', 'BattleScene']) {
      const visits = report.stages.filter(stage => stage.key === key);
      // Revisit selection explicitly; shop and battle already repeat above.
      if (key === 'CharacterSelectScene') {
        await evaluate("startScene('CharacterSelectScene')");
        report.stages = await evaluate('stageLoads');
        visits.push(report.stages.at(-1));
      }
      if(key!=='BattleScene') assert.ok(visits[0].resources.length > 0, key + ' loads its group on first visit');
      assert.ok(visits.slice(1).every(stage => stage.resources.length === 0), key + ' reuses textures on return');
    }
  }
  assert.equal(report.battles.filter(b => b.error).length, 0, 'All artwork shapes can enter battle');
  assert.equal(report.errors.length, 0, 'No browser exceptions');
  }
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, url, startupMs: report.startup?.ms, resourceBytes: report.startup?.resources.reduce((sum,r)=>sum+r.bytes,0), renderer: report.startup?.renderer, menuClickable: report.menuClickable, battles: report.battles, atlas:report.atlas, stages:report.stages?.filter((s,i,a)=>a.findIndex(t=>t.key===s.key)===i).map(s=>({key:s.key, ms:s.ms, resources:s.resources.length})), modalCycles: report.modalCycles, recoveryPassed: report.recoveryPassed, errors: report.errors.length, failedRequests: report.failedRequests.length }));
  socket?.close(); browser.kill();
}
