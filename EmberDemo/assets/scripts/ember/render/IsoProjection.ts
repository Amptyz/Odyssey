import type { Vec2 } from '../utils/math';
export interface Projection { tileWidth: number; tileHeight: number; zoom: number; origin: Vec2 }
export const DEFAULT_PROJECTION: Projection = { tileWidth: 54, tileHeight: 28, zoom: 1, origin: { x: 0, y: 250 } };
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
  const camera:Projection={tileWidth:54,tileHeight:28,zoom:1,origin:{x:0,y:0}};followProjection(camera,map.heroSpawn??{x:map.width/2,y:map.height/2});return camera;
}

/** Mutate the shared projection before both input inverse projection and rendering. */
export function followProjection(camera:Projection,position:Vec2,anchor:Vec2={x:0,y:0}):void {
  camera.zoom=1;
  camera.origin.x=anchor.x-(position.x-position.y)*camera.tileWidth/2;
  camera.origin.y=anchor.y+(position.x+position.y)*camera.tileHeight/2;
}
export function screenVisible(point:Vec2,padding=100):boolean {return Math.abs(point.x)<=640+padding&&Math.abs(point.y)<=360+padding;}
export function visibleWorldBounds(camera:Projection,padding=100):{minX:number;maxX:number;minY:number;maxY:number} {
  const points=[screenToWorld({x:-640-padding,y:-360-padding},camera),screenToWorld({x:640+padding,y:-360-padding},camera),screenToWorld({x:640+padding,y:360+padding},camera),screenToWorld({x:-640-padding,y:360+padding},camera)];
  return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
