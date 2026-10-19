import type { Vec2 } from '../utils/math';
import type { Actor } from './types';

export interface Circle extends Vec2 { radius:number }
export type HitShape =
  | {kind:'circle';center:Vec2;radius:number}
  | {kind:'sector';center:Vec2;radius:number;facing:Vec2;arc:number}
  | {kind:'capsule';center:Vec2;end:Vec2;radius:number}
  | {kind:'rectangle';center:Vec2;facing:Vec2;length:number;width:number}
  | {kind:'ring';center:Vec2;radius:number;innerRadius:number};
interface Terrain {width:number;height:number;obstacles:readonly Circle[]}
const EPS=1e-9;
function squared(a:Vec2,b:Vec2):number {return (a.x-b.x)**2+(a.y-b.y)**2;}
function segmentDistanceSquared(p:Vec2,a:Vec2,b:Vec2):number {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return squared(p,{x:a.x+t*dx,y:a.y+t*dy});
}
/** Full body/shape intersection, including sector edges and the rounded outer arc. */
export function overlaps(shape:HitShape,body:Circle):boolean {
  if(shape.kind==='circle')return squared(shape.center,body)<=(shape.radius+body.radius)**2+EPS;
  if(shape.kind==='ring'){const d=Math.sqrt(squared(shape.center,body));return d<=shape.radius+body.radius+EPS&&d+body.radius>=shape.innerRadius-EPS;}
  if(shape.kind==='rectangle'){const dx=body.x-shape.center.x,dy=body.y-shape.center.y,n=Math.hypot(shape.facing.x,shape.facing.y)||1,fx=shape.facing.x/n,fy=shape.facing.y/n;const along=dx*fx+dy*fy,side=-dx*fy+dy*fx;const x=Math.max(0,Math.min(shape.length,along)),y=Math.max(-shape.width/2,Math.min(shape.width/2,side));return (along-x)**2+(side-y)**2<=body.radius**2+EPS;}
  if(shape.kind==='capsule')return segmentDistanceSquared(body,shape.center,shape.end)<=(shape.radius+body.radius)**2+EPS;
  const dx=body.x-shape.center.x,dy=body.y-shape.center.y,d=Math.hypot(dx,dy);
  if(d<=body.radius+EPS)return true;
  if(d>shape.radius+body.radius+EPS)return false;
  const angle=Math.atan2(shape.facing.y,shape.facing.x),offset=Math.atan2(dy,dx)-angle;
  const delta=Math.abs(Math.atan2(Math.sin(offset),Math.cos(offset))),half=shape.arc/2;
  if(delta<=half+EPS)return true;
  for(const edge of [angle-half,angle+half]){
    const end={x:shape.center.x+Math.cos(edge)*shape.radius,y:shape.center.y+Math.sin(edge)*shape.radius};
    if(segmentDistanceSquared(body,shape.center,end)<=body.radius**2+EPS)return true;
  }
  return false;
}
/** Earliest contact in [0,1]. Relative motion also detects a moving body crossing a bullet. */
export function sweepCircle(from:Vec2,to:Vec2,radius:number,body:Circle,end:Vec2=body):number|undefined {
  const x=from.x-body.x,y=from.y-body.y,vx=(to.x-from.x)-(end.x-body.x),vy=(to.y-from.y)-(end.y-body.y);
  const r=radius+body.radius,c=x*x+y*y-r*r;
  if(c<=EPS)return 0;
  const a=vx*vx+vy*vy,b=x*vx+y*vy;
  if(a<=EPS||b>=0)return undefined;
  const discriminant=b*b-a*c;if(discriminant<-EPS)return undefined;
  const t=(-b-Math.sqrt(Math.max(0,discriminant)))/a;
  return t>=-EPS&&t<=1+EPS?Math.max(0,Math.min(1,t)):undefined;
}
/** Deterministic collision queries in world units; independent of sprites and Cocos physics. */
export class CollisionWorld {
  constructor(private terrain?:Terrain){}
  setTerrain(terrain:Terrain):void {this.terrain=terrain;}
  blocker(from:Vec2,to:Vec2,radius=0):number|undefined {
    if(!this.terrain)return undefined;
    const {width,height,obstacles}=this.terrain;
    if(from.x<radius||from.y<radius||from.x>width-radius||from.y>height-radius)return 0;
    let first=Infinity;
    for(const [start,end,max] of [[from.x,to.x,width],[from.y,to.y,height]] as const){
      if(end<radius)first=Math.min(first,(radius-start)/(end-start));
      if(end>max-radius)first=Math.min(first,(max-radius-start)/(end-start));
    }
    for(const obstacle of obstacles){const t=sweepCircle(from,to,radius,obstacle);if(t!==undefined)first=Math.min(first,t);}
    return Number.isFinite(first)?first:undefined;
  }
  targets(actors:Iterable<Actor>,team:Actor['team'],shape:HitShape,exclude?:string):Actor[] {
    return Array.from(actors).filter(a=>a.alive&&a.team!==team&&a.id!==exclude&&overlaps(shape,a)&&this.blocker(shape.center,a)===undefined)
      .sort((a,b)=>a.id.localeCompare(b.id));
  }
  firstImpact(actors:Iterable<Actor&{previous?:Vec2}>,team:Actor['team'],from:Vec2,to:Vec2,radius:number,tickFraction=1):{t:number;actor?:Actor}|undefined {
    const wall=this.blocker(from,to,radius);let first=wall===undefined?undefined:{t:wall,actor:undefined as Actor|undefined};
    for(const actor of actors){
      if(!actor.alive||actor.team===team)continue;
      const previous=actor.previous??actor,end={x:previous.x+(actor.x-previous.x)*tickFraction,y:previous.y+(actor.y-previous.y)*tickFraction};
      const t=sweepCircle(from,to,radius,{...previous,radius:actor.radius},end);
      if(t!==undefined&&(!first||t<first.t-EPS||(Math.abs(t-first.t)<=EPS&&first.actor&&actor.id.localeCompare(first.actor.id)<0)))first={t,actor};
    }
    return first;
  }
}
