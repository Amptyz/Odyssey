import type { Vec2 } from '../utils/math';
import type { EnemyKind } from './enemies';
import type { LocationDefinition } from './locations';
import { DEFAULT_LOADOUT,type Loadout } from './skills';
export interface MapObstacle extends Vec2 {id:string;radius:number;height:number}
export interface EnemySpawnGroup {id:string;center:Vec2;radius:number;spawns:readonly {enemyId:EnemyKind;count:number}[]}
export interface LevelDefinition extends LocationDefinition {id:string;start:Vec2;exit:Vec2&{radius:number};route:readonly Vec2[];groups:readonly EnemySpawnGroup[]}
export interface WaveDefinition {spawns:readonly {enemyId:EnemyKind;count:number}[];hpScale:number;level?:LevelDefinition}
export interface MapDefinition extends LocationDefinition {
  width:number;height:number;heroSpawn:Vec2;spawnMargin:number;spawnDistance:number;environment:string;
  groundEmblems?:readonly Vec2[];obstacles:readonly MapObstacle[];waves:readonly WaveDefinition[];loadout:Loadout;
  theme:{floorA:string;floorB:string;border:string;edge:string;stone:string;accent:string};
}
const point=(x:number,y:number):Vec2=>({x,y});
const group=(id:string,x:number,y:number,spawns:EnemySpawnGroup['spawns']):EnemySpawnGroup=>({id,center:point(x,y),radius:3.2,spawns});
function level(id:string,location:LocationDefinition,start:Vec2,end:Vec2,route:Vec2[],groups:EnemySpawnGroup[]):WaveDefinition {
  const totals=new Map<EnemyKind,number>();for(const group of groups)for(const spawn of group.spawns)totals.set(spawn.enemyId,(totals.get(spawn.enemyId)??0)+spawn.count);
  return{hpScale:1,spawns:Array.from(totals,([enemyId,count])=>({enemyId,count})),level:{id,...location,start,exit:{...end,radius:1.8},route:[start,...route,end],groups}};
}
const emberObstacles:MapObstacle[]=[{id:'entry-pillar',x:6,y:6,radius:.85,height:64},
  ...[5,9,13,17,31,35,39].map((y,i)=>({id:`ember-spine-${i}`,x:28,y,radius:2.2,height:92})),
  {id:'ember-west-ruin',x:13,y:23,radius:2.1,height:76},{id:'ember-north-ruin',x:42,y:5,radius:1.5,height:66},
  {id:'ember-south-ruin',x:37,y:38,radius:1.8,height:70},{id:'ember-garden-rock',x:8,y:28,radius:1.3,height:32}];
const frostObstacles:MapObstacle[]=[
  ...[4,8,12,32,36,40].map((y,i)=>({id:`frost-spine-${i}`,x:30,y,radius:2.2,height:92})),
  {id:'frost-west-mirror',x:13,y:20,radius:2,height:82},{id:'frost-east-mirror',x:45,y:19,radius:2,height:82},
  {id:'frost-north-ice',x:42,y:5,radius:1.5,height:62},{id:'frost-south-ice',x:19,y:39,radius:1.6,height:62}];
