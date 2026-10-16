import { afterEach,it,expect,vi } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRelay } from '../../scripts/relay-server';
import { RoomTransport } from '../../EmberDemo/assets/scripts/ember/platform/RoomTransport';
const cleanups:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const f of cleanups.reverse())await f();cleanups.length=0;vi.unstubAllGlobals();});
async function until(check:()=>boolean){for(let i=0;i<300;i++){if(check())return;await new Promise(done=>setTimeout(done,10));}throw Error('Room condition timed out');}
it('runs two independent players through the real relay, then reconnects and recovers under a new host',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'ember-transport-'));cleanups.push(()=>rm(directory,{recursive:true,force:true}));
  const relay=await startRelay({port:0,directory});cleanups.push(()=>relay.close());const url=`ws://127.0.0.1:${relay.port}`;
  const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
  const host=new RoomTransport();storage.clear();const guest=new RoomTransport();cleanups.push(async()=>{host.destroy();guest.destroy();});
  host.connect('create',url,'host');await until(()=>!!host.ui.room&&host.ui.saved);const code=host.ui.code;
  guest.connect('join',url,'guest',code);await until(()=>host.ui.room?.members.length===2&&guest.snapshot().hero.id===guest.ui.playerId);
  await until(()=>host.ui.saved);host.begin();await until(()=>guest.snapshot().phase==='shop'&&!guest.snapshot().paused);
  guest.send({type:'BuyEquipment',equipmentId:'runeblade'});await until(()=>guest.snapshot().equipment.slot1==='runeblade'&&!guest.snapshot().paused);
  expect(host.snapshot().equipment.slot1).toBeUndefined();expect(guest.snapshot().gold).toBe(60);
  expect(guest.snapshot().equipmentPassives.map(p=>p.kind)).toEqual(['spellblade']);expect(host.snapshot().equipmentPassives).toEqual([]);
  host.send({type:'LeaveShop'});await until(()=>host.ui.saved);guest.send({type:'LeaveShop'});await until(()=>guest.snapshot().phase==='fighting'&&!guest.snapshot().paused);
  guest.send({type:'CastSlot',slot:'W',point:{x:guest.snapshot().hero.x,y:guest.snapshot().hero.y}});await until(()=>guest.snapshot().equipmentPassives.some(p=>p.armedFor>0));expect(host.snapshot().equipmentPassives).toEqual([]);
  const initialX=guest.snapshot().hero.x;guest.send({type:'DirectInput',movement:{x:1,y:0}});await until(()=>guest.snapshot().hero.x>initialX+.2);guest.send({type:'Stop'});
  const playerId=guest.ui.playerId;guest.leave();await until(()=>host.snapshot().network!.blocked);guest.connect('join',url,'guest',code);await until(()=>guest.ui.playerId===playerId&&!guest.snapshot().paused);expect(guest.snapshot().equipment.slot1).toBe('runeblade');
  host.leave();await until(()=>guest.snapshot().network!.blocked);guest.connect('recover',url,'guest',code);await until(()=>!!guest.ui.room&&guest.ui.saved);
  expect(guest.ui.room!.hostId).toBe(playerId);expect(guest.ui.code).not.toBe(code);guest.begin();await until(()=>!guest.snapshot().network!.blocked);
  expect(guest.snapshot().phase).toBe('fighting');expect(guest.snapshot().hero.x).toBe(initialX);expect(guest.snapshot().equipment.slot1).toBe('runeblade');
},15000);
