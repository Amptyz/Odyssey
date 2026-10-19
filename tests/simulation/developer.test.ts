import {openMerchantFixture,startCombatFixture} from '../helpers/scenes';
import { describe,it,expect } from 'vitest';
import { LocalTransport } from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { captureDeveloperConfig,cloneDeveloperConfig,parseDeveloperConfig,saveDeveloperPreset,loadDeveloperPreset,type DeveloperConfig } from '../../EmberDemo/assets/scripts/ember/simulation/DeveloperConfig';
import { DEFAULT_LOADOUT } from '../../EmberDemo/assets/scripts/ember/content/skills';
import { PERKS } from '../../EmberDemo/assets/scripts/ember/content/perks';
function setup(change:(c:DeveloperConfig)=>void=()=>{}){
  const p=new LocalTransport(1234);p.send({type:'DevOpen'});const c=p.snapshot().developer!.draft;change(c);p.send({type:'DevConfigure',config:c});p.send({type:'DevApply'});return p;
}
function run(p:LocalTransport,seconds:number){for(let i=0;i<Math.round(seconds*30);i++)p.advance(1/30);}
describe('developer command boundary and replay',()=>{
  it('ignores test actions until explicitly enabled; opening/closing does not modify a normal run',()=>{
    const p=new LocalTransport();openMerchantFixture(p.world);startCombatFixture(p.world);run(p,.3);const before=p.world.snapshot();
    for(const action of ['recover','cooldowns','health25','clearEnemies','step'] as const)p.send({type:'DevAction',action});p.send({type:'DevSpawn',enemyId:'warden',count:5});p.send({type:'DevApply'});p.send({type:'DevExit'});
    expect(p.world.snapshot()).toEqual(before);p.send({type:'DevOpen'});run(p,2);expect(p.snapshot().paused).toBe(true);expect(p.world.snapshot()).toEqual(before);
    p.send({type:'DevAction',action:'health25'});expect(p.world.snapshot()).toEqual(before);p.send({type:'DevClose'});expect(p.snapshot().paused).toBe(false);expect(p.world.snapshot()).toEqual(before);
  });
  it('blocks ordinary commands while editing and preserves an existing pause on close',()=>{
    const p=setup();p.send({type:'TogglePause'});p.send({type:'DevOpen'});const before=p.world.snapshot();
    p.send({type:'TogglePause'});p.send({type:'CastSlot',slot:'Q',point:{x:15,y:10}});p.send({type:'Attack',point:{x:15,y:10}});p.send({type:'BuyEquipment',equipmentId:'sword'});expect(p.world.snapshot()).toEqual(before);
    p.send({type:'DevClose'});expect(p.snapshot().paused).toBe(true);
  });
  it('draft edits are detached and atomic; applying loads the requested map/wave/build without shop or rewards',()=>{
    const p=new LocalTransport();p.send({type:'DevOpen'});const c=p.snapshot().developer!.draft;c.mapId='frost';c.wave=2;c.seed=42;c.loadout={Q:'icebolt',W:'cleave',E:'dash',R:'frostNova'};c.perks=['glassCannon','heavyHitter'];c.equipment={slot1:'staff',slot2:'plate',slot3:'helm'};c.purchaseOrder=['staff','plate','helm'];
    expect(p.snapshot().developer!.draft.mapId).toBe('ember');p.send({type:'DevConfigure',config:c});expect(p.world.mapId).toBe('ember');p.send({type:'DevApply'});
    const s=p.snapshot();expect(s.mapId).toBe('frost');expect(s.wave).toBe(2);expect(s.seed).toBe(42);expect(s.phase).toBe('fighting');expect(s.units.filter(u=>u.team==='enemy')).toHaveLength(5);expect(s.hero.hp).toBe(259);expect(s.hero.maxHp).toBe(259);expect(s.loadout).toEqual(c.loadout);expect(s.equipment).toEqual(c.equipment);expect(new Set(s.perks)).toEqual(new Set(c.perks));expect(s.developer?.enabled).toBe(true);expect(s.developer?.open).toBe(false);
  });
  it('restart replays the applied seed and spawn layout, not an unapplied draft',()=>{
    const p=setup(c=>{c.wave=3;c.seed=87;c.perks=['jeweledGauntlet','typhoon'];}),before=p.world.snapshot();run(p,1);p.send({type:'DevOpen'});const draft=p.snapshot().developer!.draft;draft.seed=123;p.send({type:'DevConfigure',config:draft});p.send({type:'DevRestart'});
    expect(p.world.snapshot()).toEqual(before);run(p,1);p.send({type:'Restart'});expect(p.world.snapshot()).toEqual(before);
  });
  it('can explicitly replace a stale draft with the current normal-game build',()=>{
    const p=new LocalTransport();p.send({type:'DevOpen'});p.send({type:'DevClose'});openMerchantFixture(p.world);p.send({type:'BuyEquipment',equipmentId:'bow'});startCombatFixture(p.world);p.send({type:'DevOpen'});expect(p.snapshot().developer!.draft.equipment.slot1).toBeUndefined();p.send({type:'DevCapture'});expect(p.snapshot().developer!.draft.equipment.slot1).toBe('bow');expect(p.snapshot().developer!.draft.wave).toBe(1);expect(p.snapshot().developer!.enabled).toBe(false);
  });
  it('exit removes every debug modifier and returns to a fresh ordinary game',()=>{
    const p=setup(c=>{c.options={invincible:true,noCooldown:true,freezeEnemies:true,speed:2};c.perks=PERKS.map(p=>p.id);c.equipment={slot1:'bow'};c.purchaseOrder=['bow'];c.loadout.Q='icebolt';});
    p.send({type:'DevExit'});const s=p.snapshot();expect(s.developer).toBeUndefined();expect(s.phase).toBe('ready');expect(s.perks).toHaveLength(0);expect(s.loadout).toEqual(DEFAULT_LOADOUT);expect(s.equipment).toEqual({});expect(s.hero.maxHp).toBe(240);openMerchantFixture(p.world);startCombatFixture(p.world);p.world.combat.damage({sourceId:[...p.world.actors.keys()][1]!,targetId:'hero',amount:20,cause:'enemy'});expect(p.world.hero.hp).toBe(220);
  });
  it('invincibility and zero cooldown are opt-in; enemy AI freeze keeps positions and attacks still',()=>{
    const p=setup(c=>{c.options={invincible:true,noCooldown:true,freezeEnemies:true,speed:1};}),w=p.world,e=[...w.actors.values()].find(a=>a.team==='enemy')!,position={x:e.x,y:e.y};
    w.combat.damage({sourceId:e.id,targetId:'hero',amount:9999,cause:'enemy'});expect(w.hero.hp).toBe(240);p.send({type:'CastSlot',slot:'Q',point:{x:10,y:16}});p.send({type:'CastSlot',slot:'Q',point:{x:10,y:16}});expect(w.projectiles.filter(p=>p.sourceId==='hero')).toHaveLength(2);expect(w.cooldowns.fireball).toBe(0);run(p,1);expect({x:e.x,y:e.y}).toEqual(position);expect(e.action.id).toBe(0);expect(w.projectiles.every(p=>!p.enemy)).toBe(true);
  });
  it('time scaling preserves fixed steps; panel pause and manual step are independent of speed',()=>{
    for(const speed of [.25,.5,1,2] as const){const p=setup(c=>{c.options.speed=speed;c.options.freezeEnemies=true;});run(p,1);expect(p.world.tickCount).toBe(Math.floor(30*speed));p.send({type:'DevOpen'});const t=p.world.tickCount;run(p,1);expect(p.world.tickCount).toBe(t);p.send({type:'DevAction',action:'step'});expect(p.world.tickCount).toBe(t+1);expect(p.snapshot().paused).toBe(true);}
  });
  it('recover revives without healing procs; health/cooldown tools work while the panel stays open',()=>{
    const p=setup(c=>{c.perks=['circleOfDeath'];}),w=p.world;
    p.send({type:'CastSlot',slot:'W',point:w.hero});expect(w.cooldowns.shield).toBeGreaterThan(0);p.send({type:'DevOpen'});p.send({type:'DevAction',action:'health25'});expect(w.hero.hp).toBe(60);p.send({type:'DevAction',action:'cooldowns'});expect(w.cooldowns.shield).toBe(0);
    w.hero.shield=0;w.combat.damage({sourceId:[...w.actors.keys()][1]!,targetId:'hero',amount:9999,cause:'enemy'});p.send({type:'DevAction',action:'step'});expect(w.phase).toBe('defeat');p.send({type:'DevAction',action:'recover'});expect(w.hero.alive).toBe(true);expect(w.hero.hp).toBe(240);expect(w.phase).toBe('fighting');expect(w.hero.diedAt).toBe(-1);expect(w.combat.history.some(e=>e.type==='OnHeal')).toBe(false);
  });
  it('clearing/spawning bypasses kill rewards, keeps empty arena active, and spawns nonoverlapping bodies',()=>{
    const p=setup(),w=p.world,gold=w.equipment.gold;p.send({type:'DevOpen'});p.send({type:'DevAction',action:'clearEnemies'});p.send({type:'DevAction',action:'step'});expect(w.actors.size).toBe(1);expect(w.phase).toBe('fighting');expect(w.combat.metrics.kills).toBe(0);expect(w.equipment.gold).toBe(gold);
    p.send({type:'DevSpawn',enemyId:'warden',count:5});const units=[...w.actors.values()];expect(units).toHaveLength(6);
    for(const a of units){expect(w.nav.walkable(a,a.radius)).toBe(true);for(const b of units)if(a!==b)expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThan(a.radius+b.radius);}
    expect(w.combat.metrics.kills).toBe(0);
  });
  it('raw world ignores debug entry/actions without developer options',()=>{
    const w=new GameWorld(),before=w.snapshot();w.startDeveloper(captureDeveloperConfig(before));w.command({type:'DevSpawn',enemyId:'warden',count:5});w.command({type:'DevAction',action:'health25'});expect(w.snapshot()).toEqual(before);
  });
});
describe('portable developer presets',()=>{
  const base=()=>captureDeveloperConfig(new GameWorld().snapshot());
  it('round trips config and all new content IDs without changing live references',()=>{
    const c=base();c.perks=PERKS.map(p=>p.id);c.wave=3;c.equipment={slot1:'staff',slot2:'hood',slot3:'plate'};c.purchaseOrder=['staff','hood','plate'];expect(parseDeveloperConfig(JSON.stringify(c))).toEqual(c);const copy=cloneDeveloperConfig(c);copy.perks.length=0;copy.options.invincible=true;expect(c.perks.length).toBe(PERKS.length);expect(c.options.invincible).toBe(false);
  });
  it('rejects malformed, unsupported and inconsistent imports atomically',()=>{
    const p=new LocalTransport();p.send({type:'DevOpen'});const before=p.snapshot().developer!.draft;
    const invalid:unknown[]=['{bad',null,{...before,version:9},{...before,seed:NaN},{...before,seed:-1},{...before,seed:2**32},{...before,mapId:'missing'},{...before,wave:99},{...before,loadout:{...before.loadout,Q:'mistBolt'}},{...before,loadout:{...before.loadout,Q:'shield'}},{...before,perks:['burn','burn']},{...before,perks:['unknown']},{...before,equipment:{weapon:'helm'}},{...before,options:{...before.options,speed:99}},{...before,options:{...before.options,invincible:1}}];
    for(const config of invalid){expect(()=>parseDeveloperConfig(config)).toThrow();p.send({type:'DevConfigure',config});expect(p.snapshot().developer!.draft).toEqual(before);expect(p.snapshot().developer!.notice).toBeTruthy();expect(p.world.phase).toBe('ready');}
  });
  it('three local slots save/load explicitly and handle missing/corrupt/unavailable storage',()=>{
    const map=new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}},c=base();
    expect(()=>loadDeveloperPreset(store,1)).toThrow();for(let slot=1;slot<=3;slot++){c.seed=slot;saveDeveloperPreset(store,slot,c);expect(loadDeveloperPreset(store,slot).seed).toBe(slot);}
    map.set('ember.developer.v2.2','invalid');expect(()=>loadDeveloperPreset(store,2)).toThrow();expect(()=>saveDeveloperPreset(store,4,c)).toThrow();expect(()=>saveDeveloperPreset({...store,setItem:()=>{throw Error('disabled');}},1,c)).toThrow();expect(new LocalTransport().snapshot().developer).toBeUndefined();
  });
});
