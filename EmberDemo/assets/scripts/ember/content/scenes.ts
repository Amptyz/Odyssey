import {mapDefinition,type MapDefinition,type MapId} from './maps';
import type {LocationDefinition} from './locations';
import type {Vec2} from '../utils/math';

export interface RestStop extends LocationDefinition {merchant:boolean;ember:boolean}
export interface JourneyDefinition {camp:LocationDefinition;rests:Readonly<Partial<Record<number,RestStop>>>;clearEmbers:readonly number[]}
/** Keys are completed level numbers. A stop precedes the NEXT level. */
export const JOURNEYS:Record<MapId,JourneyDefinition>={
  ember:{camp:{name:'余烬庭院',subtitle:'启程营地'},rests:{
    2:{name:'余烬庭院·行商营地',subtitle:'第 2 关后的休息点',merchant:true,ember:true},
    4:{name:'余烬庭院·炉前营地',subtitle:'第 4 关后的休息点',merchant:true,ember:false},
  },clearEmbers:[1,3,5]},
  frost:{camp:{name:'霜镜回廊',subtitle:'启程营地'},rests:{
    2:{name:'霜镜回廊·镜畔营地',subtitle:'第 2 关后的休息点',merchant:true,ember:true},
    4:{name:'霜镜回廊·殿前营地',subtitle:'第 4 关后的休息点',merchant:true,ember:false},
  },clearEmbers:[1,3,5]},
};
/** One resolver for every player's snapshot; display names never form save/claim IDs. */
export function sceneLocation(mapId:MapId,wave:number,camp:boolean):LocationDefinition {
  const location=camp?(wave===0?JOURNEYS[mapId].camp:JOURNEYS[mapId].rests[wave]):mapDefinition(mapId).waves[Math.max(0,wave-1)]?.level;
  if(!location)throw new Error(`Missing location: ${mapId}/${camp?'camp':'level'}/${wave}`);
  return {name:location.name,subtitle:location.subtitle};
}
export type InteractionKind='ember'|'merchant'|'departure';
export interface InteractionDefinition extends Vec2 {id:string;kind:InteractionKind;name:string;radius:number;required?:boolean}
export const CAMP={width:24,height:20,spawn:{x:7,y:12},ember:{x:12,y:10},merchant:{x:8,y:6},departure:{x:19,y:9,radius:2.2}} as const;
/** Same theme/assets as the selected journey; distinct, traversable geometry. */
export function campMap(mapId:MapId):MapDefinition {
  return {...mapDefinition(mapId),width:CAMP.width,height:CAMP.height,heroSpawn:{...CAMP.spawn},groundEmblems:[{...CAMP.ember}],
    obstacles:[{id:'camp-west',x:3,y:4,radius:1.1,height:70},{id:'camp-east',x:21,y:16,radius:1.1,height:70}]};
}
export function sceneInteractions(mapId:MapId,wave:number,camp:boolean,cleared:boolean):InteractionDefinition[] {
  const key=camp?`camp:${wave}`:`level:${wave}`,nodes:InteractionDefinition[]=[];
  if(camp){
    const stop=JOURNEYS[mapId].rests[wave];
    if(wave===0||stop?.ember)nodes.push({id:`${key}:ember`,kind:'ember',name:wave===0?'初始余烬':'余烬',...CAMP.ember,radius:1.7,required:wave===0});
    if(stop?.merchant)nodes.push({id:`${key}:merchant`,kind:'merchant',name:'行商',...CAMP.merchant,radius:1.8});
    nodes.push({id:`${key}:departure`,kind:'departure',name:'出发点',...CAMP.departure});
  }else if(cleared){
    const exit=mapDefinition(mapId).waves[wave-1]!.level!.exit;
    if(JOURNEYS[mapId].clearEmbers.includes(wave))nodes.push({id:`${key}:ember`,kind:'ember',name:'清场余烬',x:exit.x-3.5,y:exit.y,radius:1.6});
    nodes.push({id:`${key}:departure`,kind:'departure',name:wave===mapDefinition(mapId).waves.length?'完成试炼':'关卡出口',...exit});
  }
  return nodes;
}
