import {describe,it,expect} from 'vitest';
import {EnemyDecision} from '../EmberDemo/assets/scripts/ember/ai/EnemyDecision';
import {EnemySystem,type EnemyUnit,type EnemyContext} from '../EmberDemo/assets/scripts/ember/simulation/EnemySystem';
import {createActor} from '../EmberDemo/assets/scripts/ember/combat-core/ActorFactory';
import {PLAYER_TEMPLATE} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {CombatEngine} from '../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import {CollisionWorld} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {enemy,type EnemyKind} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {ENEMY_ACTIONS,type EnemyActionDefinition} from '../EmberDemo/assets/scripts/ember/content/enemy-actions';
import {ENEMY_BEHAVIORS,validateEnemyBehaviors,type EnemyBehaviorDefinition} from '../EmberDemo/assets/scripts/ember/content/enemy-behaviors';
import {mapDefinition} from '../EmberDemo/assets/scripts/ember/content/maps';

const unit=(id:string,team:'hero'|'enemy',kind:EnemyUnit['kind'],x:number,y:number):EnemyUnit=>{
 const template=team==='hero'?{...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:10000}}:enemy(kind as EnemyKind).template;
 const a=createActor(id,team,{x,y},template,team==='hero'?.32:enemy(kind as EnemyKind).radius);
 return {...a,kind,previous:{x,y},velocity:{x:0,y:0},path:[],repath:0,windup:0,attackWindup:0,attackCd:0,aim:{x,y},facing:{x:1,y:0},action:{id:0,kind:'attack',time:0},hurtAt:-1,diedAt:-1};
};
function fixture(profile:EnemyBehaviorDefinition,overrides:Record<string,EnemyActionDefinition>={},kind:EnemyKind='melee'){
 const map={...mapDefinition('ember'),width:60,height:44,obstacles:[]};
 const e=unit('enemy','enemy',kind,20,20),a=unit('a','hero','hero',20.7,20),b=unit('b','hero','hero',20,20.8);
 const actors=new Map<string,EnemyUnit>([[e.id,e],[a.id,a],[b.id,b]]),combat=new CombatEngine(actors),collision=new CollisionWorld(map);
 const profiles={...ENEMY_BEHAVIORS,[enemy(kind).actionSet]:profile},actions={...ENEMY_ACTIONS,...overrides};
 const system=new EnemySystem(map,profiles,actions),ctx:EnemyContext={time:0,actors,players:[a,b],combat,collision};
 const tick=(seconds:number,freezeAI=false)=>{ctx.freezeAI=freezeAI;for(let i=0;i<Math.round(seconds*30);i++){for(const u of actors.values())u.previous={x:u.x,y:u.y};ctx.time+=1/30;combat.tick(1/30);system.step(1/30,ctx);}};
 const pose=()=>system.snapshot().units.find(u=>u.id===e.id)!;
 return {e,a,b,actors,combat,ctx,system,tick,pose};
}
const basic:EnemyBehaviorDefinition={targeting:{strategy:'nearest'},rules:[{id:'basic',priority:0,action:'mossJab'}]};
const spell=(id:string,extra:Partial<EnemyActionDefinition>={}):EnemyActionDefinition=>({...ENEMY_ACTIONS.mossJab!,id,kind:'spell',cooldown:4,firstDelay:0,...extra});

