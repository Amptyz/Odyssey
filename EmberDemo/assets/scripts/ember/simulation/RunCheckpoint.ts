import {campMap,sceneInteractions,JOURNEYS} from '../content/scenes';
import {defaultHeroPalette,isHeroPaletteId,type HeroPaletteId} from '../content/hero-palettes';
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
  paletteId:HeroPaletteId;
  id:string;loadout:Loadout;perks:PerkId[];gold:number;inventory:EquipmentId[];equipment:EquipmentLoadout;
  attributeSources:AttributeSource[];hp:number;mana:number;position:Vec2;facing:Vec2;choices:RewardChoice[];pendingSkill?:SkillId;ready:boolean;panel?:'shop'|'reward';interactionId?:string;claimed:string[];
}
/** Stable boundaries only. A fighting save represents the START of that wave. */
export interface RunCheckpoint {
  version:5;seed:number;mapId:MapId;wave:number;phase:'ready'|'camp'|'cleared'|'fighting'|'victory';
  time:number;tick:number;kills:number;random:number;combatRandom:number;spawnRandom:number;serial:number;spawnSerial:number;
  players:SavedPlayer[];
}
export function detached<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
/** Version 4 ownership is migrated losslessly; obsolete appearance/purchase-order fields are discarded. */
export function parseRunCheckpoint(value:unknown):RunCheckpoint {
  const c=value as RunCheckpoint;
  if(!c||![4,5].includes(c.version)||!['ready','camp','cleared','fighting','victory'].includes(c.phase)||!Array.isArray(c.players)||c.players.length<1||c.players.length>4)throw Error('存档版本或队伍无效');
  const integer=(n:number,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
  if(![c.seed,c.random,c.combatRandom,c.spawnRandom,c.serial,c.spawnSerial,c.tick,c.kills].every(n=>integer(n))||!Number.isFinite(c.time)||c.time<0)throw Error('存档时间或随机状态无效');
  const ids=new Set<string>(),players:SavedPlayer[]=[];
  for(const p of c.players){
    if(p?.paletteId!==undefined&&!isHeroPaletteId(p.paletteId))throw Error('存档人物配色无效');
    if(!p||typeof p.id!=='string'||!/^([a-zA-Z0-9_-]){1,48}$/.test(p.id)||ids.has(p.id))throw Error('存档玩家身份无效');ids.add(p.id);
    if(!Array.isArray(p.attributeSources)||p.attributeSources.length>128||new Set(p.attributeSources.map(s=>s.sourceId)).size!==p.attributeSources.length)throw Error('存档属性来源无效');const validator=new AttributeSet(PLAYER_TEMPLATE);for(const source of p.attributeSources){if(!source||typeof source.sourceId!=='string'||source.sourceId.startsWith('equipment:')||source.sourceId.startsWith('perk:')||source.sourceId.startsWith('temporary:')||source.sourceId==='developer'||!Array.isArray(source.modifiers)||source.modifiers.length>64)throw Error('存档属性来源无效');validator.upsert(source);}
    const build=parseDeveloperConfig({version:2,seed:c.seed,mapId:c.mapId,wave:Math.max(1,c.wave),loadout:p.loadout,perks:p.perks,equipment:p.equipment,options:DEFAULT_DEV_OPTIONS});
    if(!integer(c.wave,mapDefinition(c.mapId).waves.length)||(c.phase==='ready'&&c.wave!==0)||(['fighting','cleared','victory'].includes(c.phase)&&c.wave===0))throw Error('存档波次无效');
    if(!integer(p.gold,10000000)||!Number.isFinite(p.mana)||p.mana<0||p.mana>1000000||!Number.isFinite(p.hp)||p.hp<0||p.hp>1000000||typeof p.ready!=='boolean')throw Error('存档玩家数值无效');
    if(!Array.isArray(p.inventory)||p.inventory.length>SHOP_CATALOG.length||new Set(p.inventory).size!==p.inventory.length||!p.inventory.every(id=>SHOP_CATALOG.includes(id))||!Object.values(p.equipment).every(id=>p.inventory.includes(id)))throw Error('存档背包无效');
    const map=c.phase==='camp'?campMap(c.mapId):mapDefinition(c.mapId);
    if(c.phase==='camp'&&c.wave!==0&&!JOURNEYS[c.mapId].rests[c.wave])throw Error('存档休息点无效');
    if(c.phase==='victory'&&c.wave!==map.waves.length)throw Error('存档通关关卡无效');
    const allowedClaims=Array.from({length:c.wave+1},(_,wave)=>[...sceneInteractions(c.mapId,wave,true,false),...(wave?sceneInteractions(c.mapId,wave,false,true):[])]).flat().filter(n=>n.kind==='ember').map(n=>n.id);
    if(!Array.isArray(p.claimed)||new Set(p.claimed).size!==p.claimed.length||!p.claimed.every(id=>allowedClaims.includes(id)))throw Error('存档余烬领取记录无效');
    const nodes=sceneInteractions(c.mapId,c.wave,c.phase==='camp',c.phase==='cleared'),current=nodes.find(n=>n.id===p.interactionId);
    if(p.panel!==undefined&&(!['shop','reward'].includes(p.panel)||!current||current.kind!==(p.panel==='shop'?'merchant':'ember')||p.claimed.includes(current.id)||Math.hypot(p.position?.x-current.x,p.position?.y-current.y)>current.radius))throw Error('存档交互面板无效');
    if(p.interactionId!==undefined&&!current)throw Error('存档交互对象无效');
    if(!p.position||!p.facing||![p.position.x,p.position.y,p.facing.x,p.facing.y].every(Number.isFinite)||p.position.x<0||p.position.x>map.width||p.position.y<0||p.position.y>map.height)throw Error('存档位置无效');
    if(!Array.isArray(p.choices)||p.choices.length>3||!p.choices.every(choice=>choice&&(choice.kind==='perk'?PERKS.some(def=>def.id===choice.perkId)&&choice.id===`perk:${choice.perkId}`:choice.kind==='skill'&&HERO_SKILLS.includes(choice.skillId)&&choice.id===`skill:${choice.skillId}`)))throw Error('存档奖励无效');
    if(p.panel==='reward'&&!p.choices.length)throw Error('存档余烬候选为空');
    if(p.choices.length&&(!nodes.some(n=>n.kind==='ember'&&!p.claimed.includes(n.id))))throw Error('存档余烬已领取或不存在');
    if(p.pendingSkill!==undefined&&(!HERO_SKILLS.includes(p.pendingSkill)||!p.choices.some(choice=>choice.kind==='skill'&&choice.skillId===p.pendingSkill)))throw Error('存档待选技能无效');
    players.push({id:p.id,paletteId:p.paletteId??defaultHeroPalette(players.length),loadout:build.loadout,perks:build.perks,gold:p.gold,inventory:[...p.inventory],equipment:build.equipment,attributeSources:validator.exportSources(),hp:p.hp,mana:p.mana,
      position:{x:p.position.x,y:p.position.y},facing:{x:p.facing.x,y:p.facing.y},ready:p.ready,pendingSkill:p.pendingSkill,panel:p.panel,interactionId:p.interactionId,claimed:[...p.claimed],
      choices:p.choices.map(choice=>choice.kind==='perk'?{id:choice.id,kind:'perk',perkId:choice.perkId}:{id:choice.id,kind:'skill',skillId:choice.skillId})});
  }
  if(!ids.has('hero'))throw Error('存档缺少初始玩家');
  return {version:5,seed:c.seed,mapId:c.mapId,wave:c.wave,phase:c.phase,time:c.time,tick:c.tick,kills:c.kills,random:c.random,
    combatRandom:c.combatRandom,spawnRandom:c.spawnRandom,serial:c.serial,spawnSerial:c.spawnSerial,players};
}
