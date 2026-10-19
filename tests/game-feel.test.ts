import {describe,it,expect} from 'vitest';
import {GAME_TUNING} from '../EmberDemo/assets/scripts/ember/content/tuning';
import {AttributeSet,PLAYER_TEMPLATE,movementSpeed} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {ENEMIES} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {SKILLS} from '../EmberDemo/assets/scripts/ember/content/skills';
import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {DEFAULT_PROJECTION,SmoothCameraFollow,worldToScreen,screenToWorld,visibleWorldBounds} from '../EmberDemo/assets/scripts/ember/render/IsoProjection';
import {startCombatFixture} from './helpers/scenes';
const camera=()=>({...DEFAULT_PROJECTION,origin:{x:0,y:0}});
function world(){const w=new GameWorld();startCombatFixture(w);for(const [id,a]of w.actors)if(a.team==='enemy')w.actors.delete(id);Object.assign(w.hero,{x:20,y:20,previous:{x:20,y:20}});return w;}
describe('global combat pace',()=>{
 it('increases ordinary player and enemy movement by fifty percent through the shared conversion',()=>{
  expect(GAME_TUNING.moveSpeedMultiplier).toBe(1.5);
  expect(movementSpeed(new AttributeSet(PLAYER_TEMPLATE).value)).toBeCloseTo(6.3);
  expect(movementSpeed(new AttributeSet(ENEMIES.melee.template).value)).toBeCloseTo(4.68);
  expect(movementSpeed(new AttributeSet(ENEMIES.snowHare.template).value)).toBeCloseTo(5.94);
 });
 it('scales actual player basic and skill projectiles once while preserving their maximum range',()=>{
  const w=world();w.combat.addPerk('missileAttack');w.command({type:'Attack',point:{x:30,y:20}});
  const p=w.projectiles.find(p=>p.cause==='basic')!;expect(Math.hypot(p.vx,p.vy)).toBeCloseTo(27);expect(p.remaining*Math.hypot(p.vx,p.vy)).toBeCloseTo(w.stats.attackRange);
  w.command({type:'CastSkill',skillId:'fireball',point:{x:30,y:20}});const q=w.projectiles.find(p=>p.skillId==='fireball')!;
  const b=SKILLS.fireball.behavior;if(b.kind!=='projectile')throw Error('Expected projectile fixture');
  expect(Math.hypot(q.vx,q.vy)).toBeCloseTo(b.speed*1.5);expect(q.remaining*Math.hypot(q.vx,q.vy)).toBeCloseTo(b.range);
 });
 it('moves a real enemy pearl at nine tiles per second instead of six',()=>{
  const w=world();w.spawnEnemy('ranged',{x:26,y:20});
  for(let i=0;i<60&&!w.enemies.snapshot().projectiles.length;i++)w.advance(1/30);
  const before=w.enemies.snapshot().projectiles[0]!;expect(before).toBeDefined();w.advance(1/30);const after=w.enemies.snapshot().projectiles[0]!;
  expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeCloseTo(9/30);
 });
});
describe('smooth zoomed camera',()=>{
 it('keeps exact inverse projection at the nearer view and reduces the visible world window',()=>{
  const c=camera(),f=new SmoothCameraFollow();f.update(c,{x:20,y:20},0);
  expect(c.zoom).toBe(1.25);expect(worldToScreen({x:20,y:20},c)).toEqual({x:0,y:0});
  const b=visibleWorldBounds(c,0),wide=visibleWorldBounds({...c,zoom:1},0);expect(b.maxX-b.minX).toBeCloseTo((wide.maxX-wide.minX)/1.25);
  f.update(c,{x:24,y:21},.05);const p={x:28,y:22},back=screenToWorld(worldToScreen(p,c),c);expect(back.x).toBeCloseTo(p.x);expect(back.y).toBeCloseTo(p.y);
 });
 it('eases halfway in one half-life, settles without overshoot, and leaves the shared view still at dt zero',()=>{
  const c=camera(),f=new SmoothCameraFollow();f.update(c,{x:0,y:0},0);f.update(c,{x:8,y:0},GAME_TUNING.cameraFollowHalfLife);
  expect(screenToWorld({x:0,y:0},c).x).toBeCloseTo(4);const before={...c.origin};f.update(c,{x:8,y:0},0);expect(c.origin).toEqual(before);
  f.update(c,{x:8,y:0},1);const x=screenToWorld({x:0,y:0},c).x;expect(x).toBeLessThan(8);expect(x).toBeGreaterThan(7.99);
 });
 it('has the same follow response at 30 and 144 FPS',()=>{
  const run=(fps:number)=>{const c=camera(),f=new SmoothCameraFollow();f.update(c,{x:0,y:0},0);for(let i=0;i<fps;i++)f.update(c,{x:8,y:3},1/fps);return c;};
  const a=run(30),b=run(144);expect(a.origin.x).toBeCloseTo(b.origin.x,10);expect(a.origin.y).toBeCloseTo(b.origin.y,10);
 });
 it('snaps on scene resets or long teleports and ignores invalid frame deltas',()=>{
  const c=camera(),f=new SmoothCameraFollow();f.update(c,{x:0,y:0},0);f.update(c,{x:30,y:20},.016);expect(worldToScreen({x:30,y:20},c)).toEqual({x:0,y:0});
  f.update(c,{x:31,y:20},0,true);expect(worldToScreen({x:31,y:20},c)).toEqual({x:0,y:0});const before={...c.origin};
  f.update(c,{x:32,y:20},NaN);f.update(c,{x:32,y:20},-1);expect(c.origin).toEqual(before);
 });
});
