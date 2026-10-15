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
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=16');await page.waitForFunction(()=>!!(window as any).__EMBER__?.snapshot().stats);
  check((await state()).mapId==='ember','original map defaults correctly');await click(-330,-106);
  let s=await state();check(s.mapId==='frost'&&s.totalWaves===2&&s.loadout.Q==='fireball','frost uses the same classless initial loadout');
  await click(145,45);await click(0,-106);s=await state();check(s.phase==='shop'&&s.gold===160&&s.time===0,'opening shop has deterministic starting gold');
  await click(-90,-185);s=await state();check(s.equipment.body==='plate'&&s.gold===100,'buy and equip armor from fixed catalog');
  await click(-160,-314);await click(280,113);s=await state();check(s.equipment.head==='helm'&&s.gold===60&&s.hero.maxHp===340,'second catalog page head equipment changes stats');
  await click(-440,-314);await click(-90,113);check((await state()).gold===60&&!(await state()).equipment.weapon,'unaffordable weapon cannot charge or equip');
  await page.screenshot({path:'reports/14-opening-shop.png'});
  await click(415,-314);s=await state();check(s.phase==='fighting'&&s.hero.hp===340&&s.units.some(u=>u.kind==='frostling'),'opening shop continues into normal frost combat');
  const deadline=Date.now()+120000,rewards:number[]=[];let iceHit=false,enemySlow=false,shotIdentity=false,savedCombat=false,mouseHeld=false,shopVisited=false;
  while(Date.now()<deadline){
    s=await state();if(s.phase==='victory')break;if(s.phase==='defeat')throw new Error('Frost playthrough defeated');
    if(s.phase==='reward'){
      await page.mouse.up();mouseHeld=false;rewards.push(s.wave);
      check(new Set(s.choices.map(c=>c.id)).size===3&&s.choices.some(c=>c.kind==='skill'),'reward includes distinct passive and skill choices');
      if(s.wave===1){
        const c=s.choices.find(c=>c.kind==='skill'&&c.skillId==='icebolt');check(!!c,'seed 16 offers ice skill through normal reward generation');
        await page.keyboard.press(String(s.choices.findIndex(x=>x.id===c!.id)+1));await page.waitForTimeout(100);
        check((await state()).pendingSkill==='icebolt'&&(await state()).loadout.E==='dash','skill selection waits for replacement confirmation');
        await page.screenshot({path:'reports/15-skill-replacement.png'});
        await click(0,-213);check(!(await state()).pendingSkill&&(await state()).choices.length===3,'cancel returns to same rewards without consuming one');
        await page.keyboard.press('3');await page.waitForTimeout(100);await page.keyboard.press('3');await page.waitForTimeout(100);
        check((await state()).loadout.E==='icebolt'&&(await state()).loadout.Q==='fireball','replace E only and keep Q fireball');
      }else{await page.keyboard.press('1');await page.waitForTimeout(100);}
      continue;
    }
    if(s.phase==='shop'){
      check(s.wave===1&&s.gold===160,'wave reward pays exactly 100 gold');
      await click(-90,-36);check((await state()).equipment.weapon==='bow'&&(await state()).stats.attackRange===7.5,'buy bow with real range bonus');
      await click(280,-185);s=await state();check(s.equipment.body==='robe'&&s.inventory.includes('plate')&&s.gold===0,'replace armor while retaining previous equipment');
      await click(-90,-185);check((await state()).equipment.body==='plate'&&(await state()).gold===0,'owned armor can be re-equipped for free');
      await click(280,-185);check((await state()).equipment.body==='robe','re-equip robe with unchanged ownership');
      await click(-20,-250);check(!(await state()).equipment.body&&(await state()).stats.skillPower===1,'unequip removes body stats');
      await click(280,-185);check((await state()).stats.skillPower===1.25,'re-equip restores bonuses once');
      await page.setViewportSize({width:960,height:640});await page.waitForTimeout(100);await page.screenshot({path:'reports/16-equipment-build.png'});
      await click(415,-314);await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(100);shopVisited=true;continue;
    }
    iceHit ||= s.units.some(u=>u.team==='enemy'&&u.statuses.some(x=>x.id==='slow'&&x.skillId==='icebolt'));
    enemySlow ||= s.hero.statuses.some(x=>x.id==='slow'&&x.skillId==='frostBolt');
    shotIdentity ||= s.projectiles.some(p=>p.skillId==='icebolt');
    const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y));
    const target=enemies[0];
    // Verify the acquired skill in isolation before burst damage can kill its target
    // between snapshots. Short-lived projectiles require finer sampling than the bot loop.
    if(target&&s.loadout.E==='icebolt'&&!iceHit){
      await page.mouse.up();mouseHeld=false;await aim(target.x,target.y);await page.keyboard.press('e');await page.keyboard.press('Space');
      for(let i=0;i<24;i++){await page.waitForTimeout(25);const sample=await state();shotIdentity ||= sample.projectiles.some(p=>p.skillId==='icebolt');iceHit ||= sample.units.some(u=>u.team==='enemy'&&u.statuses.some(x=>x.id==='slow'&&x.skillId==='icebolt'));enemySlow ||= sample.hero.statuses.some(x=>x.id==='slow'&&x.skillId==='frostBolt');}
      continue;
    }
    if(target){await aim(target.x,target.y);if(!mouseHeld){await page.mouse.down();mouseHeld=true;}await page.keyboard.press('q');if(s.loadout.E==='icebolt')await page.keyboard.press('e');}
    await page.keyboard.press('Space');if(enemies.filter(e=>Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<3.8).length>=2)await page.keyboard.press('r');
    if(iceHit&&!savedCombat){await page.screenshot({path:'reports/17-equipped-combat.png'});savedCombat=true;}
    await page.waitForTimeout(120);
  }
  await page.mouse.up();s=await state();check(s.phase==='victory'&&s.kills===13&&shopVisited,'complete two waves with bought gear and replaced skill');
  check(rewards.join(',')==='1,2'&&s.perks.length===1,'one choice per wave; active skill is not an extra passive');
  check(iceHit&&shotIdentity,'replaced E creates actual ice projectiles and slow');check(enemySlow,'frost enemy still applies slow to equipped hero');
  await page.screenshot({path:'reports/18-build-victory.png'});
  await page.keyboard.press('Enter');await page.waitForTimeout(120);s=await state();check(s.phase==='ready'&&s.mapId==='frost'&&s.loadout.E==='dash'&&s.gold===160&&s.inventory.length===0,'restart resets build and money while retaining map');
  check(errors.length===0,`no browser errors: ${errors.join('; ')}`);
  writeFileSync('reports/browser-content.json',JSON.stringify({status:'passed',checks,errors,frostKills:13,rewards,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Build progression browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/content-failure.png'});writeFileSync('reports/browser-content.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
