import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const folder=process.env.EMBER_HERO_REPORT_DIR??'reports/whole-hero';mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const send=c=>page.evaluate(c=>window.__EMBER__.send(c),c),state=()=>page.evaluate(()=>window.__EMBER__.snapshot());
try{
 await page.goto('http://127.0.0.1:8080/?debug=1');await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 await send({type:'DevOpen'});const draft=(await state()).developer.draft;
 await send({type:'DevConfigure',config:{...draft,entry:'combat',equipment:{},perks:[],attributeModifiers:[{stat:'maxHealth',operation:'flat',value:-140}],attributeTarget:'players',options:{invincible:false,noCooldown:false,freezeEnemies:false,speed:1}}});
 await send({type:'DevApply'});await send({type:'DevOpen'});await send({type:'DevAction',action:'clearEnemies'});await send({type:'DevClose'});
 await page.waitForFunction(()=>!window.__EMBER__.transition().title.active);
 await send({type:'DevOpen'});await send({type:'DevSpawn',enemyId:'melee',count:5});
 const framesPromise=page.evaluate(()=>new Promise(resolve=>{const samples=[],start=performance.now();let died;const collect=()=>{const s=window.__EMBER__.snapshot();if(s.phase==='defeat')died??=performance.now();samples.push({phase:s.phase,time:window.__EMBER__.art().time,ui:window.__EMBER__.ui(),hero:window.__EMBER__.art().units.find(u=>u.kind==='hero')});if(performance.now()-start<20000&&(died===undefined||performance.now()-died<1500))requestAnimationFrame(collect);else resolve(samples);};collect();}));
 await send({type:'DevClose'});
 await page.waitForFunction(()=>window.__EMBER__.art().units.some(u=>u.kind==='hero'&&u.pose?.state==='hurt'),undefined,{timeout:10000});
 const hurt=await page.evaluate(()=>window.__EMBER__.art().units.find(u=>u.kind==='hero'));
 if(hurt.sprite?.clip!=='hurt'||hurt.sprite?.parts!==1)throw Error('Hurt did not select the complete body');
 await page.screenshot({path:folder+'/hurt.png'});
 await page.waitForFunction(()=>window.__EMBER__.snapshot().phase==='defeat',undefined,{timeout:20000});
 const first=await page.evaluate(()=>({s:window.__EMBER__.snapshot(),ui:window.__EMBER__.ui(),a:window.__EMBER__.art()}));
 if(first.ui.overlayActive)throw Error('Result overlay covered the collapse immediately');
 await page.waitForTimeout(560);await page.screenshot({path:folder+'/death-settled.png'});
 const samples=await framesPromise;writeFileSync(folder+'/impact-samples.json',JSON.stringify(samples,null,2));const frames=new Set(samples.filter(s=>s.hero?.sprite?.clip==='death').map(s=>s.hero.sprite.column));
 for(const frame of [3,4,5,6,7])if(!frames.has(frame))throw Error('Death frame not presented: '+frame);
 const last=samples.at(-1);if(last.hero||!last.ui.overlayActive)throw Error('Dead actor/result panel lifecycle failed');
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(folder+'/impact.json',JSON.stringify({status:'passed',hurt,deathColumns:[...frames],resultPanelDelayed:true,samples,errors},null,2));
 console.log('Hurt, five death frames, complete fade and delayed result panel passed');
}catch(e){writeFileSync(folder+'/impact.json',JSON.stringify({status:'failed',error:String(e),errors},null,2));throw e;}
finally{await browser.close();}
