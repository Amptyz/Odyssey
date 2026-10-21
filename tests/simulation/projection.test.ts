import {openMerchantFixture,startCombatFixture} from '../helpers/scenes';
import { describe, it, expect } from 'vitest';
import { worldToScreen, screenToWorld,worldLengthToScreen,minimapProjection,DEFAULT_PROJECTION } from '../../EmberDemo/assets/scripts/ember/render/GroundProjection';
import {worldToViewVector,viewToWorldVector} from '../../EmberDemo/assets/scripts/ember/utils/GroundPlane';
import {shapeContours} from '../../EmberDemo/assets/scripts/ember/combat-core/ShapeContours';
import { Pathfinder } from '../../EmberDemo/assets/scripts/ember/ai/Pathfinder';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {HERO} from '../../EmberDemo/assets/scripts/ember/content/config';
import {distance} from '../../EmberDemo/assets/scripts/ember/utils/math';
import { Random } from '../../EmberDemo/assets/scripts/ember/utils/Random';
describe('M0 / geometry', () => {
  it('round trips world and screen with zoom and camera offset', () => {
    for (const zoom of [0.3, 1, 2.5]) for (let x=0; x<=20; x+=0.7) {
      const p = { x, y: 20-x }, camera = { ...DEFAULT_PROJECTION,zoom, origin: { x: 123,y: -77 } };
      const q = screenToWorld(worldToScreen(p,camera),camera);
      expect(q.x).toBeCloseTo(p.x,10); expect(q.y).toBeCloseTo(p.y,10);
    }
  });
  it('preserves distance and perpendicular axes at every angle, position and zoom',()=>{
    for(const zoom of [.3,1,2.5])for(const center of [{x:0,y:0},{x:45,y:37}]){
      const camera={...DEFAULT_PROJECTION,zoom,origin:{x:123,y:-77}},origin=worldToScreen(center,camera);
      for(let angle=0;angle<360;angle+=5){
        const a=angle*Math.PI/180,p={x:center.x+3*Math.cos(a),y:center.y+3*Math.sin(a)},screen=worldToScreen(p,camera);
        expect(distance(screen,origin)).toBeCloseTo(worldLengthToScreen(3,camera),8);
        const v=worldToViewVector({x:Math.cos(a),y:Math.sin(a)}),back=viewToWorldVector(v);
        expect(Math.hypot(v.x,v.y)).toBeCloseTo(1,10);expect(back.x).toBeCloseTo(Math.cos(a),10);expect(back.y).toBeCloseTo(Math.sin(a),10);
      }
      const x=worldToScreen({x:center.x+1,y:center.y},camera),y=worldToScreen({x:center.x,y:center.y+1},camera);
      expect((x.x-origin.x)*(y.x-origin.x)+(x.y-origin.y)*(y.y-origin.y)).toBeCloseTo(0,8);
    }
  });
  it('projects actual circle/ring warning contours at their collision radii instead of squashing depth',()=>{
    const center={x:12,y:9},p=worldToScreen(center);
    for(const shape of [{kind:'circle' as const,center,radius:3},{kind:'ring' as const,center,radius:3,innerRadius:1.5}]){
      const contours=shapeContours(shape);
      for(const contour of contours)for(const point of contour){
        const r=distance(center,point),screenRadius=distance(p,worldToScreen(point));
        expect(Math.min(Math.abs(r-3),Math.abs(r-1.5))).toBeLessThan(1e-8);
        expect(screenRadius).toBeCloseTo(worldLengthToScreen(r),8);
      }
    }
  });
  it('fits rectangular maps into the minimap with the same orientation and metric as the arena',()=>{
    for(const map of [{width:56,height:44},{width:60,height:44},{width:24,height:20}]){
      const rect={x:438,y:-247,width:164,height:116},mini=minimapProjection(map,rect);
      for(const point of [{x:0,y:0},{x:map.width,y:0},{x:map.width,y:map.height},{x:0,y:map.height}]){
        const p=worldToScreen(point,mini);expect(p.x).toBeGreaterThanOrEqual(rect.x-1e-8);expect(p.x).toBeLessThanOrEqual(rect.x+rect.width+1e-8);
        expect(p.y).toBeGreaterThanOrEqual(rect.y-1e-8);expect(p.y).toBeLessThanOrEqual(rect.y+rect.height+1e-8);
      }
      const a=worldToScreen({x:0,y:0},mini),b=worldToScreen({x:1,y:0},mini),c=worldToScreen({x:0,y:1},mini);
      expect(distance(a,b)).toBeCloseTo(distance(a,c),10);expect(b.x).toBeGreaterThan(a.x);expect(b.y).toBeLessThan(a.y);
    }
  });
  it('routes around expanded obstacles and sweeps dashes', () => {
    const nav = new Pathfinder(); const start = { x: 4,y: 6 }, end = { x: 8,y: 6 };
    const route = nav.find(start,end); expect(route.length).toBeGreaterThan(1);
    let prev = start;
    for (const p of route) { expect(nav.clear(prev,p)).toBe(true); prev=p; }
    expect(nav.sweep(start,end).x).toBeLessThan(5);
    expect(nav.sweep({x:19,y:10},{x:100,y:10}).x).toBeLessThan(nav.map.width);
  });
  it('click movement recovers from a position valid for the hero collision radius beside a pillar',()=>{
    const w=new GameWorld(1234,'frost');openMerchantFixture(w);startCombatFixture(w);
    const pillar=w.map.obstacles.find(o=>o.id==='frost-spine-5')??w.map.obstacles.find(o=>o.x===30&&o.y===40)!;
    expect(pillar).toBeDefined();const start={x:pillar.x-pillar.radius-HERO.radius-.01,y:pillar.y};Object.assign(w.hero,start,{previous:{...start}});
    expect(w.nav.radius).toBe(w.hero.radius);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);
    const destination={x:start.x-2,y:start.y};w.command({type:'MoveTo',point:destination});expect(w.hero.path.length).toBeGreaterThan(0);
    for(let i=0;i<30;i++)w.advance(1/30);expect(distance(w.hero,destination)).toBeLessThan(.15);
  });
  it('routes 300 seeded position pairs without clipping obstacles or corners',()=>{
    const nav=new Pathfinder(),rng=new Random(2026);
    for(let i=0;i<300;i++){
      const start=nav.nearest({x:rng.next()*20,y:rng.next()*20}),end=nav.nearest({x:rng.next()*20,y:rng.next()*20});
      const path=nav.find(start,end);expect(path.length).toBeGreaterThan(0);let p=start;
      for(const next of path){expect(nav.clear(p,next)).toBe(true);p=next;}
      expect(p).toEqual(end);
    }
  });
});
