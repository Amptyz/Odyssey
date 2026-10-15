import type { EnemyBehaviorId,EnemyDefinition } from '../content/enemies';
import type { SkillId } from '../content/skills';
import type { Unit } from '../simulation/GameWorld';
import type { Pathfinder } from './Pathfinder';
import { direction,distance,type Vec2 } from '../utils/math';
export interface EnemyContext {
  unit:Unit;hero:Unit;definition:EnemyDefinition;nav:Pathfinder;
  move:(speed:number,dt:number)=>void;damage:(amount:number)=>void;cast:(id:SkillId,point:Vec2)=>void;
}
/** A new behavior owns its whole update, and can reuse pursuit or implement another strategy. */
export const ENEMY_BEHAVIORS:Record<EnemyBehaviorId,(ctx:EnemyContext,dt:number)=>void>={
  melee:(ctx,dt)=>pursue(ctx,dt,()=>ctx.damage(ctx.definition.damage)),
  ranged:(ctx,dt)=>pursue(ctx,dt,()=>{if(ctx.definition.skillId)ctx.cast(ctx.definition.skillId,ctx.unit.aim);}),
};
function pursue(ctx:EnemyContext,dt:number,attack:()=>void):void {
  const {unit:e,hero,definition:cfg,nav}=ctx;
  if(e.windup>0){e.windup-=dt;if(e.windup<=0){attack();e.attackCd=cfg.interval;}return;}
  if(distance(e,hero)<=cfg.range+hero.radius&&nav.clear(e,hero,0.1)){
    e.path=[];e.velocity={x:0,y:0};if(e.attackCd<=0){e.windup=cfg.windup;e.aim={x:hero.x,y:hero.y};e.facing=direction(e,hero);}
  }else{
    if(e.repath<=0){e.path=nav.find(e,hero);e.repath=0.55;}
    ctx.move(cfg.speed,dt);
  }
}
