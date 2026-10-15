export const ARENA_SIZE = 20;
export const FIXED_DT = 1 / 30;
export const HERO = { hp: 240, speed: 4.2, radius: 0.32, attackRange: 2.5, attackDamage: 20, attackInterval: 0.7 } as const;
export const SKILLS = {
  Q: { name: '烬火弹', cooldown: 1.6, damage: 38, speed: 11, range: 13 },
  W: { name: '琥珀护盾', cooldown: 9, shield: 65, duration: 4 },
  E: { name: '流火步', cooldown: 4, distance: 3.5, duration: 0.18 },
  R: { name: '余烬绽放', cooldown: 13, damage: 72, radius: 3.8 },
} as const;
export type SkillId = keyof typeof SKILLS;
export const ENEMIES = {
  melee: { name: '苔石兽', hp: 62, speed: 1.75, radius: 0.34, damage: 11, range: 0.9, interval: 1.25, windup: 0.42 },
  ranged: { name: '雾灯灵', hp: 48, speed: 1.3, radius: 0.3, damage: 13, range: 6.5, interval: 2.4, windup: 0.65 },
} as const;
export type EnemyKind = keyof typeof ENEMIES;
export const WAVES = [
  { melee: 4, ranged: 1, hpScale: 1 },
  { melee: 6, ranged: 3, hpScale: 1.15 },
  { melee: 8, ranged: 5, hpScale: 1.3 },
] as const;
export const OBSTACLES = [
  { id: 'pillar-n', x: 6, y: 6, radius: 0.85, height: 64 },
  { id: 'pillar-e', x: 14, y: 6, radius: 0.85, height: 64 },
  { id: 'pillar-s', x: 14, y: 14, radius: 0.85, height: 64 },
  { id: 'pillar-w', x: 6, y: 14, radius: 0.85, height: 64 },
  { id: 'rock-e', x: 16.5, y: 10, radius: 0.65, height: 28 },
  { id: 'rock-w', x: 3.5, y: 10, radius: 0.65, height: 28 },
] as const;
