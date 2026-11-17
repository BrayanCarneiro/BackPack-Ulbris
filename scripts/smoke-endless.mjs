// Run with Vite running: node scripts/smoke-endless.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'endless-browser-'));
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9248;
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${port}`, `--user-data-dir=${join(output, 'profile')}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === 'page'); } catch {}
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
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 200; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.game = (await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    if(document.querySelectorAll('canvas').length !== 1) throw new Error('Expected one game canvas');
    window.check = (value, message) => { if (!value) throw new Error(message); };
    window.waitForScene = async key => {
      for(let i = 0; i < 400; i++) {
        const scene = game.scene.getScene(key);
        if(scene?.sys.isActive() && scene.assetsReady !== false && !scene.load.isLoading()) {
          await new Promise(requestAnimationFrame);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('Timed out: ' + key);
    };
    await waitForScene('MenuScene');
    window.prepareVictory = async () => {
      const {default: ShoppingSession} = await import('/src/systems/ShoppingSession.js');
      const {shopAutomatically} = await import('/src/systems/AutoShopper.js');
      window.session = new ShoppingSession({classId:'arthur', opponentSeed:0});
      shopAutomatically(session);
      session.wins = 9; session.round = 10;
      for(const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
      game.scene.start('BattleScene', {session});
      await waitForScene('BattleScene');
      const battle = game.scene.getScene('BattleScene');
      battle.combat.result = 'victory';
      battle.returnToShop();
      await waitForScene('VictoryChoiceScene');
      check(session.wins === 10 && session.runResult === 'victory', 'Tenth victory reached');
    };
    await prepareVictory();
  })()`);
  const click = async button => {
    const point = await evaluate(`(() => {
      const button = game.scene.getScene('VictoryChoiceScene').${button};
      const rect = game.canvas.getBoundingClientRect();
      return {x:rect.x + button.x * rect.width / game.scale.width,
        y:rect.y + button.y * rect.height / game.scale.height};
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const screenshot = await send('Page.captureScreenshot');
  await writeFile(join(output, 'victory-choice.png'), Buffer.from(screenshot.data, 'base64'));
  await click('continueButton');
  await evaluate(`(async () => {
    await waitForScene('ShopScene');
    check(session.endless && session.difficulty === 5 && session.round === 11, 'Continue enters endless');
    check(session.lives === 5 && session.runResult === null, 'Lives preserved');
    const shop = game.scene.getScene('ShopScene');
    shop.scene.start('BattleScene', {session});
    await waitForScene('BattleScene');
    const battle = game.scene.getScene('BattleScene');
    check(battle.opponent.difficulty === 5, 'Real battle uses endless difficulty');
    battle.combat.result = 'victory'; battle.returnToShop();
    await waitForScene('ShopScene');
    check(session.wins === 11 && session.endlessBattles === 1, 'Further victories return to shopping');
    await prepareVictory();
  })()`);
  await click('finishButton');
  await evaluate(`(async () => {
    await waitForScene('RunEndScene');
    check(!session.endless && session.runResult === 'victory', 'Finish preserves normal victory');
    check(Boolean(game.scene.getScene('RunEndScene').winningBackpackButton), 'Winning backpack available');
  })()`);
  await evaluate(`(async () => {
    const { default: ShoppingSession } = await import('/src/systems/ShoppingSession.js');
    const { allItems } = await import('/src/data/shopCatalog.js');
    window.session = new ShoppingSession({classId:'arthur', opponentSeed:0});
    const make = (id,x,y) => ({...allItems.find(item => item.id === id),catalogId:id,x,y});
    session.board.items = [make('knight-greatsword',0,0), make('golden-crystal',2,0)];
    game.scene.getScene('RunEndScene').scene.start('ShopScene', {session});
    await waitForScene('ShopScene');
    window.showOath = async count => {
      const {openItemInfo} = await import('/src/utils/openItemInfo.js');
      const shop = game.scene.getScene('ShopScene');
      openItemInfo(shop, session.board.items[0]);
      await waitForScene('ItemInfoScene');
      const info = game.scene.getScene('ItemInfoScene');
      info.recipesVisible = true;
      info.recipeIndex = info.details.recipes.findIndex(recipe => recipe.result === 'excalibur');
      info.renderPanel();
      check(info.oathCounterText.text === count+'/2', 'Correct oath counter');
      check(info.recipeZones[0].x < info.oathCounterText.x && info.recipeZones[1].x > info.oathCounterText.x,
        'Counter lies between sword and crystal');
      check(info.contentBottom < 1090, 'Recipe fits panel');
    };
    await showOath(0);
    const info = game.scene.getScene('ItemInfoScene');
    info.recipesVisible = false; info.renderPanel();
    check(info.contentBottom < 1090, 'Sword effects with oath fit panel');
    info.recipesVisible = true; info.renderPanel();
  })()`);
  await evaluate(`(async () => {
    game.resume();
    game.loop.wake();
    for(let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
  })()`);
  const oathScreenshot = await send('Page.captureScreenshot');
  await writeFile(join(output, 'oath-recipe.png'), Buffer.from(oathScreenshot.data, 'base64'));
  for (let count = 1; count <= 3; count++) {
    await evaluate(`(async () => {
      game.scene.getScene('ItemInfoScene').close();
      await waitForScene('ShopScene');
      game.scene.getScene('ShopScene').scene.start('BattleScene', {session});
      await waitForScene('BattleScene');
      const battle = game.scene.getScene('BattleScene');
      battle.combat.result = 'victory'; battle.returnToShop();
      await waitForScene('ShopScene');
      if (${count} < 3) {
        check(session.board.items[0].catalogId === 'knight-greatsword', 'Sword stays until oath completed');
        await showOath(${count});
      } else {
        check(session.board.items.length === 1 && session.board.items[0].catalogId === 'excalibur', 'Mature sword fuses');
      }
    })()`);
  }
  await evaluate(`(async () => {
    const {allItems} = await import('/src/data/shopCatalog.js');
    const {openItemInfo} = await import('/src/utils/openItemInfo.js');
    openItemInfo(game.scene.getScene('ShopScene'), allItems.find(item => item.id === 'bastion-chestplate'));
    await waitForScene('ItemInfoScene');
    check(game.scene.getScene('ItemInfoScene').rarityText.text === 'ÉPICO', 'Bastion displays epic rarity');
  })()`);
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('Endless and oath browser checks passed. Screenshots: ' + output);
} finally {
  socket?.close();
  browser.kill();
}
