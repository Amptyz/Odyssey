import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const url = new URL(process.env.EMBER_PREVIEW_URL || 'http://127.0.0.1:8080');
url.searchParams.set('debug','1'); url.searchParams.set('seed','1234');
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const errors:string[] = [], external:string[] = [], rewards:unknown[] = [];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.protocol.startsWith('http')&&u.origin!==url.origin){external.push(u.href);return route.abort();}
  return route.continue();
});
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const assert=(v:unknown,m:string)=>{if(!v)throw new Error(m);};
const point=async(x:number,y:number,body=false)=>{
  const p=await page.evaluate(({x,y})=>(window as any).__EMBER__.screen(x,y),{x,y});
  const b=await page.locator('canvas').boundingBox(); if(!b)throw new Error('Canvas missing');
  const scale=Math.min(b.width/1280,b.height/720);
  return{x:b.x+b.width/2+p.x*scale,y:b.y+b.height/2-(p.y+(body?22:0))*scale};
};
try {
  await page.goto(url.href);
  await page.waitForFunction(()=>!!(window as any).__EMBER__);
  await page.locator('canvas').click({position:{x:10,y:10}});
  // Exercise W/E through keyboard, then start the normal three-wave run afresh.
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);if((await state()).phase==='shop'){await page.keyboard.press('Enter');await page.waitForTimeout(80);}
  const aim=await point(13,10); await page.mouse.move(aim.x,aim.y);
  await page.keyboard.press('w'); await page.keyboard.press('e'); await page.waitForTimeout(250);
  const skills=await state();
  assert(skills.hero.shield>0&&skills.cooldowns.W>0,'W shield failed');
  assert(skills.cooldowns.E>0&&skills.hero.x>11,'E dash failed');
  await page.evaluate(()=>(window as any).__EMBER__.send({type:'Restart'}));
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);if((await state()).phase==='shop'){await page.keyboard.press('Enter');await page.waitForTimeout(80);}
  const deadline=Date.now()+120000;
  let castR=false;
  while(Date.now()<deadline){
    const s=await state();
    if(s.phase==='victory'||s.phase==='defeat')break;
    if(s.phase==='shop'){await page.keyboard.press('Enter');await page.waitForTimeout(80);continue;}
    if(s.phase==='reward'){
      rewards.push({wave:s.wave,choices:s.choices});
      assert(s.choices.length===3&&new Set(s.choices.map(c=>c.id)).size===3,'Reward choices invalid');
      const best=s.choices.findIndex(c=>c.kind==='perk'&&(c.perkId==='burn'||c.perkId==='leech'));
      await page.keyboard.press(String(best<0?1:best+1)); await page.waitForTimeout(80);continue;
    }
    const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y));
    const e=enemies[0];
    if(e){
      const hit=await point(e.x,e.y,true);await page.mouse.click(hit.x,hit.y,{button:'right'});
      const p=await point(e.x,e.y);await page.mouse.move(p.x,p.y);await page.keyboard.press('q');
      if(Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<5)await page.keyboard.press('w');
      if(enemies.filter(e=>Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<3.8).length>=2){await page.keyboard.press('r');castR ||= (await state()).cooldowns.R>0;}
    }
    await page.waitForTimeout(180);
  }
  const end=await state();
  await page.screenshot({path:'reports/06-victory.png'});
  assert(end.phase==='victory','Three-wave run failed: '+end.phase);
  assert(rewards.length===3&&castR,'Missing wave reward or R cast');
  assert(errors.length===0&&external.length===0,'Runtime errors or external resources');
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);if((await state()).phase==='shop'){await page.keyboard.press('Enter');await page.waitForTimeout(80);} await page.waitForTimeout(100);
  assert((await state()).phase==='ready','Victory restart failed');
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(250);
  const bounds=await page.locator('canvas').boundingBox();
  assert(bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=961&&bounds.y+bounds.height<=641,'Canvas exceeds resized viewport');
  await page.screenshot({path:'reports/07-release-resize.png'});
  writeFileSync('reports/browser-playthrough.json',JSON.stringify({status:'passed',url:url.href,errors,external,rewards,end:{phase:end.phase,time:end.time,hp:end.hero.hp},skills:['Q','W','E','R'],resize:bounds,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log('Three waves, QWER, three rewards, victory/restart, resize and local-only resources passed.');
} catch(e) {
  await page.screenshot({path:'reports/playthrough-failure.png'});
  writeFileSync('reports/browser-playthrough.json',JSON.stringify({status:'failed',error:String(e),errors,external,rewards},null,2)+'\n');throw e;
} finally { await browser.close(); }
