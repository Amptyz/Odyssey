import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
const folder=process.env.EMBER_HERO_REPORT_DIR??'reports/whole-hero';mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720},recordVideo:{dir:folder,size:{width:1280,height:720}}});
const errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
const send=async c=>page.evaluate(c=>window.__EMBER__.send(c),c);
const state=()=>page.evaluate(()=>window.__EMBER__.snapshot());
const art=()=>page.evaluate(()=>window.__EMBER__.art());
try{
 await page.goto('http://127.0.0.1:8080/?debug=1');await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 await send({type:'Start'});await page.waitForTimeout(300);await page.waitForFunction(()=>!window.__EMBER__.transition().title.active);await page.screenshot({path:folder+'/neutral.png'});
 for(let direction=0;direction<8;direction++){
  const a=direction*Math.PI/4,x=Math.sin(a),sum=Math.cos(a),movement={x:(sum+x)*Math.SQRT1_2,y:(sum-x)*Math.SQRT1_2};
  await send({type:'DirectInput',movement});await page.waitForTimeout(450);
  const sample=await art();if(!sample.units.some(u=>u.kind==='hero'&&u.pose?.direction===direction&&u.sprite?.parts===1))throw Error('Wrong whole-body direction '+direction);samples.push({direction,art:sample});await page.screenshot({path:folder+'/run-'+direction+'.png'});
  await send({type:'Stop'});await page.waitForTimeout(60);
 }
 const clockSamples=await page.evaluate(()=>new Promise(resolve=>{const values=[];const collect=()=>{const s=window.__EMBER__.snapshot(),u=window.__EMBER__.art().units.find(u=>u.kind==='hero');values.push({tick:s.tick,age:u.pose.age});if(values.length<90)requestAnimationFrame(collect);else resolve(values);};requestAnimationFrame(collect);}));
 const ticks=new Map();for(const v of clockSamples){if(!ticks.has(v.tick))ticks.set(v.tick,new Set());ticks.get(v.tick).add(v.age);}if(![...ticks.values()].some(v=>v.size>1))throw Error('No sub-tick hero pose samples');samples.push({clockSamples});
 await send({type:'TogglePause'});await page.waitForTimeout(100);const before=await art();await page.waitForTimeout(250);const after=await art();
 if(JSON.stringify(before.units)!==JSON.stringify(after.units))throw Error('Paused hero pose changed');
 await send({type:'TogglePause'});await send({type:'DevOpen'});const s=await state();
 await send({type:'DevConfigure',config:{...s.developer.draft,entry:'combat',equipment:{slot1:'sword',slot2:'plate',slot3:'helm'},options:{invincible:true,noCooldown:true,freezeEnemies:true,speed:1}}});await send({type:'DevApply'});await send({type:'DevOpen'});await send({type:'DevAction',action:'clearEnemies'});await send({type:'DevClose'});await page.waitForTimeout(300);await page.waitForFunction(()=>!window.__EMBER__.transition().title.active);
 const h=(await state()).hero;await send({type:'Attack',point:{x:h.x+2,y:h.y}});await page.waitForTimeout(100);await page.screenshot({path:folder+'/equipped-same-body.png'});
 const baseline=await art();if(baseline.units.find(u=>u.kind==='hero')?.sprite?.atlas!=='hero-melee')throw Error('Equipped sword changed the body atlas');
 const weapons=['sword','staff','bow','bulwark','reaver','runeblade'],bodies=['plate','robe','leather','duelistVest','wardMantle','sanguineWrap'],heads=['helm','circlet','hood','keenVisor','sageMask','aegisCrown'];
 for(let i=0;i<6;i++){
  await send({type:'DevOpen'});const draft=(await state()).developer.draft;
  const equipped={slot1:weapons[i],slot2:bodies[i],slot3:heads[i]},order=[weapons[i],bodies[i],heads[i]];
  await send({type:'DevConfigure',config:{...draft,equipment:equipped,perks:i%2?['missileAttack']:[],loadout:{Q:'fireball',W:null,E:null,R:null}}});await send({type:'DevApply'});await send({type:'DevOpen'});await send({type:'DevAction',action:'clearEnemies'});await send({type:'DevClose'});await page.waitForTimeout(300);await page.waitForFunction(()=>!window.__EMBER__.transition().title.active);
  const hero=(await state()).hero;await send({type:'Attack',point:{x:hero.x-2,y:hero.y+1}});await page.waitForTimeout(130);await page.screenshot({path:folder+'/equipment-'+i+'.png'});const body=(await art()).units.find(u=>u.kind==='hero')?.sprite;if(body?.parts!==1||body?.atlas!==(i%2?'hero-ranged':'hero-melee'))throw Error('Equipment changed the body/form atlas '+i);samples.push({equipment:i,art:await art()});
  await send({type:'CastSlot',slot:'Q',point:{x:hero.x+2,y:hero.y}});await page.waitForTimeout(100);await page.screenshot({path:folder+'/cast-'+i+'.png'});
 }
 for(const mode of ['walk','melee','ranged']){
  await send({type:'DevOpen'});const draft=(await state()).developer.draft;
  await send({type:'DevConfigure',config:{...draft,equipment:{},perks:mode==='ranged'?['missileAttack']:[],attributeTarget:'players',attributeModifiers:mode==='walk'?[{stat:'moveSpeed',operation:'flat',value:-300}]:[]}});await send({type:'DevApply'});await send({type:'DevOpen'});await send({type:'DevAction',action:'clearEnemies'});await send({type:'DevClose'});await page.waitForTimeout(300);await page.waitForFunction(()=>!window.__EMBER__.transition().title.active);
  for(let direction=0;direction<8;direction++){
   const a=direction*Math.PI/4,x=Math.sin(a),sum=Math.cos(a),movement={x:(sum+x)*Math.SQRT1_2,y:(sum-x)*Math.SQRT1_2};
   if(mode==='walk')await send({type:'DirectInput',movement});
   else{const hero=(await state()).hero;await send({type:'Attack',point:{x:hero.x+movement.x*2,y:hero.y+movement.y*2}});}
   await page.waitForTimeout(mode==='walk'?300:100);const sample=await art();samples.push({mode,direction,art:sample});
   if(!sample.units.some(u=>u.kind==='hero'&&u.pose?.direction===direction&&u.sprite?.parts===1&&u.sprite?.clip===(mode==='walk'?'walk':mode)))throw Error(mode+' direction '+direction+' did not render');
   await page.screenshot({path:folder+'/'+mode+'-'+direction+'.png'});await send({type:'Stop'});await page.waitForTimeout(mode==='walk'?50:650);
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(folder+'/result.json',JSON.stringify({status:'passed',samples,errors,pauseFrozen:true},null,2));
}catch(error){writeFileSync(folder+'/result.json',JSON.stringify({status:'failed',error:String(error),samples,errors},null,2));throw error;}finally{await page.close();renameSync(await page.video().path(),folder+'/runtime-directions.webm');await browser.close();}
