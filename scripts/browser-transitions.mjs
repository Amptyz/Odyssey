import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const checks=[],errors=[],samples=[],screenshots=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
page.on('request',r=>requests.push(r.url()));
const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
const state=()=>page.evaluate(()=>window.__EMBER__.snapshot());
const transition=()=>page.evaluate(()=>window.__EMBER__.transition());
const send=c=>page.evaluate(c=>window.__EMBER__.send(c),c);
async function shot(name){const path=`reports/transition-${name}.png`;await page.locator('canvas').screenshot({path});screenshots.push(path);}
async function settled(){await page.waitForFunction(()=>!window.__EMBER__.transition().active);}
async function capture(name,action){
 await settled();const before=await transition();
 await page.evaluate(()=>{window.__transitionFrames=[];});
 await action();
 await page.waitForFunction(sequence=>window.__EMBER__.transition().sequence>sequence,before.sequence);
 if(name==='opening'||name==='paused-map')await shot(name+'-curtain');
 await settled();await page.waitForTimeout(50);
 const frames=await page.evaluate(()=>window.__transitionFrames),active=frames.filter(f=>f.active),after=await transition();
 check(active.some(f=>f.opacity===255),`${name}: actual rendered transition begins fully opaque`);
 check(active.some(f=>f.opacity>0&&f.opacity<255),`${name}: reveals through intermediate opacity frames`);
 check(!after.active&&after.opacity===0,`${name}: curtain retires completely`);
 samples.push({name,frames});
 if(!(await state()).paused){
  await page.waitForFunction(()=>{const e=window.__EMBER__,t=e.transition().title;return t.active&&t.opacity===255&&t.name===e.snapshot().scene.name;});
  check((await transition()).title.name===(await state()).scene.name,`${name}: entry title follows the new scene snapshot`);
 }
 if(name==='opening'||name==='paused-map')await shot(name+'-revealed');
 return active;
}
async function walkTo(kind){await page.waitForFunction(()=>window.__EMBER__.ui().phase===window.__EMBER__.snapshot().phase);const node=(await state()).scene.interactions.find(n=>n.kind===kind&&!n.claimed);if(!node)throw Error('Missing '+kind);await send({type:'MoveTo',point:{x:node.x,y:node.y}});await page.waitForFunction(at=>{const h=window.__EMBER__.snapshot().hero;return Math.hypot(h.x-at.x,h.y-at.y)<.3;},node);}
async function configure(patch){await send({type:'DevOpen'});const draft=(await state()).developer.draft;await send({type:'DevConfigure',config:{...draft,...patch,options:{invincible:true,noCooldown:false,freezeEnemies:true,speed:1}}});}
try{
 await page.goto((process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080')+'/?debug=1&transition=qa');
 await page.waitForFunction(()=>window.__EMBER__?.transition,undefined,{timeout:60000});
 check((await transition()).sequence===0&&!(await transition()).active,'Initial main menu has no artificial transition');
 const loadedRequests=requests.length;
 await page.evaluate(()=>{
  window.__transitionFrames=[];
  const record=()=>{const t=window.__EMBER__.transition(),s=window.__EMBER__.snapshot();window.__transitionFrames.push({...t,tick:s.tick,paused:s.paused});if(window.__transitionFrames.length>300)window.__transitionFrames.shift();requestAnimationFrame(record);};
  requestAnimationFrame(record);
 });
 const opening=await capture('opening',()=>page.keyboard.press('Enter'));
 check((await state()).phase==='camp'&&opening.at(-1).tick>opening[0].tick,'Camp simulation continues while the local curtain reveals');
 await walkTo('ember');const beforePanel=await transition();await page.keyboard.press('f');await page.waitForTimeout(100);
 check((await state()).phase==='reward'&&(await transition()).sequence===beforePanel.sequence,'Opening ember choices does not black out');
 await page.keyboard.press('Escape');await page.waitForTimeout(100);
 check((await state()).phase==='camp'&&(await transition()).sequence===beforePanel.sequence,'Closing choices does not black out');
 await page.keyboard.press('f');await page.waitForTimeout(50);const choice=(await state()).choices.find(c=>c.kind==='perk');
 await send({type:'ChooseReward',choiceId:choice.id});await walkTo('departure');
 await capture('camp-to-level',()=>page.keyboard.press('f'));
 check((await state()).phase==='fighting'&&(await state()).wave===1,'Normal departure renders the new battle');
 await configure({mapId:'ember',entry:'camp',wave:3});
 await capture('rest-fixture',()=>send({type:'DevApply'}));
 await walkTo('merchant');const beforeShop=await transition();await page.keyboard.press('f');await page.waitForTimeout(100);
 check((await state()).phase==='shop'&&(await transition()).sequence===beforeShop.sequence,'Merchant interaction does not black out');
 await page.keyboard.press('Escape');await page.waitForTimeout(100);
 check((await state()).phase==='camp'&&(await transition()).sequence===beforeShop.sequence,'Leaving the merchant does not black out');
 await walkTo('departure');await capture('rest-to-level',()=>page.keyboard.press('f'));
 check((await state()).wave===3,'Rest departure enters its configured next level');
 await page.setViewportSize({width:960,height:640});
 await configure({mapId:'frost',entry:'combat',wave:1});
 const paused=await capture('paused-map',()=>page.evaluate(()=>{window.__EMBER__.send({type:'DevApply'});window.__EMBER__.send({type:'TogglePause'});}));
 check(paused.every(f=>f.paused&&f.tick===paused[0].tick),'Presentation completes even when the new world is paused');
 check((await state()).mapId==='frost'&&(await state()).paused,'Map change preserves the paused state');
 await send({type:'TogglePause'});await page.waitForTimeout(100);
 await capture('same-place-retest',()=>send({type:'DevRestart'}));
 await configure({mapId:'ember',entry:'camp',wave:3});
 await send({type:'DevApply'});await page.waitForTimeout(50);
 await configure({mapId:'frost',entry:'camp',wave:3});await send({type:'DevApply'});await settled();
 check(!(await transition()).active&&(await state()).mapId==='frost','Rapid scene changes end on the latest scene without a stuck curtain');
 check(requests.length===loadedRequests,'Switching scenes requests no additional assets or loading screen');
 check(errors.length===0,'Actual Creator transition has no browser runtime errors');
 writeFileSync('reports/browser-transitions.json',JSON.stringify({status:'passed',scope:'Actual Creator keyboard opening/departure/panels, explicit F2 rest/map/retest fixtures, render-frame samples and screenshots; no world-state mutation.',checks,samples,screenshots,errors},null,2)+'\n');
 console.log(`Passed ${checks.length} transition browser checks`);
}catch(e){await shot('failure').catch(()=>{});writeFileSync('reports/browser-transitions.json',JSON.stringify({status:'failed',checks,samples,screenshots,errors,error:String(e)},null,2)+'\n');throw e;}finally{await browser.close();}
