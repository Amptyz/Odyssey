import { MELEE_BLADE_KEYS } from '../content/melee-motion';
import { viewToWorldVector, worldToViewVector } from '../utils/GroundPlane';
import { clamp, type Vec2 } from '../utils/math';
import type { HitShape } from './CollisionWorld';

export interface MeleeMotion {
  center: Vec2; facing: Vec2; radius: number; age: number; windup: number; active: number;
  previousCenter?: Vec2; previousAge?: number;
}
/** The board's standard aiming direction is screen-up. Only a rigid rotation
 * and uniform world scale are applied; the ground plane itself is unchanged. */
export function meleeRotation(facing: Vec2): number {
  const view = worldToViewVector(facing);
  return Math.atan2(view.y,view.x)-Math.PI/2;
}
export function meleeBlade(motion: MeleeMotion, progress: number, center=motion.center): Extract<HitShape,{kind:'polygon'}> {
  const p=clamp(progress,0,1),keys=MELEE_BLADE_KEYS;
  const i=Math.min(keys.length-2,Math.max(0,keys.findIndex((key,index)=>index<keys.length-1&&p<=keys[index+1]!.progress)));
  const a=keys[i]!,b=keys[i+1]!,t=clamp((p-a.progress)/(b.progress-a.progress),0,1);
  const rotation=meleeRotation(motion.facing),c=Math.cos(rotation),s=Math.sin(rotation),scale=motion.radius;
  return {kind:'polygon',center:{...center},points:a.points.map((point,index)=>{
    const next=b.points[index]!,x=(point[0]+(next[0]-point[0])*t)*scale;
    const y=(point[1]+(next[1]-point[1])*t)*scale;
    const world=viewToWorldVector({x:x*c-y*s,y:x*s+y*c});
    return {x:center.x+world.x,y:center.y+world.y};
  })};
}
function hull(points: Vec2[]): Vec2[] {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o:Vec2,a:Vec2,b:Vec2)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const half=(items:Vec2[])=>{const out:Vec2[]=[];for(const p of items){while(out.length>1&&cross(out[out.length-2]!,out[out.length-1]!,p)<=0)out.pop();out.push(p);}out.pop();return out;};
  return [...half(sorted),...half([...sorted].reverse())];
}
/** Sweeps the bright blade between simulation samples. Subdivision also includes
 * exact authored keys; tiny targets cannot fall between 30 Hz pose samples. */
export function meleeSweepShapes(motion: MeleeMotion, fromAge: number, toAge: number): HitShape[] {
  if(toAge<motion.windup||fromAge>=motion.windup+motion.active)return [];
  const from=clamp((fromAge-motion.windup)/motion.active,0,1),to=clamp((toAge-motion.windup)/motion.active,0,1);
  const steps=Math.max(1,Math.ceil((to-from)*64)),times=new Set<number>([from,to]);
  for(let i=1;i<steps;i++)times.add(from+(to-from)*i/steps);
  for(const key of MELEE_BLADE_KEYS)if(key.progress>from&&key.progress<to)times.add(key.progress);
  const position=(p:number)=>{const t=clamp((motion.windup+p*motion.active-fromAge)/Math.max(1e-8,toAge-fromAge),0,1),old=motion.previousCenter??motion.center;
    return{x:old.x+(motion.center.x-old.x)*t,y:old.y+(motion.center.y-old.y)*t};};
  const shapes:HitShape[]=[];let last:ReturnType<typeof meleeBlade>|undefined;
  // Creator's loose ES5 transform treats [...set] as array concat. Materialize
  // explicitly so browser builds sweep the same numeric samples as Node tests.
  for(const t of Array.from(times).sort((a,b)=>a-b)){const blade=meleeBlade(motion,t,position(t));
    shapes.push(last?{kind:'polygon',center:{...blade.center},points:hull([...last.points,...blade.points])}:blade);last=blade;}
  return shapes;
}
