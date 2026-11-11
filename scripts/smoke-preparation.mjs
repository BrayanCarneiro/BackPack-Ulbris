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
  for(const [width,height,touch] of (process.argv.includes('--crystals-only') ? [] : [[1440,900,false],[390,844,true]])){
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
  for (const [width,height] of [[1440,900],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    for (const id of ['blue-crystal','red-crystal','white-crystal','black-crystal','golden-crystal']) {
      await evaluate(`(async()=>{
        const info=await smokeStart('ItemInfoScene',{item:'${id}',sourceKey:'ShopScene'});
        smokeAssert(info.details.id==='${id}','crystal details open');
        smokeAssert(info.rarityText.text===info.details.rarity.name.toUpperCase(),'rarity is visible on item details');
        smokeAssert(info.contentBottom<1086,'crystal effects fit above footer: '+info.contentBottom);
        smokeTap(info.recipeButton);await smokeWait();
        smokeAssert(info.recipeZones.length===5,'four colors and golden result are visible');
        smokeAssert(info.contentBottom<1086,'crystal recipe fits above footer');
      })()`);
    }
    await evaluate(`smokeTap(smokeGame.scene.getScene('ItemInfoScene').detailsButton);smokeWait()`);
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`golden-crystal-${width}.png`),Buffer.from(screenshot.data,'base64'));
    for (const coordinates of [[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[0,1],[1,1]]]) {
      await evaluate(`(async()=>{
        const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
        const {allItems}=await import('/src/data/shopCatalog.js');
        const make=(id,x,y)=>({...allItems.find(item=>item.id===id),catalogId:id,x,y});
        const coordinates=${JSON.stringify(coordinates)};
        const session=new ShoppingSession();
        session.board.bags.push(make('traveler-bag',0,0));
        session.board.items.push(...['blue-crystal','red-crystal','white-crystal','black-crystal']
          .map((id,i)=>make(id,...coordinates[i])));
        const prep=await smokeStart('ShopScene',{session});
        smokeAssert(prep.fusionStatus.text.includes('Cristal dourado'),'golden fusion named in preparation');
        smokeAssert(prep.fusionStatus.style.color==='#91bf9b','connected crystals show green readiness');
        session.board.store('item','black-crystal');prep.boardView.refresh();
        smokeAssert(prep.fusionStatus.style.color!=='#91bf9b','storing a crystal clears readiness');
        smokeAssert(session.board.move('item','black-crystal',...coordinates[3])===null,'crystal reconnected');
        prep.boardView.refresh();
        smokeAssert(prep.fusionStatus.style.color==='#91bf9b','reconnection restores green readiness');
        await smokeWait();
      })()`);
    }
    const fusionScreenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`golden-fusion-${width}.png`),Buffer.from(fusionScreenshot.data,'base64'));
    await evaluate(`(()=>{
      const prep=smokeGame.scene.getScene('ShopScene');
      window.clearSession=prep.session;
      window.clearInventory=pieces=>JSON.stringify(pieces.map(({x,y,fusionTargetId,rotation=0,...piece})=>({...piece,rotation})));
      window.beforeClear=clearInventory([...clearSession.board.bags,...clearSession.board.items]);
      window.beforeClearShop=JSON.stringify({gold:clearSession.gold,offers:clearSession.offers,round:clearSession.round});
      const bounds=prep.clearButton.getBounds(), rotate=prep.rotateButton.getBounds(), info=prep.infoButton.getBounds();
      smokeAssert(bounds.left>=0&&bounds.right<=prep.scale.width,'clear button stays on screen');
      smokeAssert(bounds.bottom<=rotate.top||bounds.right<=rotate.left||bounds.left>=rotate.right,'clear and rotate buttons do not overlap');
      smokeAssert(bounds.bottom<=info.top||bounds.right<=info.left||bounds.left>=info.right,'clear and info buttons do not overlap');
    })()`);
    await tap('smokeGame.scene.getScene("ShopScene").clearButton',width<500);
    await evaluate(`(()=>{
      const prep=smokeGame.scene.getScene('ShopScene');
      smokeAssert([...clearSession.board.bags,...clearSession.board.items].every(piece=>piece.x===null&&piece.y===null),'clear stores equipment and occupied bags');
      smokeAssert(beforeClear===clearInventory([...clearSession.board.bags,...clearSession.board.items]),'clear preserves all pieces and attributes');
      smokeAssert(beforeClearShop===JSON.stringify({gold:clearSession.gold,offers:clearSession.offers,round:clearSession.round}),'clear preserves shop and gold');
      smokeAssert(prep.boardView.reserve.expanded&&!prep.boardView.selected,'reserve opens and selection clears');
      smokeAssert(prep.fusionStatus.style.color!=='#91bf9b','clear removes fusion readiness');
      smokeAssert(clearSession.getCompletionError(),'empty board cannot enter battle');
    })()`);
    await tap('smokeGame.scene.getScene("ShopScene").clearButton',width<500);
    await evaluate(`smokeAssert(beforeClear===clearInventory([...clearSession.board.bags,...clearSession.board.items]),'clearing twice is safe')`);
    const clearScreenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`clear-backpack-${width}.png`),Buffer.from(clearScreenshot.data,'base64'));
    await evaluate(`(async()=>{
      const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      const session=new ShoppingSession();
      session.offers=['sword','refined-iron','bow','fire-stone','haste-stone','regeneration-potion']
        .map(id=>({id,sold:false,locked:false}));
      const prep=await smokeStart('ShopScene',{session});
      const labels=prep.offersLayer.list.map(card=>card.rarityText.text);
      smokeAssert(labels[0]==='COMUM'&&labels[1]==='INCOMUM'&&labels[2]==='RARO','shop displays rarity tiers');
      for(const card of prep.offersLayer.list){
        const tag=card.rarityText.getBounds(),category=card.categoryText.getBounds(),price=card.priceText.getBounds();
        smokeAssert(category.right<tag.left&&tag.right<price.left,'rarity does not overlap category or price');
      }
      await smokeWait();
    })()`);
    const rarityScreenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`rarity-shop-${width}.png`),Buffer.from(rarityScreenshot.data,'base64'));
    await evaluate(`(async()=>{
      const catalog=await smokeStart('ItemCatalogScene');catalog.page=2;catalog.renderCatalog();await smokeWait();
      smokeAssert(catalog.children.list.some(object=>object.text?.includes('Épico')),'catalog displays epic rarity');
    })()`);
    const catalogScreenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`rarity-catalog-${width}.png`),Buffer.from(catalogScreenshot.data,'base64'));
    await tap('smokeGame.scene.getScene("ItemCatalogScene").typeButton',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").filterOptions.find(option=>option.filterValue==="armor")',width<500);
    await evaluate(`(()=>{const catalog=smokeGame.scene.getScene('ItemCatalogScene');
      smokeAssert(catalog.typeFilter==='armor'&&catalog.filteredItems.length===7&&catalog.page===0,'type filter resets pagination');
      smokeAssert(!catalog.filterMenu,'selection closes dropdown');
    })()`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").rarityButton',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").filterOptions.find(option=>option.filterValue==="rare")',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").nameButton',width<500);
    await evaluate(`(()=>{const catalog=smokeGame.scene.getScene('ItemCatalogScene');
      smokeAssert(catalog.filteredItems.length===2&&catalog.filteredItems[0].id==='iron-helmet','combined filters and A-Z');
    })()`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").nameButton',width<500);
    await evaluate(`(()=>{const catalog=smokeGame.scene.getScene('ItemCatalogScene');
      smokeAssert(catalog.filteredItems[0].id==='iron-shield'&&catalog.nameDirection==='desc','name toggles to Z-A');
      smokeAssert(catalog.typeButton.getBounds().bottom<catalog.itemZones[0].getBounds().top,'filters stay above cards');
    })()`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").itemZones[0]',width<500);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('ItemInfoScene')&&smokeGame.scene.getScene('ItemCatalogScene').sys.isPaused(),'filtered item opens details')`);
    await tap('({x:smokeGame.scene.getScene("ItemInfoScene").closeButton.x,y:smokeGame.scene.getScene("ItemInfoScene").closeButton.y-smokeGame.scene.getScene("ItemInfoScene").cameras.main.scrollY})',width<500);
    await evaluate(`(()=>{const catalog=smokeGame.scene.getScene('ItemCatalogScene');
      smokeAssert(catalog.sys.isActive()&&catalog.input.enabled&&catalog.typeFilter==='armor'&&catalog.rarityFilter==='rare'&&catalog.nameDirection==='desc','closing details preserves filters and order');
    })()`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").rarityButton',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").filterOptions.find(option=>option.filterValue==="legendary")',width<500);
    await evaluate(`(()=>{const catalog=smokeGame.scene.getScene('ItemCatalogScene');
      smokeAssert(catalog.filteredItems.length===0&&catalog.itemZones.length===0,'empty filter result');
      smokeAssert(catalog.pageButtons.every(button=>!button.input.enabled),'empty result disables pagination');
    })()`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").resetButton',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").pageButtons[1]',width<500);
    await evaluate(`smokeAssert(smokeGame.scene.getScene('ItemCatalogScene').page===1,'pagination works after reset')`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").typeButton',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").filterOptions.find(option=>option.filterValue==="crystal")',width<500);
    await evaluate(`smokeAssert(smokeGame.scene.getScene('ItemCatalogScene').page===0&&smokeGame.scene.getScene('ItemCatalogScene').filteredItems.length===8,'type change resets page')`);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").rarityButton',width<500);
    await tap('smokeGame.scene.getScene("ItemCatalogScene").filterOptions.find(option=>option.filterValue==="epic")',width<500);
    await evaluate(`smokeAssert(smokeGame.scene.getScene('ItemCatalogScene').filteredItems.length===1&&smokeGame.scene.getScene('ItemCatalogScene').filteredItems[0].id==='golden-crystal','epic crystal filter finds golden crystal')`);
    const filteredScreenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`catalog-filter-${width}.png`),Buffer.from(filteredScreenshot.data,'base64'));
    await evaluate(`(async()=>{
      const {default:ShoppingSession}=await import('/src/systems/ShoppingSession.js');
      const {default:Combat}=await import('/src/systems/Combat.js');
      const {allItems}=await import('/src/data/shopCatalog.js');
      const {rotateFootprint}=await import('/src/utils/rotation.js');
      const make=(id,x,y,rotation=0,index=0)=>({...rotateFootprint(allItems.find(item=>item.id===id),rotation/90),
        catalogId:id,id:id+'#'+index,x,y});
      const session=new ShoppingSession();session.wins=7;session.round=8;
      session.board.bags.push(make('traveler-bag',0,0,0,0),make('traveler-bag',4,0,0,1));
      const entries=[['golden-crystal',1,0,180],['flaming-daggers',0,0,180],['flaming-daggers',2,0,180],
        ['iron-shield',6,0,180],['iron-helmet',3,0,180],['haste-stone',0,2,270],
        ['regeneration-potion',5,2,180],['vigor-potion',7,2,90],['vital-crystal',1,1,270],
        ['whetstone',2,2,90],['potion',4,1,0]];
      session.board.items.push(...entries.map(([id,x,y,rotation],index)=>make(id,x,y,rotation,index)));
      for(const item of session.board.items)smokeAssert(session.board.getPlacementError('item',item.id,item.x,item.y)===null,'winning layout is legal');
      session.board.items.push(make('bow',null,null,90,99));
      const prep=await smokeStart('ShopScene',{session});
      const {getItemRarity}=await import('/src/data/itemRarities.js');
      for(const view of prep.boardView.views.filter(view=>view.kind==='item')){
        const color=getItemRarity(view.piece).color;
        smokeAssert(view.piece.cells?view.cells.commandBuffer.includes(color):view.background.fillColor===color,'equipped and reserve pieces use rarity fill');
      }
      window.colorSession=session;
    })()`);
    const coloredPreparation=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`rarity-backpack-${width}.png`),Buffer.from(coloredPreparation.data,'base64'));
    await evaluate(`(async()=>{
      const session=window.colorSession;
      const {getItemRarity}=await import('/src/data/itemRarities.js');
      const battle=await smokeStart('BattleScene',{session});
      battle.battleClock.pause('color-qa');
      for(const backpack of Object.values(battle.backpacks))for(const view of backpack.itemViews){
        const color=getItemRarity(view.item).color;
        smokeAssert(view.item.cells?view.background.commandBuffer.includes(color):view.background.fillColor===color,'both fighters use rarity fill');
        if(view.colorFill?.type==='Rectangle')smokeAssert(view.colorFill.fillColor===color,'cooldown fill keeps rarity color');
      }
    })()`);
    const coloredBattle=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(output,`rarity-battle-${width}.png`),Buffer.from(coloredBattle.data,'base64'));
    await evaluate(`(async()=>{
      const battle=smokeGame.scene.getScene('BattleScene');
      const session=window.colorSession;
      const {default:Combat}=await import('/src/systems/Combat.js');
      // Deliberately guaranteed victory for UI/export QA: the enemy has no equipment.
      battle.combat=new Combat(session.board,{bags:[],items:[]},{random:()=>0.5});
      const events=battle.combat.advance(180000);
      smokeAssert(battle.combat.result==='victory'&&events.some(event=>event.type==='attack'),'complete winning test battle');
      window.victoryTest={seconds:battle.combat.elapsedMs/1000,attacks:events.filter(event=>event.type==='attack').length};
      battle.returnToShop();await smokeWait();
      const end=smokeGame.scene.getScene('RunEndScene');
      smokeAssert(smokeGame.scene.isActive('RunEndScene')&&end.session.wins===8,'winning battle reaches victory menu');
      smokeAssert(end.winningBackpackButton&&end.newJourneyButton,'victory menu has both actions');
      window.victorySession=end.session;
      window.beforeVictoryView=JSON.stringify({board:end.session.board,winningBoard:end.session.winningBoard,gold:end.session.gold});
    })()`);
    await tap('smokeGame.scene.getScene("RunEndScene").winningBackpackButton',width<500);
    await evaluate(`(()=>{const viewer=smokeGame.scene.getScene('WinningBackpackScene');
      smokeAssert(smokeGame.scene.isActive('WinningBackpackScene'),'winning backpack opens');
      smokeAssert(viewer.itemZones.length===11&&viewer.legendEntries.length===10,'winning equipment and grouped copies appear');
      smokeAssert(!viewer.input.drag,'viewer does not install dragging');
      window.victoryAnchorClick=HTMLAnchorElement.prototype.click;
      window.savedVictoryImage=null;
      HTMLAnchorElement.prototype.click=function(){window.savedVictoryImage={filename:this.download,url:this.href};};
    })()`);
    await tap('smokeGame.scene.getScene("WinningBackpackScene").saveButton',width<500);
    await evaluate(`(async()=>{
      try{
        for(let i=0;i<100&&!window.savedVictoryImage;i++)await new Promise(resolve=>setTimeout(resolve,50));
        smokeAssert(savedVictoryImage?.filename.endsWith('.png')&&savedVictoryImage.url.startsWith('data:image/png'),'PNG export produced');
        const image=new Image();image.src=savedVictoryImage.url;await image.decode();
        smokeAssert(image.naturalWidth===720&&image.naturalHeight===1280,'PNG has full game resolution');
        smokeAssert(!smokeGame.scene.getScene('WinningBackpackScene').saving,'export restores controls');
      }finally{HTMLAnchorElement.prototype.click=window.victoryAnchorClick;}
    })()`);
    const victoryPng=await evaluate('savedVictoryImage.url');
    const victoryPath=process.argv.includes('--save-victory') ? join(process.cwd(),'vitoria.png') : join(output,`victory-${width}.png`);
    await writeFile(victoryPath,Buffer.from(victoryPng.split(',')[1],'base64'));
    console.log(JSON.stringify({width,victory:await evaluate('victoryTest'),victoryPath}));
    await tap('smokeGame.scene.getScene("WinningBackpackScene").itemZones[0]',width<500);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('ItemInfoScene'),'winner equipment opens details')`);
    await tap('({x:smokeGame.scene.getScene("ItemInfoScene").closeButton.x,y:smokeGame.scene.getScene("ItemInfoScene").closeButton.y-smokeGame.scene.getScene("ItemInfoScene").cameras.main.scrollY})',width<500);
    await tap('smokeGame.scene.getScene("WinningBackpackScene").backButton',width<500);
    await evaluate(`(()=>{const end=smokeGame.scene.getScene('RunEndScene');
      smokeAssert(smokeGame.scene.isActive('RunEndScene')&&end.session===victorySession,'returns to same victory result');
      smokeAssert(beforeVictoryView===JSON.stringify({board:end.session.board,winningBoard:end.session.winningBoard,gold:end.session.gold}),'view and export do not change winning run');
    })()`);
    await tap('smokeGame.scene.getScene("RunEndScene").newJourneyButton',width<500);
    await evaluate(`smokeAssert(smokeGame.scene.isActive('CharacterSelectScene'),'new journey opens character selection')`);
    await tap('smokeGame.scene.getScene("CharacterSelectScene").selectButton',width<500);
    await evaluate(`(()=>{const prep=smokeGame.scene.getScene('ShopScene');
      smokeAssert(smokeGame.scene.isActive('ShopScene')&&prep.session!==victorySession&&prep.session.board.items.length===0,'new journey remains available');
    })()`);
    console.log(JSON.stringify({width,crystalDetailsPassed:true}));
  }
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('Preparation browser checks passed. Screenshots: '+output);
}finally{socket?.close();browser.kill();}
