import type {Vec2} from './math';

/**
 * Unit-length ground basis. World +x points down-right and +y down-left in
 * Cocos' upward-positive view coordinates. Rotation/reflection only: no
 * foreshortening, camera scale, or movement correction belongs here.
 */
export function worldToViewVector(v:Vec2):Vec2 {
  return{x:(v.x-v.y)*Math.SQRT1_2,y:-(v.x+v.y)*Math.SQRT1_2};
}

export function viewToWorldVector(v:Vec2):Vec2 {
  return{x:(v.x-v.y)*Math.SQRT1_2,y:-(v.x+v.y)*Math.SQRT1_2};
}
