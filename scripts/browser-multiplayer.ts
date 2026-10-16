import { chromium,type Page } from '@playwright/test';
import { mkdtemp,rm } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRelay } from './relay-server';
import {SHOP_CATALOG,type EquipmentId} from '../EmberDemo/assets/scripts/ember/content/equipment';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const directory=await mkdtemp(join(tmpdir(),'ember-browser-rooms-')),relay=await startRelay({port:0,directory});
const browser=await chromium.launch({channel:'chrome',headless:true}),a=await browser.newContext({viewport:{width:1280,height:720}}),b=await browser.newContext({viewport:{width:1280,height:720}});
let host=await a.newPage();const guest=await b.newPage(),errors:string[]=[],checks:string[]=[];
const url=process.env.EMBER_PREVIEW_URL??'http://127.0.0.1:8080/?debug=1';
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label);};
const state=(page:Page)=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
async function boot(page:Page){page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForFunction(()=>!!(window as any).__EMBER__);}
async function until(page:Page,check:(s:WorldSnapshot)=>boolean){for(let i=0;i<100;i++){if(check(await state(page)))return;await page.waitForTimeout(50);}throw Error('State timeout: '+JSON.stringify(await state(page)));}
async function room(page:Page,name:string){await page.getByRole('button',{name:'联机房间',exact:true}).click();await page.getByLabel('你的名字').fill(name);await page.locator('summary').click();await page.getByLabel('中转地址').fill(`ws://127.0.0.1:${relay.port}`);}
async function click(page:Page,x:number,y:number){await page.waitForTimeout(120);const box=(await page.locator('canvas').boundingBox())!;await page.mouse.click(box.x+box.width/2+x*box.width/1280,box.y+box.height/2-y*box.height/720);await page.waitForTimeout(100);}
async function buy(page:Page,id:EquipmentId){const index=SHOP_CATALOG.indexOf(id),slot=index%6;for(let n=0;n<Math.floor(index/6);n++)await click(page,-335,-329);await click(page,(slot%2===0?-90:280)-40,113-Math.floor(slot/2)*149);}
async function aim(page:Page,x:number,y:number){const at=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y}),box=(await page.locator('canvas').boundingBox())!;await page.mouse.move(box.x+box.width/2+at.x*box.width/1280,box.y+box.height/2-at.y*box.height/720);}
try{
  await boot(host);await boot(guest);await room(host,'房主');await host.getByRole('button',{name:'创建房间',exact:true}).click();
  await until(host,s=>!!s.network?.code&&s.network.revision>=1);const code=(await state(host)).network!.code;
  await room(guest,'队友');await guest.getByLabel('房间码',{exact:true}).fill(code);await guest.getByRole('button',{name:'加入房间',exact:true}).click();
  await until(guest,s=>s.party?.length===2&&s.hero.id!== 'hero');const playerId=(await state(guest)).hero.id;check(playerId!== 'hero','Room code joins a separate player slot');
  await host.screenshot({path:'reports/40-room-lobby.png'});
  await host.getByRole('button',{name:'开始 / 继续试炼',exact:true}).click();await guest.getByRole('button',{name:'返回游戏',exact:true}).click();
  await until(guest,s=>s.phase==='shop'&&!s.paused);await buy(guest,'runeblade');await until(guest,s=>s.appearance.weapon==='runeblade'&&!s.paused);
  await buy(host,'wardMantle');await until(host,s=>s.appearance.body==='wardMantle'&&!s.paused);
  check((await state(guest)).appearance.weapon==='runeblade'&&(await state(host)).appearance.body==='wardMantle','Independent equipment purchases synchronize');
  check((await state(guest)).hero.attributeValues.attackDamage===26&&(await state(host)).hero.attributeValues.maxHealth===295,'Each player resolves their own equipment attribute source');
  await click(host,455,-329);await until(host,s=>!!s.party?.find(p=>p.id===s.hero.id)?.ready);check((await state(host)).phase==='shop','Shop waits for teammate readiness');
  await click(guest,455,-329);await until(guest,s=>s.phase==='fighting'&&!s.paused);await until(host,s=>s.phase==='fighting'&&!s.paused);
  const before=await state(guest),goal={x:before.hero.x+2,y:before.hero.y};await aim(guest,goal.x,goal.y);
  const at=await guest.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),goal);await guest.mouse.click(640+at.x,360-at.y,{button:'right'});
  await until(guest,s=>Math.hypot(s.hero.x-before.hero.x,s.hero.y-before.hero.y)>.2);
  check((await state(host)).units.some(u=>u.id===playerId&&Math.hypot(u.x-before.hero.x,u.y-before.hero.y)>.1),'Guest movement is visible on host');
  const enemies=(await state(guest)).units.filter(u=>u.team==='enemy'&&u.alive);await aim(guest,enemies[0]!.x,enemies[0]!.y);await guest.keyboard.press('q');await until(guest,s=>s.cooldowns.Q>0);
  check((await state(host)).cooldowns.Q===0,'Guest skill cooldown does not change host cooldown');
  check((await state(guest)).equipmentPassives.some(p=>p.kind==='spellblade'&&p.armedFor>0)&&(await state(host)).equipmentPassives.every(p=>p.kind==='safetyShield'&&p.readyIn===0),'Guest spellblade charge and host safety-shield state remain independently synchronized');await guest.screenshot({path:'reports/41-coop-combat.png'});
  // Stage rewards/exit agreement are covered by levels + core coop integration.
  // Here verify the real relay/frame, per-player camera, interruption and durable recovery.
  const savedBuild=await state(guest);
  const cameraHero=await guest.evaluate(()=>{const s=(window as any).__EMBER__.snapshot();return (window as any).__EMBER__.screen(s.hero.x,s.hero.y);});
  check(Math.hypot(cameraHero.x,cameraHero.y)<6,'Guest camera follows their own character on the large map');
  await guest.reload();await guest.waitForFunction(()=>!!(window as any).__EMBER__);await until(host,s=>!!s.network?.blocked);
  const frozen=(await state(host)).tick;await host.waitForTimeout(250);check((await state(host)).tick===frozen,'Disconnect pauses the room and stops simulation');
  await room(guest,'队友');await guest.getByRole('button',{name:'加入房间',exact:true}).click();await guest.getByRole('button',{name:'返回游戏',exact:true}).click();await until(guest,s=>s.hero.id===playerId&&!s.paused);
  check((await state(guest)).appearance.weapon==='runeblade','Reconnect restores the same character and equipment');
  await host.close();await until(guest,s=>!!s.network?.blocked);await guest.getByRole('button',{name:'联机房间',exact:true}).click();await guest.getByRole('button',{name:'从该房间进度续玩',exact:true}).click();
  await until(guest,s=>!!s.network&&s.network.code!==code&&s.network.hostId===playerId);await guest.getByRole('button',{name:'开始 / 继续试炼',exact:true}).click();await until(guest,s=>s.phase==='fighting'&&!s.paused);
  const resumed=await state(guest);check(resumed.hero.id===playerId&&resumed.appearance.weapon==='runeblade'&&resumed.wave===1,'Teammate opens a new room from the saved level and becomes host');
  check(resumed.gold===savedBuild.gold&&JSON.stringify(resumed.perks)===JSON.stringify(savedBuild.perks),'Recovery preserves committed currency and chosen augments');
  check(JSON.stringify(resumed.hero.attributeValues)===JSON.stringify(savedBuild.hero.attributeValues)&&JSON.stringify(resumed.hero.attributeExplanation.sources)===JSON.stringify(savedBuild.hero.attributeExplanation.sources),'Recovery rebuilds identical attributes and sources without applying equipment twice');
  check(resumed.equipmentPassives.some(p=>p.kind==='spellblade'&&p.armedFor===0&&p.readyIn===0),'Wave recovery keeps the new passive but clears live charge and cooldown');
  check(resumed.cooldowns.Q===0&&resumed.time<savedBuild.time+1,'Recovery restarts the wave without carrying stale skill inputs');await guest.screenshot({path:'reports/42-coop-recovered.png'});
  check(errors.length===0,'No browser JavaScript errors');
  writeFileSync('reports/browser-multiplayer.json',JSON.stringify({status:'passed',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');console.log(`Co-op browser checks passed: ${checks.length}`);
}catch(error){await guest.screenshot({path:'reports/multiplayer-failure.png'});writeFileSync('reports/browser-multiplayer.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();await relay.close();await rm(directory,{recursive:true,force:true});}
