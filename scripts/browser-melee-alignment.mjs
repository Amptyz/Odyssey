import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {overlaps} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld.ts';

const dir='reports/melee-alignment';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const send=c=>page.evaluate(c=>window.__EMBER__.send(c),c),state=()=>page.evaluate(()=>window.__EMBER__.snapshot());
const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
async function mouseAttack(point){
 const at=await page.evaluate(p=>window.__EMBER__.screen(p.x,p.y),point),box=await page.locator('canvas').boundingBox();
 await page.mouse.click(box.x+box.width*(.5+at.x/1280),box.y+box.height*(.5-at.y/720));
}
async function capture(targetId){return page.evaluate(id=>new Promise(resolve=>{
 const start=performance.now(),frames=[];function frame(){const api=window.__EMBER__,s=api.snapshot();
  const target=s.units.find(u=>u.id===id);
  frames.push({time:s.time,tick:s.tick,target,swings:s.swings,melee:api.art().melee});
  if(performance.now()-start<500)requestAnimationFrame(frame);else resolve(frames);
 }frame();}),targetId);}
let status='failed',failure;
try{
 await page.goto('http://127.0.0.1:8080/?debug=1&melee=aligned-v4');await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 await send({type:'DevOpen'});const d=(await state()).developer.draft;
 await send({type:'DevConfigure',config:{...d,entry:'combat',mapId:'ember',wave:1,equipment:{},perks:[],attributeTarget:'enemies',
  attributeModifiers:[{stat:'armor',operation:'flat',value:900}],options:{invincible:true,noCooldown:false,freezeEnemies:true,speed:1}}});
 await send({type:'DevApply'});await page.waitForTimeout(100);
 await page.waitForFunction(()=>{const t=window.__EMBER__.transition();return t.elapsed>=t.duration&&t.title.elapsed>=t.title.duration;});
 await send({type:'MoveTo',point:{x:20,y:20}});await page.waitForFunction(()=>{const h=window.__EMBER__.snapshot().hero;return Math.hypot(h.x-20,h.y-20)<.1;});await send({type:'Stop'});
 await send({type:'DevOpen'});await send({type:'DevSpawn',enemyId:'melee',count:1});await send({type:'DevClose'});
 const s=await state(),target=s.units.filter(u=>u.team==='enemy').sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0];
 check(target.attributeValues.armor===905,'F2 durable target has the requested armor');
 for(let i=0;i<16;i++){
  const angle=i*Math.PI/8,position={x:target.x-3*Math.cos(angle),y:target.y-3*Math.sin(angle)};
  await send({type:'MoveTo',point:position});await page.waitForFunction(p=>{const h=window.__EMBER__.snapshot().hero;return Math.hypot(h.x-p.x,h.y-p.y)<.1;},position);await send({type:'Stop'});
  await page.waitForFunction(()=>window.__EMBER__.snapshot().hero.attackCd<=0);
  const before=(await state()).units.find(u=>u.id===target.id).hp;
  const pending=capture(target.id);await mouseAttack({x:target.x,y:target.y});const frames=await pending;cases.push({angle,before,frames});
  let contacts=0;
  for(const sample of frames)for(const frame of sample.melee.frames){
   const live=sample.swings.find(s=>s.id===frame.id);
   if(live)check(frame.age<=live.age+1e-7,`direction ${i}: displayed age is already simulated`);
   if(frame.blade&&overlaps(frame.blade,sample.target)){
    contacts++;check(sample.target.hp<before,`direction ${i}: visible blade contact has actual damage`);
   }
  }
  check(contacts>0,`direction ${i}: sampled visible contact`);
  const after=(await state()).units.find(u=>u.id===target.id).hp;
  check(Math.abs(before-after-20*100/(100+target.attributeValues.armor))<1e-5,`direction ${i}: one ordinary hit, no repeated tail damage`);
 }
 await page.keyboard.press('F3');await page.waitForFunction(()=>window.__EMBER__.snapshot().hero.attackCd<=0);
 await mouseAttack(target);await page.waitForFunction(()=>window.__EMBER__.art().melee.frames.some(f=>f.phase==='active'&&f.progress>.5));
 await page.screenshot({path:dir+'/blade-collision.png'});
 check(errors.length===0,'no browser errors');status='passed';
}catch(e){failure=String(e);await page.screenshot({path:dir+'/failure.png'});throw e;}
finally{
 writeFileSync(dir+'/runtime.json',JSON.stringify({status,failure,scope:'Explicit F2 frozen target with extra armor; real mouse clicks in 16 directions. No world mutation.',checks,errors,cases},null,2)+'\n');
 console.log(JSON.stringify({status,failure,checks:checks.length,errors}));await browser.close();
}
