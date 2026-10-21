/** Linear attack dimensions only; authored angles, movement, damage and timing stay unchanged. */
export const ATTACK_RANGE_MULTIPLIER=2;
export const scaleAttackRange=(base:number):number=>base*ATTACK_RANGE_MULTIPLIER;
/** Primary attack forms are independent of equipment and visual attachments. */
export type BasicAttackDefinition = {name:string;range:number;appearance:string} & (
  | {kind:'melee';arc:number;windup:number;active:number}
  | {kind:'projectile';speed:number;radius:number});
export const BASIC_ATTACKS={
  slash:{name:'环扫挥砍',range:scaleAttackRange(2.5),kind:'melee',arc:Math.PI*1.7,windup:0.12,active:0.12,appearance:'physical'},
  missile:{name:'飞弹普攻',range:scaleAttackRange(7.5),kind:'projectile',speed:18,radius:scaleAttackRange(0.10),appearance:'mist'},
} as const satisfies Record<string,BasicAttackDefinition>;
export type BasicAttackId=keyof typeof BASIC_ATTACKS;
export const DEFAULT_BASIC_ATTACK:BasicAttackId='slash';
/** Acquisition order is stable in saves. The latest form-changing perk wins; other perks do not reset it. */
export function resolveBasicAttack(perks:Iterable<{basicAttack?:BasicAttackId}>):BasicAttackId {
  let id=DEFAULT_BASIC_ATTACK;
  for(const perk of perks)if(perk.basicAttack)id=perk.basicAttack;
  return id;
}
