import {openMerchantFixture,startCombatFixture,interactFixture} from '../helpers/scenes';
import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { PERKS,LAB_PRESETS,type LabId } from '../../EmberDemo/assets/scripts/ember/content/perks';
import type { PerkId } from '../../EmberDemo/assets/scripts/ember/combat-core/types';
import { rewardChoices } from '../../EmberDemo/assets/scripts/ember/simulation/RewardSystem';
import { DEVELOPER_LOADOUT as DEFAULT_LOADOUT } from '../../EmberDemo/assets/scripts/ember/content/skills';
import {AttributeSet} from '../../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import { Random } from '../../EmberDemo/assets/scripts/ember/utils/Random';
function fixture(perks:PerkId[]=[],weapon?:'staff'|'bow'){
  const w=new GameWorld(1234);openMerchantFixture(w);if(weapon)w.command({type:'BuyEquipment',equipmentId:weapon});startCombatFixture(w);
  for(const [id,a] of w.actors)if(a.team==='enemy')w.actors.delete(id);perks.forEach(p=>w.combat.addPerk(p));
  Object.assign(w.hero,{x:10,y:10,previous:{x:10,y:10}});const sentinel=w.spawnEnemy('ranged',{x:2,y:2},99999);sentinel.attributes=new AttributeSet({...sentinel.attributes.template,canMove:false,canAttack:false});sentinel.windup=9999;return w;
}
function spawn(w:GameWorld,x:number,y:number){const e=w.spawnEnemy('melee',{x,y},1000);Object.assign(e,{x,y,previous:{x,y},windup:999});e.attributes=new AttributeSet({...e.attributes.template,canMove:false,canAttack:false,stats:{...e.attributes.template.stats,armor:0,magicResist:0}});return e;}
function run(w:GameWorld,s:number){for(let i=0;i<Math.round(s*30);i++)w.advance(1/30);}
describe('hex simulation, hitboxes and progression',()=>{
  it('magic missiles require collision, can be intercepted, and never recursively spawn missiles',()=>{
    const w=fixture(['magicMissile']),target=spawn(w,14,10);w.command({type:'CastSlot',slot:'Q',point:target});run(w,1/3);
    expect(w.projectiles.filter(p=>p.cause==='augment')).toHaveLength(3);expect(target.hp).toBe(962);
    const blocker=spawn(w,12,10);target.y=12;run(w,.3);
    expect(target.hp).toBe(962);expect(blocker.hp).toBeLessThan(1000);expect(w.projectiles).toHaveLength(0);
    expect(w.combat.history.filter(e=>e.cause==='augment'&&e.type==='OnHit')).toHaveLength(3);
  });
  it('magic missiles collide with map obstacles and miss a victim who leaves their trajectories',()=>{
    for(const wall of [false,true]){
      const w=fixture(['magicMissile']),target=spawn(w,wall?8:14,wall?6:10);if(wall)Object.assign(w.hero,{x:4,y:6});
      // Trigger the rule independently, then verify the emitted physical bodies, not direct target damage.
      w.combat.damage({sourceId:'hero',targetId:target.id,amount:1,cause:'skill'});if(!wall)target.y=13;run(w,1.5);
      expect(target.hp).toBe(999);expect(w.projectiles).toHaveLength(0);
    }
  });
  it('missile target-HP damage is capped and flight distance increases it up to double',()=>{
    const losses:number[]=[];
    for(const distance of [2,8]){
      const w=fixture(['magicMissile']),e=spawn(w,10,10+distance);e.attributes.upsert({sourceId:'fixture:health',modifiers:[{stat:'maxHealth',operation:'flat',value:99000}]});e.maxHp=100000;
      w.combat.damage({sourceId:'hero',targetId:e.id,amount:1,cause:'skill'});
      // One central missile isolates the distance/health formula; other bullets retain their real spread in the prior test.
      w.projectiles.splice(2,1);w.projectiles.splice(0,1);run(w,1);losses.push(999-e.hp);
    }
    expect(losses[0]).toBeGreaterThan(28);expect(losses[1]).toBeGreaterThan(losses[0]!);expect(losses[1]).toBeLessThanOrEqual(56);
  });
  it('mystic punch reduces equipped skill cooldown on impact, never on a miss, clamps at zero',()=>{
    const w=fixture(['missileAttack','mysticPunch'],'bow'),e=spawn(w,13,10);w.cooldowns.shield=5;w.cooldowns.fireball=.1;w.cooldowns.icebolt=5;
    w.command({type:'Attack',point:e});expect(w.cooldowns.shield).toBe(5);run(w,.2);
    expect(w.cooldowns.shield).toBeCloseTo(4.45);expect(w.cooldowns.fireball).toBe(0);expect(w.cooldowns.icebolt).toBeCloseTo(4.8);
    const miss=fixture(['missileAttack','mysticPunch'],'bow');miss.cooldowns.shield=5;miss.command({type:'Attack',point:{x:15,y:10}});run(miss,.2);expect(miss.cooldowns.shield).toBeCloseTo(4.8);
  });
  it('heavy hitter is not multiplied by staff skill power',()=>{
    const w=fixture(['heavyHitter'],'staff'),e=spawn(w,12,10);w.command({type:'Attack',point:e});run(w,.2);expect(e.hp).toBeCloseTo(972.8);
  });
  it('light-em-up fires on the fourth actual directional release; held input and pause stay consistent',()=>{
    const w=fixture(['lightEmUp']);w.command({type:'AttackInput',point:{x:15,y:10}});run(w,2.3);
    expect(w.hero.action.id).toBe(4);expect(w.projectiles.filter(p=>p.cause==='augment')).toHaveLength(3);
    w.command({type:'TogglePause'});const s=w.snapshot();run(w,1);expect(w.snapshot()).toEqual(s);
  });
  it('typhoon uses a second projectile with independent collision and on-hit damage',()=>{
    const w=fixture(['missileAttack','typhoon','heavyHitter'],'bow'),primary=spawn(w,13,10),second=spawn(w,10,13);
    w.command({type:'Attack',point:primary});expect(second.hp).toBe(1000);expect(w.projectiles).toHaveLength(2);run(w,.3);
    expect(primary.hp).toBeCloseTo(968.8);expect(second.hp).toBeCloseTo(982);
    expect(w.combat.history.filter(e=>e.type==='OnAttack')).toHaveLength(1);
  });
  it('earthwake follows actual dash endpoints, waits, hits capsule edge once and can be dodged',()=>{
    const w=fixture(['earthwake']),edge=spawn(w,11.5,11.95),outside=spawn(w,11.5,12.1),dodge=spawn(w,12,10);
    w.command({type:'CastSlot',slot:'E',point:{x:18,y:10}});run(w,.2);
    expect(w.snapshot().zones[0]?.to.x).toBeCloseTo(13.5);expect(edge.hp).toBe(1000);dodge.y=12.2;
    run(w,.5);expect(edge.hp).toBe(1000);run(w,.2);expect(edge.hp).toBe(955);expect(outside.hp).toBe(1000);expect(dodge.hp).toBe(1000);expect(w.snapshot().zones).toHaveLength(0);
  });
  it('earthwake stops at pillars and cannot damage through them',()=>{
    const w=fixture(['earthwake']);Object.assign(w.hero,{x:4,y:6});const behind=spawn(w,7,6);
    w.command({type:'CastSlot',slot:'E',point:{x:9,y:6}});run(w,.2);expect(w.hero.x).toBeLessThan(5);expect(w.snapshot().zones[0]?.to.x).toBe(w.hero.x);
    run(w,1);expect(behind.hp).toBe(1000);
  });
  it('death-ring target queries respect walls and radius',()=>{
    const w=fixture(['circleOfDeath']);Object.assign(w.hero,{x:4.8,y:6,hp:100});const hidden=spawn(w,7.2,6),visible=spawn(w,4.8,9),far=spawn(w,4.8,13);
    w.combat.heal('hero',10);expect(hidden.hp).toBe(1000);expect(visible.hp).toBe(993);expect(far.hp).toBe(1000);
  });
  it('glass cannon recalculates with equipment and cannot heal via re-equipping',()=>{
    const w=new GameWorld();openMerchantFixture(w,'hexMage');expect(w.hero.maxHp).toBe(168);
    w.command({type:'BuyEquipment',equipmentId:'plate'});expect(w.hero.maxHp).toBe(221);expect(w.snapshot().stats.maxHp).toBe(221);w.hero.hp=100;
    for(let i=0;i<4;i++){w.command({type:'UnequipEquipment',slot:'slot1'});w.command({type:'EquipEquipment',equipmentId:'plate'});}
    expect(w.hero.maxHp).toBe(221);expect(w.hero.hp).toBe(100);startCombatFixture(w);expect(w.hero.hp).toBe(221);
  });
  it('all registered augments enter normal rewards without duplicates; movement requirement filters earthwake',()=>{
    const seen=new Set<PerkId>();for(let seed=0;seed<1000;seed++)for(const c of rewardChoices(new Random(seed),DEFAULT_LOADOUT,new Set()))if(c.kind==='perk')seen.add(c.perkId);
    expect([...seen].sort()).toEqual(PERKS.map(p=>p.id).sort());
    for(let seed=0;seed<50;seed++)expect(rewardChoices(new Random(seed),{...DEFAULT_LOADOUT,E:'cleave'},new Set(['heavyHitter'])).map(c=>c.id)).not.toEqual(expect.arrayContaining(['perk:earthwake']));
    expect(PERKS).toHaveLength(21);
  });
  it('normal offered glass-cannon reward applies immediately, returns to the cleared scene, and keeps perks',()=>{
    const w=fixture();w.phase='cleared';w.wave=1;interactFixture(w,'ember');w.choices=[{kind:'perk',id:'perk:glassCannon',perkId:'glassCannon'}];w.hero.hp=220;
    w.command({type:'ChooseReward',choiceId:'perk:glassCannon'});expect(w.hero.hp).toBe(168);expect(w.hero.maxHp).toBe(168);expect(w.phase).toBe('cleared');expect(w.combat.perks.has('glassCannon')).toBe(true);
    const s=w.snapshot();run(w,3);expect(w.hero.hp).toBe(s.hero.hp);expect(w.wave).toBe(s.wave);
  });
  it('all lab presets are reachable by Start and all first-batch hexes and the missile form are included',()=>{
    const seen=new Set<PerkId>();for(const lab of ['hexMage','hexAttack','hexSurvive'] as LabId[]){const w=new GameWorld();openMerchantFixture(w,lab);expect(w.snapshot().perks).toEqual(LAB_PRESETS[lab]);w.snapshot().perks.forEach(p=>seen.add(p));}
    expect(PERKS.slice(8).every(p=>seen.has(p.id))).toBe(true);
  });
  it('combined hexes are deterministic across render frame rates and reset encounter timers',()=>{
    const make=()=>{const w=fixture(PERKS.map(p=>p.id),'bow');spawn(w,13,10);spawn(w,10,13);w.command({type:'AttackInput',point:{x:15,y:10}});w.command({type:'CastSlot',slot:'Q',point:{x:15,y:10}});return w;};
    const a=make(),b=make();run(a,3);for(let i=0;i<432;i++)b.advance(1/144);expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.combat.metrics.dropped).toBe(0);expect(a.projectiles.length).toBeLessThan(20);
    a.combat.dashEnded('hero',{x:10,y:10},{x:12,y:10});expect(a.combat.zones.length).toBe(1);a.combat.resetEncounter();expect(a.combat.zones).toHaveLength(0);expect(a.combat.perks.size).toBe(PERKS.length);
  });
});
