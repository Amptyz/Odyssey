import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import type { MotionPose } from '../EmberDemo/assets/scripts/ember/content/animation';
type ArtState={loaded:boolean;time:number;units:{id:string;kind:string;atlas:string;frame:number;opacity:number;pose:MotionPose}[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720},...(process.env.EMBER_RECORD_VIDEO==='1'?{recordVideo:{dir:'reports',size:{width:1280,height:720}}}:{})});
const page=await context.newPage(),errors:string[]=[],external:string[]=[],checks:string[]=[],states=new Set<string>();
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.protocol.startsWith('http')&&u.origin!=='http://127.0.0.1:8080'){external.push(u.href);return route.abort();}return route.continue();});
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);checks.push(message);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const art=()=>page.evaluate(()=>(window as any).__EMBER__.art()) as Promise<ArtState>;
const collect=async()=>{const a=await art();for(const u of a.units)states.add(`${u.kind==='hero'?'hero':'enemy'}:${u.pose.state}`);return a;};
const click=async(x:number,y:number)=>{await page.mouse.click(640+x,360-y);await page.waitForTimeout(80);};
const point=async(x:number,y:number,body=false)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});return{x:640+p.x,y:360-p.y-(body?22:0)};};
try{
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__?.art);
  check((await collect()).loaded,'five local art atlases loaded');
  await page.keyboard.press('Enter');await page.waitForTimeout(100);await page.screenshot({path:'reports/19-neutral-art.png'});
  await click(-90,-36);await click(-90,-185);check((await state()).equipment.weapon==='bow'&&(await state()).equipment.body==='plate','normal catalog equips bow and armor');
  await page.screenshot({path:'reports/21-equipped-art.png'});
  await page.keyboard.press('Enter');await page.waitForTimeout(180);await page.screenshot({path:'reports/20-living-ruins.png'});
  const move=await point(12,12);await page.mouse.click(move.x,move.y,{button:'right'});await page.waitForTimeout(120);await collect();
  await page.keyboard.press('w');await page.waitForTimeout(60);await collect();
  await page.keyboard.press('Escape');await page.waitForTimeout(80);const before=await art();await page.waitForTimeout(350);const after=await art();
  check(before.time===after.time&&JSON.stringify(before.units)===JSON.stringify(after.units),'pause freezes animation frames and poses');
  await page.keyboard.press('Escape');
  let wardenSeen=false;const deadline=Date.now()+120000;
  while(Date.now()<deadline){
    const s=await state(),a=await collect();
    if(s.phase==='victory'||s.phase==='defeat')break;
    if(s.phase==='shop'){await page.keyboard.press('Enter');await page.waitForTimeout(80);continue;}
    if(s.phase==='reward'){
      const chosen=s.choices.findIndex(c=>c.kind==='perk'&&(c.perkId==='burn'||c.perkId==='leech'));
      const fallback=s.choices.findIndex(c=>c.kind==='perk');await page.keyboard.press(String((chosen>=0?chosen:fallback)+1));await page.waitForTimeout(80);continue;
    }
    if(!wardenSeen&&a.units.some(u=>u.atlas==='grovewarden')){wardenSeen=true;await page.screenshot({path:'reports/22-grovewarden.png'});}
    const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y));
    const target=enemies[0];if(target){const hit=await point(target.x,target.y,true);await page.mouse.click(hit.x,hit.y,{button:'right'});const aim=await point(target.x,target.y);await page.mouse.move(aim.x,aim.y);await page.keyboard.press('q');}
    if(enemies.some(e=>Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<5))await page.keyboard.press('w');
    if(enemies.filter(e=>Math.hypot(e.x-s.hero.x,e.y-s.hero.y)<3.8).length>=2)await page.keyboard.press('r');
    await page.waitForTimeout(110);
  }
  const end=await state();check(end.phase==='victory'&&end.kills===27,'normal three-wave run including elite completed with 27 kills');
  check(wardenSeen,'grovewarden atlas is used by the final-wave elite');
  for(const name of ['hero:idle','hero:walk','hero:cast','hero:attack','enemy:walk','enemy:attack','enemy:hurt','enemy:death'])check(states.has(name),`observed rendered ${name}`);
  check(errors.length===0&&external.length===0,'no browser errors or external HTTP resources');
  await page.screenshot({path:'reports/23-art-victory.png'});
  writeFileSync('reports/browser-art.json',JSON.stringify({status:'passed',checks,states:Array.from(states),errors,external,end:{phase:end.phase,kills:end.kills,hp:end.hero.hp,time:end.time},timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Art and animation browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/art-failure.png'});writeFileSync('reports/browser-art.json',JSON.stringify({status:'failed',checks,states:Array.from(states),errors,external,error:String(error)},null,2)+'\n');throw error;}
finally{await context.close();await page.video()?.saveAs('reports/24-art-playthrough.webm');await browser.close();}
