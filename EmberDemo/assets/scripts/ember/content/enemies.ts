import {scaleAttackRange} from './attacks';
import type {UnitTemplate} from '../combat-core/attributes/AttributeSet';
import type {SkillId} from './skills';
export type EnemyBehaviorId='melee'|'ranged'|'monster';
export interface EnemyDefinition {
  name:string;template:UnitTemplate;radius:number;windup:number;recovery:number;
  behavior:EnemyBehaviorId;appearance:string;skillId?:SkillId;attackArc?:number;
  category:'normal'|'elite'|'boss';map:'ember'|'frost';actionSet:string;ai?:string;keepDistance?:number;strafe?:number;
  boss?:{threshold:number;loop:number;phase1:readonly {at:number;action:string}[];phase2:readonly {at:number;action:string}[]};
}
function define(name:string,map:EnemyDefinition['map'],category:EnemyDefinition['category'],hp:number,ad:number,ap:number,armor:number,mr:number,period:number,ms:number,range:number,radius:number,windup:number,actionSet:string,extra:Partial<EnemyDefinition>={}):EnemyDefinition {
 return {name,map,category,template:{stats:{maxHealth:hp,attackDamage:ad,abilityPower:ap,armor,magicResist:mr,moveSpeed:ms,attackRange:scaleAttackRange(range)},baseAttackSpeed:1/period,attackSpeedRatio:1/period,resourceKind:'none',classification:'monster'},radius,windup,recovery:period-windup,behavior:'monster',appearance:actionSet,actionSet,...extra};
}
/** One shared attribute model. Behaviour is selected by action sets, never GameWorld ID branches. */
export const ENEMIES={
 melee:define('苔刃精灵','ember','normal',80,12,0,5,0,1.6,312,.95,.30,.45,'melee'),
 ranged:define('雾灯精灵','ember','normal',65,8,18,0,10,3,264,6.5,.28,.75,'ranged',{keepDistance:3.5}),
 stoneback:define('石背甲虫','ember','normal',150,15,0,45,0,2.5,276,1.05,.42,.8,'stoneback'),
 reedLancer:define('芦枪侍从','ember','normal',95,16,0,10,5,2.5,300,2.7,.30,.85,'reedLancer',{keepDistance:2}),
 sunbud:define('日芽投手','ember','normal',72,10,24,0,15,4,288,5.5,.30,1.1,'sunbud',{keepDistance:3}),
 frostling:define('霜叶精灵','frost','normal',78,8,20,0,15,3.5,264,6,.28,.9,'frostling',{keepDistance:3}),
 shardCrab:define('镜壳蟹','frost','normal',110,15,0,30,5,2,300,1.35,.34,.6,'shardCrab'),
 rimeMoth:define('霜纱蛾','frost','normal',62,6,20,0,20,4,312,5,.26,.95,'rimeMoth',{keepDistance:2.5,strafe:.7}),
 chimeSentry:define('铃冠哨兵','frost','normal',90,18,0,15,0,4.5,276,8,.30,1.2,'chimeSentry',{keepDistance:5}),
 snowHare:define('霜足跳兽','frost','normal',68,10,0,0,0,1,396,.8,.26,.35,'snowHare',{strafe:.5}),
 warden:define('古树守卫','ember','elite',660,26,15,30,15,3,276,1.8,.62,.85,'warden'),
 emberRam:define('苔角冲阵者','ember','elite',480,28,0,15,10,2.5,336,1.2,.48,.65,'emberRam'),
 bellKeeper:define('回响钟侍','ember','elite',420,12,38,5,25,4,264,6.5,.48,.85,'bellKeeper',{keepDistance:3}),
 mirrorKnight:define('镜棱骑士','frost','elite',600,30,15,35,15,3,300,2.2,.56,.8,'mirrorKnight'),
 rimeWeaver:define('霜环织者','frost','elite',450,10,42,0,30,4,276,6,.50,.9,'rimeWeaver',{keepDistance:3}),
 courtyardHeart:define('庭院司炉者','ember','boss',7200,42,45,30,30,4,276,2.4,.9,1,'courtyardHeart',{boss:{threshold:.6,loop:20,phase1:[{at:2,action:'hearthFurrows'},{at:6,action:'hearthSeeds'},{at:12,action:'hearthVent'}],phase2:[{at:2,action:'hearthSeeds'},{at:7,action:'hearthFurrows'},{at:11,action:'hearthVent'}]}}),
 mirrorRegent:define('霜镜执仪者','frost','boss',8000,35,55,25,25,4.5,288,2.6,.85,1.1,'mirrorRegent',{boss:{threshold:.5,loop:24,phase1:[{at:2,action:'regentLanes'},{at:7,action:'regentHalo'},{at:13,action:'regentMarks'}],phase2:[{at:2,action:'regentLanes'},{at:7,action:'regentHalo'},{at:13,action:'regentMarks'},{at:18,action:'regentOath'}]}}),
} as const;
export type EnemyKind=keyof typeof ENEMIES;
export function enemy(id:EnemyKind):EnemyDefinition{return ENEMIES[id];}
