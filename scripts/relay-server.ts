import http from 'node:http';
import { randomBytes,createHash } from 'node:crypto';
import { mkdir,open,rename,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocketServer,WebSocket } from 'ws';
import { MAX_PLAYERS,ROOM_VERSION,validRoomCommand,type RoomClientMessage,type RoomServerMessage,type RoomInfo,type RoomMember } from '../EmberDemo/assets/scripts/ember/platform/room-protocol';
import { parseRunCheckpoint,type RunCheckpoint } from '../EmberDemo/assets/scripts/ember/simulation/RunCheckpoint';

interface Member extends RoomMember {identityHash:string;socket?:WebSocket;lastSeen:number;lastSeq:number}
interface Room {code:string;hostId:string;members:Member[];started:boolean;revision:number;checkpoint?:RunCheckpoint;hostAvailable:boolean;saveChain:Promise<void>;updatedAt:number}
interface StoredRoom {version:string;code:string;hostId:string;members:Pick<Member,'id'|'name'|'identityHash'>[];started:boolean;revision:number;checkpoint?:RunCheckpoint;updatedAt:number}
export interface RelayOptions {port?:number;host?:string;directory?:string;heartbeatMs?:number;timeoutMs?:number;maxRooms?:number;origins?:string[]}
/** Routes inputs/state and persists boundaries; it never runs GameWorld or combat. */
export async function startRelay(options:RelayOptions={}) {
  const directory=resolve(options.directory??'.ember-relay');await mkdir(directory,{recursive:true,mode:0o700});
  const rooms=new Map<string,Room>(),bindings=new Map<WebSocket,{room:Room;member:Member}>();
  const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json'}).end(JSON.stringify({ok:req.url==='/health',version:ROOM_VERSION}));});
  const wss=new WebSocketServer({server,maxPayload:1024*1024,perMessageDeflate:false,verifyClient:(info:{origin:string})=>!options.origins?.length||!!info.origin&&options.origins.includes(info.origin)});
  const send=(socket:WebSocket|undefined,message:RoomServerMessage)=>{if(socket?.readyState===WebSocket.OPEN){if(socket.bufferedAmount>2*1024*1024){socket.close(1013,'Slow connection');return;}socket.send(JSON.stringify(message));}};
  const info=(r:Room):RoomInfo=>({code:r.code,hostId:r.hostId,members:r.members.map(({id,name,connected,active})=>({id,name,connected,active})),started:r.started,revision:r.revision,hasSave:!!r.checkpoint,hostAvailable:r.hostAvailable});
  const broadcast=(r:Room,message:RoomServerMessage)=>r.members.forEach(m=>send(m.socket,message));
  const announce=(r:Room)=>broadcast(r,{type:'room',room:info(r)});
  async function persist(r:Room,checkpoint=r.checkpoint,revision=r.revision):Promise<void>{
    const data:StoredRoom={version:ROOM_VERSION,code:r.code,hostId:r.hostId,members:r.members.map(({id,name,identityHash})=>({id,name,identityHash})),started:r.started,revision,checkpoint,updatedAt:Date.now()};
    const file=resolve(directory,r.code+'.json'),temp=file+'.tmp';
    const handle=await open(temp,'w',0o600);try{await handle.writeFile(JSON.stringify(data));await handle.sync();}finally{await handle.close();}
    await rename(temp,file);const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}r.updatedAt=data.updatedAt;
  }
  async function load(code:unknown):Promise<Room>{
    if(typeof code!=='string'||!/^([A-Z2-9]){6}$/.test(code))throw Error('请输入 6 位房间码');
    const current=rooms.get(code);if(current)return current;
    let data:StoredRoom;try{data=JSON.parse(await readFile(resolve(directory,code+'.json'),'utf8')) as StoredRoom;}catch{throw Error('房间不存在或没有可恢复的进度');}
    if(data.version!==ROOM_VERSION)throw Error('房间版本不同，请使用相同版本');
    const r:Room={...data,checkpoint:data.checkpoint?parseRunCheckpoint(data.checkpoint):undefined,members:data.members.map(m=>({...m,connected:false,active:true,lastSeen:0,lastSeq:0})),hostAvailable:false,saveChain:Promise.resolve()};rooms.set(code,r);return r;
  }
  function newCode():string {const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(randomBytes(6),n=>chars[n%chars.length]).join('');}
  function unbind(socket:WebSocket):void {const b=bindings.get(socket);bindings.delete(socket);if(!b||b.member.socket!==socket)return;b.member.socket=undefined;b.member.connected=false;if(b.member.id===b.room.hostId)b.room.hostAvailable=false;announce(b.room);}
  async function receive(socket:WebSocket,value:unknown):Promise<void>{
    const msg=value as RoomClientMessage;if(!msg||typeof msg!=='object')throw Error('消息无效');
    if(msg.type==='hello'){
      if(bindings.has(socket))throw Error('已加入房间');
      if(msg.version!==ROOM_VERSION)throw Error('游戏版本不同，请刷新到同一版本');
      if(typeof msg.identity!=='string'||!/^([a-f0-9]){48}$/.test(msg.identity))throw Error('玩家身份无效');
      const identityHash=createHash('sha256').update(msg.identity).digest('hex'),name=typeof msg.name==='string'?msg.name.trim().slice(0,16)||'旅人':'旅人';
      let r:Room;
      if(msg.action==='create'||msg.action==='recover'){
        if(rooms.size>=(options.maxRooms??100))throw Error('房间数量已满，请稍后再试');
        let old:Room|undefined;
        if(msg.action==='recover'){old=await load(msg.code);if(!old.members.some(m=>m.identityHash===identityHash))throw Error('只有原房间成员可以恢复进度');if(!old.checkpoint)throw Error('尚无已保存的进度');}
        let code=newCode();for(let i=0;i<10;i++){try{await readFile(resolve(directory,code+'.json'));code=newCode();}catch{break;}}
        if(rooms.has(code))throw Error('房间码冲突，请重试');
        const ownId=old?.members.find(m=>m.identityHash===identityHash)?.id??'hero';
        const checkpoint=old?.checkpoint??(msg.checkpoint?parseRunCheckpoint(msg.checkpoint):undefined);
        if(!old&&checkpoint&&checkpoint.players.length>1)throw Error('多人进度请使用原房间码恢复');
        r={code,hostId:ownId,members:old?old.members.map(m=>({...m,socket:undefined,connected:false,active:false,lastSeen:0,lastSeq:0})):[{id:'hero',identityHash,name,connected:false,active:true,lastSeen:0,lastSeq:0}],started:false,revision:0,checkpoint,hostAvailable:true,saveChain:Promise.resolve(),updatedAt:Date.now()};
        rooms.set(code,r);
      }else if(msg.action==='join'){r=await load(msg.code);}else throw Error('房间操作无效');
      let member=r.members.find(m=>m.identityHash===identityHash);
      if(!member){if(r.started||r.checkpoint&&r.checkpoint.phase!=='ready')throw Error('试炼已经开始，仅原成员可以重连');if(r.members.length>=MAX_PLAYERS)throw Error('房间已满');member={id:'p'+randomBytes(6).toString('hex'),identityHash,name,connected:false,active:true,lastSeen:0,lastSeq:0};r.members.push(member);}
      member.socket?.close(4001,'Identity reconnected');member.socket=socket;member.connected=true;member.active=true;member.lastSeen=Date.now();member.lastSeq=0;member.name=name;
      if(member.id===r.hostId)r.hostAvailable=true;bindings.set(socket,{room:r,member});
      r.saveChain=r.saveChain.then(()=>persist(r));await r.saveChain;
      send(socket,{type:'welcome',playerId:member.id,room:info(r),checkpoint:r.checkpoint});announce(r);
      return;
    }
    const binding=bindings.get(socket);if(!binding)throw Error('请先加入房间');const {room:r,member}=binding;member.lastSeen=Date.now();
    const host=r.members.find(m=>m.id===r.hostId)!;
    if(msg.type==='heartbeat'){if(member.id===r.hostId&&typeof msg.available==='boolean'&&r.hostAvailable!==msg.available){r.hostAvailable=msg.available;announce(r);}send(socket,{type:'pong'});return;}
    if(msg.type==='leave'){unbind(socket);socket.close();return;}
    if(msg.type==='command'){
      if(!r.started||!member.active||!host.connected||!r.hostAvailable||r.members.some(m=>m.active&&!m.connected))return;
      if(!Number.isSafeInteger(msg.seq)||msg.seq<=member.lastSeq||!validRoomCommand(msg.command))return;
      member.lastSeq=msg.seq;send(host.socket,{type:'command',playerId:member.id,seq:msg.seq,command:msg.command});return;
    }
    if(member.id!==r.hostId)throw Error('此操作需要房主');
    if(msg.type==='begin'){r.started=true;for(const m of r.members)m.active=m.connected;announce(r);send(socket,{type:'begin'});return;}
    if(msg.type==='skipOffline'){for(const m of r.members)if(!m.connected)m.active=false;announce(r);return;}
    if(msg.type==='frame'){
      if(!msg.base||!Array.isArray(msg.base.units)||msg.base.units.length>128||!msg.views||typeof msg.views!=='object')return;
      for(const m of r.members){const view=msg.views[m.id];if(m.id!==r.hostId&&view?.hero?.id===m.id)send(m.socket,{type:'frame',snapshot:{...msg.base,...view}});}return;
    }
    if(msg.type==='save'){
      if(!Number.isSafeInteger(msg.revision)||msg.revision<=r.revision)throw Error('存档序号无效');
      const checkpoint=parseRunCheckpoint(msg.checkpoint);if(checkpoint.players.some(p=>!r.members.some(m=>m.id===p.id)))throw Error('存档成员不匹配');
      const revision=msg.revision;
      r.saveChain=r.saveChain.then(async()=>{if(revision<=r.revision)return;await persist(r,checkpoint,revision);r.checkpoint=checkpoint;r.revision=revision;broadcast(r,{type:'saved',revision,checkpoint});announce(r);});
      await r.saveChain;
    }
  }
  wss.on('connection',socket=>{
    let chain=Promise.resolve(),count=0,windowAt=Date.now();
    socket.on('message',data=>{if(Date.now()-windowAt>1000){windowAt=Date.now();count=0;}if(++count>180){socket.close(1008,'Rate limit');return;}
      chain=chain.then(async()=>{try{await receive(socket,JSON.parse(data.toString()));}catch(error){send(socket,{type:'error',message:error instanceof Error?error.message:'请求失败'});}});
    });socket.on('close',()=>unbind(socket));socket.on('error',()=>unbind(socket));
  });
  const heartbeat=setInterval(()=>{const now=Date.now();for(const [socket,b] of bindings)if(now-b.member.lastSeen>(options.timeoutMs??8000)){unbind(socket);socket.terminate();}
    for(const [code,r] of rooms)if(!r.members.some(m=>m.connected)&&now-r.updatedAt>3600000)rooms.delete(code);
  },options.heartbeatMs??1000);heartbeat.unref();
  await new Promise<void>((done,fail)=>{server.once('error',fail);server.listen(options.port??8787,options.host??'127.0.0.1',done);});
  const address=server.address();const port=typeof address==='object'&&address?address.port:0;
  return {port,close:async()=>{clearInterval(heartbeat);for(const socket of wss.clients)socket.terminate();await Promise.allSettled(Array.from(rooms.values(),r=>r.saveChain));await new Promise<void>(done=>wss.close(()=>server.close(()=>done())));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const relay=await startRelay({port:Number(process.env.RELAY_PORT??8787),host:process.env.RELAY_HOST??'127.0.0.1',directory:process.env.RELAY_DATA_DIR,origins:process.env.RELAY_ORIGINS?.split(',')});
  console.log(`Ember room relay listening on port ${relay.port}`);
  const stop=()=>{void relay.close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
