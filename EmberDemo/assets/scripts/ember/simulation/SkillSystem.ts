import { skill,type SkillBehavior,type SkillId } from '../content/skills';
import type { Actor,CombatCue } from '../combat-core/types';
import type { CombatEngine } from '../combat-core/CombatEngine';
import { direction,distance,type Vec2 } from '../utils/math';
export type ProjectileBehavior=Extract<SkillBehavior,{kind:'projectile'}>;
export interface SkillContext {
  source:Actor;point:Vec2;skillId:SkillId;combat:CombatEngine;actors:Map<string,Actor>;
  shoot:(source:Actor,aim:Vec2,id:SkillId,behavior:ProjectileBehavior,damage:number)=>void;
  dash:(aim:Vec2,distance:number,duration:number)=>void;cue:(cue:CombatCue)=>void;
}
type Context=SkillContext&{multiplier:number;shots:number};
type Handlers={[K in SkillBehavior['kind']]:(ctx:Context,behavior:Extract<SkillBehavior,{kind:K}>)=>void};
const handlers:Handlers={
  projectile:(ctx,b)=>{
    const aim=direction(ctx.source,ctx.point),angle=aim.x||aim.y?Math.atan2(aim.y,aim.x):0;
    for(let i=0;i<ctx.shots;i++)ctx.shoot(ctx.source,{x:Math.cos(angle+i*0.13),y:Math.sin(angle+i*0.13)},ctx.skillId,b,b.damage*ctx.multiplier);
  },
  shield:(ctx,b)=>{ctx.source.shield=b.amount;ctx.source.shieldTime=b.duration;ctx.cue({kind:'shield',at:{...ctx.source},radius:1,appearance:skill(ctx.skillId).appearance});},
  dash:(ctx,b)=>{const d=direction(ctx.source,ctx.point);ctx.dash(d.x||d.y?d:{x:1,y:0},b.distance,b.duration);},
  area:(ctx,b)=>{
    ctx.cue({kind:'explosion',at:{...ctx.source},radius:b.radius,appearance:skill(ctx.skillId).appearance});
    for(const target of ctx.actors.values())if(target.alive&&target.team!==ctx.source.team&&distance(target,ctx.source)<=b.radius+target.radius)
      ctx.combat.damage({sourceId:ctx.source.id,targetId:target.id,amount:b.damage*ctx.multiplier,cause:ctx.source.team==='hero'?'skill':'enemy',skillId:ctx.skillId});
  },
};
export function executeSkill(ctx:SkillContext):void {
  const definition=skill(ctx.skillId),result=ctx.combat.cast(ctx.source.id,ctx.skillId);
  (handlers[definition.behavior.kind] as (ctx:Context,b:SkillBehavior)=>void)({...ctx,multiplier:result.damageMultiplier,shots:result.shots},definition.behavior);
}
