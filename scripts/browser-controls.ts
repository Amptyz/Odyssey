import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors:string[]=[],checks:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(ok:unknown,label:string)=>{if(!ok)throw new Error(label);checks.push(label);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const mode=()=>page.evaluate(()=>(window as any).__EMBER__.controls().mode) as Promise<string>;
const ui=async(x:number,y:number)=>{
  const b=(await page.locator('canvas').boundingBox())!;
  return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};
};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(80);};
const aim=async(x:number,y:number)=>{const s=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});const p=await ui(s.x,s.y);await page.mouse.move(p.x,p.y);};
const hero=async()=>{const s=await state();return{x:s.hero.x,y:s.hero.y};};
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
try{
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');
  await page.waitForFunction(()=>!!(window as any).__EMBER__?.controls);
  check(await mode()==='classic','existing right-click mode remains the default');
  await click(145,45);check(await mode()==='wasd','select WASD on title screen');
  await page.screenshot({path:'reports/08-control-selection.png'});
  await page.reload();await page.waitForFunction(()=>!!(window as any).__EMBER__?.controls);
  check(await mode()==='wasd','selection persists across reload');
  await click(0,-106);await page.keyboard.press('Enter');await page.waitForTimeout(100);check((await state()).phase==='fighting','start with WASD');
  // Real keyboard input, screen-space cardinal directions, no simulation mutations.
  for(const [key,signX,signY] of [['w',0,1],['s',0,-1],['a',-1,0],['d',1,0]] as const){
    const a=await hero();await page.keyboard.down(key);await page.waitForTimeout(230);await page.keyboard.up(key);await page.waitForTimeout(80);const b=await hero();
    const dx=(b.x-a.x)-(b.y-a.y),dy=-((b.x-a.x)+(b.y-a.y));
    check(signX?dx*signX>0.3&&Math.abs(dy)<0.05:dy*signY>0.3&&Math.abs(dx)<0.05,`${key.toUpperCase()} follows screen direction`);
    await page.waitForTimeout(100);check(dist(b,await hero())<0.01,`${key.toUpperCase()} release stops movement`);
  }
  check((await state()).hero.shield===0,'W moves without casting shield');
  const a=await hero();await page.keyboard.down('w');await page.keyboard.down('s');await page.waitForTimeout(150);
  await page.keyboard.up('w');await page.keyboard.up('s');check(dist(a,await hero())<0.01,'opposing keys cancel');
  await page.keyboard.press('Space');check((await state()).hero.shield>0,'Space casts shield');
  let h=await hero();await aim(h.x+5,h.y);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  check((await state()).cooldowns.Q>0,'right mouse casts Q');
  await page.keyboard.press('r');check((await state()).cooldowns.R>0,'R casts area skill');
  h=await hero();await aim(h.x+3,h.y);await page.keyboard.press('e');await page.waitForTimeout(250);
  check((await state()).cooldowns.E>0&&dist(h,await hero())>1,'E dashes toward pointer');
  // Pause while movement is held, then switch modes without resetting combat.
  await page.keyboard.down('d');await page.waitForTimeout(100);await page.keyboard.press('Escape');await page.waitForTimeout(100);
  const paused=await state();check(paused.paused,'pause while moving');
  await click(-145,98);check(await mode()==='classic','switch to right-click while paused');
  await page.keyboard.up('d');await page.keyboard.press('Escape');await page.waitForTimeout(200);
  check(dist(paused.hero,await hero())<0.01,'mode switch clears held movement');
  const beforeClassic=await hero();await aim(beforeClassic.x+2,beforeClassic.y);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});await page.waitForTimeout(350);
  check(dist(beforeClassic,await hero())>0.3,'right-click movement still works after switch');
  await page.keyboard.press('Escape');await page.waitForTimeout(80);await click(145,98);
  await page.screenshot({path:'reports/09-wasd-help.png'});
  await click(145,-164);check((await state()).phase==='ready'&&await mode()==='wasd','restart retains chosen mode');
  await click(0,-106);await page.keyboard.press('Enter');await page.waitForTimeout(100);
  // Directional melee while moving, with real WASD input. Full exit/reward flow lives in browser-levels/content.
  const deadline=Date.now()+25000;let basicHit=false;
  while(Date.now()<deadline){
    const s=await state();if(s.phase==='defeat')throw Error('WASD input encounter defeated');
    const enemy=s.units.filter(u=>u.alive&&u.team==='enemy').sort((a,b)=>dist(a,s.hero)-dist(b,s.hero))[0];
    if(!enemy)break;
    const dx=enemy.x-s.hero.x,dy=enemy.y-s.hero.y,sx=dx-dy,sy=-(dx+dy);
    for(const key of ['w','a','s','d'])await page.keyboard.up(key);
    if(dist(enemy,s.hero)>1.7){const key=Math.abs(sx)>Math.abs(sy)?sx>0?'d':'a':sy>0?'w':'s';await page.keyboard.down(key);}
    await aim(enemy.x,enemy.y);await page.mouse.down();await page.keyboard.press('Space');
    await page.waitForTimeout(180);
    if((await state()).cues.some(c=>c.kind==='damage'&&c.cause==='basic')){basicHit=true;break;}
  }
  await page.mouse.up();for(const key of ['w','a','s','d'])await page.keyboard.up(key);
  check(basicHit,'WASD approaches an enemy and directional mouse melee deals damage');
  await page.screenshot({path:'reports/10-wasd-combat.png'});
  await page.keyboard.press('Escape');await page.waitForTimeout(100);
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(150);
  await click(-145,98);check(await mode()==='classic','resized pause-menu selector works');await click(145,98);
  await page.keyboard.press('Escape');await page.waitForTimeout(100);
  await page.keyboard.down('d');await page.mouse.down();await page.waitForTimeout(100);
  // Emulate the browser's blur/visibility pair; verify a double notification cannot unpause.
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('blur'));});
  await page.waitForTimeout(100);check((await state()).paused,'focus loss pauses even with repeated notifications');
  await page.keyboard.up('d');await page.mouse.up();const blurred=await hero();
  await page.keyboard.press('Escape');await page.waitForTimeout(200);check(dist(blurred,await hero())<0.01,'focus return does not latch movement');
  check(errors.length===0,`no browser errors: ${errors.join('; ')}`);
  writeFileSync('reports/browser-controls.json',JSON.stringify({status:'passed',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Dual-control browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/controls-failure.png'});writeFileSync('reports/browser-controls.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
