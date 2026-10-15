import { Pathfinder } from '../ai/Pathfinder';
import { CombatEngine } from '../combat-core/CombatEngine';
import type { Actor, CombatCue, PerkId, PerkDefinition } from '../combat-core/types';
import { ENEMIES, FIXED_DT, HERO, SKILLS, type EnemyKind, type SkillId } from '../content/config';
import { skill,SKILL_SLOTS,type Loadout,type SkillSlot } from '../content/skills';
import { mapDefinition,type MapId,type MapDefinition } from '../content/maps';
import { enemy } from '../content/enemies';
import { applyStatus,movementMultiplier } from '../combat-core/StatusSystem';
import { executeSkill,type ProjectileBehavior } from './SkillSystem';
import { ENEMY_BEHAVIORS } from '../ai/EnemyBehaviors';
import { LAB_PRESETS, PERKS } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import { clamp, direction, distance, type Vec2 } from '../utils/math';
import { EquipmentSystem } from './EquipmentSystem';
import { rewardChoices,type RewardChoice } from './RewardSystem';
import { waveGold } from '../content/progression';
import type { EquipmentId,EquipmentLoadout,HeroStats } from '../content/equipment';
import type { ActionSignal } from '../content/animation';
import { Random } from '../utils/Random';
export type Phase = 'ready'|'shop'|'fighting'|'reward'|'victory'|'defeat';
export interface Unit extends Actor {
  kind:'hero'|EnemyKind; previous:Vec2; velocity:Vec2; attackCd:number;
  path:Vec2[]; repath:number; windup:number; aim:Vec2;facing:Vec2;action:ActionSignal;hurtAt:number;diedAt:number;
}
export interface Projectile extends Vec2 { id:number; previous:Vec2; sourceId:string; vx:number; vy:number; remaining:number; damage:number; enemy:boolean;skillId:SkillId }
export interface VisualCue extends CombatCue { id:number; ttl:number; duration:number }
export interface WorldSnapshot {
  tick:number; time:number; phase:Phase; paused:boolean; wave:number; seed:number; lab:string;
  hero:Unit; units:Unit[]; projectiles:Projectile[]; cues:VisualCue[];
  mapId:MapId;totalWaves:number;loadout:Loadout;
  cooldowns:Record<SkillSlot,number>; perks:PerkId[]; choices:RewardChoice[];pendingSkill?:SkillId;gold:number;inventory:EquipmentId[];equipment:EquipmentLoadout;stats:HeroStats;
  targetId?:string; destination?:Vec2; kills:number; primed:boolean;
  metrics:{processed:number;dropped:number;maxDepth:number;kills:number};
}
export class GameWorld {
  readonly actors = new Map<string,Unit>();
  readonly nav:Pathfinder;
  readonly map:MapDefinition;readonly loadout:Loadout;
  readonly combat:CombatEngine;
  readonly random:Random;
  readonly hero:Unit;
  readonly projectiles:Projectile[]=[];
  readonly cues:VisualCue[]=[];
  readonly cooldowns:Record<SkillId,number>=Object.fromEntries(Object.keys(SKILLS).map(id=>[id,0])) as Record<SkillId,number>;
  phase:Phase='ready'; paused=false; wave=0; tickCount=0; time=0; lab='';
  readonly equipment=new EquipmentSystem();
  pendingSkill?:SkillId;
  choices:RewardChoice[]=[]; targetId?:string; destination?:Vec2;
  private serial=0; private accumulator=0; private dashTime=0; private dashDirection:Vec2={x:0,y:0};
  private dashSpeed=0;
  private direct?:{movement:Vec2;attack?:Vec2};
  constructor(readonly seed=1234,readonly mapId:MapId='ember') {
    this.map=mapDefinition(mapId);this.nav=new Pathfinder(this.map);this.loadout={...this.map.loadout};
    this.random=new Random(seed);
    this.hero=this.makeUnit('hero','hero',this.map.heroSpawn,HERO.hp);
    this.combat=new CombatEngine(this.actors,cue=>this.addCue(cue),(hit,target)=>{const stats=this.equipment.stats;return hit.amount*(hit.sourceId==='hero'&&hit.cause!=='basic'?stats.skillPower:1)*(target.team==='hero'?100/(100+stats.armor):1);});
  }
  command(command:GameCommand):void {
    if(command.type==='CastSlot'&&SKILL_SLOTS.includes(command.slot)){this.command({type:'CastSkill',skillId:this.loadout[command.slot],point:command.point});return;}
    if(command.type==='Stop'){this.stopControls();return;}
    if (command.type==='Start' && this.phase==='ready') {
      this.lab=command.lab ?? '';
      if(this.lab)this.loadout.Q='fireball';
      for (const id of LAB_PRESETS[this.lab] ?? []) this.combat.addPerk(id);
      this.phase='shop';return;
    }
    if (command.type==='TogglePause' && this.phase==='fighting') { this.paused=!this.paused; this.accumulator=0; this.stopControls(); return; }
    if(this.phase==='shop'){
      if(command.type==='LeaveShop'){this.spawnWave();return;}
      let changed=false;
      if(command.type==='BuyEquipment')changed=this.equipment.buy(command.equipmentId);
      if(command.type==='EquipEquipment')changed=this.equipment.equip(command.equipmentId);
      if(command.type==='UnequipEquipment')changed=this.equipment.unequip(command.slot);
      if(changed){this.hero.maxHp=this.equipment.stats.maxHp;this.hero.hp=Math.min(this.hero.hp,this.hero.maxHp);}
      return;
    }
    if(this.phase==='reward'){
      if(command.type==='CancelSkill'){this.pendingSkill=undefined;return;}
      if(command.type==='ChooseReward'&&!this.pendingSkill){
        const choice=this.choices.find(c=>c.id===command.choiceId);if(!choice)return;
        if(choice.kind==='skill'){this.pendingSkill=choice.skillId;return;}
        this.combat.addPerk(choice.perkId);this.finishReward();return;
      }
      if(command.type==='ConfirmSkill'&&this.pendingSkill&&SKILL_SLOTS.includes(command.slot)&&!Object.values(this.loadout).includes(this.pendingSkill)){
        this.loadout[command.slot]=this.pendingSkill;this.pendingSkill=undefined;this.finishReward();
      }
      return;
    }
    if (this.phase!=='fighting' || this.paused || !this.hero.alive) return;
    if(command.type==='DirectInput'&&this.validPoint(command.movement)&&(!command.attack||this.validPoint(command.attack))){
      const length=Math.hypot(command.movement.x,command.movement.y),scale=1/Math.max(1,length);
      this.direct={movement:{x:command.movement.x*scale,y:command.movement.y*scale},attack:command.attack?{...command.attack}:undefined};
      this.targetId=undefined;this.destination=undefined;this.hero.path=[];
    } else if (command.type==='MoveTo' && this.validPoint(command.point)) {
      this.direct=undefined;
      this.targetId=undefined; this.destination=this.nav.nearest(command.point);
      this.hero.path=this.nav.find(this.hero,this.destination); this.hero.repath=0;
      this.addCue({kind:'cast',at:this.destination,radius:0.3});
    } else if (command.type==='SetTarget') {
      const target=this.actors.get(command.targetId);
      if (target?.alive && target.team==='enemy') { this.direct=undefined; this.targetId=target.id; this.destination=undefined; this.hero.repath=0; }
    } else if (command.type==='CastSkill' && this.validPoint(command.point)) this.cast(command.skillId,command.point);
    else if(command.type==='Attack'&&this.validPoint(command.point)&&this.hero.attackCd<=0&&this.dashTime<=0)this.attackToward(command.point);
  }
  /** Fixed 30 Hz; cap wall-clock catch-up after background tabs at 250 ms. */
  advance(realDt:number):number {
    if (this.phase!=='fighting' || this.paused || !Number.isFinite(realDt) || realDt<0) { this.accumulator=0; return 1; }
    this.accumulator+=Math.min(realDt,0.25);
    while (this.accumulator+1e-10>=FIXED_DT && this.phase==='fighting' && !this.paused) {
      this.accumulator-=FIXED_DT; this.step();
    }
    return clamp(this.accumulator/FIXED_DT,0,1);
  }
  snapshot():WorldSnapshot {
    const units=Array.from(this.actors.values()).map(u=>({...u,previous:{...u.previous},velocity:{...u.velocity},path:u.path.map(p=>({...p})),aim:{...u.aim},facing:{...u.facing},action:{...u.action},statuses:u.statuses.map(s=>({...s}))}));
    return {tick:this.tickCount,time:this.time,phase:this.phase,paused:this.paused,wave:this.wave,seed:this.seed,lab:this.lab,
      hero:units.find(u=>u.id==='hero')!,units,projectiles:this.projectiles.map(p=>({...p,previous:{...p.previous}})),
      cues:this.cues.map(c=>({...c,at:{...c.at},to:c.to?{...c.to}:undefined})),mapId:this.mapId,totalWaves:this.map.waves.length,loadout:{...this.loadout},
      cooldowns:Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,this.cooldowns[this.loadout[slot]]])) as Record<SkillSlot,number>,
      perks:Array.from(this.combat.perks),choices:this.choices.map(c=>({...c})),pendingSkill:this.pendingSkill,...this.equipment.snapshot(),targetId:this.targetId,destination:this.destination?{...this.destination}:undefined,
      kills:this.combat.metrics.kills,primed:this.combat.isPrimed('hero'),metrics:{...this.combat.metrics}};
  }
  /** Development fixture used only by headless tests/benchmark; never bound to normal controls. */
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
    for (const [id,a] of this.actors) if (a.team==='enemy') this.actors.delete(id);
    this.wave++; this.phase='fighting'; this.paused=false; this.accumulator=0; this.targetId=undefined; this.destination=undefined;
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
    this.cooldowns[id]=skill(id).cooldown*this.equipment.stats.cooldownMultiplier;this.castFrom(this.hero,id,point);
  }
  private animateAction(source:Unit,point:Vec2,kind:'attack'|'cast'):void {
    const aim=direction(source,point);if(aim.x||aim.y)source.facing=aim;source.action={id:source.action.id+1,kind,time:this.time};
  }
  private castFrom(source:Unit,id:SkillId,point:Vec2):void {
    this.animateAction(source,point,'cast');
    executeSkill({source,power:source.team==='hero'?this.equipment.stats.skillPower:1,point,skillId:id,combat:this.combat,actors:this.actors,
      shoot:(actor,aim,skillId,behavior,damage)=>this.shoot(actor,aim,skillId,behavior,damage),
      dash:(aim,length,duration)=>{if(source.id!=='hero')throw new Error('Dash behavior currently requires the hero');this.dashTime=duration;this.dashSpeed=length/duration;this.dashDirection=aim;this.stopControls();},
      cue:cue=>this.addCue(cue)});
  }
  private step():void {
    const dt=FIXED_DT; this.tickCount++; this.time+=dt;
    for (const a of this.actors.values()) { a.previous={x:a.x,y:a.y}; a.attackCd=Math.max(0,a.attackCd-dt); a.repath-=dt; }
    for (const key of Object.keys(SKILLS) as SkillId[]) this.cooldowns[key]=Math.max(0,this.cooldowns[key]-dt);
    this.combat.tick(dt);
    if (this.hero.alive) this.updateHero(dt);
    for (const enemy of this.actors.values()) if (enemy.alive && enemy.kind!=='hero' && this.hero.alive) this.updateEnemy(enemy,dt);
    this.updateProjectiles(dt);
    for (let i=this.cues.length-1;i>=0;i--) { this.cues[i]!.ttl-=dt; if(this.cues[i]!.ttl<=0) this.cues.splice(i,1); }
    // Death is resolved before wave rewards; simultaneous lethal hits cannot revive the hero.
    if (!this.hero.alive) { this.phase='defeat'; this.stopControls(); return; }
    if (!Array.from(this.actors.values()).some(a=>a.team==='enemy'&&a.alive)) {
      this.phase='reward'; this.targetId=undefined; this.hero.path=[]; this.projectiles.length=0;
      this.stopControls();
      this.equipment.gold+=waveGold(this.wave);
      this.choices=rewardChoices(this.random,this.loadout,this.combat.perks);
    }
  }
  private updateHero(dt:number):void {
    const h=this.hero;
    if (this.dashTime>0) {
      const duration=Math.min(dt,this.dashTime); this.dashTime-=duration;
      const next=this.nav.sweep(h,{x:h.x+this.dashDirection.x*this.dashSpeed*duration,y:h.y+this.dashDirection.y*this.dashSpeed*duration},h.radius);
      h.x=next.x; h.y=next.y; this.addCue({kind:'cast',at:{...h},radius:0.5}); return;
    }
    if(this.direct){
      const {movement,attack}=this.direct,speed=this.equipment.stats.speed*this.perkMultiplier('speedMultiplier')*movementMultiplier(h);
      if(movement.x||movement.y)h.facing={...movement};
      const next=this.nav.sweep(h,{x:h.x+movement.x*speed*dt,y:h.y+movement.y*speed*dt},h.radius);
      h.velocity={x:(next.x-h.x)/dt,y:(next.y-h.y)/dt};h.x=next.x;h.y=next.y;
      if(attack&&h.attackCd<=0)this.attackToward(attack);
      return;
    }
    if (this.targetId) {
      const target=this.actors.get(this.targetId);
      if (!target?.alive) { this.targetId=undefined; h.path=[]; }
      else if (distance(h,target)<=this.equipment.stats.attackRange+target.radius && this.nav.clear(h,target,0.1)) {
        h.path=[];
        if (h.attackCd<=0) {
          this.animateAction(h,target,'attack');
          h.attackCd=this.equipment.stats.attackInterval*this.perkMultiplier('attackMultiplier');
          this.combat.damage({sourceId:h.id,targetId:target.id,amount:this.equipment.stats.attackDamage,cause:'basic'});
          this.addCue({kind:'arc',at:{...h},to:{...target},cause:'basic'});
        }
      } else if (h.repath<=0) { h.path=this.nav.find(h,target); h.repath=0.35; }
    }
    this.move(h,this.equipment.stats.speed*this.perkMultiplier('speedMultiplier')*movementMultiplier(h),dt);
    if (this.destination && distance(h,this.destination)<0.08) this.destination=undefined;
  }
  private stopControls():void {
    this.direct=undefined;this.targetId=undefined;this.destination=undefined;
    this.hero.path=[];this.hero.velocity={x:0,y:0};
  }
  /** Directional basic attack: respects equipped range, facing, walls and the existing cadence. */
  private attackToward(point:Vec2):void {
    const h=this.hero,aim=direction(h,point);if(aim.x===0&&aim.y===0)return;
    this.animateAction(h,point,'attack');
    h.attackCd=this.equipment.stats.attackInterval*this.perkMultiplier('attackMultiplier');
    const target=Array.from(this.actors.values()).filter(e=>{
      if(!e.alive||e.team!=='enemy'||distance(h,e)>this.equipment.stats.attackRange+e.radius)return false;
      const d=direction(h,e);return d.x*aim.x+d.y*aim.y>=0.5&&this.nav.clear(h,e,0.1);
    }).sort((a,b)=>distance(a,point)-distance(b,point))[0];
    if(target)this.combat.damage({sourceId:h.id,targetId:target.id,amount:this.equipment.stats.attackDamage,cause:'basic'});
    this.addCue({kind:'arc',at:{...h},to:target?{...target}:{x:h.x+aim.x*this.equipment.stats.attackRange,y:h.y+aim.y*this.equipment.stats.attackRange},cause:'basic'});
  }
  private updateEnemy(e:Unit,dt:number):void {
    const definition=enemy(e.kind as EnemyKind);
    ENEMY_BEHAVIORS[definition.behavior]({unit:e,hero:this.hero,definition,nav:this.nav,
      move:(speed,dt)=>this.move(e,speed*movementMultiplier(e),dt),
      damage:amount=>{this.animateAction(e,this.hero,'attack');this.combat.damage({sourceId:e.id,targetId:'hero',amount,cause:'enemy'});},
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
      vx:dir.x*b.speed,vy:dir.y*b.speed,remaining:b.range/b.speed,damage,enemy:source.team==='enemy',skillId});
  }
  private updateProjectiles(dt:number):void {
    for (let i=this.projectiles.length-1;i>=0;i--) {
      const p=this.projectiles[i]!; p.previous={x:p.x,y:p.y}; p.remaining-=dt;
      const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/0.1));
      for (let s=0;s<steps && p.remaining>0;s++) {
        p.x+=p.vx*dt/steps; p.y+=p.vy*dt/steps;
        if (!this.nav.walkable(p,0.12)) { p.remaining=0; break; }
        for (const a of this.actors.values()) if (a.alive && (a.team==='hero')===p.enemy && distance(p,a)<=a.radius+0.18) {
          const behavior=skill(p.skillId).behavior;
          if(behavior.kind==='projectile')for(const status of behavior.onHit??[])applyStatus(a,status,p.sourceId,p.skillId);
          this.combat.damage({sourceId:p.sourceId,targetId:a.id,amount:p.damage,cause:p.enemy?'enemy':'skill',skillId:p.skillId});
          p.remaining=0; break;
        }
      }
      if(p.remaining<=0) this.projectiles.splice(i,1);
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
