import {Node,Graphics,Label} from 'cc';
import type {WorldSnapshot} from '../simulation/GameWorld';
import {ArtLibrary} from './ArtLibrary';
import {HeroRig} from './HeroRig';
import {worldToScreen,type Projection} from './IsoProjection';
import {drawWorldShape} from './MonsterVisual';
import {box,color,graphics,text,uiNode} from './Primitives';
/** Reusable markers/NPCs. No interaction or readiness is decided by animation. */
export class InteractionView {
  private key='';private entries:{id:string;node:Node;ring:Graphics;label:Label;rig?:HeroRig}[]=[];
  constructor(private readonly parent:Node,private readonly art:ArtLibrary){}
  update(s:WorldSnapshot,camera:Projection):{node:Node;y:number}[]{
    const key=s.scene.id+':'+s.scene.interactions.map(n=>n.id+':'+n.claimed).join(',');
    if(key!==this.key){
      this.key=key;for(const e of this.entries)e.node.destroy();this.entries=[];
      for(const item of s.scene.interactions){
        const node=uiNode(item.name,this.parent),ring=graphics('Interaction base',node);let rig:HeroRig|undefined;
        if(item.kind==='merchant'){rig=new HeroRig(node,this.art);rig.equip({body:'leather',head:'hood'});const counter=graphics('Merchant counter',node);box(counter,-23,-2,46,20,'#6E5545',2);box(counter,-25,14,50,7,'#C8AD78',1);}
        if(item.kind==='ember'){
          // A restrained, hard-edged ember above a stone plinth.
          const glyph=graphics('Ember beacon',node);box(glyph,-16,-3,32,9,'#6B7770',1);box(glyph,-12,5,24,7,'#DED5B6',1);
          glyph.fillColor=color(item.claimed?'#8D9C91':'#DD9B4F');glyph.moveTo(0,54);glyph.lineTo(13,32);glyph.lineTo(8,20);glyph.lineTo(-8,20);glyph.lineTo(-13,32);glyph.close();glyph.fill();
          if(!item.claimed){glyph.fillColor=color('#FFE1A0');glyph.moveTo(0,44);glyph.lineTo(6,30);glyph.lineTo(0,24);glyph.lineTo(-6,30);glyph.close();glyph.fill();}
        }
        const label=text('Interaction name',node,item.claimed?'余烬 · 已领取':item.name,14,0,item.kind==='departure'?28:84,230,30,'#304C4A');
        this.entries.push({id:item.id,node,ring,label,rig});
      }
    }
    return this.entries.map(e=>{
      const item=s.scene.interactions.find(n=>n.id===e.id)!,p=worldToScreen(item,camera);e.node.setPosition(Math.round(p.x),Math.round(p.y));
      e.rig?.pose({state:'idle',age:s.time,facing:1});e.ring.clear();
      const localCamera={...camera,origin:{x:camera.origin.x-p.x,y:camera.origin.y-p.y}};
      drawWorldShape(e.ring,{kind:'circle',center:item,radius:item.radius},localCamera,item.kind==='departure'?'#469B85':item.claimed?'#91A39855':'#C19A5955',item.kind==='departure'?3:1);
      return{node:e.node,y:p.y};
    });
  }
}
