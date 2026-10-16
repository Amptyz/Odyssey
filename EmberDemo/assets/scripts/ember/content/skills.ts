import type {ValueExpression} from '../combat-core/attributes/AttributeSet';
import type {DamageType} from '../combat-core/types';
import {statusDefinition,type StatusApplication} from './statuses';

export const SKILL_SLOTS = ['Q','W','E','R'] as const;
export type SkillSlot = typeof SKILL_SLOTS[number];
export type SkillBehavior =
  | { kind:'projectile'; damage:number; speed:number; range:number; radius:number; onHit?:readonly StatusApplication[] }
  | { kind:'shield'; amount:number; duration:number }
  | { kind:'dash'; distance:number; duration:number }
  | { kind:'area'; damage:number; radius:number; onHit?:readonly StatusApplication[] }
  | { kind:'cone'; damage:number; radius:number; arc:number };
export interface SkillDefinition {
  expression?:ValueExpression;damageType?:DamageType;manaCost?:number;name:string; cooldown:number; tags:readonly string[]; appearance:string; behavior:SkillBehavior;
}
export const SKILLS = {
  fireball: {expression:{flat:38,abilityPower:.38},damageType:'magic',name:'烬火弹',cooldown:1.6,tags:['hero','projectile','fire'],appearance:'fire',behavior:{kind:'projectile',radius:0.18,damage:38,speed:11,range:13}},
  shield: {expression:{flat:65,abilityPower:.65},damageType:'magic',name:'琥珀护盾',cooldown:9,tags:['hero','shield'],appearance:'shield',behavior:{kind:'shield',amount:65,duration:4}},
  dash: {name:'流火步',cooldown:4,tags:['hero','movement'],appearance:'fire',behavior:{kind:'dash',distance:3.5,duration:0.18}},
  nova: {expression:{flat:72,abilityPower:.72},damageType:'magic',name:'余烬绽放',cooldown:13,tags:['hero','area','fire'],appearance:'fire',behavior:{kind:'area',damage:72,radius:3.8}},
  icebolt: {expression:{flat:30,abilityPower:.30},damageType:'magic',name:'霜凝弹',cooldown:1.6,tags:['hero','projectile','ice'],appearance:'ice',behavior:{kind:'projectile',radius:0.18,damage:30,speed:10,range:13,onHit:[{id:'slow',duration:2.5,power:0.55}]}},
  cleave:{expression:{flat:45,attackDamage:1},damageType:'physical',name:'裂空斩',cooldown:3,tags:['hero','melee'],appearance:'fire',behavior:{kind:'cone',damage:65,radius:3.4,arc:1.8}},
  volley:{expression:{flat:25,attackDamage:1},damageType:'physical',name:'穿云箭',cooldown:1.8,tags:['hero','projectile','physical'],appearance:'mist',behavior:{kind:'projectile',radius:0.18,damage:45,speed:16,range:18}},
  ironGuard:{expression:{flat:120,abilityPower:1.2},damageType:'magic',name:'钢铁壁垒',cooldown:12,tags:['hero','shield'],appearance:'shield',behavior:{kind:'shield',amount:120,duration:6}},
  frostNova:{expression:{flat:42,abilityPower:.42},damageType:'magic',name:'寒霜环',cooldown:10,tags:['hero','area','ice'],appearance:'ice',behavior:{kind:'area',damage:42,radius:4.5,onHit:[{id:'slow',duration:3,power:0.45}]}},
  mistBolt: {expression:{attackDamage:1},damageType:'magic',name:'雾灯弹',cooldown:2.4,tags:['enemy','projectile'],appearance:'mist',behavior:{kind:'projectile',radius:0.18,damage:13,speed:5.3,range:21.2}},
  frostBolt: {expression:{attackDamage:1},damageType:'magic',name:'寒霜弹',cooldown:2.8,tags:['enemy','projectile','ice'],appearance:'ice',behavior:{kind:'projectile',radius:0.18,damage:10,speed:4.5,range:18,onHit:[{id:'slow',duration:1.4,power:0.7}]}},
} as const satisfies Record<string,SkillDefinition>;
export type SkillId = keyof typeof SKILLS;
export type Loadout = Record<SkillSlot,SkillId>;
export const DEFAULT_LOADOUT:Loadout = {Q:'fireball',W:'shield',E:'dash',R:'nova'};
export const HERO_SKILLS=(Object.keys(SKILLS) as SkillId[]).filter(id=>skill(id).tags.includes('hero'));
export function expressionDescription(e:ValueExpression):string {
  const value=[(e.flat??0)?String(e.flat):'',e.attackDamage?`${e.attackDamage} × AD`:'',e.abilityPower?`${e.abilityPower} × AP`:'',e.sourceMaxHealth?`${e.sourceMaxHealth*100}% 自身最大生命`:'',e.sourceMissingHealth?`${e.sourceMissingHealth*100}% 自身已损生命`:'',e.targetMaxHealth?`${e.targetMaxHealth*100}% 目标最大生命`:'',e.targetCurrentHealth?`${e.targetCurrentHealth*100}% 目标当前生命`:'',e.targetMissingHealth?`${e.targetMissingHealth*100}% 目标已损生命`:''].filter(Boolean).join(' + ')||'0';
  return e.cap===undefined?value:`${value}（上限 ${e.cap}）`;
}
export function statusDescription(application:StatusApplication):string {
  const definition=statusDefinition(application.id),duration=`持续 ${application.duration} 秒`;
  if(definition.handler==='speed')return `${definition.name} ${Math.round((1-application.power)*100)}%，${duration}`;
  return `${definition.name}：每 ${definition.interval} 秒造成 ${application.power} 点魔法伤害，${duration}${definition.maxStacks?`，每来源最多 ${definition.maxStacks} 层`:''}`;
}
export function skillDescription(s:SkillDefinition):string {
  const b=s.behavior,e=expressionDescription(s.expression??{});
  if(b.kind==='dash')return `朝指针冲刺 ${b.distance} 格。`;
  if(b.kind==='shield')return `获得 ${e} 护盾，持续 ${b.duration} 秒。`;
  const damageName=s.damageType==='physical'?'物理':s.damageType==='true'?'真实':'魔法';
  const geometry=b.kind==='area'?`自身周围 ${b.radius} 格` :b.kind==='cone'?`朝指针 ${b.radius} 格扇形`:'朝指针发射投射物';
  const statuses='onHit' in b?(b.onHit??[]).map(statusDescription):[];
  return `${geometry}，造成 ${e} 点${damageName}伤害${statuses.length?'；命中附加'+statuses.join('；'):''}。`;
}
export const SKILL_DESCRIPTIONS=Object.fromEntries((Object.keys(SKILLS) as SkillId[]).map(id=>[id,skillDescription(SKILLS[id])])) as Record<SkillId,string>;
export function skill(id:SkillId):SkillDefinition {return SKILLS[id];}
