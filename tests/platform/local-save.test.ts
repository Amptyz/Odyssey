import {describe,it,expect} from 'vitest';
import {LocalTransport} from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {parseSoloRun,SOLO_SAVE_KEY,MAX_SAVE_BYTES,type RunStorage} from '../../EmberDemo/assets/scripts/ember/platform/RunSaveStorage';
import {validRoomCommand} from '../../EmberDemo/assets/scripts/ember/platform/room-protocol';
import {captureDeveloperConfig} from '../../EmberDemo/assets/scripts/ember/simulation/DeveloperConfig';
import {DEFAULT_LOADOUT} from '../../EmberDemo/assets/scripts/ember/content/skills';
import {interactFixture,departFixture,openMerchantFixture} from '../helpers/scenes';

function fixture(seed=42){
 const values=new Map<string,string>();let writes=0;
 const storage:RunStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes++;values.set(key,value);}};
 const p=new LocalTransport(seed,storage);return{p,values,storage,writes:()=>writes};
}
function earnSkill(p:LocalTransport){
 interactFixture(p.world,'ember');p.send({type:'ChooseReward',choiceId:p.world.choices.find(c=>c.kind==='skill')!.id});
 p.send({type:'ConfirmSkill',slot:'E'});
}
describe('single-player durable saves',()=>{
 it('automatically saves new runs, exposes Continue on a fresh instance and requires explicit loading',()=>{
  const f=fixture();f.p.send({type:'SelectMap',mapId:'frost'});f.p.send({type:'Start'});
  expect(parseSoloRun(f.values.get(SOLO_SAVE_KEY)).checkpoint.mapId).toBe('frost');expect(f.writes()).toBe(1);
  for(let i=0;i<60;i++)f.p.advance(1/30);expect(f.writes()).toBe(1);
  const reload=new LocalTransport(1234,f.storage);expect(reload.snapshot().phase).toBe('ready');expect(reload.snapshot().localSave?.available).toBe(true);
  reload.send({type:'LoadRun'});expect(reload.snapshot().phase).toBe('camp');expect(reload.snapshot().seed).toBe(42);expect(reload.snapshot().mapId).toBe('frost');expect(reload.world.loadout).toEqual(DEFAULT_LOADOUT);
  reload.send({type:'Restart'});expect(reload.world.seed).toBe(42);expect(reload.seed).toBe(42);
 });
 it('preserves a pending skill reward, offer and exactly one claim across reloads',()=>{
  const f=fixture();f.p.send({type:'Start'});interactFixture(f.p.world,'ember');const choices=f.p.snapshot().choices;
  f.p.send({type:'ChooseReward',choiceId:choices.find(c=>c.kind==='skill')!.id});const skill=f.p.world.pendingSkill;
  const r=new LocalTransport(1,f.storage);r.send({type:'LoadRun'});expect(r.snapshot().choices).toEqual(choices);expect(r.snapshot().pendingSkill).toBe(skill);expect(r.world.loadout).toEqual(DEFAULT_LOADOUT);
  r.send({type:'ConfirmSkill',slot:'R'});expect(r.world.loadout).toEqual({...DEFAULT_LOADOUT,R:skill});
  const again=new LocalTransport(1,f.storage);again.send({type:'LoadRun'});expect(again.world.loadout.R).toBe(skill);expect(again.snapshot().scene.interactions.find(n=>n.kind==='ember')?.claimed).toBe(true);
 });
 it('saves battle starts rather than mid-fight kills, damage, paths or held inputs',()=>{
  const f=fixture();f.p.send({type:'Start'});earnSkill(f.p);departFixture(f.p.world);f.p.advance(0);
  const start=f.p.world.savedRun!,enemies=f.p.snapshot().units.filter(u=>u.team==='enemy').map(u=>u.id);
  f.p.send({type:'DirectInput',movement:{x:1,y:0}});for(let i=0;i<10;i++)f.p.advance(1/30);
  const enemy=f.p.world.actors.get(enemies[0]!)!;f.p.world.combat.damage({sourceId:'hero',targetId:enemy.id,amount:1e6,cause:'basic',damageType:'true'});
  f.p.send({type:'TogglePause'});f.p.send({type:'SaveRun'});expect(parseSoloRun(f.values.get(SOLO_SAVE_KEY)).checkpoint).toEqual(start);
  f.p.send({type:'LoadRun'});const s=f.p.snapshot();expect(s.phase).toBe('fighting');expect(s.paused).toBe(true);expect(s.time).toBe(start.time);expect(s.gold).toBe(start.players[0]!.gold);
  expect(s.hero.x).toBe(start.players[0]!.position.x);expect(s.units.filter(u=>u.team==='enemy').map(u=>u.id)).toEqual(enemies);expect(f.p.world.players.get('hero')!.direct).toBeUndefined();expect(s.loadout.E).toBe(start.players[0]!.loadout.E);
 });
 it('retains equipment, purchase order and safe-stage position, without duplicating currency',()=>{
  const f=fixture();openMerchantFixture(f.p.world);f.p.send({type:'BuyEquipment',equipmentId:'bow'});f.p.send({type:'LeaveShop'});
  Object.assign(f.p.world.hero,{x:11,y:10,previous:{x:11,y:10}});f.p.send({type:'SaveRun'});
  const r=new LocalTransport(7,f.storage);r.send({type:'LoadRun'});const s=r.snapshot();expect(s.equipment.slot1).toBe('bow');expect(s.purchaseOrder).toEqual(['bow']);expect(s.gold).toBe(60);expect(s.hero.x).toBe(11);expect(s.hero.y).toBe(10);
  r.send({type:'BuyEquipment',equipmentId:'bow'});expect(r.snapshot().gold).toBe(60);
 });
 it('keeps the saved run when returning to the menu and blocks loading into an unpaused run',()=>{
  const f=fixture();f.p.send({type:'Start'});earnSkill(f.p);const saved=f.values.get(SOLO_SAVE_KEY);
  f.p.send({type:'LoadRun'});expect(f.p.snapshot().localSave?.notice).toContain('暂停');expect(f.values.get(SOLO_SAVE_KEY)).toBe(saved);
  f.p.send({type:'Restart'});f.p.advance(.2);expect(f.p.snapshot().phase).toBe('ready');expect(f.values.get(SOLO_SAVE_KEY)).toBe(saved);
  f.p.send({type:'LoadRun'});expect(f.p.world.loadout.E).not.toBeNull();
 });
 it('does not store or load developer worlds and leaves the ordinary save intact',()=>{
  const f=fixture();f.p.send({type:'Start'});const saved=f.values.get(SOLO_SAVE_KEY);
  f.p.send({type:'DevOpen'});const config=captureDeveloperConfig(f.p.snapshot());config.options.invincible=true;
  f.p.send({type:'DevConfigure',config});f.p.send({type:'DevApply'});f.p.advance(.1);f.p.send({type:'SaveRun'});f.p.send({type:'LoadRun'});
  expect(f.values.get(SOLO_SAVE_KEY)).toBe(saved);expect(f.p.snapshot().developer?.enabled).toBe(true);expect(()=>f.p.exportRun()).toThrow();
  f.p.send({type:'DevExit'});f.p.send({type:'LoadRun'});expect(f.p.snapshot().developer).toBeUndefined();expect(f.p.snapshot().phase).toBe('camp');
 });
 it('exports files and imports validated checkpoints into a different fresh storage',()=>{
  const f=fixture();f.p.send({type:'Start'});earnSkill(f.p);const text=f.p.exportRun(),r=fixture(8);
  r.p.send({type:'LoadRun',data:text});expect(r.p.world.loadout).toEqual(f.p.world.loadout);expect(r.p.world.seed).toBe(42);expect(r.p.snapshot().localSave?.available).toBe(true);
  const raw=parseSoloRun(text).checkpoint;r.p.send({type:'TogglePause'});r.p.send({type:'LoadRun',data:{room:'ABC234',version:'ember-coop-6',checkpoint:raw}});expect(r.p.world.loadout).toEqual(f.p.world.loadout);
 });
 it('rejects malformed, oversized, incompatible and multiplayer files atomically',()=>{
  const f=fixture();f.p.send({type:'Start'});f.p.send({type:'TogglePause'});const saved=f.values.get(SOLO_SAVE_KEY),world=f.p.world,raw=parseSoloRun(saved!).checkpoint;
  const multi=new GameWorld();multi.addPlayer('p2');multi.saveLobby();
  for(const data of ['{bad',null,'x'.repeat(MAX_SAVE_BYTES+1),{format:'ember-solo-save',version:99,checkpoint:raw},{...raw,version:3},{...raw,players:[{...raw.players[0],loadout:{Q:null}}]},multi.savedRun]){
   f.p.send({type:'LoadRun',data});expect(f.p.world).toBe(world);expect(f.values.get(SOLO_SAVE_KEY)).toBe(saved);expect(f.p.snapshot().localSave?.notice).toContain('读取失败');
  }
  expect(validRoomCommand({type:'SaveRun'})).toBe(false);expect(validRoomCommand({type:'LoadRun',data:raw})).toBe(false);
 });
 it('reports corrupt or missing browser data without mutating the current world or silently starting a new run',()=>{
  const f=fixture();f.values.set(SOLO_SAVE_KEY,'invalid');const r=new LocalTransport(1,f.storage),before=r.world;
  expect(r.snapshot().localSave?.available).toBe(false);r.send({type:'LoadRun'});expect(r.world).toBe(before);expect(f.values.get(SOLO_SAVE_KEY)).toBe('invalid');
  f.values.clear();r.send({type:'LoadRun'});expect(r.world).toBe(before);expect(r.snapshot().localSave?.notice).toContain('暂无');
 });
 it('reports storage failure, preserves the last good file and still supports file export and reading',()=>{
  const f=fixture();f.p.send({type:'Start'});const old=f.values.get(SOLO_SAVE_KEY),file=f.p.exportRun();
  const broken:RunStorage={getItem:f.storage.getItem,setItem:()=>{throw Error('QuotaExceededError');}},r=new LocalTransport(99,broken);
  r.send({type:'Start'});expect(r.snapshot().localSave?.notice).toContain('保存失败');expect(f.values.get(SOLO_SAVE_KEY)).toBe(old);expect(parseSoloRun(r.exportRun()).checkpoint.seed).toBe(99);
  r.send({type:'TogglePause'});r.send({type:'LoadRun',data:file});expect(r.world.seed).toBe(42);expect(r.snapshot().localSave?.notice).toContain('本地保存失败');expect(f.values.get(SOLO_SAVE_KEY)).toBe(old);
  const denied=new LocalTransport(1,{getItem:()=>{throw Error('SecurityError');},setItem:()=>{throw Error('SecurityError');}});expect(denied.snapshot().localSave?.notice).toContain('不可读取');
 });
});
