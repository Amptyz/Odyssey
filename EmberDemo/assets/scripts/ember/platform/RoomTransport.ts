import { LocalTransport } from './LocalTransport';
import { GameWorld,type WorldSnapshot } from '../simulation/GameWorld';
import { detached,type RunCheckpoint } from '../simulation/RunCheckpoint';
import { ROOM_VERSION,validRoomCommand,type RoomInfo,type RoomClientMessage,type RoomServerMessage,type PlayerView } from './room-protocol';
import type { GameCommand,CommandPort } from './protocol';

export interface RoomControls {
  endpoint:string;name:string;code:string;status:string;room?:RoomInfo;playerId?:string;connected:boolean;saved:boolean;
}
/** Host-authoritative room transport. Only the host advances the shared GameWorld. */
export class RoomTransport implements CommandPort {
  readonly local:LocalTransport;
  get presentationKey():string{return this.ui.room?`room:${this.ui.room.code}`:`local:${this.local.presentationGeneration}`;}
  uiOpen=false;
  readonly ui:RoomControls={endpoint:'ws://127.0.0.1:8787',name:'旅人',code:'',status:'单人模式',connected:false,saved:false};
  private socket?:WebSocket;private world?:GameWorld;private remote?:WorldSnapshot;
  private timer?:ReturnType<typeof setInterval>;private reconnect?:ReturnType<typeof setTimeout>;
  private identity='';private request?:Extract<RoomClientMessage,{type:'hello'}>;private closed=false;
  private lastPump=0;private lastFrame=0;private lastHeartbeat=0;private lastReceived=0;private retry=0;
  private fault='';private readonly remoteInputAt=new Map<string,number>();
  private seq=0;private boundary=-1;private saveSeq=0;private pendingSave=0;private saved?:RunCheckpoint;
  private readonly lastInput=new Map<string,{json:string;time:number}>();
  private readonly queued:{playerId:string;command:GameCommand}[]=[];
  private menuOpen=false;
  private hostWasBlocked=true;private awaitingFrame=true;private remoteReceived=0;private previous?:WorldSnapshot;
  constructor(seed=1234) {
    this.local=new LocalTransport(seed);
    if(typeof crypto==='undefined'||!crypto.getRandomValues)return;
    try{
      this.identity=localStorage.getItem('ember.room.identity')??'';
      if(!/^[a-f0-9]{48}$/.test(this.identity)){this.identity=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('ember.room.identity',this.identity);}
      this.ui.endpoint=localStorage.getItem('ember.room.endpoint')??this.ui.endpoint;this.ui.name=localStorage.getItem('ember.room.name')??this.ui.name;this.ui.code=localStorage.getItem('ember.room.code')??'';
    }catch{this.identity=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');}
  }
  private get isHost():boolean{return !!this.ui.room&&this.ui.playerId===this.ui.room.hostId;}
  private get blocked():boolean {
    const r=this.ui.room;return !this.ui.connected||!r||!r.started||!r.hostAvailable||r.members.some(m=>m.active&&!m.connected)||!!this.pendingSave||!this.isHost&&this.awaitingFrame;
  }
  connect(action:'create'|'join'|'recover',endpoint:string,name:string,code=''):void {
    try{
      const url=new URL(endpoint);if(!['ws:','wss:'].includes(url.protocol))throw Error('中转地址必须使用 ws:// 或 wss://');
      if(typeof location!=='undefined'&&location.protocol==='https:'&&url.protocol!=='wss:')throw Error('HTTPS 页面需要 wss:// 中转地址');
      if(action!=='create'&&!/^[A-Z2-9]{6}$/.test(code.trim().toUpperCase()))throw Error('请输入 6 位房间码');
      this.leave();this.closed=false;this.fault='';this.saved=undefined;this.ui.saved=false;this.ui.endpoint=url.href;this.ui.name=name.slice(0,16)||'旅人';this.ui.code=code.trim().toUpperCase();
      const initial=new GameWorld(this.local.seed,this.local.snapshot().mapId);initial.command({type:'SetHeroPalette',paletteId:this.local.paletteId});initial.saveLobby();
      this.request={type:'hello',version:ROOM_VERSION,action,identity:this.identity,name:this.ui.name,code:this.ui.code,checkpoint:action==='create'?initial.savedRun:undefined};
      try{localStorage.setItem('ember.room.endpoint',url.href);localStorage.setItem('ember.room.name',this.ui.name);}catch{/* The connection still works without storage. */}
      this.open();this.lastPump=performance.now();this.timer=setInterval(()=>this.pump(),33);
    }catch(error){this.ui.status=error instanceof Error?error.message:'连接失败';}
  }
  private open():void {
    if(this.closed||!this.request)return;this.ui.status=this.retry?'正在重新连接…':'正在连接中转…';
    const socket=new WebSocket(this.ui.endpoint);this.socket=socket;
    socket.onopen=()=>{if(socket===this.socket)socket.send(JSON.stringify(this.request));};
    socket.onmessage=event=>{if(socket!==this.socket)return;try{this.receive(JSON.parse(String(event.data)) as RoomServerMessage);}catch{this.ui.status='网络数据无效，请更新游戏后重试';socket.close();}};
    socket.onerror=()=>{this.ui.status='无法连接中转，正在重试…';};
    socket.onclose=event=>{
      if(socket!==this.socket||this.closed)return;this.ui.connected=false;this.world?.stopAll();this.lastInput.clear();this.queued.length=0;
      if(event.code===4001){this.ui.status='此玩家已在另一个窗口连接';this.closed=true;return;}
      this.ui.status='连接中断，进度已保留，正在重连…';
      this.reconnect=setTimeout(()=>this.open(),Math.min(5000,500*2**Math.min(4,this.retry++)));
    };
  }
  private write(message:RoomClientMessage):boolean {
    if(this.socket?.readyState!==WebSocket.OPEN||this.socket.bufferedAmount>512*1024)return false;
    this.socket.send(JSON.stringify(message));return true;
  }
  private receive(message:RoomServerMessage):void {
    this.lastReceived=performance.now();
    if(message.type==='error'){this.fault=message.message;this.ui.status=message.message;return;}
    if(message.type==='welcome'){
      const preserve=this.world&&this.ui.room?.code===message.room.code&&this.isHost;
      this.fault='';this.awaitingFrame=true;this.ui.playerId=message.playerId;this.ui.room=message.room;this.ui.code=message.room.code;this.ui.connected=true;this.retry=0;this.seq=0;
      this.saveSeq=message.room.revision;this.pendingSave=0;this.boundary=-1;this.lastInput.clear();
      this.request={type:'hello',version:ROOM_VERSION,action:'join',identity:this.identity,name:this.ui.name,code:message.room.code};
      try{localStorage.setItem('ember.room.code',message.room.code);}catch{/* Optional local cache. */}
      if(this.isHost&&!preserve){this.world=message.checkpoint?GameWorld.resume(message.checkpoint):new GameWorld(this.local.seed);this.boundary=-1;}
      this.saved=message.checkpoint;this.syncMembers();this.ui.status=this.isHost?'房间已创建，等待队友':'已加入房间，等待房主';
      this.ui.saved=!!message.checkpoint;return;
    }
    if(message.type==='room'){
      this.ui.room=message.room;this.syncMembers();return;
    }
    if(message.type==='begin'&&this.isHost&&this.world){if(this.world.phase==='ready')this.world.command({type:'Start'},this.ui.playerId);this.flushSave();return;}
    if(message.type==='command'&&this.isHost){
      if(message.command.type==='SetHeroPalette'){if(validRoomCommand(message.command))this.world?.command(message.command,message.playerId);return;}
      this.remoteInputAt.set(message.playerId,performance.now());if(this.queued.length<128)this.queued.push({playerId:message.playerId,command:message.command});return;
    }
    if(message.type==='frame'&&!this.isHost){
      this.awaitingFrame=false;this.previous=this.remote;this.remote=message.snapshot;this.remoteReceived=performance.now();return;
    }
    if(message.type==='saved'){
      this.saved=message.checkpoint;this.ui.saved=true;
      if(message.revision===this.pendingSave)this.pendingSave=0;
      if(this.ui.room)this.ui.room.revision=message.revision;
      try{localStorage.setItem('ember.room.save',JSON.stringify({code:this.ui.code,checkpoint:message.checkpoint}));}catch{this.ui.status='服务器已保存；本地存储不可用';}
    }
  }
  private syncMembers():void {
    if(!this.isHost||!this.world||!this.ui.room)return;
    this.world.hostId=this.ui.room.hostId;
    let added=false;
    for(const member of this.ui.room.members){
      if(!this.world.players.has(member.id))added=this.world.addPlayer(member.id)||added;
      this.world.setPlayerActive(member.id,member.active);
      if(!member.connected)this.world.stopPlayer(member.id);
    }
    if(added)this.world.saveLobby();
  }
  begin():void {if(this.isHost&&!this.pendingSave)this.write({type:'begin'});}
  skipOffline():void {if(this.isHost)this.write({type:'skipOffline'});}
  get canSetPalette():boolean {return !this.request||!!(this.ui.connected&&this.ui.room?.hostAvailable);}
  send(command:GameCommand):void {
    if(!this.ui.room&&!this.request){this.local.send(command);return;}
    if(command.type==='SetHeroPalette'){
      if(!validRoomCommand(command)||!this.canSetPalette)return;
      if(this.isHost)this.world?.command(command,this.ui.playerId);
      else this.write({type:'command',seq:++this.seq,command});
      return;
    }
    if(command.type==='Restart'){this.leave();return;}
    if(command.type==='TogglePause'){this.menuOpen=!this.menuOpen;if(this.menuOpen)this.send({type:'Stop'});return;}
    if(this.uiOpen&&command.type!=='Stop')return;
    if(!validRoomCommand(command)||this.blocked)return;
    if(command.type==='AttackInput'||command.type==='DirectInput'){
      const json=JSON.stringify(command),now=performance.now(),last=this.lastInput.get(command.type);
      if(last&&(last.json===json&&now-last.time<500||now-last.time<33))return;
      this.lastInput.set(command.type,{json,time:now});
    }else if(command.type==='Stop')this.lastInput.clear();
    if(this.isHost)this.queued.push({playerId:this.ui.playerId!,command});
    else this.write({type:'command',seq:++this.seq,command});
  }
  private flushSave():void {
    if(!this.world||this.pendingSave||this.boundary===this.world.checkpointRevision)return;
    const checkpoint=this.world.savedRun;if(!checkpoint)return;
    const revision=++this.saveSeq;
    if(this.write({type:'save',revision,checkpoint})){this.pendingSave=revision;this.boundary=this.world.checkpointRevision;this.ui.saved=false;}
  }
  private pump():void {
    const now=performance.now(),elapsed=(now-this.lastPump)/1000;this.lastPump=now;
    if(this.ui.connected&&now-this.lastHeartbeat>=1000){this.lastHeartbeat=now;this.write({type:'heartbeat',available:typeof document==='undefined'||!document.hidden});}
    if(this.ui.connected&&now-this.lastReceived>12000){this.socket?.close();return;}
    if(!this.isHost||!this.world)return;
    const blocked=this.blocked||typeof document!=='undefined'&&document.hidden||elapsed>.5;
    if(blocked){if(!this.hostWasBlocked)this.world.stopAll();if(!this.pendingSave)this.queued.length=0;}else{
      while(this.queued.length){const item=this.queued.shift()!;this.world.command(item.command,item.playerId);if(this.boundary!==this.world.checkpointRevision)break;}
      // Never advance combat beyond a boundary that is waiting for durable acknowledgement.
      if(this.boundary===this.world.checkpointRevision)this.world.advance(Math.min(elapsed,.1));
    }
    for(const [id,at] of this.remoteInputAt)if(now-at>750)this.world.stopPlayer(id);
    this.hostWasBlocked=blocked;this.flushSave();
    if(now-this.lastFrame>=100&&this.ui.connected){
      this.lastFrame=now;const base=this.world.snapshot(this.ui.playerId),views:Record<string,PlayerView>={};
      for(const member of this.ui.room!.members){
        if(!this.world.players.has(member.id))continue;const s=this.world.snapshot(member.id);
        const {phase,scene,hero,loadout,cooldowns,perks,choices,pendingSkill,gold,inventory,equipment,stats,destination,primed,equipmentPassives,basicAttack}=s;
        views[member.id]={phase,scene,hero,loadout,cooldowns,perks,choices,pendingSkill,gold,inventory,equipment,stats,destination,primed,equipmentPassives,basicAttack};
      }
      // Navigation paths are simulation internals, not required by remote renderers.
      for(const u of base.units)u.path=[];
      this.write({type:'frame',base:{...base,paused:base.paused||blocked||!!this.pendingSave},views});
    }
  }
  advance(dt:number):number {return this.request||this.uiOpen?1:this.local.advance(dt);}
  snapshot():WorldSnapshot {
    if(!this.request){const s=this.local.snapshot();return{...s,paused:s.paused||this.uiOpen};}
    let s=this.isHost&&this.world?this.world.snapshot(this.ui.playerId):this.remote?detached(this.remote):this.local.snapshot();
    // One snapshot interval of interpolation keeps other players/monsters smooth.
    if(!this.isHost&&this.previous&&this.remote&&this.previous.wave===s.wave&&this.previous.scene.id===s.scene.id){
      const alpha=Math.min(1,(performance.now()-this.remoteReceived)/100);
      for(const unit of s.units){const before=this.previous.units.find(u=>u.id===unit.id);if(before){unit.x=before.x+(unit.x-before.x)*alpha;unit.y=before.y+(unit.y-before.y)*alpha;unit.previous={x:unit.x,y:unit.y};}}
      s.hero=s.units.find(u=>u.id===this.ui.playerId)??s.hero;
    }
    const r=this.ui.room;const blocked=this.blocked||!this.isHost&&performance.now()-this.remoteReceived>1500;
    s={...s,paused:s.paused||blocked||this.menuOpen||this.uiOpen,network:{code:this.ui.code,playerId:this.ui.playerId??'',hostId:r?.hostId??'',blocked,status:this.statusText(),revision:r?.revision??0}};
    return s;
  }
  statusText():string {
    if(this.fault)return this.fault;
    const r=this.ui.room;if(!this.ui.connected||!r)return this.ui.status;
    if(!r.hostAvailable||!r.members.find(m=>m.id===r.hostId)?.connected)return '房主暂时离线，等待重连；可从已保存进度重新开房';
    if(this.awaitingFrame&&!this.isHost)return '正在同步房间状态…';
    if(!r.started)return '等待房主开始 / 继续';
    if(r.members.some(m=>m.active&&!m.connected))return '队友断线，战斗暂停；房主可继续等待或跳过离线玩家';
    if(this.pendingSave)return '正在保存进度…';
    return `联机中 · ${this.ui.saved?'进度已保存':'等待保存'} · ${r.members.filter(m=>m.connected).length} 人`;
  }
  get savedLabel():string {const s=this.saved;if(!s)return '尚无已保存进度';return s.phase==='fighting'?`已保存：第 ${s.wave} 波起点`:s.phase==='cleared'?`已保存：第 ${s.wave} 关清场`:s.phase==='camp'?`已保存：${s.wave===0?'启程营地':`第 ${s.wave} 关后休息点`}`:s.phase==='victory'?'已保存：试炼通关':'已保存：队伍准备';}
  exportSave():string {if(!this.saved)throw Error('尚无已保存的进度');return JSON.stringify({room:this.ui.code,version:ROOM_VERSION,checkpoint:this.saved},null,2);}
  leave():void {
    this.closed=true;if(this.reconnect)clearTimeout(this.reconnect);if(this.timer)clearInterval(this.timer);
    this.socket?.close();this.socket=undefined;this.request=undefined;this.world=undefined;this.remote=undefined;this.previous=undefined;
    this.ui.room=undefined;this.ui.playerId=undefined;this.menuOpen=false;this.ui.connected=false;this.ui.status='单人模式';this.pendingSave=0;this.queued.length=0;this.lastInput.clear();
  }
  destroy():void {this.leave();}
}
