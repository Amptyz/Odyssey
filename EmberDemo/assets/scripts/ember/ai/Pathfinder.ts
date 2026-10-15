import { ARENA_SIZE, OBSTACLES } from '../content/config';
import { clamp, distance, type Vec2 } from '../utils/math';
import { MinHeap } from './MinHeap';
export interface Obstacle extends Vec2 { radius: number }
/** A half-cell grid with radius-expanded obstacles and no diagonal corner cutting. */
export class Pathfinder {
  readonly step = 0.5;
  private readonly n = ARENA_SIZE * 2;
  private readonly blocked = new Uint8Array(this.n * this.n);
  private readonly edges: {id:number;cost:number}[][] = [];
  constructor(readonly obstacles: readonly Obstacle[] = OBSTACLES, readonly radius = 0.36) {
    for (let i = 0; i < this.blocked.length; i++) this.blocked[i] = this.walkable(this.point(i)) ? 0 : 1;
    for(let i=0;i<this.blocked.length;i++) {
      const neighbors:{id:number;cost:number}[]=[];this.edges.push(neighbors);
      if(this.blocked[i])continue;
      const x=i%this.n,y=Math.floor(i/this.n);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) {
        const nx=x+dx,ny=y+dy,id=ny*this.n+nx;
        if((dx===0&&dy===0)||nx<0||ny<0||nx>=this.n||ny>=this.n||this.blocked[id])continue;
        if(dx&&dy&&(this.blocked[y*this.n+nx]||this.blocked[ny*this.n+x]))continue;
        if(this.clear(this.point(i),this.point(id)))neighbors.push({id,cost:Math.hypot(dx,dy)*this.step});
      }
    }
  }
  walkable(p: Vec2, radius = this.radius): boolean {
    return p.x >= radius && p.y >= radius && p.x <= ARENA_SIZE-radius && p.y <= ARENA_SIZE-radius &&
      this.obstacles.every(o => distance(p, o) >= radius + o.radius);
  }
  clear(a: Vec2, b: Vec2, radius = this.radius): boolean {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.12));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable({ x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t }, radius)) return false;
    }
    return true;
  }
  /** Swept motion, shared by normal movement and dash. Never teleport across blockers. */
  sweep(a: Vec2, b: Vec2, radius = this.radius): Vec2 {
    const count = Math.max(1, Math.ceil(distance(a,b) / 0.08));
    let last = { ...a };
    for (let i=1; i<=count; i++) {
      const p = { x: a.x+(b.x-a.x)*i/count, y: a.y+(b.y-a.y)*i/count };
      if (!this.walkable(p, radius)) break;
      last = p;
    }
    return last;
  }
  nearest(p: Vec2): Vec2 {
    const bounded = { x: clamp(p.x, this.radius, ARENA_SIZE-this.radius), y: clamp(p.y, this.radius, ARENA_SIZE-this.radius) };
    if (this.walkable(bounded)) return bounded;
    let best = { x: 10, y: 10 }, bestD = Infinity;
    for (let i=0; i<this.blocked.length; i++) if (!this.blocked[i]) {
      const cell = this.point(i), d = distance(bounded, cell);
      if (d < bestD) { bestD = d; best = cell; }
    }
    return best;
  }
  find(start: Vec2, requested: Vec2): Vec2[] {
    const end = this.nearest(requested);
    if (this.clear(start, end)) return [end];
    const s = this.connectedIndex(start), goal = this.connectedIndex(end);
    const open = new MinHeap(), closed = new Uint8Array(this.blocked.length);
    const costs = new Float64Array(this.blocked.length).fill(Infinity), parents = new Int32Array(this.blocked.length).fill(-1);
    costs[s]=0;open.push(s,0);
    while (open.size) {
      let current = open.pop();
      if(closed[current])continue;
      if (current === goal) {
        const route: Vec2[] = [end];
        while (current !== s) { route.unshift(this.point(current)); current = parents[current]!; }
        // Keep the first grid center as well when needed near an obstacle.
        if (!this.clear(start, route[0]!)) route.unshift(this.point(s));
        return route;
      }
      closed[current]=1;
      for (const edge of this.edges[current]!) {
        const next=edge.id;if(closed[next])continue;
        const g = costs[current]! + edge.cost;
        if (g < costs[next]!) { costs[next]=g; parents[next]=current; open.push(next,g+distance(this.point(next),this.point(goal))); }
      }
    }
    return [];
  }
  private index(p: Vec2): number { return clamp(Math.floor(p.y/this.step),0,this.n-1)*this.n+clamp(Math.floor(p.x/this.step),0,this.n-1); }
  private connectedIndex(p:Vec2):number {
    const initial=this.index(p);if(!this.blocked[initial]&&this.clear(p,this.point(initial)))return initial;
    let best=initial,bestD=Infinity;
    for(let i=0;i<this.blocked.length;i++)if(!this.blocked[i]){
      const d=distance(p,this.point(i));if(d<bestD&&this.clear(p,this.point(i))){best=i;bestD=d;}
    }
    return best;
  }
  private point(i: number): Vec2 { return { x: (i%this.n+0.5)*this.step, y: (Math.floor(i/this.n)+0.5)*this.step }; }
}
