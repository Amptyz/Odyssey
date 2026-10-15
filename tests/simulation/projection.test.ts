import { describe, it, expect } from 'vitest';
import { worldToScreen, screenToWorld } from '../../EmberDemo/assets/scripts/ember/render/IsoProjection';
import { Pathfinder } from '../../EmberDemo/assets/scripts/ember/ai/Pathfinder';
import { Random } from '../../EmberDemo/assets/scripts/ember/utils/Random';
describe('M0 / geometry', () => {
  it('round trips world and screen with zoom and camera offset', () => {
    for (const zoom of [0.3, 1, 2.5]) for (let x=0; x<=20; x+=0.7) {
      const p = { x, y: 20-x }, camera = { tileWidth: 54, tileHeight: 28, zoom, origin: { x: 123,y: -77 } };
      const q = screenToWorld(worldToScreen(p,camera),camera);
      expect(q.x).toBeCloseTo(p.x,10); expect(q.y).toBeCloseTo(p.y,10);
    }
  });
  it('routes around expanded obstacles and sweeps dashes', () => {
    const nav = new Pathfinder(); const start = { x: 4,y: 6 }, end = { x: 8,y: 6 };
    const route = nav.find(start,end); expect(route.length).toBeGreaterThan(1);
    let prev = start;
    for (const p of route) { expect(nav.clear(prev,p)).toBe(true); prev=p; }
    expect(nav.sweep(start,end).x).toBeLessThan(5);
    expect(nav.sweep({x:19,y:10},{x:100,y:10}).x).toBeLessThan(20);
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
