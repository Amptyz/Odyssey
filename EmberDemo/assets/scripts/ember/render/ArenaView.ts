import {campMap} from '../content/scenes';
import {InteractionView} from './InteractionView';
import { Graphics, Label, Node } from 'cc';
import { enemy } from '../content/enemies';
import { mapDefinition,type MapId } from '../content/maps';
import { STATUSES } from '../content/statuses';
import { EFFECT_APPEARANCES } from '../content/appearances';
import { ArtLibrary } from './ArtLibrary';
import {MonsterVisual,drawEnemyWarnings,drawWorldShape,pixelFragment} from './MonsterVisual';
import {shapeContours} from '../combat-core/ShapeContours';
import {CollisionWorld} from '../combat-core/CollisionWorld';
import { AnimatedUnit } from './AnimatedUnit';
import {LevelGuidanceView} from './LevelGuidanceView';
import { EnvironmentView } from './EnvironmentView';
import { PixelVfxView } from './PixelVfxView';
import { motionPose } from '../content/animation';
import type { UnitSnapshot as Unit, WorldSnapshot } from '../simulation/GameWorld';
import { lerp, type Vec2 } from '../utils/math';
import { DEFAULT_PROJECTION, fitMapProjection, SmoothCameraFollow,screenVisible,worldToScreen, type Projection } from './IsoProjection';
import { box,color,disk,graphics,setText,text,uiNode } from './Primitives';
interface UnitView {node:Node;body:AnimatedUnit|MonsterVisual;bars:Graphics;ring:Graphics;kind:Unit['kind']}
/** Nodes are retained/recycled. Only dynamic vector paths are redrawn. */
export class ArenaView {
  readonly camera:Projection={...DEFAULT_PROJECTION,origin:{x:0,y:265}};
  private readonly cameraFollow=new SmoothCameraFollow();private cameraKey='';private cameraTick=-1;
  private readonly objects:Node;private readonly floor:Graphics;private mapKey='';private readonly interactions:InteractionView;
  private readonly effects:Graphics;
  private readonly projectiles:Graphics;
  private readonly pixelVfx:PixelVfxView;
  private readonly targeting:Graphics;private readonly colliders:Graphics;
  private readonly units=new Map<string,UnitView>();
  private readonly spare:UnitView[]=[];
  private readonly guidance:LevelGuidanceView;private readonly environment:EnvironmentView;private visualTime=0;private lastTick=0;
  private readonly obstacles:{node:Node;y:number}[]=[];
  private readonly numbers:Label[]=[];
  constructor(private readonly root:Node,private readonly art:ArtLibrary) {
    const backdrop=graphics('Backdrop',root);box(backdrop,-640,-360,1280,720,'#A9D0CC',0);
    this.floor=graphics('Arena tiles',root);const ground=uiNode('Ground textures',root);this.targeting=graphics('Ground indicators',root);
    this.objects=uiNode('Depth sorted actors and props',root);this.environment=new EnvironmentView(this.floor,ground,this.objects,art);this.interactions=new InteractionView(this.objects,art);
    this.projectiles=graphics('Projectile batch',root);this.effects=graphics('Effect batch',root);
    this.pixelVfx=new PixelVfxView(uiNode('Bounded pixel flipbooks',root),art);
    this.guidance=new LevelGuidanceView(root);
    this.colliders=graphics('Collision debug',root);
    for(let i=0;i<40;i++) {const label=text(`Floating number ${i}`,root,'',17,0,0,140,36);label.node.active=false;this.numbers.push(label);}
  }
  configureMap(id:MapId,camp=false):void {
    const key=id+':'+camp;if(this.mapKey===key)return;this.mapKey=key;const map=camp?campMap(id):mapDefinition(id);Object.assign(this.camera,fitMapProjection(map));
    this.obstacles.length=0;this.obstacles.push(...this.environment.configure(map,this.camera));
  }

  prepareCamera(state:WorldSnapshot,alpha:number,dt=0,presentationKey=''):void {
    this.configureMap(state.mapId,state.scene.kind==='camp');
    const key=`${presentationKey}:${state.mapId}:${state.scene.id}:${state.hero.id}`,snap=this.cameraKey!==key||state.tick<this.cameraTick;
    this.cameraKey=key;this.cameraTick=state.tick;
    this.cameraFollow.update(this.camera,{x:lerp(state.hero.previous.x,state.hero.x,alpha),y:lerp(state.hero.previous.y,state.hero.y,alpha)},state.paused?0:dt,snap);
  }

