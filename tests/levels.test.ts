import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {FIXED_DT} from '../EmberDemo/assets/scripts/ember/content/config';
import {describe,it,expect} from 'vitest';
import {MAPS,mapDefinition} from '../EmberDemo/assets/scripts/ember/content/maps';
import {enemy} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {Pathfinder} from '../EmberDemo/assets/scripts/ember/ai/Pathfinder';
import {enemyPlacements,exitProgress,levelDefinition,levelSnapshot,levelSpawn} from '../EmberDemo/assets/scripts/ember/simulation/LevelSystem';
import {DEFAULT_PROJECTION,followProjection,screenToWorld,visibleWorldBounds,worldToScreen} from '../EmberDemo/assets/scripts/ember/render/IsoProjection';
import {distance} from '../EmberDemo/assets/scripts/ember/utils/math';

describe('five-level exploration maps',()=>{
 for(const mapId of Object.keys(MAPS) as (keyof typeof MAPS)[])it(`${mapId}: five traversable routes, safe deterministic groups and spacious final Boss room`,()=>{
  const map=mapDefinition(mapId),nav=new Pathfinder(map);expect(map.waves).toHaveLength(5);expect(map.width).toBeGreaterThan(40);expect(map.height).toBeGreaterThan(30);const signatures=new Set<string>();
  for(let wave=1;wave<=5;wave++){
   const level=levelDefinition(map,wave);signatures.add(JSON.stringify(level.route));expect(distance(level.start,level.exit)).toBeGreaterThan(20);
   for(let player=0;player<4;player++)expect(nav.walkable(levelSpawn(map,wave,player),.32)).toBe(true);
   let from=level.start;for(const waypoint of level.route.slice(1)){expect(nav.walkable(waypoint)).toBe(true);const path=nav.find(from,waypoint);expect(path.length).toBeGreaterThan(0);expect(path.at(-1)).toEqual(waypoint);from=waypoint;}
   const placements=enemyPlacements(map,wave);expect(placements).toEqual(enemyPlacements(map,wave));expect(placements.length).toBe(map.waves[wave-1]!.spawns.reduce((n,s)=>n+s.count,0));
   for(const p of placements){const radius=enemy(p.enemyId).radius;expect(nav.walkable(p.at,radius)).toBe(true);expect(distance(p.at,level.start)).toBeGreaterThan(6);}
   if(wave===5){expect(placements).toHaveLength(1);expect(placements[0]!.enemyId).toBe(mapId==='ember'?'courtyardHeart':'mirrorRegent');const boss=placements[0]!.at;for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)expect(nav.walkable({x:boss.x+Math.cos(angle)*4.5,y:boss.y+Math.sin(angle)*4.5},.32)).toBe(true);}
  }
  expect(signatures.size).toBe(5);
 });
 it('requires a clear level and every surviving participating player at the exit',()=>{
  const map=mapDefinition('ember'),exit=levelDefinition(map,1).exit,players=[{id:'hero',active:true,alive:true,...exit},{id:'p2',active:true,alive:true,x:exit.x-5,y:exit.y},{id:'offline',active:false,alive:true,x:0,y:0},{id:'dead',active:true,alive:false,x:0,y:0}];
  expect(exitProgress(map,1,players,1).active).toBe(false);expect(exitProgress(map,1,players,0)).toEqual({active:true,requiredIds:['hero','p2'],insideIds:['hero'],complete:false});players[1]!.x=exit.x;expect(exitProgress(map,1,players,0).complete).toBe(true);players[1]!.active=false;expect(exitProgress(map,1,players,0).complete).toBe(true);players[0]!.alive=false;expect(exitProgress(map,1,players,0).complete).toBe(false);
 });
 it('returns copied level snapshots and independent formation spawn positions',()=>{
  const map=mapDefinition('frost'),snapshot=levelSnapshot(map,3,[],2);snapshot.route[0]!.x=999;snapshot.exit.x=999;expect(levelDefinition(map,3).start.x).not.toBe(999);expect(levelDefinition(map,3).exit.x).not.toBe(999);const at=levelSpawn(map,3);at.x=999;expect(levelSpawn(map,3).x).not.toBe(999);
 });
});
describe('local-player camera contract',()=>{
 it('locks the local interpolated ground position to center at combat scale with matching inverse projection',()=>{
  const camera={...DEFAULT_PROJECTION,origin:{...DEFAULT_PROJECTION.origin}};
  for(const hero of [{x:7,y:8},{x:42.125,y:31.875},{x:54,y:42}]){followProjection(camera,hero);expect(camera.zoom).toBe(1);expect(worldToScreen(hero,camera)).toEqual({x:0,y:0});for(const offset of [{x:2,y:-1},{x:-7,y:5}]){const target={x:hero.x+offset.x,y:hero.y+offset.y},roundtrip=screenToWorld(worldToScreen(target,camera),camera);expect(roundtrip.x).toBeCloseTo(target.x,10);expect(roundtrip.y).toBeCloseTo(target.y,10);}}
 });
 it('moves the visible world window with the selected local player rather than map size or initial hero',()=>{
  const camera={...DEFAULT_PROJECTION,origin:{...DEFAULT_PROJECTION.origin}};followProjection(camera,{x:5,y:5});const first=visibleWorldBounds(camera);followProjection(camera,{x:35,y:25});const second=visibleWorldBounds(camera);expect(second.minX-first.minX).toBeCloseTo(30);expect(second.minY-first.minY).toBeCloseTo(20);expect(second.maxX-second.minX).toBeCloseTo(first.maxX-first.minX);
 });
});

