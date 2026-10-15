import { Pathfinder } from '../ai/Pathfinder';
import { CombatEngine } from '../combat-core/CombatEngine';
import { CollisionWorld } from '../combat-core/CollisionWorld';
import type { Actor, CombatCue, DamageZone, Hit, MissileEffect, PerkId, PerkDefinition, Cause } from '../combat-core/types';
import { ENEMIES, FIXED_DT, HERO, SKILLS, type EnemyKind, type SkillId } from '../content/config';
import { skill,SKILL_SLOTS,type Loadout,type SkillSlot } from '../content/skills';
import { mapDefinition,type MapId,type MapDefinition } from '../content/maps';
import { enemy } from '../content/enemies';
import { applyStatus,movementMultiplier } from '../combat-core/StatusSystem';
import { executeSkill,type ProjectileBehavior } from './SkillSystem';
import { ENEMY_BEHAVIORS } from '../ai/EnemyBehaviors';
import { LAB_PRESETS, PERKS,type LabId } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import { clamp, direction, distance, type Vec2 } from '../utils/math';
import { EquipmentSystem } from './EquipmentSystem';
import { rewardChoices,type RewardChoice } from './RewardSystem';
import { waveGold } from '../content/progression';
import { basicAttack,type EquipmentId,type EquipmentLoadout,type HeroStats } from '../content/equipment';
import type { StatusApplication } from '../content/statuses';
import type { ActionSignal } from '../content/animation';
import { Random } from '../utils/Random';
import { parseDeveloperConfig,type DeveloperConfig,type DeveloperOptions,type DeveloperSnapshot } from './DeveloperConfig';
export type Phase = 'ready'|'shop'|'fighting'|'reward'|'victory'|'defeat';
export interface Unit extends Actor {
  kind:'hero'|EnemyKind; previous:Vec2; velocity:Vec2; attackCd:number;
  path:Vec2[]; repath:number; windup:number; aim:Vec2;facing:Vec2;action:ActionSignal;hurtAt:number;diedAt:number;
}
export interface Projectile extends Vec2 { id:number; previous:Vec2; sourceId:string; vx:number; vy:number; remaining:number; radius:number; damage:number; enemy:boolean;cause:Cause;appearance:string;skillId?:SkillId;onHit?:readonly StatusApplication[];payload?:Pick<Hit,'proc'|'appliesOnHit'|'trueDamage'|'unscaled'>;targetHpRatio?:number;hpDamageCap?:number;distanceScale?:number;distanceTraveled?:number }
export interface Swing {id:number;sourceId:string;center:Vec2;facing:Vec2;radius:number;arc:number;age:number;windup:number;active:number;damage:number;appearance:string}
interface ActiveSwing extends Swing {hitIds:Set<string>}
export interface VisualCue extends CombatCue { id:number; ttl:number; duration:number }
export interface WorldSnapshot {
  tick:number; time:number; phase:Phase; paused:boolean; wave:number; seed:number; lab:string;
  hero:Unit; units:Unit[]; projectiles:Projectile[]; swings:Swing[]; cues:VisualCue[];zones:DamageZone[];
  mapId:MapId;totalWaves:number;loadout:Loadout;
  cooldowns:Record<SkillSlot,number>; perks:PerkId[]; choices:RewardChoice[];pendingSkill?:SkillId;gold:number;inventory:EquipmentId[];equipment:EquipmentLoadout;stats:HeroStats;
  destination?:Vec2; kills:number; primed:boolean;
  metrics:{processed:number;dropped:number;maxDepth:number;kills:number};
  developer?:DeveloperSnapshot;
}
export class GameWorld {
  readonly actors = new Map<string,Unit>();
  readonly nav:Pathfinder;
  readonly collision:CollisionWorld;
  readonly map:MapDefinition;readonly loadout:Loadout;
  readonly combat:CombatEngine;
  readonly random:Random;
  readonly hero:Unit;
  readonly projectiles:Projectile[]=[];
  readonly cues:VisualCue[]=[];
  private readonly swings:ActiveSwing[]=[];
  readonly cooldowns:Record<SkillId,number>=Object.fromEntries(Object.keys(SKILLS).map(id=>[id,0])) as Record<SkillId,number>;
  phase:Phase='ready'; paused=false; wave=0; tickCount=0; time=0; lab:LabId|''='';
  readonly equipment=new EquipmentSystem();
  pendingSkill?:SkillId;
  choices:RewardChoice[]=[]; destination?:Vec2;
  private serial=0; private accumulator=0; private dashTime=0; private dashDirection:Vec2={x:0,y:0};
  private dashSpeed=0;
  private dashStart?:Vec2;
  private direct?:{movement:Vec2};private attackPoint?:Vec2;
  private readonly developerOptions?:DeveloperOptions;
  constructor(readonly seed=1234,readonly mapId:MapId='ember',developerOptions?:DeveloperOptions) {
    this.developerOptions=developerOptions?{...developerOptions}:undefined;
    this.map=mapDefinition(mapId);this.nav=new Pathfinder(this.map);this.loadout={...this.map.loadout};
    this.collision=new CollisionWorld(this.map);
    this.random=new Random(seed);
    this.hero=this.makeUnit('hero','hero',this.map.heroSpawn,HERO.hp);
    const combatRandom=new Random(seed^0x51ed270b);
    this.combat=new CombatEngine(this.actors,cue=>this.addCue(cue),(hit,target)=>{if(target.team==='hero'&&this.developerOptions?.invincible)return 0;const stats=this.stats;return hit.amount*(hit.sourceId==='hero'&&hit.cause!=='basic'&&!hit.unscaled?stats.skillPower:1)*(target.team==='hero'&&!hit.trueDamage?100/(100+stats.armor):1);},this.collision,{
      random:()=>combatRandom.next(),attackDamage:()=>this.stats.attackDamage,
      reduceCooldown:(id,seconds)=>{if(id==='hero')for(const key of new Set(Object.values(this.loadout)))this.cooldowns[key]=Math.max(0,this.cooldowns[key]-seconds);},
      projectile:(source,aim,effect,damage)=>this.shootAugment(source,aim,effect,damage),
    });
  }
  get stats():HeroStats {const stats=this.equipment.stats;return{...stats,maxHp:Math.max(1,Math.round(stats.maxHp*this.combat.modifier('maxHpMultiplier')))};}
  private refreshStats():void {this.hero.maxHp=this.stats.maxHp;this.hero.hp=Math.min(this.hero.hp,this.hero.maxHp);}
  /** A fresh, explicitly enabled test world starts directly at the selected encounter. */
  startDeveloper(config:DeveloperConfig):void {
    if(!this.developerOptions||this.phase!=='ready')return;
    const c=parseDeveloperConfig(config);if(c.mapId!==this.mapId||c.seed!==this.seed)return;
    Object.assign(this.loadout,c.loadout);for(const p of c.perks)this.combat.addPerk(p);
    for(const id of Object.values(c.equipment))this.equipment.inventory.add(id);
    Object.assign(this.equipment.equipped,c.equipment);this.refreshStats();this.hero.hp=this.hero.maxHp;
    this.wave=c.wave-1;this.spawnWave();
  }
  command(command:GameCommand):void {
    if(command.type==='DevAction'){
      if(!this.developerOptions)return;
      if(command.action==='recover'){
        Object.assign(this.hero,{alive:true,hp:this.hero.maxHp,statuses:[],shield:0,shieldTime:0,diedAt:-1,hurtAt:-1});
        if(this.phase==='defeat')this.phase='fighting';this.stopControls();this.accumulator=0;
      }
      if(command.action==='health25'&&this.hero.alive)this.hero.hp=Math.max(1,this.hero.maxHp*.25);
      if(command.action==='cooldowns'){for(const id of Object.keys(SKILLS) as SkillId[])this.cooldowns[id]=0;this.hero.attackCd=0;}
      if(command.action==='clearEnemies'){
        for(const [id,a] of this.actors)if(a.team==='enemy')this.actors.delete(id);
        for(let i=this.projectiles.length-1;i>=0;i--)if(this.projectiles[i]!.enemy)this.projectiles.splice(i,1);
      }
      if(command.action==='step'&&this.phase==='fighting'){this.stopControls();this.accumulator=0;this.step();}
      return;
    }
    if(command.type==='DevSpawn'){
      if(!this.developerOptions||!Object.prototype.hasOwnProperty.call(ENEMIES,command.enemyId)||![1,5].includes(command.count)||this.phase!=='fighting')return;
      let count=command.count;const radius=ENEMIES[command.enemyId].radius;
      for(let ring=3;ring<=8&&count>0;ring++)for(let i=0;i<24&&count>0;i++){
        if(this.actors.size>=128)return;
        const angle=Math.atan2(this.hero.facing.y,this.hero.facing.x)+i*Math.PI/12,p={x:this.hero.x+Math.cos(angle)*ring,y:this.hero.y+Math.sin(angle)*ring};
        if(!this.nav.walkable(p,radius)||[...this.actors.values()].some(a=>a.alive&&distance(a,p)<a.radius+radius+.15))continue;
        this.spawnEnemy(command.enemyId,p,ENEMIES[command.enemyId].hp*this.map.waves[this.wave-1]!.hpScale);count--;
      }
      return;
    }
    if(command.type==='CastSlot'&&SKILL_SLOTS.includes(command.slot)){this.command({type:'CastSkill',skillId:this.loadout[command.slot],point:command.point});return;}
    if(command.type==='Stop'){this.stopControls();return;}
    if (command.type==='Start' && this.phase==='ready') {
      this.lab=command.lab ?? '';
      if(this.lab)this.loadout.Q='fireball';
      for (const id of this.lab?LAB_PRESETS[this.lab]:[]) this.combat.addPerk(id);
      this.refreshStats();
      this.phase='shop';return;
    }
    if (command.type==='TogglePause' && this.phase==='fighting') { this.paused=!this.paused; this.accumulator=0; this.stopControls(); return; }
    if(this.phase==='shop'){
      if(command.type==='LeaveShop'){this.spawnWave();return;}
      let changed=false;
      if(command.type==='BuyEquipment')changed=this.equipment.buy(command.equipmentId);
      if(command.type==='EquipEquipment')changed=this.equipment.equip(command.equipmentId);
      if(command.type==='UnequipEquipment')changed=this.equipment.unequip(command.slot);
      if(changed)this.refreshStats();
      return;
    }
    if(this.phase==='reward'){
      if(command.type==='CancelSkill'){this.pendingSkill=undefined;return;}
      if(command.type==='ChooseReward'&&!this.pendingSkill){
        const choice=this.choices.find(c=>c.id===command.choiceId);if(!choice)return;
        if(choice.kind==='skill'){this.pendingSkill=choice.skillId;return;}
        this.combat.addPerk(choice.perkId);this.refreshStats();this.finishReward();return;
      }
      if(command.type==='ConfirmSkill'&&this.pendingSkill&&SKILL_SLOTS.includes(command.slot)&&!Object.values(this.loadout).includes(this.pendingSkill)){
        this.loadout[command.slot]=this.pendingSkill;this.pendingSkill=undefined;this.finishReward();
      }
      return;
    }
    if (this.phase!=='fighting' || this.paused || !this.hero.alive) return;
    if(command.type==='AttackInput'&&(!command.point||this.validPoint(command.point))){
      this.attackPoint=command.point?{...command.point}:undefined;
    } else if(command.type==='DirectInput'&&this.validPoint(command.movement)){
      const length=Math.hypot(command.movement.x,command.movement.y),scale=1/Math.max(1,length);
      this.direct={movement:{x:command.movement.x*scale,y:command.movement.y*scale}};
      this.destination=undefined;this.hero.path=[];
    } else if (command.type==='MoveTo' && this.validPoint(command.point)) {
      this.direct=undefined;
      this.destination=this.nav.nearest(command.point);
      this.hero.path=this.nav.find(this.hero,this.destination); this.hero.repath=0;
      this.addCue({kind:'cast',at:this.destination,radius:0.3});
    } else if (command.type==='CastSkill' && this.validPoint(command.point)) this.cast(command.skillId,command.point);
    else if(command.type==='Attack'&&this.validPoint(command.point)&&this.hero.attackCd<=0&&this.dashTime<=0)this.attackToward(command.point);
  }
  /** Fixed 30 Hz; cap wall-clock catch-up after background tabs at 250 ms. */
  advance(realDt:number):number {
    if (this.phase!=='fighting' || this.paused || !Number.isFinite(realDt) || realDt<0) { this.accumulator=0; return 1; }
    this.accumulator+=Math.min(realDt,0.25)*(this.developerOptions?.speed??1);
    while (this.accumulator+1e-10>=FIXED_DT && this.phase==='fighting' && !this.paused) {
      this.accumulator-=FIXED_DT; this.step();
    }
    return clamp(this.accumulator/FIXED_DT,0,1);
  }
  snapshot():WorldSnapshot {
    const units=Array.from(this.actors.values()).map(u=>({...u,previous:{...u.previous},velocity:{...u.velocity},path:u.path.map(p=>({...p})),aim:{...u.aim},facing:{...u.facing},action:{...u.action},statuses:u.statuses.map(s=>({...s}))}));
    return {tick:this.tickCount,time:this.time,phase:this.phase,paused:this.paused,wave:this.wave,seed:this.seed,lab:this.lab,
      hero:units.find(u=>u.id==='hero')!,units,projectiles:this.projectiles.map(p=>({...p,previous:{...p.previous},payload:p.payload?{...p.payload}:undefined,onHit:p.onHit?.map(s=>({...s}))})),
      zones:this.combat.zones.map(z=>({...z,from:{...z.from},to:{...z.to}})),
      swings:this.swings.map(({hitIds,...s})=>({...s,center:{...s.center},facing:{...s.facing}})),
      cues:this.cues.map(c=>({...c,at:{...c.at},to:c.to?{...c.to}:undefined,facing:c.facing?{...c.facing}:undefined})),mapId:this.mapId,totalWaves:this.map.waves.length,loadout:{...this.loadout},
      cooldowns:Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,this.cooldowns[this.loadout[slot]]])) as Record<SkillSlot,number>,
      perks:Array.from(this.combat.perks),choices:this.choices.map(c=>({...c})),pendingSkill:this.pendingSkill,...this.equipment.snapshot(),stats:this.stats,destination:this.destination?{...this.destination}:undefined,
      kills:this.combat.metrics.kills,primed:this.combat.isPrimed('hero'),metrics:{...this.combat.metrics}};
  }
  /** Used by wave spawning, headless fixtures and explicitly enabled developer tools. */
  spawnEnemy(kind:EnemyKind,at:Vec2,hp=ENEMIES[kind].hp as number):Unit {
    return this.makeUnit(`enemy-${++this.serial}`,kind,this.nav.nearest(at),hp);
  }
  private makeUnit(id:string,kind:Unit['kind'],at:Vec2,hp:number):Unit {
    const unit:Unit={id,kind,team:kind==='hero'?'hero':'enemy',...at,hp,maxHp:hp,shield:0,shieldTime:0,alive:true,statuses:[],
      radius:kind==='hero'?HERO.radius:ENEMIES[kind].radius,previous:{...at},velocity:{x:0,y:0},attackCd:0,path:[],repath:0,windup:0,aim:{...at},facing:{x:1,y:0},action:{id:0,kind:'attack',time:0},hurtAt:-1,diedAt:-1};
    this.actors.set(id,unit); return unit;
  }
  private finishReward():void {
    this.choices=[];this.pendingSkill=undefined;
    if(this.wave===this.map.waves.length)this.phase='victory';
    else if(this.map.shopAfterWaves.includes(this.wave))this.phase='shop';
    else this.spawnWave();
  }
  private spawnWave():void {
    this.stopControls();
    this.combat.resetEncounter();this.dashStart=undefined;
    for (const [id,a] of this.actors) if (a.team==='enemy') this.actors.delete(id);
    this.wave++; this.phase='fighting'; this.paused=false; this.accumulator=0; this.destination=undefined;
    this.swings.length=0;
    this.projectiles.length=0; this.cues.length=0; this.hero.path=[]; this.hero.velocity={x:0,y:0}; this.dashTime=0;
    this.hero.hp=this.wave===1?this.hero.maxHp:Math.min(this.hero.maxHp,this.hero.hp+30); this.hero.shield=0; this.hero.shieldTime=0;this.hero.statuses=[];this.hero.action.id=0;this.hero.hurtAt=-1;
    for (const key of Object.keys(SKILLS) as SkillId[]) this.cooldowns[key]=0;
    const config=this.map.waves[this.wave-1]!;
    for (const spawn of config.spawns) for (let i=0;i<spawn.count;i++) {
      const kind=spawn.enemyId,margin=this.map.spawnMargin;
      let point:Vec2|undefined;
      for (let attempt=0;attempt<100;attempt++) {
        const p={x:margin+this.random.next()*(this.map.width-2*margin),y:margin+this.random.next()*(this.map.height-2*margin)};
        if (distance(p,this.hero)>=this.map.spawnDistance && this.nav.walkable(p,ENEMIES[kind].radius) && Array.from(this.actors.values()).every(a=>distance(a,p)>0.9)) { point=p; break; }
      }
      if (!point) {
        for (let x=1;x<this.map.width && !point;x++) for (let y=1;y<this.map.height && !point;y++) {
          const p={x,y}; if(this.nav.walkable(p,ENEMIES[kind].radius)&&distance(p,this.hero)>=this.map.spawnDistance&&Array.from(this.actors.values()).every(a=>distance(a,p)>0.9)) point=p;
        }
      }
      if(!point)throw new Error(`No safe spawn for ${kind} in ${this.mapId}, wave ${this.wave}`);
      this.spawnEnemy(kind,point,ENEMIES[kind].hp*config.hpScale);
    }
  }
  private cast(id:SkillId,point:Vec2):void {
    if(!Object.values(this.loadout).includes(id)||this.cooldowns[id]>1e-8)return;
    if(skill(id).behavior.kind==='dash'&&this.dashTime>0)return;
    this.cooldowns[id]=this.developerOptions?.noCooldown?0:skill(id).cooldown*this.equipment.stats.cooldownMultiplier;this.castFrom(this.hero,id,point);
  }
  private animateAction(source:Unit,point:Vec2,kind:'attack'|'cast'):void {
    const aim=direction(source,point);if(aim.x||aim.y)source.facing=aim;source.action={id:source.action.id+1,kind,time:this.time};
  }
  private castFrom(source:Unit,id:SkillId,point:Vec2):void {
    this.animateAction(source,point,'cast');
    executeSkill({source,power:source.team==='hero'?this.equipment.stats.skillPower:1,point,skillId:id,combat:this.combat,actors:this.actors,
      shoot:(actor,aim,skillId,behavior,damage)=>this.shoot(actor,aim,skillId,behavior,damage),
      dash:(aim,length,duration)=>{if(source.id!=='hero')throw new Error('Dash behavior currently requires the hero');this.dashStart={x:source.x,y:source.y};this.dashTime=duration;this.dashSpeed=length/duration;this.dashDirection=aim;this.stopControls();},
      cue:cue=>this.addCue(cue)});
  }
  private step():void {
    const dt=FIXED_DT; this.tickCount++; this.time+=dt;
    for (const a of this.actors.values()) { a.previous={x:a.x,y:a.y}; a.attackCd=Math.max(0,a.attackCd-dt); a.repath-=dt; }
    for (const key of Object.keys(SKILLS) as SkillId[]) this.cooldowns[key]=Math.max(0,this.cooldowns[key]-dt);
    this.combat.tick(dt);
    if (this.hero.alive) this.updateHero(dt);
    if(!this.developerOptions?.freezeEnemies)for (const enemy of this.actors.values()) if (enemy.alive && enemy.kind!=='hero' && this.hero.alive) this.updateEnemy(enemy,dt);
    this.updateSwings(dt);this.updateProjectiles(dt);
    for (let i=this.cues.length-1;i>=0;i--) { this.cues[i]!.ttl-=dt; if(this.cues[i]!.ttl<=0) this.cues.splice(i,1); }
    // Death is resolved before wave rewards; simultaneous lethal hits cannot revive the hero.
    if (!this.hero.alive) { this.phase='defeat'; this.stopControls(); return; }
    if (!Array.from(this.actors.values()).some(a=>a.team==='enemy'&&a.alive)) {
      if(this.developerOptions)return; // Keep a cleared sandbox available for spawning and inspection.
      this.phase='reward'; this.hero.path=[]; this.projectiles.length=0;this.swings.length=0;
      this.stopControls();this.combat.zones.length=0;
      this.equipment.gold+=waveGold(this.wave);
      this.choices=rewardChoices(this.random,this.loadout,this.combat.perks);
    }
  }
  private updateHero(dt:number):void {
    const h=this.hero;
    if (this.dashTime>0) {
      const duration=Math.min(dt,this.dashTime); this.dashTime-=duration;
      const next=this.nav.sweep(h,{x:h.x+this.dashDirection.x*this.dashSpeed*duration,y:h.y+this.dashDirection.y*this.dashSpeed*duration},h.radius);
      h.x=next.x; h.y=next.y; this.addCue({kind:'cast',at:{...h},radius:0.5});
      if(this.dashTime<=1e-8&&this.dashStart){this.combat.dashEnded(h.id,this.dashStart,h);this.dashStart=undefined;}
      return;
    }
    if(this.direct){
      const {movement}=this.direct,speed=this.equipment.stats.speed*this.perkMultiplier('speedMultiplier')*movementMultiplier(h);
      if(movement.x||movement.y)h.facing={...movement};
      const next=this.nav.sweep(h,{x:h.x+movement.x*speed*dt,y:h.y+movement.y*speed*dt},h.radius);
      h.velocity={x:(next.x-h.x)/dt,y:(next.y-h.y)/dt};h.x=next.x;h.y=next.y;
      if(this.attackPoint&&h.attackCd<=0)this.attackToward(this.attackPoint);
      return;
    }
    this.move(h,this.equipment.stats.speed*this.perkMultiplier('speedMultiplier')*movementMultiplier(h),dt);
    if(this.attackPoint&&h.attackCd<=0)this.attackToward(this.attackPoint);
    if (this.destination && distance(h,this.destination)<0.08) this.destination=undefined;
  }
  private stopControls():void {
    this.direct=undefined;this.attackPoint=undefined;this.destination=undefined;
    this.hero.path=[];this.hero.velocity={x:0,y:0};
  }
  /** No target IDs: direction is fixed at release; only intersecting bodies can be damaged. */
  private attackToward(point:Vec2):void {
    const h=this.hero,aim=direction(h,point);if(aim.x===0&&aim.y===0)return;
    this.animateAction(h,point,'attack');
    h.attackCd=this.equipment.stats.attackInterval*this.perkMultiplier('attackMultiplier');
    const attack=basicAttack(this.equipment.equipped),stats=this.equipment.stats;
    this.combat.attack(h.id,aim);
    if(attack.kind==='projectile'){
      this.projectiles.push({id:++this.serial,x:h.x,y:h.y,previous:{x:h.x,y:h.y},sourceId:h.id,vx:aim.x*attack.speed,vy:aim.y*attack.speed,
        remaining:stats.attackRange/attack.speed,radius:attack.radius,damage:stats.attackDamage,enemy:false,cause:'basic',appearance:attack.appearance});
    }else{
      // Cap the whole swing below the attack cadence even with future high attack-speed items.
      const scale=Math.min(1,h.attackCd/(attack.windup+attack.active));
      this.swings.push({id:++this.serial,sourceId:h.id,center:{x:h.x,y:h.y},facing:aim,radius:stats.attackRange,arc:attack.arc,
        age:0,windup:attack.windup*scale,active:attack.active*scale,damage:stats.attackDamage,appearance:attack.appearance,hitIds:new Set()});
    }
  }
  private updateSwings(dt:number):void {
    for(let i=this.swings.length-1;i>=0;i--){
      const swing=this.swings[i]!,source=this.actors.get(swing.sourceId),before=swing.age;swing.age+=dt;
      if(!source?.alive||this.dashTime>0){this.swings.splice(i,1);continue;}
      swing.center={x:source.x,y:source.y};
      if(swing.age+1e-9>=swing.windup&&before<swing.windup+swing.active){
        for(const target of this.collision.targets(this.actors.values(),source.team,{kind:'sector',center:swing.center,facing:swing.facing,radius:swing.radius,arc:swing.arc})){
          if(swing.hitIds.has(target.id))continue;swing.hitIds.add(target.id);
          this.combat.damage({sourceId:source.id,targetId:target.id,amount:swing.damage,cause:'basic'});
        }
      }
      if(swing.age>=swing.windup+swing.active)this.swings.splice(i,1);
    }
  }
  private updateEnemy(e:Unit,dt:number):void {
    const definition=enemy(e.kind as EnemyKind);
    ENEMY_BEHAVIORS[definition.behavior]({unit:e,hero:this.hero,definition,nav:this.nav,
      move:(speed,dt)=>this.move(e,speed*movementMultiplier(e),dt),
      damage:amount=>{
        this.animateAction(e,e.aim,'attack');const facing=direction(e,e.aim),arc=definition.attackArc??Math.PI/2;
        this.addCue({kind:'swing',at:{...e},facing,arc,radius:definition.range,appearance:'physical',cause:'enemy'});
        for(const target of this.collision.targets(this.actors.values(),e.team,{kind:'sector',center:e,facing,arc,radius:definition.range}))
          this.combat.damage({sourceId:e.id,targetId:target.id,amount,cause:'enemy'});
      },
      cast:(id,point)=>this.castFrom(e,id,point)},dt);
  }
  private move(unit:Unit,speed:number,dt:number):void {
    while (unit.path.length && distance(unit,unit.path[0]!)<0.08) unit.path.shift();
    const goal=unit.path[0];
    if (!goal) { unit.velocity.x*=0.65; unit.velocity.y*=0.65; return; }
    const dir=direction(unit,goal), dist=distance(unit,goal);unit.facing={...dir};
    const braking=Math.min(speed,Math.sqrt(2*22*dist));
    const factor=Math.min(1,dt*14);
    unit.velocity.x+=(dir.x*braking-unit.velocity.x)*factor;
    unit.velocity.y+=(dir.y*braking-unit.velocity.y)*factor;
    const length=Math.hypot(unit.velocity.x,unit.velocity.y)*dt;
    const scale=length>dist?dist/length:1;
    const next=this.nav.sweep(unit,{x:unit.x+unit.velocity.x*dt*scale,y:unit.y+unit.velocity.y*dt*scale},unit.radius);
    if (distance(next,unit)<0.001 && dist>0.1) { unit.velocity={x:0,y:0}; unit.repath=0; }
    unit.x=next.x; unit.y=next.y;
  }
  private shoot(source:Actor,dir:Vec2,skillId:SkillId,b:ProjectileBehavior,damage:number):void {
    this.projectiles.push({id:++this.serial,x:source.x,y:source.y,previous:{x:source.x,y:source.y},sourceId:source.id,
      vx:dir.x*b.speed,vy:dir.y*b.speed,remaining:b.range/b.speed,radius:b.radius,damage,enemy:source.team==='enemy',cause:source.team==='enemy'?'enemy':'skill',skillId,appearance:skill(skillId).appearance,onHit:b.onHit});
  }
  private shootAugment(source:Actor,dir:Vec2,effect:MissileEffect,damage:number):void {
    if(this.projectiles.length>=256)return;
    this.projectiles.push({id:++this.serial,x:source.x,y:source.y,previous:{x:source.x,y:source.y},sourceId:source.id,
      vx:dir.x*effect.speed,vy:dir.y*effect.speed,remaining:effect.range/effect.speed,radius:effect.radius,damage,enemy:source.team==='enemy',cause:'augment',appearance:effect.appearance,
      payload:{proc:true,appliesOnHit:effect.appliesOnHit,trueDamage:effect.trueDamage,unscaled:!!effect.attackRatio||effect.trueDamage},
      targetHpRatio:effect.targetHpRatio,hpDamageCap:effect.hpDamageCap,distanceScale:effect.distanceScale,distanceTraveled:0});
  }
  private updateProjectiles(dt:number):void {
    for (let i=this.projectiles.length-1;i>=0;i--) {
      const p=this.projectiles[i]!,travel=Math.min(dt,p.remaining);p.previous={x:p.x,y:p.y};
      const end={x:p.x+p.vx*travel,y:p.y+p.vy*travel};
      const impact=this.collision.firstImpact(this.actors.values(),p.enemy?'enemy':'hero',p,end,p.radius,travel/dt),t=impact?.t??1;
      p.x+=(end.x-p.x)*t;p.y+=(end.y-p.y)*t;p.remaining-=travel;
      p.distanceTraveled=(p.distanceTraveled??0)+distance(p.previous,p);
      if(impact?.actor){
        for(const status of p.onHit??[])applyStatus(impact.actor,status,p.sourceId,p.skillId);
        const hpDamage=Math.min(impact.actor.maxHp*(p.targetHpRatio??0),p.hpDamageCap??Infinity),scale=p.distanceScale?1+Math.min(1,p.distanceTraveled/p.distanceScale):1;
        this.combat.damage({sourceId:p.sourceId,targetId:impact.actor.id,amount:(p.damage+hpDamage)*scale,cause:p.cause,skillId:p.skillId,...p.payload});
      }
      if(impact||p.remaining<=1e-9)this.projectiles.splice(i,1);
    }
  }
  private addCue(cue:CombatCue):void {
    if(cue.kind==='damage'&&cue.actorId){const unit=this.actors.get(cue.actorId);if(unit){unit.hurtAt=this.time;if(unit.hp<=0&&unit.diedAt<0)unit.diedAt=this.time;}}
    const duration=cue.kind==='damage'||cue.kind==='heal'?0.8:0.45;
    this.cues.push({...cue,at:{x:cue.at.x,y:cue.at.y},to:cue.to?{x:cue.to.x,y:cue.to.y}:undefined,id:++this.serial,ttl:duration,duration});
    if(this.cues.length>192) this.cues.shift();
  }
  private validPoint(p:Vec2):boolean { return Number.isFinite(p.x)&&Number.isFinite(p.y); }
  private perkMultiplier(stat:'speedMultiplier'|'attackMultiplier'):number {
    return PERKS.reduce((value,definition)=>{const p:PerkDefinition=definition;return value*(this.combat.perks.has(definition.id)?p[stat]??1:1);},1);
  }
}
