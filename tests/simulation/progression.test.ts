import {openMerchantFixture,startCombatFixture,interactFixture,departFixture} from '../helpers/scenes';
import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { LocalTransport } from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import { EQUIPMENT,SHOP_CATALOG,deriveStats } from '../../EmberDemo/assets/scripts/ember/content/equipment';
import { SKILL_SLOTS,DEFAULT_LOADOUT,HERO_SKILLS,type SkillSlot } from '../../EmberDemo/assets/scripts/ember/content/skills';
import { PERKS } from '../../EmberDemo/assets/scripts/ember/content/perks';
import { rewardChoices } from '../../EmberDemo/assets/scripts/ember/simulation/RewardSystem';
import {levelDefinition} from '../../EmberDemo/assets/scripts/ember/simulation/LevelSystem';
import {AttributeSet} from '../../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import { Random } from '../../EmberDemo/assets/scripts/ember/utils/Random';
function shop(){const w=new GameWorld();openMerchantFixture(w);return w;}
function clear(w:GameWorld){for(const e of w.actors.values())if(e.team==='enemy')w.combat.damage({sourceId:'hero',targetId:e.id,amount:1e6,cause:'basic'});const exit=levelDefinition(w.map,w.wave).exit;Object.assign(w.hero,{x:exit.x,y:exit.y,previous:{x:exit.x,y:exit.y}});w.advance(1/30);if(w.snapshot().scene.interactions.some(n=>n.kind==='ember'))interactFixture(w,'ember');}
function fixture(item?:keyof typeof EQUIPMENT){const w=shop();if(item)w.command({type:'BuyEquipment',equipmentId:item});startCombatFixture(w);for(const [id,e] of w.actors)if(e.team==='enemy')w.actors.delete(id);Object.assign(w.hero,{x:10,y:10,previous:{x:10,y:10}});const e=w.spawnEnemy('melee',{x:11.5,y:10},1000);e.attributes=new AttributeSet({...e.attributes.template,canMove:false,canAttack:false,stats:{...e.attributes.template.stats,armor:0,magicResist:0}});e.windup=999;return{w,e};}
describe('classless skill rewards',()=>{
  it('uses one starting loadout regardless of map and allows movement in the opening camp without a merchant',()=>{
    for(const map of ['ember','frost'] as const){const w=new GameWorld(1234,map);w.command({type:'Start'});w.command({type:'DirectInput',movement:{x:1,y:0}});w.advance(.1);expect(w.phase).toBe('camp');expect(w.loadout).toEqual(DEFAULT_LOADOUT);expect(w.time).toBeCloseTo(.1);expect(w.actors.size).toBe(1);}
  });
  for(const slot of SKILL_SLOTS)it(`selects a skill, cancels safely, then replaces only ${slot}`,()=>{
    const {w}=fixture();clear(w);const before={...w.loadout},c=w.choices.find(c=>c.kind==='skill')!;if(c.kind!=='skill')throw Error();
    w.command({type:'ChooseReward',choiceId:'invalid'});expect(w.pendingSkill).toBeUndefined();
    w.command({type:'ChooseReward',choiceId:c.id});expect(w.loadout).toEqual(before);expect(w.snapshot().phase).toBe('reward');
    w.command({type:'CancelSkill'});expect(w.choices.some(x=>x.id===c.id)).toBe(true);
    w.command({type:'ChooseReward',choiceId:c.id});w.command({type:'ConfirmSkill',slot:'invalid' as SkillSlot});expect(w.snapshot().phase).toBe('reward');
    w.command({type:'ConfirmSkill',slot});expect(w.loadout).toEqual({...before,[slot]:c.skillId});expect(w.phase).toBe('cleared');expect(w.choices).toHaveLength(0);
    w.command({type:'ConfirmSkill',slot:'Q'});expect(w.loadout).toEqual({...before,[slot]:c.skillId});
    startCombatFixture(w);w.command({type:'CastSlot',slot,point:{x:15,y:10}});expect(w.cooldowns[c.skillId]).toBeGreaterThan(0);
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
    w.command({type:'BuyEquipment',equipmentId:'unknown' as any});expect(w.equipment.snapshot()).toEqual(before);expect(SHOP_CATALOG).toHaveLength(18);
  });
  it('retains replaced items and recomputes a mixed six-slot build without healing',()=>{
    const w=shop();w.equipment.gold=800;for(const equipmentId of ['bow','plate','robe','helm','circlet','hood'] as const)w.command({type:'BuyEquipment',equipmentId});
    expect(w.equipment.gold).toBe(200);expect(w.equipment.stats.attackRange).toBe(5);expect(w.hero.maxHp).toBe(400);
    w.hero.hp=100;const stats=w.equipment.stats;
    for(let i=0;i<4;i++){w.command({type:'UnequipEquipment',slot:'slot2'});w.command({type:'EquipEquipment',equipmentId:'plate',slot:'slot2'});}
    expect(w.equipment.stats).toEqual(stats);expect(w.hero.hp).toBe(100);expect(w.equipment.inventory.size).toBe(6);
    const before=w.equipment.snapshot();w.command({type:'BuyEquipment',equipmentId:'staff'});expect(w.equipment.snapshot()).toEqual(before);
    w.command({type:'BuyEquipment',equipmentId:'sword',replaceSlot:'slot1'});expect(w.equipment.inventory.has('bow')).toBe(true);expect(w.equipment.appearance.weapon).toBe('sword');
    const order=[...w.equipment.purchaseOrder];w.command({type:'EquipEquipment',equipmentId:'bow',slot:'slot1'});expect(w.equipment.gold).toBe(100);expect(w.equipment.stats).toEqual(stats);expect(w.equipment.purchaseOrder).toEqual(order);expect(w.hero.hp).toBe(100);
  });
  it('awards clear gold once and blocks purchases away from a merchant',()=>{
    const w=new GameWorld();startCombatFixture(w);w.command({type:'BuyEquipment',equipmentId:'sword'});expect(w.equipment.gold).toBe(160);
    clear(w);expect(w.equipment.gold).toBe(260);for(let i=0;i<60;i++)w.advance(1/30);expect(w.equipment.gold).toBe(260);
    const c=w.choices.find(c=>c.kind==='perk')!;w.command({type:'ChooseReward',choiceId:c.id});expect(w.phase).toBe('cleared');
    w.command({type:'BuyEquipment',equipmentId:'staff'});expect(w.equipment.gold).toBe(260);departFixture(w);expect(w.wave).toBe(2);
  });
  it('resets build, currency and inventory on restart; snapshots are detached',()=>{
    const port=new LocalTransport();openMerchantFixture(port.world);port.send({type:'BuyEquipment',equipmentId:'sword'});
    const s=port.snapshot();s.inventory.length=0;s.equipment.slot1='bow';s.stats.armor=999;s.loadout.Q='icebolt';expect(port.world.equipment.equipped.slot1).toBe('sword');
    port.send({type:'Restart'});const next=port.snapshot();expect(next.gold).toBe(160);expect(next.inventory).toEqual([]);expect(next.equipment).toEqual({});expect(next.loadout).toEqual(DEFAULT_LOADOUT);
  });
  it('equipment changes basic damage while retaining the default melee range',()=>{
    const {w,e}=fixture('bow');e.x=15;w.command({type:'Attack',point:e});expect(e.hp).toBe(1000);for(let i=0;i<10;i++)w.advance(1/30);expect(e.hp).toBe(976);
    const plain=fixture();plain.e.x=15;plain.w.command({type:'Attack',point:plain.e});expect(plain.e.hp).toBe(1000);
    const sword=fixture('sword');sword.w.command({type:'Attack',point:sword.e});for(let i=0;i<5;i++)sword.w.advance(1/30);expect(sword.e.hp).toBe(968);
  });
  it('staff scales skill hits and shields, reduces cooldowns; armor mitigates before shield absorption',()=>{
    const {w,e}=fixture('staff');w.command({type:'CastSlot',slot:'Q',point:e});for(let i=0;i<8;i++)w.advance(1/30);expect(e.hp).toBeCloseTo(1000-(38+.38*30));
    w.command({type:'CastSlot',slot:'W',point:e});expect(w.hero.shield).toBeCloseTo(65+.65*30);expect(w.cooldowns.shield).toBeCloseTo(9/1.10);
    const tank=fixture('bulwark');tank.w.hero.shield=10;tank.w.combat.damage({sourceId:tank.e.id,targetId:'hero',amount:122,cause:'enemy'});
    expect(tank.w.hero.hp).toBe(300-90);expect(tank.w.hero.shield).toBe(0);
  });
  it('requires explicit departures and only configured stages have rest merchants',()=>{
    const {w}=fixture();
    for(let i=1;i<=w.map.waves.length;i++){
      clear(w);if(w.choices.length){w.command({type:'ChooseReward',choiceId:w.choices[0]!.id});if(w.pendingSkill)w.command({type:'ConfirmSkill',slot:'Q'});}
      expect(w.wave).toBe(i);departFixture(w);
      if(i===2||i===4){expect(w.phase).toBe('camp');expect(w.snapshot().scene.interactions.some(n=>n.kind==='merchant')).toBe(true);departFixture(w);}
    }
    expect(w.phase).toBe('victory');
  });
  it('restores six slots and original purchase history through a real reward/shop checkpoint',()=>{
    const w=shop();w.equipment.gold=800;for(const equipmentId of ['staff','bow','plate','robe','helm','circlet'] as const)w.command({type:'BuyEquipment',equipmentId});
    w.command({type:'BuyEquipment',equipmentId:'sword',replaceSlot:'slot2'});w.command({type:'EquipEquipment',equipmentId:'bow',slot:'slot2'});
    startCombatFixture(w);clear(w);const c=w.choices.find(c=>c.kind==='perk')!;w.command({type:'ChooseReward',choiceId:c.id});
    expect(w.phase).toBe('cleared');const resumed=GameWorld.resume(w.savedRun);expect(resumed.equipment.snapshot()).toEqual(w.equipment.snapshot());
    expect(resumed.equipment.purchaseOrder).toEqual(['staff','bow','plate','robe','helm','circlet','sword']);expect(resumed.equipment.appearance).toEqual({weapon:'bow',body:'robe',head:'circlet'});
  });
  it('cleave respects facing and frost area applies slow through shared skill handlers',()=>{
    const {w,e}=fixture();w.loadout.Q='cleave';const back=w.spawnEnemy('melee',{x:8.5,y:10},1000);back.attributes=new AttributeSet({...back.attributes.template,canMove:false,canAttack:false,stats:{...back.attributes.template.stats,armor:0,magicResist:0}});
    w.command({type:'CastSlot',slot:'Q',point:e});expect(e.hp).toBe(935);expect(back.hp).toBe(1000);
    w.loadout.R='frostNova';w.command({type:'CastSlot',slot:'R',point:e});expect(e.statuses.some(s=>s.id==='slow')).toBe(true);expect(back.hp).toBe(958);
  });
});
