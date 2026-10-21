import {describe,it,expect} from 'vitest';
import {GameWorld} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {DEFAULT_PROJECTION,worldToScreen,screenToWorld} from '../EmberDemo/assets/scripts/ember/render/GroundProjection';
import {direction,type Vec2} from '../EmberDemo/assets/scripts/ember/utils/math';
import {AttributeSet,movementSpeed,PLAYER_TEMPLATE} from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {applyStatus,movementMultiplier} from '../EmberDemo/assets/scripts/ember/combat-core/StatusSystem';
import {createActor} from '../EmberDemo/assets/scripts/ember/combat-core/ActorFactory';
import {CollisionWorld,overlaps} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {CombatEngine} from '../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import {EnemySystem,type EnemyUnit} from '../EmberDemo/assets/scripts/ember/simulation/EnemySystem';
import {enemy} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {mapDefinition} from '../EmberDemo/assets/scripts/ember/content/maps';
const camera={...DEFAULT_PROJECTION,origin:{x:87,y:-19}},start={x:12,y:10};
const directions=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));
const unitDirection=(screen:Vec2)=>direction({x:0,y:0},screenToWorld({x:camera.origin.x+screen.x,y:camera.origin.y+screen.y},camera));
function projectedDelta(from:Vec2,to:Vec2){const a=worldToScreen(from,camera),b=worldToScreen(to,camera);return{x:b.x-a.x,y:b.y-a.y};}
function advance(w:GameWorld,ticks:number){for(let i=0;i<ticks;i++)w.advance(1/30);}
function camp(){const w=new GameWorld();w.command({type:'Start'});return w;}
function reset(w:GameWorld){w.command({type:'Stop'});Object.assign(w.hero,start,{previous:{...start}});}
const reference=(speed:number)=>speed*camera.pixelsPerUnit*camera.zoom;

