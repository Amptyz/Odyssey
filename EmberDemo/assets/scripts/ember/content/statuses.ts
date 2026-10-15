import type { Cause } from '../combat-core/types';
export interface StatusDefinition {name:string;stacking:'strongest-refresh';strength:'higher'|'lower';interval:number;handler:'damage'|'speed';color:string;cause?:Cause}
/** A status is unique per target/id. Reapplication keeps the stronger power and longer duration. */
export const STATUSES = {
  burn: {name:'灼烧',stacking:'strongest-refresh',strength:'higher',interval:1,handler:'damage',cause:'burn',color:'#EDAB62'},
  slow: {name:'减速',stacking:'strongest-refresh',strength:'lower',interval:0,handler:'speed',color:'#A9E5F1'},
} as const satisfies Record<string,StatusDefinition>;
export type StatusId=keyof typeof STATUSES;
export interface StatusApplication {id:StatusId;duration:number;power:number}

export function statusDefinition(id:StatusId):StatusDefinition{return STATUSES[id];}
