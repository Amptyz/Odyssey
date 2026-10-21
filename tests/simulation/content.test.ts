import {openMerchantFixture,startCombatFixture,interactFixture,departFixture,chooseFixture} from '../helpers/scenes';
import { describe,it,expect } from 'vitest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { LocalTransport } from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import { validateContent } from '../../EmberDemo/assets/scripts/ember/content/validate';
import { MAPS,mapDefinition,type MapId } from '../../EmberDemo/assets/scripts/ember/content/maps';
import { SKILLS } from '../../EmberDemo/assets/scripts/ember/content/skills';
import { HERO } from '../../EmberDemo/assets/scripts/ember/content/config';
import {GAME_TUNING} from '../../EmberDemo/assets/scripts/ember/content/tuning';
import { applyStatus,movementMultiplier } from '../../EmberDemo/assets/scripts/ember/combat-core/StatusSystem';
import { Pathfinder } from '../../EmberDemo/assets/scripts/ember/ai/Pathfinder';
import { fitMapProjection,worldToScreen,screenToWorld } from '../../EmberDemo/assets/scripts/ember/render/GroundProjection';
import { distance } from '../../EmberDemo/assets/scripts/ember/utils/math';
function advance(w:GameWorld,seconds:number){for(let i=0;i<Math.round(seconds*30);i++)w.advance(1/30);}
function fixture(){const w=new GameWorld();w.loadout.Q='icebolt';openMerchantFixture(w);startCombatFixture(w);
  Object.assign(w.hero,{x:10,y:10,previous:{x:10,y:10}});
  for(const [id,u] of w.actors)if(u.team==='enemy')w.actors.delete(id);
  const e=w.spawnEnemy('melee',{x:11.3,y:10},300);e.windup=999;return{w,e};}
