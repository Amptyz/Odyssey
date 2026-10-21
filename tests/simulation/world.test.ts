import {openMerchantFixture,startCombatFixture,interactFixture,departFixture,chooseFixture} from '../helpers/scenes';
import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { LocalTransport } from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import { HERO, SKILLS } from '../../EmberDemo/assets/scripts/ember/content/config';
import {AttributeSet} from '../../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import { distance } from '../../EmberDemo/assets/scripts/ember/utils/math';
import {worldToScreen,DEFAULT_PROJECTION} from '../../EmberDemo/assets/scripts/ember/render/GroundProjection';
function run(w:GameWorld,seconds:number,hz=60) { for(let i=0;i<seconds*hz;i++)w.advance(1/hz); }
function start(seed=1234) {const w=new GameWorld(seed);openMerchantFixture(w);startCombatFixture(w);return w;}
function freeze(e:GameWorld['hero']){e.attributes=new AttributeSet({...e.attributes.template,canMove:false,canAttack:false});return e;}
function sandbox() { const w=start();for(const [id,a] of w.actors)if(a.team==='enemy')w.actors.delete(id);Object.assign(w.hero,{x:10,y:10,previous:{x:10,y:10}});freeze(w.spawnEnemy('melee',{x:1,y:1},99999));return w; }
function finishLevel(w:GameWorld){for(const e of w.actors.values())if(e.team==='enemy'&&e.alive)w.combat.damage({sourceId:'hero',targetId:e.id,amount:100000,cause:'basic'});run(w,1/30,30);expect(w.phase).toBe('cleared');const exit=w.snapshot().level.exit;Object.assign(w.hero,{x:exit.x,y:exit.y});run(w,1/30,30);}
describe('fixed-step world and inputs',()=>{
  it('reproduces spawns with safe positions',()=>{
    const a=start(),b=start();expect(a.snapshot()).toEqual(b.snapshot());
    for(const e of a.actors.values())if(e.team==='enemy') {expect(distance(e,a.hero)).toBeGreaterThanOrEqual(6);expect(a.nav.walkable(e)).toBe(true);}
  });
  it('is invariant at 30 and 144 render FPS',()=>{
    const a=start(),b=start();for(const w of [a,b])w.command({type:'MoveTo',point:{x:13,y:10}});
    run(a,3,30);run(b,3,144);expect(a.snapshot()).toEqual(b.snapshot());
  });
  it('moves to the requested destination without crossing a pillar',()=>{
    const w=sandbox();w.hero.x=4;w.hero.y=6;
    w.command({type:'MoveTo',point:{x:8,y:6}});
    for(let i=0;i<180;i++) {w.advance(1/30);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);}
    expect(distance(w.hero,{x:8,y:6})).toBeLessThan(0.1);
  });
  it('sweeps E against pillars and borders, with correct cooldown',()=>{
    const w=sandbox();w.hero.x=4;w.hero.y=6;
    w.command({type:'CastSkill',skillId:'dash',point:{x:10,y:6}});run(w,0.3);
    expect(w.hero.x).toBeLessThan(5);expect(w.cooldowns.dash).toBeCloseTo(SKILLS.dash.cooldown-0.3,6);
    w.command({type:'CastSkill',skillId:'dash',point:{x:10,y:6}});expect(w.cooldowns.dash).toBeLessThan(SKILLS.dash.cooldown);
  });
  it('gates Q cooldown and blocks projectiles with solid obstacles',()=>{
    const w=sandbox();w.hero.x=4;w.hero.y=6;const e=freeze(w.spawnEnemy('ranged',{x:8,y:6},200));
    w.command({type:'CastSkill',skillId:'fireball',point:e});w.command({type:'CastSkill',skillId:'fireball',point:e});
    expect(w.projectiles).toHaveLength(1);run(w,0.5);expect(e.hp).toBe(200);expect(w.projectiles).toHaveLength(0);
  });
  it('Q hits, W shields, R does area damage',()=>{
    const w=sandbox(); const e=freeze(w.spawnEnemy('melee',{x:11.3,y:10},300));
    w.command({type:'CastSkill',skillId:'fireball',point:e});run(w,0.2);expect(e.hp).toBe(300-SKILLS.fireball.behavior.damage);
    w.command({type:'CastSkill',skillId:'shield',point:w.hero});expect(w.hero.shield).toBe(SKILLS.shield.behavior.amount);
    w.command({type:'CastSkill',skillId:'nova',point:w.hero});expect(e.hp).toBe(300-SKILLS.fireball.behavior.damage-SKILLS.nova.behavior.damage);
    run(w,4.1);expect(w.hero.shield).toBe(0);
  });
  it('movement never locks or attacks an enemy without left-attack input',()=>{
    const w=sandbox();const e=freeze(w.spawnEnemy('ranged',{x:12,y:10},500));
    w.command({type:'MoveTo',point:{x:e.x,y:e.y}});run(w,1.5);
    expect(e.hp).toBe(500);expect(w.hero.action.id).toBe(0);
  });
  it('melee and ranged enemies actually damage the hero',()=>{
    for(const kind of ['melee','ranged'] as const) {
      const w=sandbox();w.spawnEnemy(kind,{x:kind==='melee'?10.6:14,y:10});run(w,3);expect(w.hero.hp).toBeLessThan(HERO.hp);
    }
  });
  it('enemies route around a pillar and reach attack range',()=>{
    const w=sandbox();w.hero.x=4;w.hero.y=6;const e=w.spawnEnemy('melee',{x:8,y:6});
    for(let i=0;i<240;i++){w.advance(1/30);expect(w.nav.walkable(e,e.radius)).toBe(true);}
    expect(w.hero.hp).toBeLessThan(HERO.hp);
  });
  it('pause freezes time and rejects combat commands',()=>{
    const w=start();w.command({type:'TogglePause'});const before=w.snapshot();run(w,2);
    w.command({type:'CastSkill',skillId:'fireball',point:{x:0,y:0}});expect(w.snapshot()).toEqual(before);
    w.command({type:'TogglePause'});run(w,1);expect(w.time).toBeCloseTo(1);
  });
  it('five cleared levels wait for explicit exit interactions and preserve unique ember choices',()=>{
    const w=start();
    for(let wave=1;wave<=5;wave++){
      expect(w.wave).toBe(wave);finishLevel(w);expect(w.phase).toBe('cleared');expect(w.choices).toHaveLength(0);
      if(w.snapshot().scene.interactions.some(n=>n.kind==='ember')){interactFixture(w,'ember');expect(new Set(w.choices.map(c=>c.id)).size).toBe(3);chooseFixture(w);}
      departFixture(w);if(w.phase==='camp'){if(w.snapshot().scene.interactions.some(n=>n.kind==='ember'))chooseFixture(w);departFixture(w);}
    }
    expect(w.phase).toBe('victory');
  });
  it('death, restart and snapshots cannot leak prior state',()=>{
    const port=new LocalTransport();openMerchantFixture(port.world);startCombatFixture(port.world);const snapshot=port.snapshot();snapshot.hero.hp=0;
    expect(port.world.hero.hp).toBe(HERO.hp);
    port.world.combat.damage({sourceId:'enemy',targetId:'hero',amount:999,cause:'enemy'});run(port.world,1/30,30);
    expect(port.world.phase).toBe('defeat');port.send({type:'Restart'});expect(port.world.phase).toBe('ready');expect(port.world.hero.hp).toBe(HERO.hp);
  });
  it('swift and rhythm change movement and attack cadence',()=>{
    const a=sandbox(),b=sandbox();b.combat.addPerk('swift');
    for(const w of [a,b])w.command({type:'MoveTo',point:{x:13,y:10}});run(a,0.25);run(b,0.25);expect(b.hero.x).toBeGreaterThan(a.hero.x);
    b.combat.addPerk('rhythm');const e=b.spawnEnemy('ranged',{x:b.hero.x+1,y:b.hero.y},500);
    b.command({type:'Attack',point:e});expect(b.hero.attackCd).toBeCloseTo(HERO.attackInterval*0.85);
  });
  it('reserve plus double is applied to actual projectiles',()=>{
    const w=start();w.combat.addPerk('reserve');w.combat.addPerk('double');
    w.command({type:'CastSkill',skillId:'shield',point:w.hero});w.command({type:'CastSkill',skillId:'fireball',point:{x:15,y:10}});
    expect(w.projectiles).toHaveLength(2);w.projectiles.forEach(p=>expect(p.damage).toBe(SKILLS.fireball.behavior.damage*1.5));
  });
  it.each(['burn','arc','reserve'] as const)('%s preset retains three choices at configured ember sources',lab=>{
      const w=new GameWorld();openMerchantFixture(w,lab);startCombatFixture(w);
      for(let i=0;i<5;i++) {finishLevel(w);if(w.snapshot().scene.interactions.some(n=>n.kind==='ember')){interactFixture(w,'ember');expect(w.choices).toHaveLength(3);chooseFixture(w);}departFixture(w);if(w.phase==='camp')departFixture(w);}
  });
});


