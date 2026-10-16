import type {HitShape,CollisionWorld} from './CollisionWorld';
import type {Vec2} from '../utils/math';
/** Presentation geometry in WORLD coordinates. Uses the same blocker query as targets(). */
export function shapeContours(shape:HitShape,collision?:Pick<CollisionWorld,'blocker'>):Vec2[][] {
 const clip=(p:Vec2)=>{const t=collision?.blocker(shape.center,p)??1;return{x:shape.center.x+(p.x-shape.center.x)*t,y:shape.center.y+(p.y-shape.center.y)*t};};
 if(shape.kind==='circle'||shape.kind==='sector'||shape.kind==='ring'){
  const start=shape.kind==='sector'?Math.atan2(shape.facing.y,shape.facing.x)-shape.arc/2:0,arc=shape.kind==='sector'?shape.arc:Math.PI*2,n=Math.max(24,Math.ceil(arc*24));
  const rays=Array.from({length:n+1},(_,i)=>{const a=start+arc*i/n;return{a,p:clip({x:shape.center.x+Math.cos(a)*shape.radius,y:shape.center.y+Math.sin(a)*shape.radius})};});
  if(shape.kind!=='ring')return[shape.kind==='sector'?[{...shape.center},...rays.map(r=>r.p)]:rays.map(r=>r.p)];
  const paths:Vec2[][]=[];let outer:Vec2[]=[],inner:Vec2[]=[];
  const flush=()=>{if(outer.length>1)paths.push(outer,inner);outer=[];inner=[];};
  for(const r of rays){if(Math.hypot(r.p.x-shape.center.x,r.p.y-shape.center.y)<shape.innerRadius){flush();continue;}outer.push(r.p);inner.push({x:shape.center.x+Math.cos(r.a)*shape.innerRadius,y:shape.center.y+Math.sin(r.a)*shape.innerRadius});}flush();return paths;
 }
 let boundary:Vec2[]=[];
 if(shape.kind==='rectangle'){
  const f=shape.facing,n=Math.hypot(f.x,f.y)||1,fx=f.x/n,fy=f.y/n,sx=-fy*shape.width/2,sy=fx*shape.width/2,c=shape.center,e={x:c.x+fx*shape.length,y:c.y+fy*shape.length};
  const vertices=[{x:c.x+sx,y:c.y+sy},{x:e.x+sx,y:e.y+sy},{x:e.x-sx,y:e.y-sy},{x:c.x-sx,y:c.y-sy}];
  for(let j=0;j<4;j++){const a=vertices[j]!,b=vertices[(j+1)%4]!;for(let i=0;i<24;i++)boundary.push({x:a.x+(b.x-a.x)*i/24,y:a.y+(b.y-a.y)*i/24});}
 }else{const angle=Math.atan2(shape.end.y-shape.center.y,shape.end.x-shape.center.x);for(const [c,start]of[[shape.end,angle-Math.PI/2],[shape.center,angle+Math.PI/2]]as const)for(let i=0;i<=24;i++){const a=start+Math.PI*i/24;boundary.push({x:c.x+Math.cos(a)*shape.radius,y:c.y+Math.sin(a)*shape.radius});}}
 return[boundary.map(clip)];
}
export function cloneShape(shape:HitShape):HitShape {return shape.kind==='capsule'?{...shape,center:{...shape.center},end:{...shape.end}}:shape.kind==='rectangle'||shape.kind==='sector'?{...shape,center:{...shape.center},facing:{...shape.facing}}:{...shape,center:{...shape.center}};}
