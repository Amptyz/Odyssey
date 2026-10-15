import { Pathfinder } from '../ai/Pathfinder';
import { CombatEngine } from '../combat-core/CombatEngine';
import type { Actor, CombatCue, PerkId } from '../combat-core/types';
import { ENEMIES, FIXED_DT, HERO, SKILLS, WAVES, type EnemyKind, type SkillId } from '../content/config';
import { LAB_PRESETS, PERKS } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import { clamp, direction, distance, type Vec2 } from '../utils/math';
import { Random } from '../utils/Random';
export type Phase = 'ready'|'fighting'|'reward'|'victory'|'defeat';
export interface Unit extends Actor {
  kind:'hero'|EnemyKind; previous:Vec2; velocity:Vec2; attackCd:number;
  path:Vec2[]; repath:number; windup:number; aim:Vec2;
}
export interface Projectile extends Vec2 { id:number; previous:Vec2; sourceId:string; vx:number; vy:number; remaining:number; damage:number; enemy:boolean }
export interface VisualCue extends CombatCue { id:number; ttl:number; duration:number }
export interface WorldSnapshot {
  tick:number; time:number; phase:Phase; paused:boolean; wave:number; seed:number; lab:string;
  hero:Unit; units:Unit[]; projectiles:Projectile[]; cues:VisualCue[];
  cooldowns:Record<SkillId,number>; perks:PerkId[]; choices:PerkId[];
  targetId?:string; destination?:Vec2; kills:number; primed:boolean;
  metrics:{processed:number;dropped:number;maxDepth:number;kills:number};
}
export class GameWorld {
  readonly actors = new Map<string,Unit>();
  readonly nav = new Pathfinder();
  readonly combat:CombatEngine;
  readonly random:Random;
  readonly hero:Unit;
  readonly projectiles:Projectile[]=[];
  readonly cues:VisualCue[]=[];
  readonly cooldowns:Record<SkillId,number>={Q:0,W:0,E:0,R:0};
  phase:Phase='ready'; paused=false; wave=0; tickCount=0; time=0; lab='';
  choices:PerkId[]=[]; targetId?:string; destination?:Vec2;
  private serial=0; private accumulator=0; private dashTime=0; private dashDirection:Vec2={x:0,y:0};
  private direct?:{movement:Vec2;attack?:Vec2};
  constructor(readonly seed=1234) {
    this.random=new Random(seed);
    this.hero=this.makeUnit('hero','hero',{x:10,y:10},HERO.hp);
    this.combat=new CombatEngine(this.actors,cue=>this.addCue(cue));
  }
  command(command:GameCommand):void {
    if(command.type==='Stop'){this.stopControls();return;}
    if (command.type==='Start' && this.phase==='ready') {
      this.lab=command.lab ?? '';
      for (const id of LAB_PRESETS[this.lab] ?? []) this.combat.addPerk(id);
      this.spawnWave(); return;
    }
    if (command.type==='TogglePause' && this.phase==='fighting') { this.paused=!this.paused; this.accumulator=0; this.stopControls(); return; }
    if (command.type==='ChoosePerk' && this.phase==='reward' && this.choices.includes(command.perkId)) {
      this.combat.addPerk(command.perkId); this.choices=[];
      if (this.wave===WAVES.length) this.phase='victory'; else this.spawnWave();
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
    const units=Array.from(this.actors.values()).map(u=>({...u,previous:{...u.previous},velocity:{...u.velocity},path:u.path.map(p=>({...p})),aim:{...u.aim},burn:u.burn?{...u.burn}:undefined}));
    return {tick:this.tickCount,time:this.time,phase:this.phase,paused:this.paused,wave:this.wave,seed:this.seed,lab:this.lab,
      hero:units.find(u=>u.id==='hero')!,units,projectiles:this.projectiles.map(p=>({...p,previous:{...p.previous}})),
      cues:this.cues.map(c=>({...c,at:{...c.at},to:c.to?{...c.to}:undefined})),cooldowns:{...this.cooldowns},
      perks:Array.from(this.combat.perks),choices:[...this.choices],targetId:this.targetId,destination:this.destination?{...this.destination}:undefined,
      kills:this.combat.metrics.kills,primed:this.combat.isPrimed('hero'),metrics:{...this.combat.metrics}};
  }
  /** Development fixture used only by headless tests/benchmark; never bound to normal controls. */
  spawnEnemy(kind:EnemyKind,at:Vec2,hp=ENEMIES[kind].hp as number):Unit {
    return this.makeUnit(`enemy-${++this.serial}`,kind,this.nav.nearest(at),hp);
  }
  private makeUnit(id:string,kind:Unit['kind'],at:Vec2,hp:number):Unit {
    const unit:Unit={id,kind,team:kind==='hero'?'hero':'enemy',...at,hp,maxHp:hp,shield:0,shieldTime:0,alive:true,
      radius:kind==='hero'?HERO.radius:ENEMIES[kind].radius,previous:{...at},velocity:{x:0,y:0},attackCd:0,path:[],repath:0,windup:0,aim:{...at}};
    this.actors.set(id,unit); return unit;
  }
  private spawnWave():void {
    this.stopControls();
    for (const [id,a] of this.actors) if (a.team==='enemy') this.actors.delete(id);
    this.wave++; this.phase='fighting'; this.paused=false; this.accumulator=0; this.targetId=undefined; this.destination=undefined;
    this.projectiles.length=0; this.cues.length=0; this.hero.path=[]; this.hero.velocity={x:0,y:0}; this.dashTime=0;
    this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+30); this.hero.shield=0; this.hero.shieldTime=0;
    for (const key of Object.keys(SKILLS) as SkillId[]) this.cooldowns[key]=0;
    const config=WAVES[this.wave-1]!;
    for (const kind of ['melee','ranged'] as const) for (let i=0;i<config[kind];i++) {
      let point:Vec2|undefined;
      for (let attempt=0;attempt<100;attempt++) {
        const p={x:1.5+this.random.next()*17,y:1.5+this.random.next()*17};
        if (distance(p,this.hero)>=6 && this.nav.walkable(p) && Array.from(this.actors.values()).every(a=>distance(a,p)>0.9)) { point=p; break; }
      }
      if (!point) {
        for (let x=1;x<20 && !point;x++) for (let y=1;y<20 && !point;y++) {
          const p={x,y}; if(this.nav.walkable(p)&&distance(p,this.hero)>=6&&Array.from(this.actors.values()).every(a=>distance(a,p)>0.9)) point=p;
        }
      }
      if (point) this.spawnEnemy(kind,point,ENEMIES[kind].hp*config.hpScale);
    }
  }
  private cast(id:SkillId,point:Vec2):void {
    if (!(id in SKILLS) || this.cooldowns[id]>1e-8) return;
    this.cooldowns[id]=SKILLS[id].cooldown;
    const result=this.combat.cast('hero',id);
    const aim=direction(this.hero,point), d=aim.x===0&&aim.y===0 ? {x:1,y:0} : aim;
    if (id==='Q') {
      for (let i=0;i<result.shots;i++) {
        const angle=Math.atan2(d.y,d.x)+(i===0?0:0.13);
        this.shoot(this.hero,{x:Math.cos(angle),y:Math.sin(angle)},SKILLS.Q.damage*result.damageMultiplier,false);
      }
    } else if (id==='W') {
      this.hero.shield=SKILLS.W.shield; this.hero.shieldTime=SKILLS.W.duration;
      this.addCue({kind:'shield',at:{...this.hero},radius:1});
    } else if (id==='E') {
      this.dashTime=SKILLS.E.duration; this.dashDirection=d;
      this.hero.path=[]; this.hero.velocity={x:0,y:0}; this.targetId=undefined; this.destination=undefined;
    } else if (id==='R') {
      this.addCue({kind:'explosion',at:{...this.hero},radius:SKILLS.R.radius});
      for (const enemy of this.actors.values()) if (enemy.team==='enemy' && distance(enemy,this.hero)<=SKILLS.R.radius+enemy.radius)
        this.combat.damage({sourceId:'hero',targetId:enemy.id,amount:SKILLS.R.damage,cause:'skill',skillId:'R'});
    }
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
      this.choices=this.random.pick(PERKS.filter(p=>!this.combat.perks.has(p.id)).map(p=>p.id),3);
    }
  }
  private updateHero(dt:number):void {
    const h=this.hero;
    if (this.dashTime>0) {
      const duration=Math.min(dt,this.dashTime); this.dashTime-=duration;
      const next=this.nav.sweep(h,{x:h.x+this.dashDirection.x*SKILLS.E.distance/SKILLS.E.duration*duration,y:h.y+this.dashDirection.y*SKILLS.E.distance/SKILLS.E.duration*duration},h.radius);
      h.x=next.x; h.y=next.y; this.addCue({kind:'cast',at:{...h},radius:0.5}); return;
    }
    if(this.direct){
      const {movement,attack}=this.direct,speed=HERO.speed*this.perkMultiplier('speedMultiplier');
      const next=this.nav.sweep(h,{x:h.x+movement.x*speed*dt,y:h.y+movement.y*speed*dt},h.radius);
      h.velocity={x:(next.x-h.x)/dt,y:(next.y-h.y)/dt};h.x=next.x;h.y=next.y;
      if(attack&&h.attackCd<=0)this.attackToward(attack);
      return;
    }
    if (this.targetId) {
      const target=this.actors.get(this.targetId);
      if (!target?.alive) { this.targetId=undefined; h.path=[]; }
      else if (distance(h,target)<=HERO.attackRange+target.radius && this.nav.clear(h,target,0.1)) {
        h.path=[];
        if (h.attackCd<=0) {
          h.attackCd=HERO.attackInterval*this.perkMultiplier('attackMultiplier');
          this.combat.damage({sourceId:h.id,targetId:target.id,amount:HERO.attackDamage,cause:'basic'});
          this.addCue({kind:'arc',at:{...h},to:{...target},cause:'basic'});
        }
      } else if (h.repath<=0) { h.path=this.nav.find(h,target); h.repath=0.35; }
    }
    this.move(h,HERO.speed*this.perkMultiplier('speedMultiplier'),dt);
    if (this.destination && distance(h,this.destination)<0.08) this.destination=undefined;
  }
  private stopControls():void {
    this.direct=undefined;this.targetId=undefined;this.destination=undefined;
    this.hero.path=[];this.hero.velocity={x:0,y:0};
  }
  /** Directional basic attack: respects melee reach, facing, walls and the existing cadence. */
  private attackToward(point:Vec2):void {
    const h=this.hero,aim=direction(h,point);if(aim.x===0&&aim.y===0)return;
    h.attackCd=HERO.attackInterval*this.perkMultiplier('attackMultiplier');
    const target=Array.from(this.actors.values()).filter(e=>{
      if(!e.alive||e.team!=='enemy'||distance(h,e)>HERO.attackRange+e.radius)return false;
      const d=direction(h,e);return d.x*aim.x+d.y*aim.y>=0.5&&this.nav.clear(h,e,0.1);
    }).sort((a,b)=>distance(a,point)-distance(b,point))[0];
    if(target)this.combat.damage({sourceId:h.id,targetId:target.id,amount:HERO.attackDamage,cause:'basic'});
    this.addCue({kind:'arc',at:{...h},to:target?{...target}:{x:h.x+aim.x*HERO.attackRange,y:h.y+aim.y*HERO.attackRange},cause:'basic'});
  }
  private updateEnemy(e:Unit,dt:number):void {
    const cfg=ENEMIES[e.kind as EnemyKind];
    if (e.windup>0) {
      e.windup-=dt;
      if (e.windup<=0) {
        if (e.kind==='ranged') this.shoot(e,direction(e,e.aim),cfg.damage,true);
        else if (distance(e,this.hero)<=cfg.range+this.hero.radius+0.2) this.combat.damage({sourceId:e.id,targetId:'hero',amount:cfg.damage,cause:'enemy'});
        e.attackCd=cfg.interval;
      }
      return;
    }
    const dist=distance(e,this.hero);
    if (dist<=cfg.range+this.hero.radius && this.nav.clear(e,this.hero,0.1)) {
      e.path=[]; e.velocity={x:0,y:0};
      if (e.attackCd<=0) { e.windup=cfg.windup; e.aim={x:this.hero.x,y:this.hero.y}; }
    } else {
      if (e.repath<=0) { e.path=this.nav.find(e,this.hero); e.repath=0.55; }
      this.move(e,cfg.speed,dt);
    }
  }
  private move(unit:Unit,speed:number,dt:number):void {
    while (unit.path.length && distance(unit,unit.path[0]!)<0.08) unit.path.shift();
    const goal=unit.path[0];
    if (!goal) { unit.velocity.x*=0.65; unit.velocity.y*=0.65; return; }
    const dir=direction(unit,goal), dist=distance(unit,goal);
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
  private shoot(source:Unit,dir:Vec2,damage:number,enemy:boolean):void {
    const speed=enemy?5.3:SKILLS.Q.speed;
    this.projectiles.push({id:++this.serial,x:source.x,y:source.y,previous:{x:source.x,y:source.y},sourceId:source.id,
      vx:dir.x*speed,vy:dir.y*speed,remaining:enemy?4:SKILLS.Q.range/speed,damage,enemy});
  }
  private updateProjectiles(dt:number):void {
    for (let i=this.projectiles.length-1;i>=0;i--) {
      const p=this.projectiles[i]!; p.previous={x:p.x,y:p.y}; p.remaining-=dt;
      const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/0.1));
      for (let s=0;s<steps && p.remaining>0;s++) {
        p.x+=p.vx*dt/steps; p.y+=p.vy*dt/steps;
        if (!this.nav.walkable(p,0.12)) { p.remaining=0; break; }
        for (const a of this.actors.values()) if (a.alive && (a.team==='hero')===p.enemy && distance(p,a)<=a.radius+0.18) {
          this.combat.damage({sourceId:p.sourceId,targetId:a.id,amount:p.damage,cause:p.enemy?'enemy':'skill',skillId:p.enemy?undefined:'Q'});
          p.remaining=0; break;
        }
      }
      if(p.remaining<=0) this.projectiles.splice(i,1);
    }
  }
  private addCue(cue:CombatCue):void {
    const duration=cue.kind==='damage'||cue.kind==='heal'?0.8:0.45;
    this.cues.push({...cue,at:{x:cue.at.x,y:cue.at.y},to:cue.to?{x:cue.to.x,y:cue.to.y}:undefined,id:++this.serial,ttl:duration,duration});
    if(this.cues.length>192) this.cues.shift();
  }
  private validPoint(p:Vec2):boolean { return Number.isFinite(p.x)&&Number.isFinite(p.y); }
  private perkMultiplier(stat:'speedMultiplier'|'attackMultiplier'):number {
    return PERKS.reduce((value,p)=>value*(this.combat.perks.has(p.id)?p[stat]??1:1),1);
  }
}
