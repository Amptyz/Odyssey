import { performance } from 'node:perf_hooks';
import { writeFileSync,mkdirSync } from 'node:fs';
import os from 'node:os';
import { GameWorld } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { PERKS } from '../EmberDemo/assets/scripts/ember/content/perks';
const world=new GameWorld(1234);world.command({type:'Start'});world.command({type:'LeaveShop'});
for(const [id,a] of world.actors)if(a.team==='enemy')world.actors.delete(id);
// Both sides are endurance fixtures: keep all 50 bodies alive even with max-HP on-hit effects.
for(let i=0;i<50;i++)world.spawnEnemy(i%3===0?'ranged':'melee',{x:1+(i%10)*1.8,y:1+Math.floor(i/10)*3.5},1e12);
for(const p of PERKS)world.combat.addPerk(p.id);
// Use the same source resolver as every unit; direct maxHp assignments are recalculated each tick.
world.hero.attributes.upsert({sourceId:'benchmark:endurance',modifiers:[{stat:'maxHealth',operation:'multiply',value:1e9/world.hero.attributes.value.maxHealth}]});
world.hero.maxHp=world.hero.hp=world.hero.attributes.value.maxHealth;
const times:number[]=[],heap:number[]=[];
const gc=(globalThis as typeof globalThis&{gc?:()=>void}).gc;
gc?.();const startHeap=process.memoryUsage().heapUsed;
for(let i=0;i<3600;i++) {
  if(i%15===0) {
    const t=i/30,point={x:10+Math.cos(t*0.3)*7,y:10+Math.sin(t*0.3)*7};
    world.command({type:'MoveTo',point});
    const enemy=[...world.actors.values()].find(a=>a.team==='enemy'&&a.alive)!;
    world.command({type:'CastSkill',skillId:'fireball',point:enemy});world.command({type:'CastSkill',skillId:'shield',point});
    world.command({type:'CastSkill',skillId:'nova',point});
  }
  const before=performance.now();world.advance(1/30);world.snapshot();times.push(performance.now()-before);
  if(i%600===599){gc?.();heap.push(process.memoryUsage().heapUsed);}
}
const sorted=[...times].sort((a,b)=>a-b),sum=times.reduce((a,b)=>a+b,0);
const report={timestamp:new Date().toISOString(),scope:'Headless TypeScript simulation + detached snapshot; not renderer FPS',
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,gc:!!gc},
  seed:1234,enemies:50,fixtureHp:{hero:world.hero.attributes.value.maxHealth,enemy:1e12},ticks:3600,simulatedSeconds:120,actualTicks:world.tickCount,meanTickMs:sum/times.length,p95TickMs:sorted[Math.floor(sorted.length*0.95)],maxTickMs:sorted.at(-1),
  heapStartBytes:startHeap,heapAfterEach20Seconds:heap,retainedHeapDeltaBytes:heap.at(-1)!-startHeap,
  metrics:world.combat.metrics,historyLength:world.combat.history.length,cues:world.cues.length,projectiles:world.projectiles.length};
mkdirSync('reports',{recursive:true});writeFileSync('reports/benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
if(world.combat.history.length>256||world.cues.length>192||world.combat.metrics.maxDepth>6||world.phase!=='fighting')process.exitCode=1;
