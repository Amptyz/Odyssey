import type { Cause } from '../combat-core/types';
export interface StatusDefinition {name:string;stacking:'strongest-refresh'|'add-refresh';maxStacks?:number;strength:'higher'|'lower';interval:number;handler:'damage'|'speed';color:string;cause?:Cause}
/** Damage statuses retain independent target/id/source ownership; slows retain independent durations and use the strongest active instance. */
export const STATUSES = {
  burn: {name:'灼烧',stacking:'strongest-refresh',strength:'higher',interval:1,handler:'damage',cause:'burn',color:'#EDAB62'},
  infernal: {name:'导管灼烧',stacking:'add-refresh',maxStacks:5,strength:'higher',interval:1,handler:'damage',cause:'burn',color:'#DDA582'},
  slow: {name:'减速',stacking:'strongest-refresh',strength:'lower',interval:0,handler:'speed',color:'#A9E5F1'},
} as const satisfies Record<string,StatusDefinition>;
export type StatusId=keyof typeof STATUSES;
export interface StatusApplication {id:StatusId;duration:number;power:number}

export function statusDefinition(id:StatusId):StatusDefinition{return STATUSES[id];}
