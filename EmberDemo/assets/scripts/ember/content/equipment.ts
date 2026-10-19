import {AttributeSet,PLAYER_TEMPLATE,cooldownMultiplier,movementSpeed,type Attributes,type Modifier,type AttributeSource,type ValueExpression} from '../combat-core/attributes/AttributeSet';
export const EQUIPMENT_SLOTS=['slot1','slot2','slot3','slot4','slot5','slot6'] as const;
export type EquipmentSlot=typeof EQUIPMENT_SLOTS[number];
export const SLOT_NAMES:Record<EquipmentSlot,string>={slot1:'装备栏1',slot2:'装备栏2',slot3:'装备栏3',slot4:'装备栏4',slot5:'装备栏5',slot6:'装备栏6'};
export const EQUIPMENT_CATEGORIES=['weapon','body','head'] as const;
export type EquipmentCategory=typeof EQUIPMENT_CATEGORIES[number];
export const CATEGORY_NAMES:Record<EquipmentCategory,string>={weapon:'武器',body:'身体',head:'头部'};
export interface HeroStats extends Attributes {maxHp:number;attackInterval:number;speed:number;cooldownMultiplier:number}
/** Legacy item stat adapter. New content uses modifiers. Equipment never selects a primary attack form. */
export interface StatBonus {maxHp?:number;armor?:number;attackDamage?:number;attackSpeed?:number;speed?:number;abilityPower?:number;haste?:number}
export type EquipmentPassiveDefinition =
  | {kind:'spellblade';group:string;expression:ValueExpression;armDuration:number;cooldown:number}
  | {kind:'safetyShield';group:string;expression:ValueExpression;healthBelow:number;duration:number;cooldown:number};
