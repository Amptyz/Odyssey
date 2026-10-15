import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { LocalTransport } from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import { HERO, SKILLS } from '../../EmberDemo/assets/scripts/ember/content/config';
import { distance } from '../../EmberDemo/assets/scripts/ember/utils/math';
function run(w:GameWorld,seconds:number,hz=60) { for(let i=0;i<seconds*hz;i++)w.advance(1/hz); }
function start(seed=1234) {const w=new GameWorld(seed);w.command({type:'Start'});return w;}
function sandbox() { const w=start();for(const [id,a] of w.actors)if(a.team==='enemy')w.actors.delete(id);w.spawnEnemy('melee',{x:1,y:1},99999).attackCd=9999; return w; }
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
    const w=sandbox();w.hero.x=4;w.hero.y=6;const e=w.spawnEnemy('ranged',{x:8,y:6},200);e.attackCd=999;
    w.command({type:'CastSkill',skillId:'fireball',point:e});w.command({type:'CastSkill',skillId:'fireball',point:e});
    expect(w.projectiles).toHaveLength(1);run(w,0.5);expect(e.hp).toBe(200);expect(w.projectiles).toHaveLength(0);
  });
  it('Q hits, W shields, R does area damage',()=>{
    const w=sandbox(); const e=w.spawnEnemy('melee',{x:11.3,y:10},300);e.attackCd=999;
    w.command({type:'CastSkill',skillId:'fireball',point:e});run(w,0.2);expect(e.hp).toBe(300-SKILLS.fireball.behavior.damage);
    w.command({type:'CastSkill',skillId:'shield',point:w.hero});expect(w.hero.shield).toBe(SKILLS.shield.behavior.amount);
    w.command({type:'CastSkill',skillId:'nova',point:w.hero});expect(e.hp).toBe(300-SKILLS.fireball.behavior.damage-SKILLS.nova.behavior.damage);
    run(w,4.1);expect(w.hero.shield).toBe(0);
  });
  it('right-click target auto approaches and attacks, stops after death',()=>{
    const w=sandbox(); const e=w.spawnEnemy('ranged',{x:15,y:10},40);e.attackCd=999;
    w.command({type:'SetTarget',targetId:e.id});run(w,4);
    expect(e.alive).toBe(false);expect(w.targetId).toBeUndefined();expect(w.hero.path).toHaveLength(0);
  });
  it('melee and ranged enemies actually damage the hero',()=>{
    for(const kind of ['melee','ranged'] as const) {
      const w=sandbox();w.spawnEnemy(kind,{x:kind==='melee'?10.6:13,y:10});run(w,3);expect(w.hero.hp).toBeLessThan(HERO.hp);
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
  it('three waves each reward three distinct unowned perks then victory',()=>{
    const w=start();
    for(let wave=1;wave<=3;wave++) {
      expect(w.wave).toBe(wave);
      for(const e of w.actors.values())if(e.team==='enemy')w.combat.damage({sourceId:'hero',targetId:e.id,amount:999,cause:'basic'});
      run(w,1/30,30);expect(w.phase).toBe('reward');expect(new Set(w.choices).size).toBe(3);
      w.choices.forEach(id=>expect(w.combat.perks.has(id)).toBe(false));
      const t=w.time;run(w,2);expect(w.time).toBe(t);
      w.command({type:'ChoosePerk',perkId:w.choices[0]!});
    }
    expect(w.phase).toBe('victory');
  });
  it('death, restart and snapshots cannot leak prior state',()=>{
    const port=new LocalTransport();port.send({type:'Start'});const snapshot=port.snapshot();snapshot.hero.hp=0;
    expect(port.world.hero.hp).toBe(HERO.hp);
    port.world.combat.damage({sourceId:'enemy',targetId:'hero',amount:999,cause:'enemy'});run(port.world,1/30,30);
    expect(port.world.phase).toBe('defeat');port.send({type:'Restart'});expect(port.world.phase).toBe('ready');expect(port.world.hero.hp).toBe(HERO.hp);
  });
  it('swift and rhythm change movement and attack cadence',()=>{
    const a=sandbox(),b=sandbox();b.combat.addPerk('swift');
    for(const w of [a,b])w.command({type:'MoveTo',point:{x:13,y:10}});run(a,0.5);run(b,0.5);expect(b.hero.x).toBeGreaterThan(a.hero.x);
    b.combat.addPerk('rhythm');const e=b.spawnEnemy('ranged',{x:b.hero.x+1,y:b.hero.y},500);
    b.command({type:'SetTarget',targetId:e.id});run(b,1/30,30);expect(b.hero.attackCd).toBeCloseTo(HERO.attackInterval*0.85);
  });
  it('reserve plus double is applied to actual projectiles',()=>{
    const w=start();w.combat.addPerk('reserve');w.combat.addPerk('double');
    w.command({type:'CastSkill',skillId:'shield',point:w.hero});w.command({type:'CastSkill',skillId:'fireball',point:{x:15,y:10}});
    expect(w.projectiles).toHaveLength(2);w.projectiles.forEach(p=>expect(p.damage).toBe(SKILLS.fireball.behavior.damage*1.5));
  });
  it('all three lab presets retain three available choices per wave',()=>{
    for(const lab of ['burn','arc','reserve'] as const) {
      const w=new GameWorld();w.command({type:'Start',lab});
      for(let i=0;i<3;i++) {for(const e of w.actors.values())if(e.team==='enemy')w.combat.damage({sourceId:'hero',targetId:e.id,amount:999,cause:'basic'});run(w,1/30,30);expect(w.choices).toHaveLength(3);w.command({type:'ChoosePerk',perkId:w.choices[0]!});}
    }
  });
});


describe('direct movement and pointer attacks',()=>{
  it('normalizes diagonal movement, stops on release, and remains frame-rate independent',()=>{
    const a=sandbox(),b=sandbox();
    for(const w of [a,b])w.command({type:'DirectInput',movement:{x:1,y:1}});
    run(a,0.5,30);run(b,0.5,144);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(distance(a.hero,{x:10,y:10})).toBeCloseTo(HERO.speed*0.5);
    a.command({type:'DirectInput',movement:{x:0,y:0}});const p={x:a.hero.x,y:a.hero.y};run(a,0.2);expect(distance(a.hero,p)).toBe(0);
  });
  it('blocks held movement at pillars and arena edges',()=>{
    for(const start of [{x:4,y:6},{x:19,y:10}]){
      const w=sandbox();Object.assign(w.hero,start);w.command({type:'DirectInput',movement:{x:1,y:0}});
      for(let i=0;i<90;i++){w.advance(1/30);expect(w.nav.walkable(w.hero,w.hero.radius)).toBe(true);}
      expect(w.hero.x).toBeLessThan(start.x===4?5:20-HERO.radius);
    }
  });
  it('attacks toward the pointer with normal range/cadence, without auto-chasing',()=>{
    const w=sandbox(),front=w.spawnEnemy('melee',{x:11.5,y:10},500),back=w.spawnEnemy('melee',{x:8.5,y:10},500);
    front.windup=999;back.windup=999;
    w.command({type:'Attack',point:front});w.command({type:'Attack',point:front});
    expect(front.hp).toBe(500-HERO.attackDamage);expect(back.hp).toBe(500);
    w.command({type:'DirectInput',movement:{x:0,y:0},attack:front});run(w,0.8);
    expect(front.hp).toBe(500-HERO.attackDamage*2);expect(distance(w.hero,{x:10,y:10})).toBe(0);
    w.command({type:'DirectInput',movement:{x:0,y:0}});run(w,1);expect(front.hp).toBe(500-HERO.attackDamage*2);
    w.command({type:'Attack',point:back});expect(back.hp).toBe(500-HERO.attackDamage);
  });
  it('does not hit out of range or through obstacles',()=>{
    const w=sandbox(),far=w.spawnEnemy('melee',{x:15,y:10},500);
    w.command({type:'Attack',point:far});expect(far.hp).toBe(500);
    Object.assign(w.hero,{x:4.8,y:6,attackCd:0});const hidden=w.spawnEnemy('melee',{x:7.2,y:6},500);
    w.command({type:'Attack',point:hidden});expect(hidden.hp).toBe(500);
  });
  it('allows movement while attacking and cancels old movement on pause/stop',()=>{
    const w=sandbox();w.command({type:'MoveTo',point:{x:13,y:10}});
    w.command({type:'DirectInput',movement:{x:0,y:1},attack:{x:15,y:10}});run(w,0.2);
    expect(w.destination).toBeUndefined();expect(w.hero.path).toHaveLength(0);expect(w.hero.y).toBeGreaterThan(10);
    w.command({type:'TogglePause'});const p={x:w.hero.x,y:w.hero.y};
    w.command({type:'DirectInput',movement:{x:1,y:0}});w.command({type:'TogglePause'});run(w,0.2);expect(distance(w.hero,p)).toBe(0);
    w.command({type:'DirectInput',movement:{x:1,y:0}});w.command({type:'Stop'});run(w,0.2);expect(distance(w.hero,p)).toBe(0);
  });
});