describe('target memory and cooldown semantics',()=>{
 it('holds a valid target, uses distance hysteresis, and immediately replaces dead targets',()=>{
  const brain=new EnemyDecision(),self=unit('e','enemy','melee',20,20),a=unit('a','hero','hero',22,20),b=unit('b','hero','hero',21,20);
  const policy={strategy:'nearest',minHoldSeconds:3,switchDistanceRatio:.7} as const;
  brain.select(a,0,'test');expect(brain.pick(self,[b,a],policy,1)?.id).toBe('a');
  b.x=21.6;expect(brain.pick(self,[b,a],policy,4)?.id).toBe('a');
  b.x=21;expect(brain.pick(self,[b,a],policy,4)?.id).toBe('b');
  a.alive=false;expect(brain.pick(self,[a,b],policy,1)?.id).toBe('b');
 });
 it('reconsiders at configured boundaries and filters ineligible players before ranking',()=>{
  const brain=new EnemyDecision(),self=unit('e','enemy','melee',20,20),a=unit('a','hero','hero',22,20),b=unit('b','hero','hero',21,20);
  const policy={strategy:'nearest',reconsider:'sequenceEnd'} as const;brain.actionStarted(a,0,'test');
  brain.boundary(policy,'actionEnd');expect(brain.pick(self,[a,b],policy,5)?.id).toBe('a');
  brain.boundary(policy,'sequenceEnd');expect(brain.pick(self,[a,b],policy,5)?.id).toBe('b');
  expect(brain.pick(self,[a,b],{strategy:'leastTargeted'},5,p=>p.id==='a')?.id).toBe('a');
 });
 it('supports repeat avoidance, strict waiting, fallback and stable multiplayer ties',()=>{
  const brain=new EnemyDecision(),self=unit('e','enemy','melee',20,20),a=unit('a','hero','hero',21,20),b=unit('b','hero','hero',19,20);
  brain.actionStarted(a,0,'test');
  expect(brain.pick(self,[a,b],{strategy:'nearest',avoidLastTarget:true},5)?.id).toBe('b');
  expect(brain.pick(self,[a],{strategy:'nearest',avoidLastTarget:true,fallback:'wait'},5)).toBeUndefined();
  expect(brain.pick(self,[a],{strategy:'nearest',avoidLastTarget:true,fallback:'current'},5)?.id).toBe('a');
  brain.lastActionTargetId=undefined;expect(brain.pick(self,[b,a],{strategy:'nearest'},5)?.id).toBe('a');
 });
 it('commits start/impact/end cooldowns once, including group/global/target gates and interrupt refunds',()=>{
  for(const start of ['start','impact','end'] as const){
   const brain=new EnemyDecision(),ticket=brain.ticket('charge','a',{start,group:{id:'mobility',seconds:5},targetSeconds:9,globalSeconds:2},4,0);
   brain.commit(ticket,'start',1);brain.commit(ticket,'impact',2);brain.commit(ticket,'end',3);
   const at={start:1,impact:2,end:3}[start];expect(brain.readyTimes.get('action:charge')).toBe(at+4);
   expect(brain.block('other','b','mobility',at+3)).toBe('group:mobility');
   expect(brain.block('charge','a',undefined,at+6)).toBe('target:charge:a');
   expect(brain.block('charge','b',undefined,at+6)).toBeUndefined();
  }
  const brain=new EnemyDecision();brain.readyTimes.set('global',2);
  const refund=brain.ticket('hit','a',{consumeOnInterrupt:false,globalSeconds:5},4,0);brain.commit(refund,'start',3);brain.interrupted(refund,3.5);
  expect(brain.readyTimes.get('global')).toBe(2);expect(brain.block('hit','a',undefined,3.5)).toBeUndefined();
  const consume=brain.ticket('hit','a',{start:'end'},4,0);brain.interrupted(consume,6);expect(brain.readyTimes.get('action:hit')).toBe(10);
 });
});

