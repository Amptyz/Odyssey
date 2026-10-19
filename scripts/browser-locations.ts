import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {MAPS,type MapId} from '../EmberDemo/assets/scripts/ember/content/maps';
import {JOURNEYS,sceneLocation} from '../EmberDemo/assets/scripts/ember/content/scenes';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[],screenshots:string[]=[],samples:unknown[]=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);checks.push(message);};
const view=()=>page.evaluate(()=>(window as any).__EMBER__.transition());
const send=(command:unknown)=>page.evaluate(c=>(window as any).__EMBER__.send(c),command);
async function shot(name:string){const path=`reports/location-${name}.png`;await page.locator('canvas').screenshot({path});screenshots.push(path);}
async function configure(mapId:MapId,camp:boolean,wave:number){
 await send({type:'DevOpen'});
 const draft=await page.evaluate(()=>(window as any).__EMBER__.snapshot().developer.draft);
 await send({type:'DevConfigure',config:{...draft,mapId,entry:camp?'camp':'combat',wave:camp?wave+1:wave,options:{invincible:true,noCooldown:false,freezeEnemies:true,speed:1}}});
 await send({type:'DevApply'});
 await page.waitForFunction(()=>{const t=(window as any).__EMBER__.transition();return t.title.active&&t.title.opacity===255;});
}
try{
 await page.goto(new URL('/?debug=1&locations=qa',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080').href);
 await page.waitForFunction(()=>(window as any).__EMBER__?.transition,undefined,{timeout:60000});
 check(!(await view()).title.active,'Main menu never shows an entry title');
 // Plain browser source keeps tsx's function-name helper out of the page realm.
 await page.evaluate(`(()=>{
  window.__locationFrames=[];
  const record=()=>{const e=window.__EMBER__;const frames=window.__locationFrames;frames.push({...e.transition(),tick:e.snapshot().tick});if(frames.length>400)frames.shift();requestAnimationFrame(record);};requestAnimationFrame(record);
 })()`);
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>(window as any).__EMBER__.transition().title.opacity===255);
 check((await view()).title.name==='余烬庭院'&&(await view()).title.subtitle==='启程营地','Normal Start shows the configured camp title and subtitle');
 await shot('normal-camp');
 await page.waitForFunction(()=>(window as any).__EMBER__.transition().title.elapsed>=(window as any).__EMBER__.transition().title.duration);
 const frames=await page.evaluate(()=>(window as any).__locationFrames);
 check(frames.filter((f:any)=>f.active).every((f:any)=>!f.title.active),'Entry title waits until the black curtain has revealed');
 const fading=frames.filter((f:any)=>f.title.active&&f.title.opacity>0&&f.title.opacity<255);
 check(fading.some((f:any)=>f.title.elapsed<.46)&&fading.some((f:any)=>f.title.elapsed>1.9),'Title fades in and out through actual rendered frames');
 const visible=frames.filter((f:any)=>f.title.active);
 check(visible.at(-1).tick>visible[0].tick,'World simulation continues throughout the entry title');
 check(!(await view()).title.active&&(await view()).title.opacity===0,'Title retires after a short hold without leaving a blocking panel');
 samples.push({name:'normal-opening',frames});
 for(const mapId of Object.keys(MAPS) as MapId[]){
  const places=[{camp:true,wave:0},...Object.keys(JOURNEYS[mapId].rests).map(w=>({camp:true,wave:Number(w)})),...MAPS[mapId].waves.map((_,i)=>({camp:false,wave:i+1}))];
  for(const {camp,wave}of places){
   if(mapId==='frost')await page.setViewportSize({width:960,height:640});
   await configure(mapId,camp,wave);const t=await view(),expected=sceneLocation(mapId,wave,camp);
   check(t.title.active&&t.title.name===expected.name&&t.title.subtitle===(expected.subtitle??''),`${mapId}/${camp?'camp':'level'}/${wave}: renders its own editable title`);
   if(wave===1&&!camp||wave===2&&camp)await shot(`${mapId}-${camp?'rest':'level'}`);
  }
 }
 const before=await view();await send({type:'DevRestart'});
 await page.waitForFunction(n=>(window as any).__EMBER__.transition().sequence>n,before.sequence);
 check((await view()).title.elapsed<.5,'Restarting the same level starts a fresh entry title');
 await send({type:'DevOpen'});await page.waitForTimeout(80);
 check(!(await view()).title.active,'Entry title does not cover the developer modal');
 await page.waitForTimeout(2500);await send({type:'DevClose'});await page.waitForTimeout(80);
 check(!(await view()).title.active,'Closing a modal does not replay an expired title');
 await send({type:'DevExit'});await page.waitForTimeout(100);
 check(!(await view()).title.active,'Returning to the main menu clears any title');
 await page.keyboard.press('Enter');await page.waitForTimeout(40);
 await send({type:'Restart'});await page.waitForTimeout(40);await send({type:'SelectMap',mapId:'ember'});await send({type:'Start'});
 await page.waitForFunction(()=>(window as any).__EMBER__.transition().title.opacity===255);
 check((await view()).title.name==='余烬庭院','Rapid switches discard the old location title');
 check(errors.length===0,'All location titles render without browser runtime errors');
 writeFileSync('reports/browser-locations.json',JSON.stringify({status:'passed',scope:'Normal Start plus explicit F2 fixtures for all 16 places; actual title frames, two viewport sizes, same-place restart and modal/menu lifecycle. No direct world mutation.',checks,samples,screenshots,errors},null,2)+'\n');
 console.log(`Passed ${checks.length} location title browser checks`);
}catch(error){await shot('failure').catch(()=>{});writeFileSync('reports/browser-locations.json',JSON.stringify({status:'failed',checks,samples,screenshots,errors,error:String(error)},null,2)+'\n');throw error;}
finally{await browser.close();}
