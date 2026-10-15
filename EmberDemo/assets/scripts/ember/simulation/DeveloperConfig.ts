import { MAPS,mapDefinition,type MapId } from '../content/maps';
import { HERO_SKILLS,SKILL_SLOTS,type Loadout } from '../content/skills';
import { PERKS } from '../content/perks';
import { EQUIPMENT_SLOTS,SHOP_CATALOG,equipment,type EquipmentId,type EquipmentLoadout } from '../content/equipment';
import type { PerkId } from '../combat-core/types';
import type { WorldSnapshot } from './GameWorld';
export const DEV_SPEEDS=[.25,.5,1,2] as const;
export interface DeveloperOptions {invincible:boolean;noCooldown:boolean;freezeEnemies:boolean;speed:typeof DEV_SPEEDS[number]}
export interface DeveloperConfig {version:1;seed:number;mapId:MapId;wave:number;loadout:Loadout;perks:PerkId[];equipment:EquipmentLoadout;options:DeveloperOptions}
export interface DeveloperSnapshot {enabled:boolean;open:boolean;draft:DeveloperConfig;revision:number;notice:string}
export const DEFAULT_DEV_OPTIONS:DeveloperOptions={invincible:false,noCooldown:false,freezeEnemies:false,speed:1};
export function captureDeveloperConfig(s:WorldSnapshot,options=DEFAULT_DEV_OPTIONS):DeveloperConfig {
  return{version:1,seed:s.seed,mapId:s.mapId,wave:Math.max(1,s.wave),loadout:{...s.loadout},perks:[...s.perks],equipment:{...s.equipment},options:{...options}};
}
export function cloneDeveloperConfig(c:DeveloperConfig):DeveloperConfig {return{...c,loadout:{...c.loadout},perks:[...c.perks],equipment:{...c.equipment},options:{...c.options}};}
/** Validate imported/persisted/command payloads atomically; never execute their contents. */
export function parseDeveloperConfig(input:unknown):DeveloperConfig {
  const c=(typeof input==='string'?JSON.parse(input):input) as Partial<DeveloperConfig>|null;
  if(!c||c.version!==1)throw Error('配置版本不支持，需要 version: 1。');
  if(!Number.isInteger(c.seed)||c.seed!<0||c.seed!>0xffffffff)throw Error('种子必须是 0–4294967295 的整数。');
  if(typeof c.mapId!=='string'||!Object.prototype.hasOwnProperty.call(MAPS,c.mapId))throw Error('地图不存在。');
  if(!Number.isInteger(c.wave)||c.wave!<1||c.wave!>mapDefinition(c.mapId).waves.length)throw Error('波次超出当前地图范围。');
  if(!c.loadout||!SKILL_SLOTS.every(slot=>HERO_SKILLS.includes(c.loadout![slot]))||new Set(SKILL_SLOTS.map(s=>c.loadout![s])).size!==4)throw Error('四个槽位必须是不同的玩家技能。');
  if(!Array.isArray(c.perks)||c.perks.length>PERKS.length||new Set(c.perks).size!==c.perks.length||!c.perks.every(id=>PERKS.some(p=>p.id===id)))throw Error('增益包含重复或不存在的内容。');
  if(!c.equipment||typeof c.equipment!=='object'||Array.isArray(c.equipment))throw Error('装备配置无效。');
  for(const [slot,id] of Object.entries(c.equipment))if(!EQUIPMENT_SLOTS.includes(slot as typeof EQUIPMENT_SLOTS[number])||!SHOP_CATALOG.includes(id as EquipmentId)||equipment(id as EquipmentId).slot!==slot)throw Error('装备不存在或槽位不匹配。');
  const o=c.options;
  if(!o||typeof o.invincible!=='boolean'||typeof o.noCooldown!=='boolean'||typeof o.freezeEnemies!=='boolean'||!DEV_SPEEDS.includes(o.speed))throw Error('测试开关或时间倍率无效。');
  return{version:1,seed:c.seed!,mapId:c.mapId,wave:c.wave!,loadout:Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,c.loadout![slot]])) as Loadout,
    perks:PERKS.filter(p=>c.perks!.includes(p.id)).map(p=>p.id),equipment:{...c.equipment},options:{invincible:o.invincible,noCooldown:o.noCooldown,freezeEnemies:o.freezeEnemies,speed:o.speed}};
}
export interface PresetStorage {getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
/** Explicit save/load only: persisted configs never silently enable cheats on startup. */
export function saveDeveloperPreset(storage:PresetStorage,slot:number,config:DeveloperConfig):void {
  if(!Number.isInteger(slot)||slot<1||slot>3)throw Error('预设槽位无效。');
  storage.setItem(`ember.developer.v1.${slot}`,JSON.stringify(parseDeveloperConfig(config)));
}
export function loadDeveloperPreset(storage:PresetStorage,slot:number):DeveloperConfig {
  if(!Number.isInteger(slot)||slot<1||slot>3)throw Error('预设槽位无效。');
  const value=storage.getItem(`ember.developer.v1.${slot}`);if(value===null)throw Error('这个槽位还没有保存配置。');return parseDeveloperConfig(value);
}
