import { chromium,type Frame } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
const raw=process.env.EMBER_PREVIEW_URL;
if(!raw){console.error('未运行：需要真实 Cocos 预览 / Web Desktop URL。例：EMBER_PREVIEW_URL=http://localhost:7456 pnpm smoke');process.exit(2);}
const url=new URL(raw);url.searchParams.set('seed','1234');url.searchParams.set('debug','1');
mkdirSync('reports',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
let frame:Frame|undefined;
try{
  await page.goto(url.href);await page.bringToFront();
  for(let attempt=0;attempt<100&&!frame;attempt++){
    for(const candidate of page.frames())if(await candidate.evaluate(()=>!!(window as any).__EMBER__).catch(()=>false)){frame=candidate;break;}
    if(!frame)await page.waitForTimeout(100);
  }
  if(!frame)throw new Error('未找到 GameBootstrap debug API。确认已挂载脚本、预览该场景，且游戏 URL 含 debug=1。');
  const game=frame;
  const state=()=>game.evaluate(()=> (window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
  const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
  const clickUI=async(x:number,y:number,button:'left'|'right'='left')=>{
    const bounds=await game.locator('canvas').first().boundingBox();if(!bounds)throw new Error('找不到可见 canvas');
    const scale=Math.min(bounds.width/1280,bounds.height/720);
    await page.mouse.click(bounds.x+bounds.width/2+x*scale,bounds.y+bounds.height/2-y*scale,{button});
  };
  const point=async(x:number,y:number,body=false)=>{
    const p=await game.evaluate(({x,y})=>(window as any).__EMBER__.screen(x,y),{x,y});
    const bounds=await game.locator('canvas').first().boundingBox();if(!bounds)throw new Error('No canvas');
    const scale=Math.min(bounds.width/1280,bounds.height/720);
    return{x:bounds.x+bounds.width/2+p.x*scale,y:bounds.y+bounds.height/2-(p.y+(body?22:0))*scale};
  };
  check((await state()).phase==='ready','启动状态错误');await page.screenshot({path:'reports/01-start.png'});
  await clickUI(0,-106);await page.waitForTimeout(100);check((await state()).phase==='fighting','点击开始失败');
  const move=await point(12,10);await page.mouse.click(move.x,move.y,{button:'right'});await page.waitForTimeout(750);
  check((await state()).hero.x>10.4,'右键移动未生效');
  await page.keyboard.press('q');await page.waitForTimeout(80);check((await state()).cooldowns.Q>0,'Q 未施放');
  await page.screenshot({path:'reports/02-combat.png'});
  // Real mouse + keyboard commands only; no damage/HP cheats or world mutations.
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    const s=await state();if(s.phase==='reward')break;if(s.phase==='defeat')throw new Error('冒烟角色死亡');
    const enemies=s.units.filter(u=>u.team==='enemy'&&u.alive).sort((a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y));
    const enemy=enemies[0];if(enemy){const hit=await point(enemy.x,enemy.y,true);await page.mouse.click(hit.x,hit.y,{button:'right'});
      const aim=await point(enemy.x,enemy.y);await page.mouse.move(aim.x,aim.y);await page.keyboard.press('q');await page.keyboard.press('w');
      if(enemies.filter(u=>Math.hypot(u.x-s.hero.x,u.y-s.hero.y)<3.8).length>=2)await page.keyboard.press('r');
    }
    await page.waitForTimeout(180);
  }
  check((await state()).phase==='reward','60 秒内未进入奖励界面');await page.screenshot({path:'reports/03-reward.png'});
  await page.keyboard.press('1');await page.waitForTimeout(100);check((await state()).wave===2,'增益选择未推进波次');
  await page.keyboard.press('Escape');await page.waitForTimeout(100);check((await state()).paused,'暂停失败');
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(250);await page.screenshot({path:'reports/04-resize.png'});
  await clickUI(145,-164);await page.waitForTimeout(100);check((await state()).phase==='ready','重新开始失败');
  await page.screenshot({path:'reports/05-restart.png'});check(errors.length===0,errors.join('\n'));
  writeFileSync('reports/browser-smoke.json',JSON.stringify({status:'passed',url:url.href,errors,checks:['start','right-click move','Q','target and combat','reward','choose perk','pause','resize','restart'],timestamp:new Date().toISOString()},null,2)+'\n');
  console.log('Cocos browser smoke passed. Screenshots: reports/01-start.png … 05-restart.png');
}catch(error){await page.screenshot({path:'reports/smoke-failure.png'}).catch(()=>{});writeFileSync('reports/browser-smoke.json',JSON.stringify({status:'failed',error:String(error),errors},null,2)+'\n');throw error;}
finally{await browser.close();}
