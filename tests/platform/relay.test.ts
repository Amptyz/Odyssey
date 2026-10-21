import {openMerchantFixture} from '../helpers/scenes';
import { afterEach,describe,it,expect } from 'vitest';
import { WebSocket } from 'ws';
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRelay } from '../../scripts/relay-server';
import { ROOM_VERSION,type RoomServerMessage,type RoomClientMessage,validRoomCommand } from '../../EmberDemo/assets/scripts/ember/platform/room-protocol';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {DEVELOPER_LOADOUT} from '../../EmberDemo/assets/scripts/ember/content/skills';
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const f of cleanup.reverse())await f();cleanup.length=0;});
async function fixture(){const directory=await mkdtemp(join(tmpdir(),'ember-relay-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));const relay=await startRelay({port:0,directory});cleanup.push(()=>relay.close());return{relay,directory};}
async function client(port:number){
  const socket=new WebSocket(`ws://127.0.0.1:${port}`),messages:RoomServerMessage[]=[];socket.on('message',data=>messages.push(JSON.parse(data.toString())));
  await new Promise<void>((done,fail)=>{socket.once('open',done);socket.once('error',fail);});cleanup.push(async()=>socket.terminate());
  return{socket,messages,send:(m:RoomClientMessage)=>socket.send(JSON.stringify(m)),wait:async<T extends RoomServerMessage['type']>(type:T)=>{for(let i=0;i<200;i++){const index=messages.findIndex(m=>m.type===type);if(index>=0)return messages.splice(index,1)[0] as Extract<RoomServerMessage,{type:T}>;await new Promise(done=>setTimeout(done,5));}throw Error(`No ${type}: ${JSON.stringify(messages)}`);}};
}
const hello=(action:'create'|'join'|'recover',identity:string,code?:string):RoomClientMessage=>({type:'hello',version:ROOM_VERSION,action,identity:identity.repeat(48),name:identity,code});
describe('room relay and persisted recovery',()=>{
  it('allows validated lobby palettes but not combat input, binds the sender and persists color for recovery',async()=>{
    const {relay}=await fixture(),host=await client(relay.port);host.send(hello('create','a'));const {room}=await host.wait('welcome');
    const guest=await client(relay.port);guest.send(hello('join','b',room.code));const joined=await guest.wait('welcome');
    guest.send({type:'command',seq:1,command:{type:'Attack',point:{x:1,y:2}}});
    guest.send({type:'command',seq:2,command:{type:'SetHeroPalette',paletteId:'wine',playerId:'hero'} as never});
    const received=await host.wait('command');expect(received.command.type).toBe('SetHeroPalette');expect(received.playerId).toBe(joined.playerId);
    const w=new GameWorld();w.addPlayer(joined.playerId);w.saveLobby();w.command(received.command,received.playerId);
    host.send({type:'save',revision:1,checkpoint:w.savedRun!});const saved=await guest.wait('saved');
    expect(saved.checkpoint.players.find(p=>p.id===joined.playerId)?.paletteId).toBe('wine');
    const recovery=await client(relay.port);recovery.send(hello('recover','b',room.code));const restored=await recovery.wait('welcome');
    expect(restored.checkpoint?.players.find(p=>p.id===joined.playerId)?.paletteId).toBe('wine');
    expect(restored.checkpoint?.players.find(p=>p.id==='hero')?.paletteId).toBe('ash');
  });
  it('routes validated inputs to the host with stable identity and rejects duplicate input sequence numbers',async()=>{
    const {relay}=await fixture(),host=await client(relay.port);host.send(hello('create','a'));const created=await host.wait('welcome');
    const guest=await client(relay.port);guest.send(hello('join','b',created.room.code));const joined=await guest.wait('welcome');expect(joined.playerId).not.toBe('hero');
    host.send({type:'begin'});await host.wait('begin');guest.send({type:'command',seq:1,command:{type:'Attack',point:{x:1,y:2}}});const received=await host.wait('command');expect(received.playerId).toBe(joined.playerId);
    guest.send({type:'command',seq:1,command:{type:'Attack',point:{x:1,y:2}}});guest.send({type:'command',seq:2,command:{type:'DevAction',action:'recover'}});guest.send({type:'heartbeat'});await guest.wait('pong');expect(host.messages.filter(m=>m.type==='command')).toHaveLength(0);
    guest.socket.close();await new Promise(done=>setTimeout(done,20));const reconnect=await client(relay.port);reconnect.send(hello('join','b',created.room.code));expect((await reconnect.wait('welcome')).playerId).toBe(joined.playerId);
  });
  it.each(['ember-coop-6','ember-coop-7','ember-coop-8'])('acknowledges persisted checkpoints and recovers a stored %s room under the new protocol',async version=>{
    const {relay,directory}=await fixture(),host=await client(relay.port);host.send(hello('create','a'));const {room}=await host.wait('welcome');
    const guest=await client(relay.port);guest.send(hello('join','b',room.code));const member=await guest.wait('welcome');
    const w=new GameWorld();w.addPlayer(member.playerId);for(const p of w.players.values())p.loadout={...DEVELOPER_LOADOUT};openMerchantFixture(w);w.command({type:'BuyEquipment',equipmentId:'bow'},member.playerId);
    host.send({type:'save',revision:1,checkpoint:w.savedRun!});await host.wait('saved');const saved=await guest.wait('saved');expect(saved.checkpoint.players.find(p=>p.id===member.playerId)?.equipment.slot1).toBe('bow');
    await relay.close();const file=join(directory,room.code+'.json'),stored=JSON.parse(await readFile(file,'utf8'));stored.version=version;await writeFile(file,JSON.stringify(stored));
    const next=await startRelay({port:0,directory});cleanup.push(()=>next.close());
    const recovery=await client(next.port);recovery.send(hello('recover','b',room.code));const resumed=await recovery.wait('welcome');
    expect(resumed.room.code).not.toBe(room.code);expect(resumed.room.hostId).toBe(member.playerId);expect(resumed.checkpoint).toEqual(w.savedRun);
    const stranger=await client(next.port);stranger.send(hello('recover','c',room.code));expect((await stranger.wait('error')).message).toContain('原房间成员');
  });
  it('does not allow guests to replace checkpoints or start rooms',async()=>{
    const {relay}=await fixture(),host=await client(relay.port);host.send(hello('create','a'));const {room}=await host.wait('welcome');
    const guest=await client(relay.port);guest.send(hello('join','b',room.code));await guest.wait('welcome');guest.send({type:'begin'});expect((await guest.wait('error')).message).toContain('房主');
    guest.send({type:'save',revision:1,checkpoint:{} as never});expect((await guest.wait('error')).message).toContain('房主');
    expect(validRoomCommand({type:'DirectInput',movement:{x:NaN,y:0}})).toBe(false);expect(validRoomCommand({type:'CastSlot',slot:'__proto__',point:{x:0,y:0}})).toBe(false);
  });
  it('detects a silent connection timeout and allows the host to skip the offline member',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'ember-heartbeat-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
    const relay=await startRelay({port:0,directory,heartbeatMs:20,timeoutMs:150});cleanup.push(()=>relay.close());
    const host=await client(relay.port);host.send(hello('create','a'));const {room}=await host.wait('welcome');
    const alive=setInterval(()=>host.send({type:'heartbeat',available:true}),30);cleanup.push(async()=>clearInterval(alive));
    const guest=await client(relay.port);guest.send(hello('join','b',room.code));const member=await guest.wait('welcome');
    await new Promise(done=>setTimeout(done,250));const offline=host.messages.filter(m=>m.type==='room').at(-1)!;expect(offline.type==='room'&&offline.room.members.find(m=>m.id===member.playerId)?.connected).toBe(false);
    host.messages.length=0;host.send({type:'skipOffline'});const updated=await host.wait('room');expect(updated.room.members.find(m=>m.id===member.playerId)?.active).toBe(false);
  });
});
