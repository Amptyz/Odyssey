import { Graphics,Node,Sprite } from 'cc';
import type { MapDefinition } from '../content/maps';
import { ENVIRONMENT_APPEARANCES } from '../content/appearances';
import { worldToScreen,type Projection } from './IsoProjection';
import { ArtLibrary } from './ArtLibrary';
import { color,polygon } from './Primitives';
/** Quiet floor and sparse boundary dressing. Decorative props never introduce hidden collisions. */
export class EnvironmentView {
  private nodes:Node[]=[];private foliage:Node[]=[];private falls:{node:Node;baseY:number}[]=[];
  constructor(private readonly floor:Graphics,private readonly ground:Node,private readonly objects:Node,private readonly art:ArtLibrary){}
  configure(map:MapDefinition,camera:Projection):{node:Node;y:number}[]{
    for(const n of this.nodes)n.destroy();this.nodes=[];this.foliage=[];this.falls=[];
    const visual=ENVIRONMENT_APPEARANCES[map.environment]!,f=visual.frames;
    const g=this.floor;g.clear();const project=(x:number,y:number)=>worldToScreen({x,y},camera);
    const diamond=(margin:number)=>[project(-margin,-margin),project(map.width+margin,-margin),project(map.width+margin,map.height+margin),project(-margin,map.height+margin)];
    polygon(g,diamond(2.2),visual.waterOuter);polygon(g,diamond(1.4),visual.waterInner);polygon(g,diamond(.65),map.theme.edge);polygon(g,diamond(0),map.theme.floorA);
    // Large quiet 4x4 paving slabs, no checkerboard or high-frequency grid.
    for(let x=0;x<map.width;x+=4)for(let y=0;y<map.height;y+=4){
      polygon(g,[project(x,y),project(Math.min(x+4,map.width),y),project(Math.min(x+4,map.width),Math.min(y+4,map.height)),project(x,Math.min(y+4,map.height))],((x+y)/4)%3===0?map.theme.floorB:map.theme.floorA,visual.seam);
    }
    const props:{node:Node;y:number}[]=[];
    const add=(frame:number,x:number,y:number,width:number,height?:number,ground=false)=>{
      const p=project(x,y),n=this.art.sprite(ground?this.ground:this.objects,visual.atlas,frame,width,height,`Ruins prop ${frame}`);
      n.setPosition(p.x,p.y+(ground?0:(height??width*this.art.region(visual.atlas,frame).rect[3]/this.art.region(visual.atlas,frame).rect[2])/2));
      this.nodes.push(n);if(!ground)props.push({node:n,y:p.y});return n;
    };
    add(f.crest,map.heroSpawn.x,map.heroSpawn.y,210,108,true);
    // A few sparse paving accents are enough to carry the stone material.
    for(const [x,y] of [[2,3],[map.width-3,3],[3,map.height-3],[map.width-3,map.height-3]])add(f.paving,x!,y!,95,48,true);
    for(const obstacle of map.obstacles)add(obstacle.height>30?f.pillar:f.rubble,obstacle.x,obstacle.y,obstacle.height>30?43:49,obstacle.height>30?70:33);
    // Vegetation and water sit beyond navigation bounds; the walkable center stays clear.
    for(let i=2;i<Math.max(map.width,map.height);i+=4){
      if(i<map.width){this.foliage.push(add(i%8===2?f.foliage:f.shrub,i,-.8,57,46));this.foliage.push(add(i%8===2?f.shrub:f.foliage,i,map.height+.8,53,42));}
      if(i<map.height){this.foliage.push(add(i%8===2?f.shrub:f.foliage,-.8,i,53,42));this.foliage.push(add(i%8===2?f.foliage:f.shrub,map.width+.8,i,57,46));}
    }
    add(f.arch,-.65,4.5,79,84);add(f.crystal,map.width-1,1,54,52);
    for(const [x,y] of [[map.width-3,map.height+.5],[-.4,map.height-4]]){const node=add(f.waterfall,x!,y!,76,78);this.falls.push({node,baseY:node.position.y});}
    return props;
  }
  update(time:number):void{
    for(const [i,node] of this.foliage.entries())node.angle=Math.sin(time*.8+i)*.8;
    for(const [i,fall] of this.falls.entries()){fall.node.setPosition(fall.node.position.x,fall.baseY+Math.sin(time*2+i)*.8);fall.node.getComponent(Sprite)!.color=color(i%2?'#F2FDFF':'#FFFFFF');}
  }
}
