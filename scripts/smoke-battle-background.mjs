// Run with Vite running: node scripts/smoke-preparation.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'battle-background-'));
const edge = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debugPort = process.env.BATTLE_BACKGROUND_DEBUG_PORT ?? 9256;
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
  await evaluate(`(async()=>{
    const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
    window.session=new ShoppingSession({classId:'arthur',opponentSeed:7});
    session.buy('sword'); session.board.move('item','sword',0,0);
    window.prep=await smokeStart('ShopScene',{session});
    // Phaser starts with this flag false even when the document is focused.
    smokeGame.hasFocus=false;
  })()`);
  await tap('prep.battleButton');
  await new Promise(resolve=>setTimeout(resolve,800));
  const startup=await evaluate(`(()=>{
    window.battle=smokeGame.scene.getScene('BattleScene');
    return {elapsed:battle.combat.elapsedMs,pauses:[...battle.battleClock.pauses],hasFocus:smokeGame.hasFocus};
  })()`);
  assert.ok(startup.elapsed>=500,`Combat starts without a focus event: ${JSON.stringify(startup)}`);
  console.log(JSON.stringify({startup}));
  const other=await send('Target.createTarget',{url:'about:blank'});
  await send('Target.activateTarget',{targetId:other.targetId});
  let hidden;
  for(let i=0;i<20;i++) {
    await new Promise(resolve=>setTimeout(resolve,200));
    hidden=await evaluate(`({hidden:document.hidden,elapsed:battle.combat.elapsedMs,pauses:[...battle.battleClock.pauses]})`);
    if(hidden.elapsed-startup.elapsed>=500)break;
  }
  assert.equal(hidden.hidden,true,'The game tab is really hidden');
  assert.ok(hidden.elapsed-startup.elapsed>=500,'Combat advances in the hidden tab despite throttled timers');
  console.log(JSON.stringify({hidden}));
  await send('Page.bringToFront');
  await evaluate('smokeWait()');
  // Opening an item sheet is still an intentional gameplay pause.
  await evaluate(`(async()=>{
    const {openItemInfo}=await import('/src/utils/openItemInfo.js');
    openItemInfo(battle,session.board.items[0]);await smokeWait();
    window.modalElapsed=battle.combat.elapsedMs;
  })()`);
  await send('Target.activateTarget',{targetId:other.targetId});
  await new Promise(resolve=>setTimeout(resolve,1000));
  assert.equal(await evaluate('battle.combat.elapsedMs'),await evaluate('modalElapsed'),'Item sheet pauses background simulation');
  await send('Page.bringToFront');
  await evaluate(`(async()=>{smokeGame.scene.getScene('ItemInfoScene').close();await smokeWait();})()`);
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.ok(await evaluate('battle.combat.elapsedMs>modalElapsed'),'Closing item sheet resumes combat');
  // Model a browser that suspends every callback, then resumes with a time gap.
  await evaluate(`(()=>{
    battle.battleClock.previous-=2000;
    const before=battle.combat.elapsedMs;
    battle.update();window.catchup=battle.combat.elapsedMs-before;
  })()`);
  assert.ok(await evaluate('catchup')>=1900,'Suspended callback time is recovered on the next update');
  // Finish while hidden, persist the result immediately, and apply it once.
  await evaluate(`(()=>{battle.battleSpeed=3;battle.combat.fighters.enemy.health=1;})()`);
  await send('Target.activateTarget',{targetId:other.targetId});
  for(let i=0;i<60;i++) {
    if(await evaluate('Boolean(battle.combat.result&&battle.battleReport)'))break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  const finished=await evaluate(`(async()=>{
    const {loadRun}=await import('/src/systems/RunSave.js');
    const saved=loadRun();
    return {hidden:document.hidden,result:battle.combat.result,round:session.round,wins:session.wins,
      savedRound:saved.session?.round,report:!!battle.battleReport};
  })()`);
  assert.equal(finished.hidden,true);
  assert.ok(finished.result&&finished.report,'Background combat completes');
  assert.equal(finished.savedRound,2,'Result is saved before returning to the tab');
  await new Promise(resolve=>setTimeout(resolve,3100));
  await send('Page.bringToFront');
  await evaluate('smokeWait()');
  assert.equal(await evaluate('smokeGame.scene.isActive("ShopScene")'),true,'Return to shop after background combat');
  const after=await evaluate(`({round:session.round,wins:session.wins,losses:session.losses,draws:session.draws,
    pending:session.pendingFusions,timer:battle.backgroundTimer})`);
  assert.equal(after.round,2);
  assert.equal(after.wins+after.losses+after.draws,1,'Only one result is applied');
  assert.equal(after.timer,null,'Background timer is cleaned up');
  console.log(JSON.stringify({finished,after}));
  for(let attempt=0;attempt<3;attempt++) {
    await evaluate(`(async()=>{
      const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      const s=new ShoppingSession({classId:'arthur'});s.buy('sword');s.board.move('item','sword',0,0);
      window.prep=await smokeStart('ShopScene',{session:s});smokeGame.hasFocus=false;
    })()`);
    await tap('prep.battleButton');
    await new Promise(resolve=>setTimeout(resolve,350));
    const repeated=await evaluate(`(async()=>{
      const b=smokeGame.scene.getScene('BattleScene'),elapsed=b.combat.elapsedMs;
      await smokeStart('LobbyScene');
      return {elapsed,timer:b.backgroundTimer,round:b.session.round};
    })()`);
    assert.ok(repeated.elapsed>=200,'Every new battle starts without focus');
    assert.equal(repeated.timer,null,'Leaving an unfinished battle cancels the timer');
    assert.equal(repeated.round,1,'Leaving an unfinished battle does not grant a result');
  }
  await evaluate(`(async()=>{
    const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
    const s=new ShoppingSession({classId:'arthur'});
    s.buy('sword');s.buy('refined-iron');s.board.move('item','sword',0,0);s.board.move('item','refined-iron',1,1);
    const b=await smokeStart('BattleScene',{session:s});
    b.combat.result='victory';b.finalizeBattle();b.finalizeBattle();
    smokeAssert(s.round===2&&s.wins===1,'result commits once');
    smokeAssert(s.board.items[0].catalogId==='iron-sword','fusion is committed');
    smokeAssert(b.board.items[0].catalogId==='sword'&&b.board.items.length===2,'arena preserves the formation that fought');
    await smokeStart('LobbyScene');
  })()`);
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('Battle background checks passed.');
} finally {socket?.close();browser.kill();}
