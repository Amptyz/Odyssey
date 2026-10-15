import type { Vec2 } from '../utils/math';
import type { SkillId } from '../content/config';
export type Cause = 'basic' | 'skill' | 'burn' | 'explosion' | 'arc' | 'enemy';
export type PerkId = 'burn' | 'corpse' | 'arc' | 'double' | 'swift' | 'rhythm' | 'reserve' | 'leech';
export interface Burn { remaining: number; tickIn: number; sourceId: string; damage: number }
export interface Actor extends Vec2 {
  id: string; team: 'hero' | 'enemy'; hp: number; maxHp: number; shield: number;
  shieldTime: number; radius: number; alive: boolean; burn?: Burn;
}
export interface CombatEvent {
  type: 'OnHit' | 'OnKill' | 'OnSkillCast' | 'OnStatusTick';
  sourceId: string; targetId: string; cause: Cause; depth: number; skillId?: SkillId;
  tags: string[]; amount: number; rootId: number;
}
export interface Hit {
  sourceId: string; targetId: string; amount: number; cause: Cause;
  depth?: number; skillId?: SkillId; tags?: string[]; rootId?: number;
}
export interface CastResult { damageMultiplier: number; shots: number }
export interface CombatCue { kind: 'damage' | 'heal' | 'explosion' | 'arc' | 'shield' | 'cast'; at: Vec2; to?: Vec2; amount?: number; radius?: number; cause?: Cause }
export type Effect =
  | { type: 'burn'; damage: number; duration: number }
  | { type: 'explode'; damage: number; radius: number }
  | { type: 'arc'; damage: number; radius: number }
  | { type: 'heal'; amount: number; cooldown: number }
  | { type: 'prime' } | { type: 'empower'; multiplier: number } | { type: 'extraShot' };
export interface Rule {
  event: CombatEvent['type']; skillId?: SkillId; causes?: Cause[];
  targetBurning?: boolean; sourcePrimed?: boolean; effect: Effect;
}
export interface PerkDefinition { id: PerkId; name: string; description: string; color: string; rules: Rule[]; speedMultiplier?: number; attackMultiplier?: number }
