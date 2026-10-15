import type { SkillId } from './skills';
export type EnemyBehaviorId='melee'|'ranged';
export interface EnemyDefinition {
  name:string;hp:number;speed:number;radius:number;range:number;interval:number;windup:number;
  behavior:EnemyBehaviorId;appearance:string;damage:number;skillId?:SkillId;
}
export const ENEMIES = {
  warden:{name:'古树守卫',hp:105,speed:1.15,radius:0.55,damage:16,range:1.4,interval:1.8,windup:0.8,behavior:'melee',appearance:'grovewarden'},
  melee:{name:'遗迹小精灵',hp:62,speed:1.75,radius:0.34,damage:11,range:0.9,interval:1.25,windup:0.42,behavior:'melee',appearance:'moss'},
  ranged:{name:'雾灯精灵',hp:48,speed:1.3,radius:0.3,damage:13,range:6.5,interval:2.4,windup:0.65,behavior:'ranged',appearance:'mistling',skillId:'mistBolt'},
  frostling:{name:'霜叶精灵',hp:56,speed:1.2,radius:0.3,damage:10,range:6,interval:2.8,windup:0.85,behavior:'ranged',appearance:'frostling',skillId:'frostBolt'},
} as const satisfies Record<string,EnemyDefinition>;
export type EnemyKind=keyof typeof ENEMIES;
export function enemy(id:EnemyKind):EnemyDefinition{return ENEMIES[id];}
