import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),checks:string[]=[],errors:string[]=[],screenshots:string[]=[];
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
const state=():Promise<WorldSnapshot>=>page.evaluate(()=>(window as any).__EMBER__.snapshot());
async function button(title:string){
 const item=await page.evaluate(title=>(window as any).__EMBER__.ui().buttons.find((b:any)=>b.title===title),title);
 if(!item)throw Error(`Missing button ${title}`);const b=(await page.locator('canvas').boundingBox())!;
 await page.mouse.click(b.x+b.width/2+item.x*b.width/1280,b.y+b.height/2-item.y*b.height/720);await page.waitForTimeout(90);
}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
let samples:unknown[]=[],status='failed',failure:string|undefined;
try{
 await page.goto(new URL('/?debug=1&enemy-ai=qa',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/').href);
 await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});
 // Explicit F2 fixture with slower ordinary movement; existing low-MS soft caps still apply.
 // Charge motion uses its authored dash speed. No world objects are mutated.
 await page.evaluate(()=>{
  const api=(window as any).__EMBER__;api.send({type:'DevOpen'});const c=api.snapshot().developer.draft;
  api.send({type:'DevConfigure',config:{...c,entry:'combat',mapId:'ember',wave:1,perks:[],equipment:{},purchaseOrder:[],
   attributeTarget:'enemies',attributeModifiers:[{stat:'moveSpeed',operation:'multiply',value:0}],
   options:{invincible:true,noCooldown:false,freezeEnemies:false,speed:1}}});
  api.send({type:'DevApply'});api.send({type:'DevOpen'});api.send({type:'DevAction',action:'clearEnemies'});
  api.send({type:'DevSpawn',enemyId:'emberRam',count:1});api.send({type:'DevAction',action:'step'});
 });
 check((await state()).developer?.enabled&&(await state()).developer?.draft.options.invincible&&(await state()).developer?.draft.attributeModifiers?.[0]?.operation==='multiply','runs only in an explicitly applied and accepted developer fixture');
 const first=await state();check(first.enemies.units.length===1&&first.enemies.units[0]?.decision?.profile==='emberRam','Creator imports and executes the configured ram profile');
 await button('敌人 AI');await page.waitForTimeout(120);
 check((await page.evaluate(()=>(window as any).__EMBER__.ui().buttons)).some((b:any)=>b.title==='AI 步进一帧'),'F2 exposes the enemy inspector and its step control');
 const tick=first.tick;await button('AI 步进一帧');check((await state()).tick===tick+1,'inspector button advances exactly one fixed tick while F2 is open');
 const opening=await page.evaluate(()=>{
  const frames=[];for(let i=0;i<270;i++){
   const api=(window as any).__EMBER__;api.send({type:'DevAction',action:'step'});const s=api.snapshot(),u=s.enemies.units[0];
   frames.push({time:s.time,tick:s.tick,actionId:u?.actionId,decision:u?.decision,position:s.units.find((a:any)=>a.team==='enemy')});
   if(u?.decision?.reason==='sequence-wait')break;
  }return frames;
 });samples.push(...opening);
 check(opening.some(s=>s.actionId==='ramLane'),'actual configured sequence starts and executes its charge');
 const waiting=await state();check(waiting.enemies.units[0]?.decision?.reason==='sequence-wait','charge completion enters the configured stop');
 check(waiting.enemies.units[0]?.decision?.cooldowns.some(c=>c.key==='group:mobility'),'actual execution starts the shared mobility cooldown');
 const enemyBefore=waiting.units.find(u=>u.team==='enemy')!;
 await page.evaluate(()=>{for(let i=0;i<10;i++)(window as any).__EMBER__.send({type:'DevAction',action:'step'});});
 const still=await state(),enemyAfter=still.units.find(u=>u.id===enemyBefore.id)!;
 check(still.enemies.units[0]?.decision?.reason==='sequence-wait'&&enemyBefore.x===enemyAfter.x&&enemyBefore.y===enemyAfter.y,'stop lasts over ten ticks and prevents movement');
 // Refresh the frozen inspector from the current snapshot through its real tab button.
 await button('敌人 AI');const wide='reports/enemy-ai-inspector-1280.png';await page.screenshot({path:wide});screenshots.push(wide);
 await page.setViewportSize({width:960,height:640});await page.waitForTimeout(180);const small='reports/enemy-ai-inspector-960.png';await page.screenshot({path:small});screenshots.push(small);
 await page.setViewportSize({width:1280,height:720});
 const later=await page.evaluate(()=>{
  const frames=[];for(let i=0;i<510;i++){
   const api=(window as any).__EMBER__;api.send({type:'DevAction',action:'step'});const s=api.snapshot(),u=s.enemies.units[0];
   frames.push({time:s.time,actionId:u?.actionId,decision:u?.decision});
  }return frames;
 });samples.push(...later);
 check(later.some(s=>s.decision?.sequence?.step===3&&s.decision.reason.startsWith('blocked:')),'single-player fallback reaches the next action and handles unavailable range without an invalid hit');
 check(later.some(s=>!s.decision?.sequence),'bounded sequence waiting eventually completes instead of deadlocking');
 const starts=[...opening,...later].filter((s,i,all)=>s.actionId==='ramLane'&&(i===0||all[i-1]?.actionId!=='ramLane'));
 check(starts.length>=2&&starts.slice(1).every((s,i)=>s.time-starts[i]!.time>=9-1/30),'repeated sequences obey the nine-second charge cooldown');
 const frozen=(await state()).tick;await page.waitForTimeout(160);check((await state()).tick===frozen,'opening F2 freezes decision clocks and sequence progress');
 await page.reload();await page.waitForFunction(()=>(window as any).__EMBER__);
 check((await state()).phase==='ready'&&(await state()).enemies.units.length===0,'reload returns to the ordinary menu with no developer or sequence memory');
 check(errors.length===0,'actual Creator runtime and inspector produce no page or console errors');
 status='passed';
 console.log(`Passed ${checks.length} enemy AI browser checks`);
}catch(error){failure=String(error);await page.screenshot({path:'reports/enemy-ai-failure.png'}).catch(()=>{});throw error;}
finally{
 let previous='';const compact=samples.filter((s:any,index)=>{const signature=JSON.stringify([s.actionId,s.decision?.reason,s.decision?.sequence?.step,s.decision?.actionTargetId]),changed=signature!==previous;previous=signature;return changed||index%30===0;})
  .map((s:any)=>({...s,position:s.position?{x:s.position.x,y:s.position.y}:undefined}));
 writeFileSync('reports/browser-enemy-ai.json',JSON.stringify({status,failure,scope:'Actual Creator Web Desktop; explicit validated F2 single-player charge/wait/retarget/unavailable-step fixture and UI inspection. Multiplayer targeting is covered by core fixtures and relay browser regression.',checks,errors,screenshots,samples:compact},null,2)+'\n');await browser.close();
}
