import {BASIC_ATTACKS,type BasicAttackId} from './attacks';
import {worldToViewVector} from '../utils/GroundPlane';
/** Animation timing is presentation data; changing it must never change damage timing. */
export type MotionState='idle'|'walk'|'attack'|'cast'|'hurt'|'death';
export interface MotionPose {state:MotionState;age:number;facing:1|-1;basicAttack?:BasicAttackId;direction?:number;speed?:number}
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
  const view=worldToViewVector(unit.facing),screenX=view.x,screenDown=-view.y;
  const direction=(Math.round(Math.atan2(screenX,screenDown)/(Math.PI/4))+8)%8;
  const speed=Math.hypot(unit.velocity.x,unit.velocity.y);
  const orientation={facing: facing as 1|-1,direction,speed};
  if(!unit.alive)return{state:'death',age:Math.max(0,time-unit.diedAt),...orientation};
  if(unit.hurtAt>=0&&time-unit.hurtAt<0.18)return{state:'hurt',age:time-unit.hurtAt,...orientation};
  if(unit.windup>0)return{state:'attack',age:0.08,...orientation};
  if(unit.action.id>0&&time-unit.action.time<0.45)return{state:unit.action.kind,age:time-unit.action.time,...orientation,...(unit.action.basicAttack?{basicAttack:unit.action.basicAttack}:{})};
  return{state:Math.hypot(unit.velocity.x,unit.velocity.y)>0.15?'walk':'idle',age:time,...orientation};
}

/** Complete-body frame clips. Each sheet has five drawn directions, eight columns per row.
 * Opposite directions mirror the entire figure, never separate joints or equipment.
 */
export const HERO_DEATH_FADE={start:.65,duration:.55,lifetime:1.2} as const;
export type HeroClipId='idle'|'walk'|'run'|'melee'|'ranged'|'cast'|'hurt'|'death';
export interface HeroClip {atlas:string;frames:readonly number[];fps:number;loop:boolean}
const EIGHT=[0,1,2,3,4,5,6,7] as const;
export const HERO_CLIPS:Record<HeroClipId,HeroClip>={
  idle:{atlas:'hero-states',frames:[0,1],fps:2,loop:true},
  walk:{atlas:'hero-walk',frames:EIGHT,fps:12,loop:true},
  run:{atlas:'hero-run',frames:EIGHT,fps:20,loop:true},
  melee:{atlas:'hero-melee',frames:EIGHT,fps:18,loop:false},
  ranged:{atlas:'hero-ranged',frames:EIGHT,fps:18,loop:false},
  cast:{atlas:'hero-ranged',frames:EIGHT,fps:18,loop:false},
  hurt:{atlas:'hero-states',frames:[2],fps:8,loop:false},
  death:{atlas:'hero-states',frames:[3,4,5,6,7],fps:8,loop:false},
};
export function wholeHeroFrame(pose:MotionPose){
  const direction=pose.direction??(pose.facing===1?1:7),row=direction<=4?direction:8-direction,mirror:1|-1=direction<=4?1:-1;
  const clip:HeroClipId=pose.state==='walk'?((pose.speed??0)>5.5?'run':'walk'):pose.state==='attack'?(pose.basicAttack!==undefined&&BASIC_ATTACKS[pose.basicAttack].kind==='projectile'?'ranged':'melee'):pose.state;
  const definition=HERO_CLIPS[clip],index=Math.floor(Math.max(0,pose.age)*definition.fps),column=definition.frames[definition.loop?index%definition.frames.length:Math.min(index,definition.frames.length-1)]!;
  return{clip,atlas:definition.atlas,frame:row*8+column,column,row,mirror};
}
