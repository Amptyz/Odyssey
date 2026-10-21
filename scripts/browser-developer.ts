import {SHOP_CATALOG} from '../EmberDemo/assets/scripts/ember/content/equipment';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);checks.push(m);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(110);};
const key=async(k:string)=>{await page.keyboard.press(k);await page.waitForTimeout(90);};
const aim=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y}),at=await ui(p.x,p.y);await page.mouse.move(at.x,at.y);};
const spawnLayout=(s:WorldSnapshot)=>s.units.filter(u=>u.team==='enemy').map(u=>({kind:u.kind,x:u.x,y:u.y,hp:u.hp}));
try{
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__);
  check(!(await state()).developer,'ordinary startup never automatically enables developer options');await click(145,45);await click(445,222);
  check((await state()).developer?.open&&!(await state()).developer?.enabled,'visible home entry opens inactive configuration panel');
  await key('1');await key('q');await key('Enter');check((await state()).phase==='ready','panel keyboard shortcuts cannot accidentally start or cast');
  await click(-390,165);await click(130,165);check((await state()).developer?.draft.mapId==='frost'&&(await state()).developer?.draft.wave===2,'select a different map and its second wave');
  await click(375,163);await page.locator('input:visible').last().fill('7654321');await click(0,275);
  check((await state()).developer?.draft.seed===7654321,'editable seed commits through real input field');
  await click(-390,93);await click(0,93);await click(390,93);await click(-390,31);await click(-390,31);await click(-390,31);
  check((await state()).developer?.draft.options.speed===.5,'configure slow motion and opt-in test flags');
  await click(-232,237);await click(0,35);check((await state()).developer?.draft.loadout.Q==='icebolt','select ice skill directly from catalog');
  await click(390,93);check((await state()).developer?.draft.loadout.Q==='dash'&&(await state()).developer?.draft.loadout.E==='icebolt','choosing an already equipped skill swaps slots without duplicates');await click(0,35);
  // Configure six universal slots with actual catalog cycling. Replacing a selected item
  // adds its first purchase rank, while cycling back to an owned ID retains that rank.
  const positions=[[-390,-96],[0,-96],[390,-96],[-390,-151],[0,-151],[390,-151]] as const;
  for(const [x,y] of positions)await click(x,y);
  const six=(await state()).developer!.draft;
  check(Object.keys(six.equipment).length===6&&new Set(Object.values(six.equipment)).size===6,'all six unrestricted equipment slots accept different items through UI');
  check(six.equipment.slot1==='sword'&&six.equipment.slot2==='staff'&&six.equipment.slot3==='bow'&&six.equipment.slot4==='bulwark','four weapons coexist instead of replacing a typed slot');
  await click(-390,-96); // sword -> leather (the next unused catalog item).
  check((await state()).developer?.draft.equipment.slot1==='leather','a populated universal slot can be replaced through its catalog control');
  for(let n=0;n<=SHOP_CATALOG.length&&(await state()).developer?.draft.equipment.slot1!=='sword';n++)await click(-390,-96); // cycle through the current catalog and empty slot
  check((await state()).developer?.draft.equipment.slot1==='sword','reselecting an owned item retains its selected slot');
  check((await state()).hero.maxHp===240,'six-slot draft never mutates the ordinary live world');
  await page.screenshot({path:'reports/31-developer-build.png'});
  await click(0,237);await click(-295,-63);await click(295,-63);await click(480,-125);await click(295,108);await click(295,51);
  const draft=(await state()).developer!.draft;check(draft.perks.length===4&&['magicMissile','jeweledGauntlet','heavyHitter','typhoon'].every(p=>draft.perks.includes(p as any)),'combine four augments across catalog pages');
  await click(232,237);await click(-482,165);check((await state()).developer?.notice.includes('已保存'),'save configuration to an explicit local preset');
  await click(-290,-177);await click(0,-20);const exported=await page.locator('textarea:visible').last().inputValue();check(JSON.parse(exported).seed===7654321,'export contains the chosen seed and build');
  await page.locator('textarea:visible').last().fill('{"version":99}');await click(290,-177);check((await state()).developer?.notice.includes('版本')&&(await state()).developer?.draft.seed===7654321,'reject invalid imported config without replacing the valid draft');
  await click(0,-20);await page.locator('textarea:visible').last().fill(JSON.stringify({...JSON.parse(exported),seed:900}));await click(290,-177);
  check((await state()).developer?.draft.seed===900,'valid pasted reproduction config imports through UI');await click(-298,165);check((await state()).developer?.draft.seed===7654321,'load restores the saved configuration');
  await click(440,-322);let s=await state();const initialLayout=spawnLayout(s);
  check(s.developer?.enabled&&!s.developer.open&&s.phase==='fighting'&&s.mapId==='frost'&&s.wave===2,'apply starts selected encounter immediately without shop');
  check(s.units.filter(u=>u.team==='enemy').length===5&&s.hero.hp===405&&s.equipment.slot4==='bulwark'&&s.loadout.Q==='icebolt'&&s.perks.length===4&&Object.keys(s.equipment).length===6&&s.equipment.slot6==='robe','applied enemies, loadout, gear, HP and augments agree with configuration');
  const enemy=s.units.find(u=>u.team==='enemy')!;await aim(enemy.x,enemy.y);await key('q');await key('q');s=await state();check(s.cooldowns.Q===0&&s.hero.action.id===2,'zero-cooldown flag works through normal casting input');
  await page.screenshot({path:'reports/32-developer-arena.png'});
  await key('F2');const tick=(await state()).tick;await page.waitForTimeout(400);check((await state()).tick===tick,'opening developer panel freezes simulation');await click(-464,237);
  await click(440,-35);check((await state()).tick===tick+1,'single step advances exactly one simulation tick while panel stays open');
  await click(-220,-35);check((await state()).hero.hp===101.25,'health setup can quickly reach low-health test cases');await click(-440,-35);check((await state()).hero.hp===405,'restore tool returns to full health');
  await click(220,-35);check((await state()).units.length===1,'clear enemies leaves an empty test arena');await click(50,-105);await click(360,-105);check((await state()).units.filter(u=>u.team==='enemy'&&u.alive).length===5,'spawn five enemies from the content catalog');
  await page.screenshot({path:'reports/33-developer-tools.png'});
  await click(145,-322);s=await state();check(JSON.stringify(spawnLayout(s))===JSON.stringify(initialLayout),'retest restores the same seeded encounter and original build');
  await key('F2');await click(-440,-322);s=await state();check(!s.developer&&s.phase==='ready'&&s.perks.length===0&&!Object.keys(s.equipment).length&&s.loadout.Q==='fireball','exit test mode clears all modifiers and restores normal play');
  await page.reload();await page.waitForFunction(()=>!!(window as any).__EMBER__);check(!(await state()).developer,'saved presets do not activate on reload');await key('F2');await click(232,237);await click(-298,165);
  check((await state()).developer?.draft.seed===7654321,'saved local preset survives reload');
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(150);await click(440,-322);check((await state()).developer?.enabled,'panel controls also work at a resized viewport');
  check(errors.length===0,'no browser runtime errors');
  writeFileSync('reports/browser-developer.json',JSON.stringify({status:'passed',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');console.log(`Developer mode browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/developer-failure.png'});writeFileSync('reports/browser-developer.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
