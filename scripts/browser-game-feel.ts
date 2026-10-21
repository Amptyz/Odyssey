import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[],screenshots:string[]=[];
let status='failed',failure:string|undefined,motion:unknown,flight:unknown;
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
const state=():Promise<WorldSnapshot>=>page.evaluate(()=>(window as any).__EMBER__.snapshot());
async function button(title:string){
 await page.waitForFunction(title=>(window as any).__EMBER__.ui().buttons.some((b:any)=>b.title.includes(title)),title,{timeout:5000});
 const item=await page.evaluate(title=>(window as any).__EMBER__.ui().buttons.find((b:any)=>b.title.includes(title)),title);
 if(!item)throw Error(`Missing ${title}`);const box=(await page.locator('canvas').boundingBox())!;
 await page.mouse.click(box.x+box.width/2+item.x*box.width/1280,box.y+box.height/2-item.y*box.height/720);await page.waitForTimeout(120);
}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(new URL('/?debug=1&feel=qa',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/').href);
 await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});
 await button('WASD 移动');await page.keyboard.press('Enter');await page.waitForTimeout(650);
 const initial=await state(),art=await page.evaluate(()=>(window as any).__EMBER__.art());
 check(initial.phase==='camp'&&Math.abs(initial.hero.worldMoveSpeed-6.3)<1e-6,'normal player movement is six point three tiles per second');
 check(art.camera.zoom===1.25&&art.units.some((u:any)=>u.kind==='hero'&&u.worldScale.x===1.25&&u.worldScale.y===1.25),'actual hero node and projection both use the nearer zoom');
 const box=(await page.locator('canvas').boundingBox())!;
 await page.mouse.move(box.x+box.width/2+100*box.width/1280,box.y+box.height/2-40*box.height/720);
 await page.keyboard.down('KeyD');
 const frames=await page.evaluate(async()=>{
  const frames=[],started=performance.now();for(let i=0;i<600&&performance.now()-started<700;i++){
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   const api=(window as any).__EMBER__,s=api.snapshot(),a=api.art(),p=api.controls().pointer;
   frames.push({time:s.time,hero:{x:s.hero.x,y:s.hero.y},screen:api.screen(s.hero.x,s.hero.y),pointerScreen:api.screen(p.x,p.y),camera:a.camera});
  }return frames;
 });motion=frames;await page.keyboard.up('KeyD');
 check(Math.hypot(frames.at(-1)!.hero.x-frames[0]!.hero.x,frames.at(-1)!.hero.y-frames[0]!.hero.y)>2,'real held WASD input moves the faster player');
 check(frames.some(f=>Math.hypot(f.screen.x,f.screen.y)>5)&&frames.every(f=>Math.hypot(f.screen.x,f.screen.y)<100),'camera eases behind movement with bounded lag instead of snapping to every step');
 check(frames.slice(3).every(f=>Math.abs(f.pointerScreen.x-100)<1&&Math.abs(f.pointerScreen.y-40)<1),'pointer inverse projection remains aligned during smooth camera motion');
 await page.waitForTimeout(700);const settled=await page.evaluate(()=>{const api=(window as any).__EMBER__,h=api.snapshot().hero;return api.screen(h.x,h.y);});
 check(Math.hypot(settled.x,settled.y)<2,'camera settles back to the player after movement stops');
 await page.keyboard.press('Escape');await button('右键移动');await page.keyboard.press('Escape');await page.waitForTimeout(140);
 const before=await state(),target={x:before.hero.x+2,y:before.hero.y};
 const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),target);
 await page.mouse.click(box.x+box.width/2+p.x*box.width/1280,box.y+box.height/2-p.y*box.height/720,{button:'right'});
 await page.waitForFunction(p=>{const h=(window as any).__EMBER__.snapshot().hero;return Math.hypot(h.x-p.x,h.y-p.y)<.25;},target,{timeout:7000});
 check(true,'classic right-click movement reaches the clicked world point with zoom and smoothing');
 await page.evaluate(()=>{
  const api=(window as any).__EMBER__;api.send({type:'DevOpen'});const c=api.snapshot().developer.draft;
  api.send({type:'DevConfigure',config:{...c,entry:'combat',wave:1,perks:[],equipment:{},attributeTarget:'enemies',
   attributeModifiers:[{stat:'moveSpeed',operation:'multiply',value:0}],options:{invincible:true,noCooldown:false,freezeEnemies:false,speed:1}}});
  api.send({type:'DevApply'});api.send({type:'DevOpen'});api.send({type:'DevAction',action:'clearEnemies'});
  api.send({type:'DevSpawn',enemyId:'ranged',count:1});api.send({type:'DevAction',action:'step'});
 });await page.waitForTimeout(140);
 const reset=await page.evaluate(()=>{const api=(window as any).__EMBER__,h=api.snapshot().hero;return{screen:api.screen(h.x,h.y),units:api.art().units};});
 check(Math.hypot(reset.screen.x,reset.screen.y)<.1,'new-world camera resets immediately rather than flying across the map');
 check(reset.units.some((u:any)=>u.kind==='ranged'&&u.worldScale.x===1.25),'actual enemy node is enlarged along with the hero');
 const bullet=await page.evaluate(()=>{
  const api=(window as any).__EMBER__;let before:{id:number;x:number;y:number;time:number}|undefined;
  for(let i=0;i<90;i++){api.send({type:'DevAction',action:'step'});const s=api.snapshot(),p=s.enemies.projectiles[0];if(p){before={...p,time:s.time};break;}}
  api.send({type:'DevAction',action:'step'});const s=api.snapshot(),after=s.enemies.projectiles.find((p:any)=>p.id===before?.id);
  return{before,after:after?{...after,time:s.time}:undefined};
 });flight=bullet;
 check(bullet.before&&bullet.after&&Math.abs(Math.hypot(bullet.after.x-bullet.before.x,bullet.after.y-bullet.before.y)/(bullet.after.time-bullet.before.time)-9)<1e-6,'real Creator enemy projectile uses the global flight multiplier');
 await page.keyboard.press('F2');await page.waitForTimeout(120);
 await page.waitForFunction(()=>(window as any).__EMBER__.transition().title.active===false,undefined,{timeout:5000});
 for(const width of [1280,960]){
  await page.setViewportSize({width,height:width===1280?720:640});await page.waitForTimeout(160);
  const path=`reports/game-feel-${width}.png`;await page.screenshot({path});screenshots.push(path);
 }
 check(errors.length===0,'camera, enlarged actors and accelerated projectiles run without browser errors');status='passed';
 console.log(`Passed ${checks.length} game feel browser checks`);
}catch(error){failure=String(error);await page.screenshot({path:'reports/game-feel-failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync('reports/browser-game-feel.json',JSON.stringify({status,failure,scope:'Normal camp movement in both controls, actual camera/projection/node scale and explicit validated F2 enemy projectile fixture.',checks,errors,screenshots,motion,flight},null,2)+'\n');await browser.close();}
