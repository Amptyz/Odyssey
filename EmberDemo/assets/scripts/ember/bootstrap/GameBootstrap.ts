import { _decorator, Canvas, Component, game, ResolutionPolicy, UITransform, view } from 'cc';
import { validateContent } from '../content/validate';
import { InputController } from '../input/InputController';
import { LocalTransport } from '../platform/LocalTransport';
import { ArenaView } from '../render/ArenaView';
import { Hud } from '../render/Hud';
import { worldToScreen } from '../render/IsoProjection';
import { uiNode } from '../render/Primitives';
import type { GameCommand } from '../platform/protocol';
const { ccclass }=_decorator;
/** Attach to an editor-created Canvas with its default Camera. No serialized assets required. */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private port!:LocalTransport;private arena!:ArenaView;private hud!:Hud;private controls!:InputController;
  private fps=60;private frameTime=0;private frames=0;private disposeDebug?:()=>void;
  start():void {
    validateContent();
    if(!this.node.getComponent(Canvas))throw new Error('GameBootstrap must be attached to the editor-created Canvas.');
    view.setDesignResolutionSize(1280,720,ResolutionPolicy.SHOW_ALL);view.resizeWithBrowserSize(true);
    this.node.getComponent(UITransform)!.setContentSize(1280,720);
    const params=typeof location==='undefined'?new URLSearchParams():new URLSearchParams(location.search);
    const raw=params.get('seed'),seed=raw!==null&&Number.isFinite(Number(raw))?Number(raw)>>>0:1234;
    this.port=new LocalTransport(seed);const root=uiNode('Project Ember',this.node);
    this.arena=new ArenaView(root);this.hud=new Hud(root,c=>this.port.send(c));
    this.controls=new InputController(root,this.arena.camera,this.port,this.hud);
    game.canvas?.focus();
    // Explicit debug opt-in for browser automation. Normal games expose no mutable world.
    if(params.get('debug')==='1'&&typeof window!=='undefined'){
      const api={controls:()=>({mode:this.controls.controlMode}),snapshot:()=>this.port.snapshot(),send:(c:GameCommand)=>this.port.send(c),
        screen:(x:number,y:number)=>worldToScreen({x,y},this.arena.camera)};
      Object.assign(window,{__EMBER__:api});
      this.disposeDebug=()=>{delete (window as unknown as Record<string,unknown>).__EMBER__;};
    }
    this.draw(1);
  }
  update(dt:number):void {
    if(!this.port)return;this.frameTime+=dt;this.frames++;
    if(this.frameTime>=0.5){this.fps=this.frames/this.frameTime;this.frames=0;this.frameTime=0;}
    this.draw(this.port.world.advance(dt));
  }
  onDestroy():void {this.controls?.destroy();this.disposeDebug?.();}
  private draw(alpha:number):void {const s=this.port.snapshot();this.arena.configureMap(s.mapId);this.controls.update(s);this.arena.update(s,alpha,this.controls.pointer);this.hud.update(s,this.fps);}
}
