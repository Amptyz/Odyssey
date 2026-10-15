import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { LAB_PRESETS } from '../EmberDemo/assets/scripts/ember/content/perks';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const checks:string[]=[],errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);checks.push(m);};
const state=()=>page.evaluate(()=>(window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
const ui=async(x:number,y:number)=>{const b=(await page.locator('canvas').boundingBox())!;return{x:b.x+b.width/2+x*b.width/1280,y:b.y+b.height/2-y*b.height/720};};
const click=async(x:number,y:number)=>{const p=await ui(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(90);};
const aim=async(x:number,y:number)=>{const p=await page.evaluate(p=>(window as any).__EMBER__.screen(p.x,p.y),{x,y}),at=await ui(p.x,p.y);await page.mouse.move(at.x,at.y);};
try{
  for(const [index,lab] of (['hexMage','hexAttack','hexSurvive'] as const).entries()){
    await page.goto('http://127.0.0.1:8080/?debug=1&seed=16');await page.waitForFunction(()=>!!(window as any).__EMBER__);
    if(index===0)await page.screenshot({path:'reports/26-hex-menu.png'});
    await click(145,45);await click((index-1)*280,-276);let s=await state();
    check(s.phase==='shop'&&s.lab===lab&&s.perks.join(',')===LAB_PRESETS[lab].join(','),`${lab}: visible menu opens normal shop with advertised preset`);
    if(lab==='hexMage'){check(s.hero.maxHp===168,'glass cannon reduces base maximum HP');await click(280,113);await click(-90,-185);check((await state()).hero.maxHp===210,'glass cannon also scales purchased armor HP');}
    if(lab==='hexAttack'){await click(-90,-36);await click(-90,-185);}
    if(lab==='hexSurvive'){await click(280,-36);await click(-90,-185);}
    await page.keyboard.press('Enter');await page.waitForTimeout(100);s=await state();check(s.phase==='fighting',`${lab}: normal wave starts`);
    if(lab==='hexSurvive'){
      await aim(s.hero.x,s.hero.y+3.5);await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__EMBER__.snapshot().zones.length>0);
      await page.keyboard.press('Escape');await page.waitForTimeout(60);const frozen=await state();check(frozen.zones[0]!.to.y>frozen.zones[0]!.from.y,'earthwake follows actual cursor-directed dash');
      await page.waitForTimeout(700);check(JSON.stringify((await state()).zones)===JSON.stringify(frozen.zones),'pause freezes delayed hitbox');
      await click(0,-230);await page.screenshot({path:'reports/27-hex-details.png'});check((await state()).paused,'owned augment descriptions can be inspected while paused');
      await click(0,-253);await page.keyboard.press('Escape');
      await page.waitForFunction(()=>(window as any).__EMBER__.snapshot().cues.some((c:any)=>c.kind==='quake'));check((await state()).zones.length===0,'earthwake resolves once after delay');
      let healed=false,ring=false;const deadline=Date.now()+25000;
      while(Date.now()<deadline&&!ring){s=await state();healed ||= s.cues.some(c=>c.kind==='heal');ring ||= healed&&s.cues.some(c=>c.kind==='damage'&&c.cause==='augment');if(s.phase!=='fighting')break;await page.waitForTimeout(80);}
      check(healed,'dawnbringer regenerates after real enemy damage');check(ring,'effective regeneration triggers death-ring damage');
      await page.screenshot({path:'reports/28-hex-survival.png'});
    }else{
      let augment=false,onHit=false,stack=false,crit=false,basic=false,light=false;const deadline=Date.now()+15000;
      while(Date.now()<deadline){s=await state();if(s.phase!=='fighting')break;
        augment ||= s.projectiles.some(p=>p.cause==='augment');onHit ||= s.projectiles.some(p=>p.payload?.appliesOnHit);
        basic ||= s.projectiles.some(p=>p.cause==='basic');light ||= s.projectiles.some(p=>p.cause==='augment'&&p.appearance==='shield');
        stack ||= s.units.some(u=>u.statuses.some(t=>t.id==='infernal'));crit ||= s.cues.some(c=>c.critical);
        const target=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0];
        if(target){await aim(target.x,target.y);if(lab==='hexAttack')await page.mouse.down();if(s.cooldowns.Q<.01)await page.keyboard.press('q');}
        if(s.cooldowns.W<.01)await page.keyboard.press('Space');
        if(lab==='hexMage'&&augment&&stack&&crit||lab==='hexAttack'&&augment&&onHit&&basic&&light)break;
        await page.waitForTimeout(50);
      }
      await page.mouse.up();check(augment,`${lab}: additional projectiles visible in real combat`);
      if(lab==='hexMage'){check(stack,'infernal conduit attaches a real stacked status');check(crit,'jeweled gauntlet produces critical hit feedback');}
      else{check(onHit&&basic,'typhoon secondary and directional basic bullets coexist');check(light,'fourth basic release produces light-em-up volley');}
      await page.screenshot({path:lab==='hexMage'?'reports/29-hex-mage.png':'reports/30-hex-attacks.png'});
    }
  }
  check(errors.length===0,'no browser runtime errors');
  writeFileSync('reports/browser-hexes.json',JSON.stringify({status:'passed',checks,errors,timestamp:new Date().toISOString()},null,2)+'\n');console.log(`Hex browser regression passed (${checks.length} checks).`);
}catch(error){await page.screenshot({path:'reports/hex-failure.png'});writeFileSync('reports/browser-hexes.json',JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
