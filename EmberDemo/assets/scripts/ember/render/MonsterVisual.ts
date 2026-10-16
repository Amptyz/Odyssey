import {Graphics,Node,UIOpacity,Sprite,UITransform} from 'cc';
import {ArtLibrary} from './ArtLibrary';
import {PIXEL_ATLASES} from '../content/pixel-art';
import {shapeContours} from '../combat-core/ShapeContours';
import {enemy,type EnemyKind} from '../content/enemies';
import type {EnemyPose,EnemySnapshot,EnemyWarning} from '../simulation/EnemySystem';
import type {HitShape} from '../combat-core/CollisionWorld';
import {worldToScreen,type Projection} from './IsoProjection';
import {colourForMonster} from './monster-palettes';
import {color,graphics,polygon,uiNode} from './Primitives';
import type {Vec2} from '../utils/math';
interface RenderUnit {alive:boolean;velocity:Vec2;facing:Vec2;hurtAt:number;diedAt:number}
/** Formal low-detail procedural art: seventeen silhouettes, common grounded animation, no placeholder atlas recolours. */
export class MonsterVisual {
 readonly node:Node;private readonly g:Graphics;private readonly opacity:UIOpacity;
 readonly height:number;private state='idle';
 private readonly image?:Sprite;private frame=-1;private atlasKey='';private poseKey='';private phase=1;
 constructor(parent:Node,readonly kind:EnemyKind,private readonly art?:ArtLibrary){this.node=uiNode(`Monster ${kind}`,parent,140,160);this.g=this.node.addComponent(Graphics);this.opacity=this.node.addComponent(UIOpacity);this.height=PIXEL_ATLASES[kind]?.height??colourForMonster(kind).height;if(art&&PIXEL_ATLASES[kind]){this.image=uiNode('Pixel body',this.node).addComponent(Sprite);this.image.sizeMode=Sprite.SizeMode.CUSTOM;}}
 update(unit:RenderUnit,pose:EnemyPose|undefined,time:number):void {
  if(this.image&&this.art){this.updatePixel(unit,pose,time);return;}
  const facing=unit.facing.x-unit.facing.y<0?-1:1,dead=!unit.alive,death=dead?Math.min(1,Math.max(0,time-unit.diedAt)/.75):0;
  this.node.setScale(facing,1-death*.65,1);this.opacity.opacity=dead?Math.round(255*Math.max(0,1-Math.max(0,time-unit.diedAt-.35)/.55)):255;
  this.state=dead?'death':pose?.state??'idle';this.g.clear();
  const p=colourForMonster(this.kind),moving=Math.hypot(unit.velocity.x,unit.velocity.y)>.15,walk=moving?Math.sin(time*13):0,breath=dead?0:Math.sin(time*3)*.7;
  const prep=pose?.state==='windup'?1:0,cast=pose?.actionId&&pose.state!=='idle'&&pose.state!=='walk'?1:0;
  const strike=pose?.strike??(pose?.state==='attack'?1:0),hurt=time-unit.hurtAt<.18?1:0,raise=prep*5-strike*8;
  const body=hurt?'#E9C4AC':p.body,light=p.light,dark=p.dark,accent=p.accent,g=this.g;
  const oval=(x:number,y:number,rx:number,ry:number,fill:string)=>{g.fillColor=color(fill);g.strokeColor=color('#53666A');g.lineWidth=1.6;g.ellipse(x,y,rx,ry);g.fill();g.stroke();};
  const slab=(x:number,y:number,w:number,h:number,fill:string,r=4)=>{g.fillColor=color(fill);g.strokeColor=color('#53666A');g.lineWidth=1.6;g.roundRect(x,y,w,h,r);g.fill();g.stroke();};
  const poly=(pts:number[][],fill:string)=>polygon(g,pts.map(v=>({x:v[0]!,y:v[1]!})),fill,'#53666A');
  const feet=(spread:number,count=2)=>{for(let i=0;i<count;i++){const x=(i-(count-1)/2)*spread;slab(x-4,1+Math.max(0,walk*(i%2?1:-1))*2,8,7,dark,3);}};
  const face=(x:number,y:number)=>{slab(x-6,y,4,3,dark,1);slab(x+3,y,4,3,dark,1);};
  const leaf=(x:number,y:number,w:number,h:number,fill=accent)=>poly([[x-w,y],[x-w*.65,y+h*.7],[x,y+h],[x+w,y+h*.35]],fill);
  switch(this.kind){
   case 'melee':
    feet(13);poly([[-14,8],[-17,29+breath],[-5,46+breath],[12,39+breath],[17,15]],body);leaf(-4,43,14,8);face(0,30);slab(-20,13+raise,9,18,light);poly([[14,18+raise],[24+strike*7,24+raise],[34+strike*9,40+raise],[20,31+raise]],light);break;
   case 'ranged':
    feet(12);oval(0,24+breath,16,20,body);face(-2,32);slab(-22,14+raise,44,16,light);for(const x of [-14,0,14])oval(x,23+raise,6,7,accent);slab(-5,18+raise,10,10,dark);break;
   case 'stoneback':
    feet(8,6);oval(0,15+breath,25,15,body);poly([[-23,18],[-15,32],[13,35],[24,22],[12,13]],light);poly([[-20,24],[-26,30],[-17,28]],accent);poly([[19,25],[27,30],[20,18]],accent);face(0,11);break;
   case 'reedLancer':
    feet(12);slab(-10,8,21,37+breath,body);leaf(-5,43,6,14);leaf(6,43,5,17);face(0,34);slab(-16,20+raise,25,9,accent);slab(-17+strike*12,26+raise,62,4,dark,1);poly([[43+strike*12,23+raise],[57+strike*12,29+raise],[43+strike*12,34+raise]],light);break;
   case 'sunbud':
    feet(13);for(const a of [-2.4,-.4,1.4])oval(Math.cos(a)*12,27+Math.sin(a)*12+breath,13,17,body);oval(0,27+breath,11,12,light);leaf(-18,15+raise,9,13);leaf(18,15+raise,9,13);oval(0,46+prep*3,6,8,accent);face(0,28);break;
   case 'frostling':
    feet(11);poly([[-13,8],[-10,34],[0,40],[12,31],[14,8]],body);leaf(-9,35,6,16,light);leaf(0,38,6,20,accent);leaf(9,33,6,17,light);face(0,29);slab(9,15+raise,10+strike*7,15,accent);break;
   case 'shardCrab':
    feet(12,4);poly([[-19,9],[-23,21],[0,31],[21,21],[17,9]],body);poly([[-18,22],[0,31],[14,21],[0,14]],light);for(const side of [-1,1]){const y=25+raise+(side===1?5:0),x=side*(25+strike*3);oval(x,y,10,12,accent);poly([[x-6,y+10],[x,y+2],[x+7,y+11]],light);}face(0,13);break;
   case 'rimeMoth':
    feet(9);const wing=7+Math.sin(time*(moving?14:5))*3+prep*5-strike*4;
    poly([[-4,13],[-29,20],[-29-wing,39],[-12,44],[-4,29]],accent);poly([[4,13],[29,20],[29+wing,39],[12,44],[4,29]],light);oval(0,22+breath,7,18,body);slab(-7,39,4,10,dark,2);slab(4,39,4,10,dark,2);face(0,30);break;
   case 'chimeSentry':
    feet(17);slab(-10,5,5,19,dark);slab(5,5,5,19,dark);oval(0,31+breath,12,16,body);oval(1,48+prep*2,10,10,light);slab(6,44+raise,29+strike*5,6,dark,2);g.strokeColor=color(accent);g.lineWidth=5;g.moveTo(-11,53);g.lineTo(-11,65);g.lineTo(10,65);g.lineTo(10,55);g.stroke();face(0,49);break;
   case 'snowHare':
    feet(9,4);oval(-4,15+breath,18,12,body);oval(12,24,11,10,light);slab(9,29-prep*3,7,22,accent);slab(19,29-prep*3,7,19,light);oval(-14-strike*5,11,9,10,accent);oval(-24,18,5,5,light);face(16,26);break;
   case 'warden':
    feet(24);slab(-24,8,48,48+breath,body,8);for(const [x,y,w] of [[-17,58,17],[7,62,22],[22,57,13]])oval(x!,y!,w!,14,accent);slab(-37,11+raise,20,37,light);slab(21+strike*6,11+raise,21,39,light);face(0,43);poly([[-5,25],[0,32],[6,25],[0,20]],p.gold);break;
   case 'emberRam':
    feet(13,4);poly([[-28,10],[-27,30],[-6,47],[22,37],[29,13]],body);leaf(-12,38,12,10);leaf(5,38,11,10);oval(26,26+raise,13,14,light);g.lineWidth=7;g.strokeColor=color(accent);g.moveTo(15,36+raise);g.lineTo(17,49+raise);g.lineTo(33,51+raise);g.lineTo(40,36+raise);g.stroke();face(28,27+raise);break;
   case 'bellKeeper':
    feet(24);poly([[-28,10],[-26,43],[-13,64],[12,65],[27,43],[30,10]],body);oval(0,30+breath,15,22,dark);slab(-29,12+raise,8,36,light);slab(23,12+raise,8,36,light);slab(-18,27+raise,36,6,accent);oval(0,66,6,6,p.gold);face(0,49);break;
   case 'mirrorKnight':
    feet(25);poly([[-28,54],[28,54],[18,30],[0,10],[-18,30]],body);poly([[-28,54],[-35,68],[-13,61],[0,70],[15,61],[33,69],[28,54]],light);oval(0,58,10,12,light);for(const side of [-1,1])poly([[side*25,35+raise],[side*(35+strike*8),59+raise],[side*(43+strike*8),30+raise],[side*26,19+raise]],accent);face(0,59);break;
   case 'rimeWeaver':
    feet(19);g.strokeColor=color(accent);g.lineWidth=7;g.circle(0,40,29);g.stroke();g.lineWidth=5;for(let i=0;i<4;i++){const a=i*Math.PI/2;g.moveTo(Math.cos(a)*15,40+Math.sin(a)*15);g.lineTo(Math.cos(a)*28,40+Math.sin(a)*28);g.stroke();}oval(0,23,13,20,body);for(const side of [-1,1])for(const y of [18,36])slab(side<0?-29:10,y+raise,19,7,light);face(0,33);break;
   case 'courtyardHeart':{
    feet(21,4);slab(-34,5,68,29,light,8);oval(0,49+breath,37,34,body);oval(0,48,24,23,accent);for(const side of [-1,1]){slab(side<0?-50:29,25+raise,21,40,light,7);poly([[side*35,45+raise],[side*(57+strike*8),56+raise],[side*(62+strike*8),32+raise],[side*43,25+raise]],body);}
    const lid=pose?.phase===2?11:0;oval(0,78+lid+prep*8+cast*3,37,12,light);slab(-9,88+lid+prep*8+cast*3,18,7,p.gold);face(0,51);break;
   }
   case 'mirrorRegent':{
    feet(42);poly([[-30,7],[-30,74],[-21,102],[0,119],[22,103],[31,74],[31,7],[20,11],[19,71],[12,91],[0,101],[-13,90],[-19,71],[-19,12]],body);
    for(const side of [-1,1])poly([[side*25,73],[side*(39+strike*8),57+raise],[side*(45+strike*8),24+raise],[side*32,29+raise]],accent);
    if(pose?.phase===2)poly([[0,48],[-19,70],[0,94],[19,70]],light);else oval(0,70+breath,20,25,light);
    poly([[0,60],[-8,71],[0,82],[8,71]],pose?.phase===2?dark:p.gold);break;
   }
  }
  if(pose?.state==='broken'){g.strokeColor=color(p.gold);g.lineWidth=3;g.moveTo(-12,this.height-3);g.lineTo(-4,this.height+3);g.lineTo(3,this.height-3);g.lineTo(12,this.height+3);g.stroke();}
 }
 private updatePixel(unit:RenderUnit,pose:EnemyPose|undefined,time:number):void {
  this.phase=pose?.phase??1;this.atlasKey=this.phase===2&&PIXEL_ATLASES[this.kind+'-phase2']?this.kind+'-phase2':this.kind;
  const a=PIXEL_ATLASES[this.atlasKey]!,dead=!unit.alive,moving=Math.hypot(unit.velocity.x,unit.velocity.y)>.15,hurt=unit.hurtAt>=0&&time-unit.hurtAt<.18&&!pose?.actionId;
  this.state=dead?'death':hurt?'hurt':pose?.actionId&&pose.age>=pose.windup&&pose.strike>.05?'attack':moving&&!pose?.actionId?'walk':pose?.state??'idle';let key=dead?'death':hurt?'hurt':this.state==='walk'?(Math.floor(time*7)%2?'walkA':'walkB'):'idle';
  if(!dead&&!hurt&&pose?.actionId&&['windup','attack','recover'].includes(pose.state)){const step=pose.state==='windup'?'windup':pose.strike>.05?'strike':'recovery';key=`${pose.actionId}:${step}`;if(!a.poses.includes(key))key=step;}
  if(!dead&&!hurt&&pose?.phase===2&&key==='idle'&&a.poses.includes('phase2'))key='phase2';
  const index=Math.max(0,a.poses.indexOf(key));this.poseKey=key;this.frame=index;const f=a.frames[index]!;this.image!.spriteFrame=this.art!.pixelFrame(this.atlasKey,index);const ui=this.image!.node.getComponent(UITransform)!;ui.setContentSize(f.rect[2]*a.scale,f.rect[3]*a.scale);ui.setAnchorPoint(...f.anchor);
  this.node.setScale(pose?.actionId?pose.facing:unit.facing.x-unit.facing.y<0?-1:1,1,1);this.image!.color=color(hurt?'#FFD8C8':'#FFFFFF');this.opacity.opacity=dead?Math.round(255*Math.max(0,1-Math.max(0,time-unit.diedAt-.35)/.55)):255;
 }
 debug(){return {kind:this.kind,atlas:this.image?'pixel-v1/'+this.atlasKey:'procedural-monster-v1',frame:this.frame,poseKey:this.poseKey,phase:this.phase,pose:{state:this.state}};}
}
function outline(shape:HitShape):Vec2[][] {
 const ring=(r:number)=>Array.from({length:49},(_,i)=>({x:shape.center.x+Math.cos(i*Math.PI/24)*r,y:shape.center.y+Math.sin(i*Math.PI/24)*r}));
 if(shape.kind==='circle')return [ring(shape.radius)];if(shape.kind==='ring')return [ring(shape.radius),ring(shape.innerRadius)];
 if(shape.kind==='rectangle'){const f=shape.facing,s={x:-f.y*shape.width/2,y:f.x*shape.width/2},end={x:shape.center.x+f.x*shape.length,y:shape.center.y+f.y*shape.length};return [[{x:shape.center.x+s.x,y:shape.center.y+s.y},{x:end.x+s.x,y:end.y+s.y},{x:end.x-s.x,y:end.y-s.y},{x:shape.center.x-s.x,y:shape.center.y-s.y}]];}
 if(shape.kind==='sector'){const angle=Math.atan2(shape.facing.y,shape.facing.x);return [[shape.center,...Array.from({length:25},(_,i)=>{const a=angle-shape.arc/2+i*shape.arc/24;return {x:shape.center.x+Math.cos(a)*shape.radius,y:shape.center.y+Math.sin(a)*shape.radius};})]];}
 const a=Math.atan2(shape.end.y-shape.center.y,shape.end.x-shape.center.x);return [[...Array.from({length:13},(_,i)=>{const angle=a-Math.PI/2+i*Math.PI/12;return {x:shape.end.x+Math.cos(angle)*shape.radius,y:shape.end.y+Math.sin(angle)*shape.radius};}),...Array.from({length:13},(_,i)=>{const angle=a+Math.PI/2+i*Math.PI/12;return {x:shape.center.x+Math.cos(angle)*shape.radius,y:shape.center.y+Math.sin(angle)*shape.radius};})]];
}
/** Call after clearing the ground Graphics. Bodies are a separate depth-sorted layer. */
export function drawEnemyWarnings(g:Graphics,snapshot:EnemySnapshot,projection:Projection,time:number):void {
 let fragments=0;
 for(const w of snapshot.warnings){
  const active=time>=w.triggerAt,progress=Math.max(0,Math.min(1,(time-w.createdAt)/Math.max(.01,w.triggerAt-w.createdAt))),tint=color(w.colour);tint.a=active?110:20+Math.round(progress*24);
  for(const pts of w.contours??outline(w.shape)){
   const points=pts.map(v=>worldToScreen(v,projection));if(!points.length)continue;
   g.moveTo(points[0]!.x,points[0]!.y);for(const p of points.slice(1))g.lineTo(p.x,p.y);if(w.shape.kind!=='ring')g.close();
   if(w.shape.kind!=='ring'){g.fillColor=tint;g.fill();}
   g.strokeColor=color(w.damageType==='true'?'#61718C':active?'#E9CE96':'#8F6D68');g.lineWidth=active?3:1.8;g.stroke();
  }
  // Distinct segment pips communicate delayed second hits without relying on colour.
  const c=worldToScreen(w.shape.center,projection);for(let i=0;i<=Math.min(2,w.segment);i++){g.fillColor=color(w.colour);g.circle(c.x-4+i*5,c.y+4,1.8);g.fill();}
  if(active&&fragments<36){const family=/hearth/.test(w.actionId)?'fire':/mirror|regent|rime|frost|chime/.test(w.actionId)?'ice':/bell|mist/.test(w.actionId)?'mist':'physical';const paths=w.contours??outline(w.shape);for(let i=0;i<6&&fragments<36;i++,fragments++){const path=paths[i%paths.length];if(!path?.length)continue;const at=path[Math.floor(path.length*(i+.5)/6)%path.length]!,p=worldToScreen(at,projection);pixelFragment(g,p.x,p.y,3,family,w.colour,Math.min(1,(time-w.triggerAt)/.2));}}
 }
 for(const b of snapshot.projectiles){const p=worldToScreen(b,projection),old=worldToScreen(b.previous,projection);g.strokeColor=color(b.colour);g.lineWidth=2;g.moveTo(old.x,old.y);g.lineTo(p.x,p.y);g.stroke();drawWorldShape(g,{kind:'circle',center:b,radius:b.radius},projection,b.colour,1,true);}
}
/** Small code-native elemental clusters. These are decorations; world cores are drawn separately. */
export function pixelFragment(g:Graphics,x:number,y:number,size:number,family:string,tint:string,age:number):void {
 x=Math.round(x);y=Math.round(y);g.fillColor=color(tint);
 if(family==='fire'){const lift=Math.round(age*13);g.rect(x,y+lift,size,size*2);g.rect(x+size,y+lift+size,size,size);g.fill();g.fillColor=color('#FFE4A1');g.rect(x,y+lift,Math.max(1,size-1),size);g.fill();}
 else if(family==='ice'){g.moveTo(x,y-size);g.lineTo(x+size,y);g.lineTo(x,y+size*2);g.lineTo(x-size,y);g.close();g.fill();}
 else if(family==='physical'){g.moveTo(x-size,y);g.lineTo(x+size*2,y+size);g.lineTo(x,y+size*2);g.close();g.fill();}
 else if(family==='shield'){g.rect(x-size,y-size,size*2,size*2);g.fill();g.strokeColor=color('#D8F6F4');g.lineWidth=1;g.rect(x-size*2,y-size*2,size*4,size*4);g.stroke();}
 else {g.rect(x-size,y,size*2,size);g.rect(x,y-size,size,size*3);g.fill();}
}
/** Physical core is always the projected authoritative world shape; no screen-radius fudge. */
export function drawWorldShape(g:Graphics,shape:HitShape,projection:Projection,tint:string,width=2,fill=false,contours?:Vec2[][]):void {
 for(const path of contours??shapeContours(shape)){
  if(!path.length)continue;const pts=path.map(p=>worldToScreen(p,projection));g.moveTo(pts[0]!.x,pts[0]!.y);for(const p of pts.slice(1))g.lineTo(p.x,p.y);if(shape.kind!=='ring')g.close();
  if(fill&&shape.kind!=='ring'){g.fillColor=color(tint);g.fill();}g.strokeColor=color(tint);g.lineWidth=width;g.stroke();
 }
}
