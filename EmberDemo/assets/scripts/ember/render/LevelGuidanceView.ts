import {Label,Node,Graphics} from 'cc';
import {mapDefinition} from '../content/maps';
import type {WorldSnapshot} from '../simulation/GameWorld';
import {levelDefinition} from '../simulation/LevelSystem';
import {distance,type Vec2} from '../utils/math';
import {worldToScreen,type Projection} from './IsoProjection';
import {box,color,disk,graphics,setText,text,uiNode} from './Primitives';
/** Local objective presentation only; authoritative completion stays in LevelSystem/GameWorld. */
export class LevelGuidanceView {
  private readonly root:Node;private readonly markers:Graphics;private readonly minimap:Graphics;private readonly title:Label;private readonly direction:Label;
  constructor(parent:Node){
    this.root=uiNode('Level guidance',parent);const badge=graphics('Objective background',this.root);box(badge,-280,236,560,58,'#20383DD9',9);this.markers=graphics('Exit and objective direction',this.root);this.minimap=graphics('Route minimap',this.root);
    this.title=text('Level objective',this.root,'',15,0,264,560,52,'#F6E5BD');this.direction=text('Objective distance',this.root,'',13,0,205,340,35,'#304E50');
  }
  update(state:WorldSnapshot,camera:Projection):void {
    this.root.active=state.phase==='fighting'&&!state.paused;if(!this.root.active)return;
    const map=mapDefinition(state.mapId),definition=levelDefinition(map,state.wave),level=state.level;
    const enemies=state.units.filter(unit=>unit.alive&&unit.team==='enemy'),exit=level?.exit??definition.exit,active=level?.exitActive??enemies.length===0;
    setText(this.title,`${definition.name} · ${state.wave}/5\n${active?`出口已开启 · 集合 ${level?.insideIds.length??0}/${level?.requiredIds.length??1}`:`消灭全部敌人 ${enemies.length} · 然后前往出口`}`);
    const nearest=enemies.slice().sort((a,b)=>distance(a,state.hero)-distance(b,state.hero)||a.id.localeCompare(b.id))[0];const target=active?exit:nearest??exit;
    this.drawExit(exit,active,camera);this.drawDirection(target,active?'出口':'最近敌人',state,camera);this.drawMinimap(state,exit,active,definition.route);
  }
  private drawExit(exit:Vec2&{radius:number},active:boolean,camera:Projection):void {
    const g=this.markers;g.clear();const p=worldToScreen(exit,camera);g.strokeColor=color(active?'#4CBAA3':'#8D969280');g.fillColor=color(active?'#7CDAC733':'#8D969219');g.lineWidth=active?3:1.5;
    g.ellipse(p.x,p.y,exit.radius*camera.tileWidth/Math.SQRT2,exit.radius*camera.tileHeight/Math.SQRT2);g.fill();g.stroke();
    g.moveTo(p.x-12,p.y+12);g.lineTo(p.x,p.y+26);g.lineTo(p.x+12,p.y+12);g.stroke();
  }
  private drawDirection(target:Vec2,name:string,state:WorldSnapshot,camera:Projection):void {
    const g=this.markers,p=worldToScreen(target,camera),length=Math.hypot(p.x,p.y),scale=Math.min(1,500/Math.max(1,Math.abs(p.x)),210/Math.max(1,Math.abs(p.y))),at={x:p.x*scale,y:p.y*scale};
    const dir=length?{x:p.x/length,y:p.y/length}:{x:0,y:1},side={x:-dir.y,y:dir.x};g.fillColor=color(name==='出口'?'#3DAA95':'#B8795C');
    if(length>45){g.moveTo(at.x+dir.x*10,at.y+dir.y*10);g.lineTo(at.x-dir.x*7+side.x*6,at.y-dir.y*7+side.y*6);g.lineTo(at.x-dir.x*7-side.x*6,at.y-dir.y*7-side.y*6);g.close();g.fill();}
    this.direction.node.setPosition(Math.max(-480,Math.min(480,at.x)),Math.max(-220,Math.min(220,at.y-25)));setText(this.direction,`${name} · ${distance(state.hero,target).toFixed(0)} 格`);
  }
  private drawMinimap(state:WorldSnapshot,exit:Vec2,active:boolean,route:readonly Vec2[]):void {
    const g=this.minimap,map=mapDefinition(state.mapId),left=438,bottom=-247,width=164,height=116,scale=Math.min(width/map.width,height/map.height),x0=left+(width-map.width*scale)/2,y0=bottom+(height+map.height*scale)/2;
    g.clear();box(g,left-10,bottom-10,width+20,height+20,'#20383DD9',9);const project=(p:Vec2)=>({x:x0+p.x*scale,y:y0-p.y*scale});
    g.strokeColor=color('#A2B7AE');g.lineWidth=1;g.rect(x0,y0-map.height*scale,map.width*scale,map.height*scale);g.stroke();
    for(const obstacle of map.obstacles){const p=project(obstacle);disk(g,p.x,p.y,Math.max(1,obstacle.radius*scale),'#687D76');}
    g.strokeColor=color('#C6B28170');g.lineWidth=1;route.forEach((point,index)=>{const p=project(point);if(index===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);});g.stroke();
    for(const unit of state.units)if(unit.alive){const p=project(unit);disk(g,p.x,p.y,unit.team==='hero'?3:2,unit.team==='hero'?(unit.id===state.hero.id?'#80D8EF':'#ABDAB9'):'#E09A7F');}
    const p=project(exit);g.strokeColor=color(active?'#6CE3C4':'#BCB7A2');g.lineWidth=2;g.rect(p.x-3,p.y-3,6,6);g.stroke();
  }
}
