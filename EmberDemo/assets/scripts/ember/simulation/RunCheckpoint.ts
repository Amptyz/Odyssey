import {AttributeSet,PLAYER_TEMPLATE,type AttributeSource} from '../combat-core/attributes/AttributeSet';
import { mapDefinition,type MapId } from '../content/maps';
import { HERO_SKILLS,type Loadout,type SkillId } from '../content/skills';
import { PERKS } from '../content/perks';
import { SHOP_CATALOG,type EquipmentId,type EquipmentLoadout } from '../content/equipment';
import type { PerkId } from '../combat-core/types';
import type { Vec2 } from '../utils/math';
import type { RewardChoice } from './RewardSystem';
import { parseDeveloperConfig,DEFAULT_DEV_OPTIONS } from './DeveloperConfig';

export interface SavedPlayer {
  id:string;loadout:Loadout;perks:PerkId[];gold:number;inventory:EquipmentId[];equipment:EquipmentLoadout;purchaseOrder:EquipmentId[];
  attributeSources:AttributeSource[];hp:number;mana:number;position:Vec2;facing:Vec2;choices:RewardChoice[];pendingSkill?:SkillId;ready:boolean;
}
/** Stable boundaries only. A fighting save represents the START of that wave. */
export interface RunCheckpoint {
  version:3;seed:number;mapId:MapId;wave:number;phase:'ready'|'shop'|'reward'|'fighting'|'victory';
  time:number;tick:number;kills:number;random:number;combatRandom:number;spawnRandom:number;serial:number;spawnSerial:number;
  players:SavedPlayer[];
}
export function detached<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
export function parseRunCheckpoint(value:unknown):RunCheckpoint {
  const c=value as RunCheckpoint;
  if(!c||c.version!==3||!['ready','shop','reward','fighting','victory'].includes(c.phase)||!Array.isArray(c.players)||c.players.length<1||c.players.length>4)throw Error('存档版本或队伍无效');
  const integer=(n:number,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
  if(![c.seed,c.random,c.combatRandom,c.spawnRandom,c.serial,c.spawnSerial,c.tick,c.kills].every(n=>integer(n))||!Number.isFinite(c.time)||c.time<0)throw Error('存档时间或随机状态无效');
  const ids=new Set<string>(),players:SavedPlayer[]=[];
  for(const p of c.players){
    if(!p||typeof p.id!=='string'||!/^([a-zA-Z0-9_-]){1,48}$/.test(p.id)||ids.has(p.id))throw Error('存档玩家身份无效');ids.add(p.id);
    if(!Array.isArray(p.attributeSources)||p.attributeSources.length>128||new Set(p.attributeSources.map(s=>s.sourceId)).size!==p.attributeSources.length)throw Error('存档属性来源无效');const validator=new AttributeSet(PLAYER_TEMPLATE);for(const source of p.attributeSources){if(!source||typeof source.sourceId!=='string'||source.sourceId.startsWith('equipment:')||source.sourceId.startsWith('perk:')||source.sourceId.startsWith('temporary:')||source.sourceId==='developer'||!Array.isArray(source.modifiers)||source.modifiers.length>64)throw Error('存档属性来源无效');validator.upsert(source);}
    const build=parseDeveloperConfig({version:2,seed:c.seed,mapId:c.mapId,wave:Math.max(1,c.wave),loadout:p.loadout,perks:p.perks,equipment:p.equipment,purchaseOrder:p.purchaseOrder,options:DEFAULT_DEV_OPTIONS});
    if(!integer(c.wave,mapDefinition(c.mapId).waves.length)||(c.phase==='ready'&&c.wave!==0)||(['fighting','reward','victory'].includes(c.phase)&&c.wave===0))throw Error('存档波次无效');
    if(!integer(p.gold,10000000)||!Number.isFinite(p.mana)||p.mana<0||p.mana>1000000||!Number.isFinite(p.hp)||p.hp<0||p.hp>1000000||typeof p.ready!=='boolean')throw Error('存档玩家数值无效');
    if(!Array.isArray(p.inventory)||p.inventory.length>SHOP_CATALOG.length||new Set(p.inventory).size!==p.inventory.length||!p.inventory.every(id=>SHOP_CATALOG.includes(id))||!Object.values(p.equipment).every(id=>p.inventory.includes(id)))throw Error('存档背包无效');
    if(build.purchaseOrder.length!==p.inventory.length||!build.purchaseOrder.every(id=>p.inventory.includes(id)))throw Error('存档购买顺序与背包不一致');
    const map=mapDefinition(c.mapId);
    if(!p.position||!p.facing||![p.position.x,p.position.y,p.facing.x,p.facing.y].every(Number.isFinite)||p.position.x<0||p.position.x>map.width||p.position.y<0||p.position.y>map.height)throw Error('存档位置无效');
    if(!Array.isArray(p.choices)||p.choices.length>3||!p.choices.every(choice=>choice&&(choice.kind==='perk'?PERKS.some(def=>def.id===choice.perkId)&&choice.id===`perk:${choice.perkId}`:choice.kind==='skill'&&HERO_SKILLS.includes(choice.skillId)&&choice.id===`skill:${choice.skillId}`)))throw Error('存档奖励无效');
    if(p.pendingSkill!==undefined&&(!HERO_SKILLS.includes(p.pendingSkill)||!p.choices.some(choice=>choice.kind==='skill'&&choice.skillId===p.pendingSkill)))throw Error('存档待选技能无效');
    players.push({id:p.id,loadout:build.loadout,perks:build.perks,gold:p.gold,inventory:[...p.inventory],equipment:build.equipment,purchaseOrder:build.purchaseOrder,attributeSources:validator.exportSources(),hp:p.hp,mana:p.mana,
      position:{x:p.position.x,y:p.position.y},facing:{x:p.facing.x,y:p.facing.y},ready:p.ready,pendingSkill:p.pendingSkill,
      choices:p.choices.map(choice=>choice.kind==='perk'?{id:choice.id,kind:'perk',perkId:choice.perkId}:{id:choice.id,kind:'skill',skillId:choice.skillId})});
  }
  if(!ids.has('hero'))throw Error('存档缺少初始玩家');
  return {version:3,seed:c.seed,mapId:c.mapId,wave:c.wave,phase:c.phase,time:c.time,tick:c.tick,kills:c.kills,random:c.random,
    combatRandom:c.combatRandom,spawnRandom:c.spawnRandom,serial:c.serial,spawnSerial:c.spawnSerial,players};
}
