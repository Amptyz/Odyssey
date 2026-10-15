import { MAPS } from '../content/maps';
import { GameWorld } from '../simulation/GameWorld';
import type { CommandPort, GameCommand } from './protocol';
import { captureDeveloperConfig,cloneDeveloperConfig,parseDeveloperConfig,type DeveloperConfig } from '../simulation/DeveloperConfig';
/** Future networking boundary: commands in, detached snapshots out. */
export class LocalTransport implements CommandPort {
  world:GameWorld;
  private developer?:{open:boolean;draft:DeveloperConfig;applied?:DeveloperConfig;revision:number;notice:string};
  constructor(readonly seed=1234) { this.world=new GameWorld(seed); }
  send(command:GameCommand):void {
    if(command.type==='DevOpen'){
      if(!this.developer)this.developer={open:true,draft:captureDeveloperConfig(this.world.snapshot()),revision:0,notice:''};
      this.developer.open=true;this.world.command({type:'Stop'});return;
    }
    if(command.type==='DevExit'){if(this.developer){this.world=new GameWorld(this.seed,this.world.mapId);this.developer=undefined;}return;}
    const dev=this.developer;
    if(command.type==='DevClose'){if(dev)dev.open=false;return;}
    if(command.type==='DevCapture'){if(dev?.open){dev.draft=captureDeveloperConfig(this.world.snapshot(),dev.applied?.options);dev.notice='已读取当前关卡与搭配。点击应用可重新测试。';dev.revision++;}return;}
    if(command.type==='DevConfigure'){
      if(!dev?.open)return;
      try{dev.draft=parseDeveloperConfig(command.config);dev.notice='配置待应用：点击「应用并进入」重新生成关卡。';}catch(e){dev.notice=e instanceof Error?e.message:'配置无效。';}
      dev.revision++;return;
    }
    if(command.type==='DevNotice'){if(dev?.open){dev.notice=command.message.slice(0,160);dev.revision++;}return;}
    if(command.type==='DevApply'){
      if(!dev?.open)return;this.startDeveloper(dev.draft);return;
    }
    if(command.type==='DevRestart'||command.type==='Restart'&&dev?.applied){if(dev?.applied)this.startDeveloper(dev.applied);return;}
    if(command.type==='DevAction'||command.type==='DevSpawn'){
      if(!dev?.open||!dev.applied)return;this.world.command(command);dev.revision++;return;
    }
    // Modal edits cannot also cast, buy, consume a reward or start an ordinary run.
    if(dev?.open&&command.type!=='Stop')return;
    if(command.type==='SelectMap'&&this.world.phase==='ready'&&Object.prototype.hasOwnProperty.call(MAPS,command.mapId)){this.world=new GameWorld(this.seed,command.mapId);return;}
    if(command.type==='Restart') {this.world=new GameWorld(this.seed,this.world.mapId);return;}
    this.world.command(command);
  }
  private startDeveloper(config:DeveloperConfig):void {
    const c=parseDeveloperConfig(config),world=new GameWorld(c.seed,c.mapId,c.options);world.startDeveloper(c);
    this.world=world;this.developer={open:false,draft:cloneDeveloperConfig(c),applied:cloneDeveloperConfig(c),revision:(this.developer?.revision??0)+1,notice:''};
  }
  advance(dt:number):number {return this.developer?.open?1:this.world.advance(dt);}
  snapshot() {const s=this.world.snapshot(),dev=this.developer;return{...s,paused:s.paused||!!dev?.open,developer:dev?{enabled:!!dev.applied,open:dev.open,draft:cloneDeveloperConfig(dev.draft),revision:dev.revision,notice:dev.notice}:undefined};}
}
