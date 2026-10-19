import {describe,expect,it} from 'vitest';
import {monsterActionStep,monsterDeathFrame} from '../EmberDemo/assets/scripts/ember/render/MonsterAnimation';
import {createActor} from '../EmberDemo/assets/scripts/ember/combat-core/ActorFactory';
import {PLAYER_TEMPLATE} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {CombatEngine} from '../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import {CollisionWorld} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {enemy} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {mapDefinition} from '../EmberDemo/assets/scripts/ember/content/maps';
import {EnemySystem,type EnemyUnit} from '../EmberDemo/assets/scripts/ember/simulation/EnemySystem';

function asUnit(actor:ReturnType<typeof createActor>,kind:EnemyUnit['kind']):EnemyUnit {
 return {...actor,kind,previous:{x:actor.x,y:actor.y},velocity:{x:0,y:0},path:[],repath:0,windup:0,attackWindup:0,attackCd:0,aim:{x:actor.x,y:actor.y},facing:{x:1,y:0},action:{id:0,kind:'attack',time:0},hurtAt:-1,diedAt:-1};
}

describe('monster visual phase timing',()=>{
 it('shows an early sampled strike during the remaining windup',()=>{
  expect(monsterActionStep({state:'windup',strike:1})).toBe('strike');
  expect(monsterActionStep({state:'windup',strike:0})).toBe('windup');
  expect(monsterActionStep({state:'recover',strike:.8})).toBe('strike');
  expect(monsterActionStep({state:'recover',strike:0})).toBe('recovery');
 });
 it('collapses once and holds the final pose through corpse fading',()=>{
  expect([0,.24,.25,.49,.5,.9,5].map(monsterDeathFrame)).toEqual([0,0,1,1,2,2,2]);
 });
 it.each([['courtyardHeart','hearthSeeds'],['mirrorRegent','regentMarks']] as const)('displays %s early impact pulses emitted by EnemySystem', (kind,actionId)=>{
  const map={...mapDefinition('ember'),width:60,height:44,obstacles:[]};
  const cfg=enemy(kind),boss=asUnit(createActor('boss','enemy',{x:20,y:20},cfg.template,cfg.radius),kind);
  const hero=asUnit(createActor('hero','hero',{x:25,y:20},{...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:10000}},.32),'hero');
  const actors=new Map<string,EnemyUnit>([[boss.id,boss],[hero.id,hero]]),combat=new CombatEngine(actors),system=new EnemySystem(map),collision=new CollisionWorld(map);
  let earlyStrike=false;
  for(let frame=1;frame<=900;frame++){
   const time=frame/30;combat.tick(1/30);system.step(1/30,{time,actors,players:[hero],combat,collision});
   const pose=system.snapshot().units.find(p=>p.id===boss.id);
   if(pose?.actionId===actionId&&pose.state==='windup'&&pose.age<pose.windup&&pose.strike>.9){
    expect(monsterActionStep(pose)).toBe('strike');earlyStrike=true;break;
   }
  }
  expect(earlyStrike).toBe(true);
 });
});
