import {describe,it,expect} from 'vitest';
import {EquipmentSystem} from '../EmberDemo/assets/scripts/ember/simulation/EquipmentSystem';
import {EQUIPMENT_SLOTS,EQUIPMENT,deriveStats,type EquipmentId,type EquipmentSlot} from '../EmberDemo/assets/scripts/ember/content/equipment';
const six:EquipmentId[]=['sword','staff','bow','bulwark','plate','robe'];
function funded(){const s=new EquipmentSystem();s.gold=1000;return s;}
describe('six universal equipment slots without character appearance',()=>{
  it('accepts different weapons simultaneously and adds each source once',()=>{
    const s=funded();for(const id of six)expect(s.buy(id)).toBe(true);
    expect(Object.keys(s.equipped)).toHaveLength(6);expect(s.gold).toBe(400);
    expect(s.stats.attackDamage).toBe(36);expect(s.stats.maxHp).toBe(405);expect(s.stats.abilityPower).toBe(54);
    expect(s.attributes.exportSources().filter(x=>x.sourceId.startsWith('equipment:slot'))).toHaveLength(6);
    for(let i=0;i<5;i++)expect(s.stats.attackDamage).toBe(36);
  });
  it('rejects duplicate/invalid/poor/full transactions atomically and requires explicit replacement',()=>{
    const s=funded();for(const id of six)s.buy(id);const before=s.snapshot();
    expect(s.buy('sword')).toBe(false);expect(s.buy('unknown' as EquipmentId)).toBe(false);expect(s.buy('helm')).toBe(false);
    expect(s.buy('helm','bad' as EquipmentSlot)).toBe(false);expect(s.snapshot()).toEqual(before);
    expect(s.buy('helm','slot2')).toBe(true);expect(s.equipped.slot2).toBe('helm');expect(s.inventory.has('staff')).toBe(true);expect(s.gold).toBe(300);
    s.gold=0;const poor=s.snapshot();expect(s.buy('hood','slot1')).toBe(false);expect(s.snapshot()).toEqual(poor);
  });
  it('does not publish appearance or an appearance purchase-order contract',()=>{
    const s=funded();for(const id of six)s.buy(id);
    expect(s.snapshot()).not.toHaveProperty('appearance');expect(s.snapshot()).not.toHaveProperty('purchaseOrder');
    for(const item of Object.values(EQUIPMENT))expect(item).not.toHaveProperty('appearance');
    expect(s.equip('bow','slot6')).toBe(false);expect(s.equipped.slot3).toBe('bow');
  });
  it('never changes attack range when equipping weapons and preserves independent range modifiers',()=>{
    const s=funded();s.buy('bow');s.buy('staff');expect(s.stats.attackRange).toBe(5);s.buy('sword');expect(s.stats.attackRange).toBe(5);
    s.attributes.upsert({sourceId:'permanent:reach',modifiers:[{stat:'attackRange',operation:'flat',value:1}]});expect(s.stats.attackRange).toBe(6);
    for(const slot of ['slot3','slot2','slot1'] as const){s.unequip(slot);expect(s.stats.attackRange).toBe(6);}
  });
  it('re-equips retained inventory without a new purchase or persistent stat drift',()=>{
    const s=funded();for(const id of six)s.buy(id);s.buy('helm','slot2');const gold=s.gold,owned=Array.from(s.inventory);
    for(let i=0;i<5;i++){expect(s.equip('staff','slot2')).toBe(true);expect(s.stats.abilityPower).toBe(54);expect(s.equip('helm','slot2')).toBe(true);expect(s.stats.abilityPower).toBe(24);}
    expect(s.gold).toBe(gold);expect(Array.from(s.inventory)).toEqual(owned);expect(s.equip('staff')).toBe(false);
  });
  it('detaches equipment snapshots and isolates player attributes',()=>{
    const a=funded(),b=funded();a.buy('staff');a.buy('bow');b.buy('sword');
    const saved=a.snapshot(),copy=funded();for(const id of saved.inventory)copy.inventory.add(id);Object.assign(copy.equipped,saved.equipment);
    expect(copy.stats).toEqual(a.stats);saved.equipment.slot1='helm';saved.inventory.length=0;
    expect(a.equipped.slot1).toBe('staff');expect(a.inventory.size).toBe(2);expect(a.stats.attackDamage).toBe(24);expect(b.stats.attackDamage).toBe(32);
  });
  it('derives identical stats independently of equipment property insertion order',()=>{
    expect(EQUIPMENT_SLOTS).toHaveLength(6);expect(deriveStats({}).attackRange).toBe(5);
    expect(deriveStats({slot6:'sword',slot1:'bow'})).toEqual(deriveStats({slot1:'bow',slot6:'sword'}));
  });
});
