import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors:string[]=[],checks:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);checks.push(message);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);};
const aim=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});const at=await ui(p.x,p.y);await page.mouse.move(at.x,at.y);};
try{
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__?.snapshot().mapId);
  check((await state()).mapId==='ember','original map defaults correctly');await click(-330,-106);
  let s=await state();check(s.mapId==='frost'&&s.hero.x===12&&s.hero.y===8&&s.totalWaves===2,'select rectangular frost map with two waves');
  check(s.loadout.Q==='icebolt','map chooses ice loadout');await click(330,-106);check((await state()).loadout.Q==='fireball','equip alternate primary skill');
  await click(330,-106);check((await state()).loadout.Q==='icebolt','restore ice skill');await click(145,45);
  await page.screenshot({path:'reports/11-frost-selection.png'});await click(0,-106);
  s=await state();check(s.units.some(u=>u.kind==='frostling'),'new enemy spawns from map data');
  // WASD + real pointer attacks, normal HP/cooldowns; no direct damage or world manipulation.
  const deadline=Date.now()+90000,rewards:number[]=[];let iceHit=false,enemySlow=false,shotIdentity=false,savedCombat=false,mouseHeld=false;
  while(Date.now()<deadline){
    s=await state();if(s.phase==='victory')break;if(s.phase==='defeat')throw new Error('Frost playthrough defeated');
    if(s.phase==='reward'){
      await page.mouse.up();mouseHeld=false;rewards.push(s.wave);check(s.choices.length===3&&!s.choices.includes('burn')&&!s.choices.includes('corpse'),'ice rewards exclude unusable fire perks');
      const index=s.choices.findIndex(id=>id==='leech'||id==='double');await page.keyboard.press(String(index<0?1:index+1));await page.waitForFunction(()=>(window as any).__EMBER__.snapshot().phase!=='reward',undefined,{timeout:5000});continue;
    }
    iceHit ||= s.units.some(u=>u.team==='enemy'&&u.statuses.some(x=>x.id==='slow'&&x.skillId==='icebolt'));
    enemySlow ||= s.hero.statuses.some(x=>x.id==='slow'&&x.skillId==='frostBolt');
    shotIdentity ||= s.projectiles.some(p=>p.skillId==='icebolt');
    const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y));
    const target=enemies[0];if(target){await aim(target.x,target.y);if(!mouseHeld){await page.mouse.down();mouseHeld=true;}await page.keyboard.press('q');}
    await page.keyboard.press('Space');if(enemies.filter(e=>Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<3.8).length>=2)await page.keyboard.press('r');
    if(iceHit&&!savedCombat){await page.screenshot({path:'reports/12-frost-combat.png'});savedCombat=true;}
    await page.waitForTimeout(120);
  }
  await page.mouse.up();s=await state();check(s.phase==='victory'&&s.kills===13,'complete two frost waves and 13 kills');
  check(rewards.join(',')==='1,2'&&s.perks.length===2,`one reward for each data-defined wave (${rewards.join(',')})`);check(iceHit&&shotIdentity,'ice projectile identity and slow appear in live browser');check(enemySlow,'frost enemy applies slow to hero');
  await page.screenshot({path:'reports/13-frost-victory.png'});
  await page.keyboard.press('Enter');await page.waitForTimeout(120);s=await state();check(s.phase==='ready'&&s.mapId==='frost'&&s.loadout.Q==='icebolt','restart retains frost map and loadout');
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(120);await click(-330,-106);
  s=await state();check(s.mapId==='ember'&&s.totalWaves===3&&s.hero.x===10,'switch back restores original map after resize');
  check(errors.length===0,`no browser errors: ${errors.join('; ')}`);
  writeFileSync('reports/browser-content.json',JSON.stringify({status:'passed',checks,errors,frostKills:13,rewards,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Content architecture browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/content-failure.png'});writeFileSync('reports/browser-content.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
