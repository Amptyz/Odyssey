import {openMerchantFixture,startCombatFixture,interactFixture} from '../helpers/scenes';
import {describe,it,expect} from 'vitest';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {BASIC_ATTACKS,resolveBasicAttack} from '../../EmberDemo/assets/scripts/ember/content/attacks';
import {SHOP_CATALOG,equipment} from '../../EmberDemo/assets/scripts/ember/content/equipment';
import {motionPose} from '../../EmberDemo/assets/scripts/ember/content/animation';
import {LocalTransport} from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
const weapons=SHOP_CATALOG.filter(id=>equipment(id).category==='weapon');
const start=(w:GameWorld)=>{startCombatFixture(w);};
describe('augment-owned primary attack forms',()=>{
  for(const id of weapons)it(`${id} contributes stats and appearance without replacing the default slash`,()=>{
    const w=new GameWorld();openMerchantFixture(w);w.command({type:'BuyEquipment',equipmentId:id});
    expect(w.snapshot().basicAttack).toBe('slash');expect(w.stats.attackRange).toBe(BASIC_ATTACKS.slash.range);
    start(w);w.command({type:'Attack',point:{x:w.hero.x+8,y:w.hero.y}});
    expect(w.snapshot().swings).toHaveLength(1);expect(w.projectiles).toHaveLength(0);
    expect(w.snapshot().swings[0]!.damage).toBe(w.stats.attackDamage);
    expect(motionPose(w.hero,w.time+.15).basicAttack).toBe('slash');
  });
  it('keeps six coexisting weapons and every purchase/unequip order cosmetic with either form',()=>{
    for(const missile of [false,true]){
      const w=new GameWorld();openMerchantFixture(w);w.equipment.gold=1000;
      if(missile)w.combat.addPerk('missileAttack');
      for(const id of weapons){w.command({type:'BuyEquipment',equipmentId:id});expect(w.snapshot().basicAttack).toBe(missile?'missile':'slash');}
      expect(Object.keys(w.equipment.equipped)).toHaveLength(6);expect(w.stats.attackDamage).toBe(50);
      const range=w.stats.attackRange,order=[...w.equipment.purchaseOrder];
      for(const slot of Object.keys(w.equipment.equipped) as (keyof typeof w.equipment.equipped)[]){
        const id=w.equipment.equipped[slot]!;w.command({type:'UnequipEquipment',slot});w.command({type:'EquipEquipment',equipmentId:id,slot});
        expect(w.stats.attackRange).toBe(range);expect(w.equipment.purchaseOrder).toEqual(order);
      }
      expect(w.hero.attributes.exportSources().filter(s=>s.sourceId.startsWith('equipment:')).every(s=>s.modifiers.every(m=>m.stat!=='attackRange'))).toBe(true);
    }
  });
  it('replaces the empty-handed attack, samples physical AD and carries its own animation signal',()=>{
    const w=new GameWorld();openMerchantFixture(w);w.combat.addPerk('missileAttack');start(w);
    w.command({type:'Attack',point:{x:w.hero.x+8,y:w.hero.y}});
    expect(w.snapshot().swings).toHaveLength(0);expect(w.projectiles).toHaveLength(1);
    expect(w.projectiles[0]).toMatchObject({cause:'basic',damage:20,sourceId:'hero'});
    expect(w.projectiles[0]!.skillId).toBeUndefined();expect(motionPose(w.hero,w.time+.15).basicAttack).toBe('missile');
    const snap=w.snapshot();snap.hero.action.basicAttack='slash';expect(w.hero.action.basicAttack).toBe('missile');
  });
  it('does not confuse skill-triggered magic missiles with a primary form change',()=>{
    const w=new GameWorld();w.combat.addPerk('magicMissile');expect(w.snapshot().basicAttack).toBe('slash');expect(w.stats.attackRange).toBe(5);
  });
  it('keeps one form-range source, other reach modifiers and repeated grants stable',()=>{
    const w=new GameWorld();w.hero.attributes.upsert({sourceId:'permanent:reach',modifiers:[{stat:'attackRange',operation:'flat',value:2}]});
    for(let i=0;i<3;i++){w.combat.addPerk('missileAttack');w.combat.addPerk('swift');expect(w.stats.attackRange).toBe(17);}
    expect(w.hero.attributes.exportSources().filter(s=>s.sourceId==='perk:attack-form')).toHaveLength(1);
    expect(resolveBasicAttack([{basicAttack:'missile'},{},{basicAttack:'slash'}])).toBe('slash');
    expect(resolveBasicAttack([{basicAttack:'slash'},{basicAttack:'missile'},{}])).toBe('missile');
  });
  it('offers the form through a real cleared level, saves the chosen reward and restores it without equipment',()=>{
    const w=new GameWorld(6);openMerchantFixture(w);start(w);
    for(const a of w.actors.values())if(a.team==='enemy')w.combat.damage({sourceId:'hero',targetId:a.id,amount:1e6,cause:'basic'});
    Object.assign(w.hero,w.snapshot().level.exit);w.advance(1/30);
    interactFixture(w,'ember');expect(w.snapshot().phase).toBe('reward');expect(w.choices.some(c=>c.id==='perk:missileAttack')).toBe(true);
    w.command({type:'ChooseReward',choiceId:'perk:missileAttack'});expect(w.phase).toBe('cleared');
    expect(w.snapshot().basicAttack).toBe('missile');expect(w.stats.attackRange).toBe(15);
    const saved=w.savedRun!;expect(saved.players[0]!.attributeSources.some(s=>s.sourceId.startsWith('perk:'))).toBe(false);
    const restored=GameWorld.resume(JSON.parse(JSON.stringify(saved)));expect(restored.snapshot().basicAttack).toBe('missile');expect(restored.stats.attackRange).toBe(15);
    restored.command({type:'ChooseReward',choiceId:'perk:missileAttack'});expect(restored.stats.attackRange).toBe(15);
    start(restored);restored.command({type:'Attack',point:{x:restored.hero.x+5,y:restored.hero.y}});expect(restored.projectiles.some(p=>p.cause==='basic')).toBe(true);
  });
  it('isolates teammates and reconstructs each form from perks in version-4 saves',()=>{
    const w=new GameWorld();w.addPlayer('p2');openMerchantFixture(w);
    w.command({type:'BuyEquipment',equipmentId:'bow'});w.command({type:'BuyEquipment',equipmentId:'sword'},'p2');w.combat.addPerk('missileAttack','p2');start(w);
    const restored=GameWorld.resume(w.savedRun);expect(restored.snapshot().basicAttack).toBe('slash');expect(restored.snapshot('p2').basicAttack).toBe('missile');
    expect(restored.stats.attackRange).toBe(5);expect(restored.statsFor('p2').attackRange).toBe(15);
    for(const p of restored.players.values())restored.command({type:'Attack',point:{x:p.hero.x+8,y:p.hero.y}},p.id);
    expect(restored.snapshot().swings.map(s=>s.sourceId)).toEqual(['hero']);expect(restored.projectiles.map(p=>p.sourceId)).toEqual(['p2']);
  });
  it('supports F2 presets and clears the form on exiting the test world',()=>{
    const p=new LocalTransport();p.send({type:'DevOpen'});const config=p.snapshot().developer!.draft;config.perks=['missileAttack'];
    p.send({type:'DevConfigure',config});p.send({type:'DevApply'});expect(p.snapshot().basicAttack).toBe('missile');
    p.send({type:'DevRestart'});expect(p.snapshot().basicAttack).toBe('missile');p.send({type:'DevExit'});expect(p.snapshot().basicAttack).toBe('slash');expect(p.snapshot().stats.attackRange).toBe(5);
  });
});
