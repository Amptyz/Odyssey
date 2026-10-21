import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {meleeBlade,meleeSweepShapes} from '../EmberDemo/assets/scripts/ember/combat-core/MeleeSweep';
import {overlaps,CollisionWorld} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {cloneShape} from '../EmberDemo/assets/scripts/ember/combat-core/ShapeContours';
import {MELEE_ART} from '../EmberDemo/assets/scripts/ember/content/melee-motion';
import {meleeArtSample,sampleMelee,meleeShape,MeleeVfxTimeline} from '../EmberDemo/assets/scripts/ember/render/MeleeVfxPlan';
import {GameWorld,type Swing} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {AttributeSet} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {startCombatFixture} from './helpers/scenes';
const swing:Swing={id:1,sourceId:'hero',center:{x:10,y:10},facing:{x:1,y:0},radius:5,arc:Math.PI*1.7,age:0,windup:.12,active:.12,damage:20,appearance:'physical'};
const center=(points:{x:number;y:number}[])=>points.reduce((p,q)=>({x:p.x+q.x/points.length,y:p.y+q.y/points.length}),{x:0,y:0});
describe('approved art and moving blade contract',()=>{
 it('ships the exact approved board, with valid common-canvas frame windows',()=>{
  expect(readFileSync('EmberDemo/assets/resources/art/melee-v3/keyframes-source.png').equals(readFileSync('art-source/basic-slash-v7/keyframes.png'))).toBe(true);
  for(const x of MELEE_ART.columns)expect(x+MELEE_ART.cellWidth).toBeLessThanOrEqual(MELEE_ART.width);
  for(const y of MELEE_ART.rows)expect(y+MELEE_ART.cellHeight).toBeLessThanOrEqual(MELEE_ART.height);
 });
 it('maps every approved key instant without substituting another pose, including the fade frames',()=>{
  for(let i=2;i<MELEE_ART.times.length;i++){
   const time=MELEE_ART.times[i]!,frame=time<240?sampleMelee({...swing,age:time/1000},0):{...swing,age:time/1000,phase:'residue' as const,progress:1};
   const sample=meleeArtSample(frame);expect(sample.time).toBeCloseTo(time);
   expect(sample.mix===1?sample.b:sample.a).toBe(i);expect(Math.min(sample.mix,1-sample.mix)).toBeCloseTo(0);
  }
  expect(meleeArtSample(sampleMelee({...swing,age:.11},1/30)).time).toBe(80);
 });
 it('sweeps tiny targets between pose samples, while retaining the empty centre and outer limit',()=>{
  const a=meleeBlade(swing,.2),b=meleeBlade(swing,.8),mid=center(meleeBlade(swing,.5).points),target={...mid,radius:.001};
  expect(overlaps(a,target)).toBe(false);expect(overlaps(b,target)).toBe(false);
  const sweep=meleeSweepShapes(swing,.144,.216);expect(sweep.some(s=>overlaps(s,target))).toBe(true);
  expect(sweep.some(s=>overlaps(s,{...swing.center,radius:.1}))).toBe(false);
  expect(sweep.some(s=>overlaps(s,{x:16,y:10,radius:.1}))).toBe(false);
  expect(meleeSweepShapes(swing,0,.1)).toEqual([]);expect(meleeSweepShapes(swing,.24,.3)).toEqual([]);
 });
 it('queries polygons through CollisionWorld, respects walls and copies mutable points',()=>{
  const shape=meleeBlade(swing,.6),at=center(shape.points);
  const space=new CollisionWorld({width:30,height:30,obstacles:[{x:(10+at.x)/2,y:(10+at.y)/2,radius:.6}]});
  expect(space.blocker(shape.center,at)).toBeDefined();
  const copy=cloneShape(shape);if(copy.kind!=='polygon')throw Error();copy.points[0]!.x=999;expect(shape.points[0]!.x).not.toBe(999);
  expect(overlaps(shape,{...shape.points[0]!,radius:0})).toBe(true);
 });
 it('hits on arrival once per target, never by the old trail, and keeps peer sources independent',()=>{
  const world=new GameWorld();world.addPlayer('peer');startCombatFixture(world);
  Object.assign(world.hero,{x:10,y:10,previous:{x:10,y:10}});
  const spawn=(at:{x:number;y:number})=>{const e=world.spawnEnemy('melee',at,1000);e.attributes=new AttributeSet({...e.attributes.template,canMove:false,canAttack:false});return e;};
  const early=spawn(center(meleeBlade(swing,0).points)),late=spawn(center(meleeBlade(swing,.8).points));
  world.command({type:'Attack',point:{x:15,y:10}});
  for(let i=0;i<3;i++)world.advance(1/30);expect(early.hp).toBe(1000);expect(late.hp).toBe(1000);
  world.advance(1/30);expect(early.hp).toBeLessThan(1000);expect(late.hp).toBe(1000);
  for(let i=0;i<3;i++)world.advance(1/30);expect(late.hp).toBeLessThan(1000);
  const old=spawn(center(meleeBlade(swing,0).points));world.advance(1/30);expect(old.hp).toBe(1000);
  expect(world.combat.history.filter(e=>e.type==='OnHit'&&e.targetId===early.id&&e.sourceId==='hero')).toHaveLength(1);
  const peer=world.players.get('peer')!.hero;Object.assign(peer,{x:10,y:10,previous:{x:10,y:10}});
  world.command({type:'Attack',point:{x:15,y:10}},'peer');for(let i=0;i<8;i++)world.advance(1/30);
  expect(world.combat.history.filter(e=>e.type==='OnHit'&&e.targetId===early.id&&e.sourceId==='peer')).toHaveLength(1);
 });
 it('never shows a blade touching an undamaged stationary target in sixteen mouse directions',()=>{
  for(let d=0;d<16;d++){
   const world=new GameWorld(1234,'ember',{invincible:true,noCooldown:false,freezeEnemies:true,speed:1});startCombatFixture(world);
   Object.assign(world.hero,{x:20,y:20,previous:{x:20,y:20}});
   const facing={x:Math.cos(d*Math.PI/8),y:Math.sin(d*Math.PI/8)},motion={...swing,center:{x:20,y:20},facing};
   const targets=[.1,.4,.7].map(p=>{
    const at=center(meleeBlade(motion,p).points),e=world.spawnEnemy('melee',at,1000);
    e.attributes=new AttributeSet({...e.attributes.template,canMove:false,canAttack:false});return e;
   });
   world.command({type:'Attack',point:{x:20+5*facing.x,y:20+5*facing.y}});
   const timeline=new MeleeVfxTimeline();let contacts=0;
   for(let tick=0;tick<10;tick++){
    world.advance(1/30);const state=world.snapshot();
    for(const alpha of [0,.25,.5,.75,.99])for(const frame of timeline.update(state,alpha,'regression'))if(frame.phase==='active'){
     for(const target of targets)if(overlaps(meleeShape(frame),target)){
      contacts++;expect(target.hp,`direction ${d}, tick ${tick}, alpha ${alpha}: visible blade ran ahead of damage`).toBeLessThan(1000);
     }
    }
   }
   expect(contacts).toBeGreaterThan(0);expect(targets.every(e=>e.hp<1000)).toBe(true);
  }
 },15000);
});
