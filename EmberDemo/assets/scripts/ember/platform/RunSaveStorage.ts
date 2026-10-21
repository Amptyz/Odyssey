import {mapDefinition} from '../content/maps';
import {parseRunCheckpoint,type RunCheckpoint} from '../simulation/RunCheckpoint';

export const SOLO_SAVE_KEY='ember.solo.run.v1';
export const MAX_SAVE_BYTES=2*1024*1024;
export interface RunStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export interface StoredSoloRun {format:'ember-solo-save';version:1;savedAt:number;checkpoint:RunCheckpoint}
export interface LocalSaveSnapshot {available:boolean;label:string;savedAt?:number;notice:string;revision:number;hasCheckpoint:boolean}

export function browserRunStorage():RunStorage|undefined {
  // Access may throw in private/restricted browser contexts; keep the failure in the save UI.
  if(typeof window==='undefined'&&typeof localStorage==='undefined')return undefined;
  return{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
}
/** Accept our file envelope, a raw v4/v5 checkpoint, or an existing single-player room backup. */
export function parseSoloRun(input:unknown):StoredSoloRun {
  if(typeof input==='string'&&input.length>MAX_SAVE_BYTES)throw Error('存档文件超过 2 MB。');
  let value:unknown=input;
  if(typeof input==='string'){try{value=JSON.parse(input);}catch{throw Error('文件不是有效的 JSON 存档。');}}
  const raw=value as Partial<StoredSoloRun>|null;
  if(!raw||typeof raw!=='object')throw Error('存档内容无效。');
  if(raw.format!==undefined&&(raw.format!=='ember-solo-save'||raw.version!==1))throw Error('单人存档版本不支持。');
  if(raw.savedAt!==undefined&&(!Number.isFinite(raw.savedAt)||raw.savedAt<0))throw Error('存档时间无效。');
  const checkpoint=parseRunCheckpoint(raw.checkpoint??raw);
  if(checkpoint.players.length!==1||checkpoint.players[0]!.id!=='hero')throw Error('这是多人存档，请通过原联机房间码恢复。');
  return{format:'ember-solo-save',version:1,savedAt:raw.savedAt??0,checkpoint};
}
export function soloRunLabel(c:RunCheckpoint):string {
  const stage=c.phase==='fighting'?`第 ${c.wave} 关起点`:c.phase==='cleared'?`第 ${c.wave} 关已清场`:c.phase==='camp'?(c.wave===0?'启程营地':`第 ${c.wave} 关后休息点`):c.phase==='victory'?'已通关':'准备出发';
  return`${mapDefinition(c.mapId).name} · ${stage}`;
}