  update(state:WorldSnapshot,alpha:number,pointer:Vec2,dt=0,debug=false):void {
    if(state.tick<this.lastTick)this.visualTime=state.time;this.lastTick=state.tick;
    if(!state.paused)this.visualTime=['camp','cleared','fighting'].includes(state.phase)?state.time:Math.max(this.visualTime,state.time)+Math.min(dt,.05);
    this.obstacles.length=0;this.obstacles.push(...this.environment.update(this.visualTime,this.camera));
    const visible=(u:Unit)=>u.alive||this.visualTime-u.diedAt<.9;
    const alive=new Set(state.units.filter(visible).map(u=>u.id));
    for(const [id,view] of this.units)if(!alive.has(id)){view.node.active=false;this.spare.push(view);this.units.delete(id);}
    const order=[...this.obstacles,...this.interactions.update(state,this.camera)];
    for(const u of state.units)if(visible(u)) {
      const projected=worldToScreen({x:lerp(u.previous.x,u.x,alpha),y:lerp(u.previous.y,u.y,alpha)},this.camera);
      if(!screenVisible(projected,150)){const cached=this.units.get(u.id);if(cached)cached.node.active=false;continue;}
      let v=this.units.get(u.id);
      if(!v){v=this.spare.pop() ?? this.makeView(u.kind);v.node.active=true;if(v.kind!==u.kind){v.kind=u.kind;v.body.node.destroy();v.body=u.kind==='hero'?new AnimatedUnit(v.node,u.kind,this.art):new MonsterVisual(v.node,u.kind,this.art);v.body.node.setSiblingIndex(1);}this.units.set(u.id,v);}
      v.node.active=true;if(v.body instanceof MonsterVisual)v.body.update(u,state.enemies?.units.find(pose=>pose.id===u.id),this.visualTime);else v.body.update(motionPose(u,this.visualTime),state.party?.find(p=>p.id===u.id)?.appearance??state.appearance);
      const p=worldToScreen({x:lerp(u.previous.x,u.x,alpha),y:lerp(u.previous.y,u.y,alpha)},this.camera);
      v.node.setScale(this.camera.zoom,this.camera.zoom,1);
      v.node.setPosition(Math.round(p.x),Math.round(p.y));order.push({node:v.node,y:p.y});
      const bar=v.bars;bar.node.active=u.alive;bar.node.setPosition(0,v.body.height-47+4);bar.clear();box(bar,-19,47,38,5,'#354D49',2);box(bar,-18,48,36*u.hp/u.maxHp,3,u.kind==='hero'?'#95D4B5':'#DA957E',1);
      if(u.shield>0)box(bar,-18,54,36*Math.min(1,u.shield/65),3,'#A3CFE3',1);
      const ring=v.ring;ring.clear();if(!u.alive)continue;ring.fillColor=color('#405A4730');ring.ellipse(0,-1,Math.max(18,u.radius*38),Math.max(8,u.radius*18));ring.fill();
      if(u.kind==='hero'){ring.strokeColor=color(u.id===state.hero.id?'#F2DDAB':'#8DCBE8');ring.lineWidth=2;ring.ellipse(0,0,19,10);ring.stroke();}
      if(u.shield>0){ring.strokeColor=color('#BDE5EF');ring.lineWidth=2;ring.ellipse(0,20,24,31);ring.stroke();}
      for(const [i,status] of u.statuses.entries())disk(ring,-14+i*12,24,4,STATUSES[status.id].color);
      if(u.windup>0){ring.strokeColor=color('#D87562');ring.lineWidth=3;ring.ellipse(0,0,28,14);ring.stroke();}
    }
    order.sort((a,b)=>b.y-a.y);order.forEach((v,i)=>v.node.setSiblingIndex(i));
    this.drawGround(state,pointer);this.drawProjectiles(state,alpha);this.drawEffects(state);
    this.pixelVfx.update(state,this.camera);
    this.drawColliders(state,debug);this.guidance.update(state,this.camera);
  }
  private makeView(kind:Unit['kind']):UnitView {
    const node=uiNode('Unit',this.objects);const ring=graphics('Indicators',node),body=kind==='hero'?new AnimatedUnit(node,kind,this.art):new MonsterVisual(node,kind,this.art),bars=graphics('Health',node);
    return {node,body,bars,ring,kind};
  }
  debug(){return{time:this.visualTime,camera:{...this.camera,origin:{...this.camera.origin}},environment:this.environment.debug(),vfx:this.pixelVfx.debug(),units:Array.from(this.units,([id,v])=>({id,...v.body.debug(),worldScale:{x:v.node.scale.x,y:v.node.scale.y}}))};}

