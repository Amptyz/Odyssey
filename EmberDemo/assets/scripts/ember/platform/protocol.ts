import type { SkillId } from '../content/config';
import type { PerkId } from '../combat-core/types';
import type { Vec2 } from '../utils/math';
export type GameCommand =
  | { type:'MoveTo'; point:Vec2 } | { type:'SetTarget'; targetId:string }
  | { type:'DirectInput'; movement:Vec2; attack?:Vec2 } | { type:'Stop' }
  | { type:'Attack'; point:Vec2 }
  | { type:'CastSkill'; skillId:SkillId; point:Vec2 }
  | { type:'ChoosePerk'; perkId:PerkId } | { type:'TogglePause' }
  | { type:'Start'; lab?:'burn'|'arc'|'reserve' } | { type:'Restart' };
export interface CommandPort { send(command:GameCommand):void }
