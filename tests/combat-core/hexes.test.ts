import { describe,it,expect } from 'vitest';
import { CombatEngine,EVENT_BUDGET,MAX_CHAIN_DEPTH } from '../../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import { CollisionWorld } from '../../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import type { Actor,CombatCue,CombatHooks,MissileEffect,PerkId } from '../../EmberDemo/assets/scripts/ember/combat-core/types';
function actor(id:string,x:number,hp=1000):Actor{return{id,team:id==='hero'?'hero':'enemy',x,y:10,hp,maxHp:hp,shield:0,shieldTime:0,radius:.3,alive:true,statuses:[]};}
function fixture(perks:PerkId[],hooks:CombatHooks={}){
  const h=actor('hero',10,240),a=actor('a',12),b=actor('b',13),actors=new Map([h,a,b].map(a=>[a.id,a]));
  const cues:CombatCue[]=[],missiles:{effect:MissileEffect;damage:number}[]=[],reductions:number[]=[];
  const core=new CombatEngine(actors,c=>cues.push(c),hit=>hit.amount,new CollisionWorld(),{random:()=>.1,projectile:(_,__,effect,damage)=>missiles.push({effect,damage}),reduceCooldown:(_,s)=>reductions.push(s),attackDamage:()=>20,...hooks});
  perks.forEach(p=>core.addPerk(p));return{h,a,b,actors,core,cues,missiles,reductions};
}
describe('hex rules and bounded interactions',()=>{
  it('jeweled gauntlet crits basic/skill direct hits, never DOT, procs or enemy attacks',()=>{
    const {core,a,h,cues}=fixture(['jeweledGauntlet']);
    for(const cause of ['basic','skill','burn','augment'] as const)core.damage({sourceId:h.id,targetId:a.id,amount:20,cause,proc:cause==='augment'});
    core.damage({sourceId:a.id,targetId:h.id,amount:20,cause:'skill'});
    expect(a.hp).toBe(900);expect(h.hp).toBe(220);expect(cues.filter(c=>c.critical)).toHaveLength(2);
    const miss=fixture(['jeweledGauntlet'],{random:()=>.9});miss.core.damage({sourceId:'hero',targetId:'a',amount:20,cause:'skill'});expect(miss.a.hp).toBe(980);
  });
  it('magic missile fires three real-projectile requests, globally limited, with no proc recursion',()=>{
    const {core,missiles}=fixture(['magicMissile']);
    for(const targetId of ['a','b'])core.damage({sourceId:'hero',targetId,amount:1,cause:'skill',skillId:'nova'});
    expect(missiles).toHaveLength(3);expect(missiles.every(m=>m.effect.trueDamage&&m.effect.targetHpRatio===.005)).toBe(true);
    core.tick(.5);core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill',proc:true});expect(missiles).toHaveLength(3);
    core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill'});expect(missiles).toHaveLength(6);
  });
  it('infernal stacks to five, keeps tick cadence on refresh and limits AoE cooldown reduction',()=>{
    const {core,a,b,reductions}=fixture(['infernalConduit']);
    for(let i=0;i<8;i++)core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill'});
    core.damage({sourceId:'hero',targetId:'b',amount:1,cause:'skill'});core.tick(.8);
    core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill'});core.tick(.2);
    expect(a.statuses[0]?.stacks).toBe(5);expect(a.hp).toBe(971);expect(b.hp).toBe(995);expect(reductions).toEqual([.15]);
    core.tick(4);expect(a.statuses).toHaveLength(0);expect(core.history.filter(e=>e.type==='OnStatusTick'&&e.targetId==='a')).toHaveLength(4);
  });
  it('ethereal weapon grants on-hit once per target per second; DOT and proc hits are excluded',()=>{
    const {core,a,b,reductions}=fixture(['etherealWeapon','heavyHitter','mysticPunch']);
    for(const targetId of ['a','a','b'])core.damage({sourceId:'hero',targetId,amount:10,cause:'skill'});
    expect(a.hp).toBeCloseTo(972.8);expect(b.hp).toBeCloseTo(982.8);expect(reductions).toEqual([.35]);
    core.tick(1);core.damage({sourceId:'hero',targetId:'a',amount:10,cause:'skill'});
    expect(a.hp).toBeCloseTo(955.6);expect(reductions).toEqual([.35,.35]);
    for(const cause of ['burn','augment'] as const)core.damage({sourceId:'hero',targetId:'a',amount:10,cause});
    expect(core.history.filter(e=>e.type==='OnAttackHit')).toHaveLength(3);
  });
  it('every-fourth attack counts releases instead of number of victims; reset starts a new cycle',()=>{
    const {core,missiles}=fixture(['lightEmUp']);
    for(let i=0;i<3;i++)core.attack('hero',{x:1,y:0});expect(missiles).toHaveLength(0);
    core.damage({sourceId:'hero',targetId:'a',amount:10,cause:'basic'});expect(missiles).toHaveLength(0);
    core.attack('hero',{x:1,y:0});expect(missiles).toHaveLength(3);
    core.resetEncounter();for(let i=0;i<3;i++)core.attack('hero',{x:1,y:0});expect(missiles).toHaveLength(3);
  });
  it('heavy hitter scales with current max HP and secondary bullets explicitly carry on-hit',()=>{
    const {core,a,h,reductions}=fixture(['heavyHitter','mysticPunch']);h.maxHp=400;
    core.damage({sourceId:'hero',targetId:'a',amount:9,cause:'augment',proc:true,appliesOnHit:true});
    expect(a.hp).toBe(979);expect(reductions).toEqual([.35]);expect(core.history.filter(e=>e.type==='OnAttackHit')).toHaveLength(1);
  });
  it('typhoon excludes the body in the primary firing line and does not fire without another body',()=>{
    const directions:{x:number;y:number}[]=[],{core,b,actors}=fixture(['typhoon'],{projectile:(_,aim)=>directions.push(aim)});b.x=10;b.y=13;
    core.attack('hero',{x:1,y:0});expect(directions).toHaveLength(1);expect(directions[0]!.x).toBeCloseTo(0);expect(directions[0]!.y).toBe(1);actors.delete(b.id);
    core.attack('hero',{x:1,y:0});expect(directions).toHaveLength(1);
  });
  it('dawnbringer heals 30% over three seconds, has 45-second cooldown, and does not respond to shield-only hits',()=>{
    const {core,h}=fixture(['dawnbringer']);h.hp=121;h.shield=100;
    core.damage({sourceId:'a',targetId:'hero',amount:100,cause:'enemy'});core.tick(3);expect(h.hp).toBe(121);
    core.damage({sourceId:'a',targetId:'hero',amount:2,cause:'enemy'});core.tick(1);expect(h.hp).toBe(143);core.tick(2);expect(h.hp).toBe(191);
    core.damage({sourceId:'a',targetId:'hero',amount:100,cause:'enemy'});core.tick(3);expect(h.hp).toBe(91);
    core.tick(39);core.damage({sourceId:'a',targetId:'hero',amount:1,cause:'enemy'});core.tick(3);expect(h.hp).toBe(162);
  });
  it('dawnbringer cannot revive a lethal hit or keep healing after death',()=>{
    const {core,h}=fixture(['dawnbringer']);h.hp=100;core.damage({sourceId:'a',targetId:'hero',amount:1,cause:'enemy'});
    core.damage({sourceId:'a',targetId:'hero',amount:100,cause:'enemy'});core.tick(10);expect(h.hp).toBe(0);expect(h.alive).toBe(false);
  });
  it('death ring consumes only effective healing, hits the nearest visible body and cannot heal a dead actor',()=>{
    const {core,h,a,b}=fixture(['circleOfDeath']);h.hp=235;
    expect(core.heal('hero',100)).toBe(5);expect(a.hp).toBe(996.5);expect(b.hp).toBe(1000);
    expect(core.heal('hero',100)).toBe(0);expect(a.hp).toBe(996.5);
    h.alive=false;h.hp=0;expect(core.heal('hero',100)).toBe(0);
  });
  it('death ring cannot chain leech indefinitely through a crowd',()=>{
    const {core,h,a,b,actors}=fixture(['circleOfDeath','leech','corpse','arc']);h.hp=100;a.hp=1;b.hp=1;
    for(let i=0;i<100;i++){const e=actor(`crowd-${i}`,12,1);actors.set(e.id,e);}
    core.heal('hero',10);expect(core.metrics.processed).toBeLessThanOrEqual(EVENT_BUDGET);expect(core.metrics.maxDepth).toBeLessThanOrEqual(MAX_CHAIN_DEPTH);
    expect(h.hp).toBe(122);expect(core.history.filter(e=>e.type==='OnKill')).toHaveLength(1);
  });
  it('glass cannon true component bypasses armor but still consumes shield, without amplifying itself',()=>{
    const h=actor('hero',10,240),a=actor('a',12),core=new CombatEngine(new Map([[h.id,h],[a.id,a]]),()=>{},hit=>hit.amount*(hit.trueDamage?1:.5));core.addPerk('glassCannon');a.shield=20;
    core.damage({sourceId:'hero',targetId:'a',amount:100,cause:'basic'});expect(a.hp).toBe(945);expect(a.shield).toBe(0);
    core.damage({sourceId:'hero',targetId:'a',amount:100,cause:'augment',trueDamage:true});expect(a.hp).toBe(845);
  });
});
