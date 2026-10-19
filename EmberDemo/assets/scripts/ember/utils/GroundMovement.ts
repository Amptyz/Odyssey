import {GROUND_PROJECTION} from '../content/tuning';
import type {Vec2} from './math';

/** Ground travel measured in horizontal-equivalent units, independent of camera origin/zoom. */
export function groundDistance(delta:Vec2):number {
  return Math.hypot(delta.x-delta.y,(delta.x+delta.y)*GROUND_PROJECTION.tileHeight/GROUND_PROJECTION.tileWidth)/Math.SQRT2;
}
/** Preserve horizontal pace while compensating the isometric vertical compression. */
export function groundSpeedScale(direction:Vec2):number {
  const length=Math.hypot(direction.x,direction.y);
  return length>0&&Number.isFinite(length)?length/groundDistance(direction):0;
}
