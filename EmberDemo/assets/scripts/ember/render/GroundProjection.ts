import type { Vec2 } from '../utils/math';
import {worldToViewVector,viewToWorldVector} from '../utils/GroundPlane';
import {GAME_TUNING,GROUND_VIEW} from '../content/tuning';
/** A similarity transform: equal world lengths always occupy equal pixels. */
export interface Projection { pixelsPerUnit: number; zoom: number; origin: Vec2 }
export const DEFAULT_PROJECTION: Projection = { ...GROUND_VIEW, zoom: GAME_TUNING.cameraZoom, origin: { x: 0, y: 250 } };
export function worldLengthToScreen(length:number,camera:Projection=DEFAULT_PROJECTION):number {
  return length*camera.pixelsPerUnit*camera.zoom;
}
/** Positions, shapes, projectiles and the pointer share this exact transform. */
export function worldToScreen(p: Vec2, camera: Projection = DEFAULT_PROJECTION): Vec2 {
  const v=worldToViewVector(p),scale=worldLengthToScreen(1,camera);
  return{x:camera.origin.x+v.x*scale,y:camera.origin.y+v.y*scale};
}
export function screenToWorld(p: Vec2, camera: Projection = DEFAULT_PROJECTION): Vec2 {
  const scale=worldLengthToScreen(1,camera);
  return viewToWorldVector({x:(p.x-camera.origin.x)/scale,y:(p.y-camera.origin.y)/scale});
}

/** Initial camera preserves combat scale; large maps are explored rather than fit into one screen. */
export function fitMapProjection(map:{width:number;height:number;heroSpawn?:Vec2}):Projection {
  const camera:Projection={...GROUND_VIEW,zoom:GAME_TUNING.cameraZoom,origin:{x:0,y:0}};followProjection(camera,map.heroSpawn??{x:map.width/2,y:map.height/2});return camera;
}

/** Mutate the shared projection before both input inverse projection and rendering. */
export function followProjection(camera:Projection,position:Vec2,anchor:Vec2={x:0,y:0}):void {
  const v=worldToViewVector(position),scale=worldLengthToScreen(1,camera);
  camera.origin.x=anchor.x-v.x*scale;
  camera.origin.y=anchor.y-v.y*scale;
}

/** Same orientation and metric as the arena, fitted inside a UI rectangle. */
export function minimapProjection(map:{width:number;height:number},rect:{x:number;y:number;width:number;height:number}):Projection {
  const extent=(map.width+map.height)*Math.SQRT1_2;
  const camera:Projection={pixelsPerUnit:Math.min(rect.width,rect.height)/extent,zoom:1,origin:{x:0,y:0}};
  followProjection(camera,{x:map.width/2,y:map.height/2},{x:rect.x+rect.width/2,y:rect.y+rect.height/2});
  return camera;
}
/** Exponential follow in world space. A half-life is independent of render frame rate. */
export class SmoothCameraFollow {
  private position?:Vec2;
  update(camera:Projection,target:Vec2,dt:number,snap=false):void {
    if(!this.position||snap||Math.hypot(target.x-this.position.x,target.y-this.position.y)>GAME_TUNING.cameraSnapDistance)this.position={...target};
    else if(Number.isFinite(dt)&&dt>0){
      const blend=1-Math.pow(.5,dt/GAME_TUNING.cameraFollowHalfLife);
      this.position.x+=(target.x-this.position.x)*blend;this.position.y+=(target.y-this.position.y)*blend;
    }
    followProjection(camera,this.position);
  }
}
export function screenVisible(point:Vec2,padding=100):boolean {return Math.abs(point.x)<=640+padding&&Math.abs(point.y)<=360+padding;}
export function visibleWorldBounds(camera:Projection,padding=100):{minX:number;maxX:number;minY:number;maxY:number} {
  const points=[screenToWorld({x:-640-padding,y:-360-padding},camera),screenToWorld({x:640+padding,y:-360-padding},camera),screenToWorld({x:640+padding,y:360+padding},camera),screenToWorld({x:-640-padding,y:360+padding},camera)];
  return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
