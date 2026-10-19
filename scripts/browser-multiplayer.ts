import {chromium,type Page} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startRelay} from './relay-server';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const directory=await mkdtemp(join(tmpdir(),'ember-browser-rooms-')),relay=await startRelay({port:0,directory});
const browser=await chromium.launch({channel:'chrome',headless:true}),a=await browser.newContext({viewport:{width:1280,height:720}}),b=await browser.newContext({viewport:{width:1280,height:720}});
const host=await a.newPage(),guest=await b.newPage(),errors:string[]=[],checks:string[]=[];
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
const state=(p:Page):Promise<WorldSnapshot>=>p.evaluate(()=>(window as any).__EMBER__.snapshot());
async function until(page:Page,predicate:(s:WorldSnapshot)=>boolean){for(let i=0;i<180;i++){if(predicate(await state(page)))return;await page.waitForTimeout(50);}throw Error('State timeout '+JSON.stringify(await state(page),(key,value)=>['units','hero','stats','level','enemies'].includes(key)?undefined:value));}
async function boot(page:Page){page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('/?debug=1&scene=coop',process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/').href);await page.waitForFunction(()=>(window as any).__EMBER__,undefined,{timeout:60000});}
async function room(page:Page,name:string,joining=false){await page.getByRole('button',{name:'联机房间',exact:true}).click();if(joining)await page.getByRole('button',{name:'加入',exact:true}).click();await page.getByLabel('你的名字').fill(name);await page.locator('summary').click();await page.getByLabel('中转地址').fill(`ws://127.0.0.1:${relay.port}`);}
async function walk(page:Page,kind:string){await until(page,s=>!s.paused);await page.waitForTimeout(140);const node=(await state(page)).scene.interactions.find(n=>n.kind===kind)!;const p=await page.evaluate(at=>(window as any).__EMBER__.screen(at.x,at.y),node),box=(await page.locator('canvas').boundingBox())!;await page.mouse.click(box.x+box.width/2+p.x*box.width/1280,box.y+box.height/2-p.y*box.height/720,{button:'right'});await until(page,s=>Math.hypot(s.hero.x-node.x,s.hero.y-node.y)<.35);await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});}
async function claim(page:Page){const choice=(await state(page)).choices.find(c=>c.kind==='skill')!;await page.evaluate(choiceId=>(window as any).__EMBER__.send({type:'ChooseReward',choiceId}),choice.id);await until(page,s=>!!s.pendingSkill&&!s.paused);await page.evaluate(()=>(window as any).__EMBER__.send({type:'ConfirmSkill',slot:'W'}));await until(page,s=>s.phase==='camp'&&!s.paused);}
async function title(page:Page,name:string){await page.waitForFunction(name=>{const t=(window as any).__EMBER__.transition().title;return t.active&&t.name===name&&t.opacity===255;},name);check(true,`player ${(await state(page)).hero.id} renders location title: ${name}`);}
try{
 await boot(host);await boot(guest);await room(host,'房主');await host.getByRole('button',{name:'创建房间',exact:true}).click();await until(host,s=>!!s.network?.code&&s.network.revision>=1);const code=(await state(host)).network!.code;
 await room(guest,'队友',true);await guest.getByLabel('房间码',{exact:true}).fill(code);await guest.getByRole('button',{name:'加入房间',exact:true}).click();await until(guest,s=>s.party?.length===2&&s.hero.id!=='hero');const playerId=(await state(guest)).hero.id;
 check(playerId!=='hero','room code assigns the guest a distinct player');await host.screenshot({path:'reports/scenes-coop-lobby.png'});
 await host.getByRole('button',{name:'开始 / 继续试炼',exact:true}).click();await guest.getByRole('button',{name:'返回游戏',exact:true}).click();await until(guest,s=>s.phase==='camp'&&!s.paused);
 await Promise.all([title(host,'余烬庭院'),title(guest,'余烬庭院')]);
 await walk(host,'ember');await host.keyboard.press('f');await until(host,s=>s.phase==='reward'&&!s.paused);check((await state(guest)).phase==='camp','host reward overlay does not open on the guest');
 const before=(await state(guest)).hero;await walk(guest,'ember');check(Math.hypot((await state(guest)).hero.x-before.x,(await state(guest)).hero.y-before.y)>1,'guest keeps moving while host is selecting an ember');
 await guest.keyboard.press('f');await until(guest,s=>s.phase==='reward'&&!s.paused);await claim(host);check((await state(guest)).phase==='reward','closing host choices does not close guest choices');await claim(guest);
 const savedPerks=(await state(guest)).perks;await walk(host,'departure');await host.keyboard.press('f');await host.waitForTimeout(200);check((await state(host)).wave===0,'host cannot depart while the guest is outside the range');
 await walk(guest,'departure');await guest.keyboard.press('f');await guest.waitForTimeout(200);check((await state(guest)).wave===0,'guest cannot launch the party even when all are ready');
 await guest.screenshot({path:'reports/scenes-coop-ready.png'});await host.keyboard.press('f');await until(guest,s=>s.phase==='fighting'&&!s.paused);check((await state(host)).wave===1,'host F launches all gathered players');
 await Promise.all([title(host,'余烬庭院·一'),title(guest,'余烬庭院·一')]);
 const s=await state(guest);
 check(s.enemies.units.length>0&&s.enemies.units.every(e=>e.decision?.profile),'guest receives the host-authored enemy decision profiles');
 check(s.enemies.units.every(e=>!e.decision?.targetId||s.party?.some(p=>p.id===e.decision!.targetId)),'replicated enemy targets refer to actual party players');
 const at=await guest.evaluate(at=>(window as any).__EMBER__.screen(at.x,at.y),{x:s.hero.x+2,y:s.hero.y});await guest.mouse.click(640+at.x,360-at.y,{button:'right'});await until(guest,v=>v.hero.x>s.hero.x+.3);
 check((await state(host)).units.some(u=>u.id===playerId&&u.x>s.hero.x+.1),'guest movement remains synchronized in combat');
 await guest.keyboard.press('w');await until(guest,s=>s.cooldowns.W>0);check((await state(host)).cooldowns.W===0,'guest skill cooldown is independent');
 const saved=await state(guest);await guest.reload();await guest.waitForFunction(()=>(window as any).__EMBER__);await until(host,s=>!!s.network?.blocked);const tick=(await state(host)).tick;await host.waitForTimeout(250);check((await state(host)).tick===tick,'disconnect pauses the authoritative world');
 await room(guest,'队友',true);await guest.getByRole('button',{name:'加入房间',exact:true}).click();await guest.getByRole('button',{name:'返回游戏',exact:true}).click();await until(guest,s=>s.hero.id===playerId&&!s.paused);check(JSON.stringify((await state(guest)).perks)===JSON.stringify(savedPerks),'reconnect retains this player and chosen ember');
 await host.close();await until(guest,s=>!!s.network?.blocked);await guest.getByRole('button',{name:'联机房间',exact:true}).click();await guest.getByRole('button',{name:'离开房间',exact:true}).click();await guest.getByRole('button',{name:'加入',exact:true}).click();await guest.getByLabel('房间码',{exact:true}).fill(code);await guest.getByRole('button',{name:'从该房间进度续玩',exact:true}).click();
 await until(guest,s=>s.network?.hostId===playerId&&s.network.code!==code);await guest.getByRole('button',{name:'开始 / 继续试炼',exact:true}).click();await until(guest,s=>s.phase==='fighting'&&!s.paused);
 const recovered=await state(guest);check(recovered.wave===1&&recovered.hero.id===playerId,'guest recovers the saved level as new host');check(recovered.gold===saved.gold&&JSON.stringify(recovered.perks)===JSON.stringify(savedPerks),'recovery keeps committed gold and ember without duplicate grants');check(recovered.cooldowns.W===0,'recovery clears stale combat cooldowns and input');await guest.screenshot({path:'reports/scenes-coop-recovered.png'});
 check(errors.length===0,'two Creator clients and relay have no page errors');
 writeFileSync('reports/browser-multiplayer.json',JSON.stringify({status:'passed',scope:'Normal two-browser room-code flow: movable camp, independent ember UI, range and host departure, input synchronization, reconnect and new-host recovery. Equipment transactions separately covered by relay unit integration and browser-scenes.',checks,errors},null,2)+'\n');console.log(`Passed ${checks.length} multiplayer browser checks`);
}catch(error){await guest.screenshot({path:'reports/scenes-coop-failure.png'}).catch(()=>{});writeFileSync('reports/browser-multiplayer.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();await relay.close();await rm(directory,{recursive:true,force:true});}
