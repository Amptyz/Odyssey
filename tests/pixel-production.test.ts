import {describe,it,expect} from 'vitest';
import {PIXEL_ATLASES} from '../EmberDemo/assets/scripts/ember/content/pixel-art';
import {ENEMIES} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {ENEMY_ACTION_SETS} from '../EmberDemo/assets/scripts/ember/content/enemy-actions';
import {shapeContours,cloneShape} from '../EmberDemo/assets/scripts/ember/combat-core/ShapeContours';
import {CollisionWorld,type HitShape} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {worldToScreen,DEFAULT_PROJECTION} from '../EmberDemo/assets/scripts/ember/render/IsoProjection';
import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
describe('production pixel assets and authoritative visual geometry',()=>{
 it('covers every enemy and dedicated skill gestures, with separate complete boss phase sheets',()=>{
  expect(Object.keys(ENEMIES)).toHaveLength(17);
  for(const [id,e]of Object.entries(ENEMIES)){const a=PIXEL_ATLASES[id]!;expect(a,id).toBeDefined();for(const p of ['idle','walkA','walkB','windup','strike','recovery','hurt','death'])expect(a.poses,id).toContain(p);for(const skill of ENEMY_ACTION_SETS[e.actionSet]!.skills)for(const p of ['windup','strike','recovery'])expect(a.poses,id).toContain(`${skill}:${p}`);if(e.category==='boss'){const phase=PIXEL_ATLASES[id+'-phase2']!;expect(phase.poses).toEqual(a.poses);expect(phase.scale).toBe(a.scale);}}
  for(const id of ['weapons','bodies','heads'])expect(PIXEL_ATLASES[id]!.frames).toHaveLength(6);expect(PIXEL_ATLASES.skills!.frames).toHaveLength(9);
 });
 it('has finite measured contact anchors and common body scale rather than frame fitting',()=>{for(const [id,a]of Object.entries(PIXEL_ATLASES)){expect(a.scale,id).toBeGreaterThan(0);expect(a.frames,id).toHaveLength(a.poses.length);for(const f of a.frames){expect(f.rect.every(Number.isFinite)).toBe(true);expect(f.rect[2]).toBeGreaterThan(0);expect(f.rect[3]).toBeGreaterThan(0);expect(f.anchor.every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true);}}});
 it('projects the full constant circle radius, not a screen circle or growing60percent cue',()=>{const shape:HitShape={kind:'circle',center:{x:10,y:10},radius:7.6},points=shapeContours(shape)[0]!;for(const p of points)expect(Math.hypot(p.x-10,p.y-10)).toBeCloseTo(7.6);const c=worldToScreen(shape.center),screens=points.map(p=>worldToScreen(p));expect(Math.max(...screens.map(p=>p.x-c.x))).toBeCloseTo(7.6*54/Math.SQRT2,0);});
 it('keeps ring holes empty, straight lanes separate, full capsule width, and clips to real blockers',()=>{
  const ring:HitShape={kind:'ring',center:{x:10,y:10},radius:4,innerRadius:1.8},paths=shapeContours(ring);expect(paths).toHaveLength(2);for(const p of paths[1]!)expect(Math.hypot(p.x-10,p.y-10)).toBeCloseTo(1.8);
  const cap=shapeContours({kind:'capsule',center:{x:10,y:10},end:{x:18,y:10},radius:.96})[0]!;expect(Math.max(...cap.map(p=>p.y))-Math.min(...cap.map(p=>p.y))).toBeCloseTo(1.92);
  const terrain=new CollisionWorld({width:30,height:30,obstacles:[{x:13,y:10,radius:1}]});const clipped=shapeContours({kind:'circle',center:{x:10,y:10},radius:7.6},terrain)[0]!;expect(Math.max(...clipped.filter(p=>Math.abs(p.y-10)<.01).map(p=>p.x))).toBeCloseTo(12);
  const lane:HitShape={kind:'rectangle',center:{x:10,y:10},facing:{x:1,y:0},length:13,width:.72};const line=shapeContours(lane)[0]!;expect(Math.max(...line.map(p=>p.y))-Math.min(...line.map(p=>p.y))).toBeCloseTo(.72);expect(Math.max(...line.map(p=>p.x))).toBe(23);
 });
 it('freezes and deep copies exact skill core geometry in snapshots',()=>{
  const world=new GameWorld(1234);world.command({type:'Start'});world.command({type:'LeaveShop'});world.command({type:'CastSlot',slot:'R',point:{x:world.hero.x+1,y:world.hero.y}});const first=world.snapshot(),cue=first.cues.find(c=>c.kind==='explosion')!;expect(cue.shape?.kind).toBe('circle');expect(cue.radius).toBe(7.6);expect(cue.contours?.length).toBeGreaterThan(0);if(cue.shape){const c=cloneShape(cue.shape);c.center.x=-100;expect(cue.shape.center.x).not.toBe(-100);}cue.contours![0]![0]!.x=-100;expect(world.snapshot().cues.find(c=>c.id===cue.id)!.contours![0]![0]!.x).not.toBe(-100);
 });
});
