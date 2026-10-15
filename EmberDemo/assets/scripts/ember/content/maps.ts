import type { Vec2 } from '../utils/math';
import type { EnemyKind } from './enemies';
import { DEFAULT_LOADOUT,type Loadout } from './skills';
export interface MapObstacle extends Vec2 {id:string;radius:number;height:number}
export interface WaveDefinition {spawns:readonly {enemyId:EnemyKind;count:number}[];hpScale:number}
export interface MapDefinition {
  name:string;width:number;height:number;heroSpawn:Vec2;spawnMargin:number;spawnDistance:number;
  obstacles:readonly MapObstacle[];waves:readonly WaveDefinition[];loadout:Loadout;
  theme:{floorA:string;floorB:string;border:string;edge:string;stone:string;accent:string};
}
export const MAPS = {
  ember:{name:'余烬庭院',width:20,height:20,heroSpawn:{x:10,y:10},spawnMargin:1.5,spawnDistance:6,
    loadout:{...DEFAULT_LOADOUT},theme:{floorA:'#CBD4BE',floorB:'#C3CFB9',border:'#8FA69D',edge:'#657F7B',stone:'#96ADA1',accent:'#EFCB8B'},
    obstacles:[
      {id:'pillar-n',x:6,y:6,radius:0.85,height:64},{id:'pillar-e',x:14,y:6,radius:0.85,height:64},
      {id:'pillar-s',x:14,y:14,radius:0.85,height:64},{id:'pillar-w',x:6,y:14,radius:0.85,height:64},
      {id:'rock-e',x:16.5,y:10,radius:0.65,height:28},{id:'rock-w',x:3.5,y:10,radius:0.65,height:28}],
    waves:[{spawns:[{enemyId:'melee',count:4},{enemyId:'ranged',count:1}],hpScale:1},
      {spawns:[{enemyId:'melee',count:6},{enemyId:'ranged',count:3}],hpScale:1.15},
      {spawns:[{enemyId:'melee',count:8},{enemyId:'ranged',count:5}],hpScale:1.3}]},
  frost:{name:'霜镜回廊',width:24,height:16,heroSpawn:{x:12,y:8},spawnMargin:1.5,spawnDistance:6,
    loadout:{...DEFAULT_LOADOUT,Q:'icebolt'},theme:{floorA:'#D0E3E4',floorB:'#BCD6DB',border:'#8EB9CA',edge:'#557F96',stone:'#A2C9D8',accent:'#E2FCFF'},
    obstacles:[{id:'ice-n',x:7,y:4,radius:0.8,height:58},{id:'ice-e',x:17,y:4,radius:0.8,height:58},
      {id:'ice-w',x:7,y:12,radius:0.8,height:58},{id:'ice-s',x:17,y:12,radius:0.8,height:58},
      {id:'ice-west',x:4,y:8,radius:0.6,height:26},{id:'ice-east',x:20,y:8,radius:0.6,height:26}],
    waves:[{spawns:[{enemyId:'melee',count:3},{enemyId:'frostling',count:2}],hpScale:1},
      {spawns:[{enemyId:'melee',count:5},{enemyId:'frostling',count:3}],hpScale:1.15}]},
} as const satisfies Record<string,MapDefinition>;
export type MapId=keyof typeof MAPS;
export function mapDefinition(id:MapId):MapDefinition{return MAPS[id];}
