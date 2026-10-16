import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {SHOP_CATALOG,equipment,type EquipmentId,type EquipmentLoadout} from '../EmberDemo/assets/scripts/ember/content/equipment';
import type {WorldSnapshot} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const ids=['reaver','runeblade','duelistVest','wardMantle','sanguineWrap','keenVisor','sageMask','aegisCrown'] as const;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),checks:string[]=[],errors:string[]=[],screenshots:string[]=[];
page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
function check(ok:unknown,message:string){if(!ok)throw Error(message);checks.push(message);}
async function ui(x:number,y:number){const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};}
async function click(x:number,y:number){const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(90);}
async function key(value:string){await page.keyboard.press(value);await page.waitForTimeout(90);}
async function shot(name:string){const path=`reports/eq-${name}.png`;await page.screenshot({path});screenshots.push(path);}
async function aim(x:number,y:number){const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y}),screen=await ui(p.x,p.y);await page.mouse.move(screen.x,screen.y);return screen;}
async function fresh(){await page.goto('http://127.0.0.1:8080/?debug=1&seed=1234');await page.waitForFunction(()=>!!(window as any).__EMBER__?.art().loaded);}
try{
  // Each new item is purchased from an ordinary opening shop, with no F2 or hidden grant.
  for(const id of ids){
    await fresh();await key('Enter');let s=await state();check(s.phase==='shop'&&!s.developer&&s.gold===160,`${id}: ordinary opening economy`);
    const index=SHOP_CATALOG.indexOf(id),slot=index%6,x=slot%2===0?-90:280,y=155-Math.floor(slot/2)*149;
    for(let p=0;p<Math.floor(index/6);p++)await click(-335,-329);
    await click(x+118,y-42);s=await state();check(s.gold===160&&s.inventory.length===0,`${id}: details preview leaves ownership and gold untouched`);await shot(`${id}-details`);await click(0,-325);
    await click(x-40,y-42);s=await state();check(s.gold===60&&s.equipment.slot1===id&&s.purchaseOrder.join(',')===id&&s.appearance[equipment(id).category]===id,`${id}: normal purchase equips its distinct appearance and purchase order`);
    const a=s.hero.attributeValues;const numericChecks:Record<string,boolean>={reaver:a.attackDamage===28&&a.omnivamp===.06,runeblade:a.attackDamage===26&&a.abilityPower===18&&a.abilityHaste===8,duelistVest:a.attackDamage===23&&a.critChance===.18,wardMantle:a.maxHealth===295&&a.magicResist===20,sanguineWrap:a.maxHealth===285&&a.attackDamage===26&&a.omnivamp===.06,keenVisor:a.attackDamage===28&&a.critChance===.18,sageMask:a.abilityPower===20&&a.magicPenFlat===10,aegisCrown:a.maxHealth===295&&a.magicResist===22};
    check(numericChecks[id],`${id}: runtime attributes match the designed item`);await shot(`${id}-shop`);
    await key('Enter');s=await state();check(s.phase==='fighting'&&!s.developer&&s.inventory.includes(id),`${id}: normal item enters combat`);
  }
  // Clearly separate explicit developer combinations from the ordinary purchase checks.
  const groups:EquipmentId[][]=[['reaver','duelistVest','keenVisor'],['runeblade','wardMantle','sageMask'],['bow','sanguineWrap','aegisCrown']];
  for(const [i,items] of groups.entries()){
    await fresh();await key('F2');const draft=(await state()).developer!.draft,equipped:EquipmentLoadout={};for(const [n,id] of items.entries())equipped[`slot${n+1}` as keyof EquipmentLoadout]=id;
    await page.evaluate(config=>(window as any).__EMBER__.send({type:'DevConfigure',config}),{...draft,equipment:equipped,purchaseOrder:items,options:{invincible:true,noCooldown:false,freezeEnemies:true,speed:1}});await click(440,-322);let s=await state();check(s.developer?.enabled&&items.every(id=>s.inventory.includes(id)),`Combination ${i+1}: explicitly enabled F2 loadout`);
    await aim(s.hero.x+2,s.hero.y-1);await page.mouse.down();await page.waitForTimeout(175);await shot(`mix-${i+1}-right-attack`);await page.mouse.up();await page.waitForTimeout(650);
    s=await state();await aim(s.hero.x-2,s.hero.y+1);await page.mouse.down();await page.waitForTimeout(175);await shot(`mix-${i+1}-left-attack`);await page.mouse.up();
    s=await state();const move=await aim(s.hero.x-2,s.hero.y);await page.mouse.click(move.x,move.y,{button:'right'});await page.waitForTimeout(200);await shot(`mix-${i+1}-walk`);
    if(i===1){
      const deadline=Date.now()+15000;let close=false;
      while(Date.now()<deadline){s=await state();const target=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0]!;
        const dx=target.x-s.hero.x,dy=target.y-s.hero.y,gap=Math.hypot(dx,dy);if(gap<1.8){close=true;await aim(target.x,target.y);break;}
        const p=await aim(s.hero.x+dx/gap*Math.min(3,gap),s.hero.y+dy/gap*Math.min(3,gap));await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(180);
      }
      check(close,'F2 rune test reaches an actual enemy using ordinary pointer movement');await key('w');s=await state();check(s.equipmentPassives.some(p=>p.kind==='spellblade'&&p.armedFor>0),'Successful shield cast arms spellblade in the rendered runtime');await shot('spellblade-armed');
      await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();s=await state();check(s.equipmentPassives.some(p=>p.kind==='spellblade'&&p.readyIn>2&&p.armedFor===0),'Actual directional collision consumes spellblade and starts its cooldown');await shot('spellblade-consumed');
    }
    await key('Escape');const paused=await state();await page.waitForTimeout(150);check((await state()).time===paused.time,`Combination ${i+1}: pause freezes simulation and equipment animation`);
  }
  await fresh();await key('F2');const draft=(await state()).developer!.draft;
  await page.evaluate(config=>(window as any).__EMBER__.send({type:'DevConfigure',config}),{...draft,equipment:{slot1:'wardMantle'},purchaseOrder:['wardMantle'],options:{invincible:false,noCooldown:false,freezeEnemies:false,speed:1}});await click(440,-322);await key('F2');
  await click(220,-35);await click(-220,-35);await page.evaluate(()=>(window as any).__EMBER__.send({type:'DevSpawn',enemyId:'melee',count:1}));await key('F2');
  await page.waitForFunction(()=>{const s=(window as any).__EMBER__.snapshot();return s.equipmentPassives.some((p:any)=>p.kind==='safetyShield'&&p.readyIn>0)&&s.hero.shield>0;},undefined,{timeout:8000});let guarded=await state();check(guarded.hero.alive&&guarded.hero.hp<guarded.hero.maxHp*.5&&guarded.hero.shields.some(sh=>sh.id.includes('equipment.safetyShield')),'Actual enemy damage at low life triggers the independent stone-breath shield');await shot('safety-shield-triggered');
  await page.setViewportSize({width:960,height:640});await fresh();await key('Enter');await click(-335,-329);await click(398,-185);await shot('details-960');
  check(errors.length===0,'No browser runtime errors from the eighteen-item catalog or procedural equipment');
  writeFileSync('reports/browser-equipment.json',JSON.stringify({status:'passed',scope:'Normal purchases of all eight new items; read-only details; separate explicit F2 mixed appearance and animation checks',checks,errors,screenshots,timestamp:new Date().toISOString()},null,2)+'\n');console.log(`Equipment browser regression passed (${checks.length} checks).`);
}catch(error){await shot('failure');writeFileSync('reports/browser-equipment.json',JSON.stringify({status:'failed',checks,errors,screenshots,error:String(error),state:await state().catch(()=>undefined)},null,2)+'\n');throw error;}finally{await browser.close();}
