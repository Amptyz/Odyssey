import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { LocalTransport } from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import { EQUIPMENT,SHOP_CATALOG,deriveStats } from '../../EmberDemo/assets/scripts/ember/content/equipment';
import { SKILL_SLOTS,DEFAULT_LOADOUT,HERO_SKILLS,type SkillSlot } from '../../EmberDemo/assets/scripts/ember/content/skills';
import { PERKS } from '../../EmberDemo/assets/scripts/ember/content/perks';
import { rewardChoices } from '../../EmberDemo/assets/scripts/ember/simulation/RewardSystem';
import { Random } from '../../EmberDemo/assets/scripts/ember/utils/Random';
function shop(){const w=new GameWorld();w.command({type:'Start'});return w;}
function clear(w:GameWorld){for(const e of w.actors.values())if(e.team==='enemy')w.combat.damage({sourceId:'hero',targetId:e.id,amount:1e6,cause:'basic'});w.advance(1/30);}
function fixture(item?:keyof typeof EQUIPMENT){const w=shop();if(item)w.command({type:'BuyEquipment',equipmentId:item});w.command({type:'LeaveShop'});for(const [id,e] of w.actors)if(e.team==='enemy')w.actors.delete(id);const e=w.spawnEnemy('melee',{x:11.5,y:10},1000);e.windup=999;return{w,e};}
describe('classless skill rewards',()=>{
  it('uses one starting loadout regardless of map and freezes time in the opening shop',()=>{
    for(const map of ['ember','frost'] as const){const w=new GameWorld(1234,map);w.command({type:'Start'});w.advance(5);expect(w.phase).toBe('shop');expect(w.loadout).toEqual(DEFAULT_LOADOUT);expect(w.time).toBe(0);expect(w.actors.size).toBe(1);}
  });
  for(const slot of SKILL_SLOTS)it(`selects a skill, cancels safely, then replaces only ${slot}`,()=>{
    const {w}=fixture();clear(w);const before={...w.loadout},c=w.choices.find(c=>c.kind==='skill')!;if(c.kind!=='skill')throw Error();
    w.command({type:'ChooseReward',choiceId:'invalid'});expect(w.pendingSkill).toBeUndefined();
    w.command({type:'ChooseReward',choiceId:c.id});expect(w.loadout).toEqual(before);expect(w.phase).toBe('reward');
    w.command({type:'CancelSkill'});expect(w.choices.some(x=>x.id===c.id)).toBe(true);
    w.command({type:'ChooseReward',choiceId:c.id});w.command({type:'ConfirmSkill',slot:'invalid' as SkillSlot});expect(w.phase).toBe('reward');
    w.command({type:'ConfirmSkill',slot});expect(w.loadout).toEqual({...before,[slot]:c.skillId});expect(w.phase).toBe('shop');expect(w.choices).toHaveLength(0);
    w.command({type:'ConfirmSkill',slot:'Q'});expect(w.loadout).toEqual({...before,[slot]:c.skillId});
    w.command({type:'LeaveShop'});w.command({type:'CastSlot',slot,point:{x:15,y:10}});expect(w.cooldowns[c.skillId]).toBeGreaterThan(0);
  });
  it('cannot acquire unoffered skills or reuse a consumed reward; passives persist across replacements',()=>{
    const {w}=fixture();w.combat.addPerk('swift');clear(w);const c=w.choices.find(c=>c.kind==='skill')!;
    w.command({type:'ChooseReward',choiceId:'skill:mistBolt'});expect(w.pendingSkill).toBeUndefined();
    w.command({type:'ChooseReward',choiceId:c.id});w.command({type:'ConfirmSkill',slot:'E'});expect(w.combat.perks.has('swift')).toBe(true);
    const before={...w.loadout};w.command({type:'ChooseReward',choiceId:c.id});expect(w.loadout).toEqual(before);
  });
  it('filters projectile and shield synergy perks when a build has neither',()=>{
    for(let i=0;i<50;i++){const choices=rewardChoices(new Random(i),{Q:'cleave',W:'nova',E:'dash',R:'frostNova'},new Set());expect(choices.filter(c=>c.kind==='perk').map(c=>c.perkId)).not.toContain('double');expect(choices.filter(c=>c.kind==='perk').map(c=>c.perkId)).not.toContain('reserve');}
  });
  it('always offers three distinct usable rewards even after all passives are owned',()=>{
    const owned=new Set(PERKS.map(p=>p.id));
    for(let i=0;i<50;i++){const choices=rewardChoices(new Random(i),{Q:'cleave',W:'ironGuard',E:'dash',R:'frostNova'},owned);expect(new Set(choices.map(c=>c.id)).size).toBe(3);for(const c of choices){expect(c.kind).toBe('skill');if(c.kind==='skill')expect(['cleave','ironGuard','dash','frostNova']).not.toContain(c.skillId);}}
    expect(HERO_SKILLS).not.toContain('frostBolt');
  });
});
describe('deterministic equipment economy',()=>{
  it('rejects invalid, unaffordable and duplicate purchases without charging',()=>{
    const w=shop();w.command({type:'BuyEquipment',equipmentId:'sword'});expect(w.equipment.gold).toBe(60);
    const before=w.equipment.snapshot();w.command({type:'BuyEquipment',equipmentId:'sword'});w.command({type:'BuyEquipment',equipmentId:'staff'});
    w.command({type:'BuyEquipment',equipmentId:'unknown' as any});expect(w.equipment.snapshot()).toEqual(before);expect(SHOP_CATALOG).toHaveLength(10);
  });
  it('retains old items, permits mixed builds, and recomputes stats without stacking or healing',()=>{
    const w=shop();w.command({type:'BuyEquipment',equipmentId:'bow'});w.command({type:'BuyEquipment',equipmentId:'plate'});
    expect(w.equipment.gold).toBe(0);expect(w.equipment.stats.attackRange).toBe(7.5);expect(w.hero.maxHp).toBe(300);
    w.hero.hp=100;const stats=w.equipment.stats;
    for(let i=0;i<4;i++){w.command({type:'UnequipEquipment',slot:'body'});w.command({type:'EquipEquipment',equipmentId:'plate'});}
    expect(w.equipment.stats).toEqual(stats);expect(w.hero.hp).toBe(100);expect(w.equipment.inventory.size).toBe(2);
    w.command({type:'EquipEquipment',equipmentId:'staff'});expect(w.equipment.equipped.weapon).toBe('bow');
    w.equipment.gold=100;w.command({type:'BuyEquipment',equipmentId:'sword'});expect(w.equipment.inventory.has('bow')).toBe(true);
    w.command({type:'EquipEquipment',equipmentId:'bow'});expect(w.equipment.gold).toBe(0);expect(w.equipment.stats).toEqual(stats);
  });
  it('awards wave gold once, freezes shop time and blocks purchases during combat',()=>{
    const w=shop();w.command({type:'LeaveShop'});w.command({type:'BuyEquipment',equipmentId:'sword'});expect(w.equipment.gold).toBe(160);
    clear(w);expect(w.equipment.gold).toBe(260);for(let i=0;i<60;i++)w.advance(1/30);expect(w.equipment.gold).toBe(260);
    const c=w.choices.find(c=>c.kind==='perk')!;w.command({type:'ChooseReward',choiceId:c.id});expect(w.phase).toBe('shop');const time=w.time;
    w.advance(5);expect(w.time).toBe(time);w.command({type:'BuyEquipment',equipmentId:'staff'});expect(w.equipment.gold).toBe(160);
    w.command({type:'LeaveShop'});expect(w.wave).toBe(2);w.command({type:'LeaveShop'});expect(w.wave).toBe(2);
  });
  it('resets build, currency and inventory on restart; snapshots are detached',()=>{
    const port=new LocalTransport();port.send({type:'Start'});port.send({type:'BuyEquipment',equipmentId:'sword'});
    const s=port.snapshot();s.inventory.length=0;s.equipment.weapon='bow';s.stats.armor=999;s.loadout.Q='icebolt';expect(port.world.equipment.equipped.weapon).toBe('sword');
    port.send({type:'Restart'});const next=port.snapshot();expect(next.gold).toBe(160);expect(next.inventory).toEqual([]);expect(next.equipment).toEqual({});expect(next.loadout).toEqual(DEFAULT_LOADOUT);
  });
  it('weapon changes actual basic damage and range',()=>{
    const {w,e}=fixture('bow');e.x=15;w.command({type:'Attack',point:e});expect(e.hp).toBe(1000);for(let i=0;i<10;i++)w.advance(1/30);expect(e.hp).toBe(974);
    const plain=fixture();plain.e.x=15;plain.w.command({type:'Attack',point:plain.e});expect(plain.e.hp).toBe(1000);
    const sword=fixture('sword');sword.w.command({type:'Attack',point:sword.e});for(let i=0;i<5;i++)sword.w.advance(1/30);expect(sword.e.hp).toBe(964);
  });
  it('staff scales skill hits and shields, reduces cooldowns; armor mitigates before shield absorption',()=>{
    const {w,e}=fixture('staff');w.command({type:'CastSlot',slot:'Q',point:e});for(let i=0;i<8;i++)w.advance(1/30);expect(e.hp).toBeCloseTo(1000-38*1.45);
    w.command({type:'CastSlot',slot:'W',point:e});expect(w.hero.shield).toBeCloseTo(65*1.45);expect(w.cooldowns.shield).toBeCloseTo(9/1.15);
    const tank=fixture('bulwark');tank.w.hero.shield=10;tank.w.combat.damage({sourceId:tank.e.id,targetId:'hero',amount:140,cause:'enemy'});
    expect(tank.w.hero.hp).toBe(300-90);expect(tank.w.hero.shield).toBe(0);
  });
  it('supports configurable stages without a shop and final rewards end the run',()=>{
    const {w}=fixture();const stages=w.map.shopAfterWaves;(w as any).map={...w.map,shopAfterWaves:[]};
    for(let i=0;i<3;i++){clear(w);const c=w.choices.find(c=>c.kind==='perk')??w.choices[0]!;w.command({type:'ChooseReward',choiceId:c.id});if(w.pendingSkill)w.command({type:'ConfirmSkill',slot:'Q'});}
    expect(w.phase).toBe('victory');expect(stages).toEqual([1,2]);
  });
  it('cleave respects facing and frost area applies slow through shared skill handlers',()=>{
    const {w,e}=fixture();w.loadout.Q='cleave';const back=w.spawnEnemy('melee',{x:8.5,y:10},1000);
    w.command({type:'CastSlot',slot:'Q',point:e});expect(e.hp).toBe(935);expect(back.hp).toBe(1000);
    w.loadout.R='frostNova';w.command({type:'CastSlot',slot:'R',point:e});expect(e.statuses.some(s=>s.id==='slow')).toBe(true);expect(back.hp).toBe(958);
  });
});
