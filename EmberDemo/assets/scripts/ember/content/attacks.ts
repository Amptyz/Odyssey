/** Weapon behavior is content, separate from equipment stats and visual attachments. */
export type BasicAttackDefinition =
  | {kind:'melee';arc:number;windup:number;active:number;appearance:string}
  | {kind:'projectile';speed:number;radius:number;appearance:string};
export const BASIC_ATTACKS={
  unarmed:{kind:'melee',arc:Math.PI/2,windup:0.10,active:0.10,appearance:'physical'},
  sword:{kind:'melee',arc:Math.PI*0.65,windup:0.12,active:0.12,appearance:'physical'},
  shield:{kind:'melee',arc:Math.PI*0.4,windup:0.16,active:0.10,appearance:'shield'},
  bow:{kind:'projectile',speed:18,radius:0.10,appearance:'physical'},
  staff:{kind:'projectile',speed:12,radius:0.16,appearance:'mist'},
} as const satisfies Record<string,BasicAttackDefinition>;
export type BasicAttackId=keyof typeof BASIC_ATTACKS;