describe('one Euclidean ground metric for simulation and presentation',()=>{
 it('moves the same world AND screen distance in every held direction, including diagonal key combinations',()=>{
  const w=camp(),speeds=[];
  for(const screen of directions){
   reset(w);w.command({type:'DirectInput',movement:unitDirection(screen)});advance(w,9);
   const d=projectedDelta(start,w.hero),pixels=Math.hypot(d.x,d.y);speeds.push(pixels/.3);
   expect(pixels/.3).toBeCloseTo(reference(w.snapshot().hero.worldMoveSpeed),8);
   expect(Math.hypot(w.hero.x-start.x,w.hero.y-start.y)/.3).toBeCloseTo(w.snapshot().hero.worldMoveSpeed,8);
   expect(Math.hypot(w.hero.velocity.x,w.hero.velocity.y)).toBeCloseTo(w.snapshot().hero.worldMoveSpeed,8);
   expect(d.x/pixels).toBeCloseTo(screen.x,8);expect(d.y/pixels).toBeCloseTo(screen.y,8);
  }
  expect(Math.max(...speeds)/Math.min(...speeds)).toBeCloseTo(1,10);
 });
 it('keeps right-click acceleration and braking consistent in all directions and reaches each target without overshoot',()=>{
  const w=camp(),travel:number[]=[];
  for(const screen of directions){
   reset(w);const dir=unitDirection(screen),length=3.5,target={x:start.x+dir.x*length,y:start.y+dir.y*length};
   w.command({type:'MoveTo',point:target});advance(w,9);const d=projectedDelta(start,w.hero);travel.push(Math.hypot(d.x,d.y));
   for(let i=0;i<90;i++){
    const v=projectedDelta({x:0,y:0},w.hero.velocity);expect(Math.hypot(v.x,v.y)).toBeLessThanOrEqual(reference(w.snapshot().hero.worldMoveSpeed)+1e-6);
    expect(Math.hypot(w.hero.velocity.x,w.hero.velocity.y)).toBeLessThanOrEqual(w.snapshot().hero.worldMoveSpeed+1e-6);
    advance(w,1);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);
   }
   const remaining=projectedDelta(w.hero,target);expect(Math.hypot(remaining.x,remaining.y)).toBeLessThan(4);
  }
  expect(Math.max(...travel)/Math.min(...travel)).toBeCloseTo(1,8);
 });
 it('retains slow, analog input magnitude, release and immobility semantics',()=>{
  const w=camp();applyStatus(w.hero,{id:'slow',duration:999,power:.5},'enemy','frostBolt');
  for(const screen of directions){
   reset(w);const dir=unitDirection(screen);w.command({type:'DirectInput',movement:{x:dir.x*.5,y:dir.y*.5}});advance(w,9);
   const d=projectedDelta(start,w.hero),speed=movementSpeed(w.hero.attributes.value,movementMultiplier(w.hero));expect(Math.hypot(d.x,d.y)/.3).toBeCloseTo(reference(speed)*.5,8);
   expect(Math.hypot(w.hero.x-start.x,w.hero.y-start.y)/.3).toBeCloseTo(speed*.5,8);
  }
  w.command({type:'DirectInput',movement:{x:0,y:0}});const at={x:w.hero.x,y:w.hero.y};advance(w,6);expect({x:w.hero.x,y:w.hero.y}).toEqual(at);
  w.hero.attributes=new AttributeSet({...w.hero.attributes.template,canMove:false});w.command({type:'DirectInput',movement:{x:1,y:1}});advance(w,6);expect({x:w.hero.x,y:w.hero.y}).toEqual(at);
 });
 it('remains fixed-step deterministic at 30 and 144 FPS',()=>{
  const a=camp(),b=camp();for(const w of [a,b]){reset(w);w.command({type:'DirectInput',movement:{x:1,y:1}});}
  for(let i=0;i<15;i++)a.advance(1/30);for(let i=0;i<72;i++)b.advance(1/144);expect(a.snapshot()).toEqual(b.snapshot());
 });
 it('sweeps movement against obstacles and map borders every step',()=>{
  const w=camp();Object.assign(w.hero,{x:16,y:11,previous:{x:16,y:11}});w.command({type:'DirectInput',movement:{x:1,y:1}});
  for(let i=0;i<60;i++){advance(w,1);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);}
  expect(w.hero.x).toBeLessThan(21-(1.1+w.hero.radius)/Math.SQRT2+.01);
  Object.assign(w.hero,{x:12,y:18,previous:{x:12,y:18}});advance(w,60);expect(w.hero.y).toBeLessThanOrEqual(w.nav.map.height-w.hero.radius);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);
 });
 it('uses the same actual world speed and projected pace for enemy walking in all directions',()=>{
  const map={...mapDefinition('ember'),width:40,height:40,obstacles:[]},system=new EnemySystem(map),speeds:number[]=[];
  const unit=(id:string,kind:'hero'|'melee',at:Vec2):EnemyUnit=>({...createActor(id,kind==='hero'?'hero':'enemy',at,kind==='hero'?PLAYER_TEMPLATE:enemy('melee').template,.3),kind,previous:{...at},velocity:{x:0,y:0},path:[],repath:0,windup:0,attackWindup:0,attackCd:0,aim:{...at},facing:{x:1,y:0},action:{id:0,kind:'attack',time:0},hurtAt:-1,diedAt:-1});
  for(const screen of directions){
   system.reset();const dir=unitDirection(screen),e=unit('enemy','melee',{x:20,y:20}),h=unit('hero','hero',{x:20+dir.x*8,y:20+dir.y*8}),actors=new Map([[e.id,e],[h.id,h]]),collision=new CollisionWorld(map),combat=new CombatEngine(actors);
   for(let i=0;i<9;i++)system.step(1/30,{time:(i+1)/30,actors,players:[h],collision,combat});
   const d=projectedDelta({x:20,y:20},e);speeds.push(Math.hypot(d.x,d.y)/.3);expect(speeds.at(-1)).toBeCloseTo(reference(movementSpeed(e.attributes.value)),8);
   expect(Math.hypot(e.x-20,e.y-20)/.3).toBeCloseTo(movementSpeed(e.attributes.value),8);
  }
  expect(Math.max(...speeds)/Math.min(...speeds)).toBeCloseTo(1,8);
 });
 it('takes the same time to escape a real circular danger area in every direction',()=>{
  const ticks:number[]=[];
  for(const screen of directions){
   const w=camp();reset(w);const danger={kind:'circle' as const,center:start,radius:1.5};
   w.command({type:'DirectInput',movement:unitDirection(screen)});
   let count=0;while(overlaps(danger,w.hero)&&count<30){advance(w,1);count++;}
   expect(overlaps(danger,w.hero)).toBe(false);ticks.push(count);
  }
  expect(new Set(ticks).size).toBe(1);expect(ticks[0]).toBe(9);
 });
 it('resumes saved world positions and gives both players the same actual speed',()=>{
  const w=new GameWorld();w.addPlayer('ally');w.command({type:'Start'});Object.assign(w.hero,start,{previous:{...start}});
  Object.assign(w.players.get('ally')!.hero,{x:14,y:10,previous:{x:14,y:10}});w.saveProgress();
  const save=w.savedRun!;expect(save.version).toBe(5);const resumed=GameWorld.resume(save);
  for(const saved of save.players){
   const h=resumed.players.get(saved.id)!.hero;expect({x:h.x,y:h.y}).toEqual(saved.position);expect(h.facing).toEqual(saved.facing);
   resumed.command({type:'DirectInput',movement:unitDirection(saved.id==='hero'?{x:0,y:1}:{x:1,y:0})},saved.id);
  }
  advance(resumed,6);
  for(const saved of save.players){
   const h=resumed.players.get(saved.id)!.hero;
   expect(Math.hypot(h.x-saved.position.x,h.y-saved.position.y)/.2).toBeCloseTo(movementSpeed(h.attributes.value),8);
  }
 });
});
