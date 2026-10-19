import type { VisualCue } from '../simulation/GameWorld';
import type { Vec2 } from '../utils/math';
import type { HitShape } from '../combat-core/CollisionWorld';
import { shapeContours } from '../combat-core/ShapeContours';
import { screenVisible, worldToScreen, type Projection } from './IsoProjection';

export const PIXEL_VFX_LIMIT=24;
export interface PixelVfxPlan {cue:VisualCue;frame:number;row:number;age:number;size:number;at:Vec2;priority:number}
interface Warning {shape:HitShape;contours?:Vec2[][]}
function nearSegment(p:Vec2,a:Vec2,b:Vec2,r:number):boolean {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<=r;
}
/** Stateless visual scheduling: simulation cue age is the only animation clock.
 * Skip decoration near danger boundaries (including ring holes), before budgeting.
 * Essential warnings, projectile cores and numbers never enter this budget. */
export function planPixelVfx(cues:readonly VisualCue[],camera:Projection,warnings:readonly Warning[]=[]):PixelVfxPlan[] {
  const borders=warnings.flatMap(w=>(w.contours??shapeContours(w.shape)).map(path=>path.map(p=>worldToScreen(p,camera))));
  const plans:PixelVfxPlan[]=[];
  for(const cue of cues){
    if(cue.cause==='enemy'||cue.kind==='damage'||cue.kind==='heal'||cue.kind==='arc')continue;
    const age=cue.duration-cue.ttl;if(!Number.isFinite(age)||age<0||age>=.4)continue;
    // Unsupported mist/healing/arc families retain their existing Graphics grammar.
    if(cue.appearance&& !['shield','fire','ice','physical'].includes(cue.appearance))continue;
    const row=cue.kind==='shield'||cue.appearance==='shield'?3:cue.kind==='swing'?2:cue.appearance==='ice'?1:cue.appearance==='fire'||cue.kind==='explosion'?0:cue.kind==='quake'?2:-1;
    if(row<0)continue;
    const base=worldToScreen(cue.at,camera),at={x:base.x,y:base.y+(row===3?26:12)*camera.zoom};
    if(!screenVisible(at,80))continue;
    const size=(cue.kind==='shield'?80:cue.kind==='explosion'||cue.kind==='quake'?96:64)*camera.zoom;
    // Bounding circle includes corner fragments and any rotated slash pose.
    if(borders.some(path=>path.some((a,i)=>nearSegment(at,a,path[(i+1)%path.length]!,size*.9))))continue;
    plans.push({cue,row,age,size,at,frame:row*4+Math.min(3,Math.floor(age/.1)),priority:row===3?3:cue.kind==='explosion'||cue.kind==='swing'?2:1});
  }
  return plans.sort((a,b)=>b.priority-a.priority||a.age-b.age||b.cue.id-a.cue.id).slice(0,PIXEL_VFX_LIMIT);
}
