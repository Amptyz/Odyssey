import { Graphics,Node,Sprite } from 'cc';
import type { MapDefinition } from '../content/maps';
import { ENVIRONMENT_APPEARANCES } from '../content/appearances';
import { screenVisible,visibleWorldBounds,worldToScreen,type Projection } from './IsoProjection';
import { ArtLibrary } from './ArtLibrary';
import { color,polygon } from './Primitives';
interface Prop {frame:number;x:number;y:number;width:number;height:number;ground:boolean;foliage?:boolean;waterfall?:boolean;node?:Node}
/** Viewport paving and lazy, culled sparse scenery keep a large map inexpensive. */
export class EnvironmentView {
  private props:Prop[]=[];private map?:MapDefinition;private lastOrigin={x:NaN,y:NaN};private visibleProps=0;private visibleTiles=0;
  constructor(private readonly floor:Graphics,private readonly ground:Node,private readonly objects:Node,private readonly art:ArtLibrary){}
  configure(map:MapDefinition,camera:Projection):{node:Node;y:number}[]{
    for(const prop of this.props)prop.node?.destroy();this.props=[];this.map=map;this.lastOrigin={x:NaN,y:NaN};
    const f=ENVIRONMENT_APPEARANCES[map.environment]!.frames;
    const add=(frame:number,x:number,y:number,width:number,height:number,ground=false,extra:Partial<Prop>={})=>this.props.push({frame,x,y,width,height,ground,...extra});
    const crestLocations:{x:number;y:number}[]=[];for(const wave of map.waves){const start=wave.level?.start;if(start&&crestLocations.every(at=>Math.hypot(at.x-start.x,at.y-start.y)>=4)){add(f.crest,start.x,start.y,130,67,true);crestLocations.push(start);}}
    for(const obstacle of map.obstacles)add(obstacle.height>40?f.pillar:f.rubble,obstacle.x,obstacle.y,Math.max(43,obstacle.radius*65),Math.max(33,obstacle.height));
    for(let x=4;x<map.width;x+=8){add(f.shrub,x,-.8,53,42,false,{foliage:true});add(f.foliage,x,map.height+.8,57,46,false,{foliage:true});}
    for(let y=5;y<map.height;y+=8){add(f.foliage,-.8,y,57,46,false,{foliage:true});add(f.shrub,map.width+.8,y,53,42,false,{foliage:true});}
    add(f.arch,-.65,9,79,84);add(f.crystal,map.width-2,3,54,52);add(f.waterfall,map.width-5,map.height+.5,76,78,false,{waterfall:true});
    return this.update(0,camera);
  }
  update(time:number,camera:Projection):{node:Node;y:number}[]{
    if(!this.map)return[];const map=this.map,visual=ENVIRONMENT_APPEARANCES[map.environment]!;
    if(camera.origin.x!==this.lastOrigin.x||camera.origin.y!==this.lastOrigin.y){this.drawFloor(camera);this.lastOrigin={...camera.origin};}
    const visible:{node:Node;y:number}[]=[];this.visibleProps=0;
    for(const [index,prop] of this.props.entries()){
      const p=worldToScreen(prop,camera),inView=screenVisible({x:p.x,y:p.y+prop.height/2},prop.width);
      if(!inView){if(prop.node)prop.node.active=false;continue;}
      if(!prop.node)prop.node=this.art.hasPixel('environment')?this.art.pixelSprite(prop.ground?this.ground:this.objects,'environment',prop.frame,prop.width,prop.height):this.art.sprite(prop.ground?this.ground:this.objects,visual.atlas,prop.frame,prop.width,prop.height,`Ruins prop ${prop.frame}`);
      const node=prop.node;node.active=true;node.setPosition(Math.round(p.x),Math.round(p.y+(prop.ground?0:prop.height/2)));
      if(prop.foliage)node.angle=0;
      if(prop.waterfall)node.getComponent(Sprite)!.color=color('#F2FDFF');
      if(!prop.ground)visible.push({node,y:p.y});this.visibleProps++;
    }
    return visible;
  }
  private drawFloor(camera:Projection):void {
    const map=this.map!,visual=ENVIRONMENT_APPEARANCES[map.environment]!,g=this.floor;g.clear();const project=(x:number,y:number)=>worldToScreen({x,y},camera);
    const diamond=(margin:number)=>[project(-margin,-margin),project(map.width+margin,-margin),project(map.width+margin,map.height+margin),project(-margin,map.height+margin)];
    polygon(g,diamond(2.2),visual.waterOuter);polygon(g,diamond(1.4),visual.waterInner);polygon(g,diamond(.65),map.theme.edge);polygon(g,diamond(0),map.theme.floorA);
    const bounds=visibleWorldBounds(camera,90),minX=Math.max(0,Math.floor(bounds.minX/4)*4),maxX=Math.min(map.width,bounds.maxX+4),minY=Math.max(0,Math.floor(bounds.minY/4)*4),maxY=Math.min(map.height,bounds.maxY+4);this.visibleTiles=0;
    for(let x=minX;x<maxX;x+=4)for(let y=minY;y<maxY;y+=4){
      if(!screenVisible(project(x+2,y+2),150))continue;
      polygon(g,[project(x,y),project(Math.min(x+4,map.width),y),project(Math.min(x+4,map.width),Math.min(y+4,map.height)),project(x,Math.min(y+4,map.height))],((x+y)/4)%3===0?map.theme.floorB:map.theme.floorA,visual.seam);this.visibleTiles++;
    }
  }
  debug(){return{visibleProps:this.visibleProps,allocatedProps:this.props.filter(p=>!!p.node).length,totalProps:this.props.length,visibleTiles:this.visibleTiles};}
}
