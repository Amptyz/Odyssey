import type {BasicAttackId} from './attacks';
/** Animation timing is presentation data; changing it must never change damage timing. */
export type MotionState='idle'|'walk'|'attack'|'cast'|'hurt'|'death';
export interface MotionPose {state:MotionState;age:number;facing:1|-1;basicAttack?:BasicAttackId}
export type AnimationClips=Record<MotionState,{frames:readonly number[];fps:number;loop:boolean}>;
export const CLIPS:AnimationClips={
  idle:{frames:[0,1,2,3],fps:4,loop:true},walk:{frames:[4,5,6,7],fps:9,loop:true},
  attack:{frames:[8,9,10,11],fps:9,loop:false},cast:{frames:[8,9,10,11],fps:7,loop:false},
  hurt:{frames:[12],fps:8,loop:false},death:{frames:[13,14,15],fps:4,loop:false},
};
export function animationFrame(state:MotionState,age:number,clips:AnimationClips=CLIPS):number {
  const clip=clips[state],index=Math.floor(Math.max(0,age)*clip.fps);
  return clip.frames[clip.loop?index%clip.frames.length:Math.min(index,clip.frames.length-1)]!;
}
/** Minimal animation signals from simulation. They do not depend on the renderer. */
export interface ActionSignal {id:number;kind:'attack'|'cast';time:number;basicAttack?:BasicAttackId}
export function motionPose(unit:{alive:boolean;velocity:{x:number;y:number};windup:number;action:ActionSignal;hurtAt:number;diedAt:number;facing:{x:number;y:number}},time:number):MotionPose {
  const facing=unit.facing.x-unit.facing.y<0?-1:1;
  if(!unit.alive)return{state:'death',age:Math.max(0,time-unit.diedAt),facing};
  if(unit.hurtAt>=0&&time-unit.hurtAt<0.18)return{state:'hurt',age:time-unit.hurtAt,facing};
  if(unit.windup>0)return{state:'attack',age:0.08,facing};
  if(unit.action.id>0&&time-unit.action.time<0.45)return{state:unit.action.kind,age:time-unit.action.time,facing,...(unit.action.basicAttack?{basicAttack:unit.action.basicAttack}:{})};
  return{state:Math.hypot(unit.velocity.x,unit.velocity.y)>0.15?'walk':'idle',age:time,facing};
}
