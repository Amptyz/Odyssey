import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import type { EquipmentId } from '../../EmberDemo/assets/scripts/ember/content/equipment';
import { applyStatus } from '../../EmberDemo/assets/scripts/ember/combat-core/StatusSystem';
function fixture(weapon?:EquipmentId){
  const w=new GameWorld();w.command({type:'Start'});if(weapon)w.command({type:'BuyEquipment',equipmentId:weapon});w.command({type:'LeaveShop'});
  for(const [id,a] of w.actors)if(a.team==='enemy')w.actors.delete(id);
  const sentinel=w.spawnEnemy('ranged',{x:2,y:2},99999);sentinel.windup=9999;return w;
}
function spawn(w:GameWorld,x:number,y:number){const e=w.spawnEnemy('melee',{x,y},1000);Object.assign(e,{x,y,previous:{x,y},windup:999});return e;}
function run(w:GameWorld,seconds:number){for(let i=0;i<Math.round(seconds*30);i++)w.advance(1/30);}
describe('directional basic attacks and skill hitboxes',()=>{
  it('melee has a windup, hits all intersecting bodies once, and can miss behind the swing',()=>{
    const w=fixture('sword'),a=spawn(w,11.4,10),b=spawn(w,11.2,10.6),back=spawn(w,8.5,10);
    w.command({type:'Attack',point:{x:15,y:10}});expect(a.hp).toBe(1000);expect(w.snapshot().swings).toHaveLength(1);
    run(w,.1);expect(a.hp).toBe(1000);run(w,.2);
    expect(a.hp).toBe(964);expect(b.hp).toBe(964);expect(back.hp).toBe(1000);
    expect(w.combat.history.filter(e=>e.type==='OnHit'&&e.cause==='basic')).toHaveLength(2);
    expect(w.snapshot().swings).toHaveLength(0);
  });
  it('does not chase a target that moves out during windup; a miss still costs attack cooldown',()=>{
    const w=fixture(),e=spawn(w,11.5,10);w.command({type:'Attack',point:e});e.x=8.5;
    run(w,.3);expect(e.hp).toBe(1000);expect(w.hero.x).toBe(10);expect(w.hero.attackCd).toBeGreaterThan(0);
  });
  it('hits bodies grazing the edge of cleave and excludes bodies just beyond the edge',()=>{
    const w=fixture();w.loadout.Q='cleave';const angle=.97,at=(r:number)=>({x:10+Math.cos(angle)*r,y:10+Math.sin(angle)*r});
    const a=at(2),b=at(6),edge=spawn(w,a.x,a.y),outside=spawn(w,b.x,b.y);
    w.command({type:'CastSlot',slot:'Q',point:{x:15,y:10}});expect(edge.hp).toBe(935);expect(outside.hp).toBe(1000);
  });
  for(const weapon of ['bow','staff'] as const)it(`${weapon} launches a physical projectile without instant or homing damage`,()=>{
    const w=fixture(weapon),e=spawn(w,13,10);w.command({type:'Attack',point:e});expect(e.hp).toBe(1000);
    expect(w.projectiles[0]?.cause).toBe('basic');expect(w.projectiles[0]?.skillId).toBeUndefined();
    e.y=11.3;run(w,.4);expect(e.hp).toBe(1000);
    expect(w.combat.history.filter(e=>e.type==='OnHit')).toHaveLength(0);
  });
  it('a bullet can hit an intervening body, never the selected/farther body through it',()=>{
    const w=fixture('bow'),far=spawn(w,15,10),near=spawn(w,12,10);
    w.command({type:'Attack',point:far});run(w,.3);expect(near.hp).toBe(974);expect(far.hp).toBe(1000);expect(w.projectiles).toHaveLength(0);
  });
  it('uses swept collision even when the entire flight fits within one tick',()=>{
    const w=fixture('bow'),e=spawn(w,12,10);e.radius=.01;w.command({type:'Attack',point:{x:15,y:10}});
    Object.assign(w.projectiles[0]!,{vx:900,radius:.01,remaining:7.5/900});w.advance(1/30);
    expect(e.hp).toBe(974);expect(w.projectiles).toHaveLength(0);
  });
  it('checks the final partial flight step instead of expiring before reaching maximum range',()=>{
    const w=fixture('bow'),e=spawn(w,10,17.8);w.command({type:'Attack',point:{x:10,y:19}});run(w,.5);
    expect(e.hp).toBe(974);expect(w.projectiles).toHaveLength(0);
  });
  it('basic arrows and skill projectiles share collision radii, terrain blocking, and first-impact rules',()=>{
    for(const basic of [true,false]){
      const w=fixture('bow');Object.assign(w.hero,{x:4.5,y:6});const e=spawn(w,7.5,6);
      w.command(basic?{type:'Attack',point:e}:{type:'CastSlot',slot:'Q',point:e});run(w,.4);
      expect(e.hp).toBe(1000);expect(w.projectiles).toHaveLength(0);
    }
  });
  it('a projectile body grazing a pillar is blocked even though its center line is clear',()=>{
    const w=fixture('bow');Object.assign(w.hero,{x:4,y:6.9});const e=spawn(w,8,6.9);
    w.command({type:'Attack',point:e});run(w,.4);expect(e.hp).toBe(1000);expect(w.projectiles).toHaveLength(0);
  });
  it('area and cone skills cannot damage or apply status through a pillar',()=>{
    for(const id of ['nova','frostNova','cleave'] as const){
      const w=fixture();Object.assign(w.hero,{x:4.8,y:6});const hidden=spawn(w,7.2,6),visible=spawn(w,4.8,8);
      w.loadout.Q=id;w.command({type:'CastSlot',slot:'Q',point:visible});expect(hidden.hp).toBe(1000);expect(hidden.statuses).toHaveLength(0);expect(visible.hp).toBeLessThan(1000);
    }
  });
  it('explosion/chain search uses target body radii and terrain visibility too',()=>{
    const w=fixture();w.combat.addPerk('corpse');w.combat.addPerk('arc');
    const victim=spawn(w,4.8,6),hidden=spawn(w,7.2,6),edge=spawn(w,4.8,8.8);
    applyStatus(victim,{id:'burn',duration:3,power:1},'hero');w.combat.damage({sourceId:'hero',targetId:victim.id,amount:1000,cause:'basic'});
    expect(hidden.hp).toBe(1000);expect(edge.hp).toBe(970);
  });
  it('enemy melee attacks keep their windup direction and can be dodged behind them',()=>{
    const w=fixture(),e=spawn(w,10.8,10);e.windup=.05;e.aim={x:10,y:10};w.hero.x=11.5;
    run(w,.1);expect(w.hero.hp).toBe(w.hero.maxHp);
  });
  it('pause freezes active swings and bullets; attack input release stops subsequent attacks',()=>{
    for(const weapon of ['sword','bow'] as const){
      const w=fixture(weapon);spawn(w,12,10);w.command({type:'AttackInput',point:{x:15,y:10}});w.advance(1/30);
      w.command({type:'TogglePause'});const before=w.snapshot();run(w,1);expect(w.snapshot()).toEqual(before);
      w.command({type:'TogglePause'});run(w,1);expect(w.hero.action.id).toBe(1);
    }
  });
  it('fixed-step collisions and held-fire results agree at 30 and 144 render FPS',()=>{
    const a=fixture('bow'),b=fixture('bow');for(const w of [a,b]){spawn(w,14,10);w.command({type:'AttackInput',point:{x:15,y:10}});}
    for(let i=0;i<60;i++)a.advance(1/30);for(let i=0;i<288;i++)b.advance(1/144);expect(a.snapshot()).toEqual(b.snapshot());
  });
});
