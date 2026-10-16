import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors:string[]=[],checks:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);checks.push(message);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);};
const ground=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});return ui(p.x,p.y);};
const moveToward=async(s:WorldSnapshot,x:number,y:number)=>{const dx=x-s.hero.x,dy=y-s.hero.y,d=Math.hypot(dx,dy),step=Math.min(5,d),p=await ground(s.hero.x+dx/(d||1)*step,s.hero.y+dy/(d||1)*step);await page.mouse.click(p.x,p.y,{button:'right'});};
try{
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=16');await page.waitForFunction(()=>!!(window as any).__EMBER__?.snapshot().stats);
  let s=await state();check(s.mapId==='ember'&&s.totalWaves===5&&!s.developer,'ordinary five-stage trial starts without developer options');
  await page.keyboard.press('Enter');await page.waitForTimeout(120);s=await state();check(s.phase==='shop'&&s.gold===160&&s.time===0,'normal Enter opens shop with 160 gold');
  await click(-90,-36);s=await state();check(s.equipment.slot1==='bow'&&s.appearance.weapon==='bow'&&s.gold===60&&s.stats.attackDamage===24,'normal catalog purchase equips the 100-gold bow in universal slot1');
  await click(-90,-185);check((await state()).gold===60&&Object.keys((await state()).equipment).length===1,'100-gold second item is unaffordable without mutating the build');
  await click(-390,-237);check(!(await state()).appearance.weapon&&(await state()).stats.attackRange===2.5,'universal slot UI unequips and returns to unarmed range');
  await click(-90,-36);s=await state();check(s.gold===60&&s.equipment.slot1==='bow'&&s.purchaseOrder.join(',')==='bow','owned item re-equips free without a second purchase rank');
  await page.screenshot({path:'reports/14-opening-shop.png'});
  await page.keyboard.press('Enter');await page.waitForTimeout(150);s=await state();check(s.phase==='fighting'&&s.hero.hp===240&&s.level?.id==='ember-1','ordinary shop starts stage1 at its route spawn');
  // Actual normal input only: no DevConfigure, clearing, health assignment or fake reward.
  const deadline=Date.now()+180000;let held=false;
  while(Date.now()<deadline){
    s=await state();if(s.phase==='reward')break;if(s.phase==='defeat')throw Error('Normal stage1 combat defeated the input bot');
    const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y)),target=enemies[0];
    if(!target){if(held){await page.mouse.up();held=false;}const exit=s.level!.exit;await moveToward(s,exit.x,exit.y);await page.waitForTimeout(160);continue;}
    const dx=target.x-s.hero.x,dy=target.y-s.hero.y,d=Math.hypot(dx,dy);
    if(d>6){if(held){await page.mouse.up();held=false;}await moveToward(s,target.x,target.y);}else if(d<3){await moveToward(s,s.hero.x-dx/(d||1)*4,s.hero.y-dy/(d||1)*4);}
    const aim=await ground(target.x,target.y);await page.mouse.move(aim.x,aim.y);if(!held){await page.mouse.down();held=true;}
    await page.keyboard.press('q');await page.keyboard.press('w');if(enemies.some(e=>Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<3.7))await page.keyboard.press('r');
    await page.waitForTimeout(140);
  }
  await page.mouse.up();s=await state();check(s.phase==='reward'&&!s.developer&&s.wave===1,'normal combat plus exit interaction earns the first-stage reward');
  check(s.gold===160,'stage1 pays exactly100 once after the bow purchase');
  const choice=s.choices.find(c=>c.kind==='skill')!;check(!!choice&&new Set(s.choices.map(c=>c.id)).size===3,'normal reward offers a skill among three distinct choices');
  const index=s.choices.indexOf(choice);await page.keyboard.press(String(index+1));await page.waitForTimeout(100);
  check((await state()).pendingSkill===choice.skillId&&(await state()).loadout.E==='dash','skill choice waits for slot confirmation');
  await page.screenshot({path:'reports/15-skill-replacement.png'});await click(0,-213);check(!(await state()).pendingSkill&&(await state()).choices.some(c=>c.id===choice.id),'cancel preserves the same ordinary reward');
  await page.keyboard.press(String(index+1));await page.waitForTimeout(100);await page.keyboard.press('3');await page.waitForTimeout(130);s=await state();
  check(s.phase==='shop'&&s.loadout.E===choice.skillId&&s.loadout.Q==='fireball','real reward replaces E only and enters the next shop');
  await click(-90,-185);s=await state();check(s.gold===60&&s.equipment.slot2==='plate'&&s.hero.maxHp===315&&s.appearance.body==='plate','second ordinary purchase occupies another universal slot and applies the new75HP armor');
  await click(-20,-237);s=await state();check(s.hero.maxHp===240&&!s.appearance.body,'slot2 unloads its independent body source');
  await click(-90,-185);s=await state();check(s.gold===60&&s.hero.maxHp===315&&s.purchaseOrder.join(',')==='bow,plate','free body re-equip preserves ownership and purchase order');
  await click(-335,-329);await click(280,113);check((await state()).gold===60&&Object.keys((await state()).equipment).length===2,'second catalog page cannot bypass insufficient currency');
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(120);await page.screenshot({path:'reports/16-equipment-build.png'});
  await page.keyboard.press('Enter');await page.waitForTimeout(150);check((await state()).wave===2&&(await state()).phase==='fighting','normal UI advances to the second of five stages');
  await page.keyboard.press('Escape');await page.waitForTimeout(100);await click(145,-164);await page.waitForTimeout(120);s=await state();check(s.phase==='ready'&&s.gold===160&&s.inventory.length===0&&s.purchaseOrder.length===0,'ordinary restart clears six-slot ownership and purchase history');
  check(errors.length===0,'no browser runtime errors');
  writeFileSync('reports/browser-content.json',JSON.stringify({status:'passed',scope:'normal opening shop, stage1 combat/exit/reward, stage2 shop; five-stage completion covered separately',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Content browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/content-failure.png'});writeFileSync('reports/browser-content.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2)+'\n');throw error;}finally{await browser.close();}
