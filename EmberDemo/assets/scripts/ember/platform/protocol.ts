import type { SkillId,SkillSlot } from '../content/skills';
import type { MapId } from '../content/maps';
import type { EquipmentId,EquipmentSlot } from '../content/equipment';
import type { Vec2 } from '../utils/math';
import type { LabId } from '../content/perks';
export type GameCommand =
  | { type:'MoveTo'; point:Vec2 }
  | { type:'DirectInput'; movement:Vec2 } | { type:'Stop' }
  | { type:'AttackInput'; point?:Vec2 }
  | { type:'Attack'; point:Vec2 }
  | { type:'CastSlot'; slot:SkillSlot; point:Vec2 }
  | { type:'SelectMap'; mapId:MapId }
  | { type:'CastSkill'; skillId:SkillId; point:Vec2 }
  | { type:'ChooseReward'; choiceId:string } | { type:'ConfirmSkill'; slot:SkillSlot } | {type:'CancelSkill'}
  | { type:'BuyEquipment'; equipmentId:EquipmentId } | {type:'EquipEquipment';equipmentId:EquipmentId} | {type:'UnequipEquipment';slot:EquipmentSlot} | {type:'LeaveShop'} | { type:'TogglePause' }
  | { type:'Start'; lab?:LabId } | { type:'Restart' };
export interface CommandPort { send(command:GameCommand):void }
