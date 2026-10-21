import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {screenToWorld,type Projection} from '../EmberDemo/assets/scripts/ember/render/GroundProjection';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[],samples:unknown[]=[],screenshots:string[]=[];let status='failed',failure:string|undefined;
const directions=[{name:'right',x:1,y:0,keys:['KeyD']},{name:'up',x:0,y:1,keys:['KeyW']},{name:'left',x:-1,y:0,keys:['KeyA']},{name:'down',x:0,y:-1,keys:['KeyS']},
 {name:'up-right',x:Math.SQRT1_2,y:Math.SQRT1_2,keys:['KeyW','KeyD']},{name:'up-left',x:-Math.SQRT1_2,y:Math.SQRT1_2,keys:['KeyW','KeyA']},
 {name:'down-left',x:-Math.SQRT1_2,y:-Math.SQRT1_2,keys:['KeyS','KeyA']},{name:'down-right',x:Math.SQRT1_2,y:-Math.SQRT1_2,keys:['KeyS','KeyD']}];
function check(ok:unknown,label:string){if(!ok)throw Error(label);checks.push(label);}
const state=():Promise<WorldSnapshot>=>page.evaluate(()=>(window as any).__EMBER__.snapshot());
async function button(title:string){
 await page.waitForFunction(title=>(window as any).__EMBER__.ui().buttons.some((b:any)=>b.title?.includes(title)),title,{timeout:5000});
 const b=await page.evaluate(title=>(window as any).__EMBER__.ui().buttons.find((b:any)=>b.title?.includes(title)),title),box=(await page.locator('canvas').boundingBox())!;
 await page.mouse.click(box.x+box.width/2+b.x*box.width/1280,box.y+box.height/2-b.y*box.height/720);await page.waitForTimeout(130);
}
async function start(mode:'wasd'|'classic'){
 if((await state()).phase!=='ready'){if(!(await state()).paused){await page.keyboard.press('Escape');await page.waitForTimeout(130);}await button('重新开始');}
 const current=await page.evaluate(()=>(window as any).__EMBER__.controls().mode);if(current!==mode)await button(mode==='wasd'?'WASD 移动':'右键移动');
 await page.keyboard.press('Enter');await page.waitForTimeout(300);
}
async function ticksFrom(tick:number,count:number){await page.waitForFunction(at=>(window as any).__EMBER__.snapshot().tick>=at,tick+count,{timeout:6000});}
async function sample(ticks:number){
 const a=await state();await ticksFrom(a.tick,ticks);
 return page.evaluate(a=>{
  const api=(window as any).__EMBER__,b=api.snapshot(),p=api.screen(a.hero.x,a.hero.y),q=api.screen(b.hero.x,b.hero.y),camera=api.art().camera;
  return{dt:b.time-a.time,dx:q.x-p.x,dy:q.y-p.y,pixelsPerSecond:Math.hypot(q.x-p.x,q.y-p.y)/(b.time-a.time),expected:a.hero.worldMoveSpeed*camera.pixelsPerUnit*camera.zoom,
   worldPerSecond:Math.hypot(b.hero.x-a.hero.x,b.hero.y-a.hero.y)/(b.time-a.time),expectedWorld:a.hero.worldMoveSpeed};
 },a);
}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(new URL('/?debug=1&movement=qa',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/').href);await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});
 for(const mode of ['wasd','classic'] as const){
  const rates:number[]=[];
  for(const d of directions){
   await start(mode);let target:{x:number;y:number}|undefined;const before=await state();
   if(mode==='wasd'){for(const key of d.keys)await page.keyboard.down(key);await ticksFrom(before.tick,3);}
   else{
    const at=await page.evaluate(()=>{const api=(window as any).__EMBER__,s=api.snapshot();return{hero:api.screen(s.hero.x,s.hero.y),camera:api.art().camera};});
    const pointer={x:at.hero.x+d.x*180,y:at.hero.y+d.y*180};target=screenToWorld(pointer,at.camera as Projection);const box=(await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x+box.width/2+pointer.x*box.width/1280,box.y+box.height/2-pointer.y*box.height/720,{button:'right'});await ticksFrom(before.tick,5);
   }
   const s=await sample(mode==='wasd'?9:6);samples.push({mode,direction:d.name,...s});rates.push(s.pixelsPerSecond);
   const length=Math.hypot(s.dx,s.dy);
   check(Math.abs(s.pixelsPerSecond/s.expected-1)<(mode==='wasd'?.005:.035)&&Math.hypot(s.dx/length-d.x,s.dy/length-d.y)<.01,`${mode}/${d.name}: actual projected movement keeps uniform pace and requested direction`);
   check(Math.abs(s.worldPerSecond/s.expectedWorld-1)<(mode==='wasd'?.005:.035),`${mode}/${d.name}: world speed matches the attribute without directional acceleration`);
   if(mode==='wasd'){
    for(const key of d.keys)await page.keyboard.up(key);await page.waitForTimeout(120);const stopped=(await state()).hero;await page.waitForTimeout(120);const after=(await state()).hero;
    check(Math.hypot(after.x-stopped.x,after.y-stopped.y)<1e-8,`${mode}/${d.name}: releasing the real keys stops movement`);
   }else{
    await page.waitForFunction(target=>{const h=(window as any).__EMBER__.snapshot().hero;return Math.hypot(h.x-target.x,h.y-target.y)<.15;},target!,{timeout:9000});
    check(true,`${mode}/${d.name}: right-click travel still reaches the selected world point`);
   }
  }
  check(Math.max(...rates)/Math.min(...rates)<1.035,`${mode}: up, down, horizontal and diagonal screen speeds agree within measurement tolerance`);
 }
 for(const width of [1280,960]){await page.setViewportSize({width,height:width===1280?720:640});await page.waitForTimeout(300);const path=`reports/movement-directions-${width}.png`;await page.screenshot({path});screenshots.push(path);}
 check(errors.length===0,'actual eight-direction movement and camera follow have no browser errors');status='passed';
}catch(error){failure=String(error);await page.screenshot({path:'reports/movement-directions-failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync('reports/browser-movement-directions.json',JSON.stringify({status,failure,scope:'Actual Creator Web Desktop, real WASD chords and right-click movement in a normal camp. Both Euclidean world speed and projected speed measured; displacements use the same current camera for both positions to cancel follow motion.',checks,samples,errors,screenshots},null,2)+'\n');await browser.close();}
console.log(`Passed ${checks.length} directional movement browser checks`);
