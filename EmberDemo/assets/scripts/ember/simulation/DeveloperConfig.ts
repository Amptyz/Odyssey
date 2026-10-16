import {STAT_KEYS,validModifier,type Modifier} from '../combat-core/attributes/AttributeSet';
import { MAPS,mapDefinition,type MapId } from '../content/maps';
import { HERO_SKILLS,SKILL_SLOTS,type Loadout } from '../content/skills';
import { PERKS } from '../content/perks';
import { EQUIPMENT_SLOTS,SHOP_CATALOG,type EquipmentId,type EquipmentLoadout } from '../content/equipment';
import type { PerkId } from '../combat-core/types';
import type { WorldSnapshot } from './GameWorld';
export const DEV_SPEEDS=[.25,.5,1,2] as const;
export interface DeveloperOptions {invincible:boolean;noCooldown:boolean;freezeEnemies:boolean;speed:typeof DEV_SPEEDS[number]}
export interface DeveloperConfig {version:2;seed:number;mapId:MapId;wave:number;loadout:Loadout;perks:PerkId[];equipment:EquipmentLoadout;purchaseOrder:EquipmentId[];options:DeveloperOptions;attributeModifiers?:Modifier[];attributeTarget?:'players'|'enemies'|'all'}
export interface DeveloperSnapshot {enabled:boolean;open:boolean;draft:DeveloperConfig;revision:number;notice:string}
export const DEFAULT_DEV_OPTIONS:DeveloperOptions={invincible:false,noCooldown:false,freezeEnemies:false,speed:1};
export function captureDeveloperConfig(s:WorldSnapshot,options=DEFAULT_DEV_OPTIONS):DeveloperConfig {
  return{version:2,seed:s.seed,mapId:s.mapId,wave:Math.max(1,s.wave),loadout:{...s.loadout},perks:[...s.perks],equipment:{...s.equipment},purchaseOrder:[...s.purchaseOrder],options:{...options}};
}
export function cloneDeveloperConfig(c:DeveloperConfig):DeveloperConfig {return{...c,loadout:{...c.loadout},perks:[...c.perks],equipment:{...c.equipment},purchaseOrder:[...c.purchaseOrder!],options:{...c.options},attributeModifiers:c.attributeModifiers?.map(m=>({...m}))};}
/** Validate imported/persisted/command payloads atomically; never execute their contents. */
export function parseDeveloperConfig(input:unknown):DeveloperConfig {
  const c=(typeof input==='string'?JSON.parse(input):input) as Partial<DeveloperConfig>|null;
  if(!c||c.version!==2)throw Error('配置版本不支持，需要 version: 2。');
  if(!Number.isInteger(c.seed)||c.seed!<0||c.seed!>0xffffffff)throw Error('种子必须是 0–4294967295 的整数。');
  if(typeof c.mapId!=='string'||!Object.prototype.hasOwnProperty.call(MAPS,c.mapId))throw Error('地图不存在。');
  if(!Number.isInteger(c.wave)||c.wave!<1||c.wave!>mapDefinition(c.mapId).waves.length)throw Error('波次超出当前地图范围。');
  if(!c.loadout||!SKILL_SLOTS.every(slot=>HERO_SKILLS.includes(c.loadout![slot]))||new Set(SKILL_SLOTS.map(s=>c.loadout![s])).size!==4)throw Error('四个槽位必须是不同的玩家技能。');
  if(!Array.isArray(c.perks)||c.perks.length>PERKS.length||new Set(c.perks).size!==c.perks.length||!c.perks.every(id=>PERKS.some(p=>p.id===id)))throw Error('增益包含重复或不存在的内容。');
  if(!c.equipment||typeof c.equipment!=='object'||Array.isArray(c.equipment))throw Error('装备配置无效。');
  for(const [slot,id] of Object.entries(c.equipment))if(!EQUIPMENT_SLOTS.includes(slot as typeof EQUIPMENT_SLOTS[number])||!SHOP_CATALOG.includes(id as EquipmentId))throw Error('装备或装备栏不存在。');
  if(new Set(Object.values(c.equipment)).size!==Object.values(c.equipment).length)throw Error('同一件装备不能占用多个栏位。');
  if(!Array.isArray(c.purchaseOrder)||new Set(c.purchaseOrder).size!==c.purchaseOrder.length||!c.purchaseOrder.every(id=>SHOP_CATALOG.includes(id))||!Object.values(c.equipment).every(id=>c.purchaseOrder!.includes(id)))throw Error('装备购买顺序无效或缺少已装备物品。');
  if(c.attributeModifiers!==undefined&&(!Array.isArray(c.attributeModifiers)||c.attributeModifiers.length>64||!c.attributeModifiers.every(m=>validModifier(m)&&Math.abs(m.value)<=100000)))throw Error('属性修正无效：最多64项，属性/运算有效且数值有限。');
  if(c.attributeTarget!==undefined&&!['players','enemies','all'].includes(c.attributeTarget))throw Error('属性目标无效。');
  const o=c.options;
  if(!o||typeof o.invincible!=='boolean'||typeof o.noCooldown!=='boolean'||typeof o.freezeEnemies!=='boolean'||!DEV_SPEEDS.includes(o.speed))throw Error('测试开关或时间倍率无效。');
  return{version:2,seed:c.seed!,mapId:c.mapId,wave:c.wave!,loadout:Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,c.loadout![slot]])) as Loadout,
    perks:PERKS.filter(p=>c.perks!.includes(p.id)).map(p=>p.id),equipment:{...c.equipment},purchaseOrder:[...c.purchaseOrder!],options:{invincible:o.invincible,noCooldown:o.noCooldown,freezeEnemies:o.freezeEnemies,speed:o.speed},attributeTarget:c.attributeTarget,attributeModifiers:c.attributeModifiers?.map(m=>({...m}))};
}
export interface PresetStorage {getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
/** Explicit save/load only: persisted configs never silently enable cheats on startup. */
export function saveDeveloperPreset(storage:PresetStorage,slot:number,config:DeveloperConfig):void {
  if(!Number.isInteger(slot)||slot<1||slot>3)throw Error('预设槽位无效。');
  storage.setItem(`ember.developer.v2.${slot}`,JSON.stringify(parseDeveloperConfig(config)));
}
export function loadDeveloperPreset(storage:PresetStorage,slot:number):DeveloperConfig {
  if(!Number.isInteger(slot)||slot<1||slot>3)throw Error('预设槽位无效。');
  const value=storage.getItem(`ember.developer.v2.${slot}`);if(value===null)throw Error('这个槽位还没有保存配置。');return parseDeveloperConfig(value);
}
