// Run with Vite running: node scripts/smoke-preparation.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'preparation-browser-'));
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
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
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
  for(const [width,height,touch] of [[1440,900,false],[390,844,true]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
    await send('Emulation.setTouchEmulationEnabled',{enabled:touch});
    await evaluate(`(async()=>{
      const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      window.prepSession=new ShoppingSession({random:()=>0.5});prepSession.gold=100;
      window.prep=await smokeStart('ShopScene',{session:prepSession});
      window.prepAssert=()=>{
        const l=prep.preparationLayout;
        smokeAssert(prep.offersLayer.list.length===6,'all six offers visible');
        const first=prep.offersLayer.list[0].getBounds();
        smokeAssert(l.wide?first.right<l.board.x:first.bottom<l.board.y,'shop is left or above board');
        smokeAssert(l.wide?prep.boardView.reserve.bounds.x===l.board.x:prep.boardView.reserve.bounds.x>=l.board.x+l.board.cellSize*8,'reserve follows board');
        smokeAssert(l.board.sell.x+l.board.sell.width<=l.width,'sale stays in bounds');
        smokeAssert(prep.battleButton.y+prep.battleButton.height/2<l.height,'battle stays visible');
      };
      window.prepCard=index=>prep.offersLayer.list[index%prep.preparationLayout.offersPerPage];
      prepAssert();
    })()`);
    const choosePage=async index=>{
      const page=await evaluate(`Math.floor(${index}/prep.preparationLayout.offersPerPage)`);
      while(await evaluate('prep.offerPage')!==page)await tap('prep.pageButtons[1]',touch);
    };
    for(const index of [0,1,2,4]){
      await choosePage(index);
      await tap(`({x:prepCard(${index}).x+prepCard(${index}).buyButton.x,y:prepCard(${index}).y+prepCard(${index}).buyButton.y})`,touch);
    }
    await evaluate(`(()=>{
      smokeAssert(prepSession.board.bags.length===1&&prepSession.board.items.length===3,'purchases reach shared session');
      smokeAssert(prep.boardView.views.length===4,'purchases appear immediately in reserve');
      smokeAssert(prepSession.gold===86,'purchase prices unchanged');
    })()`);
    const target=(x,y,w,h)=>`({x:prep.preparationLayout.board.x+(${x}+${w}/2)*prep.preparationLayout.board.cellSize,y:prep.preparationLayout.board.y+(${y}+${h}/2)*prep.preparationLayout.board.cellSize})`;
    await drag('traveler-bag',target(0,0,4,4),touch);
    await drag('sword',target(0,0,1,3),touch);
    await drag('shield',target(2,0,2,2),touch);
    await drag('refined-iron',target(1,0,1,1),touch);
    await evaluate(`(()=>{
      smokeAssert(prepSession.board.bags[0].x===0,'bag drag places bag: '+JSON.stringify({bag:prepSession.board.bags[0],innerWidth,innerHeight,layout:prep.preparationLayout,rect:document.querySelector('canvas').getBoundingClientRect().toJSON(),reserve:prep.boardView.reserve.bounds}));
      smokeAssert(prepSession.board.items.every(i=>i.x!==null),'item drags place items');
      smokeAssert(prep.fusionStatus.text.includes('Espada de ferro'),'sword fusion shown');
    })()`);
    await drag('refined-iron',target(1,0,1,1),touch);
    await evaluate(`smokeAssert(prep.fusionStatus.text.includes('Escudo de ferro'),'drag alternates fusion')`);
    await tap('prep.rotateButton',touch);
    await evaluate(`smokeAssert(prepSession.board.items.find(i=>i.id==='refined-iron').rotation===90,'rotate works once')`);
    await tap('prep.infoButton',touch);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('ItemInfoScene')&&prep.sys.isPaused(),'info pauses preparation')`);
    await tap('({x:smokeGame.scene.getScene("ItemInfoScene").closeButton.x,y:smokeGame.scene.getScene("ItemInfoScene").closeButton.y-smokeGame.scene.getScene("ItemInfoScene").cameras.main.scrollY})',touch);
    await evaluate(`smokeAssert(prep.sys.isActive()&&prep.input.enabled,'info returns to preparation')`);
    await choosePage(3);
    await tap('({x:prepCard(3).x+prepCard(3).buyButton.x,y:prepCard(3).y+prepCard(3).buyButton.y})',touch);
    await drag('potion','({x:prep.boardView.sellZone.bounds.x+prep.boardView.sellZone.bounds.width/2,y:prep.boardView.sellZone.bounds.y+prep.boardView.sellZone.bounds.height/2})',touch);
    await evaluate(`(()=>{smokeAssert(!prepSession.owns('potion'),'drag sells reserve item');smokeAssert(prepSession.gold===85,'sale updates gold');})()`);
    await choosePage(5);
    await tap('({x:prepCard(5).x+prepCard(5).lockButton.x,y:prepCard(5).y+prepCard(5).lockButton.y})',touch);
    await tap('prep.rerollButton',touch);
    await evaluate(`smokeAssert(prepSession.offers[5].id==='long-bag'&&prepSession.offers[5].locked,'lock survives reroll')`);
    await tap('prep.boardView.reserve.button',touch);
    await evaluate(`smokeAssert(prep.boardView.reserve.expanded,'reserve expands')`);
    await tap('prep.boardView.reserve.button',touch);
    const state=await evaluate('JSON.stringify({items:prepSession.board.items,bags:prepSession.board.bags,gold:prepSession.gold,offers:prepSession.offers})');
    await send('Emulation.setDeviceMetricsOverride',{width:touch?1440:390,height:touch?900:844,deviceScaleFactor:1,mobile:!touch});
    await evaluate('smokeWait()');
    await evaluate(`prepAssert();smokeAssert(JSON.stringify({items:prepSession.board.items,bags:prepSession.board.bags,gold:prepSession.gold,offers:prepSession.offers})===${JSON.stringify(state)},'resize preserves all state');smokeAssert(prep.input.keyboard.listenerCount('keydown-SPACE')===1,'one rotation listener after resize')`);
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
    await evaluate('smokeWait()');
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    const screenshotPath=join(output,`preparation-${width}.png`);
    await writeFile(screenshotPath,Buffer.from(screenshot.data,'base64'));
    console.log(JSON.stringify({width,passed:true,screenshotPath,geometry:await evaluate('({innerWidth,innerHeight,logical:[prep.scale.width,prep.scale.height],parent:[prep.scale.parentSize.width,prep.scale.parentSize.height],display:[prep.scale.displaySize.width,prep.scale.displaySize.height],rect:document.querySelector("canvas").getBoundingClientRect().toJSON()})')}));
    await tap('prep.battleButton',touch);
    await evaluate(`(async()=>{
      smokeAssert(smokeGame.scene.isActive('BattleScene'),'battle starts from preparation');
      const battle=smokeGame.scene.getScene('BattleScene');battle.combat.result='victory';battle.returnToShop();await smokeWait();
      window.prep=smokeGame.scene.getScene('ShopScene');
      smokeAssert(prep.session===prepSession&&prepSession.round===2,'battle returns same session');
      smokeAssert(prepSession.board.items.find(i=>i.id==='shield').catalogId==='iron-shield','selected fusion honored');
      smokeAssert(prepSession.board.items.find(i=>i.id==='sword').catalogId==='sword','other equipment unchanged');
      prepAssert();
    })()`);
  }
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('Preparation browser checks passed. Screenshots: '+output);
}finally{socket?.close();browser.kill();}
