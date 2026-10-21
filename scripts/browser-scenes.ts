import {chromium,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {walkCampWithRightClick} from './browser-navigation';
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks:string[]=[],errors:string[]=[];
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);checks.push(message);};
async function state(page:Page):Promise<WorldSnapshot>{return page.evaluate(()=>(window as any).__EMBER__.snapshot());}
async function button(page:Page,title:string,index=0){const entries=await page.evaluate(()=>(window as any).__EMBER__.ui().buttons);const item=entries.filter((b:any)=>b.title?.includes(title))[index];if(!item)throw Error(`Missing button ${title}`);const b=(await page.locator('canvas').boundingBox())!;await page.mouse.click(b.x+b.width/2+item.x*b.width/1280,b.y+b.height/2-item.y*b.height/720);await page.waitForTimeout(110);}
async function walk(page:Page,target:{x:number;y:number},mode:'classic'|'wasd'){
 if(mode==='classic'){await walkCampWithRightClick(page,target);}
 else{
  const held=new Set<string>();let reached=false;
  for(let i=0;i<180;i++){
   const s=await state(page);if(Math.hypot(s.hero.x-target.x,s.hero.y-target.y)<.5){reached=true;break;}
   const p=await page.evaluate(at=>(window as any).__EMBER__.screen(at.x,at.y),target);const next=new Set<string>();
   if(Math.abs(p.x)>7)next.add(p.x>0?'KeyD':'KeyA');if(Math.abs(p.y)>7)next.add(p.y>0?'KeyW':'KeyS');
   for(const key of held)if(!next.has(key)){await page.keyboard.up(key);held.delete(key);}
   for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}await page.waitForTimeout(65);
  }
  for(const key of held)await page.keyboard.up(key);check(reached,'WASD reaches the requested interaction through actual held keys');
 }
 await page.waitForTimeout(100);
}
async function choose(page:Page){await button(page,'选择  1');if((await state(page)).pendingSkill)await button(page,Object.values((await state(page)).loadout).some(id=>id===null)?'装备此技能':'替换此技能');}
async function interact(page:Page,kind:string,mode:'classic'|'wasd'){
 const node=(await state(page)).scene.interactions.find(n=>n.kind===kind&&!n.claimed);if(!node)throw Error(`Missing ${kind}`);await walk(page,node,mode);await page.keyboard.press('KeyF');await page.waitForTimeout(140);
}
try{
 for(const mode of ['classic','wasd'] as const){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto((process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/')+'?debug=1&scene=camp');await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});
  if(mode==='wasd')await button(page,'WASD 移动');await page.keyboard.press('Enter');await page.waitForTimeout(200);
  let s=await state(page);check(s.phase==='camp'&&s.wave===0&&s.units.length===1,`${mode}: Start enters a safe movable camp with no automatic shop`);
  check(s.scene.interactions.map(n=>n.kind).join(',')==='ember,departure',`${mode}: opening has central ember and departure, no merchant`);
  await page.screenshot({path:`reports/scenes-${mode}-opening.png`});
  await interact(page,'departure',mode);check((await state(page)).phase==='camp',`${mode}: departure rejects a missing first ember`);
  await interact(page,'ember',mode);s=await state(page);check(s.phase==='reward'&&s.choices.length===3,`${mode}: F opens nearby ember choices`);const choices=s.choices;
  await page.screenshot({path:`reports/scenes-${mode}-choices.png`});await page.keyboard.press('Escape');await page.waitForTimeout(100);check((await state(page)).phase==='camp',`${mode}: Escape closes choices without advancing`);
  await page.keyboard.press('KeyF');await page.waitForTimeout(100);check(JSON.stringify((await state(page)).choices)===JSON.stringify(choices),`${mode}: re-opening retains the same offer`);
  await choose(page);check((await state(page)).scene.interactions.find(n=>n.kind==='ember')?.claimed,`${mode}: ember marked claimed independently`);
  await interact(page,'departure',mode);s=await state(page);check(s.phase==='fighting'&&s.wave===1&&s.level.remainingEnemies>0,`${mode}: explicit departure begins level 1`);
  check(!s.destination&&Math.hypot(s.hero.x-s.level.start.x,s.hero.y-s.level.start.y)<.25,`${mode}: scene transition clears input and places the player at level start`);
  await page.keyboard.press('Escape');await page.screenshot({path:`reports/scenes-${mode}-battle.png`});
  // Explicit F2 fixtures: rest presentation/transactions, not evidence of a normal full campaign.
  for(const mapId of ['ember','frost'] as const){
   await page.keyboard.press('F2');await page.waitForTimeout(120);const draft=(await state(page)).developer!.draft;
   await page.evaluate(config=>(window as any).__EMBER__.send({type:'DevConfigure',config}),{...draft,mapId,entry:'camp',wave:3,perks:[],equipment:{},options:{invincible:false,noCooldown:false,freezeEnemies:false,speed:1}});
   await page.waitForTimeout(120);await button(page,'应用并进入关卡');s=await state(page);
   check(s.developer?.enabled&&s.phase==='camp'&&s.wave===2,`${mode}/${mapId}: F2 enters the configured rest fixture`);
   check(s.scene.interactions.map(n=>n.kind).join(',')==='ember,merchant,departure',`${mode}/${mapId}: rest contains merchant and optional ember`);
   await interact(page,'merchant',mode);check((await state(page)).phase==='shop',`${mode}/${mapId}: merchant requires walking and F`);
   await page.screenshot({path:`reports/scenes-${mode}-${mapId}-merchant.png`});
   await button(page,'100 金');const buttons=await page.evaluate(()=>(window as any).__EMBER__.ui().buttons);const purchase=buttons.find((b:any)=>b.title?.startsWith('购买'));
   if(!purchase)throw Error('Purchase action unavailable');await button(page,purchase.title);
   s=await state(page);check(s.gold===60&&s.inventory.length===1&&s.equipment.slot1==='sword',`${mode}/${mapId}: normal purchase changes inventory, gold and equipment`);
   await page.keyboard.press('Enter');await page.waitForTimeout(120);check((await state(page)).phase==='camp'&&(await state(page)).wave===2,`${mode}/${mapId}: leaving shop returns to rest without advancing`);
   await page.screenshot({path:`reports/scenes-${mode}-${mapId}-rest.png`});
   await interact(page,'ember',mode);await choose(page);await interact(page,'departure',mode);
   check((await state(page)).phase==='fighting'&&(await state(page)).wave===3,`${mode}/${mapId}: rest departure enters the next battle with equipment`);
  }
  await page.close();
 }
 check(errors.length===0,'Creator scenes run without browser console/page errors');
}finally{writeFileSync('reports/browser-scenes.json',JSON.stringify({scope:'Actual Creator Web Desktop, real keyboard/mouse for normal opening in both controls; explicit F2 fixtures for rest merchants/embers in both themes. Full campaign and relay are validated separately.',checks,errors},null,2)+'\n');await browser.close();}
console.log(`Passed ${checks.length} scene browser checks`);
