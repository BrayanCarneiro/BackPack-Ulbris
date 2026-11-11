// Run with Vite running: node scripts/smoke-character-select.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'character-select-'));
const browser = spawn(process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9241',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9241/json/list')).json()).find(entry => entry.type === 'page'); } catch {}
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
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
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
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.selectionGame = (await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    if (document.querySelectorAll('canvas').length !== 1) throw new Error('Expected one game canvas');
    window.frame = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
    while (!selectionGame.scene.isActive('MenuScene')) await frame();
    selectionGame.scene.stop('MenuScene'); selectionGame.scene.start('LobbyScene'); await frame();
    const play = selectionGame.scene.getScene('LobbyScene').children.list.find(child => child.label?.text === 'Play');
    play.emit('pointerdown', { id: 1 }); play.emit('pointerup', { id: 1 }); await frame();
  })()`);
  assert.equal(await evaluate("selectionGame.scene.isActive('CharacterSelectScene')"), true);
  const click = async (buttonName, touch = false) => {
    const position = await evaluate(`(() => {
      const scene = selectionGame.scene.getScene('CharacterSelectScene');
      const button = scene.${buttonName}; const rect = selectionGame.canvas.getBoundingClientRect();
      return { x: rect.left + button.x / scene.scale.width * rect.width, y: rect.top + button.y / scene.scale.height * rect.height };
    })()`);
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...position, id: 1 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position, button: 'left', clickCount: 1 });
    }
    await evaluate('frame()');
  };
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await new Promise(resolve => setTimeout(resolve, 250));
    await evaluate('frame()');
    assert.equal(await evaluate(`(() => {
      const scene = selectionGame.scene.getScene('CharacterSelectScene');
      return ['selectButton', 'backButton', 'previousButton', 'nextButton'].every(key => {
        const b = scene[key].getBounds(); return b.x >= 0 && b.y >= 0 && b.right <= scene.scale.width && b.bottom <= scene.scale.height;
      });
    })()`), true, `Controls fit ${width}x${height}`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `selection-${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  await click('backButton', true);
  assert.equal(await evaluate("selectionGame.scene.isActive('LobbyScene')"), true);
  await evaluate("selectionGame.scene.stop('LobbyScene'); selectionGame.scene.start('CharacterSelectScene'); frame()");
  await click('selectButton', true);
  assert.equal(await evaluate("selectionGame.scene.getScene('ShopScene').session.classId"), 'arthur');
  await evaluate(`(async () => {
    const scene = selectionGame.scene.getScene('ShopScene');
    const session = scene.session;
    session.buy('traveler-bag'); session.buy('sword');
    Object.assign(session.board.bags[0], { x: 0, y: 0 });
    Object.assign(session.board.items[0], { x: 0, y: 0 });
    selectionGame.scene.stop('ShopScene'); selectionGame.scene.start('BattleScene', { session }); await frame();
  })()`);
  assert.deepEqual(await evaluate(`(() => {
    const scene = selectionGame.scene.getScene('BattleScene');
    return ['player', 'enemy'].map(side => scene.characters[side].body.texture.key);
  })()`), ['arthur-battle-body', 'arthur-battle-body']);
  const battle = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'battle.png'), Buffer.from(battle.data, 'base64'));
  await evaluate(`(() => {
    const scene = selectionGame.scene.getScene('BattleScene');
    scene.battleClock.pause('visual-test');
    window.arena = scene;
  })()`);
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
    await new Promise(resolve => setTimeout(resolve, 250));
    await evaluate('frame()');
    assert.equal(await evaluate(`['player', 'enemy'].every(side => {
      const c = arena.characters[side]; const b = c.healthText.getBounds();
      return b.left >= 0 && b.right <= arena.scale.width && c.bodyHeight >= 208;
    })`), true, `Battle HUD fits ${width}x${height}`);
    const image = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `arena-${width}x${height}.png`), Buffer.from(image.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise(resolve => setTimeout(resolve, 250));
  await evaluate('frame()');
  assert.equal(await evaluate(`(() => {
    const c = arena.characters.player;
    c.attack({ hit: true, critical: true });
    const animation = c.attackSprite.anims.currentAnim;
    c.attack({ hit: true, extra: true });
    return c.attackVariant === 'critical' && animation.key === 'arthur-attack-critical'
      && c.attackSprite.anims.currentAnim === animation && c.attackSprite.anims.isPlaying;
  })()`), true, 'Concurrent attacks do not enqueue or interrupt a critical');
  await waitFor('!arena.characters.player.attacking');
  assert.equal(await evaluate('arena.characters.player.attacking'), false, 'Attack unlocks after finishing');
  for (const [variant, event] of [['normal', { hit: true }], ['quick', { hit: true }],
    ['critical', { hit: true, critical: true }], ['normal', { hit: true }], ['quick', { hit: true }]]) {
    await evaluate(`(() => {
      arena.characters.player.attack(${JSON.stringify(event)});
      arena.characters.enemy.attack(${JSON.stringify(event)});
    })()`);
    await waitFor('arena.characters.player.attackSprite.anims.currentFrame.index >= 4');
    assert.deepEqual(await evaluate(`(() => {
      const c = arena.characters.player; c.attackSprite.anims.pause();
      arena.characters.enemy.attackSprite.anims.pause();
      return [c.attackSprite.anims.currentAnim.key, c.attackSprite.visible, c.body.visible];
    })()`), [`arthur-attack-${variant}`, true, false], `${variant} advances through its own frames`);
    const strike = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `attack-${variant}.png`), Buffer.from(strike.data, 'base64'));
    await evaluate('arena.characters.player.attackSprite.anims.resume(); arena.characters.enemy.attackSprite.anims.resume(); void 0;');
    await waitFor('!arena.characters.player.attacking && !arena.characters.enemy.attacking');
    assert.equal(await evaluate('arena.characters.player.body.visible && !arena.characters.player.attackSprite.visible'), true, 'Returns to guard');
  }
  const durations = [];
  for (const cooldowns of [[3], [3, 1.3], [3, 0.91]]) {
    durations.push(await evaluate(`(() => {
      const c = arena.characters.player;
      c.fighter = { ...arena.combat.fighters.player, weapons: ${JSON.stringify(cooldowns)}.map(cooldown => ({ cooldown })) };
      c.attack({ hit: true });
      return c.attackDurationMs;
    })()`));
    await waitFor('!arena.characters.player.attacking');
  }
  assert.ok(durations[0] > durations[1] && durations[1] > durations[2], 'Fastest equipped weapon and haste accelerate the full animation');
  await evaluate(`(() => {
    const c = arena.characters.player;
    c.fighter = arena.combat.fighters.player;
    c.attack({ hit: true });
    const rate = c.attackPlaybackRate;
    arena.battleSpeed = 3; arena.syncBattleSpeed();
    if (c.attackSprite.anims.timeScale !== rate * 3) throw new Error('Speed must preserve weapon acceleration');
  })()`);
  await waitFor('!arena.characters.player.attacking');
  await evaluate('arena.battleSpeed = 1; arena.syncBattleSpeed(); void 0;');
  assert.equal(await evaluate(`(() => {
    const c = arena.characters.player;
    c.defend({ blocked: 3, healthDamage: 0, armorDamage: 0 });
    if (c.shaking) return false;
    c.defend({ healthDamage: 1 });
    return c.shaking && !c.attacking;
  })()`), true, 'Only damaging hits trigger the small impact');
  await waitFor('!arena.characters.player.shaking');
  assert.equal(await evaluate('arena.characters.player.shaking'), false);
  assert.equal(await evaluate(`(() => {
    const c = arena.characters.player; const fighter = arena.combat.fighters.player;
    c.refresh({ ...fighter, burns: [{}] }, 1);
    return c.aura.visible;
  })()`), true, 'Burn aura turns on');
  const burn = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'arena-burn.png'), Buffer.from(burn.data, 'base64'));
  assert.equal(await evaluate(`(() => {
    const c = arena.characters.player;
    c.refresh({ ...arena.combat.fighters.player, burns: [] }, 1);
    return c.aura.visible;
  })()`), false, 'Burn aura clears when the status ends');
  await evaluate(`(() => {
    arena.combat.fighters.enemy.health = 0;
    arena.combat.result = 'victory'; arena.returnScheduled = true;
    arena.refreshCombat();
  })()`);
  await waitFor('Math.round(arena.characters.player.sword.angle) === -8');
  assert.deepEqual(await evaluate(`(() => {
    const { player, enemy } = arena.characters;
    return [player.ended, enemy.ended, Math.round(player.sword.angle), enemy.body.texture.key, enemy.aura.visible];
  })()`), ['victory', 'dead', -8, 'arthur-battle-body-gray', false]);
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'arena-victory.png'), Buffer.from(result.data, 'base64'));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify({ result: 'passed', screenshots: output, errors: errors.length }));
} finally {
  socket?.close();
  browser.kill();
}
