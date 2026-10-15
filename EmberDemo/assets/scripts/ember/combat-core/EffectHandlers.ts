import { distance } from '../utils/math';
import { applyStatus } from './StatusSystem';
import type { Actor,CastResult,CombatCue,CombatEvent,Effect,Hit } from './types';
export interface EffectContext {
  source:Actor;target:Actor;event:CombatEvent;ruleId:string;actors:Map<string,Actor>;
  primed:Set<string>;healCooldown:Map<string,number>;castResult?:CastResult;maxDepth:number;
  cue:(cue:CombatCue)=>void;damage:(hit:Hit)=>void;drop:()=>void;
}
type Handler<K extends Effect['type']>=(context:EffectContext,effect:Extract<Effect,{type:K}>)=>void;
type Handlers = {[K in Effect['type']]:Handler<K>};
const handlers:Handlers = {
  status:({target,event},effect)=>applyStatus(target,effect.status,event.sourceId,event.skillId),
  prime:({source,primed})=>{primed.add(source.id);},
  empower:({source,primed,castResult},effect)=>{if(castResult){castResult.damageMultiplier*=effect.multiplier;primed.delete(source.id);}},
  extraShot:({castResult})=>{if(castResult)castResult.shots++;},
  heal:({source,healCooldown,ruleId,cue},effect)=>{
    const key=`${source.id}:${ruleId}`;
    if(!source.alive||(healCooldown.get(key)??0)>0)return;
    const amount=Math.min(effect.amount,source.maxHp-source.hp);source.hp+=amount;healCooldown.set(key,effect.cooldown);
    if(amount>0)cue({kind:'heal',at:{...source},amount});
  },
  explode:(ctx,effect)=>chain(ctx,effect),
  arc:(ctx,effect)=>chain(ctx,effect),
};
function chain(ctx:EffectContext,effect:Extract<Effect,{type:'explode'|'arc'}>):void {
  const {event,source,target}=ctx;
  if(event.depth>=ctx.maxDepth){ctx.drop();return;}
  const nearby=Array.from(ctx.actors.values()).filter(a=>a.alive&&a.team!==source.team&&a.id!==target.id&&distance(a,target)<=effect.radius)
    .sort((a,b)=>distance(a,target)-distance(b,target)||a.id.localeCompare(b.id));
  const victims=effect.type==='arc'?nearby.slice(0,1):nearby;
  if(effect.type==='explode')ctx.cue({kind:'explosion',at:{...target},radius:effect.radius});
  for(const victim of victims){
    if(effect.type==='arc')ctx.cue({kind:'arc',at:{...target},to:{...victim}});
    ctx.damage({sourceId:source.id,targetId:victim.id,amount:effect.damage,cause:effect.type==='arc'?'arc':'explosion',depth:event.depth+1,rootId:event.rootId,tags:[effect.type]});
  }
}
export function executeEffect(context:EffectContext,effect:Effect):void {
  // Key and payload share the discriminant; handlers remain exhaustively typed above.
  (handlers[effect.type] as (ctx:EffectContext,effect:Effect)=>void)(context,effect);
}
