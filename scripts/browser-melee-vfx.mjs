import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {walkCampWithRightClick} from './browser-navigation.ts';
const dir='reports/melee-vfx-v3';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:dir+'/video',size:{width:1280,height:720}}});
const page=await context.newPage(),checks=[],errors=[],samples=[],shots=[];
const recording=page.video(),video=dir+'/video/white-melee-regression.webm';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const send=c=>page.evaluate(c=>window.__EMBER__.send(c),c),state=()=>page.evaluate(()=>window.__EMBER__.snapshot()),art=()=>page.evaluate(()=>window.__EMBER__.art());
const check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
async function button(title){const r=await page.evaluate(title=>window.__EMBER__.ui().buttons.find(b=>b.title?.includes(title)),title);if(!r)throw Error('Missing button '+title);const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+box.width*(.5+r.x/1280),box.y+box.height*(.5-r.y/720));await page.waitForTimeout(90);}
async function shot(name){const path=dir+'/'+name+'.png';await page.screenshot({path});shots.push(path);}
async function collect(ms){return page.evaluate(ms=>new Promise(resolve=>{const start=performance.now(),out=[];function frame(){const api=window.__EMBER__,s=api.snapshot();out.push({at:performance.now()-start,tick:s.tick,time:s.time,melee:api.art().melee,swings:s.swings.map(f=>({id:f.id,age:f.age,center:f.center,facing:f.facing,radius:f.radius,arc:f.arc}))});if(performance.now()-start<ms)requestAnimationFrame(frame);else resolve(out);}frame();}),ms);}
async function configure({speed=.25,range=0,attackSpeed=0,mapId='ember'}={}){await send({type:'DevOpen'});const d=(await state()).developer.draft;await send({type:'DevConfigure',config:{...d,mapId,entry:'combat',wave:1,equipment:{},perks:[],attributeTarget:'players',attributeModifiers:[...(range?[{stat:'attackRange',operation:'flat',value:range}]:[]),...(attackSpeed?[{stat:'attackSpeed',operation:'flat',value:attackSpeed}]:[])],options:{invincible:true,noCooldown:false,freezeEnemies:true,speed}}});await send({type:'DevApply'});await page.waitForTimeout(100);await page.waitForFunction(()=>{const t=window.__EMBER__.transition();return t.elapsed>=t.duration&&t.title.elapsed>=t.title.duration;},{},{timeout:7000});}
async function attack(angle=0){const s=await state(),p={x:s.hero.x+3*Math.cos(angle),y:s.hero.y+3*Math.sin(angle)};const at=await page.evaluate(p=>window.__EMBER__.screen(p.x,p.y),p),b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+b.width*(.5+at.x/1280),b.y+b.height*(.5-at.y/720));}
let status='failed',failure;
try{
 await page.goto((process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/')+'?debug=1&melee=keyframes-v3');await page.waitForFunction(()=>window.__EMBER__?.art().melee);
 check((await art()).melee.renderer==='approved-keyframe-sequence','built game plays the approved keyframe sequence');
 await button('单人试炼');check((await state()).phase==='camp','ordinary menu opens the camp');
 const ember=(await state()).scene.interactions.find(i=>i.kind==='ember');await walkCampWithRightClick(page,ember);await page.keyboard.press('f');await page.waitForTimeout(150);
 const choices=(await state()).choices,index=choices.findIndex(c=>c.kind==='skill');check(index>=0,'normal first ember offers an active skill');await button('选择  '+(index+1));await button('装备此技能');
 const departure=(await state()).scene.interactions.find(i=>i.kind==='departure');await walkCampWithRightClick(page,departure);await page.keyboard.press('f');await page.waitForTimeout(450);
 check((await state()).phase==='fighting','normal ember and departure flow enters combat');
 const normalCapture=collect(850);await attack(-Math.PI/2);const normal=await normalCapture;samples.push({case:'normal-speed',frames:normal});
 const active=normal.flatMap(s=>s.melee.frames.filter(f=>f.phase==='active'));
 check(active.length>=4&&new Set(active.map(f=>f.progress)).size>=4,'ordinary mouse attack has multiple continuous active poses');
 const repeatedTick=normal.some((s,i)=>i&&s.tick===normal[i-1].tick&&s.melee.frames.some(f=>f.phase==='active'&&normal[i-1].melee.frames.some(p=>p.id===f.id&&p.progress!==f.progress)));
 check(repeatedTick,'light flow changes between renders of the same 30 Hz simulation tick');
 check(normal.at(-1).melee.frames.length===0,'ordinary attack and residue retire');
 await configure();
 const facing=[];
 for(let i=0;i<16;i++){
  await attack(i*Math.PI/8);await page.waitForFunction(()=>window.__EMBER__.art().melee.frames.some(f=>f.phase==='active'&&f.progress>.5));
  const a=await art(),s=await state(),f=a.melee.frames.find(f=>f.phase==='active'),swing=s.swings.find(x=>x.id===f.id);
  check(!!swing&&f.radius===swing.radius&&f.arc===swing.arc&&JSON.stringify(f.center)===JSON.stringify(swing.center)&&JSON.stringify(f.facing)===JSON.stringify(swing.facing),'direction '+i+': range, facing and centre consume the real swing');facing.push(f);
  if(i===0||i===4||i===7)await shot('direction-'+i);
  if(i===4){await send({type:'TogglePause'});const p=await art();await page.waitForTimeout(160);check(JSON.stringify((await art()).melee)===JSON.stringify(p.melee),'pause freezes flow and residue');await send({type:'TogglePause'});}
  await page.waitForTimeout(2700);
 }
 samples.push({case:'sixteen-directions',frames:facing});
 await configure({speed:1,attackSpeed:5});const fastCapture=collect(1600);const h=(await state()).hero;const target=await page.evaluate(h=>window.__EMBER__.screen(h.x,h.y-3),h),box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*(.5+target.x/1280),box.y+box.height*(.5-target.y/720));await page.mouse.down();await page.waitForTimeout(1100);await page.mouse.up();const fast=await fastCapture;samples.push({case:'high-attack-speed',frames:fast});
 check(new Set(fast.flatMap(s=>s.melee.frames.map(f=>f.id))).size>=3,'high attack speed produces independent attacks at the configured 3 attacks/s cap');check(fast.at(-1).melee.frames.length===0,'high-speed attacks clean up after mouse release');
 await configure({speed:.25,range:2,mapId:'frost'});await attack(-Math.PI/4);await page.waitForFunction(()=>window.__EMBER__.art().melee.frames.some(f=>f.phase==='active'&&f.progress>.5));check((await art()).melee.frames.some(f=>f.radius===7),'range modifiers resize the same effect from authoritative radius');await page.keyboard.press('F3');await shot('frost-range-f3');await page.keyboard.press('F3');
 await send({type:'DevRestart'});await page.waitForTimeout(100);check((await art()).melee.frames.length===0,'restart discards all old attacks and tails');
 await configure({speed:1});await send({type:'DevOpen'});await send({type:'DevSpawn',enemyId:'melee',count:1});await send({type:'DevClose'});
 const s=await state(),nearest=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0];
 await send({type:'MoveTo',point:{x:nearest.x-3,y:nearest.y}});await page.waitForFunction(p=>{const h=window.__EMBER__.snapshot().hero;return Math.hypot(h.x-p.x,h.y-p.y)<.1;},{x:nearest.x-3,y:nearest.y},{timeout:5000});await send({type:'Stop'});await send({type:'Attack',point:nearest});const hits=await collect(500);samples.push({case:'real-hit',frames:hits});check(hits.some(s=>s.melee.impacts>0),'actual melee damage emits a white hit impact');
 check(errors.length===0,'Creator runtime emits no browser errors');status='passed';
}catch(e){failure=String(e);await shot('failure');throw e;}
finally{await context.close();if(recording){await recording.saveAs(video);await recording.delete();}await browser.close();const normal=samples.find(s=>s.case==='normal-speed')?.frames??[],intervals=normal.slice(1).map((s,i)=>s.at-normal[i].at).sort((a,b)=>a-b);const normalRenderObservation={samples:normal.length,medianIntervalMs:intervals[Math.floor(intervals.length*.5)],p95IntervalMs:intervals[Math.floor(intervals.length*.95)],distinctActivePoses:new Set(normal.flatMap(s=>s.melee.frames.filter(f=>f.phase==='active').map(f=>f.progress))).size,scope:'Single local Chrome capture only; not four-player GPU benchmarking.'};writeFileSync(dir+'/runtime.json',JSON.stringify({status,failure,video,normalRenderObservation,scope:'Normal camp/reward/departure and real mouse attack; explicit developer fixtures for 16 directions, pause, radius, high attack speed, restart, damage. Video recorded; no mutable world injection.',checks,errors,shots,samples:samples.map(entry=>{const poses=entry.frames.flatMap(s=>s.melee?.frames??[s]);return {case:entry.case,renderSamples:entry.frames.length,attacks:Array.from(new Set(poses.map(f=>f.id))),phases:Array.from(new Set(poses.map(f=>f.phase))),radii:Array.from(new Set(poses.map(f=>f.radius))),activePoses:new Set(poses.filter(f=>f.phase==='active').map(f=>f.progress)).size};})},null,2)+'\n');console.log(JSON.stringify({status,failure,checks:checks.length,errors}));}
