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

/** Center any rectangular map in the playable viewport; HUD space stays reserved. */
export function fitMapProjection(map:{width:number;height:number}):Projection {
  const zoom=Math.min(1,1080/((map.width+map.height)*27),560/((map.width+map.height)*14));
  return {tileWidth:54,tileHeight:28,zoom,origin:{x:-(map.width-map.height)*27*zoom/2,y:(map.width+map.height)*14*zoom/2-15}};
}
