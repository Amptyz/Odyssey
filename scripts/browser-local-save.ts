import {chromium,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true}),page=await context.newPage();
const checks:string[]=[],errors:string[]=[],screenshots:string[]=[];let status='failed',failure:string|undefined;
const state=():Promise<WorldSnapshot>=>page.evaluate(()=>(window as any).__EMBER__.snapshot());
function check(ok:unknown,label:string){if(!ok)throw Error(label);checks.push(label);}
async function boot(){await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});await page.waitForTimeout(150);}
async function button(title:string){
 await page.waitForFunction(title=>(window as any).__EMBER__.ui().buttons.some((b:any)=>b.title?.includes(title)),title,{timeout:5000});
 const b=await page.evaluate(title=>(window as any).__EMBER__.ui().buttons.find((b:any)=>b.title?.includes(title)),title),box=(await page.locator('canvas').boundingBox())!;
 await page.mouse.click(box.x+box.width/2+b.x*box.width/1280,box.y+box.height/2-b.y*box.height/720);await page.waitForTimeout(150);
}
async function walk(target:{x:number;y:number}){
 await page.waitForTimeout(140); // Let the Cocos input snapshot observe the preceding modal/scene change.
 const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),target),box=(await page.locator('canvas').boundingBox())!;
 await page.mouse.click(box.x+box.width/2+p.x*box.width/1280,box.y+box.height/2-p.y*box.height/720,{button:'right'});
 await page.waitForFunction(at=>{const h=(window as any).__EMBER__.snapshot().hero;return Math.hypot(h.x-at.x,h.y-at.y)<.3;},target,{timeout:12000});await page.waitForTimeout(150);
}
async function interact(kind:string){const node=(await state()).scene.interactions.find(n=>n.kind===kind)!;await walk(node);await page.keyboard.press('KeyF');await page.waitForTimeout(160);}
async function screenshot(name:string){await page.waitForFunction(()=>(window as any).__EMBER__.transition().active===false,undefined,{timeout:5000});const path=`reports/local-save-${name}.png`;await page.screenshot({path});screenshots.push(path);}
async function importFile(text:string){
 const chooser=page.waitForEvent('filechooser');await button('导入存档文件');await(await chooser).setFiles({name:'ember-test-save.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForTimeout(240);
}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(new URL('/?debug=1&local-save=qa',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/').href);await boot();
 check((await state()).localSave?.available===false,'a fresh browser exposes an empty single-player save slot');
 await button('读取存档');check((await state()).phase==='ready'&&(await state()).localSave?.notice.includes('暂无'),'loading an empty slot reports the missing save without starting a run');
 await page.keyboard.press('Enter');await page.waitForTimeout(350);check((await state()).localSave?.available,'starting a normal game creates a durable browser save');
 await interact('ember');const offers=(await state()).choices,index=offers.findIndex(c=>c.kind==='skill'),choice=offers[index]!;if(choice.kind!=='skill')throw Error('No skill');
 await button(`选择  ${index+1}`);check((await state()).pendingSkill===choice.skillId,'normal reward selection is saved while awaiting a slot');
 await page.reload();await boot();check((await state()).phase==='ready'&&(await state()).localSave?.available,'refresh returns to the menu with a readable save');
 await screenshot('continue-menu');await button('继续存档');let s=await state();
 check(s.phase==='reward'&&s.pendingSkill===choice.skillId&&JSON.stringify(s.choices)===JSON.stringify(offers),'Continue restores the exact pending reward and offer without rerolling');
 await button('装备此技能');s=await state();check(s.loadout.Q===choice.skillId&&s.loadout.W===null&&s.scene.interactions.find(n=>n.kind==='ember')?.claimed,'equipping the earned skill persists null slots and the ember claim');
 await page.keyboard.press('Escape');await button('保存进度');check((await state()).localSave?.notice.includes('已保存'),'the pause menu saves and reports successful persistence');await screenshot('pause');
 const downloadEvent=page.waitForEvent('download');await button('导出存档文件');const download=await downloadEvent,path=await download.path();if(!path)throw Error('Download missing');const backup=await readFile(path,'utf8');
 check(JSON.parse(backup).checkpoint.players[0].loadout.Q===choice.skillId,'Export downloads a validated file containing the earned skill');
 await button('重新开始');check((await state()).phase==='ready'&&(await state()).localSave?.available,'Restart retains the previous save until a new game starts');
 await page.keyboard.press('Enter');check((await state()).loadout.Q===null,'a deliberately started new game has empty skills');await page.keyboard.press('Escape');
 await importFile(backup);s=await state();check(s.phase==='camp'&&s.loadout.Q===choice.skillId&&s.localSave?.notice.includes('已读取'),'the file chooser imports the backup into normal gameplay');
 await page.keyboard.press('Escape');const before=await state(),storedBefore=await page.evaluate(()=>localStorage.getItem('ember.solo.run.v1'));
 await importFile('{broken');s=await state();check(s.paused&&s.loadout.Q===before.loadout.Q&&s.localSave?.notice.includes('读取失败'),'a corrupt file reports failure and keeps the paused current build');
 check(storedBefore===await page.evaluate(()=>localStorage.getItem('ember.solo.run.v1')),'a rejected file cannot overwrite the durable save');
 await page.keyboard.press('Escape');await interact('departure');await page.waitForTimeout(350);const start=await state();check(start.phase==='fighting'&&start.localSave?.label.includes('第 1 关起点'),'departure automatically writes the combat start checkpoint');
 await walk({x:start.hero.x+1.2,y:start.hero.y});await page.keyboard.press('Escape');await button('保存进度');await button('读取存档');s=await state();
 check(s.phase==='fighting'&&s.paused&&Math.hypot(s.hero.x-start.hero.x,s.hero.y-start.hero.y)<.01,'manual battle save/load returns to the wave start and pauses for the player');
 check(s.loadout.Q===choice.skillId&&s.localSave?.notice.includes('已读取'),'battle loading retains the obtained skill and gives feedback');await screenshot('battle-loaded');
 await page.setViewportSize({width:960,height:640});await page.waitForTimeout(180);await screenshot('battle-loaded-960');await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(150);
 const loadedTime=(await state()).time;await button('继续试炼');await page.waitForTimeout(180);check(!(await state()).paused&&(await state()).time>loadedTime,'the player can resume the battle normally after loading');
 await page.keyboard.press('Escape');await page.waitForTimeout(150);
 await page.reload();await boot();await button('继续存档');check((await state()).phase==='fighting'&&(await state()).paused,'a second real refresh can continue the battle checkpoint');
 // An isolated fresh context verifies that a downloaded file is sufficient without shared local storage.
 const other=await browser.newContext({viewport:{width:1280,height:720}}),otherPage=await other.newPage();
 otherPage.on('pageerror',e=>errors.push(e.message));await otherPage.goto(page.url());await otherPage.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});
 await otherPage.locator('input[data-ember-run-file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await otherPage.waitForFunction(skill=>(window as any).__EMBER__.snapshot().loadout.Q===skill,choice.skillId,{timeout:7000});
 check(await otherPage.evaluate(()=>(window as any).__EMBER__.snapshot().localSave.available),'a separate browser can import the file and create its own durable save');await other.close();
 check(errors.length===0,'single-player persistence and actual file dialogs produce no Creator browser errors');status='passed';
}catch(error){failure=String(error);await page.screenshot({path:'reports/local-save-failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync('reports/browser-local-save.json',JSON.stringify({status,failure,scope:'Actual Creator build; normal mouse/keyboard reward path, page reloads, pause save/load, download, file chooser import, corruption rejection, battle checkpoint and isolated-browser file import.',checks,errors,screenshots},null,2)+'\n');await browser.close();}
console.log(`Passed ${checks.length} local save browser checks`);
