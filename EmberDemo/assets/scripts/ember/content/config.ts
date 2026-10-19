import {BASIC_ATTACKS,DEFAULT_BASIC_ATTACK} from './attacks';
/** Shared simulation constants; content registries live in their own files. */
export const FIXED_DT = 1 / 30;
export const HERO = {hp:240,speed:4.2,radius:0.32,attackRange:BASIC_ATTACKS[DEFAULT_BASIC_ATTACK].range,attackDamage:20,attackInterval:0.7,appearance:'hero'} as const;
export {SKILLS,type SkillId,type SkillSlot} from './skills';
export {ENEMIES,type EnemyKind} from './enemies';
