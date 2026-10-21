import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const folder=process.env.EMBER_PALETTE_REPORT_DIR??'reports/hero-palettes';mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const state=()=>page.evaluate(()=>window.__EMBER__.snapshot());
const palette=async id=>{
 await page.getByRole('button',{name:'人物配色',exact:true}).click();
 await page.getByLabel('角色衣料颜色').selectOption(id);
 await page.waitForFunction(id=>window.__EMBER__.snapshot().party.find(p=>p.id===window.__EMBER__.snapshot().hero.id).paletteId===id,id);
 await page.getByRole('button',{name:'完成配色',exact:true}).click();
 await page.waitForTimeout(150);
};
try{
 await page.goto('http://127.0.0.1:8080/?debug=1&palette=verify');await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 for(const id of ['ash','moss','frost','wine','ochre','violet']){
  await palette(id);await page.screenshot({path:`${folder}/menu-${id}.png`});
  check((await state()).party[0].paletteId===id,`${id} selected through normal UI`);
 }
 await page.evaluate(()=>window.__EMBER__.send({type:'Start'}));await page.waitForFunction(()=>window.__EMBER__.snapshot().stagePhase==='camp'&&!window.__EMBER__.transition().title.active);
 await palette('frost');
 const before=await state();await page.screenshot({path:`${folder}/camp-frost.png`});
 check((await page.evaluate(()=>window.__EMBER__.art())).units.find(u=>u.id==='hero').sprite.paletteId==='frost','live hero consumes palette material');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__EMBER__.snapshot().paused);const paused=await state();await palette('wine');await page.waitForTimeout(200);
 check((await state()).tick===paused.tick,'palette selection does not advance a paused solo world');
 await page.screenshot({path:`${folder}/paused-wine.png`});
 await page.reload();await page.waitForFunction(()=>window.__EMBER__?.art().loaded);
 check((await state()).party[0].paletteId==='wine','local palette preference survives reload');
 await page.evaluate(()=>window.__EMBER__.send({type:'LoadRun'}));await page.waitForFunction(()=>window.__EMBER__.snapshot().stagePhase==='camp');
 check((await state()).party[0].paletteId==='wine','saved run restores palette');
 await page.evaluate(()=>window.__EMBER__.send({type:'DirectInput',movement:{x:.70710678,y:-.70710678}}));await page.waitForTimeout(400);
 const art=await page.evaluate(()=>window.__EMBER__.art());
 check(art.units.find(u=>u.id==='hero').sprite.paletteId==='wine','moving hero keeps its material across frame changes');
 await page.screenshot({path:`${folder}/moving-wine.png`});
 check(errors.length===0,'no browser or shader errors');
 writeFileSync(`${folder}/solo.json`,JSON.stringify({status:'passed',checks,errors},null,2)+'\n');
 console.log(`Passed ${checks.length} palette browser checks`);
}catch(error){await page.screenshot({path:`${folder}/failure.png`}).catch(()=>{});writeFileSync(`${folder}/solo.json`,JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
