/** Shared game-feel knobs. Multipliers are applied once at the runtime boundary. */
// One scalar for both screen axes. Preserve the old horizontal scale without
// shortening ground depth or coupling simulation speeds to the camera.
export const GROUND_VIEW=Object.freeze({pixelsPerUnit:54/Math.SQRT2});
export const GAME_TUNING=Object.freeze({
  moveSpeedMultiplier:1.5,
  projectileSpeedMultiplier:1.5,
  cameraZoom:1.25,
  cameraFollowHalfLife:.1,
  cameraSnapDistance:12,
});
export const projectileSpeed=(base:number):number=>base*GAME_TUNING.projectileSpeedMultiplier;
