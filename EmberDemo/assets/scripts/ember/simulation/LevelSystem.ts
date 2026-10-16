import type {LevelDefinition,MapDefinition} from '../content/maps';
import type {EnemyKind} from '../content/enemies';
import {enemy} from '../content/enemies';
import {distance,type Vec2} from '../utils/math';
export interface LevelParticipant extends Vec2 {id:string;active:boolean;alive:boolean}
export interface LevelExitProgress {active:boolean;requiredIds:string[];insideIds:string[];complete:boolean}
export interface LevelSnapshot {id:string;name:string;start:Vec2;exit:Vec2&{radius:number};route:Vec2[];remainingEnemies:number;exitActive:boolean;requiredIds:string[];insideIds:string[]}
export function levelDefinition(map:MapDefinition,wave:number):LevelDefinition {
  const index=Math.max(0,Math.min(map.waves.length-1,wave-1));const definition=map.waves[index]?.level;
  if(!definition)throw Error(`Missing level definition ${wave}`);return definition;
}
export function levelSpawn(map:MapDefinition,wave:number,playerIndex=0):Vec2 {
  const start=levelDefinition(map,wave).start,offsets=[{x:0,y:0},{x:.9,y:0},{x:0,y:.9},{x:.9,y:.9}];const offset=offsets[playerIndex%offsets.length]!;return{x:start.x+offset.x,y:start.y+offset.y};
}
/** Placement is deterministic and independent of reward/combat random streams. Caller validates actual-radius navigation. */
export function enemyPlacements(map:MapDefinition,wave:number):{enemyId:EnemyKind;at:Vec2;groupId:string;hpScale:number}[] {
  const definition=levelDefinition(map,wave),hpScale=map.waves[Math.max(0,wave-1)]?.hpScale??1;
  return definition.groups.flatMap(group=>{const ids=group.spawns.flatMap(spawn=>Array.from({length:spawn.count},()=>spawn.enemyId));
    return ids.map((enemyId,index)=>{const radius=enemy(enemyId).radius,angle=index*Math.PI*2/Math.max(1,ids.length),spread=ids.length===1?0:Math.min(group.radius,Math.max(1.6,radius*2+.4));return{enemyId,at:{x:group.center.x+Math.cos(angle)*spread,y:group.center.y+Math.sin(angle)*spread},groupId:group.id,hpScale};});});
}
export function exitProgress(map:MapDefinition,wave:number,players:readonly LevelParticipant[],remainingEnemies:number):LevelExitProgress {
  const exit=levelDefinition(map,wave).exit,required=players.filter(p=>p.active&&p.alive).slice().sort((a,b)=>a.id.localeCompare(b.id));const active=remainingEnemies===0;
  const insideIds=required.filter(p=>distance(p,exit)<=exit.radius).map(p=>p.id);return{active,requiredIds:required.map(p=>p.id),insideIds,complete:active&&required.length>0&&insideIds.length===required.length};
}
export function levelSnapshot(map:MapDefinition,wave:number,players:readonly LevelParticipant[],remainingEnemies:number):LevelSnapshot {
  const definition=levelDefinition(map,wave),progress=exitProgress(map,wave,players,remainingEnemies);return{id:definition.id,name:definition.name,start:{...definition.start},exit:{...definition.exit},route:definition.route.map(p=>({...p})),remainingEnemies,exitActive:progress.active,requiredIds:[...progress.requiredIds],insideIds:[...progress.insideIds]};
}
