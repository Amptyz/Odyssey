import type {AttributeSet,ValueExpression,AttributeSource,Modifier} from './attributes/AttributeSet';
import type { Vec2 } from '../utils/math';
import type { SkillId } from '../content/skills';
import type { StatusApplication, StatusId } from '../content/statuses';
export type PerkId = typeof import('../content/perks').PERKS[number]['id'];
export type Cause = 'basic' | 'skill' | 'burn' | 'explosion' | 'arc' | 'enemy' | 'augment';
export interface StatusInstance {id:StatusId;remaining:number;tickIn:number;sourceId:string;skillId?:SkillId;power:number;stacks?:number}
export type DamageType='physical'|'magic'|'true';
export interface ShieldInstance {id:string;sourceId:string;remaining:number;amount:number;types:DamageType[]}
export interface CombatEffect {sourceId:string;instanceId:string;remaining:number;armorReductionFlat?:number;armorReductionPercent?:number;magicReductionFlat?:number;magicReductionPercent?:number;healingReceived?:number;grievousWounds?:number;invulnerable?:boolean}
export interface DamageComponent {damageType:DamageType;postMitigation:number;shieldAbsorbed:number;healthLost:number;overkill:number}
export interface Actor extends Vec2 {
  attributes:AttributeSet;mana:number;shields:ShieldInstance[];
  combatEffects:CombatEffect[];attributeEffects:(AttributeSource&{remaining:number})[];
  id: string; team: 'hero' | 'enemy'; hp: number; maxHp: number; shield: number;
  shieldTime: number; radius: number; alive: boolean; statuses:StatusInstance[];
}
export interface CombatEvent {
  type: 'OnHit' | 'OnKill' | 'OnSkillCast' | 'OnStatusTick' | 'OnAttack' | 'OnAttackHit' | 'OnHeal' | 'OnDamaged' | 'OnDashEnd' | 'OnShield';
  sourceId: string; targetId: string; cause: Cause; depth: number; skillId?: SkillId;
  attackId?:number;damageSourceTeam?:Actor['team'];healthAfter?:number;targetMaxHealth?:number;
  tags: string[]; amount: number; postMitigation?:number;shieldAbsorbed?:number;healthLost?:number;overkill?:number;effectiveHeal?:number;components?:DamageComponent[];damageType?:DamageType;rootId: number; proc?:boolean; aim?:Vec2; from?:Vec2; to?:Vec2;
}
export interface Hit {
  sourceId: string; targetId: string; amount: number; cause: Cause;
  attackId?:number;damageSourceTeam?:Actor['team'];
  damageType?:DamageType;expression?:ValueExpression;delivery?:'attack'|'spell'|'periodic'|'proc'|'pet';area?:boolean;canCrit?:boolean;critRatio?:number;vampEligible?:boolean;
  depth?: number; skillId?: SkillId; tags?: string[]; rootId?: number;
  proc?:boolean; appliesOnHit?:boolean;
}
export interface CastResult { damageMultiplier: number; shots: number }
export interface CombatCue { kind: 'damage' | 'heal' | 'explosion' | 'arc' | 'shield' | 'cast' | 'swing' | 'quake'; at: Vec2; actorId?:string; to?: Vec2; amount?: number; radius?: number; facing?:Vec2; arc?:number; cause?: Cause; appearance?:string; critical?:boolean; trueDamage?:boolean }
export interface MissileEffect {
  type:'missiles'; aim:'forward'|'victim'|'secondary'; count:number; spread:number; damage:number;
  speed:number; range:number; radius:number; appearance:string; attackRatio?:number;
  targetHpRatio?:number; hpDamageCap?:number; distanceScale?:number; appliesOnHit?:boolean; damageType?:DamageType;
}
/** Ports from the pure rules layer into simulation; effects never import GameWorld. */
export interface CombatHooks {
  onEvent?:(event:Readonly<CombatEvent>)=>void;
  projectile?:(source:Actor,aim:Vec2,effect:MissileEffect,damage:number)=>void;
  reduceCooldown?:(sourceId:string,seconds:number)=>void;
  attackDamage?:(sourceId:string)=>number;
  random?:()=>number;
}
export interface DamageZone {id:number;sourceId:string;from:Vec2;to:Vec2;radius:number;remaining:number;delay:number;damage:number;appearance:string}
export type Effect =
  | {type:'attribute';sourceId:string;duration:number;modifiers:readonly Modifier[];target?:'source'|'target'}
  | {type:'combatEffect';effect:Omit<CombatEffect,'sourceId'|'instanceId'>;target?:'source'|'target'}
  | {type:'shield';expression:ValueExpression;duration:number;id:string;target?:'source'|'target';damageTypes?:DamageType[]}
  | {type:'damage';expression:ValueExpression;damageType:DamageType;vampEligible?:boolean}

  | { type:'status'; status:StatusApplication }
  | { type: 'explode'; damage: number; radius: number }
  | { type: 'arc'; damage: number; radius: number }
  | { type: 'heal'; amount: number; expression?:ValueExpression;cooldown: number }
  | MissileEffect
  | { type:'onHit' }
  | { type:'cooldown'; seconds:number }
  | { type:'bonusDamage'; maxHpRatio:number }
  | { type:'regenerate'; maxHpRatio:number; duration:number }
  | { type:'healNova'; ratio:number; radius:number }
  | { type:'trail'; damage:number; radius:number; delay:number; appearance:string }
  | { type: 'prime' } | { type: 'empower'; multiplier: number } | { type: 'extraShot' };
export interface Rule {
  event: CombatEvent['type']; skillId?: SkillId; causes?: readonly Cause[]; skillTags?:readonly string[];
  targetStatus?: StatusId; sourcePrimed?: boolean; effect: Effect;
  directOnly?:boolean; tags?:readonly string[]; cooldown?:number; perTarget?:boolean; every?:number; healthBelow?:number;
}
export interface PerkDefinition { id: string; name: string; description: string; color: string; rules: readonly Rule[]; requiresSkillTags?:readonly string[]; requiresSkillGroups?:readonly (readonly string[])[]; speedMultiplier?: number; attackMultiplier?: number; maxHpMultiplier?:number; critChance?:number; skillCrit?:boolean; trueBonusRatio?:number }
