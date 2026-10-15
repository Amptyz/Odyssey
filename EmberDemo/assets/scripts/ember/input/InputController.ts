import { EventKeyboard, EventMouse, game, Input, input, KeyCode, Node, UITransform, Vec3, view } from 'cc';
import type { CommandPort } from '../platform/protocol';
import type { WorldSnapshot } from '../simulation/GameWorld';
import { distance,type Vec2 } from '../utils/math';
import { screenToWorld,worldToScreen,type Projection } from '../render/IsoProjection';
import type { Hud } from '../render/Hud';
import type { SkillId } from '../content/config';
export type ControlMode='classic'|'wasd';
const STORAGE_KEY='ember.controlMode';
const KEY_SKILLS:Partial<Record<number,SkillId>> = {[KeyCode.KEY_Q]:'Q',[KeyCode.KEY_W]:'W',[KeyCode.KEY_E]:'E',[KeyCode.KEY_R]:'R'};
export class InputController {
  pointer:Vec2={x:12,y:10};private state?:WorldSnapshot;
  private readonly held=new Set<number>();
  private attacking=false;private pointerLocal?:Vec2;private mode:ControlMode='classic';
  get controlMode():ControlMode{return this.mode;}
  constructor(private readonly root:Node,private readonly camera:Projection,private readonly port:CommandPort,private readonly hud:Hud) {
    input.on(Input.EventType.MOUSE_MOVE,this.onMove,this);input.on(Input.EventType.MOUSE_DOWN,this.onDown,this);
    input.on(Input.EventType.MOUSE_UP,this.onUp,this);
    input.on(Input.EventType.KEY_DOWN,this.onKey,this);input.on(Input.EventType.KEY_UP,this.onKeyUp,this);
    try{if(localStorage.getItem(STORAGE_KEY)==='wasd')this.mode='wasd';}catch{/* Storage may be disabled. */}
    this.hud.setControlMode(this.mode);this.hud.onControlMode=mode=>this.setMode(mode);
    if(typeof window!=='undefined'){window.addEventListener('contextmenu',this.onContext);window.addEventListener('blur',this.onBlur);document.addEventListener('visibilitychange',this.onVisibility);window.addEventListener('mouseup',this.onWindowUp);window.addEventListener('keydown',this.onBrowserKey);}
  }
  update(state:WorldSnapshot):void {
    if(this.state&&(this.state.phase!==state.phase||this.state.paused!==state.paused||this.state.wave!==state.wave||state.tick<this.state.tick))this.clear();
    this.state=state;
    if(this.pointerLocal)this.pointer=this.aimPoint(this.pointerLocal);
    if(this.mode!=='wasd'||state.phase!=='fighting'||state.paused)return;
    const x=Number(this.held.has(KeyCode.KEY_D))-Number(this.held.has(KeyCode.KEY_A));
    const y=Number(this.held.has(KeyCode.KEY_W))-Number(this.held.has(KeyCode.KEY_S));
    // WASD follows screen directions, not the tilted world-grid axes.
    const v=screenToWorld({x:this.camera.origin.x+x,y:this.camera.origin.y+y},this.camera);
    const length=Math.hypot(v.x,v.y);
    this.port.send({type:'DirectInput',movement:length?{x:v.x/length,y:v.y/length}:{x:0,y:0},attack:this.attacking?this.pointer:undefined});
  }
  private setMode(mode:ControlMode):void {
    this.clear();this.mode=mode;this.hud.setControlMode(mode);
    try{localStorage.setItem(STORAGE_KEY,mode);}catch{/* Keep the in-memory choice. */}
  }
  private clear():void {this.held.clear();this.attacking=false;this.port.send({type:'Stop'});}
  destroy():void {
    this.clear();input.off(Input.EventType.MOUSE_UP,this.onUp,this);
    input.off(Input.EventType.MOUSE_MOVE,this.onMove,this);input.off(Input.EventType.MOUSE_DOWN,this.onDown,this);
    input.off(Input.EventType.KEY_DOWN,this.onKey,this);input.off(Input.EventType.KEY_UP,this.onKeyUp,this);
    if(typeof window!=='undefined'){window.removeEventListener('contextmenu',this.onContext);window.removeEventListener('blur',this.onBlur);document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('mouseup',this.onWindowUp);window.removeEventListener('keydown',this.onBrowserKey);}
  }
  private local(e:EventMouse):Vec2 {
    // Creator's fixed-size Web Desktop buffer can be scaled by CSS without updating
    // view.getScaleX/Y. Normalize actual displayed pixels into the render buffer first.
    const canvas=game.canvas,rect=canvas?.getBoundingClientRect();
    let p=e.getUILocation();
    if(canvas&&rect&&rect.width>0&&rect.height>0){
      const raw=e.getLocation(),viewport=view.getViewportRect(),dpr=view.getDevicePixelRatio();
      p.x=(raw.x*canvas.width/(rect.width*dpr)-viewport.x)/view.getScaleX();
      p.y=(raw.y*canvas.height/(rect.height*dpr)-viewport.y)/view.getScaleY();
    }
    const v=this.root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x,p.y,0));return{x:v.x,y:v.y};
  }
  private hit(p:Vec2) {
    return this.state?.units.filter(u=>u.alive&&u.team==='enemy').sort((a,b)=>(b.x+b.y)-(a.x+a.y)).find(u=>{
      const s=worldToScreen(u,this.camera);return distance({x:p.x,y:(p.y-22)*0.65},{x:s.x,y:s.y*0.65})<25;
    });
  }
  private aimPoint(p:Vec2):Vec2 {
    const hit=this.mode==='wasd'?this.hit(p):undefined;
    return hit?{x:hit.x,y:hit.y}:screenToWorld(p,this.camera);
  }
  private onMove(e:EventMouse):void {this.pointerLocal=this.local(e);this.pointer=this.aimPoint(this.pointerLocal);}
  private onDown(e:EventMouse):void {
    game.canvas?.focus();
    const p=this.local(e);this.pointerLocal=p;this.pointer=this.aimPoint(p);
    const button=e.getButton();
    if(button===EventMouse.BUTTON_LEFT&&this.hud.click(p))return;
    if(!this.state||this.state.phase!=='fighting'||this.state.paused)return;
    if(this.mode==='wasd'){
      if(button===EventMouse.BUTTON_LEFT){this.attacking=true;this.port.send({type:'Attack',point:this.pointer});}
      if(button===EventMouse.BUTTON_RIGHT)this.port.send({type:'CastSkill',skillId:'Q',point:this.pointer});
    }else if(button===EventMouse.BUTTON_RIGHT){
      const hit=this.hit(p);this.port.send(hit?{type:'SetTarget',targetId:hit.id}:{type:'MoveTo',point:this.pointer});
    }
  }
  private onUp(e:EventMouse):void {if(e.getButton()===EventMouse.BUTTON_LEFT)this.attacking=false;}
  private onKey(e:EventKeyboard):void {
    if(this.held.has(e.keyCode))return;this.held.add(e.keyCode);
    const skill=this.mode==='wasd'?(e.keyCode===KeyCode.SPACE?'W':e.keyCode===KeyCode.KEY_W?undefined:KEY_SKILLS[e.keyCode]):KEY_SKILLS[e.keyCode];
    if(skill)this.port.send({type:'CastSkill',skillId:skill,point:this.pointer});
    else if(e.keyCode===KeyCode.ESCAPE)this.port.send({type:'TogglePause'});
    else if(e.keyCode===KeyCode.F3)this.hud.toggleDebug();
    else if(e.keyCode===KeyCode.DIGIT_1)this.hud.keyChoice(0);
    else if(e.keyCode===KeyCode.DIGIT_2)this.hud.keyChoice(1);
    else if(e.keyCode===KeyCode.DIGIT_3)this.hud.keyChoice(2);
    else if(e.keyCode===KeyCode.ENTER) {
      if(this.state?.phase==='ready')this.port.send({type:'Start'});
      else if(this.state?.phase==='victory'||this.state?.phase==='defeat')this.port.send({type:'Restart'});
    }
  }
  private onKeyUp(e:EventKeyboard):void {this.held.delete(e.keyCode);}
  private onWindowUp=(e:MouseEvent):void=>{if(e.button===0)this.attacking=false;};
  private onBrowserKey=(e:KeyboardEvent):void=>{if(e.code==='Space'&&e.target===game.canvas)e.preventDefault();};
  private onContext=(e:Event):void=>{if(e.target instanceof HTMLCanvasElement)e.preventDefault();};
  private onBlur=():void=>{
    this.clear();
    if(this.state?.phase==='fighting'&&!this.state.paused){this.state={...this.state,paused:true};this.port.send({type:'TogglePause'});}
  };
  private onVisibility=():void=>{if(document.hidden)this.onBlur();};
}
