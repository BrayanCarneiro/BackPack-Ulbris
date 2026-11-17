// With Vite running: node scripts/smoke-arthur-items.mjs [--png]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'arthur-items-'));
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9258',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9258/json/list')).json()).find(p => p.type === 'page'); } catch {}
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Edge started');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    message.error ? callback.reject(message.error) : callback.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const screenshot = async name => {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`docs/art/items/arthur-${name}.png`, Buffer.from(result.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  if (process.argv.includes('--png')) {
    await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['*assets/atlases/*.webp'] });
  }
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.game = (await import('/src/main.js')).default;
    window.frame = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
    window.start = async (key, data) => {
      for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
      game.scene.start(key, data);
      const started = performance.now();
      while (!game.scene.isActive(key) || game.scene.getScene(key).assetsReady === false) {
        if (performance.now() - started > 20000) throw new Error('Timed out loading ' + key);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await frame();
    };
    while (!game.scene.isActive('MenuScene')) await frame();
    window.items = (await import('/src/data/arthurItems.js')).arthurItems;
    window.Session = (await import('/src/systems/ShoppingSession.js')).default;
    window.session = new Session({ classId: 'arthur', campaign: false });
    await start('ShopScene', { session });
  })()`);
  assert.equal(await evaluate("game.textures.get('items-arthur').getFrameNames().length"), 7);
  assert.equal(await evaluate("session.board.bags[0].catalogId"), 'knight-bag');
  assert.equal(await evaluate("game.scene.getScene('ShopScene').boardView.views[0].art.visible"), false, 'backpack grid stays readable');
  await screenshot('initial-shop');
  for (const id of await evaluate('items.map(item => item.id)')) {
    await evaluate(`start('ItemInfoScene', { item: items.find(item => item.id === '${id}') })`);
    assert.equal(await evaluate(`game.scene.getScene('ItemInfoScene').children.list.some(child => child.getData?.('itemArtId') === '${id}')`), true, id);
    assert.ok(await evaluate("game.scene.getScene('ItemInfoScene').contentBottom <= 1090"), `${id}: effects fit panel`);
    if (id === 'excalibur') await screenshot('excalibur-info');
    await evaluate(`(() => {
      const info = game.scene.getScene('ItemInfoScene');
      info.recipesVisible = true; info.renderPanel();
    })()`);
    assert.ok(await evaluate("game.scene.getScene('ItemInfoScene').contentBottom <= 1090"), `${id}: recipe fits panel`);
    if (id === 'knight-greatsword') await screenshot('greatsword-recipe');
  }
  await evaluate(`(async () => {
    const make = (id,x,y) => ({ ...items.find(item => item.id === id), catalogId:id,x,y });
    session.board.bags = [make('knight-bag',0,0),make('knight-bag',4,0)];
    session.board.bags[1].id += '#2';
    session.board.items = [make('excalibur',0,0),make('bastion-chestplate',2,0),
      make('bloody-sword',4,0),make('commander-helmet',5,0),make('oath-ring',7,0)];
    session.beginBattle();
    await start('BattleScene', {session});
    window.battle = game.scene.getScene('BattleScene');
    battle.battleClock.pause();
    const fighter = battle.combat.fighters.player;
    fighter.weapons.find(w => w.id === 'excalibur').attackCount = 4;
    fighter.bleeds.push({ remaining:3,damage:2,nextAt:1 });
    battle.refreshCombat();
  })()`);
  assert.equal(await evaluate("battle.backpacks.player.itemViews.find(v => v.item.catalogId === 'excalibur').imbued"), true);
  assert.equal(await evaluate("battle.characters.player.statusText.text.includes('Sangramento: 1')"), true);
  assert.equal(await evaluate('battle.backpacks.player.itemViews.filter(v => v.art).length'), 5);
  await screenshot('battle');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("start('ShopScene', {session})");
  await screenshot('mobile-shop');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify({ result:'passed', pngFallback:process.argv.includes('--png'), items:7,
    screenshots:'docs/art/items/arthur-*.png' }));
} finally { socket?.close(); browser.kill(); }
