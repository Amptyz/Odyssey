import {describe,it,expect} from 'vitest';
import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {LocalTransport} from '../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import {validRoomCommand} from '../EmberDemo/assets/scripts/ember/platform/room-protocol';
import {parseRunCheckpoint} from '../EmberDemo/assets/scripts/ember/simulation/RunCheckpoint';
import {interactFixture,departFixture} from './helpers/scenes';

describe('hero cosmetic palettes',()=>{
 it('changes only the sender, including paused play, without touching combat stats or equipment',()=>{
  const w=new GameWorld();w.addPlayer('ally');w.command({type:'Start'});w.paused=true;
  const before=w.snapshot();w.command({type:'SetHeroPalette',paletteId:'wine'},'ally');
  expect(w.snapshot().party?.map(p=>p.paletteId)).toEqual(['ash','wine']);
  expect(w.snapshot().hero).toEqual(before.hero);expect(w.snapshot().stats).toEqual(before.stats);
  expect(w.snapshot().equipment).toEqual(before.equipment);expect(w.tickCount).toBe(before.tick);
  const snapshot=w.snapshot();snapshot.party![1]!.paletteId='ochre';
  expect(w.players.get('ally')!.paletteId).toBe('wine');
  w.setPlayerActive('ally',false);w.command({type:'SetHeroPalette',paletteId:'frost'},'ally');
  expect(w.players.get('ally')!.paletteId).toBe('wine');
 });
 it('updates cosmetic recovery metadata during combat without committing a mid-wave state',()=>{
  const w=new GameWorld();w.command({type:'Start'});interactFixture(w,'ember');
  const choice=w.choices.find(c=>c.kind==='perk')!;w.command({type:'ChooseReward',choiceId:choice.id});departFixture(w);
  const boundary=w.savedRun!;w.command({type:'DirectInput',movement:{x:1,y:0}});w.advance(.2);w.hero.hp=7;
  w.command({type:'SetHeroPalette',paletteId:'frost'});
  const saved=w.savedRun!;expect(saved).toEqual({...boundary,players:boundary.players.map(p=>({...p,paletteId:'frost'}))});
  const restored=GameWorld.resume(saved);expect(restored.players.get('hero')!.paletteId).toBe('frost');
  expect(restored.hero.hp).toBe(boundary.players[0]!.hp);expect(restored.hero.hp).not.toBe(7);
 });
 it('migrates missing color fields and rejects unknown or inherited IDs at both boundaries',()=>{
  const w=new GameWorld();w.addPlayer('ally');w.saveLobby();
  const legacy=JSON.parse(JSON.stringify(w.savedRun));legacy.players.forEach((p:{paletteId?:string})=>delete p.paletteId);
  expect(parseRunCheckpoint(legacy).players.map(p=>p.paletteId)).toEqual(['ash','moss']);
  for(const paletteId of ['fake','constructor','__proto__',42,null]){
   expect(validRoomCommand({type:'SetHeroPalette',paletteId})).toBe(false);
   w.command({type:'SetHeroPalette',paletteId} as never);expect(w.players.get('hero')!.paletteId).toBe('ash');
   expect(()=>parseRunCheckpoint({...legacy,players:legacy.players.map((p:object)=>({...p,paletteId}))})).toThrow('配色');
  }
 });
 it('keeps local choice across map changes, restart, reload and restores the saved character color',()=>{
  const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
  const p=new LocalTransport(42,storage);p.send({type:'SetHeroPalette',paletteId:'violet'});p.send({type:'SelectMap',mapId:'frost'});
  expect(p.paletteId).toBe('violet');p.send({type:'Start'});p.send({type:'Restart'});expect(p.paletteId).toBe('violet');
  const reload=new LocalTransport(1,storage);expect(reload.paletteId).toBe('violet');reload.send({type:'SetHeroPalette',paletteId:'ochre'});
  reload.send({type:'LoadRun'});expect(reload.paletteId).toBe('violet');
 });
});
