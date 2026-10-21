import {describe,it,expect} from 'vitest';
import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {parseRunCheckpoint} from '../EmberDemo/assets/scripts/ember/simulation/RunCheckpoint';
import {captureDeveloperConfig,parseDeveloperConfig} from '../EmberDemo/assets/scripts/ember/simulation/DeveloperConfig';
import {parseSoloRun} from '../EmberDemo/assets/scripts/ember/platform/RunSaveStorage';
import {ROOM_VERSION} from '../EmberDemo/assets/scripts/ember/platform/room-protocol';
import {openMerchantFixture} from './helpers/scenes';

describe('whole hero save migration',()=>{
 it('migrates v4 solo and multiplayer ownership without changing stats or making appearances authoritative',()=>{
  const w=new GameWorld();w.addPlayer('ally');openMerchantFixture(w);w.equipment.gold=1000;
  for(const equipmentId of ['staff','bow','plate','robe','helm','circlet'] as const)w.command({type:'BuyEquipment',equipmentId});
  const legacy=JSON.parse(JSON.stringify(w.savedRun));legacy.version=4;
  legacy.players[0].purchaseOrder=['staff','bow','plate','robe','helm','circlet'];legacy.players[0].appearance={weapon:'bow'};
  legacy.players[1].purchaseOrder=[];
  const migrated=parseRunCheckpoint(legacy),resumed=GameWorld.resume(migrated),snapshot=resumed.snapshot();
  expect(migrated.version).toBe(5);expect(migrated.players[0]!.inventory).toEqual(legacy.players[0].inventory);
  expect(snapshot.stats).toEqual(w.snapshot().stats);expect(snapshot.equipment).toEqual(w.snapshot().equipment);
  expect(snapshot.gold).toBe(w.equipment.gold);expect(resumed.players.get('ally')!.equipment.inventory.size).toBe(0);
  expect(JSON.stringify(migrated)).not.toMatch(/purchaseOrder|appearance/);
  expect(JSON.stringify(snapshot.party)).not.toMatch(/purchaseOrder|appearance/);
  expect(()=>parseSoloRun(legacy)).toThrow('多人存档');
  const solo={...legacy,players:[legacy.players[0]]};expect(parseSoloRun({format:'ember-solo-save',version:1,savedAt:0,checkpoint:solo}).checkpoint).toEqual({...migrated,players:[migrated.players[0]]});
  expect(ROOM_VERSION).toBe('ember-coop-9');
 });
 it('loads older developer presets while dropping visual fields and still validates item IDs',()=>{
  const w=new GameWorld(),base=captureDeveloperConfig(w.snapshot());
  const legacy={...base,equipment:{slot1:'bow'},purchaseOrder:['bow'],appearance:{weapon:'bow'}};
  const config=parseDeveloperConfig(legacy);expect(config.equipment).toEqual({slot1:'bow'});
  expect(config).not.toHaveProperty('purchaseOrder');expect(config).not.toHaveProperty('appearance');
  expect(()=>parseDeveloperConfig({...legacy,equipment:{slot1:'not-an-item'}})).toThrow();
 });
});
