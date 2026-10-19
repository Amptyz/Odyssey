import {chromium,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks:string[]=[],errors:string[]=[],screenshots:string[]=[];
let status='failed',failure:string|undefined;
function check(ok:unknown,label:string){if(!ok)throw Error(label);checks.push(label);}
const state=(page:Page):Promise<WorldSnapshot>=>page.evaluate(()=>(window as any).__EMBER__.snapshot());
async function button(page:Page,title:string){
 await page.waitForFunction(title=>(window as any).__EMBER__.ui().buttons.some((b:any)=>b.title?.includes(title)),title,{timeout:5000});
 const b=await page.evaluate(title=>(window as any).__EMBER__.ui().buttons.find((b:any)=>b.title?.includes(title)),title);
 const box=(await page.locator('canvas').boundingBox())!;
 await page.mouse.click(box.x+box.width/2+b.x*box.width/1280,box.y+box.height/2-b.y*box.height/720);await page.waitForTimeout(150);
}
async function walk(page:Page,target:{x:number;y:number},mode:'classic'|'wasd'){
 if(mode==='classic'){
  const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),target),box=(await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x+box.width/2+p.x*box.width/1280,box.y+box.height/2-p.y*box.height/720,{button:'right'});
  await page.waitForFunction(at=>{const h=(window as any).__EMBER__.snapshot().hero;return Math.hypot(h.x-at.x,h.y-at.y)<.3;},target,{timeout:12000});
 }else{
  const held=new Set<string>();let reached=false;
  for(let i=0;i<180;i++){
   const s=await state(page);if(Math.hypot(s.hero.x-target.x,s.hero.y-target.y)<.5){reached=true;break;}
   const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),target),next=new Set<string>();
   if(Math.abs(p.x)>7)next.add(p.x>0?'KeyD':'KeyA');if(Math.abs(p.y)>7)next.add(p.y>0?'KeyW':'KeyS');
   for(const key of held)if(!next.has(key)){await page.keyboard.up(key);held.delete(key);}
   for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}await page.waitForTimeout(60);
  }
  for(const key of held)await page.keyboard.up(key);if(!reached)throw Error('WASD interaction was unreachable');
 }
 await page.waitForTimeout(140);
}
async function interact(page:Page,kind:string,mode:'classic'|'wasd'){
 const n=(await state(page)).scene.interactions.find(n=>n.kind===kind)!;await walk(page,n,mode);await page.keyboard.press('KeyF');await page.waitForTimeout(150);
}
try{
 for(const mode of ['classic','wasd'] as const){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto(new URL('/?debug=1&empty-skills=qa',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/').href);
  await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});
  if(mode==='wasd')await button(page,'WASD 移动');await page.keyboard.press('Enter');await page.waitForTimeout(600);
  let s=await state(page);check(s.phase==='camp'&&Object.values(s.loadout).every(id=>id===null),`${mode}: ordinary camp starts with four empty slots`);
  for(const key of ['KeyQ',mode==='wasd'?'Space':'KeyW','KeyE','KeyR'])await page.keyboard.press(key);
  s=await state(page);check(Object.values(s.cooldowns).every(n=>n===0)&&s.projectiles.length===0,`${mode}: empty slot hotkeys do not create cooldowns or projectiles`);
  const opening=`reports/empty-skills-${mode}-opening.png`;await page.screenshot({path:opening});screenshots.push(opening);
  await interact(page,'ember',mode);s=await state(page);const index=s.choices.findIndex(c=>c.kind==='skill'),choice=s.choices[index]!;
  if(choice.kind!=='skill')throw Error('Missing active reward');await button(page,`选择  ${index+1}`);
  const equipment=`reports/empty-skills-${mode}-equip.png`;await page.screenshot({path:equipment});screenshots.push(equipment);
  await button(page,'装备此技能');s=await state(page);
  check(s.loadout.Q===choice.skillId&&['W','E','R'].every(slot=>s.loadout[slot as 'W'|'E'|'R']===null),`${mode}: earned skill fills Q while the other three slots remain empty`);
  await interact(page,'departure',mode);await page.waitForTimeout(600);check((await state(page)).phase==='fighting',`${mode}: a partial skill build can enter combat normally`);
  const actionBefore=(await state(page)).hero.action.id;
  for(const key of [mode==='wasd'?'Space':'KeyW','KeyE','KeyR'])await page.keyboard.press(key);
  s=await state(page);check(s.hero.action.id===actionBefore&&Object.values(s.cooldowns).every(n=>n===0),`${mode}: empty slots remain inactive in actual combat`);
  await page.keyboard.press('KeyQ');await page.waitForTimeout(80);check((await state(page)).cooldowns.Q>0,`${mode}: actual Q input casts the skill earned from the ember`);
  await page.keyboard.press('Escape');await button(page,'重新开始');s=await state(page);
  check(s.phase==='ready'&&Object.values(s.loadout).every(id=>id===null),`${mode}: restarting clears the build instead of restoring defaults`);
  // Explicit developer tools are tested separately from the normal reward path above.
  await page.keyboard.press('F2');await button(page,'技能 / 装备');await button(page,'烬火弹');
  check((await state(page)).developer!.draft.loadout.Q==='fireball',`${mode}: F2 can opt into a skill on an empty build`);
  await button(page,'清空当前技能槽');check((await state(page)).developer!.draft.loadout.Q===null,`${mode}: F2 can restore an explicit empty slot`);
  await button(page,'退出测试');check(Object.values((await state(page)).loadout).every(id=>id===null),`${mode}: exiting F2 returns to empty ordinary slots`);
  await button(page,'余烬 · 法术爆发');s=await state(page);
  check(s.phase==='camp'&&s.perks.length>0&&Object.values(s.loadout).every(id=>id===null),`${mode}: lab opening grants its explicit augments without adding default skills`);
  await page.close();
 }
 check(errors.length===0,'actual Creator empty-slot HUD and reward flow have no browser errors');status='passed';
}catch(error){failure=String(error);throw error;}
finally{writeFileSync('reports/browser-empty-skills.json',JSON.stringify({status,failure,scope:'Actual Creator build; normal keyboard/mouse opening, earned skill equip, combat and restart in both controls. Explicit F2 empty-slot controls checked separately.',checks,errors,screenshots},null,2)+'\n');await browser.close();}
console.log(`Passed ${checks.length} empty skill slot browser checks`);