describe('extensible game content',()=>{
  it('validates all registered content and references',()=>expect(()=>validateContent()).not.toThrow());
  it('equips a semantic skill in Q and preserves identity on projectile / hit / cooldown',()=>{
    const {w,e}=fixture();w.command({type:'CastSlot',slot:'Q',point:e});
    expect(w.projectiles[0]?.skillId).toBe('icebolt');expect(w.cooldowns.icebolt).toBe(SKILLS.icebolt.cooldown);expect(w.cooldowns.fireball).toBe(0);
    advance(w,0.2);expect(e.hp).toBe(270);expect(e.statuses[0]?.id).toBe('slow');
    expect(w.combat.history.some(x=>x.type==='OnHit'&&x.skillId==='icebolt')).toBe(true);
    expect(w.snapshot().cooldowns.Q).toBe(w.cooldowns.icebolt);
  });
  it('cannot equip mid-combat or cast an unowned skill',()=>{
    const {w,e}=fixture();w.command({type:'ConfirmSkill',slot:'Q'});w.command({type:'CastSkill',skillId:'fireball',point:e});
    expect(w.loadout.Q).toBe('icebolt');expect(w.projectiles).toHaveLength(0);expect(w.cooldowns.fireball).toBe(0);
  });
  it('reuses double/empower for ice projectiles while fire-only perks do not leak',()=>{
    const {w,e}=fixture();for(const id of ['double','reserve','burn'] as const)w.combat.addPerk(id);
    w.command({type:'CastSlot',slot:'W',point:w.hero});w.command({type:'CastSlot',slot:'Q',point:e});
    expect(w.projectiles).toHaveLength(2);w.projectiles.forEach(p=>expect(p.damage).toBe(45));advance(w,0.3);
    expect(e.statuses.some(s=>s.id==='burn')).toBe(false);expect(e.statuses.some(s=>s.id==='slow')).toBe(true);
  });
  it('refreshes strongest slow without multiplicative stacking; expires in simulation time',()=>{
    const {w,e}=fixture();applyStatus(e,{id:'slow',duration:1,power:0.4},'hero','icebolt');
    applyStatus(e,{id:'slow',duration:2,power:0.8},'enemy','frostBolt');expect(e.statuses).toHaveLength(2);expect(movementMultiplier(e)).toBe(0.4);
    expect(e.statuses[0]?.sourceId).toBe('hero');advance(w,1);expect(movementMultiplier(e)).toBe(0.8);advance(w,1.1);expect(movementMultiplier(e)).toBe(1);
  });
  it('slow reduces actual hero movement and detached status snapshots do not mutate live state',()=>{
    const {w}=fixture();applyStatus(w.hero,{id:'slow',duration:2,power:0.5},'enemy','frostBolt');
    const s=w.snapshot();s.hero.statuses[0]!.power=0.1;
    w.command({type:'DirectInput',movement:{x:0,y:1}});advance(w,0.5);
    expect(w.hero.y-10).toBeCloseTo(((421.25*.5)*.5+110)*.01*GAME_TUNING.moveSpeedMultiplier*.5);expect(w.hero.statuses[0]?.power).toBe(0.5);
  });
  it('slow reduces enemy movement and pause freezes its duration',()=>{
    const a=fixture(),b=fixture();for(const item of [a,b]){item.e.windup=0;item.e.x=14;item.e.y=10;}
    applyStatus(b.e,{id:'slow',duration:2,power:0.5},'hero','icebolt');advance(a.w,0.5);advance(b.w,0.5);
    expect(14-b.e.x).toBeLessThan(14-a.e.x);b.w.command({type:'TogglePause'});const before=b.e.statuses[0]!.remaining;advance(b.w,1);expect(b.e.statuses[0]!.remaining).toBe(before);
  });
  it('new enemy uses shared ranged behavior with its own projectile and status',()=>{
    const {w}=fixture();const e=w.spawnEnemy('frostling',{x:14,y:10},300);advance(w,2);
    expect(w.hero.hp).toBeLessThan(HERO.hp);expect(w.hero.statuses.some(s=>s.id==='slow'&&s.sourceId===e.id)).toBe(true);
    expect(w.combat.history.some(x=>x.damageType==='magic'&&x.sourceId===e.id&&x.targetId==='hero')).toBe(true);
  });
  it('map switch and restart preserve map but start with empty skills; active map cannot switch',()=>{
    const port=new LocalTransport();port.send({type:'SelectMap',mapId:'frost'});expect(port.world.hero.x).toBe(mapDefinition('frost').heroSpawn.x);expect(port.world.loadout.Q).toBeNull();
    openMerchantFixture(port.world);startCombatFixture(port.world);port.send({type:'SelectMap',mapId:'ember'});expect(port.world.mapId).toBe('frost');
    port.send({type:'Restart'});expect(port.world.phase).toBe('ready');expect(port.world.mapId).toBe('frost');expect(port.world.loadout.Q).toBeNull();expect(port.world.hero.statuses).toHaveLength(0);
  });
  for(const id of Object.keys(MAPS) as MapId[]){
    it(`${id}: deterministic safe spawns, data-driven wave count and reward filtering`,()=>{
      const w=new GameWorld(1234,id),copy=new GameWorld(1234,id);openMerchantFixture(w);startCombatFixture(w);openMerchantFixture(copy);startCombatFixture(copy);expect(w.snapshot()).toEqual(copy.snapshot());
      for(let wave=1;wave<=w.map.waves.length;wave++){
        expect(w.wave).toBe(wave);expect(w.snapshot().totalWaves).toBe(w.map.waves.length);
        for(const e of w.actors.values())if(e.team==='enemy'){
          expect(w.nav.walkable(e,e.radius)).toBe(true);expect(distance(e,w.hero)).toBeGreaterThanOrEqual(w.map.spawnDistance);
          w.combat.damage({sourceId:'hero',targetId:e.id,amount:100000,cause:'basic',damageType:'true'});
        }
        advance(w,1/30);expect(w.phase).toBe('cleared');
        if(w.snapshot().scene.interactions.some(n=>n.kind==='ember')){interactFixture(w,'ember');expect(w.choices).toHaveLength(3);expect(w.choices.some(c=>c.kind==='skill')).toBe(true);chooseFixture(w);}
        departFixture(w);if(w.phase==='camp')departFixture(w);
      }
      expect(w.phase).toBe('victory');
    });
    it(`${id}: rectangular navigation boundaries and projection use the same map dimensions`,()=>{
      const map=mapDefinition(id),nav=new Pathfinder(map),camera=fitMapProjection(map);
      for(const p of [{x:0,y:0},{x:map.width,y:map.height},{x:map.width,y:0},{x:0,y:map.height},map.heroSpawn]){
        const q=worldToScreen(p,camera),back=screenToWorld(q,camera);expect(back.x).toBeCloseTo(p.x);expect(back.y).toBeCloseTo(p.y);
        expect(camera.zoom).toBe(GAME_TUNING.cameraZoom);
      }
      expect(nav.walkable({x:map.width-0.5,y:map.height-0.5})).toBe(true);expect(nav.walkable({x:map.width+1,y:map.height/2})).toBe(false);
      expect(nav.walkable({x:map.width/2,y:map.height+1})).toBe(false);
      expect(Math.abs(worldToScreen({x:map.width,y:map.height},camera).y)).toBeGreaterThan(360);
      const route=nav.find(map.heroSpawn,{x:map.width-1,y:map.height-1});expect(route.length).toBeGreaterThan(0);
      let prev=map.heroSpawn;for(const p of route){expect(nav.clear(prev,p)).toBe(true);prev=p;}
    });
  }
});
