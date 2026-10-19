import {chromium} from '@playwright/test';
import {GAME_TUNING} from '../EmberDemo/assets/scripts/ember/content/tuning';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {mapDefinition,type MapId} from '../EmberDemo/assets/scripts/ember/content/maps';
import {Pathfinder} from '../EmberDemo/assets/scripts/ember/ai/Pathfinder';
import {overlaps} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {distance,direction,type Vec2} from '../EmberDemo/assets/scripts/ember/utils/math';
// Read-only debug snapshots/projection. All game changes come from actual canvas keys/mouse and visible F2 controls.
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[],screenshots:string[]=[],held=new Set<string>(),reportFile=process.env.EMBER_LEVEL_SCOPE==='normal-nav'?'reports/browser-levels-navigation.json':'reports/browser-levels.json';let attacking=false;
page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message);checks.push(message);};
async function ui(x:number,y:number){const canvas=(await page.locator('canvas').boundingBox())!;return{x:canvas.x+canvas.width/2+x*canvas.width/1280,y:canvas.y+canvas.height/2-y*canvas.height/720};}
async function click(x:number,y:number){const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);}
async function key(value:string){await page.keyboard.press(value);await page.waitForTimeout(75);}
async function screenshot(name:string){const path=`reports/${name}.png`;await page.screenshot({path});screenshots.push(path);}
async function aim(point:Vec2){const projected=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),point),scale=Math.min(1,530/Math.max(1,Math.abs(projected.x)),215/Math.max(1,Math.abs(projected.y))),at=await ui(projected.x*scale,projected.y*scale);await page.mouse.move(at.x,at.y);}
async function move(vector?:Vec2){
 let wanted:string[]=[];if(vector&&Math.hypot(vector.x,vector.y)>.05){let best=-Infinity;for(const x of [-1,0,1])for(const y of [-1,0,1]){if(!x&&!y)continue;const wx=x/54-y/28,wy=-x/54-y/28,n=Math.hypot(wx,wy),score=(wx*vector.x+wy*vector.y)/n;if(score>best){best=score;wanted=[...(x<0?['a']:x>0?['d']:[]),...(y<0?['s']:y>0?['w']:[])];}}}
 for(const value of Array.from(held))if(!wanted.includes(value)){await page.keyboard.up(value);held.delete(value);}for(const value of wanted)if(!held.has(value)){await page.keyboard.down(value);held.add(value);}
}
async function stop(){await move();if(attacking){await page.mouse.up();attacking=false;}}
function movementGoal(s:WorldSnapshot,target:Vec2,nav:Pathfinder):Vec2 {
 const path=nav.find(s.hero,target);return path.find(p=>distance(p,s.hero)>.35)??target;
}
function escape(s:WorldSnapshot,target:Vec2,nav:Pathfinder):Vec2|undefined {
 const warnings=s.enemies.warnings.filter(w=>w.triggerAt-s.time<1.5),risk=warnings.some(w=>overlaps(w.shape,{...s.hero,radius:s.hero.radius+.4})),near=distance(s.hero,target),desired=Math.max(4,s.stats.attackRange*.77),bullets=s.enemies.projectiles;
 if(!risk&&near>=desired-1.2&&!bullets.some(p=>distance(p,s.hero)<2))return;
 const away=direction(target,s.hero),base=Math.atan2(away.y,away.x);let best:Vec2|undefined,score=-Infinity;
 for(const offset of [0,.55,-.55,1.1,-1.1,Math.PI/2,-Math.PI/2,Math.PI]){const angle=base+offset,p=nav.sweep(s.hero,{x:s.hero.x+Math.cos(angle)*3,y:s.hero.y+Math.sin(angle)*3},s.hero.radius);if(distance(p,s.hero)<1)continue;const next=-warnings.filter(w=>overlaps(w.shape,{...p,radius:s.hero.radius+.4})).length*100-bullets.filter(b=>distance(b,p)<1.6).length*40-Math.abs(distance(p,target)-desired)*3+distance(p,s.hero);if(next>score){score=next;best=p;}}
 return best;
}
async function followCheck(){const sample=await page.evaluate(()=>{const api=(window as any).__EMBER__,s=api.snapshot();return{hero:s.hero,screen:api.screen(s.hero.x,s.hero.y),camera:api.art().camera,pointer:api.controls().pointer};});check(sample.camera.zoom===GAME_TUNING.cameraZoom&&Math.hypot(sample.screen.x,sample.screen.y)<100,'Moving local player stays near the center under smooth zoomed follow');return sample;}
async function probeColumnNavigation(){
 await stop();await key('F2');await click(-464,237);let s=await state();if(s.developer!.draft.mapId!=='ember')await click(-390,165);for(let n=0;n<5&&(await state()).developer!.draft.wave!==1;n++)await click(130,165);s=await state();if(!s.developer!.draft.options.invincible)await click(-390,93);if(!s.developer!.draft.options.freezeEnemies)await click(390,93);await click(440,-322);
 s=await state();const obstacle=mapDefinition('ember').obstacles.find(o=>o.id==='entry-pillar')!,nav=new Pathfinder(mapDefinition('ember'),s.hero.radius);let reached=false;
 for(let attempt=0;attempt<60;attempt++){
  s=await state();const gap=distance(s.hero,obstacle)-obstacle.radius;if(gap>=s.hero.radius-1e-6&&gap<.355){reached=true;break;}
  let best:Vec2|undefined,bestScore=Infinity;for(const x of [-1,0,1])for(const y of [-1,0,1]){if(!x&&!y)continue;const raw={x:x/54-y/28,y:-x/54-y/28},n=Math.hypot(raw.x,raw.y),candidate=nav.sweep(s.hero,{x:s.hero.x+raw.x/n*s.hero.worldMoveSpeed*.1,y:s.hero.y+raw.y/n*s.hero.worldMoveSpeed*.1},s.hero.radius);if(distance(s.hero,candidate)<.015)continue;const score=Math.abs(distance(candidate,obstacle)-obstacle.radius-.33);if(score<bestScore){bestScore=score;best=candidate;}}
  if(best)await move(direction(s.hero,best));else{const toward=direction(s.hero,obstacle);await move({x:-toward.y,y:toward.x});}await page.waitForTimeout(85);
 }
 await stop();s=await state();const start={x:s.hero.x,y:s.hero.y},clearance=distance(start,obstacle)-obstacle.radius;check(reached&&clearance>=s.hero.radius-1e-6&&clearance<.36,'Actual WASD movement reaches the legal .32–.36 column-edge band');
 await key('Escape');await click(-145,98);await key('Escape');const away=direction(obstacle,start),goal={x:start.x+away.x*4,y:start.y+away.y*4},projected=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),goal),point=await ui(projected.x,projected.y);await page.mouse.click(point.x,point.y,{button:'right'});await page.waitForTimeout(650);s=await state();check(distance(start,s.hero)>.8,'Normal right-click pathfinding moves away after standing in the legal column-edge band');await screenshot('58-column-navigation-recovery');
 await key('F2');await click(-440,-322);
}
async function showBoss(mapId:MapId){
 await stop();await key('F2');await click(-464,237);let s=await state();if(s.developer!.draft.mapId!==mapId)await click(-390,165);for(let n=0;n<5&&(await state()).developer!.draft.wave!==5;n++)await click(130,165);s=await state();if(!s.developer!.draft.options.invincible)await click(-390,93);if(s.developer!.draft.options.freezeEnemies)await click(390,93);await click(440,-322);
 s=await state();const boss=s.units.find(u=>u.team==='enemy'&&u.alive)!;check(s.mapId===mapId&&s.wave===5&&s.units.filter(u=>u.team==='enemy'&&u.alive).length===1&&boss.kind===(mapId==='ember'?'courtyardHeart':'mirrorRegent'),`${mapId} F2 level 5 contains its unique Boss`);
 const nav=new Pathfinder(mapDefinition(mapId),s.hero.radius),deadline=Date.now()+35000;while(Date.now()<deadline){s=await state();if(distance(s.hero,boss)<6)break;const waypoint=movementGoal(s,boss,nav);await move(direction(s.hero,waypoint));await page.waitForTimeout(100);}await stop();
 await page.waitForFunction(()=>{const s=(window as any).__EMBER__.snapshot();return s.enemies.warnings.length>0;},undefined,{timeout:16000});await screenshot(mapId==='ember'?'54-ember-boss-court':'55-frost-boss-court');check((await state()).hero.alive,`${mapId} Boss visual check remains in the explicitly enabled F2 test world`);
 await key('F2');await click(-440,-322);
}
try{
 await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__?.snapshot().level);
 let s=await state();check(s.totalWaves===5&&!s.developer,'Normal startup exposes five levels without enabling developer mode');await click(145,45);check(await page.evaluate(()=>(window as any).__EMBER__.controls().mode)==='wasd','Select WASD through the visible home controls');await key('Enter');check((await state()).phase==='shop','Normal Enter opens the six-slot shop');await click(-90,-36);s=await state();check(s.inventory.includes('bow')&&s.equipment.slot1==='bow'&&s.gold===60,'Normal purchase equips a bow in universal slot 1');await screenshot('50-six-slot-opening-shop');await key('Enter');
 s=await state();const nav=new Pathfinder(mapDefinition(s.mapId),s.hero.radius),start={x:s.hero.x,y:s.hero.y},cameraBefore=await page.evaluate(()=>(window as any).__EMBER__.art().camera.origin);await page.keyboard.down('d');held.add('d');await page.waitForTimeout(650);await move();await page.waitForTimeout(120);s=await state();check(distance(start,s.hero)>1,'Actual held movement advances through the larger-than-screen map');await followCheck();const cameraAfter=await page.evaluate(()=>(window as any).__EMBER__.art().camera.origin);check(Math.hypot(cameraAfter.x-cameraBefore.x,cameraAfter.y-cameraBefore.y)>10,'Camera origin follows movement instead of fitting the whole map');
 const point={x:s.hero.x+2.25,y:s.hero.y-1.25};await aim(point);await page.waitForTimeout(80);const pointer=await page.evaluate(()=>(window as any).__EMBER__.controls().pointer);check(distance(pointer,point)<.15,'Canvas pointer inverse projection agrees with the followed camera');await screenshot('51-followed-map-and-guidance');
 const deadline=Date.now()+150000;let clearObserved=false,rewardObserved=false,combatShot=false;
 while(Date.now()<deadline){s=await state();if(s.phase==='defeat')throw Error(`Normal browser bot defeated in level ${s.wave}, time ${s.time.toFixed(1)}`);if(s.phase==='reward'){await stop();rewardObserved=true;break;}if(s.phase!=='fighting')throw Error(`Unexpected normal phase ${s.phase}`);
  const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>distance(a,s.hero)-distance(b,s.hero));const target=enemies[0];
  if(!target){if(!clearObserved){await stop();check(s.phase==='fighting'&&s.level.exitActive,'Natural clear activates exit while combat phase waits for arrival');await screenshot('52-cleared-level-exit-open');clearObserved=true;}const next=movementGoal(s,s.level.exit,nav);await move(direction(s.hero,next));}
  else {const gap=distance(s.hero,target),away=escape(s,target,nav);let goal=away;if(!goal&&(gap>s.stats.attackRange*.8||!nav.clear(s.hero,target)))goal=movementGoal(s,target,nav);await move(goal?direction(s.hero,goal):undefined);await aim({x:target.x+target.velocity.x*gap/18,y:target.y+target.velocity.y*gap/18});if(!attacking){await page.mouse.down();attacking=true;}if(gap<12&&nav.clear(s.hero,target,.1))await page.keyboard.press('q');if(gap<10)await page.keyboard.press('Space');if(gap<3.6)await page.keyboard.press('r');if(away&&s.enemies.warnings.some(w=>w.triggerAt-s.time<.65&&overlaps(w.shape,s.hero)))await page.keyboard.press('e');if(!combatShot&&s.enemies.warnings.length){await screenshot('53-natural-level-combat');combatShot=true;}}
  await page.waitForTimeout(95);
 }
 check(clearObserved&&rewardObserved,'Normal combat and actual movement into the exit earn a natural reward');s=await state();check(!s.developer&&s.wave===1,'Natural reward was reached without F2 cheats or forced progress');const choice=s.choices.findIndex(c=>c.kind==='perk');await key(String(choice+1));if((await state()).pendingSkill)await key('3');check((await state()).phase==='shop','Normal reward returns to the between-level shop');await click(280,113);s=await state();check(s.inventory.includes('staff')&&s.inventory.includes('bow')&&Object.values(s.equipment).includes('staff')&&Object.values(s.equipment).includes('bow'),'A second weapon is purchased into another universal slot without replacing the first');await screenshot('56-two-weapons-universal-slots');
 if(process.env.EMBER_LEVEL_SCOPE==='normal-nav')await probeColumnNavigation();else{await showBoss('ember');await showBoss('frost');}await page.setViewportSize({width:960,height:640});await screenshot('57-level-home-resized');check(errors.length===0,'No browser runtime errors');
 writeFileSync(reportFile,JSON.stringify({status:'passed',scope:process.env.EMBER_LEVEL_SCOPE==='normal-nav'?'Normal keyboard/mouse first reward/shop/camera; separate explicit F2 column-edge navigation regression':'Normal keyboard/mouse campaign first reward, six-slot shop and camera; separate explicit F2 Boss visual checks',checks,screenshots,errors,timestamp:new Date().toISOString()},null,2)+'\n');console.log(`Levels browser regression passed (${checks.length} checks).`);
}catch(error){await stop();await screenshot('levels-failure');writeFileSync(reportFile,JSON.stringify({status:'failed',checks,screenshots,errors,error:String(error),state:await state().catch(()=>undefined)},null,2)+'\n');throw error;}finally{await browser.close();}
