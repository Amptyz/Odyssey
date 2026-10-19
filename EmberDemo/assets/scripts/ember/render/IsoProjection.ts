import type { Vec2 } from '../utils/math';
import {GAME_TUNING,GROUND_PROJECTION} from '../content/tuning';
export interface Projection { tileWidth: number; tileHeight: number; zoom: number; origin: Vec2 }
export const DEFAULT_PROJECTION: Projection = { ...GROUND_PROJECTION, zoom: GAME_TUNING.cameraZoom, origin: { x: 0, y: 250 } };
/** Cocos UI coordinates point upward; world +x/+y move toward screen bottom. */
export function worldToScreen(p: Vec2, camera: Projection = DEFAULT_PROJECTION): Vec2 {
  return { x: camera.origin.x + (p.x - p.y) * camera.tileWidth * camera.zoom / 2,
    y: camera.origin.y - (p.x + p.y) * camera.tileHeight * camera.zoom / 2 };
}
export function screenToWorld(p: Vec2, camera: Projection = DEFAULT_PROJECTION): Vec2 {
  const x = (p.x - camera.origin.x) / (camera.tileWidth * camera.zoom / 2);
  const y = -(p.y - camera.origin.y) / (camera.tileHeight * camera.zoom / 2);
  return { x: (x + y) / 2, y: (y - x) / 2 };
}

/** Initial camera preserves combat scale; large maps are explored rather than fit into one screen. */
export function fitMapProjection(map:{width:number;height:number;heroSpawn?:Vec2}):Projection {
  const camera:Projection={...GROUND_PROJECTION,zoom:GAME_TUNING.cameraZoom,origin:{x:0,y:0}};followProjection(camera,map.heroSpawn??{x:map.width/2,y:map.height/2});return camera;
}

/** Mutate the shared projection before both input inverse projection and rendering. */
export function followProjection(camera:Projection,position:Vec2,anchor:Vec2={x:0,y:0}):void {
  camera.origin.x=anchor.x-(position.x-position.y)*camera.tileWidth*camera.zoom/2;
  camera.origin.y=anchor.y+(position.x+position.y)*camera.tileHeight*camera.zoom/2;
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
