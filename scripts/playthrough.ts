import { writeFileSync } from 'node:fs';
import { GameWorld } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { distance } from '../EmberDemo/assets/scripts/ember/utils/math';
const outcomes=[];
for(const seed of [0,1,2,42,1234,2026,31415,65535,99999,4294967295]) {
  const world=new GameWorld(seed);world.command({type:'Start'});
  // A deterministic naive player: attack nearest, cast Q/W when available, R on clusters.
  // No damage, HP, enemy or cooldown changes are permitted in this real-rules run.
  for(let step=0;step<30*240 && world.phase!=='defeat'&&world.phase!=='victory';step++) {
    if(world.phase==='reward'){world.command({type:'ChoosePerk',perkId:world.choices.find(id=>id==='burn'||id==='leech')??world.choices[0]!});}
    if(step%6===0){const enemies=[...world.actors.values()].filter(a=>a.team==='enemy'&&a.alive).sort((a,b)=>distance(a,world.hero)-distance(b,world.hero));
      const target=enemies[0];if(target){
        world.command({type:'SetTarget',targetId:target.id});world.command({type:'CastSkill',skillId:'Q',point:target});
        if(distance(target,world.hero)<5)world.command({type:'CastSkill',skillId:'W',point:world.hero});
        if(enemies.filter(e=>distance(e,world.hero)<3.8).length>=2)world.command({type:'CastSkill',skillId:'R',point:world.hero});
      }
    }
    world.advance(1/30);
  }
  outcomes.push({seed,phase:world.phase,wave:world.wave,time:world.time,hp:world.hero.hp,kills:world.combat.metrics.kills,perks:[...world.combat.perks]});
}
writeFileSync('reports/playthrough.json',JSON.stringify({scope:'Headless input-command bot, normal HP/damage/cooldowns; no browser interaction',outcomes},null,2)+'\n');
console.log(outcomes);
if(outcomes.some(o=>!['victory','defeat'].includes(o.phase))||outcomes.find(o=>o.seed===1234)?.phase!=='victory')process.exitCode=1;
