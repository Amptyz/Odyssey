import { MAPS } from '../content/maps';
import {DEFAULT_HERO_PALETTE,isHeroPaletteId,type HeroPaletteId} from '../content/hero-palettes';
import { GameWorld } from '../simulation/GameWorld';
import type { CommandPort, GameCommand } from './protocol';
import { captureDeveloperConfig,cloneDeveloperConfig,parseDeveloperConfig,type DeveloperConfig } from '../simulation/DeveloperConfig';
import {browserRunStorage,parseSoloRun,soloRunLabel,SOLO_SAVE_KEY,type RunStorage,type StoredSoloRun,type LocalSaveSnapshot} from './RunSaveStorage';
/** Future networking boundary: commands in, detached snapshots out. */
export class LocalTransport implements CommandPort {
  world:GameWorld;
  private presentedWorld?:GameWorld;private presentationVersion=0;
  /** Local view identity only; not a simulation field or a checkpoint/protocol version. */
  get presentationGeneration():number {
    if(this.presentedWorld!==this.world){this.presentedWorld=this.world;this.presentationVersion++;}
    return this.presentationVersion;
  }
  private developer?:{open:boolean;draft:DeveloperConfig;applied?:DeveloperConfig;revision:number;notice:string};
  private saved?:StoredSoloRun;private saveNotice='';private saveRevision=0;
  private savedWorld?:GameWorld;private savedBoundary=-1;
  private runSeed:number;
  private preferredPalette:HeroPaletteId=DEFAULT_HERO_PALETTE;
  get paletteId():HeroPaletteId{return this.world.players.get('hero')!.paletteId;}
  get seed():number{return this.runSeed;}
  constructor(seed=1234,private readonly storage:RunStorage|undefined=browserRunStorage()) {
    this.runSeed=seed;this.world=new GameWorld(seed);
    try{const id=this.storage?.getItem('ember.hero.palette');if(isHeroPaletteId(id))this.preferredPalette=id;}catch{/* Optional preference. */}
    this.world.command({type:'SetHeroPalette',paletteId:this.preferredPalette});
    try{const raw=this.storage?.getItem(SOLO_SAVE_KEY);if(raw)this.saved=parseSoloRun(raw);}
    catch{this.saveNotice='单人存档不可读取，可导入备份文件或开始新游戏。';}
  }
  runNotice(message:string):void {this.saveNotice=message;this.saveRevision++;}
  private canLoad():boolean {return !this.developer?.applied&&!this.developer?.open&&(this.world.paused||['ready','defeat','victory'].includes(this.world.phase));}
  private persistRun(manual=false):void {
    if(this.developer?.applied||this.developer?.open||this.world.phase==='ready'||this.world.players.size!==1){if(manual)this.runNotice('请在普通单人试炼中保存进度。');return;}
    if(!manual&&this.savedWorld===this.world&&this.savedBoundary===this.world.checkpointRevision)return;
    if(manual)this.world.saveProgress();
    this.savedWorld=this.world;this.savedBoundary=this.world.checkpointRevision;
    try{
      const checkpoint=this.world.savedRun;if(!checkpoint)throw Error('暂无可保存的进度。');
      const saved=parseSoloRun({format:'ember-solo-save',version:1,savedAt:Date.now(),checkpoint});
      if(!this.storage)throw Error('当前环境不支持本地存储。');
      this.storage.setItem(SOLO_SAVE_KEY,JSON.stringify(saved));this.saved=saved;
      this.runNotice(`${manual?'已保存':'已自动保存'}：${soloRunLabel(saved.checkpoint)}`);
    }catch{this.runNotice('保存失败：浏览器本地存储不可用，请导出存档文件备份。');}
  }
  private loadRun(data?:unknown):void {
    if(!this.canLoad()){this.runNotice('请先暂停单人游戏，再读取存档。');return;}
    try{
      const raw=data!==undefined?data:this.storage?.getItem(SOLO_SAVE_KEY);if(!raw)throw Error('暂无可读取的单人存档。');
      const saved=parseSoloRun(raw),world=GameWorld.resume(saved.checkpoint);
      // Validate and reconstruct first: malformed files cannot modify the live world or previous save.
      if(saved.checkpoint.phase==='fighting')world.paused=true;
      this.world=world;this.runSeed=world.seed;this.developer=undefined;this.savedWorld=world;this.savedBoundary=world.checkpointRevision;
      this.rememberPalette(this.paletteId);
      if(data!==undefined){
        try{if(!this.storage)throw Error('unavailable');this.storage.setItem(SOLO_SAVE_KEY,JSON.stringify(saved));this.saved=saved;}
        catch{this.runNotice('文件已读取；浏览器本地保存失败，请保留原存档文件。');return;}
      }else this.saved=saved;
      this.runNotice(`已读取：${soloRunLabel(saved.checkpoint)}${world.paused?' · 按 Esc 继续':''}`);
    }catch(error){this.runNotice(`读取失败：${error instanceof Error?error.message:'存档内容无效。'}`);}
  }
  exportRun():string {
    if(this.developer?.applied||this.developer?.open)throw Error('测试模式请使用开发者预设导出。');
    this.world.saveProgress();
    const checkpoint=this.world.savedRun??this.saved?.checkpoint;if(!checkpoint)throw Error('暂无可导出的单人存档。');
    const saved=parseSoloRun({format:'ember-solo-save',version:1,savedAt:Date.now(),checkpoint});
    return JSON.stringify(saved,null,2);
  }
  send(command:GameCommand):void {
    if(command.type==='SetHeroPalette'){
      if(!isHeroPaletteId(command.paletteId))return;
      this.world.command(command);this.rememberPalette(command.paletteId);this.persistRun();return;
    }
    if(command.type==='SaveRun'){this.persistRun(true);return;}
    if(command.type==='LoadRun'){this.loadRun(command.data);return;}
    if(command.type==='DevOpen'){
      if(!this.developer)this.developer={open:true,draft:captureDeveloperConfig(this.world.snapshot()),revision:0,notice:''};
      this.developer.open=true;this.world.command({type:'Stop'});return;
    }
    if(command.type==='DevExit'){if(this.developer){this.world=this.freshWorld(this.world.mapId);this.developer=undefined;}return;}
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
    if(command.type==='SelectMap'&&this.world.phase==='ready'&&Object.prototype.hasOwnProperty.call(MAPS,command.mapId)){this.world=this.freshWorld(command.mapId);return;}
    if(command.type==='Restart') {this.world=this.freshWorld(this.world.mapId);return;}
    this.world.command(command);
    this.persistRun();
  }
  private startDeveloper(config:DeveloperConfig):void {
    const c=parseDeveloperConfig(config),world=new GameWorld(c.seed,c.mapId,c.options);world.startDeveloper(c);
    world.command({type:'SetHeroPalette',paletteId:this.preferredPalette});
    this.world=world;this.developer={open:false,draft:cloneDeveloperConfig(c),applied:cloneDeveloperConfig(c),revision:(this.developer?.revision??0)+1,notice:''};
  }
  private rememberPalette(id:HeroPaletteId):void {
    this.preferredPalette=id;try{this.storage?.setItem('ember.hero.palette',id);}catch{/* Cosmetic selection remains usable. */}
  }
  private freshWorld(mapId:GameWorld['mapId']):GameWorld {
    const world=new GameWorld(this.seed,mapId);world.command({type:'SetHeroPalette',paletteId:this.preferredPalette});return world;
  }
  advance(dt:number):number {if(this.developer?.open)return 1;const alpha=this.world.advance(dt);this.persistRun();return alpha;}
  snapshot() {
    const s=this.world.snapshot(),dev=this.developer;
    const localSave:LocalSaveSnapshot={available:!!this.saved,label:this.saved?soloRunLabel(this.saved.checkpoint):'暂无单人存档',savedAt:this.saved?.savedAt,notice:this.saveNotice,revision:this.saveRevision,hasCheckpoint:!dev?.applied&&this.world.checkpointRevision>0};
    return{...s,paused:s.paused||!!dev?.open,localSave,developer:dev?{enabled:!!dev.applied,open:dev.open,draft:cloneDeveloperConfig(dev.draft),revision:dev.revision,notice:dev.notice}:undefined};
  }
}