describe('direct movement and pointer attacks',()=>{
  it('normalizes diagonal movement, stops on release, and remains frame-rate independent',()=>{
    const a=sandbox(),b=sandbox();
    for(const w of [a,b])w.command({type:'DirectInput',movement:{x:1,y:1}});
    run(a,0.5,30);run(b,0.5,144);
    expect(a.snapshot()).toEqual(b.snapshot());
    const from=worldToScreen({x:10,y:10}),to=worldToScreen(a.hero);
    expect(Math.hypot(to.x-from.x,to.y-from.y)).toBeCloseTo(HERO.speed*0.5*DEFAULT_PROJECTION.pixelsPerUnit*DEFAULT_PROJECTION.zoom);
    a.command({type:'DirectInput',movement:{x:0,y:0}});const p={x:a.hero.x,y:a.hero.y};run(a,0.2);expect(distance(a.hero,p)).toBe(0);
  });
  it('blocks held movement at pillars and arena edges',()=>{
    for(const start of [{x:4,y:6},{x:55,y:10}]){
      const w=sandbox();Object.assign(w.hero,start);w.command({type:'DirectInput',movement:{x:1,y:0}});
      for(let i=0;i<90;i++){w.advance(1/30);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);}
      expect(w.hero.x).toBeLessThan(start.x===4?5:w.map.width-HERO.radius);
    }
  });
  it('attacks toward the pointer with normal range/cadence, without auto-chasing',()=>{
    const w=sandbox(),front=w.spawnEnemy('melee',{x:13,y:10},500),back=w.spawnEnemy('melee',{x:7,y:10},500);
    freeze(front);freeze(back);
    w.command({type:'Attack',point:front});w.command({type:'Attack',point:front});
    expect(front.hp).toBe(500);run(w,0.1);expect(front.hp).toBe(500);run(w,4/30);expect(front.hp).toBe(500-HERO.attackDamage/1.05);expect(back.hp).toBe(500);
    w.command({type:'AttackInput',point:front});run(w,0.8);
    expect(front.hp).toBe(500-HERO.attackDamage*2/1.05);expect(distance(w.hero,{x:10,y:10})).toBe(0);
    w.command({type:'AttackInput'});run(w,1);expect(front.hp).toBe(500-HERO.attackDamage*2/1.05);
    w.command({type:'Attack',point:back});run(w,.25);expect(back.hp).toBe(500-HERO.attackDamage/1.05);
  });
  it('does not hit out of range or through obstacles',()=>{
    const w=sandbox(),far=w.spawnEnemy('melee',{x:10+HERO.attackRange+1,y:10},500);
    w.command({type:'Attack',point:far});run(w,0.1);expect(far.hp).toBe(500);
    Object.assign(w.hero,{x:4.8,y:6,attackCd:0});const hidden=w.spawnEnemy('melee',{x:7.2,y:6},500);
    w.command({type:'Attack',point:hidden});run(w,0.1);expect(hidden.hp).toBe(500);
  });
  it('allows movement while attacking and cancels old movement on pause/stop',()=>{
    const w=sandbox();w.command({type:'MoveTo',point:{x:13,y:10}});
    w.command({type:'DirectInput',movement:{x:0,y:1}});w.command({type:'AttackInput',point:{x:15,y:10}});run(w,0.2);
    expect(w.destination).toBeUndefined();expect(w.hero.path).toHaveLength(0);expect(w.hero.y).toBeGreaterThan(10);
    w.command({type:'TogglePause'});const p={x:w.hero.x,y:w.hero.y};
    w.command({type:'DirectInput',movement:{x:1,y:0}});w.command({type:'TogglePause'});run(w,0.2);expect(distance(w.hero,p)).toBe(0);
    w.command({type:'DirectInput',movement:{x:1,y:0}});w.command({type:'Stop'});run(w,0.2);expect(distance(w.hero,p)).toBe(0);
  });
});
