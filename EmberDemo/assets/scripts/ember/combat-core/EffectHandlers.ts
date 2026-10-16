import {evaluate,type AttributeSource} from './attributes/AttributeSet';
import { direction,distance } from '../utils/math';
import { applyStatus } from './StatusSystem';
import type { Actor,CastResult,CombatCue,CombatEvent,CombatHooks,Effect,Hit,MissileEffect,CombatEffect,DamageType } from './types';
import type { CollisionWorld } from './CollisionWorld';
export interface EffectContext {
  source:Actor;target:Actor;event:CombatEvent;ruleId:string;actors:Map<string,Actor>;collision:CollisionWorld;
  primed:Set<string>;healCooldown:Map<string,number>;castResult?:CastResult;maxDepth:number;
  cue:(cue:CombatCue)=>void;damage:(hit:Hit)=>void;drop:()=>void;
  hooks:CombatHooks;heal:(amount:number)=>void;onHit:()=>void;
  attributeEffect:(targetId:string,source:AttributeSource,duration:number)=>void;combatEffect:(targetId:string,effect:CombatEffect)=>void;shield:(targetId:string,amount:number,duration:number,id:string,types?:DamageType[])=>void;
  regenerate:(ratio:number,duration:number)=>void;trail:(effect:Extract<Effect,{type:'trail'}>)=>void;
}
type Handler<K extends Effect['type']>=(context:EffectContext,effect:Extract<Effect,{type:K}>)=>void;
type Handlers = {[K in Effect['type']]:Handler<K>};
const handlers:Handlers = {
  attribute:(ctx,effect)=>ctx.attributeEffect(effect.target==='source'?ctx.source.id:ctx.target.id,{sourceId:`temporary:${ctx.source.id}:${effect.sourceId}`,modifiers:effect.modifiers},effect.duration),
  combatEffect:(ctx,effect)=>ctx.combatEffect(effect.target==='source'?ctx.source.id:ctx.target.id,{...effect.effect,sourceId:ctx.source.id,instanceId:ctx.ruleId}),
  shield:(ctx,effect)=>ctx.shield(effect.target==='target'?ctx.target.id:ctx.source.id,evaluate(effect.expression,ctx.source,ctx.target),effect.duration,effect.id,effect.damageTypes),
  damage:(ctx,effect)=>ctx.damage({sourceId:ctx.source.id,targetId:ctx.target.id,amount:evaluate(effect.expression,ctx.source,ctx.target),damageType:effect.damageType,cause:'augment',proc:true,vampEligible:effect.vampEligible,depth:ctx.event.depth+1,rootId:ctx.event.rootId}),
  status:({target,event},effect)=>applyStatus(target,effect.status,event.sourceId,event.skillId),
  prime:({source,primed})=>{primed.add(source.id);},
  empower:({source,primed,castResult},effect)=>{if(castResult){castResult.damageMultiplier*=effect.multiplier;primed.delete(source.id);}},
  extraShot:({castResult})=>{if(castResult)castResult.shots++;},
  heal:({source,target,healCooldown,ruleId,heal},effect)=>{
    const key=`${source.id}:${ruleId}`;
    if(!source.alive||(healCooldown.get(key)??0)>0)return;
    healCooldown.set(key,effect.cooldown);heal(effect.expression?evaluate(effect.expression,source,target):effect.amount);
  },
  onHit:ctx=>ctx.onHit(),
  cooldown:({source,hooks},effect)=>{if(source.alive)hooks.reduceCooldown?.(source.id,effect.seconds);},
  bonusDamage:(ctx,effect)=>ctx.damage({sourceId:ctx.source.id,targetId:ctx.target.id,amount:ctx.source.maxHp*effect.maxHpRatio,cause:'augment',proc:true,damageType:'magic',depth:ctx.event.depth+1,rootId:ctx.event.rootId,tags:['on-hit']}),
  regenerate:({regenerate},effect)=>regenerate(effect.maxHpRatio,effect.duration),
  trail:({trail},effect)=>trail(effect),
  missiles:(ctx,effect)=>missiles(ctx,effect),
  healNova:(ctx,effect)=>{
    if(ctx.event.tags.includes('derived-heal'))return;
    const victim=ctx.collision.targets(ctx.actors.values(),ctx.source.team,{kind:'circle',center:ctx.source,radius:effect.radius})
      .sort((a,b)=>distance(a,ctx.source)-distance(b,ctx.source)||a.id.localeCompare(b.id))[0];
    if(!victim)return;
    ctx.cue({kind:'arc',at:{x:ctx.source.x,y:ctx.source.y},to:{x:victim.x,y:victim.y},appearance:'mist'});
    ctx.damage({sourceId:ctx.source.id,targetId:victim.id,amount:ctx.event.amount*effect.ratio,cause:'augment',proc:true,damageType:'magic',depth:ctx.event.depth+1,rootId:ctx.event.rootId,vampEligible:false,tags:['healing','derived-heal']});
  },
  explode:(ctx,effect)=>chain(ctx,effect),
  arc:(ctx,effect)=>chain(ctx,effect),
};
function missiles(ctx:EffectContext,effect:MissileEffect):void {
  if(!ctx.source.alive||ctx.event.depth>=ctx.maxDepth)return;
  let aim=ctx.event.aim??direction(ctx.source,ctx.target);
  if(effect.aim==='secondary'){
    const end={x:ctx.source.x+aim.x*effect.range,y:ctx.source.y+aim.y*effect.range};
    const primary=ctx.collision.firstImpact(ctx.actors.values(),ctx.source.team,ctx.source,end,effect.radius)?.actor;
    if(ctx.event.tags.includes('derived-heal'))return;
    const victim=ctx.collision.targets(ctx.actors.values(),ctx.source.team,{kind:'circle',center:ctx.source,radius:effect.range},primary?.id)
      .sort((a,b)=>distance(a,ctx.source)-distance(b,ctx.source)||a.id.localeCompare(b.id))[0];
    if(!victim)return;aim=direction(ctx.source,victim);
  }
  if(!aim.x&&!aim.y)return;
  const angle=Math.atan2(aim.y,aim.x),damage=effect.damage+(effect.attackRatio??0)*(ctx.hooks.attackDamage?.(ctx.source.id)??0);
  for(let i=0;i<effect.count;i++){
    const a=angle+(i-(effect.count-1)/2)*effect.spread;
    ctx.hooks.projectile?.(ctx.source,{x:Math.cos(a),y:Math.sin(a)},effect,damage);
  }
}
function chain(ctx:EffectContext,effect:Extract<Effect,{type:'explode'|'arc'}>):void {
  const {event,source,target}=ctx;
  if(event.depth>=ctx.maxDepth){ctx.drop();return;}
  const nearby=ctx.collision.targets(ctx.actors.values(),source.team,{kind:'circle',center:target,radius:effect.radius},target.id)
    .sort((a,b)=>distance(a,target)-distance(b,target)||a.id.localeCompare(b.id));
  const victims=effect.type==='arc'?nearby.slice(0,1):nearby;
  if(effect.type==='explode')ctx.cue({kind:'explosion',at:{x:target.x,y:target.y},radius:effect.radius});
  for(const victim of victims){
    if(effect.type==='arc')ctx.cue({kind:'arc',at:{x:target.x,y:target.y},to:{x:victim.x,y:victim.y}});
    ctx.damage({sourceId:source.id,targetId:victim.id,amount:effect.damage,cause:effect.type==='arc'?'arc':'explosion',depth:event.depth+1,rootId:event.rootId,tags:[effect.type],proc:true,area:effect.type==='explode',delivery:'proc'});
  }
}
export function executeEffect(context:EffectContext,effect:Effect):void {
  // Key and payload share the discriminant; handlers remain exhaustively typed above.
  (handlers[effect.type] as (ctx:EffectContext,effect:Effect)=>void)(context,effect);
}
