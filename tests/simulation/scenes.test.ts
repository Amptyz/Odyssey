import {describe,it,expect} from 'vitest';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {CAMP,JOURNEYS,campMap} from '../../EmberDemo/assets/scripts/ember/content/scenes';
import {parseRunCheckpoint} from '../../EmberDemo/assets/scripts/ember/simulation/RunCheckpoint';
import {validRoomCommand} from '../../EmberDemo/assets/scripts/ember/platform/room-protocol';
import {applyStatus} from '../../EmberDemo/assets/scripts/ember/combat-core/StatusSystem';
import {distance,type Vec2} from '../../EmberDemo/assets/scripts/ember/utils/math';
import {departFixture,interactFixture,startCombatFixture} from '../helpers/scenes';
function walk(w:GameWorld,at:Vec2,id='hero'){
 w.command({type:'MoveTo',point:at},id);for(let i=0;i<600&&distance(w.players.get(id)!.hero,at)>.08;i++)w.advance(1/30);
 expect(distance(w.players.get(id)!.hero,at)).toBeLessThan(.1);
}
function claim(w:GameWorld,id='hero'){
 w.command({type:'Interact'},id);const choice=w.snapshot(id).choices[0]!;expect(choice).toBeDefined();w.command({type:'ChooseReward',choiceId:choice.id},id);
 if(w.snapshot(id).pendingSkill)w.command({type:'ConfirmSkill',slot:'Q'},id);
}
function clear(w:GameWorld){for(const a of w.actors.values())if(a.team==='enemy')w.combat.damage({sourceId:'hero',targetId:a.id,amount:1e6,cause:'basic',damageType:'true'});w.advance(1/30);}
describe('traversable camp and explicit interactions',()=>{
 for(const map of ['ember','frost'] as const)it(`${map}: walks to central ember, chooses then walks to depart; no automatic shop`,()=>{
  const w=new GameWorld(1234,map);w.command({type:'Start'});expect(w.phase).toBe('camp');expect(w.wave).toBe(0);expect(w.actors.size).toBe(1);expect(w.nav.map.width).toBe(CAMP.width);
  w.command({type:'BuyEquipment',equipmentId:'sword'});w.command({type:'LeaveShop'});w.command({type:'ChooseReward',choiceId:'perk:burn'});w.command({type:'Interact'});
  expect(w.equipment.inventory.size).toBe(0);expect(w.choices).toEqual([]);expect(w.phase).toBe('camp');
  walk(w,CAMP.departure);w.command({type:'Interact'});expect(w.phase).toBe('camp');expect(w.snapshot().scene.prompt).toContain('初始余烬');
  walk(w,CAMP.ember);claim(w);expect(w.players.get('hero')!.claimed).toEqual(['camp:0:ember']);expect(w.snapshot().phase).toBe('camp');
  walk(w,CAMP.departure);expect(w.wave).toBe(0);w.command({type:'Interact'});expect(w.phase).toBe('fighting');expect(w.wave).toBe(1);expect(w.nav.map.width).toBe(w.map.width);
  expect(w.hero.path).toEqual([]);expect(w.snapshot().destination).toBeUndefined();expect(w.snapshot().scene.interactions).toEqual([]);
 });
 it('keeps local panels independent and requires the current host plus everyone physically inside',()=>{
  const w=new GameWorld();w.addPlayer('p2');w.command({type:'Start'});walk(w,CAMP.ember);w.command({type:'Interact'});
  expect(w.snapshot().phase).toBe('reward');expect(w.snapshot('p2').phase).toBe('camp');const before={x:w.hero.x,y:w.hero.y};
  w.command({type:'DirectInput',movement:{x:1,y:0}});walk(w,CAMP.ember,'p2');expect({x:w.hero.x,y:w.hero.y}).toEqual(before);claim(w,'p2');
  const c=w.choices[0]!;w.command({type:'ChooseReward',choiceId:c.id});if(w.pendingSkill)w.command({type:'ConfirmSkill',slot:'Q'});
  walk(w,CAMP.departure);w.command({type:'Interact'});expect(w.wave).toBe(0);
  walk(w,CAMP.departure,'p2');w.command({type:'Interact'},'p2');expect(w.wave).toBe(0);
  w.command({type:'DirectInput',movement:{x:1,y:0}},'p2');for(let i=0;i<30;i++)w.advance(1/30);w.command({type:'Stop'},'p2');
  w.command({type:'Interact'});expect(w.wave).toBe(0);walk(w,CAMP.departure,'p2');w.command({type:'Interact'});expect(w.wave).toBe(1);
 });
 it('does not reroll closed offers or duplicate claims across checkpoint recovery',()=>{
  const w=new GameWorld();w.command({type:'Start'});walk(w,CAMP.ember);w.command({type:'Interact'});const offers=w.snapshot().choices;
  const c=offers.find(c=>c.kind==='skill')!;w.command({type:'ChooseReward',choiceId:c.id});w.command({type:'CloseInteraction'});
  let resumed=GameWorld.resume(w.savedRun);resumed.command({type:'Interact'});expect(resumed.choices).toEqual(offers);expect(resumed.pendingSkill).toBeDefined();
  resumed.command({type:'CancelSkill'});resumed.command({type:'ChooseReward',choiceId:offers.find(c=>c.kind==='perk')!.id});const perks=resumed.snapshot().perks;
  resumed=GameWorld.resume(resumed.savedRun);resumed.command({type:'Interact'});resumed.command({type:'ChooseReward',choiceId:offers[0]!.id});expect(resumed.snapshot().perks).toEqual(perks);expect(resumed.snapshot().phase).toBe('camp');
  expect(resumed.snapshot().scene.interactions.find(n=>n.kind==='ember')!.claimed).toBe(true);
 });
 it('clears once without auto modal; configured rests and optional clear embers preserve progress',()=>{
  const w=new GameWorld();startCombatFixture(w);
  for(let wave=1;wave<=5;wave++){
   const gold=w.equipment.gold;clear(w);expect(w.phase).toBe('cleared');expect(w.snapshot().phase).toBe('cleared');expect(w.choices).toHaveLength(0);expect(w.equipment.gold).toBeGreaterThan(gold);
   const restored=GameWorld.resume(w.savedRun);expect(restored.phase).toBe('cleared');expect(restored.snapshot().units.every(u=>u.team==='hero')).toBe(true);restored.advance(.25);expect(restored.equipment.gold).toBe(w.equipment.gold);
   expect(w.snapshot().scene.interactions.some(n=>n.kind==='ember')).toBe(JOURNEYS.ember.clearEmbers.includes(wave));departFixture(w);
   if(wave===2||wave===4){
    expect(w.phase).toBe('camp');expect(w.snapshot().scene.interactions.some(n=>n.kind==='ember')).toBe(wave===2);
    interactFixture(w,'merchant');const t=w.time;w.command({type:'BuyEquipment',equipmentId:wave===2?'sword':'staff'});expect(w.equipment.inventory.has(wave===2?'sword':'staff')).toBe(true);
    w.advance(.1);expect(w.time).toBeGreaterThan(t);w.command({type:'CloseInteraction'});expect(w.phase).toBe('camp');expect(w.wave).toBe(wave);
    departFixture(w);
   }
  }
  expect(w.phase).toBe('victory');expect(GameWorld.resume(w.savedRun).phase).toBe('victory');
 });
 it('retains an unclaimed rest offer when visiting the merchant and reconnecting',()=>{
  const w=new GameWorld();startCombatFixture(w,2);clear(w);departFixture(w);interactFixture(w,'ember');const choices=w.snapshot().choices;
  w.command({type:'CloseInteraction'});interactFixture(w,'merchant');w.command({type:'BuyEquipment',equipmentId:'bow'});w.command({type:'CloseInteraction'});
  const restored=GameWorld.resume(w.savedRun);interactFixture(restored,'ember');expect(restored.choices).toEqual(choices);expect(restored.equipment.equipped.slot1).toBe('bow');
 });
 it('cleans temporary combat effects on clear so survivors and revived allies can gather',()=>{
  const w=new GameWorld();w.addPlayer('p2');startCombatFixture(w);const ally=w.players.get('p2')!.hero;
  const baseMax=w.hero.maxHp;w.hero.hp=100;
  applyStatus(w.hero,{id:'slow',duration:30,power:0},'enemy');
  applyStatus(w.hero,{id:'burn',duration:30,power:5},'enemy');
  w.combat.applyAttributeEffect('hero',{sourceId:'temporary:test',modifiers:[{stat:'maxHealth',operation:'flat',value:100}]},30);
  w.combat.applyCombatEffect('hero',{sourceId:'enemy',instanceId:'wound',remaining:30,grievousWounds:.5});
  w.combat.shield('hero','hero',20,30,'test');
  w.combat.damage({sourceId:'enemy',targetId:'p2',amount:1e6,cause:'basic',damageType:'true'});expect(ally.alive).toBe(false);
  clear(w);expect(w.phase).toBe('cleared');expect(w.hero.maxHp).toBe(baseMax);expect(w.hero.hp).toBe(100);
  expect(w.hero.statuses).toEqual([]);expect(w.hero.attributeEffects).toEqual([]);expect(w.hero.combatEffects).toEqual([]);expect(w.hero.shield).toBe(0);
  expect(ally.alive).toBe(true);expect(ally.hp).toBeCloseTo(ally.maxHp*.3);expect(w.snapshot().scene.requiredIds).toEqual(['hero','p2']);
  const at={x:w.hero.x+1,y:w.hero.y};walk(w,at);w.advance(2);expect(w.hero.hp).toBe(100);
  const restored=GameWorld.resume(w.savedRun);expect(restored.hero.maxHp).toBe(w.hero.maxHp);expect(restored.hero.hp).toBe(w.hero.hp);
 });
 it('rejects stale/forged panels and claim records; snapshot mutations cannot alter readiness or claims',()=>{
  const w=new GameWorld();w.command({type:'Start'});const save=w.savedRun!;
  for(const patch of [{claimed:['camp:99:ember']},{claimed:['camp:0:ember','camp:0:ember']},{panel:'shop',interactionId:'camp:0:merchant'},{panel:'reward',interactionId:'camp:0:ember'}]){const copy=structuredClone(save);Object.assign(copy.players[0]!,patch);expect(()=>parseRunCheckpoint(copy)).toThrow();}
  const snapshot=w.snapshot();snapshot.scene.interactions[0]!.x=-100;snapshot.scene.insideIds.push('hero');expect(w.snapshot().scene.canDepart).toBe(false);expect(w.snapshot().scene.interactions[0]!.x).toBe(CAMP.ember.x);
  expect(validRoomCommand({type:'Interact'})).toBe(true);expect(validRoomCommand({type:'SetHost',hostId:'p2'})).toBe(false);
  expect(campMap('ember').obstacles).not.toBe(w.map.obstacles);
 });
 it('honors recovered host identity and offline exclusion without automatically departing',()=>{
  const w=new GameWorld();w.addPlayer('p2');w.command({type:'Start'});walk(w,CAMP.ember,'p2');claim(w,'p2');
  const restored=GameWorld.resume(w.savedRun);restored.hostId='p2';restored.setPlayerActive('hero',false);walk(restored,CAMP.departure,'p2');expect(restored.wave).toBe(0);restored.command({type:'Interact'},'p2');expect(restored.wave).toBe(1);
 });
});

it('validates and explicitly applies F2 camp/rest entry without changing ordinary starts',async()=>{
 const {LocalTransport}=await import('../../EmberDemo/assets/scripts/ember/platform/LocalTransport');const p=new LocalTransport();p.send({type:'DevOpen'});const config=p.snapshot().developer!.draft;
 p.send({type:'DevConfigure',config:{...config,entry:'camp',wave:2}});expect(p.snapshot().developer!.notice).toContain('没有休息点');
 p.send({type:'DevConfigure',config:{...config,entry:'camp',wave:3}});p.send({type:'DevApply'});expect(p.snapshot().phase).toBe('camp');expect(p.snapshot().wave).toBe(2);expect(p.snapshot().scene.interactions.map(n=>n.kind)).toEqual(['ember','merchant','departure']);
 p.send({type:'DevExit'});p.send({type:'Start'});expect(p.snapshot().phase).toBe('camp');expect(p.snapshot().wave).toBe(0);expect(p.snapshot().scene.interactions.map(n=>n.kind)).toEqual(['ember','departure']);
});
