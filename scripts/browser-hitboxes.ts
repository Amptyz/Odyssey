import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);checks.push(m);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const controls=()=>page.evaluate(()=>(window as any).__EMBER__.controls());
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(60);};
const aim=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});const at=await ui(p.x,p.y);await page.mouse.move(at.x,at.y);return at;};
try{
  for(const mode of ['classic','wasd'] as const){
    await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__);
    await click(mode==='classic'?-145:145,45);await page.keyboard.press('Enter');await page.waitForTimeout(80);
    await click(-90,-36);check((await state()).appearance.weapon==='bow',`${mode}: equip bow through normal shop`);
    await page.keyboard.press('Enter');await page.waitForTimeout(80);
    const before=await state(),h=before.hero;await aim(h.x,h.y-5);await page.mouse.down();
    await page.waitForFunction(()=>(window as any).__EMBER__.snapshot().projectiles.some((p:any)=>p.cause==='basic'));
    const firing=await state(),shot=firing.projectiles.find(p=>p.cause==='basic')!;await page.mouse.up();
    check(shot.radius>0&&shot.vy<0&&Math.abs(shot.vx)<.01,`${mode}: left mouse fires a directional body, not target damage`);
    check(!shot.skillId,`${mode}: basic bullet keeps independent attack identity`);
    await page.waitForTimeout(650);const released=(await state()).hero.action.id;await page.waitForTimeout(650);
    check((await state()).hero.action.id===released,`${mode}: releasing left mouse stops repeated fire`);
    await page.keyboard.press('Escape');await page.waitForTimeout(80);const frozen=await state(),e=frozen.units.find(u=>u.team==='enemy'&&u.alive)!;
    const nearBody={x:e.x-.7,y:e.y-.7};await aim(nearBody.x,nearBody.y);await page.waitForTimeout(80);const pointer=(await controls()).pointer;
    check(Math.hypot(pointer.x-nearBody.x,pointer.y-nearBody.y)<.06,`${mode}: pointer over enemy sprite does not snap to its center`);
    await page.keyboard.press('Escape');await page.waitForTimeout(80);
    if(mode==='classic'){
      const s=await state(),enemy=s.units.find(u=>u.alive&&u.team==='enemy')!,at=await aim(enemy.x,enemy.y),actions=s.hero.action.id;
      await page.mouse.click(at.x,at.y,{button:'right'});await page.waitForTimeout(750);
      check((await state()).hero.action.id===actions,'classic: right-click enemy only moves and never auto-attacks');
    }
    await page.keyboard.press('F3');await page.waitForTimeout(80);check((await controls()).colliders,`${mode}: F3 enables collider display`);
    if(mode==='wasd'){
      const s=await state();await aim(s.hero.x+5,s.hero.y);await page.mouse.down();await page.waitForTimeout(150);
      await page.screenshot({path:'reports/25-collision-volumes.png'});await page.mouse.up();
    }
  }
  check(errors.length===0,'no browser runtime errors');
  writeFileSync('reports/browser-hitboxes.json',JSON.stringify({status:'passed',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Pointer and collision browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/hitboxes-failure.png'});writeFileSync('reports/browser-hitboxes.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