export const MAPS = {
  ember:{name:'余烬庭院',environment:'livingRuins',width:56,height:44,heroSpawn:point(7,8),spawnMargin:2,spawnDistance:6,
    loadout:{...DEFAULT_LOADOUT},theme:{floorA:'#EEE5CF',floorB:'#E8DFC9',border:'#C4C7AD',edge:'#A1BCAF',stone:'#D5D2BC',accent:'#EFCB8B'},obstacles:emberObstacles,
    waves:[
      level('ember-1',{name:'余烬庭院·一',subtitle:'苔阶巡径'},point(7,8),point(48,10),[point(17,11),point(23,24),point(35,24),point(43,12)],[group('moss-gate',17,11,[{enemyId:'melee',count:2},{enemyId:'ranged',count:1}]),group('east-verge',38,16,[{enemyId:'melee',count:2},{enemyId:'ranged',count:1}])]),
      level('ember-2',{name:'余烬庭院·二',subtitle:'赤铜南廊'},point(8,35),point(48,34),[point(19,34),point(23,24),point(35,24),point(42,33)],[group('armored-stairs',19,34,[{enemyId:'melee',count:2},{enemyId:'stoneback',count:1}]),group('reed-bridge',40,31,[{enemyId:'stoneback',count:1},{enemyId:'reedLancer',count:2}])]),
      level('ember-3',{name:'余烬庭院·三',subtitle:'日芽回庭'},point(8,9),point(10,37),[point(20,12),point(22,25),point(19,34)],[group('sunlit-court',20,12,[{enemyId:'sunbud',count:1},{enemyId:'ranged',count:1}]),group('warden-garden',19,34,[{enemyId:'sunbud',count:1},{enemyId:'ranged',count:1},{enemyId:'warden',count:1}])]),
      level('ember-4',{name:'余烬庭院·四',subtitle:'双钟折径'},point(49,9),point(8,37),[point(39,13),point(35,24),point(22,24),point(17,34)],[group('ram-court',40,14,[{enemyId:'melee',count:2},{enemyId:'emberRam',count:1}]),group('bell-court',17,34,[{enemyId:'reedLancer',count:2},{enemyId:'bellKeeper',count:1}])]),
      level('ember-5',{name:'余烬庭院·五',subtitle:'庭院炉心'},point(8,23),point(51,32),[point(21,24),point(35,24),point(40,31)],[group('hearth-sanctum',45,32,[{enemyId:'courtyardHeart',count:1}])]),
    ]},
  frost:{name:'霜镜回廊',environment:'frostRuins',width:60,height:44,heroSpawn:point(8,8),spawnMargin:2,spawnDistance:6,
    loadout:{...DEFAULT_LOADOUT},theme:{floorA:'#E6ECE4',floorB:'#DDE5DF',border:'#ACC8CD',edge:'#82B5BF',stone:'#A2C9D8',accent:'#E2FCFF'},obstacles:frostObstacles,
    waves:[
      level('frost-1',{name:'霜镜回廊·一',subtitle:'霜足迎廊'},point(8,8),point(53,9),[point(18,11),point(24,22),point(36,22),point(46,11)],[group('hare-steps',18,11,[{enemyId:'snowHare',count:2},{enemyId:'frostling',count:1}]),group('frost-verge',44,12,[{enemyId:'snowHare',count:1},{enemyId:'frostling',count:1}])]),
      level('frost-2',{name:'霜镜回廊·二',subtitle:'镜壳环阶'},point(52,35),point(8,34),[point(43,34),point(36,23),point(24,23),point(17,34)],[group('shell-terrace',43,34,[{enemyId:'shardCrab',count:2},{enemyId:'rimeMoth',count:1}]),group('chime-path',18,33,[{enemyId:'rimeMoth',count:1},{enemyId:'chimeSentry',count:1}])]),
      level('frost-3',{name:'霜镜回廊·三',subtitle:'骑士斜廊'},point(8,34),point(52,8),[point(18,32),point(24,22),point(37,22),point(47,11)],[group('hare-crossing',18,32,[{enemyId:'snowHare',count:2}]),group('knight-court',43,12,[{enemyId:'frostling',count:1},{enemyId:'mirrorKnight',count:1}])]),
      level('frost-4',{name:'霜镜回廊·四',subtitle:'织霜归路'},point(52,9),point(9,35),[point(43,12),point(37,23),point(24,23),point(18,34)],[group('crab-watch',41,12,[{enemyId:'shardCrab',count:2},{enemyId:'chimeSentry',count:1}]),group('woven-court',18,33,[{enemyId:'rimeWeaver',count:1},{enemyId:'chimeSentry',count:1}])]),
      level('frost-5',{name:'霜镜回廊·五',subtitle:'明镜终殿'},point(8,22),point(54,31),[point(23,22),point(36,22),point(40,30)],[group('mirror-sanctum',47,31,[{enemyId:'mirrorRegent',count:1}])]),
    ]},
} satisfies Record<string,MapDefinition>;
export type MapId=keyof typeof MAPS;
export function mapDefinition(id:MapId):MapDefinition{return MAPS[id];}
