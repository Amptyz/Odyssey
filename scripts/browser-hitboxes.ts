import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {SHOP_CATALOG,type EquipmentId,type EquipmentLoadout} from '../EmberDemo/assets/scripts/ember/content/equipment';
import {walkCampWithRightClick} from './browser-navigation';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);checks.push(m);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const controls=()=>page.evaluate(()=>(window as any).__EMBER__.controls());
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(80);};
async function button(title:string,index=0){const buttons=await page.evaluate(()=>(window as any).__EMBER__.ui().buttons);const entry=buttons.filter((b:any)=>b.title?.includes(title))[index];if(!entry)throw Error('Missing UI button '+title);await click(entry.x,entry.y);}
const aim=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y});const at=await ui(p.x,p.y);await page.mouse.move(at.x,at.y);return at;};
async function captureArena(path:string){
  await page.waitForFunction(()=>{const t=(window as any).__EMBER__.transition();return t.elapsed>=t.duration&&t.title.elapsed>=t.title.duration;},undefined,{timeout:6000});
  await page.screenshot({path});
}
async function devForm(missile:boolean,items:EquipmentId[]=[]){
  await page.keyboard.press('F2');await page.waitForTimeout(90);const draft=(await state()).developer!.draft;
  const equipment=Object.fromEntries(items.map((id,i)=>[`slot${i+1}`,id])) as EquipmentLoadout;
  await page.evaluate(config=>(window as any).__EMBER__.send({type:'DevConfigure',config}),{...draft,entry:'combat',perks:[],equipment,options:{invincible:true,noCooldown:false,freezeEnemies:true,speed:1}});
  if(missile){await button('余烬');for(let i=0;i<3;i++){const found=await page.evaluate(()=>(window as any).__EMBER__.ui().buttons.some((b:any)=>b.title?.includes('飞弹普攻')));if(found)break;await button('下一页');}await button('飞弹普攻');check((await state()).developer!.draft.perks.includes('missileAttack'),'new form perk is selectable through the paginated F2 UI');await page.screenshot({path:'reports/attack-form-perk-selection.png'});}
  await click(440,-322);check((await state()).developer?.enabled,'explicit F2 test world applied');
}
async function shoot(missile:boolean,label:string,left=false){
  const h=(await state()).hero;await aim(h.x+(left?-5:5),h.y);await page.mouse.down();
  await page.waitForFunction(({missile,action})=>{const s=(window as any).__EMBER__.snapshot();return s.hero.action.id>action&&(missile?s.projectiles.some((p:any)=>p.cause==='basic'):s.swings.length>0);},{missile,action:h.action.id},{timeout:2500});
  const s=await state();await page.mouse.up();
  check(s.basicAttack===(missile?'missile':'slash'),`${label}: form matches owned augment`);
  if(missile){const p=s.projectiles.filter(p=>p.cause==='basic').sort((a,b)=>b.id-a.id)[0]!;check(p.radius>0&&p.vx*(left?-1:1)>0&&Math.abs(p.vy)<.01&&!p.skillId,`${label}: directional physical body keeps basic identity`);check(s.swings.length===0,`${label}: missile replaces slash instead of adding a second primary attack`);}
  else check(s.swings.length===1&&!s.projectiles.some(p=>p.cause==='basic'),`${label}: default swing remains melee even with ranged-looking equipment`);
  check(s.hero.action.basicAttack===s.basicAttack,`${label}: animation follows the form, not the equipment`);
  return s;
}
try{
  for(const mode of ['classic','wasd'] as const){
    await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__?.art().loaded);
    await button(mode==='classic'?'右键移动':'WASD 移动');check((await controls()).mode===mode,`${mode}: actual visible mode selector`);await button('单人试炼');
    check((await state()).phase==='camp',`${mode}: ordinary start enters camp`);
    await page.keyboard.press('F2');await page.waitForTimeout(100);const draft=(await state()).developer!.draft;
    await page.evaluate(config=>(window as any).__EMBER__.send({type:'DevConfigure',config}),{...draft,entry:'camp',wave:3,perks:[],equipment:{},options:{invincible:false,noCooldown:false,freezeEnemies:false,speed:1}});await click(440,-322);
    const walkRest=async(kind:string)=>{const node=(await state()).scene.interactions.find(n=>n.kind===kind)!;await page.keyboard.press('Escape');await page.waitForTimeout(80);await button('右键移动');await button('继续试炼');await walkCampWithRightClick(page,node);await page.keyboard.press('f');await page.waitForTimeout(140);};
    await walkRest('merchant');
    const id=mode==='classic'?'bow':'staff',index=SHOP_CATALOG.indexOf(id);
    await button('100 金',index);await button('购买并装备');let s=await state();check(s.equipment.slot1===id&&s.gold===60&&s.developer?.enabled,`${mode}: ${id} bought through merchant commands in an explicit F2 rest fixture`);
    check(s.stats.attackRange===5&&s.basicAttack==='slash',`${mode}: purchase never grants weapon range or attack form`);
    await button('离开商店');await walkRest('departure');await page.keyboard.press('Escape');await page.waitForTimeout(80);await button(mode==='classic'?'右键移动':'WASD 移动');await button('继续试炼');await shoot(false,`${mode} normal purchase`);
    await page.waitForTimeout(750);const released=(await state()).hero.action.id;await page.waitForTimeout(750);check((await state()).hero.action.id===released,`${mode}: releasing left mouse stops repeated fire`);
    // A real spawned body near the player keeps pointer checks in the viewport.
    // Distant campaign groups may legitimately be outside the camera.
    await devForm(false,[id]);
    await page.evaluate(()=>{const api=(window as any).__EMBER__;api.send({type:'DevOpen'});api.send({type:'DevSpawn',enemyId:'melee',count:1});api.send({type:'DevClose'});});
    const nearestEnemy=(s:WorldSnapshot)=>s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0]!;
    await page.keyboard.press('Escape');await page.waitForTimeout(80);const frozen=await state(),e=nearestEnemy(frozen);
    const nearBody={x:e.x-.7,y:e.y-.7};await aim(nearBody.x,nearBody.y);const pointer=(await controls()).pointer;
    check(Math.hypot(pointer.x-nearBody.x,pointer.y-nearBody.y)<.06,`${mode}: pointer does not snap to enemy center`);
    await page.keyboard.press('Escape');await page.waitForTimeout(80);
    if(mode==='classic'){
      s=await state();const enemy=nearestEnemy(s),at=await aim(enemy.x,enemy.y),actions=s.hero.action.id;
      await page.mouse.click(at.x,at.y,{button:'right'});await page.waitForTimeout(350);check((await state()).hero.action.id===actions,'classic: right-click enemy moves without auto-attack');
    }
    await devForm(true);s=await shoot(true,`${mode} empty-handed missile`);check(s.stats.attackRange===15&&!Object.keys(s.equipment).length,`${mode}: form perk supplies range without weapon`);
    await page.keyboard.press('Escape');await page.waitForTimeout(80);const before=await state();await page.waitForTimeout(150);check(JSON.stringify((await state()).projectiles)===JSON.stringify(before.projectiles),`${mode}: pause freezes missile bodies`);await page.keyboard.press('Escape');
    // InputController clears held inputs when it consumes the resumed state.
    // Let that render finish before issuing a new real key-down event.
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    if(mode==='wasd'){const before=(await state()).hero;await aim(before.x+8,before.y);await page.mouse.down();await page.keyboard.down('d');await page.waitForTimeout(280);await page.keyboard.up('d');await page.mouse.up();const after=(await state()).hero;check(Math.hypot(after.x-before.x,after.y-before.y)>.3,'WASD moves while holding missile fire');await page.waitForTimeout(100);check(Math.hypot((await state()).hero.x-after.x,(await state()).hero.y-after.y)<.01,'WASD release stops movement');}
    const items:EquipmentId[]=['sword','bow','staff','bulwark','reaver','runeblade'];
    for(const missile of [false,true]){
      await devForm(missile,items);s=await shoot(missile,`${mode} six weapons`);
      check(s.stats.attackDamage===50&&Object.keys(s.equipment).length===6,`${mode}: six weapon attributes coexist; all retain the same hero image`);
      await page.waitForTimeout(650);await shoot(missile,`${mode} six weapons mirrored`,true);
      await page.waitForTimeout(125);await captureArena(`reports/attack-form-${mode}-${missile?'missile':'slash'}-mirror.png`);
    }
    await page.keyboard.press('F3');await page.waitForTimeout(80);check((await controls()).colliders,`${mode}: F3 enables collider display`);
    await devForm(true,['bow','plate','helm']);await shoot(true,`${mode} mixed outfit`);await captureArena(`reports/attack-form-${mode}-colliders.png`);
    await page.keyboard.press('F2');await page.waitForTimeout(80);await click(-440,-322);s=await state();check(!s.developer&&s.basicAttack==='slash'&&s.stats.attackRange===5,`${mode}: exiting F2 clears form perk and its reach`);
  }
  check(errors.length===0,'no browser runtime errors');
  writeFileSync('reports/browser-hitboxes.json',JSON.stringify({status:'passed',scope:'Normal start enters camp; F2 rest fixtures use merchant purchases of bow/staff; both combat controls; explicit F2 empty and six-weapon form changes; pause, mirrored animation, pointer, collider and reset checks',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');
  console.log(`Pointer, attack form and collision browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/hitboxes-failure.png'});writeFileSync('reports/browser-hitboxes.json',JSON.stringify({status:'failed',checks,errors,error:String(error),state:await state().catch(()=>undefined)},null,2));throw error;}
finally{await browser.close();}
