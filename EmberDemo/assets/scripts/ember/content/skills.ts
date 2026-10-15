import type { StatusApplication } from './statuses';

export const SKILL_SLOTS = ['Q','W','E','R'] as const;
export type SkillSlot = typeof SKILL_SLOTS[number];
export type SkillBehavior =
  | { kind:'projectile'; damage:number; speed:number; range:number; onHit?:readonly StatusApplication[] }
  | { kind:'shield'; amount:number; duration:number }
  | { kind:'dash'; distance:number; duration:number }
  | { kind:'area'; damage:number; radius:number; onHit?:readonly StatusApplication[] }
  | { kind:'cone'; damage:number; radius:number; arc:number };
export interface SkillDefinition {
  name:string; cooldown:number; tags:readonly string[]; appearance:string; behavior:SkillBehavior;
}
export const SKILLS = {
  fireball: {name:'烬火弹',cooldown:1.6,tags:['hero','projectile','fire'],appearance:'fire',behavior:{kind:'projectile',damage:38,speed:11,range:13}},
  shield: {name:'琥珀护盾',cooldown:9,tags:['hero','shield'],appearance:'shield',behavior:{kind:'shield',amount:65,duration:4}},
  dash: {name:'流火步',cooldown:4,tags:['hero','movement'],appearance:'fire',behavior:{kind:'dash',distance:3.5,duration:0.18}},
  nova: {name:'余烬绽放',cooldown:13,tags:['hero','area','fire'],appearance:'fire',behavior:{kind:'area',damage:72,radius:3.8}},
  icebolt: {name:'霜凝弹',cooldown:1.6,tags:['hero','projectile','ice'],appearance:'ice',behavior:{kind:'projectile',damage:30,speed:10,range:13,onHit:[{id:'slow',duration:2.5,power:0.55}]}},
  cleave:{name:'裂空斩',cooldown:3,tags:['hero','melee'],appearance:'fire',behavior:{kind:'cone',damage:65,radius:3.4,arc:1.8}},
  volley:{name:'穿云箭',cooldown:1.8,tags:['hero','projectile','physical'],appearance:'mist',behavior:{kind:'projectile',damage:45,speed:16,range:18}},
  ironGuard:{name:'钢铁壁垒',cooldown:12,tags:['hero','shield'],appearance:'shield',behavior:{kind:'shield',amount:120,duration:6}},
  frostNova:{name:'寒霜环',cooldown:10,tags:['hero','area','ice'],appearance:'ice',behavior:{kind:'area',damage:42,radius:4.5,onHit:[{id:'slow',duration:3,power:0.45}]}},
  mistBolt: {name:'雾灯弹',cooldown:2.4,tags:['enemy','projectile'],appearance:'mist',behavior:{kind:'projectile',damage:13,speed:5.3,range:21.2}},
  frostBolt: {name:'寒霜弹',cooldown:2.8,tags:['enemy','projectile','ice'],appearance:'ice',behavior:{kind:'projectile',damage:10,speed:4.5,range:18,onHit:[{id:'slow',duration:1.4,power:0.7}]}},
} as const satisfies Record<string,SkillDefinition>;
export type SkillId = keyof typeof SKILLS;
export type Loadout = Record<SkillSlot,SkillId>;
export const DEFAULT_LOADOUT:Loadout = {Q:'fireball',W:'shield',E:'dash',R:'nova'};
export const HERO_SKILLS=(Object.keys(SKILLS) as SkillId[]).filter(id=>skill(id).tags.includes('hero'));
export const SKILL_DESCRIPTIONS:Record<SkillId,string>={fireball:'朝指针发射火弹，造成 38 点伤害。',icebolt:'发射冰弹，造成 30 点伤害并减速。',shield:'获得 65 护盾，持续 4 秒。',dash:'朝指针冲刺 3.5 格。',nova:'自身周围 3.8 格造成 72 点伤害。',cleave:'朝指针扇形挥斩，造成 65 点伤害。',volley:'发射远程快箭，造成 45 点伤害。',ironGuard:'获得 120 护盾，持续 6 秒。',frostNova:'周围 4.5 格造成 42 点伤害并减速。',mistBolt:'敌人技能',frostBolt:'敌人技能'};
export function skill(id:SkillId):SkillDefinition {return SKILLS[id];}
