/** Shared game-feel knobs. Multipliers are applied once at the runtime boundary. */
export const GROUND_PROJECTION=Object.freeze({tileWidth:54,tileHeight:28});
export const GAME_TUNING=Object.freeze({
  moveSpeedMultiplier:1.5,
  projectileSpeedMultiplier:1.5,
  cameraZoom:1.25,
  cameraFollowHalfLife:.1,
  cameraSnapDistance:12,
});
export const projectileSpeed=(base:number):number=>base*GAME_TUNING.projectileSpeedMultiplier;
