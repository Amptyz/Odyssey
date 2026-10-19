import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8083';
const out='reports/hero-equipment-v2';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[],observations=[];page.on('pageerror',e=>errors.push(e.message));
const send=async(c,delay=100)=>{await page.evaluate(c=>window.__EMBER__.send(c),c);if(delay)await page.waitForTimeout(delay);};
const snap=()=>page.evaluate(()=>window.__EMBER__.snapshot());
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});await page.screenshot({path:`${out}/${name}-detail.png`,clip:{x:585,y:275,width:125,height:110}});observations.push({name,hero:(await snap()).hero,art:(await page.evaluate(()=>window.__EMBER__.art())).units.find(u=>u.kind==='hero')});};
try{
 await page.goto(url+'/?debug=1&seed=1234');await page.waitForFunction(()=>window.__EMBER__?.art().loaded);await send({type:'Start'});await send({type:'LeaveShop'});
 for(const [i,gear]of [[],['sword','plate','helm'],['staff','robe','circlet'],['bow','leather','hood'],['bulwark','duelistVest','keenVisor'],['reaver','wardMantle','sageMask'],['runeblade','sanguineWrap','aegisCrown']].entries()){
  await send({type:'DevOpen'});const s=await snap();await send({type:'DevConfigure',config:{...s.developer.draft,equipment:Object.fromEntries(gear.map((id,j)=>['slot'+(j+1),id])),purchaseOrder:gear,options:{invincible:true,noCooldown:true,freezeEnemies:true,speed:.25}}});await send({type:'DevApply'});await send({type:'DevOpen'});await send({type:'DevAction',action:'clearEnemies'});await send({type:'DevClose'});
  await shot(`${i}-idle`);
  for(const [name,x]of [['right',1],['left',-1]]){await send({type:'DirectInput',movement:{x,y:0}},360);await shot(`${i}-${name}-walk`);await send({type:'DirectInput',movement:{x:0,y:0}});await page.waitForFunction(()=>window.__EMBER__.snapshot().hero.attackCd<=0,undefined,{timeout:15000});const h=(await snap()).hero;await send({type:'Attack',point:{x:h.x+x*5,y:h.y}},750);await shot(`${i}-${name}-attack`);await page.waitForTimeout(900);}
 }
 writeFileSync(`${out}/observations.json`,JSON.stringify({url,errors,observations,scope:'Explicit F2 config, six triplets and empty rig, both movement directions and attacks; inspect PNGs manually, no automated art-quality assertion.'},null,2));
}catch(e){writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(e),errors,observations},null,2));throw e;}finally{await browser.close();}