  private drawGround(state:WorldSnapshot,pointer:Vec2):void {
    const g=this.targeting;g.clear();
    if(!['camp','cleared','fighting'].includes(state.phase))return;const enemies=state.enemies;if(enemies)drawEnemyWarnings(g,enemies,this.camera,this.visualTime);
    const aim=worldToScreen(pointer,this.camera);g.strokeColor=color('#FBF5D4');g.lineWidth=1.5;
    g.ellipse(aim.x,aim.y,9,5);g.stroke();g.moveTo(aim.x-13,aim.y);g.lineTo(aim.x+13,aim.y);g.stroke();
    if(state.destination){const p=worldToScreen(state.destination,this.camera);g.strokeColor=color('#548C8A');g.lineWidth=3;g.ellipse(p.x,p.y,14,7);g.stroke();}
    const collision=new CollisionWorld(mapDefinition(state.mapId));
    for(const zone of state.zones){const shape={kind:'capsule' as const,center:zone.from,end:zone.to,radius:zone.radius};drawWorldShape(g,shape,this.camera,'#BE9E5EAA',1.5,false,shapeContours(shape,collision));}
    for(const swing of state.swings){const shape={kind:'sector' as const,center:swing.center,facing:swing.facing,radius:swing.radius,arc:swing.arc};drawWorldShape(g,shape,this.camera,swing.age<swing.windup?'#BCA37966':'#99744ACC',swing.age<swing.windup?1:3,false,shapeContours(shape,collision));}

  }
  private drawProjectiles(state:WorldSnapshot,alpha:number):void {
    const g=this.projectiles;g.clear();
    for(const p of state.projectiles){const at=worldToScreen({x:lerp(p.previous.x,p.x,alpha),y:lerp(p.previous.y,p.y,alpha)},this.camera);
      const tail=worldToScreen({x:p.x-p.vx*0.045,y:p.y-p.vy*0.045},this.camera);
      const palette=EFFECT_APPEARANCES[p.appearance]!;
      g.strokeColor=color(palette.color);g.lineWidth=p.cause==='basic'?3:5;g.moveTo(tail.x,tail.y);g.lineTo(at.x,at.y);g.stroke();
      drawWorldShape(g,{kind:'circle',center:{x:lerp(p.previous.x,p.x,alpha),y:lerp(p.previous.y,p.y,alpha)},radius:p.radius},this.camera,palette.core,1,true);}
  }
  private drawEffects(state:WorldSnapshot):void {
    const g=this.effects;g.clear();let index=0,particles=0;
    for(const cue of state.cues){const p=worldToScreen(cue.at,this.camera),life=cue.ttl/cue.duration;
      if(cue.kind==='damage'||cue.kind==='heal'){
        const label=this.numbers[index++];if(!label)continue;label.node.active=true;label.node.setPosition(p.x,p.y+62*this.camera.zoom+(1-life)*25);
        label.color=color(cue.kind==='heal'?'#245E4D':cue.critical?'#A65738':cue.trueDamage?'#446B87':cue.cause==='burn'?'#9D4B25':'#503F32');
        setText(label,`${cue.kind==='heal'?'+':''}${Math.round(cue.amount??0)}${cue.critical?'!':''}`);
      }else if(cue.shape){
        const tint=cue.appearance?EFFECT_APPEARANCES[cue.appearance]!.color:cue.cause==='enemy'?'#D87562':'#C79D58';
        drawWorldShape(g,cue.shape,this.camera,tint,Math.max(1,life*3),false,cue.contours);
        // Decorations use a fixed bounded count and simulation cue age. They never define danger.
        const paths=cue.contours??shapeContours(cue.shape),budget=Math.min(12,Math.max(0,72-particles));particles+=budget;
        for(let j=0;j<budget;j++){const path=paths[j%paths.length];if(!path?.length)continue;const at=path[Math.floor((j+.5)*path.length/budget)%path.length]!,q=worldToScreen(at,this.camera),age=1-life;pixelFragment(g,q.x+Math.sin(j*7+cue.id)*age*5,q.y,age<.3?3:2,cue.appearance??'physical',tint,age);}
      }else if(cue.kind==='arc'&&cue.to){const to=worldToScreen(cue.to,this.camera);
        g.strokeColor=color(cue.cause==='basic'?'#FFF2BF':'#D4E7FF');g.lineWidth=cue.cause==='basic'?2:3;
        g.moveTo(p.x,p.y+20);g.lineTo((p.x+to.x)/2+8,(p.y+to.y)/2+28);g.lineTo(to.x,to.y+20);g.stroke();
      }else {drawWorldShape(g,{kind:'circle',center:cue.at,radius:cue.radius??.4},this.camera,cue.appearance?EFFECT_APPEARANCES[cue.appearance]!.color:cue.kind==='shield'?'#BFECF2':'#F9C184',Math.max(1,life*3));}
    }
    for(let i=Math.min(index,this.numbers.length);i<this.numbers.length;i++)this.numbers[i]!.node.active=false;
  }
  private sector(g:Graphics,center:Vec2,facing:Vec2,radius:number,arc:number,tint:string,width:number):void {
    const origin=worldToScreen(center,this.camera),angle=Math.atan2(facing.y,facing.x);g.strokeColor=color(tint);g.lineWidth=width;g.moveTo(origin.x,origin.y);
    for(let i=0;i<=24;i++){const a=angle-arc/2+arc*i/24,p=worldToScreen({x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius},this.camera);g.lineTo(p.x,p.y);}
    g.lineTo(origin.x,origin.y);g.stroke();
  }
  private capsule(g:Graphics,from:Vec2,to:Vec2,radius:number,tint:string,width:number):void {
    const angle=Math.atan2(to.y-from.y,to.x-from.x),points:Vec2[]=[];
    for(const [center,start] of [[to,angle-Math.PI/2],[from,angle+Math.PI/2]] as const)for(let i=0;i<=12;i++){
      const a=start+Math.PI*i/12;points.push(worldToScreen({x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius},this.camera));
    }
    g.strokeColor=color(tint);g.lineWidth=width;g.moveTo(points[0]!.x,points[0]!.y);
    for(const p of points.slice(1))g.lineTo(p.x,p.y);g.close();g.stroke();
  }
  private drawColliders(state:WorldSnapshot,enabled:boolean):void {
    const g=this.colliders;g.clear();if(!enabled)return;g.lineWidth=1.5;
    const circle=(at:Vec2,radius:number,tint:string)=>{const p=worldToScreen(at,this.camera);g.strokeColor=color(tint);g.ellipse(p.x,p.y,radius*this.camera.tileWidth*this.camera.zoom/Math.SQRT2,radius*this.camera.tileHeight*this.camera.zoom/Math.SQRT2);g.stroke();};
    for(const o of (state.scene.kind==='camp'?campMap(state.mapId):mapDefinition(state.mapId)).obstacles)circle(o,o.radius,'#50635A');
    for(const u of state.units)if(u.alive)circle(u,u.radius,u.team==='hero'?'#008BA3':'#BD4935');
    for(const p of state.projectiles)circle(p,p.radius,'#CB9A1C');
    for(const p of state.enemies.projectiles)drawWorldShape(g,{kind:'circle',center:p,radius:p.radius},this.camera,'#ED2C63',1.5);
    for(const w of state.enemies.warnings)drawWorldShape(g,w.shape,this.camera,'#EB2C79',1,false,w.contours);
    for(const c of state.cues)if(c.shape)drawWorldShape(g,c.shape,this.camera,'#00A1BC',1,false,c.contours);
  }
}
