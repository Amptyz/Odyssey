import type {InteractionDefinition} from '../content/scenes';
import type {LocationDefinition} from '../content/locations';
import {distance,type Vec2} from '../utils/math';
export interface SceneMember extends Vec2 {id:string;active:boolean;alive:boolean;panel?:string;claimed:readonly string[]}
export interface SceneSnapshot extends LocationDefinition {
  id:string;kind:'camp'|'combat';hostId:string;
  interactions:(InteractionDefinition&{claimed:boolean})[];
  nearbyId?:string;prompt:string;requiredIds:string[];insideIds:string[];canDepart:boolean;
}
/** Range checks, per-player claim state and readiness use authoritative world coordinates. */
export function inspectScene(id:string,location:LocationDefinition,camp:boolean,nodes:readonly InteractionDefinition[],members:readonly SceneMember[],playerId:string,hostId:string):SceneSnapshot {
  const local=members.find(p=>p.id===playerId)!,required=members.filter(p=>p.active&&p.alive),departure=nodes.find(n=>n.kind==='departure');
  const inside=required.filter(p=>departure&&distance(p,departure)<=departure.radius);
  const missing=required.filter(p=>nodes.some(n=>n.required&&!p.claimed.includes(n.id)));
  const canDepart=!!departure&&required.length>0&&inside.length===required.length&&!missing.length&&required.every(p=>!p.panel);
  const nearest=local.active&&local.alive&&!local.panel?nodes.filter(n=>distance(local,n)<=n.radius&&(n.kind!=='ember'||!local.claimed.includes(n.id))).sort((a,b)=>distance(local,a)-distance(local,b)||a.id.localeCompare(b.id))[0]:undefined;
  const prompt=nearest?.kind==='departure'?(missing.length?'请全员先选择初始余烬':inside.length<required.length?`等待队友集合 · ${inside.length}/${required.length}`:required.some(p=>p.panel)?'等待队友完成交互':playerId!==hostId?'已准备 · 等待房主出发':`F · ${nearest.name}`):nearest?`F · ${nearest.kind==='ember'?'选择余烬':'与行商交易'}`:'';
  return {id,name:location.name,subtitle:location.subtitle,kind:camp?'camp':'combat',hostId,interactions:nodes.map(n=>({...n,claimed:local.claimed.includes(n.id)})),nearbyId:nearest?.id,prompt,requiredIds:required.map(p=>p.id),insideIds:inside.map(p=>p.id),canDepart};
}
