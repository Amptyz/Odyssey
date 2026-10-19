import {describe,it,expect} from 'vitest';
import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {LocalTransport} from '../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import {DEFAULT_LOADOUT,DEVELOPER_LOADOUT,SKILL_SLOTS,HERO_SKILLS} from '../EmberDemo/assets/scripts/ember/content/skills';
import {parseDeveloperConfig,captureDeveloperConfig} from '../EmberDemo/assets/scripts/ember/simulation/DeveloperConfig';
import {parseRunCheckpoint} from '../EmberDemo/assets/scripts/ember/simulation/RunCheckpoint';
import {PERKS,LAB_PRESETS,type LabId} from '../EmberDemo/assets/scripts/ember/content/perks';
import {Random} from '../EmberDemo/assets/scripts/ember/utils/Random';
import {rewardChoices} from '../EmberDemo/assets/scripts/ember/simulation/RewardSystem';
import {interactFixture,departFixture} from './helpers/scenes';

describe('ordinary runs start with empty skill slots',()=>{
 it.each(['ember','frost'] as const)('%s menu and camp are empty, and empty hotkeys cannot cast default skills',map=>{
  const w=new GameWorld(1234,map);expect(w.snapshot().loadout).toEqual({Q:null,W:null,E:null,R:null});w.command({type:'Start'});
  for(const slot of SKILL_SLOTS)w.command({type:'CastSlot',slot,point:{x:12,y:10}});
  w.command({type:'CastSkill',skillId:'fireball',point:{x:12,y:10}});w.advance(.2);
  expect(w.snapshot().loadout).toEqual(DEFAULT_LOADOUT);expect(w.snapshot().cooldowns).toEqual({Q:0,W:0,E:0,R:0});
  expect(w.projectiles).toHaveLength(0);expect(w.hero.action.id).toBe(0);
  interactFixture(w,'ember');w.command({type:'ChooseReward',choiceId:w.choices.find(c=>c.kind==='perk')!.id});departFixture(w);
  for(const slot of SKILL_SLOTS)w.command({type:'CastSlot',slot,point:{x:w.hero.x+4,y:w.hero.y}});
  w.command({type:'CastSkill',skillId:'fireball',point:{x:w.hero.x+4,y:w.hero.y}});
  expect(w.phase).toBe('fighting');expect(w.projectiles).toHaveLength(0);expect(w.hero.action.id).toBe(0);expect(w.snapshot().loadout).toEqual(DEFAULT_LOADOUT);
 });
 it.each(SKILL_SLOTS)('equips an earned skill into %s without populating other empty slots',slot=>{
  const w=new GameWorld();w.command({type:'Start'});interactFixture(w,'ember');const choice=w.choices.find(c=>c.kind==='skill')!;
  if(choice.kind!=='skill')throw Error('Missing active skill');w.command({type:'ChooseReward',choiceId:choice.id});expect(w.loadout).toEqual(DEFAULT_LOADOUT);
  w.command({type:'ConfirmSkill',slot});expect(w.loadout).toEqual({...DEFAULT_LOADOUT,[slot]:choice.skillId});
  departFixture(w);w.command({type:'CastSlot',slot,point:{x:w.hero.x+4,y:w.hero.y}});expect(w.cooldowns[choice.skillId]).toBeGreaterThan(0);
 });
 it.each(Object.keys(LAB_PRESETS) as LabId[])('%s lab grants only its explicit augments and starts all players with empty skills',lab=>{
  const w=new GameWorld();w.addPlayer('p2');w.command({type:'Start',lab});
  for(const p of w.players.values()){expect(p.loadout).toEqual(DEFAULT_LOADOUT);expect([...w.combat.perksFor(p.id)]).toEqual(LAB_PRESETS[lab]);}
 });
 it('filters skill-dependent augments without excluding any unowned active skill',()=>{
  const offered=new Set<string>();
  for(let seed=0;seed<100;seed++)for(const c of rewardChoices(new Random(seed),DEFAULT_LOADOUT,new Set())){
   if(c.kind==='skill')offered.add(c.skillId);
   else{const p=PERKS.find(p=>p.id===c.perkId)!;expect('requiresSkillTags' in p||'requiresSkillGroups' in p).toBe(false);}
  }
  expect(offered.size).toBe(HERO_SKILLS.length);
 });
 it('preserves empty and occupied slots in JSON checkpoints and restores legacy complete builds',()=>{
  const w=new GameWorld();w.command({type:'Start'});interactFixture(w,'ember');const c=w.choices.find(c=>c.kind==='skill')!;
  w.command({type:'ChooseReward',choiceId:c.id});w.command({type:'ConfirmSkill',slot:'W'});
  const saved=JSON.parse(JSON.stringify(w.savedRun)),restored=GameWorld.resume(saved);expect(restored.loadout).toEqual(w.loadout);expect(restored.loadout.Q).toBeNull();
  saved.players[0].loadout={...DEVELOPER_LOADOUT};expect(parseRunCheckpoint(saved).players[0]!.loadout).toEqual(DEVELOPER_LOADOUT);
 });
 it('starts teammates empty independently and does not grant defaults on restart',()=>{
  const w=new GameWorld();w.addPlayer('p2');expect(w.players.get('p2')!.loadout).toEqual(DEFAULT_LOADOUT);
  w.command({type:'Start'});interactFixture(w,'ember','p2');const c=w.players.get('p2')!.choices.find(c=>c.kind==='skill')!;
  w.command({type:'ChooseReward',choiceId:c.id},'p2');w.command({type:'ConfirmSkill',slot:'E'},'p2');expect(w.loadout).toEqual(DEFAULT_LOADOUT);
  const p=new LocalTransport();p.send({type:'Start'});p.send({type:'Restart'});expect(p.snapshot().loadout).toEqual(DEFAULT_LOADOUT);
 });
 it('accepts repeated null slots but rejects duplicates, missing slots and enemy skills in developer builds',()=>{
  const base=captureDeveloperConfig(new GameWorld().snapshot());expect(parseDeveloperConfig(base).loadout).toEqual(DEFAULT_LOADOUT);
  expect(parseDeveloperConfig({...base,loadout:{...DEVELOPER_LOADOUT}}).loadout).toEqual(DEVELOPER_LOADOUT);
  expect(()=>parseDeveloperConfig({...base,loadout:{...DEFAULT_LOADOUT,Q:'shield',W:'shield'}})).toThrow();
  expect(()=>parseDeveloperConfig({...base,loadout:{Q:null}})).toThrow();expect(()=>parseDeveloperConfig({...base,loadout:{...DEFAULT_LOADOUT,Q:'mistBolt'}})).toThrow();
 });
});
