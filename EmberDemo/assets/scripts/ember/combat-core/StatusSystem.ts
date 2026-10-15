import { STATUSES,statusDefinition,type StatusApplication } from '../content/statuses';
import type { SkillId } from '../content/skills';
import type { Actor,StatusInstance,Hit } from './types';

export function applyStatus(target:Actor,application:StatusApplication,sourceId:string,skillId?:SkillId):void {
  const def=STATUSES[application.id];
  if(!def||!Number.isFinite(application.duration)||application.duration<=0||!Number.isFinite(application.power))return;
  if(application.id==='slow'&&(application.power<=0||application.power>1))return;
  if(application.id==='burn'&&application.power<=0)return;
  const old=target.statuses.find(s=>s.id===application.id);
  if(old){
    const stronger=def.strength==='higher'?application.power>=old.power:application.power<=old.power;
    if(stronger){old.power=application.power;old.sourceId=sourceId;old.skillId=skillId;}
    old.remaining=Math.max(old.remaining,application.duration);
  }else target.statuses.push({id:application.id,power:application.power,remaining:application.duration,tickIn:def.interval,sourceId,skillId});
}
export function tickStatuses(actor:Actor,dt:number,onTick:(status:StatusInstance,hit:Hit)=>void):void {
  if(!actor.alive)return;
  // Capture the starting set: event chains may add statuses while a tick is resolving.
  for(const status of [...actor.statuses]){
    const def=statusDefinition(status.id),elapsed=Math.min(dt,status.remaining);
    status.remaining=Math.max(0,status.remaining-dt);
    if(def.interval>0){
      status.tickIn-=elapsed;
      while(status.tickIn<=1e-8&&actor.alive){status.tickIn+=def.interval;if(def.handler==='damage')onTick(status,{sourceId:status.sourceId,targetId:actor.id,amount:status.power,cause:def.cause??'skill',skillId:status.skillId});}
    }
  }
  actor.statuses=actor.statuses.filter(s=>s.remaining>1e-8);
}
export function movementMultiplier(actor:Actor):number {
  return actor.statuses.reduce((value,status)=>STATUSES[status.id].handler==='speed'?Math.min(value,status.power):value,1);
}
