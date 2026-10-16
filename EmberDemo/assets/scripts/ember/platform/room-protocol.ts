import type { GameCommand } from './protocol';
import type { WorldSnapshot } from '../simulation/GameWorld';
import type { RunCheckpoint } from '../simulation/RunCheckpoint';
import { SKILL_SLOTS,HERO_SKILLS } from '../content/skills';
import { SHOP_CATALOG,EQUIPMENT_SLOTS } from '../content/equipment';

export const ROOM_VERSION='ember-coop-4';
export const MAX_PLAYERS=4;
export interface RoomMember {id:string;name:string;connected:boolean;active:boolean}
export interface RoomInfo {code:string;hostId:string;members:RoomMember[];started:boolean;revision:number;hasSave:boolean;hostAvailable:boolean}
export type PlayerView=Pick<WorldSnapshot,'hero'|'loadout'|'cooldowns'|'perks'|'choices'|'pendingSkill'|'gold'|'inventory'|'equipment'|'purchaseOrder'|'appearance'|'stats'|'destination'|'primed'|'equipmentPassives'>;
export type RoomClientMessage=
  | {type:'hello';version:string;action:'create'|'join'|'recover';identity:string;name:string;code?:string;checkpoint?:RunCheckpoint}
  | {type:'command';seq:number;command:GameCommand}
  | {type:'frame';base:WorldSnapshot;views:Record<string,PlayerView>}
  | {type:'save';revision:number;checkpoint:RunCheckpoint}
  | {type:'begin'|'skipOffline'|'leave'|'heartbeat';available?:boolean};
export type RoomServerMessage=
  | {type:'welcome';playerId:string;room:RoomInfo;checkpoint?:RunCheckpoint}
  | {type:'room';room:RoomInfo}
  | {type:'command';playerId:string;seq:number;command:GameCommand}
  | {type:'frame';snapshot:WorldSnapshot}
  | {type:'saved';revision:number;checkpoint:RunCheckpoint}
  | {type:'begin'|'pong'}
  | {type:'error';message:string};

/** Explicit remote input whitelist. No developer, restart, map or pause commands. */
export function validRoomCommand(value:unknown):value is GameCommand {
  const c=value as GameCommand;if(!c||typeof c!=='object')return false;
  const point=(v:unknown):boolean=>{const p=v as {x:number;y:number};return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<10000&&Math.abs(p.y)<10000;};
  switch(c.type){
    case 'Stop':case 'LeaveShop':case 'CancelSkill':return true;
    case 'MoveTo':case 'Attack':return point(c.point);
    case 'DirectInput':return point(c.movement)&&Math.hypot(c.movement.x,c.movement.y)<=1.001;
    case 'AttackInput':return c.point===undefined||point(c.point);
    case 'CastSlot':return SKILL_SLOTS.includes(c.slot)&&point(c.point);
    case 'CastSkill':return HERO_SKILLS.includes(c.skillId)&&point(c.point);
    case 'ConfirmSkill':return SKILL_SLOTS.includes(c.slot);
    case 'ChooseReward':return typeof c.choiceId==='string'&&c.choiceId.length<80;
    case 'BuyEquipment':return SHOP_CATALOG.includes(c.equipmentId)&&(c.replaceSlot===undefined||EQUIPMENT_SLOTS.includes(c.replaceSlot));
    case 'EquipEquipment':return SHOP_CATALOG.includes(c.equipmentId)&&(c.slot===undefined||EQUIPMENT_SLOTS.includes(c.slot));
    case 'UnequipEquipment':return EQUIPMENT_SLOTS.includes(c.slot);
    default:return false;
  }
}
