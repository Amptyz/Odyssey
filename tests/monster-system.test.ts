import {describe,it,expect} from 'vitest';
import {createActor} from '../EmberDemo/assets/scripts/ember/combat-core/ActorFactory';
import {PLAYER_TEMPLATE,AttributeSet} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {CombatEngine} from '../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import {CollisionWorld,overlaps} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {ENEMIES,enemy,type EnemyKind} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {ENEMY_ACTIONS,ENEMY_ACTION_SETS,validateEnemyActions} from '../EmberDemo/assets/scripts/ember/content/enemy-actions';
import {mapDefinition} from '../EmberDemo/assets/scripts/ember/content/maps';
import {EnemySystem,type EnemyUnit,type EnemyContext} from '../EmberDemo/assets/scripts/ember/simulation/EnemySystem';
import {PathfinderPool} from '../EmberDemo/assets/scripts/ember/ai/Pathfinder';
const asUnit=(actor:ReturnType<typeof createActor>,kind:EnemyUnit['kind']):EnemyUnit=>({...actor,kind,previous:{x:actor.x,y:actor.y},velocity:{x:0,y:0},path:[],repath:0,windup:0,attackWindup:0,attackCd:0,aim:{x:actor.x,y:actor.y},facing:{x:1,y:0},action:{id:0,kind:'attack',time:0},hurtAt:-1,diedAt:-1});
function fixture(kind:EnemyKind,ex=10,ey=10,hx=14,hy=10,obstacles:{id:string;x:number;y:number;radius:number;height:number}[]=[]){
 const map={...mapDefinition('ember'),width:60,height:44,heroSpawn:{x:5,y:5},obstacles};
 const e=asUnit(createActor('enemy','enemy',{x:ex,y:ey},enemy(kind).template,enemy(kind).radius),kind),h=asUnit(createActor('hero','hero',{x:hx,y:hy},{...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:10000}},.32),'hero');
 const actors=new Map<string,EnemyUnit>([[e.id,e],[h.id,h]]),collision=new CollisionWorld(map),combat=new CombatEngine(actors),system=new EnemySystem(map);
 const ctx:EnemyContext={time:0,actors,players:[h],collision,combat};
 const tick=(seconds:number,freezeAI=false)=>{ctx.freezeAI=freezeAI;for(let i=0;i<Math.round(seconds*30);i++){for(const unit of actors.values())unit.previous={x:unit.x,y:unit.y};ctx.time+=1/30;combat.tick(1/30);system.step(1/30,ctx);}};
 return {e,h,actors,collision,combat,system,ctx,tick};
}
describe('seventeen monster action sets',()=>{
 it('registers exactly ten normals, five elites and two boss templates with full cycles',()=>{
  expect(()=>validateEnemyActions()).not.toThrow();const defs=Object.values(ENEMIES);expect(defs.filter(e=>e.category==='normal')).toHaveLength(10);expect(defs.filter(e=>e.category==='elite')).toHaveLength(5);expect(defs.filter(e=>e.category==='boss')).toHaveLength(2);
  for(const [id,e] of Object.entries(ENEMIES)){const set=ENEMY_ACTION_SETS[e.actionSet]!,attack=ENEMY_ACTIONS[set.attack]!;expect(attack.windup+attack.recovery).toBeCloseTo(1/e.template.baseAttackSpeed);expect(new AttributeSet(e.template).value.maxHealth).toBeGreaterThan(0);expect(set.skills.every(id=>ENEMY_ACTIONS[id])).toBe(true);expect(e.appearance).toBe(id);}
  expect(enemy('courtyardHeart').map).toBe('ember');expect(enemy('mirrorRegent').map).toBe('frost');
 });
 it('does not wake distant authored groups, but damage wakes one without pulling the map',()=>{
  const f=fixture('melee',30,10,15,10);f.tick(1);expect(f.e.x).toBe(30);expect(f.system.snapshot().units[0]?.awake).toBe(false);
  f.combat.damage({sourceId:f.h.id,targetId:f.e.id,amount:1,cause:'basic'});f.tick(.1);expect(f.system.snapshot().units[0]?.awake).toBe(true);
 });
 it('locks melee direction and lets a side dodge avoid the telegraphed strike',()=>{
  const f=fixture('melee',10,10,10.7,10);f.tick(.5);expect(f.system.snapshot().warnings.length).toBeGreaterThan(0);f.h.x=10;f.h.y=12;const hp=f.h.hp;f.tick(.5);expect(f.h.hp).toBe(hp);
 });
 it('hits once within an active melee window and applies armour through CombatEngine',()=>{
  const f=fixture('melee',10,10,10.7,10);f.h.attributes.upsert({sourceId:'test',modifiers:[{stat:'armor',operation:'flat',value:100}]});f.tick(1);expect(f.h.hp).toBeCloseTo(9994);const hits=f.combat.history.filter(e=>e.type==='OnHit'&&e.sourceId==='enemy');expect(hits).toHaveLength(1);expect(hits[0]?.damageType).toBe('physical');
 });
 it('samples a target circle before impact rather than following a moving player',()=>{
  const f=fixture('sunbud',10,10,14,10);f.tick(.5);const warning=f.system.snapshot().warnings[0]!;expect(warning.shape.center.x).toBe(14);f.h.y=13;f.tick(1.4);expect(f.h.hp).toBe(10000);expect(warning.shape.center.y).toBe(10);
 });
 it('resolves a magic basic projectile against MR, with correct attack identity',()=>{
  const f=fixture('ranged');f.h.attributes.upsert({sourceId:'test',modifiers:[{stat:'magicResist',operation:'flat',value:100}]});f.tick(2.1);expect(f.h.hp).toBeCloseTo(10000-14.8/2);const hit=f.combat.history.find(e=>e.type==='OnHit'&&e.sourceId==='enemy');expect(hit?.cause).toBe('basic');expect(hit?.damageType).toBe('magic');
 });
 it('keeps projectiles and in-flight damage attributes sampled at launch',()=>{
  const f=fixture('ranged',10,10,16,10);f.tick(1.3);expect(f.system.snapshot().projectiles.length).toBe(1);f.e.attributes.upsert({sourceId:'test',modifiers:[{stat:'abilityPower',operation:'flat',value:1000}]});f.tick(1);expect(f.h.hp).toBeCloseTo(9985.2);
 });
 it('allows a wall to absorb an already launched projectile',()=>{
  const wall={id:'wall',x:13,y:12,radius:.7,height:20},f=fixture('ranged',10,10,16,10,[wall]);f.tick(1.3);expect(f.system.snapshot().projectiles).toHaveLength(1);wall.y=10;f.tick(1);expect(f.h.hp).toBe(10000);expect(f.system.snapshot().projectiles).toHaveLength(0);
 });
 it('keeps emitted projectiles advancing during developer AI freeze',()=>{
  const f=fixture('ranged',10,10,16,10);f.tick(1.3);const x=f.system.snapshot().projectiles[0]!.x;f.tick(.2,true);expect(f.system.snapshot().projectiles[0]!.x).toBeGreaterThan(x);f.tick(1,true);expect(f.h.hp).toBeLessThan(10000);expect(f.e.action.id).toBe(1);
 });
 it('cancels un-fired warnings on death and reset clears owned projectiles and poses',()=>{
  const f=fixture('sunbud');f.tick(.5);expect(f.system.snapshot().warnings.length).toBeGreaterThan(0);f.combat.damage({sourceId:f.h.id,targetId:f.e.id,amount:10000,cause:'skill'});f.tick(1.2);expect(f.h.hp).toBe(10000);expect(f.system.snapshot().warnings).toHaveLength(0);f.system.reset();expect(f.system.snapshot()).toEqual({units:[],warnings:[],projectiles:[]});
 });
 it('gives the crab two independent delayed strikes, each once',()=>{
  const f=fixture('shardCrab',10,10,10.7,10);f.tick(1.4);const hits=f.combat.history.filter(e=>e.type==='OnHit'&&e.sourceId==='enemy');expect(hits).toHaveLength(2);expect(f.h.hp).toBeCloseTo(9976);
 });
 it('limits the three-projectile fan to one damage instance per player',()=>{
  const f=fixture('rimeMoth',10,10,12.6,10);f.h.radius=1.2;f.tick(2);expect(f.combat.history.filter(e=>e.type==='OnHit'&&e.sourceId==='enemy')).toHaveLength(1);expect(f.h.hp).toBeCloseTo(9986);
 });
 it('telegraphs the elite second echo at the original point',()=>{
  const f=fixture('bellKeeper');f.tick(5.1);const warnings=f.system.snapshot().warnings.filter(w=>w.actionId==='bellEcho');expect(warnings).toHaveLength(2);expect(warnings[1]!.triggerAt-warnings[0]!.triggerAt).toBeCloseTo(.95);expect(warnings[1]!.shape.center).toEqual(warnings[0]!.shape.center);
 });
 it('allows silence to cancel spell warnings but not an ordinary ranged basic attack',()=>{
  const f=fixture('bellKeeper');f.tick(5.1);expect(f.system.interrupt(f.e.id,f.ctx.time,'silence',1)).toBe(true);expect(f.system.snapshot().warnings.filter(w=>w.actionId==='bellEcho')).toHaveLength(0);
  const basic=fixture('ranged');basic.tick(.5);expect(basic.system.interrupt(basic.e.id,basic.ctx.time,'silence',2)).toBe(false);
 });
 it('switches a boss once at its HP threshold with a safe two-second transition',()=>{
  const f=fixture('courtyardHeart',20,20,25,20);f.tick(.1);f.e.hp=f.e.maxHp*.5;f.tick(.1);expect(f.system.snapshot().units[0]?.phase).toBe(2);expect(f.system.snapshot().units[0]?.state).toBe('transition');f.tick(1.5);expect(f.system.snapshot().warnings).toHaveLength(0);f.tick(3);expect(f.system.snapshot().warnings.some(w=>w.actionId==='hearthSeeds')).toBe(true);
 });
 it('exposes boss phase-two multi-line attacks and explicit true-damage oath',()=>{
  expect(ENEMY_ACTIONS.regentLanes!.phase2).toHaveLength(2);expect(ENEMY_ACTIONS.regentOath!.steps[0]?.damageType).toBe('true');expect(ENEMY_ACTIONS.regentOath!.steps[0]?.expression).toEqual({flat:30});
 });
 it('requires two distinct hard-control roots for boss break and enforces cooldown',()=>{
  const f=fixture('courtyardHeart',20,20,25,20);f.tick(2.1);expect(f.system.snapshot().warnings.length).toBeGreaterThan(0);expect(f.system.interrupt('enemy',f.ctx.time,'stun',11)).toBe(false);expect(f.system.interrupt('enemy',f.ctx.time+.25,'stun',11)).toBe(false);expect(f.system.interrupt('enemy',f.ctx.time+.3,'stun',12)).toBe(true);expect(f.system.snapshot().warnings).toHaveLength(0);
 });
 it('does not let a distant less-targeted teammate swallow a valid boss spell',()=>{
  const f=fixture('courtyardHeart',20,20,24,20);
  const distant=asUnit(createActor('distant','hero',{x:48,y:20},{...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:10000}},.32),'hero');
  f.actors.set(distant.id,distant);f.ctx.players=[f.h,distant];
  f.tick(6.2);
  const seeds=f.system.snapshot().warnings.filter(w=>w.actionId==='hearthSeeds');
  expect(seeds.length).toBeGreaterThan(0);expect(seeds[0]!.shape.center).toEqual({x:f.h.x,y:f.h.y});
  expect(f.combat.history.some(event=>event.sourceId==='enemy'&&event.targetId===f.h.id)).toBe(true);
  expect(distant.hp).toBe(10000);
 });
 it('does not expose mutable action maps, actor references or hit sets in snapshots',()=>{
  const f=fixture('sunbud');f.tick(.5);const snapshot=f.system.snapshot();snapshot.warnings[0]!.shape.center.x=999;snapshot.units[0]!.phase=2;expect(f.system.snapshot().warnings[0]!.shape.center.x).toBe(14);expect(f.system.snapshot().units[0]!.phase).toBe(1);expect(()=>JSON.stringify(snapshot)).not.toThrow();
 });
 it('chooses the nearest alive second player instead of the initial hero',()=>{
  const f=fixture('melee',10,10,30,10);const second=asUnit(createActor('second','hero',{x:10.7,y:10},{...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:10000}},.32),'hero');f.actors.set(second.id,second);f.ctx.players=[f.h,second];f.tick(1);expect(second.hp).toBeLessThan(10000);expect(f.h.hp).toBe(10000);
 });
});
describe('all configured monster mechanisms run',()=>{
 for(const kind of Object.keys(ENEMIES) as EnemyKind[])it(`${kind} acquires, telegraphs and damages through shared combat`,()=>{
  const f=fixture(kind,20,20,24,20);f.tick(10);expect(f.combat.history.some(event=>event.type==='OnHit'&&event.sourceId==='enemy')).toBe(true);expect(f.h.hp).toBeLessThan(10000);expect(f.combat.metrics.dropped).toBe(0);
 });
 it('stops a ram at a wall and never damages a player beyond the blocker',()=>{
  const wall={id:'wall',x:13,y:12,radius:.7,height:20},f=fixture('emberRam',10,10,16,10,[wall]);f.tick(3,true);f.tick(.1);expect(f.system.snapshot().warnings.some(w=>w.actionId==='ramLane')).toBe(true);wall.y=10;f.tick(2);expect(f.e.x).toBeLessThan(12);expect(f.h.hp).toBe(10000);
 });
 it('keeps a ram charge endpoint valid for its conservative navigation group',()=>{
  // The ray at y=10 is clear, but the ram body grazes this static off-axis column.
  const wall={id:'grazing-column',x:13,y:10.9,radius:.7,height:20};
  const f=fixture('emberRam',10,10,16,10,[wall]);f.tick(3,true);f.tick(.1);
  expect(f.system.snapshot().warnings.some(w=>w.actionId==='ramLane')).toBe(true);
  f.tick(2);const nav=f.system.navigation.forRadius(f.e.radius);
  expect(nav.radius).toBe(.62);expect(nav.walkable(f.e,f.e.radius)).toBe(true);
  expect(nav.walkable(f.e)).toBe(true);
  expect(nav.find(f.e,{x:10,y:10}).length).toBeGreaterThan(0);
 });
 it('makes the second boss execute its actual phase-two oath rather than only storing configuration',()=>{
  const f=fixture('mirrorRegent',20,20,25,20);f.tick(.1);f.e.hp=f.e.maxHp*.4;f.tick(22.5);expect(f.combat.history.some(event=>event.sourceId==='enemy'&&event.damageType==='true')).toBe(true);
 });
 it('does not lose emitted missiles when their source actor is removed',()=>{
  const f=fixture('ranged',10,10,16,10);f.tick(1.3);f.actors.delete(f.e.id);f.tick(1);expect(f.h.hp).toBeCloseTo(9985.2);
 });
});
describe('monster geometry and navigation',()=>{
 it('uses exact rectangular side and end contact and an actually safe ring centre',()=>{
  const box={kind:'rectangle' as const,center:{x:0,y:0},facing:{x:1,y:0},length:5,width:.6};expect(overlaps(box,{x:2,y:.62,radius:.32})).toBe(true);expect(overlaps(box,{x:5.33,y:0,radius:.32})).toBe(false);
  const ring={kind:'ring' as const,center:{x:0,y:0},radius:2,innerRadius:.9};expect(overlaps(ring,{x:0,y:0,radius:.32})).toBe(false);expect(overlaps(ring,{x:.59,y:0,radius:.32})).toBe(true);expect(overlaps(ring,{x:2.33,y:0,radius:.32})).toBe(false);
 });
 it('caches conservative radius groups and blocks a large unit from a narrow passage',()=>{
  const map={...mapDefinition('ember'),width:20,height:20,heroSpawn:{x:2,y:2},obstacles:[{id:'a',x:10,y:8.9,radius:.7,height:10},{id:'b',x:10,y:11.1,radius:.7,height:10}]};const pool=new PathfinderPool(map);expect(pool.forRadius(.28)).toBe(pool.forRadius(.3));expect(pool.forRadius(.9)).not.toBe(pool.forRadius(.3));expect(pool.forRadius(.3).clear({x:8,y:10},{x:12,y:10})).toBe(true);expect(pool.forRadius(.9).clear({x:8,y:10},{x:12,y:10})).toBe(false);
 });
});
