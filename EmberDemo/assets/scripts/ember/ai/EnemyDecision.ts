import type {Actor} from '../combat-core/types';
import type {EnemyCondition,EnemyTargetPolicy} from '../content/enemy-behaviors';
import type {EnemyCooldownPolicy} from '../content/enemy-actions';
import {distance} from '../utils/math';

export interface CooldownTicket {
  event:'start'|'impact'|'end';consumeOnInterrupt:boolean;committed:boolean;
  entries:{key:string;seconds:number;previous:number}[];
}
export interface EnemySequenceState {
  id:string;index:number;enteredAt:number;waitingAction:boolean;policy?:EnemyTargetPolicy;forceTarget?:boolean;
}
/** Per-enemy memory. Pure simulation time, stable tie breaking, no actor references in retained state. */
export class EnemyDecision {
  targetId?:string;lastActionTargetId?:string;selectedAt=-Infinity;
  retargetReady=true;targetReason='initial';reason='sleeping';ruleId?:string;
  sequence?:EnemySequenceState;
  pauseUntil=0;pauseMovement:'stop'|'chase'='stop';
  readonly targetCounts=new Map<string,number>();
  readonly readyTimes=new Map<string,number>();
  readonly usedRules=new Set<string>();
  readonly ruleReadyTimes=new Map<string,number>();

  pick(self:Actor,players:readonly Actor[],policy:EnemyTargetPolicy,time:number,eligible:(p:Actor)=>boolean=()=>true,force=false):Actor|undefined {
    let choices=players.filter(p=>p.alive&&eligible(p));
    const current=choices.find(p=>p.id===this.targetId);
    if(current&&!force&&(time-this.selectedAt<(policy.minHoldSeconds??0)||policy.reconsider!==undefined&&policy.reconsider!=='decision'&&!this.retargetReady))return current;
    if(policy.avoidLastTarget&&this.lastActionTargetId){
      const others=choices.filter(p=>p.id!==this.lastActionTargetId);
      if(others.length)choices=others;
      else if(policy.fallback==='wait')return undefined;
      else if(policy.fallback==='current'&&current)return current;
      else if(policy.fallback==='nearest')return choices.slice().sort((a,b)=>distance(self,a)-distance(self,b)||a.id.localeCompare(b.id))[0];
    }
    const compare=(a:Actor,b:Actor)=>{
      if(policy.strategy==='leastTargeted'){
        const diff=(this.targetCounts.get(a.id)??0)-(this.targetCounts.get(b.id)??0);if(diff)return diff;
      }
      return (distance(self,a)-distance(self,b))*(policy.strategy==='farthest'?-1:1)||a.id.localeCompare(b.id);
    };
    const next=choices.slice().sort(compare)[0];
    if(!force&&current&&next&&next.id!==current.id&&policy.strategy==='nearest'&&choices.includes(current)&&distance(self,next)>distance(self,current)*(policy.switchDistanceRatio??1))return current;
    return next;
  }
  select(target:Actor,time:number,reason:string):void {
    if(this.targetId!==target.id){this.targetId=target.id;this.selectedAt=time;this.targetReason=reason;}
  }
  actionStarted(target:Actor,time:number,reason:string):void {
    this.select(target,time,reason);this.retargetReady=false;this.lastActionTargetId=target.id;
    this.targetCounts.set(target.id,(this.targetCounts.get(target.id)??0)+1);
  }
  boundary(policy:EnemyTargetPolicy,kind:'actionEnd'|'sequenceEnd'):void {
    if(policy.reconsider===undefined||policy.reconsider==='decision'||policy.reconsider===kind)this.retargetReady=true;
  }
  matches(condition:EnemyCondition|undefined,self:Actor,target:Actor,phase:1|2,playerCount:number):boolean {
    if(!condition)return true;const c=condition,hp=self.hp/self.maxHp,d=distance(self,target);
    return (c.hpRatioBelow===undefined||hp<c.hpRatioBelow)&&(c.hpRatioAbove===undefined||hp>c.hpRatioAbove)&&
      (!c.distance||d>=c.distance[0]&&d<=c.distance[1])&&(c.phase===undefined||c.phase===phase)&&(c.minPlayers===undefined||playerCount>=c.minPlayers);
  }
  block(action:string,target:string,group:string|undefined,time:number):string|undefined {
    for(const key of [`action:${action}`,'global',...(group?[`group:${group}`]:[]),`target:${action}:${target}`])if((this.readyTimes.get(key)??0)>time+1e-8)return key;
    return undefined;
  }
  ticket(action:string,target:string,policy:EnemyCooldownPolicy|undefined,duration:number,global:number):CooldownTicket {
    const entries=[{key:`action:${action}`,seconds:duration},
      {key:'global',seconds:policy?.globalSeconds??global},
      ...(policy?.group?[{key:`group:${policy.group.id}`,seconds:policy.group.seconds}]:[]),
      ...(policy?.targetSeconds?[{key:`target:${action}:${target}`,seconds:policy.targetSeconds}]:[])];
    return {event:policy?.start??'start',consumeOnInterrupt:policy?.consumeOnInterrupt??true,committed:false,
      entries:entries.filter(e=>e.seconds>0).map(e=>({...e,previous:this.readyTimes.get(e.key)??0}))};
  }
  commit(ticket:CooldownTicket,event:CooldownTicket['event'],time:number):void {
    if(ticket.committed||ticket.event!==event)return;ticket.committed=true;
    for(const e of ticket.entries)this.readyTimes.set(e.key,Math.max(e.previous,time+e.seconds));
  }
  interrupted(ticket:CooldownTicket,time:number):void {
    if(ticket.consumeOnInterrupt)this.commit(ticket,ticket.event,time);
    else if(ticket.committed)for(const e of ticket.entries)this.readyTimes.set(e.key,e.previous);
  }
  cooldowns(time:number):{key:string;remaining:number}[] {
    return [...Array.from(this.readyTimes),...Array.from(this.ruleReadyTimes,([id,time])=>[`rule:${id}`,time] as const)].map(([key,until])=>({key,remaining:Math.max(0,until-time)})).filter(c=>c.remaining>0).sort((a,b)=>a.key.localeCompare(b.key));
  }
  abandon():void {this.sequence=undefined;this.pauseUntil=0;this.ruleId=undefined;this.retargetReady=true;}
}