export interface EquipmentDefinition {name:string;category:EquipmentCategory;price:number;description:string;stats:StatBonus;modifiers?:readonly Modifier[];appearance:string;passives?:readonly EquipmentPassiveDefinition[]}
export const EQUIPMENT={
  sword:{name:'赤铜长剑',category:'weapon',price:100,description:'攻击力 +12，护甲 +8',stats:{attackDamage:12,armor:8},appearance:'copperSword'},
  staff:{name:'星辉法杖',category:'weapon',price:100,description:'法强 +30，急速 +10',stats:{abilityPower:30,haste:10},appearance:'starStaff'},
  bow:{name:'猎风长弓',category:'weapon',price:100,description:'攻速 +20%，攻击力 +4',stats:{attackSpeed:.2,attackDamage:4},appearance:'windBow'},
  bulwark:{name:'壁垒重盾',category:'weapon',price:100,description:'护甲 +22，生命上限 +60',stats:{armor:22,maxHp:60},appearance:'towerShield'},
  plate:{name:'赤铜胸甲',category:'body',price:100,description:'生命上限 +75，护甲 +18',stats:{maxHp:75,armor:18},appearance:'copperPlate'},
  robe:{name:'星纹法袍',category:'body',price:100,description:'法术强度 +24，生命上限 +30',stats:{abilityPower:24,maxHp:30},appearance:'starRobe'},
  leather:{name:'游侠皮衣',category:'body',price:100,description:'攻击力 +3，攻速 +18%，移速 +8%',stats:{attackDamage:3,attackSpeed:.18,speed:.08},appearance:'rangerLeather'},
  helm:{name:'壁垒战盔',category:'head',price:100,description:'生命上限 +55，护甲 +12，魔抗 +8',stats:{maxHp:55,armor:12},modifiers:[{stat:'magicResist',operation:'flat',value:8}],appearance:'ironHelm'},
  circlet:{name:'奥能头环',category:'head',price:100,description:'法术强度 +20，技能急速 +12',stats:{abilityPower:20,haste:12},appearance:'arcaneCirclet'},
  hood:{name:'猎风兜帽',category:'head',price:100,description:'攻击力 +9，移动速度 +8%',stats:{attackDamage:9,speed:.08},appearance:'rangerHood'},
  reaver:{name:'饮烬短刃',category:'weapon',price:100,description:'攻击力 +8，全能吸血 +6%',stats:{},modifiers:[{stat:'attackDamage',operation:'flat',value:8},{stat:'omnivamp',operation:'flat',value:.06}],appearance:'reaver'},
  runeblade:{name:'符刻刃',category:'weapon',price:100,description:'攻击力 +6，法强 +18，急速 +8；符击',stats:{},modifiers:[{stat:'attackDamage',operation:'flat',value:6},{stat:'abilityPower',operation:'flat',value:18},{stat:'abilityHaste',operation:'flat',value:8}],appearance:'runeblade',passives:[{kind:'spellblade',group:'equipment.spellblade',expression:{flat:8,attackDamage:.20,abilityPower:.12},armDuration:5,cooldown:3}]},
  duelistVest:{name:'逐风轻甲',category:'body',price:100,description:'攻击力 +3，攻速 +16%，暴击率 +18%',stats:{},modifiers:[{stat:'attackDamage',operation:'flat',value:3},{stat:'attackSpeed',operation:'percent',value:.16},{stat:'critChance',operation:'flat',value:.18}],appearance:'duelistVest'},
  wardMantle:{name:'回响石披',category:'body',price:100,description:'生命上限 +55，魔抗 +20；低血时获得石息护盾',stats:{},modifiers:[{stat:'maxHealth',operation:'flat',value:55},{stat:'magicResist',operation:'flat',value:20}],appearance:'wardMantle',passives:[{kind:'safetyShield',group:'equipment.safetyShield',expression:{flat:18,sourceMaxHealth:.05},healthBelow:.5,duration:3,cooldown:18}]},
  sanguineWrap:{name:'烬纹裹衣',category:'body',price:100,description:'生命上限 +45，攻击力 +6，全能吸血 +6%',stats:{},modifiers:[{stat:'maxHealth',operation:'flat',value:45},{stat:'attackDamage',operation:'flat',value:6},{stat:'omnivamp',operation:'flat',value:.06}],appearance:'sanguineWrap'},
  keenVisor:{name:'棱光面罩',category:'head',price:100,description:'攻击力 +8，暴击率 +18%',stats:{},modifiers:[{stat:'attackDamage',operation:'flat',value:8},{stat:'critChance',operation:'flat',value:.18}],appearance:'keenVisor'},
  sageMask:{name:'裂纹石面',category:'head',price:100,description:'法术强度 +20，固定法术穿透 +10',stats:{},modifiers:[{stat:'abilityPower',operation:'flat',value:20},{stat:'magicPenFlat',operation:'flat',value:10}],appearance:'sageMask'},
  aegisCrown:{name:'苔石冠',category:'head',price:100,description:'生命上限 +55，魔抗 +22',stats:{},modifiers:[{stat:'maxHealth',operation:'flat',value:55},{stat:'magicResist',operation:'flat',value:22}],appearance:'aegisCrown'},

} as const satisfies Record<string,EquipmentDefinition>;
export type EquipmentId=keyof typeof EQUIPMENT;
export type EquipmentLoadout=Partial<Record<EquipmentSlot,EquipmentId>>;
export type EquipmentAppearanceLoadout=Partial<Record<EquipmentCategory,EquipmentId>>;
export const SHOP_CATALOG=Object.keys(EQUIPMENT) as EquipmentId[];
export function equipment(id:EquipmentId):EquipmentDefinition{return EQUIPMENT[id];}
/** Explicit purchase history wins; legacy/config callers fall back to stable slot order. */
function equippedPurchaseOrder(loadout:EquipmentLoadout,purchaseOrder:readonly EquipmentId[]):EquipmentId[]{
  const active=EQUIPMENT_SLOTS.flatMap(slot=>loadout[slot]?[loadout[slot]!]:[]),activeSet=new Set(active);
  const ordered=active.filter(id=>!purchaseOrder.includes(id));
  for(const id of purchaseOrder)if(activeSet.has(id)&&!ordered.includes(id))ordered.push(id);
  return ordered;
}
export function appearanceLoadout(loadout:EquipmentLoadout,purchaseOrder:readonly EquipmentId[]=[]):EquipmentAppearanceLoadout {
  const result:EquipmentAppearanceLoadout={};for(const id of equippedPurchaseOrder(loadout,purchaseOrder))result[equipment(id).category]=id;return result;
}
/** Every occupied universal slot contributes attributes, independently of purchase order and appearance. */
export function equipmentSources(loadout:EquipmentLoadout):AttributeSource[]{
  return EQUIPMENT_SLOTS.flatMap(slot=>{const id=loadout[slot];if(!id)return[];const item=equipment(id);return[{sourceId:'equipment:'+slot,modifiers:[...(item.modifiers??[]),...Object.entries(item.stats).map(([key,value])=>({stat:({maxHp:'maxHealth',speed:'moveSpeed',haste:'abilityHaste'} as Record<string,string>)[key]??key,operation:key==='speed'||key==='attackSpeed'?'percent':'flat',value} as Modifier))]}];});
}
export function syncEquipment(attributes:AttributeSet,loadout:EquipmentLoadout):void {for(const slot of EQUIPMENT_SLOTS)attributes.remove('equipment:'+slot);for(const source of equipmentSources(loadout))attributes.upsert(source);}
export function statsView(attributes:AttributeSet):HeroStats {const a=attributes.value;return{...a,moveSpeed:movementSpeed(a)/.01,maxHp:a.maxHealth,attackInterval:1/a.attackSpeed,speed:movementSpeed(a),cooldownMultiplier:cooldownMultiplier(a)};}
export function deriveStats(loadout:EquipmentLoadout):HeroStats {const a=new AttributeSet(PLAYER_TEMPLATE);syncEquipment(a,loadout);return statsView(a);}

/** Full rule text lives beside the actual numeric definitions; compact catalog cards use description. */
export function equipmentDetails(id:EquipmentId):string {
  const item=equipment(id),formula=(e:ValueExpression)=>[[e.flat,''],[e.attackDamage,'×总攻击力'],[e.abilityPower,'×法术强度'],[e.sourceMaxHealth,'×自身生命上限']].filter(([v])=>v!==undefined&&v!==0).map(([v,label])=>`${v}${label}`).join(' + ');
  return [item.description,...(item.passives??[]).map(p=>p.kind==='spellblade'
    ?`符击：成功施法后蓄能${p.armDuration}秒，下次直接普攻对首个命中目标附加 ${formula(p.expression)} 魔法伤害。随当前普攻命中范围，伤害随总攻击力和法术强度提高；不可暴击、不触发攻击特效，可全能吸血。挥空不消耗；冷却${p.cooldown}秒，不受急速影响。同名被动只生效一份。`
    :`石息：敌对伤害实际扣血后，存活且生命低于${p.healthBelow*100}%时获得 ${formula(p.expression)} 通用护盾，持续${p.duration}秒、冷却${p.cooldown}秒。仅自身，致死伤害不能救命；不是治疗，不触发吸血或治疗转伤害。同名被动只生效一份。`)].join('\n');
}
