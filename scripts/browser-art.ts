import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import type {MotionPose} from '../EmberDemo/assets/scripts/ember/content/animation';
type ArtState={loaded:boolean;time:number;units:{id:string;kind:string;atlas:string;frame:number;opacity:number;pose:MotionPose}[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720},...(process.env.EMBER_RECORD_VIDEO==='1'?{recordVideo:{dir:'reports',size:{width:1280,height:720}}}:{})});
const page=await context.newPage(),errors:string[]=[],external:string[]=[],checks:string[]=[],states=new Set<string>();
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.protocol.startsWith('http')&&u.origin!=='http://127.0.0.1:8080'){external.push(u.href);return route.abort();}return route.continue();});
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);checks.push(message);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const art=()=>page.evaluate(()=>(window as any).__EMBER__.art()) as Promise<ArtState>;
const collect=async()=>{const a=await art();for(const u of a.units)states.add(`${u.kind==='hero'?'hero':'enemy'}:${u.pose.state}`);return a;};
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);};
const point=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});return ui(p.x,p.y);};
const command=async(c:unknown)=>{await page.evaluate(c=>(window as any).__EMBER__.send(c),c);await page.waitForTimeout(90);};
try{
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__?.art);
  check((await collect()).loaded,'local art library loads without external assets');
  await page.keyboard.press('Enter');await page.waitForTimeout(120);await page.screenshot({path:'reports/19-neutral-art.png'});
  await click(-90,-36);check((await state()).equipment.slot1==='bow'&&(await state()).gold===60,'ordinary catalog purchase equips the current100-gold bow');
  await page.screenshot({path:'reports/21-equipped-art.png'});
  await page.keyboard.press('Enter');await page.waitForTimeout(120);await collect();await page.screenshot({path:'reports/20-living-ruins.png'});
  let s=await state();const move=await point(s.hero.x+3,s.hero.y+2);await page.mouse.click(move.x,move.y,{button:'right'});await page.waitForTimeout(120);await collect();
  await page.keyboard.press('w');await page.waitForTimeout(60);await collect();
  await page.keyboard.press('Escape');await page.waitForTimeout(100);const before=await art();await page.waitForTimeout(350);const after=await art();
  check(before.time===after.time&&JSON.stringify(before.units)===JSON.stringify(after.units),'pause freezes animation frames and poses');await page.keyboard.press('Escape');
  // Six-layer ownership and enemy animation QA use an explicitly labelled developer world.
  // This replaces the obsolete three-wave natural bot; ordinary five-stage completion is covered by levels.
  await page.keyboard.press('F2');await page.waitForTimeout(100);s=await state();const draft=s.developer!.draft;
  await command({type:'DevConfigure',config:{...draft,wave:1,equipment:{slot1:'sword',slot2:'bow',slot3:'staff',slot4:'plate',slot5:'hood',slot6:'robe'},options:{invincible:true,noCooldown:true,freezeEnemies:false,speed:1}}});
  await click(440,-322);s=await state();check(s.developer?.enabled&&Object.keys(s.equipment).length===6,'explicit six-slot test world retains every equipped item');
  await page.screenshot({path:'reports/22-six-slot-art.png'});await page.keyboard.press('F2');await page.waitForTimeout(100);await command({type:'DevSpawn',enemyId:'warden',count:1});check((await state()).units.some(u=>u.kind==='warden'),'validated open-panel spawn creates the guardian test unit');await page.keyboard.press('F2');await page.waitForTimeout(100);
  await page.screenshot({path:'reports/22-guardian-procedural-art.png'});
  let wardenSeen=false,movingEnemySeen=false,hurtEnemySeen=false;const deadline=Date.now()+22000;
  for(let step=0;Date.now()<deadline;step++){
    s=await state();const a=await collect();if(a.units.some(u=>u.kind==='warden'&&u.atlas==='procedural-monster-v1'))wardenSeen=true;
    movingEnemySeen ||= s.units.some(u=>u.team==='enemy'&&Math.hypot(u.velocity.x,u.velocity.y)>.15);
    hurtEnemySeen ||= s.units.some(u=>u.team==='enemy'&&u.hurtAt>0&&s.time-u.hurtAt<.18);
    const target=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0];
    if(!target)break;
    const d=Math.hypot(target.x-s.hero.x,target.y-s.hero.y);if(d>3){const toward=await point(s.hero.x+(target.x-s.hero.x)/(d||1)*Math.min(4,d),s.hero.y+(target.y-s.hero.y)/(d||1)*Math.min(4,d));await page.mouse.click(toward.x,toward.y,{button:'right'});}
    const aim=await point(target.x,target.y);await page.mouse.move(aim.x,aim.y);await page.mouse.click(aim.x,aim.y);await page.waitForTimeout(65);await collect();
    if(step%3===0){await page.keyboard.press('q');await page.waitForTimeout(65);await collect();}
    if(step%4===0&&d<3.8){await page.keyboard.press('r');await page.waitForTimeout(65);await collect();}
    await page.waitForTimeout(50);
  }
  check(wardenSeen,'explicit guardian uses the current procedural-monster-v1 renderer');
  check(movingEnemySeen,'moving enemy velocity drives grounded locomotion in the procedural renderer');
  check(hurtEnemySeen,'real enemy damage supplies a recent hurt timestamp for the procedural hurt flash');
  for(const name of ['hero:idle','hero:walk','hero:cast','hero:attack','enemy:windup','enemy:attack','enemy:death'])check(states.has(name),`observed rendered ${name}`);
  check(errors.length===0&&external.length===0,'no browser errors or external HTTP resources');
  await page.screenshot({path:'reports/23-art-test-arena.png'});
  writeFileSync('reports/browser-art.json',JSON.stringify({status:'passed',scope:'normal neutral/bow shop and pause; explicit six-slot developer animation QA; no claim of natural five-stage completion',checks,states:Array.from(states),errors,external,timestamp:new Date().toISOString()},null,2)+'\n');console.log(`Art browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/art-failure.png'});writeFileSync('reports/browser-art.json',JSON.stringify({status:'failed',checks,states:Array.from(states),errors,external,error:String(error)},null,2)+'\n');throw error;}finally{await context.close();await page.video()?.saveAs('reports/24-art-test-arena.webm');await browser.close();}
