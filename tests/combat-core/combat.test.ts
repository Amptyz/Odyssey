import {AttributeSet,PLAYER_TEMPLATE} from '../../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import { describe, it, expect } from 'vitest';
import { CombatEngine, EVENT_BUDGET, MAX_CHAIN_DEPTH } from '../../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import type { Actor, CombatCue, PerkId } from '../../EmberDemo/assets/scripts/ember/combat-core/types';
import { Random } from '../../EmberDemo/assets/scripts/ember/utils/Random';
function actor(id:string,x=0,hp=100):Actor { return {id,x,y:0,hp,maxHp:hp,shield:0,shieldTime:0,radius:0.3,alive:true,team:id==='hero'?'hero':'enemy',statuses:[],attributes:new AttributeSet({...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:hp}}),mana:0,shields:[],combatEffects:[],attributeEffects:[]}; }
function fixture(perks:PerkId[]=[]) {
  const hero=actor('hero',0,240), a=actor('a',1), b=actor('b',2), actors=new Map([hero,a,b].map(x=>[x.id,x]));
  const cues:CombatCue[]=[]; const core=new CombatEngine(actors,c=>cues.push(c));
  perks.forEach(p=>core.addPerk(p)); return {hero,a,b,actors,cues,core};
}
describe('combat rules',()=>{
  it('absorbs shield first and clamps lethal HP; OnKill exactly once',()=>{
    const {core,a}=fixture(); a.shield=20;
    core.damage({sourceId:'hero',targetId:'a',amount:30,cause:'basic'}); expect(a.hp).toBe(90); expect(a.shield).toBe(0);
    core.damage({sourceId:'hero',targetId:'a',amount:1000,cause:'basic'});
    core.damage({sourceId:'hero',targetId:'a',amount:1000,cause:'basic'});
    expect(a.hp).toBe(0); expect(core.history.filter(e=>e.type==='OnKill')).toHaveLength(1);
  });
  it('rejects negative or NaN damage',()=>{
    const {core,a}=fixture(); for(const amount of [-2,NaN,Infinity])core.damage({sourceId:'hero',targetId:'a',amount,cause:'skill'});
    expect(a.hp).toBe(100);
  });
  it('Q burn deals three ticks, preserves source, expires',()=>{
    const {core,a}=fixture(['burn']); core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill',skillId:'fireball'});
    for(let i=0;i<91;i++)core.tick(1/30);
    expect(a.hp).toBe(72); expect(a.statuses.find(s=>s.id==='burn')).toBeUndefined();
    expect(core.history.filter(e=>e.type==='OnStatusTick')).toHaveLength(3);
    expect(core.history.filter(e=>e.type!=='OnDamaged').every(e=>e.sourceId==='hero')).toBe(true);
  });
  it('burn refresh keeps tick cadence',()=>{
    const {core,a}=fixture(['burn']);
    core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill',skillId:'fireball'}); core.tick(0.8);
    core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill',skillId:'fireball'}); core.tick(0.2);
    expect(a.hp).toBe(89);
  });
  it('burn -> corpse explosion works on a lethal Q and a lethal DoT',()=>{
    for(const dot of [false,true]) {
      const {core,a,b,cues}=fixture(['burn','corpse']); a.hp=dot?6:1;
      core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'skill',skillId:'fireball'});
      if(dot)core.tick(1);
      expect(a.alive).toBe(false); expect(b.hp).toBe(70);
      expect(cues.some(c=>c.kind==='explosion')).toBe(true);
    }
  });
  it('corpse explosion triggers arc, which never re-arcs',()=>{
    const {core,a,b,actors}=fixture(['corpse','arc']);
    const c=actor('c',4); actors.set('c',c); a.hp=1;a.statuses=[{id:'burn',remaining:3,tickIn:1,power:9,sourceId:'hero'}];
    core.damage({sourceId:'hero',targetId:'a',amount:1,cause:'basic'});
    expect(b.hp).toBe(70); expect(c.hp).toBe(84);
    expect(core.history.filter(e=>e.type==='OnHit'&&e.cause==='arc')).toHaveLength(1);
  });
  it('reserve -> double empowers both shots and consumes once',()=>{
    const {core}=fixture(['reserve','double']);
    core.cast('hero','shield'); expect(core.isPrimed('hero')).toBe(true);
    expect(core.cast('hero','fireball')).toEqual({damageMultiplier:1.5,shots:2});
    expect(core.cast('hero','fireball')).toEqual({damageMultiplier:1,shots:2});
  });
  it('heal is capped and gated by simulation cooldown',()=>{
    const {core,hero,a,b}=fixture(['leech']); hero.hp=220;
    core.damage({sourceId:'hero',targetId:a.id,amount:100,cause:'basic'});
    core.damage({sourceId:'hero',targetId:b.id,amount:100,cause:'basic'}); expect(hero.hp).toBe(232);
    core.tick(1.5); b.alive=true;b.hp=100;
    core.damage({sourceId:'hero',targetId:b.id,amount:100,cause:'basic'}); expect(hero.hp).toBe(240);
  });
  it('enemy kills do not trigger hero perks or heal a dead hero',()=>{
    const {core,hero,a}=fixture(['leech','arc']);hero.hp=1;
    core.damage({sourceId:a.id,targetId:hero.id,amount:100,cause:'skill'});
    core.damage({sourceId:hero.id,targetId:a.id,amount:100,cause:'skill'});
    expect(hero.alive).toBe(false);expect(hero.hp).toBe(0);
  });
  it('enforces chain depth for a long burning chain',()=>{
    const {core,actors}=fixture(['corpse']); actors.delete('a');actors.delete('b');
    for(let i=0;i<20;i++) { const a=actor(`chain${i}`,i*2,10); a.statuses=[{id:'burn',remaining:3,tickIn:1,power:9,sourceId:'hero'}]; actors.set(a.id,a); }
    core.damage({sourceId:'hero',targetId:'chain0',amount:10,cause:'basic'});
    expect(core.metrics.maxDepth).toBe(MAX_CHAIN_DEPTH);expect(core.metrics.dropped).toBeGreaterThan(0);
    expect(actors.get('chain8')!.alive).toBe(true);
  });
  it('bounds an extreme crowded chain by the per-root budget',()=>{
    const {core,actors}=fixture(['corpse','arc']);
    for(let i=0;i<400;i++) { const a=actor(`crowd${i}`,1,1); a.statuses=[{id:'burn',remaining:3,tickIn:1,power:9,sourceId:'hero'}];actors.set(a.id,a); }
    core.damage({sourceId:'hero',targetId:'crowd0',amount:1,cause:'skill'});
    expect(core.metrics.processed).toBeLessThanOrEqual(EVENT_BUDGET); expect(core.metrics.dropped).toBeGreaterThan(0);
    expect(core.metrics.maxDepth).toBeLessThanOrEqual(MAX_CHAIN_DEPTH);
  });
  it('seeded random and sampling reproduce without duplicate candidates',()=>{
    const a=new Random(0),b=new Random(0),c=new Random(1);
    const samples=Array.from({length:40},()=>a.pick([1,2,3,4,5,6,7,8],3));
    expect(samples).toEqual(Array.from({length:40},()=>b.pick([1,2,3,4,5,6,7,8],3)));
    expect(samples).not.toEqual(Array.from({length:40},()=>c.pick([1,2,3,4,5,6,7,8],3)));
    samples.forEach(s=>expect(new Set(s).size).toBe(3));
  });
});
