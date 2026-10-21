import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {meleeArea,activeMeleeArea} from '../EmberDemo/assets/scripts/ember/combat-core/MeleeSweep';
import {overlaps,CollisionWorld} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {cloneShape} from '../EmberDemo/assets/scripts/ember/combat-core/ShapeContours';
import {MELEE_ART} from '../EmberDemo/assets/scripts/ember/content/melee-motion';
import {BASIC_ATTACKS} from '../EmberDemo/assets/scripts/ember/content/attacks';
import {MELEE_OUTLINE} from '../EmberDemo/assets/scripts/ember/content/melee-outline';
import {meleeArtSample,sampleMelee,meleeShape,MeleeVfxTimeline} from '../EmberDemo/assets/scripts/ember/render/MeleeVfxPlan';
import {GameWorld,type Swing} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {AttributeSet} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {startCombatFixture} from './helpers/scenes';
const swing:Swing={id:1,sourceId:'hero',center:{x:20,y:20},facing:{x:1,y:0},radius:5,arc:BASIC_ATTACKS.slash.arc,age:.216,windup:.12,active:.12,damage:20,appearance:'physical'};
function fixture(withPeer=false){
 const world=new GameWorld(1234,'ember',{invincible:true,noCooldown:false,freezeEnemies:true,speed:1});
 if(withPeer)world.addPlayer('peer');startCombatFixture(world);
 for(const [id,a]of world.actors)if(a.team==='enemy')world.actors.delete(id);
 Object.assign(world.hero,{x:20,y:20,previous:{x:20,y:20}});
 world.collision.setTerrain({width:40,height:40,obstacles:[]});return world;
}
function spawn(world:GameWorld,at:{x:number;y:number}){
 const e=world.spawnEnemy('melee',at,1000);Object.assign(e,at,{previous:{...at}});
 e.attributes=new AttributeSet({...e.attributes.template,canMove:false,canAttack:false});return e;
}
const step=(world:GameWorld,count:number)=>{for(let i=0;i<count;i++)world.advance(1/30);};
describe('measured curved melee outline',()=>{
 it('retains the approved source image and common frame windows',()=>{
  expect(readFileSync('EmberDemo/assets/resources/art/melee-v3/keyframes-source.png').equals(readFileSync('art-source/basic-slash-v7/keyframes.png'))).toBe(true);
  expect(createHash('sha256').update(readFileSync('EmberDemo/assets/resources/art/melee-v3/keyframes-source.png')).digest('hex')).toBe(MELEE_OUTLINE.sourceSha256);
  for(const x of MELEE_ART.columns)expect(x+MELEE_ART.cellWidth).toBeLessThanOrEqual(MELEE_ART.width);
  for(const y of MELEE_ART.rows)expect(y+MELEE_ART.cellHeight).toBeLessThanOrEqual(MELEE_ART.height);
 });
 it('retains the nonuniform artwork timing and harmless fade frames',()=>{
  for(let i=2;i<MELEE_ART.times.length;i++){
   const time=MELEE_ART.times[i]!,frame=time<240?sampleMelee({...swing,age:time/1000},0):{...swing,age:time/1000,phase:'residue' as const,progress:1};
   const sample=meleeArtSample(frame);expect(sample.time).toBeCloseTo(time);
   expect(sample.mix===1?sample.b:sample.a).toBe(i);expect(Math.min(sample.mix,1-sample.mix)).toBeCloseTo(0);
  }
 });
 it('fills from the feet to the measured curve, with no dead zone and no circular overreach',()=>{
  const shape=meleeArea(swing);expect(shape.kind).toBe('polygon');expect(BASIC_ATTACKS.slash.arc).toBeGreaterThan(Math.PI);
  for(let i=1;i<shape.points.length;i+=19)for(const ratio of [.01,.25,.8]){
   const point=shape.points[i]!;
   expect(overlaps(shape,{x:20+(point.x-20)*ratio,y:20+(point.y-20)*ratio,radius:.001})).toBe(true);
   expect(Math.hypot(point.x-20,point.y-20)).toBeLessThanOrEqual(swing.radius+1e-6);
  }
  expect(meleeArea(swing,0)).not.toEqual(meleeArea(swing,.8));
  // Reject points just outside a short part of the curved edge even though the
  // old fixed-radius circle would include them.
  let exclusions=0;
  for(let i=1;i<shape.points.length;i+=31){
   const point=shape.points[i]!,dx=point.x-20,dy=point.y-20,r=Math.hypot(dx,dy);
   if(r>1&&r<4.5){expect(overlaps(shape,{x:20+dx*(r+.2)/r,y:20+dy*(r+.2)/r,radius:.001})).toBe(false);exclusions++;}
  }
  expect(exclusions).toBeGreaterThan(0);
  expect(overlaps(shape,{x:19,y:20,radius:.1})).toBe(false);
  expect(overlaps(shape,{x:25.2,y:20,radius:.1})).toBe(false);
  expect(activeMeleeArea(swing,0,.1)).toBeUndefined();
  expect(activeMeleeArea(swing,.24,.3)).toBeUndefined();
  const fast=activeMeleeArea({...swing,windup:.001,active:.001},0,1/30)!;
  expect(overlaps(fast,{x:20.6,y:20,radius:.1})).toBe(true);
 });
 it('respects walls and copies geometry instead of exposing attack state',()=>{
  const shape=meleeArea(swing),copy=cloneShape(shape);
  const space=new CollisionWorld({width:40,height:40,obstacles:[{x:21,y:20,radius:.5}]});
  const world=fixture(),hidden=spawn(world,{x:22,y:20}),visible=spawn(world,{x:20,y:22});
  expect(space.targets([hidden,visible],'hero',shape).map(a=>a.id)).toEqual([visible.id]);
  if(copy.kind!=='polygon')throw Error();copy.center.x=999;copy.points[0]!.x=999;
  expect(swing.center.x).toBe(20);expect(swing.facing.y).toBe(0);
  world.collision.setTerrain({width:40,height:40,obstacles:[{x:21,y:20,radius:.5}]});
  world.command({type:'Attack',point:{x:25,y:20}});step(world,9);
  expect(hidden.hp).toBe(1000);expect(visible.hp).toBeLessThan(1000);
 });
 it('hits close targets once after windup, accepts entrants during the active window and keeps peers independent',()=>{
  const world=fixture(true);
  const close=spawn(world,{x:20.6,y:20});world.command({type:'Attack',point:{x:25,y:20}});
  step(world,3);expect(close.hp).toBe(1000);step(world,1);expect(close.hp).toBeLessThan(1000);
  const entrant=spawn(world,{x:21,y:20});step(world,1);expect(entrant.hp).toBeLessThan(1000);
  step(world,4);const expired=spawn(world,{x:20.6,y:20});step(world,1);expect(expired.hp).toBe(1000);
  expect(world.combat.history.filter(e=>e.type==='OnHit'&&e.targetId===close.id&&e.sourceId==='hero')).toHaveLength(1);
  const peer=world.players.get('peer')!.hero;Object.assign(peer,{x:20,y:20,previous:{x:20,y:20}});
  world.command({type:'Attack',point:{x:25,y:20}},'peer');step(world,9);
  expect(world.combat.history.filter(e=>e.type==='OnHit'&&e.targetId===close.id&&e.sourceId==='peer')).toHaveLength(1);
 });
 it('hits close, middle and far targets in sixteen aim directions, with matching debug coverage',()=>{
  for(let d=0;d<16;d++){
   const world=fixture(),facing={x:Math.cos(d*Math.PI/8),y:Math.sin(d*Math.PI/8)};
   const at=(r:number)=>({x:20+r*facing.x,y:20+r*facing.y});
   const targets=[.6,2,4.8].map(r=>spawn(world,at(r))),rear=spawn(world,at(-2)),outside=spawn(world,at(5.6));
   world.command({type:'Attack',point:at(5)});const timeline=new MeleeVfxTimeline();let contacts=0;
   for(let tick=0;tick<10;tick++){
    world.advance(1/30);const state=world.snapshot();
    for(const alpha of [0,.5,.99])for(const frame of timeline.update(state,alpha,'regression'))if(frame.phase==='active'){
     const area=meleeShape(frame);expect(area).toEqual(meleeArea(frame));
     for(const target of targets)if(overlaps(area,target)){contacts++;expect(target.hp).toBeLessThan(1000);}
    }
   }
   expect(contacts).toBeGreaterThan(0);expect(targets.every(e=>e.hp<1000)).toBe(true);
   expect(rear.hp).toBe(1000);expect(outside.hp).toBe(1000);
   for(const target of targets)expect(world.combat.history.filter(e=>e.type==='OnHit'&&e.targetId===target.id&&e.sourceId==='hero')).toHaveLength(1);
  }
 },15000);
});
