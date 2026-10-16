import {describe,it,expect} from 'vitest';
import {EquipmentSystem} from '../EmberDemo/assets/scripts/ember/simulation/EquipmentSystem';
import {EQUIPMENT_SLOTS,appearanceLoadout,basicAttack,deriveStats,type EquipmentId,type EquipmentSlot} from '../EmberDemo/assets/scripts/ember/content/equipment';
const six:EquipmentId[]=['sword','staff','bow','bulwark','plate','robe'];
function funded(){const s=new EquipmentSystem();s.gold=1000;return s;}
describe('six universal equipment slots',()=>{
  it('accepts different weapons in simultaneous slots and adds each source once',()=>{
    const s=funded();for(const id of six)expect(s.buy(id)).toBe(true);
    expect(Object.keys(s.equipped)).toHaveLength(6);expect(s.gold).toBe(400);
    expect(s.stats.attackDamage).toBe(36);expect(s.stats.maxHp).toBe(405);expect(s.stats.abilityPower).toBe(54);
    expect(s.attributes.exportSources().filter(x=>x.sourceId.startsWith('equipment:slot'))).toHaveLength(6);
    for(let i=0;i<5;i++)expect(s.stats.attackDamage).toBe(36);
  });
  it('rejects duplicate/invalid/poor/full transactions atomically and requires an explicit replacement',()=>{
    const s=funded();for(const id of six)s.buy(id);const before=s.snapshot();
    expect(s.buy('sword')).toBe(false);expect(s.buy('unknown' as EquipmentId)).toBe(false);expect(s.buy('helm')).toBe(false);
    expect(s.buy('helm','bad' as EquipmentSlot)).toBe(false);expect(s.snapshot()).toEqual(before);
    expect(s.buy('helm','slot2')).toBe(true);expect(s.equipped.slot2).toBe('helm');expect(s.inventory.has('staff')).toBe(true);
    expect(s.gold).toBe(300);expect(s.purchaseOrder).toEqual([...six,'helm']);
    s.gold=0;const poor=s.snapshot();expect(s.buy('hood','slot1')).toBe(false);expect(s.snapshot()).toEqual(poor);
  });
  it('uses purchase history for appearance and attack rather than slot position or re-equipping',()=>{
    const s=funded();s.buy('bow');s.buy('sword');s.buy('plate');s.buy('robe');s.buy('helm');s.buy('circlet');
    expect(s.appearance).toEqual({weapon:'sword',body:'robe',head:'circlet'});expect(s.attack.kind).toBe('melee');expect(s.stats.attackRange).toBe(2.5);
    expect(s.unequip('slot2')).toBe(true);expect(s.attack.kind).toBe('projectile');expect(s.stats.attackRange).toBe(7.5);
    expect(s.equip('sword','slot2')).toBe(true);expect(s.appearance.weapon).toBe('sword');
    expect(s.equip('bow','slot6')).toBe(false);expect(s.equipped.slot1).toBe('bow');
    const order=[...s.purchaseOrder];s.unequip('slot1');s.equip('bow','slot1');expect(s.purchaseOrder).toEqual(order);expect(s.attack.kind).toBe('melee');
  });
  it('does not add weapon ranges and preserves independent non-equipment range modifiers',()=>{
    const s=funded();s.buy('bow');s.buy('staff');expect(s.stats.attackRange).toBe(6.5);s.buy('sword');expect(s.stats.attackRange).toBe(2.5);
    s.attributes.upsert({sourceId:'permanent:reach',modifiers:[{stat:'attackRange',operation:'flat',value:1}]});expect(s.stats.attackRange).toBe(3.5);
    s.unequip('slot3');expect(s.stats.attackRange).toBe(7.5);s.unequip('slot2');expect(s.stats.attackRange).toBe(8.5);s.unequip('slot1');expect(s.stats.attackRange).toBe(3.5);
  });
  it('re-equips retained inventory into a chosen full slot without new purchase or persistent stat drift',()=>{
    const s=funded();for(const id of six)s.buy(id);s.buy('helm','slot2');const gold=s.gold,order=[...s.purchaseOrder];
    for(let i=0;i<5;i++){expect(s.equip('staff','slot2')).toBe(true);expect(s.stats.abilityPower).toBe(54);expect(s.equip('helm','slot2')).toBe(true);expect(s.stats.abilityPower).toBe(24);}
    expect(s.gold).toBe(gold);expect(s.purchaseOrder).toEqual(order);expect(s.equip('staff')).toBe(false);
  });
  it('restores identities from ordered ownership, detaches snapshots and isolates players',()=>{
    const a=funded(),b=funded();a.buy('staff');a.buy('bow');b.buy('sword');
    const saved=a.snapshot(),copy=funded();copy.inventory.clear();copy.purchaseOrder.push(...saved.purchaseOrder);for(const id of saved.inventory)copy.inventory.add(id);Object.assign(copy.equipped,saved.equipment);
    expect(copy.appearance).toEqual(a.appearance);expect(copy.stats).toEqual(a.stats);expect(b.appearance.weapon).toBe('sword');expect(b.stats.attackRange).toBe(2.5);
    saved.purchaseOrder.reverse();saved.appearance.weapon='sword';saved.equipment.slot1='helm';expect(a.appearance.weapon).toBe('bow');expect(a.equipped.slot1).toBe('staff');
    expect(a.stats.attackDamage).toBe(24);expect(b.stats.attackDamage).toBe(32);
  });
  it('supports empty loadouts and stable configuration fallback without relying on object insertion order',()=>{
    expect(EQUIPMENT_SLOTS).toHaveLength(6);expect(appearanceLoadout({})).toEqual({});expect(basicAttack({}).kind).toBe('melee');
    expect(deriveStats({}).attackRange).toBe(2.5);
    const a=appearanceLoadout({slot6:'sword',slot1:'bow'}),b=appearanceLoadout({slot1:'bow',slot6:'sword'});expect(a).toEqual(b);expect(a.weapon).toBe('sword');
    expect(appearanceLoadout({slot6:'sword',slot1:'bow'},['sword','bow']).weapon).toBe('bow');
  });
});
