import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { parseRunCheckpoint } from '../../EmberDemo/assets/scripts/ember/simulation/RunCheckpoint';
import { FIXED_DT } from '../../EmberDemo/assets/scripts/ember/content/config';
import { PERKS } from '../../EmberDemo/assets/scripts/ember/content/perks';

function team(){const w=new GameWorld(1234);w.addPlayer('p2');w.command({type:'Start'});return w;}
function start(w:GameWorld){for(const id of w.players.keys())w.command({type:'LeaveShop'},id);}
function clear(w:GameWorld){for(const p of w.players.values())Object.assign(p.hero,w.map.waves[w.wave-1]!.level!.exit);w.stopAll();for(const enemy of w.actors.values())if(enemy.team==='enemy'){enemy.alive=false;enemy.hp=0;}w.advance(FIXED_DT);}
describe('independent cooperative player state',()=>{
  it('keeps purchases, slots, skill cooldowns and movement separate',()=>{
    const w=team();w.command({type:'BuyEquipment',equipmentId:'bow'},'p2');
    expect(w.equipment.inventory.size).toBe(0);expect(w.snapshot('p2').equipment.slot1).toBe('bow');
    w.command({type:'LeaveShop'});expect(w.phase).toBe('shop');w.command({type:'LeaveShop'},'p2');expect(w.phase).toBe('fighting');
    const guest=w.players.get('p2')!,x=guest.hero.x;w.command({type:'DirectInput',movement:{x:1,y:0}},'p2');w.advance(FIXED_DT);
    expect(guest.hero.x).toBeGreaterThan(x);expect(w.hero.x).toBe(w.map.heroSpawn.x);
    w.command({type:'CastSlot',slot:'W',point:{x:12,y:10}},'p2');expect(guest.hero.shield).toBeGreaterThan(0);expect(w.hero.shield).toBe(0);expect(w.snapshot().cooldowns.W).toBe(0);
  });
  it('isolates perks and armor, and targets surviving teammates when the original hero dies',()=>{
    const w=team(),p=w.players.get('p2')!;const perk=PERKS.find(def=>'maxHpMultiplier' in def)!;
    w.combat.addPerk(perk.id,'p2');expect(w.combat.perks.has(perk.id)).toBe(false);expect(w.statsFor('p2').maxHp).not.toBe(w.stats.maxHp);
    start(w);w.hero.alive=false;w.hero.hp=0;w.advance(FIXED_DT);expect(w.phase).toBe('fighting');
    const target=w.spawnEnemy('melee',{x:p.hero.x+3,y:p.hero.y});w.advance(FIXED_DT);expect(target.path.length).toBeGreaterThan(0);
    p.hero.alive=false;p.hero.hp=0;w.advance(FIXED_DT);expect(w.phase).toBe('defeat');
  });
  it('waits for individual rewards and awards currency once per player',()=>{
    const w=team();start(w);clear(w);expect(w.phase).toBe('reward');
    expect(w.snapshot().gold).toBe(260);expect(w.snapshot('p2').gold).toBe(260);
    const choice=w.choices.find(c=>c.kind==='perk')!;w.command({type:'ChooseReward',choiceId:choice.id});expect(w.phase).toBe('reward');
    expect(w.snapshot().choices).toEqual([]);expect(w.snapshot('p2').choices).toHaveLength(3);
    const other=w.players.get('p2')!.choices.find(c=>c.kind==='perk')!;w.command({type:'ChooseReward',choiceId:other.id},'p2');expect(w.phase).toBe('shop');
    w.command({type:'ChooseReward',choiceId:other.id},'p2');expect(w.snapshot('p2').gold).toBe(260);
  });
  it('can exclude offline members without letting them receive hits or block the next wave',()=>{
    const w=team();w.setPlayerActive('hero',false);w.command({type:'LeaveShop'},'p2');expect(w.phase).toBe('fighting');
    expect(w.actors.has('hero')).toBe(false);expect(w.snapshot('p2').hero.id).toBe('p2');
    w.setPlayerActive('hero',true);expect(w.actors.get('hero')).toBe(w.hero);
  });
});
describe('durable wave boundary checkpoints',()=>{
  it('restores the start of a wave with matching enemies, builds and RNG continuation',()=>{
    const w=team();w.command({type:'BuyEquipment',equipmentId:'bow'},'p2');start(w);
    const checkpoint=w.savedRun!,restored=GameWorld.resume(JSON.parse(JSON.stringify(checkpoint)));
    const layout=(world:GameWorld)=>world.snapshot().units.map(u=>[u.id,u.x,u.y,u.hp]);expect(layout(restored)).toEqual(layout(w));
    w.command({type:'CastSlot',slot:'W',point:{x:12,y:10}},'p2');w.advance(.25);
    expect(w.savedRun).toEqual(checkpoint);expect(restored.snapshot('p2').cooldowns.W).toBe(0);
    clear(w);clear(restored);expect(restored.snapshot().choices).toEqual(w.snapshot().choices);expect(restored.snapshot('p2').choices).toEqual(w.snapshot('p2').choices);
  });
  it('preserves a partially selected reward and never regrants wave gold on resume',()=>{
    const w=team();start(w);clear(w);w.command({type:'ChooseReward',choiceId:w.choices.find(c=>c.kind==='perk')!.id});
    const restored=GameWorld.resume(w.savedRun);expect(restored.players.get('hero')!.ready).toBe(true);expect(restored.choices).toEqual([]);
    expect(restored.snapshot('p2').choices).toEqual(w.snapshot('p2').choices);restored.advance(.25);expect(restored.equipment.gold).toBe(260);
    const choice=restored.players.get('p2')!.choices.find(c=>c.kind==='skill')!;restored.command({type:'ChooseReward',choiceId:choice.id},'p2');
    const pending=GameWorld.resume(restored.savedRun);expect(pending.players.get('p2')!.pendingSkill).toBe(restored.players.get('p2')!.pendingSkill);
  });
  it('recreates later-wave entity IDs and resumes when the remaining ready players skip an offline member',()=>{
    const w=team();start(w);clear(w);
    for(const p of w.players.values())w.command({type:'ChooseReward',choiceId:p.choices.find(c=>c.kind==='perk')!.id},p.id);
    w.command({type:'LeaveShop'},'p2');w.setPlayerActive('hero',false);expect(w.phase).toBe('fighting');expect(w.wave).toBe(2);
    const restored=GameWorld.resume(w.savedRun);expect(restored.snapshot().units.filter(a=>a.team==='enemy').map(a=>a.id)).toEqual(w.snapshot().units.filter(a=>a.team==='enemy').map(a=>a.id));
  });
  it('detaches saves and rejects invalid versions, equipment and duplicate members',()=>{
    const w=team(),saved=w.savedRun!;saved.players[0]!.gold=999;expect(w.savedRun!.players[0]!.gold).toBe(160);
    expect(()=>parseRunCheckpoint({...saved,version:1})).toThrow();expect(()=>parseRunCheckpoint({...saved,players:[saved.players[0],saved.players[0]]})).toThrow();
    saved.players[0]!.equipment.slot1='bow';expect(()=>parseRunCheckpoint(saved)).toThrow();
  });
  it('strips unknown imported fields instead of assigning them to live actors or skill slots',()=>{
    const w=team(),save=w.savedRun!;Object.assign(save.players[0]!.position,{id:'enemy',team:'enemy'});Object.assign(save.players[0]!.loadout,{extra:'nova'});
    const restored=GameWorld.resume(save);expect(restored.hero.id).toBe('hero');expect(restored.hero.team).toBe('hero');expect(Object.keys(restored.loadout)).toHaveLength(4);
  });
});
