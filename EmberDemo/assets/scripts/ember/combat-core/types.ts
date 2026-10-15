import type { Vec2 } from '../utils/math';
import type { SkillId } from '../content/skills';
import type { StatusApplication, StatusId } from '../content/statuses';
export type PerkId = typeof import('../content/perks').PERKS[number]['id'];
export type Cause = 'basic' | 'skill' | 'burn' | 'explosion' | 'arc' | 'enemy';
export interface StatusInstance {id:StatusId;remaining:number;tickIn:number;sourceId:string;skillId?:SkillId;power:number}
export interface Actor extends Vec2 {
  id: string; team: 'hero' | 'enemy'; hp: number; maxHp: number; shield: number;
  shieldTime: number; radius: number; alive: boolean; statuses:StatusInstance[];
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
export interface CombatCue { kind: 'damage' | 'heal' | 'explosion' | 'arc' | 'shield' | 'cast' | 'swing'; at: Vec2; actorId?:string; to?: Vec2; amount?: number; radius?: number; facing?:Vec2; arc?:number; cause?: Cause; appearance?:string }
export type Effect =
  | { type:'status'; status:StatusApplication }
  | { type: 'explode'; damage: number; radius: number }
  | { type: 'arc'; damage: number; radius: number }
  | { type: 'heal'; amount: number; cooldown: number }
  | { type: 'prime' } | { type: 'empower'; multiplier: number } | { type: 'extraShot' };
export interface Rule {
  event: CombatEvent['type']; skillId?: SkillId; causes?: readonly Cause[]; skillTags?:readonly string[];
  targetStatus?: StatusId; sourcePrimed?: boolean; effect: Effect;
}
export interface PerkDefinition { id: string; name: string; description: string; color: string; rules: readonly Rule[]; requiresSkillTags?:readonly string[]; requiresSkillGroups?:readonly (readonly string[])[]; speedMultiplier?: number; attackMultiplier?: number }
