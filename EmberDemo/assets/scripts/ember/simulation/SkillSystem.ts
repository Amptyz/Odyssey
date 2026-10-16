import {evaluate} from '../combat-core/attributes/AttributeSet';
import { skill,type SkillBehavior,type SkillId } from '../content/skills';
import type { Actor,CombatCue } from '../combat-core/types';
import type { CombatEngine } from '../combat-core/CombatEngine';
import { applyStatus } from '../combat-core/StatusSystem';
import { direction,type Vec2 } from '../utils/math';
export type ProjectileBehavior=Extract<SkillBehavior,{kind:'projectile'}>;
export interface SkillContext {
  source:Actor;point:Vec2;skillId:SkillId;combat:CombatEngine;actors:Map<string,Actor>;
  shoot:(source:Actor,aim:Vec2,id:SkillId,behavior:ProjectileBehavior,damage:number,expressionMultiplier:number)=>void;
  dash:(aim:Vec2,distance:number,duration:number)=>void;cue:(cue:CombatCue)=>void;
}
type Context=SkillContext&{multiplier:number;shots:number};
type Handlers={[K in SkillBehavior['kind']]:(ctx:Context,behavior:Extract<SkillBehavior,{kind:K}>)=>void};
const handlers:Handlers={
  cone:(ctx,b)=>{const aim=direction(ctx.source,ctx.point),facing=aim.x||aim.y?aim:{x:1,y:0};
    ctx.cue({kind:'swing',at:{...ctx.source},radius:b.radius,arc:b.arc,facing,appearance:skill(ctx.skillId).appearance});
    for(const t of ctx.combat.collision.targets(ctx.actors.values(),ctx.source.team,{kind:'sector',center:ctx.source,radius:b.radius,arc:b.arc,facing}))
      ctx.combat.damage({sourceId:ctx.source.id,targetId:t.id,amount:evaluate(skill(ctx.skillId).expression??{flat:b.damage},ctx.source,t)*ctx.multiplier,cause:ctx.source.team==='hero'?'skill':'enemy',skillId:ctx.skillId,damageType:skill(ctx.skillId).damageType,area:true});},
  projectile:(ctx,b)=>{
    const aim=direction(ctx.source,ctx.point),angle=aim.x||aim.y?Math.atan2(aim.y,aim.x):0;
    for(let i=0;i<ctx.shots;i++)ctx.shoot(ctx.source,{x:Math.cos(angle+i*0.13),y:Math.sin(angle+i*0.13)},ctx.skillId,b,evaluate(projectileSourceExpression(skill(ctx.skillId).expression??{flat:b.damage}),ctx.source)*ctx.multiplier,ctx.multiplier);
  },
  shield:(ctx,b)=>{ctx.combat.shield(ctx.source.id,ctx.source.id,evaluate(skill(ctx.skillId).expression??{flat:b.amount},ctx.source),b.duration,ctx.skillId);ctx.cue({kind:'shield',at:{...ctx.source},radius:1,appearance:skill(ctx.skillId).appearance});},
  dash:(ctx,b)=>{const d=direction(ctx.source,ctx.point);ctx.dash(d.x||d.y?d:{x:1,y:0},b.distance,b.duration);},
  area:(ctx,b)=>{
    ctx.cue({kind:'explosion',at:{...ctx.source},radius:b.radius,appearance:skill(ctx.skillId).appearance});
    for(const target of ctx.combat.collision.targets(ctx.actors.values(),ctx.source.team,{kind:'circle',center:ctx.source,radius:b.radius}))
      {for(const status of b.onHit??[])applyStatus(target,status,ctx.source.id,ctx.skillId);ctx.combat.damage({sourceId:ctx.source.id,targetId:target.id,amount:evaluate(skill(ctx.skillId).expression??{flat:b.damage},ctx.source,target)*ctx.multiplier,cause:ctx.source.team==='hero'?'skill':'enemy',skillId:ctx.skillId,damageType:skill(ctx.skillId).damageType,area:true});}
  },
};
export function executeSkill(ctx:SkillContext):void {
  const definition=skill(ctx.skillId),result=ctx.combat.cast(ctx.source.id,ctx.skillId);
  (handlers[definition.behavior.kind] as (ctx:Context,b:SkillBehavior)=>void)({...ctx,multiplier:result.damageMultiplier,shots:result.shots},definition.behavior);
}

/** Source coefficients are sampled once at release; target terms and cap resolve on impact. */
export function projectileSourceExpression(expression:import('../combat-core/attributes/AttributeSet').ValueExpression){const {targetMaxHealth,targetCurrentHealth,targetMissingHealth,cap,...source}=expression;return source;}
