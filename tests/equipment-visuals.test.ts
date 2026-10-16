import { describe,it,expect } from 'vitest';
import { EQUIPMENT_APPEARANCES,EQUIPMENT_SPRITES,HERO_ARM_ATTACHMENTS,PROCEDURAL_EQUIPMENT } from '../EmberDemo/assets/scripts/ember/content/appearances';

function inside(point:readonly [number,number],points:readonly (readonly [number,number])[]):boolean {
  const [x,y]=point;let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [xi,yi]=points[i]!,[xj,yj]=points[j]!;
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
  }return hit;
}
const covers=(id:string,point:readonly [number,number])=>PROCEDURAL_EQUIPMENT[id]!.polygons.some(p=>inside(point,p.points));
describe('code-native equipment art contract',()=>{
  it('registers eight distinct silhouettes without aliasing the existing PNG atlas',()=>{
    const ids=['reaver','runeblade','duelistVest','wardMantle','sanguineWrap','keenVisor','sageMask','aegisCrown'];
    const silhouettes=new Set<string>();
    for(const id of ids){const visual=PROCEDURAL_EQUIPMENT[id]!;expect(visual).toBeDefined();expect(EQUIPMENT_APPEARANCES[id]!.layer).toBe(visual.layer);expect(EQUIPMENT_SPRITES[id]).toBeUndefined();silhouettes.add(JSON.stringify(visual.polygons.map(p=>p.points)));
      for(const shape of visual.polygons){expect(shape.points.length).toBeGreaterThanOrEqual(3);expect(shape.fill).toMatch(/^#[0-9a-f]{6}$/i);for(const [x,y]of shape.points){expect(Number.isFinite(x)&&Number.isFinite(y)).toBe(true);expect(Math.abs(x)).toBeLessThanOrEqual(17);expect(y).toBeGreaterThanOrEqual(-15);expect(y).toBeLessThanOrEqual(33);}}
    }expect(silhouettes.size).toBe(ids.length);
  });
  it('puts the palm inside a handle and joins each guard to its blade',()=>{
    for(const id of ['reaver','runeblade']){
      const visual=PROCEDURAL_EQUIPMENT[id]!,handle=visual.polygons[0]!.points,guard=visual.polygons[1]!.points,blade=visual.polygons[2]!.points;
      expect(inside([0,0],handle)).toBe(true);expect(inside([0,4],handle)&&inside([0,4],guard)).toBe(true);
      expect(Math.max(...guard.map(p=>p[1]))).toBe(Math.min(...blade.map(p=>p[1])));
      expect(inside([0,10],blade)).toBe(true);
    }
  });
  it('covers the neutral torso and both fixed shoulder joints without moving the bones',()=>{
    for(const id of ['duelistVest','wardMantle','sanguineWrap']){const visual=PROCEDURAL_EQUIPMENT[id]!;expect(covers(id,[0,0])).toBe(true);for(const a of Object.values(HERO_ARM_ATTACHMENTS))expect(covers(id,[a.shoulder[0],a.shoulder[1]-visual.y])).toBe(true);expect(visual.y).toBe(27);}
  });
  it('leaves the mouth and at least one eye exposed for each open headpiece',()=>{
    for(const id of ['keenVisor','sageMask','aegisCrown']){expect(PROCEDURAL_EQUIPMENT[id]!.y).toBe(47);expect(covers(id,[4,-6])).toBe(false);expect(covers(id,[4,0])).toBe(false);}
  });
});
