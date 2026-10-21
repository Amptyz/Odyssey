import { worldToViewVector,viewToWorldVector } from '../utils/GroundPlane';
import { clamp,type Vec2 } from '../utils/math';
import { MELEE_OUTLINE } from '../content/melee-outline';
import type { HitShape } from './CollisionWorld';

export interface MeleeMotion {
  center: Vec2; facing: Vec2; radius: number; arc: number; age: number; windup: number; active: number;
  previousCenter?: Vec2; previousAge?: number;
}
/** The board's standard aiming direction is screen-up. Only a rigid rotation
 * and uniform world scale are applied; the ground plane itself is unchanged. */
export function meleeRotation(facing: Vec2): number {
  const view = worldToViewVector(facing);
  return Math.atan2(view.y,view.x)-Math.PI/2+MELEE_OUTLINE.rotationOffsetDegrees*Math.PI/180;
}
export function meleePoseIndex(progress:number):number{
  return Math.floor(clamp(progress,0,1)*MELEE_OUTLINE.poseSteps+1e-8);
}
function profile(progress:number):number[]{
  return Array.from(MELEE_OUTLINE.poses[meleePoseIndex(progress)]!);
}
function area(motion:MeleeMotion,radii:readonly number[]):Extract<HitShape,{kind:'polygon'}>{
  const count=radii.length,start=Math.max(0,radii.findIndex((r,i)=>r>0&&radii[(i+count-1)%count]===0)),rotation=meleeRotation(motion.facing);
  const points:Vec2[]=[{...motion.center}];
  for(let j=0;j<count;j++){
    const i=(start+j)%count,r=radii[i]!*motion.radius;if(r<=0)continue;
    const angle=i/count*Math.PI*2+rotation,world=viewToWorldVector({x:Math.cos(angle)*r,y:Math.sin(angle)*r});
    points.push({x:motion.center.x+world.x,y:motion.center.y+world.y});
  }
  return {kind:'polygon',center:{...motion.center},points};
}
/** One continuous curved fan measured from the actual animated outline.
 * Filling to the player keeps close hits; no circular radius/180-degree crop. */
export function meleeArea(motion:MeleeMotion,progress=clamp((motion.age-motion.windup)/Math.max(.001,motion.active),0,1)) {
  return area(motion,profile(progress));
}
/** Include a step that crosses the active window, even at very high attack speed. */
export function activeMeleeArea(motion: MeleeMotion, fromAge: number, toAge: number) {
  if(toAge+1e-9<motion.windup||fromAge>=motion.windup+motion.active)return undefined;
  const from=clamp((fromAge-motion.windup)/Math.max(.001,motion.active),0,1),to=clamp((toAge-motion.windup)/Math.max(.001,motion.active),0,1),radii=profile(from);
  // Enclose every measured pose crossed by this fixed step, including an entire
  // short attack. This stays a single fan instead of a stack of blade boxes.
  const include=(p:number)=>{const next=profile(p);for(let i=0;i<radii.length;i++)radii[i]=Math.max(radii[i]!,next[i]!);};
  for(let i=Math.floor(from*MELEE_OUTLINE.poseSteps)+1;i<to*MELEE_OUTLINE.poseSteps;i++)include(i/MELEE_OUTLINE.poseSteps);
  include(to);return area(motion,radii);
}
