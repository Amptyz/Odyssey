import { Graphics, Label, Node } from 'cc';
import { HERO } from '../content/config';
import { enemy } from '../content/enemies';
import { mapDefinition,type MapId } from '../content/maps';
import { skill } from '../content/skills';
import { STATUSES } from '../content/statuses';
import { EFFECT_APPEARANCES } from '../content/appearances';
import { drawUnit,drawHero,equipmentVisualKey } from './UnitVisuals';
import type { Unit, WorldSnapshot } from '../simulation/GameWorld';
import { lerp, type Vec2 } from '../utils/math';
import { DEFAULT_PROJECTION, fitMapProjection, worldToScreen, type Projection } from './IsoProjection';
import { box,color,disk,graphics,polygon,setText,text,uiNode } from './Primitives';
interface UnitView {node:Node;body:Graphics;bars:Graphics;ring:Graphics;kind:Unit['kind'];appearanceKey?:string}
/** Nodes are retained/recycled. Only dynamic vector paths are redrawn. */
export class ArenaView {
  readonly camera:Projection={...DEFAULT_PROJECTION,origin:{x:0,y:265}};
  private readonly objects:Node;private readonly floor:Graphics;private mapId?:MapId;
  private readonly effects:Graphics;
  private readonly projectiles:Graphics;
  private readonly targeting:Graphics;
  private readonly units=new Map<string,UnitView>();
  private readonly spare:UnitView[]=[];
  private readonly obstacles:{node:Node;y:number}[]=[];
  private readonly numbers:Label[]=[];
  constructor(private readonly root:Node) {
    const backdrop=graphics('Backdrop',root);box(backdrop,-640,-360,1280,720,'#192B31',0);
    this.floor=graphics('Arena tiles',root);this.targeting=graphics('Ground indicators',root);
    this.objects=uiNode('Depth sorted actors and props',root);
    this.projectiles=graphics('Projectile batch',root);this.effects=graphics('Effect batch',root);
    for(let i=0;i<40;i++) {const label=text(`Floating number ${i}`,root,'',17,0,0,140,36);label.node.active=false;this.numbers.push(label);}
  }
  configureMap(id:MapId):void {
    if(this.mapId===id)return;this.mapId=id;const map=mapDefinition(id);Object.assign(this.camera,fitMapProjection(map));
    for(const obstacle of this.obstacles)obstacle.node.destroy();this.obstacles.length=0;
    // The arena slab has a visible side face, while the playfield stays fully 2D.
    const floor=this.floor;floor.clear();
    const corners=[{x:0,y:0},{x:map.width,y:0},{x:map.width,y:map.height},{x:0,y:map.height}].map(p=>worldToScreen(p,this.camera));
    polygon(floor,[corners[1]!,corners[2]!,corners[3]!,{x:corners[3]!.x,y:corners[3]!.y-16},{x:corners[2]!.x,y:corners[2]!.y-16},{x:corners[1]!.x,y:corners[1]!.y-16}],map.theme.edge);
    for(let x=0;x<map.width;x++)for(let y=0;y<map.height;y++) {
      const points=[{x,y},{x:x+1,y},{x:x+1,y:y+1},{x,y:y+1}].map(p=>worldToScreen(p,this.camera));
      const border=x===0||y===0||x===map.width-1||y===map.height-1;
      polygon(floor,points,border?map.theme.border:(x+y)%2===0?map.theme.floorA:map.theme.floorB,'#B5C3AC');
    }
    const crest=worldToScreen(map.heroSpawn,this.camera);
    floor.strokeColor=color('#A6B89F');floor.lineWidth=2;floor.ellipse(crest.x,crest.y,100,50);floor.stroke();
    floor.ellipse(crest.x,crest.y,90,45);floor.stroke();
    for(const obstacle of map.obstacles) {
      const node=uiNode(obstacle.id,this.objects);const p=worldToScreen(obstacle,this.camera);node.setPosition(p.x,p.y);
      const g=graphics('Stone',node),r=obstacle.radius*27,h=obstacle.height;
      g.fillColor=color('#687B7055');g.ellipse(6,-3,r+8,r*0.6);g.fill();
      polygon(g,[{x:-r,y:0},{x:0,y:-r/2},{x:0,y:h-r/2},{x:-r,y:h}],'#7E9891');
      polygon(g,[{x:0,y:-r/2},{x:r,y:0},{x:r,y:h},{x:0,y:h-r/2}],map.theme.stone);
      polygon(g,[{x:-r,y:h},{x:0,y:h-r/2},{x:r,y:h},{x:0,y:h+r/2}],'#E3E3C9','#A9B8A2');
      if(h>30){box(g,-3,h/2-5,6,15,map.theme.accent,2);disk(g,0,h,4,'#F2D99D');}
      this.obstacles.push({node,y:p.y});
    }
  }
  update(state:WorldSnapshot,alpha:number,pointer:Vec2):void {
    this.configureMap(state.mapId);
    const alive=new Set(state.units.filter(u=>u.alive).map(u=>u.id));
    for(const [id,view] of this.units)if(!alive.has(id)){view.node.active=false;this.spare.push(view);this.units.delete(id);}
    const order=[...this.obstacles];
    for(const u of state.units)if(u.alive) {
      let v=this.units.get(u.id);
      if(!v){v=this.spare.pop() ?? this.makeView(u.kind);v.node.active=true;if(v.kind!==u.kind){v.kind=u.kind;this.drawBody(v);}this.units.set(u.id,v);}
      if(u.kind==='hero'){const key=equipmentVisualKey(state.equipment);if(v.appearanceKey!==key){drawHero(v.body,state.equipment);v.appearanceKey=key;}}
      const p=worldToScreen({x:lerp(u.previous.x,u.x,alpha),y:lerp(u.previous.y,u.y,alpha)},this.camera);
      v.node.setPosition(p.x,p.y);order.push({node:v.node,y:p.y});
      const bar=v.bars;bar.clear();box(bar,-19,47,38,5,'#354D49',2);box(bar,-18,48,36*u.hp/u.maxHp,3,u.kind==='hero'?'#95D4B5':'#DA957E',1);
      if(u.shield>0)box(bar,-18,54,36*Math.min(1,u.shield/65),3,'#A3CFE3',1);
      const ring=v.ring;ring.clear();
      if(u.id===state.targetId){ring.strokeColor=color('#FFF4D6');ring.lineWidth=3;ring.ellipse(0,0,21,11);ring.stroke();}
      if(u.kind==='hero'){ring.strokeColor=color('#F2DDAB');ring.lineWidth=2;ring.ellipse(0,0,19,10);ring.stroke();}
      if(u.shield>0){ring.strokeColor=color('#BDE5EF');ring.lineWidth=2;ring.ellipse(0,20,24,31);ring.stroke();}
      for(const [i,status] of u.statuses.entries())disk(ring,-14+i*12,24,4,STATUSES[status.id].color);
      if(u.windup>0){ring.strokeColor=color('#D87562');ring.lineWidth=3;ring.ellipse(0,0,28,14);ring.stroke();}
    }
    order.sort((a,b)=>b.y-a.y);order.forEach((v,i)=>v.node.setSiblingIndex(i));
    this.drawGround(state,pointer);this.drawProjectiles(state,alpha);this.drawEffects(state);
  }
  private makeView(kind:Unit['kind']):UnitView {
    const node=uiNode('Unit',this.objects);const ring=graphics('Indicators',node),body=graphics('Body',node),bars=graphics('Health',node);
    const v={node,body,bars,ring,kind};this.drawBody(v);return v;
  }
  private drawBody(v:UnitView):void {v.appearanceKey=undefined;drawUnit(v.body,v.kind==='hero'?HERO.appearance:enemy(v.kind).appearance);}
  private drawGround(state:WorldSnapshot,pointer:Vec2):void {
    const g=this.targeting;g.clear();
    if(state.phase!=='fighting'||state.paused)return;
    const aim=worldToScreen(pointer,this.camera);g.strokeColor=color('#FBF5D4');g.lineWidth=1.5;
    g.ellipse(aim.x,aim.y,9,5);g.stroke();g.moveTo(aim.x-13,aim.y);g.lineTo(aim.x+13,aim.y);g.stroke();
    if(state.destination){const p=worldToScreen(state.destination,this.camera);g.strokeColor=color('#548C8A');g.lineWidth=3;g.ellipse(p.x,p.y,14,7);g.stroke();}
    for(const e of state.units)if(e.alive&&e.windup>0&&e.kind!=='hero'&&enemy(e.kind).behavior==='ranged'){
      const a=worldToScreen(e,this.camera),b=worldToScreen(e.aim,this.camera);g.strokeColor=color('#D27D6988');g.lineWidth=5;g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
    }
  }
  private drawProjectiles(state:WorldSnapshot,alpha:number):void {
    const g=this.projectiles;g.clear();
    for(const p of state.projectiles){const at=worldToScreen({x:lerp(p.previous.x,p.x,alpha),y:lerp(p.previous.y,p.y,alpha)},this.camera);
      const tail=worldToScreen({x:p.x-p.vx*0.045,y:p.y-p.vy*0.045},this.camera);
      const palette=EFFECT_APPEARANCES[skill(p.skillId).appearance]!;
      g.strokeColor=color(palette.color);g.lineWidth=p.enemy?5:7;g.moveTo(tail.x,tail.y+16);g.lineTo(at.x,at.y+16);g.stroke();
      disk(g,at.x,at.y+16,p.enemy?5:6,palette.core);}
  }
  private drawEffects(state:WorldSnapshot):void {
    const g=this.effects;g.clear();let index=0;
    for(const cue of state.cues){const p=worldToScreen(cue.at,this.camera),life=cue.ttl/cue.duration;
      if(cue.kind==='damage'||cue.kind==='heal'){
        const label=this.numbers[index++];if(!label)continue;label.node.active=true;label.node.setPosition(p.x,p.y+62+(1-life)*25);
        label.color=color(cue.kind==='heal'?'#E0FFE6':cue.cause==='burn'?'#FFDC9E':'#FFF9E8');
        setText(label,`${cue.kind==='heal'?'+':''}${Math.round(cue.amount??0)}`);
      }else if(cue.kind==='arc'&&cue.to){const to=worldToScreen(cue.to,this.camera);
        g.strokeColor=color(cue.cause==='basic'?'#FFF2BF':'#D4E7FF');g.lineWidth=cue.cause==='basic'?2:3;
        g.moveTo(p.x,p.y+20);g.lineTo((p.x+to.x)/2+8,(p.y+to.y)/2+28);g.lineTo(to.x,to.y+20);g.stroke();
      }else {const radius=(cue.radius??0.4)*(0.6+(1-life)*0.4);g.strokeColor=color(cue.appearance?EFFECT_APPEARANCES[cue.appearance]!.color:cue.kind==='shield'?'#BFECF2':'#F9C184');g.lineWidth=Math.max(1,life*5);
        g.ellipse(p.x,p.y,radius*38,radius*20);g.stroke();}
    }
    for(let i=Math.min(index,this.numbers.length);i<this.numbers.length;i++)this.numbers[i]!.node.active=false;
  }
}
