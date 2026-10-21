import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='reports/melee-vfx-v3';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const send=c=>page.evaluate(c=>window.__EMBER__.send(c),c);
try{
 await page.goto('http://127.0.0.1:8080/?debug=1&melee=keyframes-v3');await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 await send({type:'DevOpen'});
 const d=await page.evaluate(()=>window.__EMBER__.snapshot().developer.draft);
 await send({type:'DevConfigure',config:{...d,entry:'combat',mapId:'ember',wave:1,equipment:{},perks:[],options:{invincible:true,noCooldown:false,freezeEnemies:true,speed:.25}}});
 await send({type:'DevApply'});await page.waitForTimeout(100);
 await page.waitForFunction(()=>{const t=window.__EMBER__.transition();return t.elapsed>=t.duration&&t.title.elapsed>=t.title.duration;});
 await send({type:'MoveTo',point:{x:20,y:20}});
 await page.waitForFunction(()=>{const h=window.__EMBER__.snapshot().hero;return Math.hypot(h.x-20,h.y-20)<.1;},{},{timeout:30000});
 await send({type:'Stop'});
 // Same snapshot geometry as gameplay; commands are the explicit debug interface.
 const record=[];
 for(const angle of [-Math.PI*.75,0]){
  const h=await page.evaluate(()=>window.__EMBER__.snapshot().hero);
  await send({type:'Attack',point:{x:h.x+3*Math.cos(angle),y:h.y+3*Math.sin(angle)}});
  for(const p of [.02,.2,.4,.6,.8]){
   await page.waitForFunction(p=>window.__EMBER__.art().melee.frames.some(f=>f.phase==='active'&&f.progress>=p),p);
   const name=`direction-${angle===0?'rotated':'reference'}-phase-${p}`;
   record.push({name,melee:await page.evaluate(()=>window.__EMBER__.art().melee)});
   await page.screenshot({path:`${dir}/${name}.png`});
  }
  await page.waitForTimeout(2700);
 }
 writeFileSync(`${dir}/review.json`,JSON.stringify({errors,record},null,2));console.log(JSON.stringify({errors,shots:record.map(r=>r.name)}));
}finally{await browser.close();}
