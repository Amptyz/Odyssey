import { HERO } from './config';
import { BASIC_ATTACKS,type BasicAttackId,type BasicAttackDefinition } from './attacks';
export const EQUIPMENT_SLOTS=['weapon','body','head'] as const;
export type EquipmentSlot=typeof EQUIPMENT_SLOTS[number];
export const SLOT_NAMES:Record<EquipmentSlot,string>={weapon:'武器',body:'护甲',head:'头部'};
export interface HeroStats {maxHp:number;armor:number;attackDamage:number;attackRange:number;attackInterval:number;speed:number;skillPower:number;cooldownMultiplier:number}
export interface StatBonus {maxHp?:number;armor?:number;attackDamage?:number;attackRange?:number;attackSpeed?:number;speed?:number;skillPower?:number;haste?:number}
export interface EquipmentDefinition {name:string;slot:EquipmentSlot;price:number;description:string;stats:StatBonus;appearance:string;attack?:BasicAttackId}
export const EQUIPMENT={
  sword:{name:'赤铜长剑',slot:'weapon',price:100,description:'扇形挥斩；普攻伤害 +16，护甲 +8',stats:{attackDamage:16,armor:8},appearance:'copperSword',attack:'sword'},
  staff:{name:'星辉法杖',slot:'weapon',price:100,description:'魔法弹，射程 +4；技能威力 +45%，急速 +15%',stats:{attackRange:4,skillPower:0.45,haste:0.15},appearance:'starStaff',attack:'staff'},
  bow:{name:'猎风长弓',slot:'weapon',price:100,description:'发射箭矢；射程 +5，攻速 +30%，伤害 +6',stats:{attackRange:5,attackSpeed:0.3,attackDamage:6},appearance:'windBow',attack:'bow'},
  bulwark:{name:'壁垒重盾',slot:'weapon',price:100,description:'近身盾击；护甲 +40，最大生命 +60',stats:{armor:40,maxHp:60},appearance:'towerShield',attack:'shield'},
  plate:{name:'赤铜胸甲',slot:'body',price:60,description:'护甲 +25，最大生命 +60',stats:{armor:25,maxHp:60},appearance:'copperPlate'},
  robe:{name:'星纹法袍',slot:'body',price:60,description:'技能与效果威力 +25%，最大生命 +20',stats:{skillPower:0.25,maxHp:20},appearance:'starRobe'},
  leather:{name:'游侠皮衣',slot:'body',price:60,description:'攻速 +20%，移动速度 +10%',stats:{attackSpeed:0.2,speed:0.1},appearance:'rangerLeather'},
  helm:{name:'壁垒战盔',slot:'head',price:40,description:'护甲 +15，最大生命 +40',stats:{armor:15,maxHp:40},appearance:'ironHelm'},
  circlet:{name:'奥能头环',slot:'head',price:40,description:'技能与效果威力 +15%，冷却急速 +10%',stats:{skillPower:0.15,haste:0.1},appearance:'arcaneCirclet'},
  hood:{name:'猎风兜帽',slot:'head',price:40,description:'普攻伤害 +5，移动速度 +5%',stats:{attackDamage:5,speed:0.05},appearance:'rangerHood'},
} as const satisfies Record<string,EquipmentDefinition>;
export type EquipmentId=keyof typeof EQUIPMENT;
export type EquipmentLoadout=Partial<Record<EquipmentSlot,EquipmentId>>;
export const SHOP_CATALOG=Object.keys(EQUIPMENT) as EquipmentId[];
export function equipment(id:EquipmentId):EquipmentDefinition{return EQUIPMENT[id];}
export function basicAttack(loadout:EquipmentLoadout):BasicAttackDefinition {
  return BASIC_ATTACKS[(loadout.weapon?equipment(loadout.weapon).attack:undefined)??'unarmed'];
}
/** Recompute from base every time. No cumulative drift after re-equipping. */
export function deriveStats(loadout:EquipmentLoadout):HeroStats {
  const total:StatBonus={};for(const slot of EQUIPMENT_SLOTS){const id=loadout[slot];if(id)for(const [key,value] of Object.entries(equipment(id).stats))total[key as keyof StatBonus]=(total[key as keyof StatBonus]??0)+value;}
  return {maxHp:HERO.hp+(total.maxHp??0),armor:total.armor??0,attackDamage:HERO.attackDamage+(total.attackDamage??0),attackRange:HERO.attackRange+(total.attackRange??0),
    attackInterval:HERO.attackInterval/(1+(total.attackSpeed??0)),speed:HERO.speed*(1+(total.speed??0)),skillPower:1+(total.skillPower??0),cooldownMultiplier:1/(1+(total.haste??0))};
}