describe('configured decisions execute in the real enemy scheduler',()=>{
 it('executes action/wait/retarget/action sequences without moving or rewriting the first warning',()=>{
  const profile:EnemyBehaviorDefinition={targeting:{strategy:'nearest',reconsider:'sequenceEnd'},rules:[{id:'combo',priority:10,sequence:'cross'}],sequences:{cross:[
   {kind:'action',action:'mossJab'},{kind:'wait',seconds:.5,movement:'stop'},
   {kind:'target',policy:{strategy:'leastTargeted',avoidLastTarget:true,fallback:'current'}},{kind:'action',action:'mossJab'},
  ]}};
  const f=fixture(profile);f.tick(.5);const warning=f.system.snapshot().warnings[0]!;
  expect(f.pose().decision?.actionTargetId).toBe('a');f.b.x=20.1;
  f.tick(1.8);expect(f.e.action.id).toBe(1);expect(f.pose().decision?.reason).toBe('sequence-wait');expect(f.e.velocity).toEqual({x:0,y:0});
  f.tick(.4);expect(f.e.action.id).toBe(2);expect(f.pose().decision?.actionTargetId).toBe('b');expect(warning.shape.center).toEqual({x:20,y:20});
  if(warning.shape.kind==='sector')expect(warning.shape.facing).toEqual({x:1,y:0});
 });
 it('enforces an extra stop after the complete action, independently of the attack cooldown',()=>{
  const f=fixture(basic,{mossJab:{...ENEMY_ACTIONS.mossJab!,pauseAfter:.8,recoveryMovement:'stop'}});
  f.tick(2.2);const pos={x:f.e.x,y:f.e.y};f.a.x=24;f.b.y=24;f.tick(.3);
  expect(f.pose().decision?.reason).toBe('pause');expect({x:f.e.x,y:f.e.y}).toEqual(pos);expect(f.e.action.id).toBe(1);
  f.tick(.6);expect(f.pose().decision?.pauseRemaining).toBe(0);expect(Math.hypot(f.e.x-pos.x,f.e.y-pos.y)).toBeGreaterThan(0);
 });
 it('honors a rule-specific target reconsideration boundary instead of the profile default',()=>{
  const f=fixture({targeting:{strategy:'nearest',reconsider:'sequenceEnd'},rules:[
   {id:'alternate',priority:1,action:'mossJab',cooldown:3,targeting:{strategy:'leastTargeted',reconsider:'actionEnd'}},
  ]});
  f.tick(.5);expect(f.pose().decision?.actionTargetId).toBe('a');f.tick(3);expect(f.pose().decision?.actionTargetId).toBe('b');
 });
 it('supports a basic attack internal cooldown longer than its attack-speed cycle',()=>{
  const f=fixture(basic,{mossJab:{...ENEMY_ACTIONS.mossJab!,cooldownPolicy:{seconds:4}}});
  f.tick(3);expect(f.e.action.id).toBe(1);f.tick(1.6);expect(f.e.action.id).toBe(2);
 });
 it('uses priority, once, HP/phase/distance/player conditions, then falls back to the normal attack',()=>{
  const profile:EnemyBehaviorDefinition={targeting:{strategy:'nearest'},rules:[
   {id:'emergency',priority:100,once:true,when:{hpRatioBelow:.5,phase:1,minPlayers:2,distance:[0,2]},action:'panic'},
   {id:'basic',priority:0,action:'mossJab'},
  ]};
  const f=fixture(profile,{panic:spell('panic')});f.e.hp=f.e.maxHp*.3;f.tick(.1);
  expect(f.pose().actionId).toBe('panic');f.tick(4);expect(f.pose().decision?.ruleId).toBe('basic');
 });
 it('keeps individual, global and group cooldowns effective across separate decision rules',()=>{
  const profile:EnemyBehaviorDefinition={targeting:{strategy:'nearest'},rules:[{id:'first',priority:20,once:true,action:'one'},{id:'second',priority:10,action:'two'}]};
  const policy={group:{id:'heavy',seconds:4},globalSeconds:3};
  const f=fixture(profile,{one:spell('one',{cooldownPolicy:policy}),two:spell('two',{cooldownPolicy:policy})});
  f.tick(2);expect(f.e.action.id).toBe(1);expect(f.pose().decision?.reason).toBe('blocked:global');
  f.tick(1.2);expect(f.e.action.id).toBe(1);expect(f.pose().decision?.reason).toBe('blocked:group:heavy');
  f.tick(1);expect(f.e.action.id).toBe(2);expect(f.pose().actionId).toBe('two');
 });
 it('changes to an eligible teammate under a per-target cooldown instead of blocking the whole skill',()=>{
  const f=fixture({targeting:{strategy:'nearest'},rules:[{id:'mark',priority:1,action:'mark'}]},
   {mark:spell('mark',{cooldown:1,cooldownPolicy:{targetSeconds:8}})});
  f.tick(.1);expect(f.pose().decision?.actionTargetId).toBe('a');f.tick(1.7);
  expect(f.pose().decision?.actionTargetId).toBe('b');f.tick(1.7);expect(f.e.action.id).toBe(2);
 });
 it('waits for a bounded time when a combo step is unavailable, then skips or aborts',()=>{
  for(const afterTimeout of ['skip','abort'] as const){
   const profile:EnemyBehaviorDefinition={targeting:{strategy:'nearest'},rules:[{id:'combo',priority:1,sequence:'combo',once:true}],sequences:{combo:[
    {kind:'action',action:'long'},{kind:'action',action:'long',unavailable:'wait',timeout:.4,afterTimeout},{kind:'action',action:'other'},
   ]}};
   const f=fixture(profile,{long:spell('long',{cooldown:20}),other:spell('other')});f.tick(2.2);
   expect(f.e.action.id).toBe(afterTimeout==='skip'?2:1);f.tick(2);expect(f.pose().decision?.sequence).toBeUndefined();
  }
 });
 it('starts end-based cooldowns after recovery and refunds interrupted ordinary attacks when configured',()=>{
  const f=fixture({targeting:{strategy:'nearest'},rules:[{id:'s',priority:1,action:'s'}]},
   {s:spell('s',{cooldown:3,cooldownPolicy:{start:'end'}})});
  f.tick(2);const cd=f.pose().decision!.cooldowns.find(c=>c.key==='action:s')!;expect(cd.remaining).toBeGreaterThan(2.5);
  const g=fixture(basic,{mossJab:{...ENEMY_ACTIONS.mossJab!,cooldownPolicy:{consumeOnInterrupt:false}}});g.tick(.5);
  expect(g.system.interrupt(g.e.id,g.ctx.time,'stun',7)).toBe(true);g.tick(.1);expect(g.e.action.id).toBe(2);
 });
 it('applies initial delay and rule cooldown to custom actions rather than only old action-set skills',()=>{
  const f=fixture({targeting:{strategy:'nearest'},rules:[{id:'custom',priority:1,action:'s',cooldown:6}]},{s:spell('s',{firstDelay:2,cooldown:1})});
  f.tick(1.9);expect(f.e.action.id).toBe(0);f.tick(.3);expect(f.e.action.id).toBe(1);f.tick(4);expect(f.e.action.id).toBe(1);
 });
 it('optionally applies ability haste to the individual spell cooldown',()=>{
  for(const affectedByHaste of [true,false]){
   const f=fixture({targeting:{strategy:'nearest'},rules:[{id:'s',priority:1,action:'s'}]},
    {s:spell('s',{cooldown:4,cooldownPolicy:{affectedByHaste}})});
   f.e.attributes.upsert({sourceId:'test',modifiers:[{stat:'abilityHaste',operation:'flat',value:100}]});
   f.tick(2.2);expect(f.e.action.id).toBe(affectedByHaste?2:1);
  }
 });
 it('does not let a boss timeline bypass a shared group cooldown',()=>{
  const one=spell('hearthFurrows',{...ENEMY_ACTIONS.hearthFurrows!,cooldownPolicy:{group:{id:'boss',seconds:20}}});
  const two={...ENEMY_ACTIONS.hearthSeeds!,cooldownPolicy:{group:{id:'boss',seconds:20}}};
  const f=fixture(ENEMY_BEHAVIORS.courtyardHeart!,{hearthFurrows:one,hearthSeeds:two},'courtyardHeart');
  f.a.x=24;f.b.y=24;f.tick(6.2);expect(f.pose().decision?.cooldowns.some(c=>c.key==='group:boss')).toBe(true);
  expect(f.system.snapshot().warnings.some(w=>w.actionId==='hearthSeeds')).toBe(false);
  expect(f.pose().actionId).not.toBe('hearthSeeds');
  expect(f.e.action.id).toBeGreaterThan(0);
 });
 it('configures boss timeline targeting and bounded delay instead of skipping an unavailable slot',()=>{
  for(const unavailable of ['wait','skip'] as const){
   const profile={...ENEMY_BEHAVIORS.courtyardHeart!,timeline:{targeting:{strategy:'farthest' as const},unavailable,timeout:2}};
   const f=fixture(profile,{hearthFurrows:{...ENEMY_ACTIONS.hearthFurrows!,firstDelay:3}},'courtyardHeart');
   f.a.x=23;f.b.y=24;f.tick(3.3);
   expect(f.pose().actionId).toBe(unavailable==='wait'?'hearthFurrows':undefined);
   if(unavailable==='wait')expect(f.pose().decision?.actionTargetId).toBe('b');
  }
 });
 it('does not reserve attacks forever for a once-only or conditionally unavailable skill',()=>{
  const profile:EnemyBehaviorDefinition={targeting:{strategy:'nearest'},rules:[
   {id:'once',priority:20,action:'rootPlates',once:true},
   {id:'low',priority:10,action:'other',when:{hpRatioBelow:.1}},
   {id:'basic',priority:0,action:'wardenHammer'},
  ]};
  const f=fixture(profile,{other:spell('other')},'warden');f.tick(14);
  expect(f.pose().decision?.ruleId).toBe('basic');expect(f.e.action.id).toBeGreaterThan(3);
 });
 it('does not share timers between enemies; freeze blocks new steps and reset clears all decision memory',()=>{
  const f=fixture(basic),second=unit('enemy2','enemy','melee',20,21);f.actors.set(second.id,second);f.tick(.5);
  f.system.interrupt(f.e.id,f.ctx.time,'stun',1);expect(f.system.snapshot().units.find(e=>e.id==='enemy2')?.actionId).toBe('mossJab');
  const id=f.e.action.id;f.tick(3,true);expect(f.e.action.id).toBe(id);
  const snapshot=f.system.snapshot(),cooldown=snapshot.units[1]!.decision!.cooldowns[0];
  if(cooldown){const before=cooldown.remaining;cooldown.remaining=999;expect(f.system.snapshot().units[1]!.decision!.cooldowns[0]!.remaining).toBe(before);}
  f.system.reset();expect(f.system.snapshot()).toEqual({units:[],warnings:[],projectiles:[]});
 });
});

describe('behavior content validation',()=>{
 it('accepts production profiles and rejects broken references, intervals and unbounded waits',()=>{
  expect(()=>validateEnemyBehaviors()).not.toThrow();
  const check=(p:EnemyBehaviorDefinition)=>validateEnemyBehaviors({test:p});
  expect(()=>check({...basic,rules:[{id:'bad',priority:1,action:'missing'}]})).toThrow(/action/);
  expect(()=>check({...basic,rules:[{id:'bad',priority:1,sequence:'missing'}]})).toThrow(/sequence/);
  expect(()=>check({...basic,targeting:{strategy:'nearest',minHoldSeconds:-1}})).toThrow(/minHold/);
  expect(()=>check({...basic,rules:[{id:'bad',priority:1,when:{distance:[3,1]},action:'mossJab'}]})).toThrow(/distance/);
  expect(()=>check({...basic,sequences:{bad:[{kind:'action',action:'mossJab',timeout:Infinity}]}})).toThrow(/timeout/);
  expect(()=>check({...basic,sequences:{bad:[]}})).toThrow(/steps/);
 });
});
