import { _decorator, Canvas, Component, game, ResolutionPolicy, UITransform, view } from 'cc';
import { validateContent } from '../content/validate';
import { InputController } from '../input/InputController';
import { LocalTransport } from '../platform/LocalTransport';
import { ArenaView } from '../render/ArenaView';
import { Hud } from '../render/Hud';
import { worldToScreen } from '../render/IsoProjection';
import { ArtLibrary } from '../render/ArtLibrary';
import { text,uiNode } from '../render/Primitives';
import type { GameCommand } from '../platform/protocol';
const { ccclass }=_decorator;
/** Attach to an editor-created Canvas with its default Camera. No serialized assets required. */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private port!:LocalTransport;private arena!:ArenaView;private hud!:Hud;private controls!:InputController;
  private readonly art=new ArtLibrary();
  private fps=60;private frameTime=0;private frames=0;private disposeDebug?:()=>void;
  async start():Promise<void> {
    validateContent();
    if(!this.node.getComponent(Canvas))throw new Error('GameBootstrap must be attached to the editor-created Canvas.');
    view.setDesignResolutionSize(1280,720,ResolutionPolicy.SHOW_ALL);view.resizeWithBrowserSize(true);
    this.node.getComponent(UITransform)!.setContentSize(1280,720);
    const params=typeof location==='undefined'?new URLSearchParams():new URLSearchParams(location.search);
    const raw=params.get('seed'),seed=raw!==null&&Number.isFinite(Number(raw))?Number(raw)>>>0:1234;
    const root=uiNode('Project Ember',this.node);const loading=text('Loading art',root,'正在载入遗迹…',22);
    try{await this.art.load();}catch(error){loading.string='美术资源载入失败，请刷新重试';console.error(error);return;}
    if(!this.isValid){this.art.dispose();return;}loading.node.destroy();
    this.port=new LocalTransport(seed);
    this.arena=new ArenaView(root,this.art);this.hud=new Hud(root,c=>this.port.send(c),this.art);
    this.controls=new InputController(root,this.arena.camera,this.port,this.hud);
    game.canvas?.focus();
    // Explicit debug opt-in for browser automation. Normal games expose no mutable world.
    if(params.get('debug')==='1'&&typeof window!=='undefined'){
      const api={controls:()=>({mode:this.controls.controlMode}),art:()=>({loaded:this.art.loaded,...this.arena.debug()}),snapshot:()=>this.port.snapshot(),send:(c:GameCommand)=>this.port.send(c),
        screen:(x:number,y:number)=>worldToScreen({x,y},this.arena.camera)};
      Object.assign(window,{__EMBER__:api});
      this.disposeDebug=()=>{delete (window as unknown as Record<string,unknown>).__EMBER__;};
    }
    this.draw(1);
  }
  update(dt:number):void {
    if(!this.port)return;this.frameTime+=dt;this.frames++;
    if(this.frameTime>=0.5){this.fps=this.frames/this.frameTime;this.frames=0;this.frameTime=0;}
    this.draw(this.port.world.advance(dt),dt);
  }
  onDestroy():void {this.controls?.destroy();this.disposeDebug?.();this.art.dispose();}
  private draw(alpha:number,dt=0):void {const s=this.port.snapshot();this.arena.configureMap(s.mapId);this.controls.update(s);this.arena.update(s,alpha,this.controls.pointer,dt);this.hud.update(s,this.fps);}
}
