import { CLIPS,type AnimationClips } from './animation';
import type { AtlasId } from './art-manifest';
/** Stable presentation IDs. Gameplay never imports Cocos nodes, sprites or animation clips. */
export interface UnitAppearance {shape:'hero'|'stone'|'spirit';body:string;highlight:string;accent:string}
export const UNIT_APPEARANCES:Record<string,UnitAppearance> = {
  grovewarden:{shape:'stone',body:'#ACB09D',highlight:'#DAD1AF',accent:'#DCAE5C'},
  hero:{shape:'hero',body:'#4B8190',highlight:'#6FA5AC',accent:'#E5A16A'},
  moss:{shape:'stone',body:'#A98C7C',highlight:'#C7AE91',accent:'#839E8B'},
  mistling:{shape:'spirit',body:'#9D96B9',highlight:'#CEC2D6',accent:'#F2DAB2'},
  frostling:{shape:'spirit',body:'#78B8D4',highlight:'#D8F7FA',accent:'#9CEAFF'},
};
/** Enemy definitions choose appearance IDs; new sheets/timings need no renderer branches. */
export interface UnitSprite {atlas:AtlasId;pixelScale:number;height:number;tint:string;clips:AnimationClips}
export const UNIT_SPRITES:Record<string,UnitSprite>={
  moss:{atlas:'ruin-sprite',pixelScale:.20,height:58,tint:'#FFFFFF',clips:CLIPS},
  mistling:{atlas:'ruin-sprite',pixelScale:.20,height:58,tint:'#C4D9ED',clips:CLIPS},
  frostling:{atlas:'ruin-sprite',pixelScale:.20,height:58,tint:'#B2E8FF',clips:CLIPS},
  grovewarden:{atlas:'grovewarden',pixelScale:.30,height:90,tint:'#FFFFFF',clips:CLIPS},
};
export interface EnvironmentAppearance {
  atlas:AtlasId;frames:{pillar:number;rubble:number;shrub:number;foliage:number;crystal:number;arch:number;waterfall:number;paving:number;crest:number};
  waterOuter:string;waterInner:string;seam:string;
}
export const ENVIRONMENT_APPEARANCES:Record<string,EnvironmentAppearance>={
  livingRuins:{atlas:'environment',frames:{pillar:0,rubble:1,shrub:2,foliage:3,crystal:4,arch:5,waterfall:6,paving:7,crest:8},waterOuter:'#87BFC3',waterInner:'#B1D5CE',seam:'#D6D4BE'},
  frostRuins:{atlas:'environment',frames:{pillar:0,rubble:1,shrub:2,foliage:3,crystal:4,arch:5,waterfall:6,paving:7,crest:8},waterOuter:'#8FBECF',waterInner:'#BCD8DF',seam:'#CBD6D2'},
};
export const EFFECT_APPEARANCES:Record<string,{color:string;core:string}> = {
  physical:{color:'#99744A',core:'#FFE5A3'},
  fire:{color:'#E4A16C',core:'#FFF0B6'},ice:{color:'#83CEEE',core:'#E5FFFF'},
  mist:{color:'#B59CC6',core:'#F3C6E1'},shield:{color:'#BFECF2',core:'#E8FDFF'},
};

/** Stable appearance IDs are independent of item IDs and gameplay values. */
export interface EquipmentAppearance {layer:'weapon'|'body'|'head';shape:'sword'|'staff'|'bow'|'shield'|'armor'|'robe'|'leather'|'helm'|'circlet'|'hood';color:string;accent:string}
export const EQUIPMENT_APPEARANCES:Record<string,EquipmentAppearance>={
  copperSword:{layer:'weapon',shape:'sword',color:'#E8C69B',accent:'#BD6E4E'},
  starStaff:{layer:'weapon',shape:'staff',color:'#BAA1E5',accent:'#8DEBFF'},
  windBow:{layer:'weapon',shape:'bow',color:'#CDA87C',accent:'#BDE1A7'},
  towerShield:{layer:'weapon',shape:'shield',color:'#779DBB',accent:'#E2E6C2'},
  copperPlate:{layer:'body',shape:'armor',color:'#AA705E',accent:'#E5BD82'},
  starRobe:{layer:'body',shape:'robe',color:'#7663B0',accent:'#D6C4F4'},
  rangerLeather:{layer:'body',shape:'leather',color:'#608C6D',accent:'#D4C596'},
  ironHelm:{layer:'head',shape:'helm',color:'#8CA7B8',accent:'#F1D4A0'},
  arcaneCirclet:{layer:'head',shape:'circlet',color:'#E5C882',accent:'#C2A0F1'},
  rangerHood:{layer:'head',shape:'hood',color:'#527D65',accent:'#BDD29B'},
};

export interface EquipmentSprite {frame:number;width:number;height:number;anchorY?:number;y?:number}
export const EQUIPMENT_SPRITES:Record<string,EquipmentSprite>={
 copperSword:{frame:0,width:13,height:42,anchorY:.2},starStaff:{frame:1,width:16,height:48,anchorY:.2},windBow:{frame:2,width:21,height:42,anchorY:.2},towerShield:{frame:3,width:24,height:32,anchorY:.5},
 copperPlate:{frame:4,width:29,height:27,y:27},starRobe:{frame:5,width:29,height:27,y:27},rangerLeather:{frame:6,width:29,height:27,y:27},
 ironHelm:{frame:7,width:35,height:35,y:47},arcaneCirclet:{frame:8,width:29,height:11,y:48},rangerHood:{frame:9,width:35,height:35,y:47},
};
