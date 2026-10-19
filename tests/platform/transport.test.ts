import { afterEach,it,expect,vi } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRelay } from '../../scripts/relay-server';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
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
  await until(()=>host.ui.saved);host.begin();await until(()=>guest.snapshot().phase==='camp'&&!guest.snapshot().paused);
  const authority=(host as unknown as {world:GameWorld}).world;
  const place=(id:string,at:{x:number;y:number})=>{authority.stopPlayer(id);Object.assign(authority.players.get(id)!.hero,{x:at.x,y:at.y,previous:{x:at.x,y:at.y}});};
  const initial=authority.snapshot().scene.interactions.find(n=>n.kind==='ember')!;
  place(host.ui.playerId!,initial);host.send({type:'Interact'});await until(()=>host.snapshot().phase==='reward'&&!host.snapshot().paused);
  expect(guest.snapshot().phase).toBe('camp');
  place(guest.ui.playerId!,initial);guest.send({type:'Interact'});await until(()=>guest.snapshot().phase==='reward'&&!guest.snapshot().paused);
  for(const port of [host,guest]){port.send({type:'ChooseReward',choiceId:port.snapshot().choices.find(c=>c.kind==='perk'&&c.perkId!=='missileAttack')!.id});await until(()=>port.snapshot().phase==='camp'&&!port.snapshot().paused);}
  // Fixture grants a known form; normal input, personal overlays, saves and recovery use the relay.
  authority.combat.addPerk('missileAttack',guest.ui.playerId);
  const depart=async()=>{const node=authority.snapshot().scene.interactions.find(n=>n.kind==='departure')!;for(const p of authority.players.values())place(p.id,node);const before=authority.phase;host.send({type:'Interact'});await until(()=>authority.phase!==before&&host.ui.saved&&!guest.snapshot().paused);};
  const gate=authority.snapshot().scene.interactions.find(n=>n.kind==='departure')!;place(host.ui.playerId!,gate);host.send({type:'Interact'});await new Promise(r=>setTimeout(r,120));expect(authority.wave).toBe(0);
  place(guest.ui.playerId!,gate);guest.send({type:'Interact'});await new Promise(r=>setTimeout(r,120));expect(authority.wave).toBe(0);
  await depart();
  // Kill fixture encounters to reach a real configured rest; purchases still require F at merchant.
  for(let level=1;level<=2;level++){
    for(const a of authority.actors.values())if(a.team==='enemy')authority.combat.damage({sourceId:'hero',targetId:a.id,amount:1e6,cause:'basic',damageType:'true'});
    await until(()=>authority.phase==='cleared'&&host.ui.saved&&!guest.snapshot().paused);await depart();
  }
  expect(authority.phase).toBe('camp');const merchant=authority.snapshot().scene.interactions.find(n=>n.kind==='merchant')!;
  place(guest.ui.playerId!,merchant);guest.send({type:'Interact'});await until(()=>guest.snapshot().phase==='shop'&&!guest.snapshot().paused);
  expect(host.snapshot().phase).toBe('camp');const gold=guest.snapshot().gold;
  guest.send({type:'BuyEquipment',equipmentId:'runeblade'});await until(()=>guest.snapshot().equipment.slot1==='runeblade'&&!guest.snapshot().paused);
  expect(host.snapshot().equipment.slot1).toBeUndefined();expect(guest.snapshot().gold).toBe(gold-100);
  expect(guest.snapshot().equipmentPassives.map(p=>p.kind)).toEqual(['spellblade']);expect(host.snapshot().equipmentPassives).toEqual([]);
  guest.send({type:'LeaveShop'});await until(()=>guest.snapshot().phase==='camp'&&!guest.snapshot().paused);await depart();
  expect(guest.snapshot().basicAttack).toBe('missile');expect(host.snapshot().basicAttack).toBe('slash');expect(guest.snapshot().stats.attackRange).toBe(15);
  guest.send({type:'CastSlot',slot:'W',point:{x:guest.snapshot().hero.x,y:guest.snapshot().hero.y}});await until(()=>guest.snapshot().equipmentPassives.some(p=>p.armedFor>0));expect(host.snapshot().equipmentPassives).toEqual([]);
  const initialX=guest.snapshot().hero.x;guest.send({type:'DirectInput',movement:{x:1,y:0}});await until(()=>guest.snapshot().hero.x>initialX+.2);guest.send({type:'Stop'});
  const playerId=guest.ui.playerId;guest.leave();await until(()=>host.snapshot().network!.blocked);guest.connect('join',url,'guest',code);await until(()=>guest.ui.playerId===playerId&&!guest.snapshot().paused);expect(guest.snapshot().equipment.slot1).toBe('runeblade');expect(guest.snapshot().basicAttack).toBe('missile');
  host.leave();await until(()=>guest.snapshot().network!.blocked);guest.connect('recover',url,'guest',code);await until(()=>!!guest.ui.room&&guest.ui.saved);
  expect(guest.ui.room!.hostId).toBe(playerId);expect(guest.ui.code).not.toBe(code);guest.begin();await until(()=>!guest.snapshot().network!.blocked);
  expect(guest.snapshot().phase).toBe('fighting');expect(guest.snapshot().hero.x).toBe(initialX);expect(guest.snapshot().basicAttack).toBe('missile');expect(guest.snapshot().stats.attackRange).toBe(15);expect(guest.snapshot().equipment.slot1).toBe('runeblade');
},25000);