function finishLevelEnemies(world:GameWorld):void {
 for(const unit of world.actors.values())if(unit.team==='enemy'&&unit.alive)world.combat.damage({sourceId:'hero',targetId:unit.id,amount:100000,damageType:'true',cause:'skill'});
 world.advance(FIXED_DT);
}
function enterExit(world:GameWorld,playerId='hero'):void {const actor=world.players.get(playerId)!.hero,exit=levelDefinition(world.map,world.wave).exit;actor.x=exit.x;actor.y=exit.y;actor.previous={x:exit.x,y:exit.y};}
function chooseReward(world:GameWorld,playerId='hero'):void {const player=world.players.get(playerId)!,choice=player.choices.find(c=>c.kind==='perk')??player.choices[0]!;world.command({type:'ChooseReward',choiceId:choice.id},playerId);if(player.pendingSkill)world.command({type:'ConfirmSkill',slot:'Q'},playerId);}
describe('authoritative level progression integration',()=>{
 for(const mapId of Object.keys(MAPS) as (keyof typeof MAPS)[])it(`${mapId}: clearing opens exit, five completed exits lead through rewards to victory`,()=>{
  const world=new GameWorld(1234,mapId);world.command({type:'Start'});
  for(let wave=1;wave<=5;wave++){
   expect(world.phase).toBe('shop');world.command({type:'LeaveShop'});const start=levelSpawn(world.map,wave);expect(world.wave).toBe(wave);expect({x:world.hero.x,y:world.hero.y}).toEqual(start);
   if(wave===5)expect(Array.from(world.actors.values()).filter(unit=>unit.team==='enemy'&&unit.alive).map(unit=>unit.kind)).toEqual([mapId==='ember'?'courtyardHeart':'mirrorRegent']);
   enterExit(world);world.advance(FIXED_DT);expect(world.phase).toBe('fighting');world.hero.x=start.x;world.hero.y=start.y;
   finishLevelEnemies(world);expect(world.phase).toBe('fighting');expect(world.snapshot().level.exitActive).toBe(true);expect(world.snapshot().level.remainingEnemies).toBe(0);
   enterExit(world);world.advance(FIXED_DT);expect(world.phase).toBe('reward');chooseReward(world);expect(world.phase).toBe(wave===5?'victory':'shop');
  }
 });
 it('waits for all living participating teammates but skips dead and inactive members',()=>{
  const world=new GameWorld();world.addPlayer('p2');world.addPlayer('dead');world.addPlayer('offline');world.command({type:'Start'});for(const id of world.players.keys())world.command({type:'LeaveShop'},id);world.setPlayerActive('offline',false);const dead=world.players.get('dead')!.hero;dead.hp=0;dead.alive=false;
  finishLevelEnemies(world);enterExit(world);world.advance(FIXED_DT);expect(world.phase).toBe('fighting');expect(world.snapshot().level.requiredIds).toEqual(['hero','p2']);enterExit(world,'p2');world.advance(FIXED_DT);expect(world.phase).toBe('reward');
 });
 it('rebuilds the same encounter and formation at its starting boundary after a fighting checkpoint',()=>{
  const world=new GameWorld(31,'frost');world.addPlayer('p2');world.command({type:'Start'});world.command({type:'LeaveShop'});world.command({type:'LeaveShop'},'p2');const checkpoint=world.savedRun!,initialEnemies=Array.from(world.actors.values()).filter(unit=>unit.team==='enemy').map(unit=>({id:unit.id,kind:unit.kind,x:unit.x,y:unit.y,hp:unit.hp}));world.hero.x+=3;world.hero.y+=2;finishLevelEnemies(world);
  const resumed=GameWorld.resume(checkpoint);expect(resumed.phase).toBe('fighting');expect({x:resumed.hero.x,y:resumed.hero.y}).toEqual(levelSpawn(resumed.map,1,0));const teammate=resumed.players.get('p2')!.hero;expect({x:teammate.x,y:teammate.y}).toEqual(levelSpawn(resumed.map,1,1));expect(Array.from(resumed.actors.values()).filter(unit=>unit.team==='enemy').map(unit=>({id:unit.id,kind:unit.kind,x:unit.x,y:unit.y,hp:unit.hp}))).toEqual(initialEnemies);expect(resumed.snapshot().level.exitActive).toBe(false);
 });
});
