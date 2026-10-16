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
/** Screen-left / screen-right in the unmirrored paper doll. Coordinates are local rig units.
 * The atlas arm tops lean inward: frame 3 belongs on the left, frame 2 on the right.
 * Anchor the actual shoulder joint, not the center of the trimmed image's top edge.
 */
export interface HeroArmAttachment {frame:number;width:number;height:number;anchor:[number,number];shoulder:[number,number];grip:[number,number]}
export const HERO_ARM_ATTACHMENTS:Record<'left'|'right',HeroArmAttachment>={
  left:{frame:3,width:8,height:19,anchor:[.74,.93],shoulder:[-7.9,32.6],grip:[.28,.15]},
  right:{frame:2,width:8,height:19,anchor:[.24,.93],shoulder:[9.5,34.2],grip:[.74,.15]},
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

  reaver:{layer:'weapon',shape:'sword',color:'#B5ACA0',accent:'#8D4F4A'},
  runeblade:{layer:'weapon',shape:'sword',color:'#ADB9B1',accent:'#79B4C4'},
  duelistVest:{layer:'body',shape:'armor',color:'#AE8969',accent:'#D0B497'},
  wardMantle:{layer:'body',shape:'robe',color:'#718C99',accent:'#A8B6B3'},
  sanguineWrap:{layer:'body',shape:'leather',color:'#8E5550',accent:'#C7A083'},
  keenVisor:{layer:'head',shape:'helm',color:'#B9ADA0',accent:'#635D58'},
  sageMask:{layer:'head',shape:'helm',color:'#B7B7A5',accent:'#858778'},
  aegisCrown:{layer:'head',shape:'circlet',color:'#B8B49B',accent:'#91A18B'},
};

export interface EquipmentSprite {frame:number;width:number;height:number;anchorX?:number;anchorY?:number;y?:number}
export const EQUIPMENT_SPRITES:Record<string,EquipmentSprite>={
 copperSword:{frame:0,width:13,height:42,anchorX:.52,anchorY:.2},starStaff:{frame:1,width:16,height:48,anchorX:.617,anchorY:.2},windBow:{frame:2,width:21,height:42,anchorX:.825,anchorY:.55},towerShield:{frame:3,width:24,height:32,anchorY:.5},
 copperPlate:{frame:4,width:29,height:27,y:27},starRobe:{frame:5,width:29,height:27,y:27},rangerLeather:{frame:6,width:29,height:27,y:27},
 ironHelm:{frame:7,width:35,height:35,y:47},arcaneCirclet:{frame:8,width:29,height:11,y:48},rangerHood:{frame:9,width:35,height:35,y:47},
};

/** Code-native equipment shapes, in the existing rig's local units. Weapon origin is
 * the palm (0,0); body/head origins are the torso/head centers. No atlas aliases. */
export interface EquipmentPolygon {points:readonly (readonly [number,number])[];fill:string;outline?:boolean}
export interface ProceduralEquipment {layer:'weapon'|'body'|'head';y:number;polygons:readonly EquipmentPolygon[]}
export const PROCEDURAL_EQUIPMENT:Readonly<Record<string,ProceduralEquipment>>={
  reaver:{layer:'weapon',y:0,polygons:[
    {points:[[-2,-7],[2,-7],[2,5],[-2,5]],fill:'#795D50'},
    {points:[[-5,3],[5,3],[5,6],[-5,6]],fill:'#BA9471'},
    {points:[[-4,6],[4,6],[6,20],[1,27],[-4,23]],fill:'#B5ACA0'},
    {points:[[-1,8],[1,8],[2,20],[0,23]],fill:'#8D4F4A',outline:false},
  ]},
  runeblade:{layer:'weapon',y:0,polygons:[
    {points:[[-2,-7],[2,-7],[2,5],[-2,5]],fill:'#706A60'},
    {points:[[-6,3],[6,3],[5,6],[-5,6]],fill:'#B49F77'},
    {points:[[-5,6],[5,6],[5,26],[0,32],[-5,26]],fill:'#ADB9B1'},
    {points:[[-1,8],[1,8],[1,25],[0,28],[-1,25]],fill:'#79B4C4',outline:false},
  ]},
  duelistVest:{layer:'body',y:27,polygons:[
    {points:[[-11,10],[-6,13],[6,13],[11,9],[10,-10],[0,-13],[-10,-10]],fill:'#AE8969'},
    {points:[[-11,9],[-7,10],[-6,3],[-12,3]],fill:'#D0B497'},
    {points:[[7,10],[11,8],[12,3],[7,3]],fill:'#D0B497'},
    {points:[[-9,10],[-5,11],[9,-8],[6,-11]],fill:'#6C6154',outline:false},
    {points:[[-9,-8],[9,-8],[9,-11],[-9,-11]],fill:'#D0B497',outline:false},
  ]},
  wardMantle:{layer:'body',y:27,polygons:[
    {points:[[-10,10],[-4,12],[5,12],[11,8],[12,-12],[-12,-12]],fill:'#718C99'},
    {points:[[-5,12],[-10,14],[-16,10],[-16,3],[-10,1],[-5,5]],fill:'#A8B6B3'},
    {points:[[5,12],[11,14],[16,9],[15,2],[9,1],[5,5]],fill:'#A8B6B3'},
    {points:[[-3,11],[3,11],[4,4],[0,1],[-4,4]],fill:'#D3C9AB'},
    {points:[[-10,-8],[10,-8],[10,-11],[-10,-11]],fill:'#586F7C',outline:false},
  ]},
  sanguineWrap:{layer:'body',y:27,polygons:[
    {points:[[-11,10],[-5,12],[6,12],[11,8],[10,-11],[0,-14],[-11,-11]],fill:'#8E5550'},
    {points:[[-11,10],[-7,12],[10,-8],[7,-11]],fill:'#BB8770',outline:false},
    {points:[[7,11],[11,9],[-9,-10],[-11,-6]],fill:'#C7A083',outline:false},
    {points:[[-10,-7],[10,-7],[10,-10],[-10,-10]],fill:'#655850'},
  ]},
  keenVisor:{layer:'head',y:47,polygons:[
    {points:[[-14,7],[-10,11],[10,11],[14,7],[12,2],[-12,2]],fill:'#B9ADA0'},
    {points:[[-11,6],[11,6],[10,4],[-10,4]],fill:'#635D58',outline:false},
    {points:[[-13,6],[-10,3],[-10,-2],[-13,0]],fill:'#B49A77'},
  ]},
  sageMask:{layer:'head',y:47,polygons:[
    {points:[[-13,8],[-6,10],[-2,5],[-3,-7],[-8,-9],[-13,-4]],fill:'#B7B7A5'},
    {points:[[-11,4],[-5,4],[-6,1],[-11,1]],fill:'#625F55',outline:false},
    {points:[[-8,9],[-6,9],[-7,6],[-5,0],[-8,-4],[-7,-8],[-9,-7],[-10,-3],[-7,0],[-9,6]],fill:'#858778',outline:false},
  ]},
  aegisCrown:{layer:'head',y:47,polygons:[
    {points:[[-13,9],[13,9],[12,13],[-12,13]],fill:'#B8B49B'},
    {points:[[-13,10],[-16,12],[-15,16],[-10,17],[-7,14],[-8,10]],fill:'#91A18B'},
    {points:[[8,10],[7,14],[10,17],[15,16],[16,12],[13,10]],fill:'#91A18B'},
    {points:[[-4,11],[-4,15],[0,18],[4,15],[4,11]],fill:'#D1C5A4'},
  ]},
};
