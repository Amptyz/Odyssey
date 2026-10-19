import {chromium} from '@playwright/test';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';

const url=process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080';
const originalDefinitions=JSON.parse(readFileSync('art-source/pixel-production-v1/production.json','utf8'));
const definitions=new Map(originalDefinitions.map(d=>[d.id,d]));
const registry='art-source/art-completion-v2/manifest.json';
if(existsSync(registry))for(const fragment of JSON.parse(readFileSync(registry,'utf8')))for(const patch of JSON.parse(readFileSync(fragment,'utf8')))definitions.set(patch.id,{...definitions.get(patch.id),...patch});
// Base gameplay IDs come from the original roster, never from supplemental pose atlases.
const monsters=originalDefinitions.filter(d=>!d.kind&&!d.id.endsWith('-phase2')).map(d=>d.id);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),checks=[],errors=[],external=[],screenshots=[],seen=new Set(),seenAtlases=new Set(),observations={vfx:[],bosses:[]};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/*',route=>{const target=new URL(route.request().url());if(target.protocol.startsWith('http')&&target.origin!==new URL(url).origin){external.push(target.href);return route.abort();}return route.continue();});
const state=()=>page.evaluate(()=>window.__EMBER__.snapshot()),art=()=>page.evaluate(()=>window.__EMBER__.art());
const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
const send=async(c,delay=90)=>{await page.evaluate(c=>window.__EMBER__.send(c),c);if(delay)await page.waitForTimeout(delay);};
async function clickRegion(r){const b=await page.locator('canvas').boundingBox();if(!b)throw Error('Canvas missing');await page.mouse.click(b.x+b.width*(.5+r.x/1280),b.y+b.height*(.5-r.y/720));await page.waitForTimeout(120);}
async function button(text,index=0){const buttons=await page.evaluate(()=>window.__EMBER__.ui().buttons),matches=buttons.filter(b=>b.title?.includes(text));const region=matches[index];if(!region)throw Error('UI button missing: '+text+'; visible: '+buttons.map(b=>b.title).join(' | '));await clickRegion(region);}
async function shot(name){const path='reports/pixel-'+name+'.png';await page.screenshot({path});screenshots.push(path);}
async function configure(patch={}){await send({type:'DevOpen'});const s=await state();await send({type:'DevConfigure',config:{...s.developer.draft,entry:'combat',...patch,options:{invincible:true,noCooldown:true,freezeEnemies:false,speed:1,...patch.options}}});await send({type:'DevApply'});check((await state()).developer?.enabled,'explicit developer configuration applied');}
async function spawn(ids){await send({type:'DevOpen'});await send({type:'DevAction',action:'clearEnemies'});for(const enemyId of ids)await send({type:'DevSpawn',enemyId,count:1});await send({type:'DevClose'});}
async function collect(ms){const end=Date.now()+ms;while(Date.now()<end){const a=await art();for(const u of a.units){seen.add(u.kind+':'+u.poseKey);const first=!seenAtlases.has(u.atlas);seenAtlases.add(u.atlas);if(first&&u.kind==='mirrorRegent'&&u.atlas.endsWith('-strike'))await shot(u.atlas.split('/').at(-1)+'-real-use');}if(a.vfx)checkBudget(a.vfx);await page.waitForTimeout(35);}}
function checkBudget(v){if(v.active>24||v.allocated>24||v.active>v.allocated)throw Error('VFX pool exceeds its 24-instance contract: '+JSON.stringify(v));}
async function vfxCase(skillId,kind,appearance,label,expectedRow){
 const loadout=skillId==='shield'?{Q:'fireball',W:'shield',E:'dash',R:'nova'}:{Q:skillId,W:'shield',E:'dash',R:'fireball'};
 await configure({mapId:'ember',wave:1,loadout,attributeModifiers:[],equipment:{},purchaseOrder:[],options:{freezeEnemies:true}});await spawn([]);
 const s=await state();await send({type:'CastSlot',slot:skillId==='shield'?'W':'Q',point:{x:s.hero.x+2,y:s.hero.y}},35);
 await page.waitForFunction(({kind,appearance})=>{const s=window.__EMBER__.snapshot(),a=window.__EMBER__.art();return s.cues.some(c=>c.kind===kind&&c.appearance===appearance)&&a.vfx.active>0;},{kind,appearance},{timeout:2500});
 const a=await art(),snapshot=await state(),cue=snapshot.cues.find(c=>c.kind===kind&&c.appearance===appearance);checkBudget(a.vfx);
 check(!!cue&&a.vfx.active>0,label+' actual cast emits the expected cue and allocates a textured effect');
 if(a.vfx.frames)check(a.vfx.frames.some(f=>f.row===expectedRow),label+' selects the expected atlas row');
 const initial=a.vfx.frames?.find(f=>f.id===cue.id);
 if(initial)await page.waitForFunction(({id,frame})=>window.__EMBER__.art().vfx.frames.some(f=>f.id===id&&f.frame>frame),initial,{timeout:1000});
 const progressed=await art();check(progressed.vfx.frames?.some(f=>f.id===cue.id&&f.frame>(initial?.frame??-1)),label+' advances to a later flipbook pose on simulation time');
 observations.vfx.push({label,kind:cue.kind,appearance:cue.appearance,expectedRow,debug:a.vfx,progressed:progressed.vfx});await shot('vfx-'+label);
 if(skillId==='shield'){
  await send({type:'TogglePause'});const before=await art();await page.waitForTimeout(350);const after=await art();
  check(before.time===after.time&&JSON.stringify(before.vfx)===JSON.stringify(after.vfx),'pause freezes the real shield flipbook and VFX allocation');await shot('vfx-shield-paused');await send({type:'TogglePause'});
 }
 await page.waitForTimeout(500);check((await art()).vfx.active===0,label+' effect retires after simulation cue age expires');
}
const report=(status,error)=>({status,url,scope:'ordinary visible camp entry, merchant transactions in an explicit F2 rest fixture; explicitly configured developer roster, enemy actions, Boss damage phases, two-map scenery and real skill VFX',notCovered:['natural campaign rewards and replacement UI','four-player overlap','GPU frame-time performance','strict source pixel-grid compliance'],reviewRequired:['inspect danger-warning screenshot for boundary contrast and empty ring safe zone; snapshot presence alone does not prove pixel visibility'],checks,seen:[...seen],seenAtlases:[...seenAtlases],observations,screenshots,errors,external,...(error?{error:String(error)}:{}),timestamp:new Date().toISOString()});
try{
 await page.goto(new URL('/?debug=1&seed=1234',url).href);await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 let a=await art();const loaded=new Map(a.library.atlases.map(d=>[d.id,d]));
 for(const id of definitions.keys())check(loaded.get(id)?.loaded&&loaded.get(id)?.filter==='nearest','registered atlas loads locally with nearest sampling: '+id);
 check(loaded.has('environment-frost-v2')&&loaded.has('vfx-bursts-v2'),'completion frost scenery and temporal VFX atlases are registered');await shot('home');
 await button('单人试炼');let s=await state();check(s.phase==='camp'&&!s.developer,'ordinary visible main menu opens the birth camp');await configure({entry:'camp',wave:3,equipment:{},purchaseOrder:[],perks:[]});await send({type:'MoveTo',point:{x:8,y:6}});await page.waitForFunction(()=>{const h=window.__EMBER__.snapshot().hero;return Math.hypot(h.x-8,h.y-6)<.4;});await page.keyboard.press('f');await page.waitForTimeout(150);s=await state();check(s.phase==='shop','F opens the merchant in an explicit F2 rest fixture');await shot('shop');
 const beforeGold=s.gold;await button('购买并装备');s=await state();check(s.gold===beforeGold-100&&s.inventory.length===1&&Object.keys(s.equipment).length===1,'visible merchant purchase deducts 100 gold and equips one real item');observations.normalPurchase={item:s.inventory[0],equipment:s.equipment,gold:s.gold};await shot('shop-equipped');
 await button('100 金');await button('金币不足');check((await state()).gold===s.gold,'visible unaffordable purchase leaves currency unchanged');await button('离开商店');check((await state()).phase==='camp','leaving merchant returns to the rest');await configure({entry:'combat',wave:1});
 check((await art()).environment.atlas==='environment','courtyard selects its warm scene atlas');
 await configure({options:{freezeEnemies:true}});await spawn(monsters);a=await art();for(const kind of monsters)check(a.units.some(u=>u.kind===kind&&u.atlas==='pixel-v1/'+kind),'actual PNG monster renderer selected: '+kind);await page.keyboard.press('F3');await shot('roster-f3');await page.keyboard.press('F3');
 await configure({equipment:{slot1:'sword',slot2:'staff',slot3:'bow',slot4:'plate',slot5:'hood',slot6:'robe'},purchaseOrder:['sword','bow','plate','hood','staff','robe'],options:{speed:1}});await spawn(['melee','warden','mirrorKnight','rimeWeaver']);await collect(10000);
 check([...seen].some(s=>s.includes(':windup'))&&[...seen].some(s=>s.includes(':strike')),'real enemy simulation chooses anticipation and strike frames');await shot('actions');
 await send({type:'TogglePause'});const before=await art();await page.waitForTimeout(350);const after=await art();check(before.time===after.time&&JSON.stringify(before.units)===JSON.stringify(after.units),'pause freezes enemy poses and contact anchors');await send({type:'TogglePause'});
 await vfxCase('shield','shield','shield','shield',3);await vfxCase('ironGuard','shield','shield','iron-guard',3);await vfxCase('nova','explosion','fire','fire',0);await vfxCase('frostNova','explosion','ice','ice',1);await vfxCase('cleave','swing','fire','slash',2);
 await configure({mapId:'ember',wave:1,loadout:{Q:'nova',W:'shield',E:'dash',R:'frostNova'},equipment:{},purchaseOrder:[],attributeModifiers:[],options:{freezeEnemies:true}});await spawn([]);
 await page.evaluate(()=>{const s=window.__EMBER__.snapshot();for(let i=0;i<36;i++)window.__EMBER__.send({type:'CastSlot',slot:'Q',point:s.hero});});await page.waitForTimeout(45);a=await art();s=await state();check(s.cues.filter(c=>c.kind==='explosion').length>=24,'stress uses at least 24 actual skill cues, without snapshot injection');checkBudget(a.vfx);check(a.vfx.active===24&&a.vfx.allocated===24,'real simultaneous skill cues saturate but cannot exceed 24 textured effects');observations.stress={cues:s.cues.length,vfx:a.vfx};await shot('vfx-pool-stress');await page.waitForTimeout(550);check((await art()).vfx.active===0,'stress effects recycle after expiry');
 for(const [mapId,expected]of [['ember','environment'],['frost','environment-frost-v2']]){await configure({mapId,wave:1,attributeModifiers:[],options:{freezeEnemies:true}});a=await art();check(a.environment.atlas===expected,mapId+' selects its dedicated scenery atlas after map switch');check(a.vfx.active===0,'map switch clears old active effects: '+mapId);await shot(mapId+'-environment');}
 for(const [id,mapId]of [['courtyardHeart','ember'],['mirrorRegent','frost']]){
  await configure({mapId,wave:1,loadout:{Q:'fireball',W:'shield',E:'dash',R:'nova'},equipment:{slot1:'staff'},purchaseOrder:['staff'],attributeTarget:'players',attributeModifiers:[{stat:'abilityPower',operation:'flat',value:1600}],options:{speed:2}});await spawn([id]);await collect(7000);await shot(id+'-phase1');if(id==='mirrorRegent')check([...seenAtlases].some(a=>a.endsWith('/mirrorRegent-strike')),'phaseI mirror strike atlas is consumed by actual enemy attack poses');
  let phase2=false;
  for(let i=0;i<18;i++){s=await state();const boss=s.units.find(u=>u.kind===id&&u.alive);if(!boss)throw Error(id+' unexpectedly dead before phase2 capture');if(s.enemies.units.find(u=>u.id===boss.id)?.phase===2){phase2=true;break;}await send({type:'CastSlot',slot:'Q',point:{x:boss.x,y:boss.y}});await page.waitForTimeout(450);}
  a=await art();check(phase2&&a.units.some(u=>u.kind===id&&u.phase===2&&[id+'-phase2',id+'-phase2-strike'].includes(u.atlas.split('/').at(-1))),'real projectile damage triggers dedicated phaseII atlas: '+id);await collect(6000);await shot(id+'-phase2');if(id==='mirrorRegent')check([...seenAtlases].some(a=>a.endsWith('/mirrorRegent-phase2-strike')),'phaseII mirror strike atlas is consumed by actual enemy attack poses');observations.bosses.push({id,mapId,phase:2});
 }
 await configure({mapId:'frost',wave:1,loadout:{Q:'nova',W:'shield',E:'dash',R:'frostNova'},equipment:{},purchaseOrder:[],attributeModifiers:[],options:{speed:1}});await spawn(['mirrorRegent']);
 await page.waitForFunction(()=>window.__EMBER__.snapshot().enemies.warnings.some(w=>w.contours?.some(p=>p.length)),undefined,{timeout:15000});
 await page.evaluate(()=>{const s=window.__EMBER__.snapshot();for(let i=0;i<20;i++)window.__EMBER__.send({type:'CastSlot',slot:'Q',point:s.hero});});await page.waitForTimeout(35);s=await state();a=await art();
 check(s.enemies.warnings.some(w=>w.contours?.length),'actual Boss warnings retain authoritative contours during 20 real friendly casts');checkBudget(a.vfx);observations.warningOverlap={warnings:s.enemies.warnings.map(w=>({shape:w.shape,contours:w.contours})),vfx:a.vfx,cues:s.cues.length};await shot('danger-warning-overlap-review');await page.keyboard.press('F3');await shot('danger-warning-overlap-f3');await page.keyboard.press('F3');
 await page.setViewportSize({width:960,height:640});await shot('responsive');check(errors.length===0&&external.length===0,'no browser runtime errors or external HTTP resources');
 writeFileSync('reports/browser-art.json',JSON.stringify(report('passed'),null,2)+'\n');console.log('Pixel production QA passed '+checks.length+' checks');
}catch(error){await shot('failure').catch(()=>{});writeFileSync('reports/browser-art.json',JSON.stringify(report('failed',error),null,2)+'\n');throw error;}finally{await browser.close();}
