// Run with Vite running: node scripts/smoke-item-art.mjs [--png]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'item-art-test-'));
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9244',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9244/json/list')).json()).find(entry => entry.type === 'page'); } catch {}
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Edge started');
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
    assert.ok(!result.exceptionDetails, JSON.stringify({evaluation:result.exceptionDetails,errors}));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 40; i++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail(`Timed out waiting for ${expression}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (process.argv.includes('--png')) { await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['*assets/atlases/*.webp'] }); }
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.artGame = await window.ulbris.enterGame('MenuScene');
    window.frame = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
    while (!artGame.scene.isActive('MenuScene')) await frame();
    window.start = async (key, data) => {
      for (const scene of artGame.scene.getScenes(true)) artGame.scene.stop(scene.scene.key);
      artGame.scene.start(key, data);
      const started = performance.now();
      while (!artGame.scene.isActive(key) || artGame.scene.getScene(key).assetsReady === false) {
        if (performance.now() - started > 20000) throw new Error('Timed out loading ' + key);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await frame();
    };
    await start('ShopScene');
    window.shop = artGame.scene.getScene('ShopScene'); window.artSession = shop.session;
  })()`);
  assert.equal(await evaluate('shop.offersLayer.list.filter(card => card.art).length'), 4, 'Initial equipment offers have art; bags show cells');
  await evaluate(`(() => {
    for (const id of ['traveler-bag', 'sword', 'shield', 'refined-iron']) {
      const error = artSession.buy(id); if (error) throw new Error(error);
    }
    shop.boardView.refresh(); shop.refreshStock();
  })()`);
  assert.equal(await evaluate('shop.boardView.views.filter(view => view.art).length'), 3, 'Reserve uses equipment art; bags show cells');
  assert.equal(await evaluate('shop.boardView.views.filter(view => view.kind === "bag").every(view => !view.art)'), true, 'Bags never use PNG backgrounds');
  assert.equal(await evaluate(`(() => {
    for (const id of ['sword', 'shield', 'refined-iron']) for (let turn = 0; turn < 4; turn++) {
      const item = artSession.board.items.find(piece => piece.id === id);
      const view = shop.boardView.views.find(view => view.piece.id === id);
      shop.boardView.refresh();
      const bounds = view.art.getBounds();
      if (bounds.width > item.width * shop.boardView.layout.cellSize * view.object.scaleX + 1
        || bounds.height > item.height * shop.boardView.layout.cellSize * view.object.scaleY + 1
        || (view.art.angle + 360) % 360 !== ((item.rotation ?? 0) + 360) % 360)
        throw new Error(JSON.stringify({ id, turn, bounds, width: item.width, height: item.height, scale: view.object.scaleX, cell: shop.boardView.layout.cellSize, angle: view.art.angle, rotation: item.rotation }));
      artSession.board.store('item', id, 1);
    }
    return true;
  })()`), true, 'All item art fits its footprint in all four rotations');
  await evaluate(`(() => {
    for (const [kind, id, x, y] of [['bag', 'traveler-bag', 0, 0], ['item', 'sword', 0, 0], ['item', 'shield', 1, 0], ['item', 'refined-iron', 1, 2]]) {
      const error = artSession.board.move(kind, id, x, y); if (error) throw new Error(error);
    }
    shop.boardView.refresh();
  })()`);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
    await new Promise(resolve => setTimeout(resolve, 250)); await evaluate('frame()');
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `items-shop-${width}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate("start('BattleScene', { session: artSession })");
  assert.equal(await evaluate("artGame.scene.getScene('BattleScene').backpacks.player.itemViews.filter(view => view.art).length"), 3);
  const battle = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'items-battle.png'), Buffer.from(battle.data, 'base64'));
  await evaluate("start('ItemCatalogScene')");
  assert.equal(await evaluate(`(async () => {
    const catalog = artGame.scene.getScene('ItemCatalogScene');
    const { itemArt } = await import('/src/data/itemArt.js');
    for (const id of Object.keys(itemArt)) {
      catalog.page = Math.floor(catalog.filteredItems.findIndex(item => item.id === id) / 12); catalog.renderCatalog();
      if (!catalog.children.list.some(child => child.getData?.('itemArtId') === id)) return false;
    }
    return true;
  })()`), true, 'Catalog displays every registered equipment icon');
  for (const id of ['golden-crystal', 'vampiric-chestplate', 'iron-armor', 'leather-chestplate', 'iron-sword', 'bow', 'black-crystal', 'regeneration-potion']) {
    await evaluate(`(() => {
      const catalog = artGame.scene.getScene('ItemCatalogScene');
      catalog.page = Math.floor(catalog.filteredItems.findIndex(item => item.id === '${id}') / 12);
      catalog.renderCatalog();
    })()`);
    await evaluate('frame()');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `catalog-${id}.png`), Buffer.from(shot.data, 'base64'));
  }
  for (const id of ['sword', 'shield', 'refined-iron']) {
    await evaluate(`start('ItemInfoScene', { item: artSession.board.items.find(item => item.id === '${id}'), sourceKey: 'ItemCatalogScene' })`);
    assert.equal(await evaluate(`artGame.scene.getScene('ItemInfoScene').children.list.some(child => child.getData?.('itemArtId') === '${id}')`), true);
  }
  await evaluate(`(async () => {
    artSession.runResult = 'victory'; artSession.wins = 8;
    artSession.winningBoard = { columns: 8, rows: 8, bags: artSession.board.bags, items: artSession.board.items };
    await start('WinningBackpackScene', { session: artSession });
  })()`);
  assert.equal(await evaluate("artGame.scene.getScene('WinningBackpackScene').children.list.filter(child => child.getData?.('itemArtId')).length"), 3);
  const winning = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'items-winning.png'), Buffer.from(winning.data, 'base64'));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify({ result: 'passed', pngFallback: process.argv.includes('--png'), screenshots: output }));
} finally { socket?.close(); browser.kill(); }
