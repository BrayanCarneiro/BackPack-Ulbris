// Run with the Vite server running: node scripts/smoke-weapons.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'weapons-browser-'));
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
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('Boolean(document.querySelector("canvas"))')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate(`(async () => {
    window.smokeGame = (await import(document.querySelector('script[src*="/src/main.js"]').src)).default;
    if(document.querySelectorAll('canvas').length!==1) throw new Error('Expected one game canvas');
    window.smokeWait = async () => {
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
  if (process.argv.includes('--speed-only')) {
    await evaluate(`(async()=>{
      const {default: ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      const session=new ShoppingSession({random:()=>0.5});
      for(const id of ['traveler-bag','sword','shield']) session.buy(id);
      session.board.move('bag','traveler-bag',0,0);
      session.board.move('item','sword',0,0); session.board.move('item','shield',1,0);
      const battle=await smokeStart('BattleScene',{session});
      for(const fighter of Object.values(battle.combat.fighters)) {
        fighter.health=10000;fighter.maxHealth=10000;
      }
      smokeTap(battle.speedButton); smokeTap(battle.speedButton);
      window.speedBattle=battle; window.speedFrames=[];
      battle.events.on('update',(time,delta)=>{speedFrames.push({time:performance.now(),delta,
        raw:smokeGame.loop.rawDelta,speed:battle.battleSpeed,tween:battle.tweens.timeScale,
        elapsed:battle.combat.elapsedMs+battle.combat.accumulator});});
    })()`);
    const snapshot=()=>evaluate(`({time:performance.now(),elapsed:speedBattle.combat.elapsedMs+speedBattle.combat.accumulator,
      speed:speedBattle.battleSpeed,tween:speedBattle.tweens.timeScale,visible:document.visibilityState})`);
    for(let cycle=0;cycle<3;cycle++) {
      const before=await snapshot();
      const other=await send('Target.createTarget',{url:'about:blank'});
      await send('Target.activateTarget',{targetId:other.targetId});
      await new Promise(resolve=>setTimeout(resolve,1500));
      const hidden=await snapshot();
      await send('Target.activateTarget',{targetId:page.id});
      await send('Page.bringToFront');
      const start=await snapshot();
      await new Promise(resolve=>setTimeout(resolve,1000));
      const end=await snapshot();
      const ratio=(end.elapsed-start.elapsed)/(end.time-start.time);
      console.log(JSON.stringify({cycle,before,hidden,start,end,ratio,
        frames:await evaluate('speedFrames.slice(-5)')}));
      assert.equal(end.speed,3);assert.equal(end.tween,3);
      assert.ok(ratio>2.6&&ratio<3.4,`3x did not resume immediately: ${ratio}`);
      assert.ok(hidden.elapsed-before.elapsed<300,'Battle advanced while hidden');
      await send('Target.closeTarget',{targetId:other.targetId});
    }
  }
  if (!process.argv.includes('--bow-only') && !process.argv.includes('--speed-only')) for (const [width, height] of [[1440, 900], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    const result = await evaluate(`(async () => {
      const {allItems} = await import('/src/data/shopCatalog.js');
      const {openItemInfo} = await import('/src/utils/openItemInfo.js');
      const catalog = await smokeStart('ItemCatalogScene');
      catalog.page = Math.floor(allItems.findIndex(i=>i.id==='flaming-daggers')/12);
      catalog.renderCatalog();
      const zones = catalog.children.list.filter(o=>o.type==='Zone');
      smokeAssert(zones.every(o=>o.y+o.height/2<1000),'Catalog overlaps pagination');
      const index=allItems.findIndex(i=>i.id==='flaming-daggers')%12;
      smokeTap(zones[index]); await smokeWait();
      const info = smokeGame.scene.getScene('ItemInfoScene');
      smokeAssert(info.details.id==='flaming-daggers','Catalog item did not open');
      smokeAssert(info.details.effects.some(t=>t.includes('20%')),'Burn description missing');
      smokeAssert(info.details.effects.some(t=>t.includes('2 de dano')),'Burn damage text outdated');
      smokeAssert(info.details.effects.some(t=>t.includes('totalmente bloqueados')),'Block counter text missing');
      smokeAssert(Object.fromEntries(info.details.attributes).Dano==='1,4','Flaming dagger damage outdated');
      smokeAssert(Object.fromEntries(info.details.attributes)['Estamina por ataque']==='0,8','Flaming dagger stamina outdated');
      smokeAssert(info.children.list.filter(o=>o.type==='Text'&&o.y>=660).every(o=>o.y+o.height<1110),'Effects overlap close button');
      for(const id of ['iron-shield','haste-stone','hatchet','battle-axe']) {
        info.item=allItems.find(item=>item.id===id);info.renderPanel();
        if(id==='iron-shield')smokeAssert(Object.fromEntries(info.details.attributes)['Armadura inicial']==='+9','Shield description outdated');
        else if(id==='haste-stone')smokeAssert(info.details.effects.some(t=>t.includes('27,1%')),'Haste stacking text missing');
        else {
          smokeAssert(info.details.piece.cells.length===(id==='hatchet'?3:4),'Axe cell count incorrect');
          smokeAssert(!info.details.effects.some(t=>t.includes('Estrelas de fus')),'Axes must not show fusion stars');
          if(id==='hatchet')smokeAssert(info.details.recipes[0].placement==='adjacent','Hatchet recipe must use contact');
        }
        smokeAssert(info.children.list.filter(o=>o.type==='Text'&&o.y>=660).every(o=>o.y+o.height<1110),'Updated effects overflow');
      }
      info.item=allItems.find(item=>item.id==='flaming-daggers');info.renderPanel();
      smokeTap(info.recipeButton); await smokeWait();
      smokeAssert(info.recipesVisible,'Recipe panel did not open');
      smokeAssert(info.children.list.some(o=>o.type==='Text'&&o.text==='Pedra de fogo'),'Recipe ingredient missing');
      smokeTap(info.children.list.filter(o=>o.type==='Zone')[1]); await smokeWait();
      smokeAssert(info.details.id==='fire-stone','Recipe navigation failed');
      info.close(); await smokeWait();
      smokeAssert(catalog.sys.isActive(),'Catalog did not resume');
      const {default: ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      const {default: Combat}=await import('/src/systems/Combat.js');
      const session=new ShoppingSession({random:()=>0.5});
      session.gold=100;
      const ids=['traveler-bag','quick-daggers','fire-stone','hatchet','hatchet'];
      session.offers=ids.map(id=>({id,sold:false,locked:false}));
      for(const id of ids) smokeAssert(session.buy(id)===null,'Purchase failed: '+id);
      session.board.move('bag','traveler-bag',0,0);
      session.board.items.forEach((item,i)=>{
        const [x,y]=[[0,0],[1,0],[1,2],[2,0]][i];
        smokeAssert(session.board.move('item',item.id,x,y)===null,'Ingredient placement failed: '+item.catalogId);
      });
      session.beginBattle();
      const fight=new Combat(session.board,{bags:[],items:[]},{random:()=>0.1});
      fight.advance(180000);
      const report=session.finishBattle(fight.result);
      smokeAssert(report.fusions===2,'Fusion report failed');
      const shop=await smokeStart('ShopScene',{session,report});
      smokeAssert(shop.status.text.includes('Adagas flamejantes')&&shop.status.text.includes('Machado de batalha'),'Shop fusion report missing');
      const battle=await smokeStart('BattleScene',{session});
      battle.scene.pause(); battle.combat.random=()=>0.1;
      smokeAssert(battle.backpacks.player.itemViews.some(view=>view.item.catalogId==='battle-axe'
        &&view.item.cells?.length===4),'Axe fusion shape missing from battle');
      battle.combat.fighters.enemy.health=200; battle.combat.fighters.enemy.maxHealth=200;
      battle.combat.fighters.enemy.armor=0;
      battle.combat.fighters.enemy.shields=[];
      smokeAdvanceBattle(battle,3300);
      smokeAssert(battle.characters.enemy.statusText.text.includes('Queimadura'),'Burn badge missing');
      smokeAssert(battle.characters.enemy.statusText.text.includes('Atordoado'),'Stun badge missing');
      smokeAssert(battle.lastMessage.includes('queimadura'),'Burn feedback missing');
      window.smokeBattle=battle;
      return {width:${width},items:allItems.length,fusions:report.fusions,status:battle.characters.enemy.statusText.text};
    })()`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `battle-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    await evaluate(`(async()=>{
      smokeBattle.scene.resume();
      const {openItemInfo}=await import('/src/utils/openItemInfo.js');
      openItemInfo(smokeBattle,smokeBattle.session.board.items.find(i=>i.catalogId==='flaming-daggers'));
      await smokeWait();
      smokeAssert(smokeBattle.sys.isPaused(),'Inspect did not pause battle');
    })()`);
    const infoScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `item-${width}.png`), Buffer.from(infoScreenshot.data, 'base64'));
    console.log(JSON.stringify(result));
  }
  if (!process.argv.includes('--speed-only')) for (const [width, height] of [[1440, 900], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await evaluate(`(async()=>{
      const {default: ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      const {packingLayout}=await import('/src/config/packingLayout.js');
      const {openItemInfo}=await import('/src/utils/openItemInfo.js');
      const session=new ShoppingSession({random:()=>0.5}); session.gold=100;
      const ids=['traveler-bag','bow','potion'];
      session.offers=ids.map(id=>({id,sold:false,locked:false}));
      for(const id of ids) smokeAssert(session.buy(id)===null,'Bow purchase failed');
      session.board.move('bag','traveler-bag',0,0);
      smokeAssert(session.board.move('item','bow',0,0)===null,'Bow placement failed');
      smokeAssert(session.board.move('item','potion',1,1)===null,'Potion did not fit in bow hole');
      const scene=await smokeStart('GameScene',{session});
      const object=scene.children.list.find(o=>o.type==='Container'&&o.list?.some(child=>child.text==='Arco'));
      smokeAssert(object,'Bow view missing');
      const cell=packingLayout.cellSize;
      smokeAssert(!object.input.hitAreaCallback(object.input.hitArea,cell*1.5,cell*1.5),'Bow hole captures clicks');
      smokeAssert(object.input.hitAreaCallback(object.input.hitArea,cell*0.5,cell*1.5),'Bow spine does not capture clicks');
      smokeAssert(object.list[0].visible===false,'Solid rectangle covers bow hole');
      window.smokeBowSession=session; window.smokeBowScene=scene;
      await smokeWait();
    })()`);
    let screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`bow-packing-${width}.png`),Buffer.from(screenshot.data,'base64'));
    await evaluate(`(async()=>{
      const {openItemInfo}=await import('/src/utils/openItemInfo.js');
      openItemInfo(smokeBowScene,smokeBowSession.board.items.find(i=>i.id==='bow')); await smokeWait();
      const info=smokeGame.scene.getScene('ItemInfoScene');
      smokeAssert(info.details.piece.cells.length===5,'Bow info shape missing');
      smokeAssert(info.children.list.some(o=>o.type==='Text'&&o.text.includes('5 espaços')),'Bow occupied slot count missing');
    })()`);
    screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`bow-info-${width}.png`),Buffer.from(screenshot.data,'base64'));
    await evaluate(`(async()=>{
      const battle=await smokeStart('BattleScene',{session:smokeBowSession});
      battle.scene.pause(); smokeAdvanceBattle(battle,1400); await smokeWait();
      const view=battle.backpacks.player.itemViews.find(v=>v.item.id==='bow');
      smokeAssert(view.background.type==='Graphics'&&view.colorFill.type==='Graphics','Bow combat shape not rendered');
      smokeAssert(!view.object.input.hitAreaCallback(view.object.input.hitArea,view.cell*1.5,view.cell*1.5),'Combat bow hole captures clicks');
    })()`);
    screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`bow-battle-${width}.png`),Buffer.from(screenshot.data,'base64'));
    console.log(JSON.stringify({width,bowCells:5,holeFitsPotion:true}));
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(`Browser checks passed. Screenshots: ${output}`);
} finally {
  socket?.close();
  browser.kill();
}
