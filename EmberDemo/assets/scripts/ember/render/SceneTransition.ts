import {Label,Node,UIOpacity} from 'cc';
import type {WorldSnapshot} from '../simulation/GameWorld';
import {box,graphics,setText,text,uiNode} from './Primitives';

const BLACK_HOLD=.04,REVEAL=.18;
const TITLE_DELAY=BLACK_HOLD+REVEAL,TITLE_IN=.24,TITLE_HOLD=1.45,TITLE_OUT=.45;
const TITLE_DURATION=TITLE_DELAY+TITLE_IN+TITLE_HOLD+TITLE_OUT;
const smooth=(t:number):number=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Local presentation only: never delays commands, simulation, or room synchronization. */
export class SceneTransition {
  private readonly node:Node;
  private readonly opacity:UIOpacity;
  private readonly titleNode:Node;
  private readonly titleOpacity:UIOpacity;
  private readonly title:Label;
  private readonly subtitle:Label;
  private titleElapsed=TITLE_DURATION;
  private place?:string;
  private lastTick=0;
  private elapsed=BLACK_HOLD+REVEAL;
  private sequence=0;
  constructor(parent:Node){
    // A reused sibling below the curtain, without input listeners or gameplay state.
    this.titleNode=uiNode('Location title',parent,600,86);this.titleNode.setPosition(0,130);
    const plate=graphics('Title backing',this.titleNode);
    box(plate,-300,-43,600,86,'#111117D9',0);
    box(plate,-230,42,460,1,'#BAA379',0);box(plate,-160,-43,320,1,'#BAA379',0);
    this.title=text('Location name',this.titleNode,'',30,0,12,552,46,'#F1E6D2');
    this.subtitle=text('Location subtitle',this.titleNode,'',15,0,-20,552,25,'#CEC8BC');
    this.titleOpacity=this.titleNode.addComponent(UIOpacity);this.titleOpacity.opacity=0;this.titleNode.active=false;
    this.node=uiNode('Scene transition',parent);
    box(graphics('Black curtain',this.node),-640,-360,1280,720,'#000000',0);
    this.opacity=this.node.addComponent(UIOpacity);
    this.node.active=false;
  }
  update(state:WorldSnapshot,dt:number,generation:string):void {
    // Personal panels and clearing enemies do not change the physical place.
    const place=`${generation}:${state.mapId}:${state.scene.id}:${state.stagePhase==='ready'?'menu':'world'}`;
    const first=this.place===undefined,step=Number.isFinite(dt)?Math.max(0,dt):0;
    const changed=this.place!==undefined&&(place!==this.place||state.tick<this.lastTick);
    this.place=place;this.lastTick=state.tick;
    if(changed){this.elapsed=0;this.sequence++;}
    else this.elapsed=Math.min(BLACK_HOLD+REVEAL,this.elapsed+step);
    this.opacity.opacity=Math.round(255*(1-smooth((this.elapsed-BLACK_HOLD)/REVEAL)));
    this.node.active=this.opacity.opacity>0;
    if(first||changed){
      this.titleElapsed=state.stagePhase==='ready'?TITLE_DURATION:0;
      setText(this.title,state.scene.name);setText(this.subtitle,state.scene.subtitle??'');
      this.title.node.setPosition(0,state.scene.subtitle?12:0);
    }else this.titleElapsed=Math.min(TITLE_DURATION,this.titleElapsed+step);
    const age=this.titleElapsed-TITLE_DELAY;
    this.titleOpacity.opacity=Math.round(255*smooth(age/TITLE_IN)*(1-smooth((age-TITLE_IN-TITLE_HOLD)/TITLE_OUT)));
    const unobstructed=['camp','fighting','cleared'].includes(state.phase)&&!state.paused&&!state.developer?.open;
    this.titleNode.active=unobstructed&&this.titleOpacity.opacity>0;
  }
  debug(){return {active:this.node.active,opacity:this.opacity.opacity,sequence:this.sequence,place:this.place,elapsed:this.elapsed,duration:BLACK_HOLD+REVEAL,
    title:{active:this.titleNode.active,name:this.title.string,subtitle:this.subtitle.string,opacity:this.titleOpacity.opacity,elapsed:this.titleElapsed,duration:TITLE_DURATION}};}
}
