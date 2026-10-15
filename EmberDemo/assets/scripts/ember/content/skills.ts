import type { StatusApplication } from './statuses';

export const SKILL_SLOTS = ['Q','W','E','R'] as const;
export type SkillSlot = typeof SKILL_SLOTS[number];
export type SkillBehavior =
  | { kind:'projectile'; damage:number; speed:number; range:number; onHit?:readonly StatusApplication[] }
  | { kind:'shield'; amount:number; duration:number }
  | { kind:'dash'; distance:number; duration:number }
  | { kind:'area'; damage:number; radius:number };
export interface SkillDefinition {
  name:string; cooldown:number; tags:readonly string[]; appearance:string; behavior:SkillBehavior;
}
export const SKILLS = {
  fireball: {name:'烬火弹',cooldown:1.6,tags:['hero','projectile','fire'],appearance:'fire',behavior:{kind:'projectile',damage:38,speed:11,range:13}},
  shield: {name:'琥珀护盾',cooldown:9,tags:['hero','shield'],appearance:'shield',behavior:{kind:'shield',amount:65,duration:4}},
  dash: {name:'流火步',cooldown:4,tags:['hero','movement'],appearance:'fire',behavior:{kind:'dash',distance:3.5,duration:0.18}},
  nova: {name:'余烬绽放',cooldown:13,tags:['hero','area','fire'],appearance:'fire',behavior:{kind:'area',damage:72,radius:3.8}},
  icebolt: {name:'霜凝弹',cooldown:1.6,tags:['hero','projectile','ice'],appearance:'ice',behavior:{kind:'projectile',damage:30,speed:10,range:13,onHit:[{id:'slow',duration:2.5,power:0.55}]}},
  mistBolt: {name:'雾灯弹',cooldown:2.4,tags:['enemy','projectile'],appearance:'mist',behavior:{kind:'projectile',damage:13,speed:5.3,range:21.2}},
  frostBolt: {name:'寒霜弹',cooldown:2.8,tags:['enemy','projectile','ice'],appearance:'ice',behavior:{kind:'projectile',damage:10,speed:4.5,range:18,onHit:[{id:'slow',duration:1.4,power:0.7}]}},
} as const satisfies Record<string,SkillDefinition>;
export type SkillId = keyof typeof SKILLS;
export type Loadout = Record<SkillSlot,SkillId>;
export const DEFAULT_LOADOUT:Loadout = {Q:'fireball',W:'shield',E:'dash',R:'nova'};
export const PRIMARY_SKILLS:readonly SkillId[] = ['fireball','icebolt'];
export function skill(id:SkillId):SkillDefinition {return SKILLS[id];}
