import {EquipmentEffectSystem,type EquipmentPassiveSnapshot} from './EquipmentEffectSystem';
import {createActor} from '../combat-core/ActorFactory';
import {AttributeSet,PLAYER_TEMPLATE,movementSpeed,cooldownMultiplier,evaluate,type Attributes,type ValueExpression} from '../combat-core/attributes/AttributeSet';
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
import {EnemySystem,type EnemySnapshot} from './EnemySystem';
import {levelSpawn,enemyPlacements,exitProgress,levelSnapshot,type LevelSnapshot} from './LevelSystem';
import { LAB_PRESETS, PERKS,type LabId } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import { clamp, direction, distance, type Vec2 } from '../utils/math';
import { EquipmentSystem } from './EquipmentSystem';
import { rewardChoices,type RewardChoice } from './RewardSystem';
import { waveGold } from '../content/progression';
import { type EquipmentAppearanceLoadout,type EquipmentId,type EquipmentLoadout,type HeroStats } from '../content/equipment';
import type { StatusApplication } from '../content/statuses';
import type { ActionSignal } from '../content/animation';
import { Random } from '../utils/Random';
import { parseDeveloperConfig,type DeveloperConfig,type DeveloperOptions,type DeveloperSnapshot } from './DeveloperConfig';
import { detached,parseRunCheckpoint,type RunCheckpoint } from './RunCheckpoint';
export type Phase = 'ready'|'shop'|'fighting'|'reward'|'victory'|'defeat';
export interface Unit extends Actor {
  kind:'hero'|EnemyKind; previous:Vec2; velocity:Vec2; attackCd:number;
  path:Vec2[]; repath:number; windup:number; aim:Vec2;facing:Vec2;action:ActionSignal;hurtAt:number;diedAt:number;skillCooldowns:Record<SkillId,number>;attackWindup:number;
}
export type UnitSnapshot=Omit<Unit,'attributes'>&{attributeValues:Attributes;attributeExplanation:ReturnType<AttributeSet['explain']>;movementPoints:number;worldMoveSpeed:number};
export interface Projectile extends Vec2 { attackId?:number; id:number; previous:Vec2; sourceId:string; vx:number; vy:number; remaining:number; radius:number; damage:number; enemy:boolean;cause:Cause;appearance:string;skillId?:SkillId;onHit?:readonly StatusApplication[];payload?:Pick<Hit,'proc'|'appliesOnHit'|'damageType'|'area'|'delivery'>;targetHpRatio?:number;hpDamageCap?:number;distanceScale?:number;distanceTraveled?:number;targetExpression?:ValueExpression;expressionCap?:number;targetExpressionMultiplier?:number }
export interface Swing { attackId?:number;id:number;sourceId:string;center:Vec2;facing:Vec2;radius:number;arc:number;age:number;windup:number;active:number;damage:number;appearance:string}
interface ActiveSwing extends Swing {hitIds:Set<string>}
export interface VisualCue extends CombatCue { id:number; ttl:number; duration:number }
export interface WorldSnapshot {
  tick:number; time:number; phase:Phase; paused:boolean; wave:number; seed:number; lab:string;
  hero:UnitSnapshot; units:UnitSnapshot[]; projectiles:Projectile[]; swings:Swing[]; cues:VisualCue[];zones:DamageZone[];
  mapId:MapId;totalWaves:number;loadout:Loadout;level:LevelSnapshot;enemies:EnemySnapshot;
  cooldowns:Record<SkillSlot,number>; perks:PerkId[]; choices:RewardChoice[];pendingSkill?:SkillId;gold:number;inventory:EquipmentId[];equipment:EquipmentLoadout;purchaseOrder:EquipmentId[];appearance:EquipmentAppearanceLoadout;stats:HeroStats;
  equipmentPassives:EquipmentPassiveSnapshot[];
  destination?:Vec2; kills:number; primed:boolean;
  metrics:{processed:number;dropped:number;maxDepth:number;kills:number};
  party?:{id:string;ready:boolean;equipment:EquipmentLoadout;purchaseOrder:EquipmentId[];appearance:EquipmentAppearanceLoadout}[];
  network?:{code:string;playerId:string;hostId:string;status:string;blocked:boolean;revision:number};
  developer?:DeveloperSnapshot;
}
export interface PlayerState {
  id:string;active:boolean;hero:Unit;loadout:Loadout;equipment:EquipmentSystem;cooldowns:Record<SkillId,number>;
  choices:RewardChoice[];pendingSkill?:SkillId;destination?:Vec2;ready:boolean;
  dashTime:number;dashDirection:Vec2;dashSpeed:number;dashStart?:Vec2;
  direct?:{movement:Vec2};attackPoint?:Vec2;
}
export class GameWorld {
  readonly actors = new Map<string,Unit>();
  readonly nav:Pathfinder;
  readonly enemies:EnemySystem;
  readonly collision:CollisionWorld;
  readonly map:MapDefinition;
  readonly players=new Map<string,PlayerState>();
  readonly combat:CombatEngine;
  readonly random:Random;
  get hero():Unit{return this.players.get('hero')!.hero;}
  get loadout():Loadout{return this.players.get('hero')!.loadout;}
  get equipment():EquipmentSystem{return this.players.get('hero')!.equipment;}
  get cooldowns():Record<SkillId,number>{return this.players.get('hero')!.cooldowns;}
  get choices():RewardChoice[]{return this.players.get('hero')!.choices;}
  set choices(value:RewardChoice[]){this.players.get('hero')!.choices=value;}
  get pendingSkill():SkillId|undefined{return this.players.get('hero')!.pendingSkill;}
  set pendingSkill(value:SkillId|undefined){this.players.get('hero')!.pendingSkill=value;}
  get destination():Vec2|undefined{return this.players.get('hero')!.destination;}
  set destination(value:Vec2|undefined){this.players.get('hero')!.destination=value;}
  readonly equipmentEffects:EquipmentEffectSystem;
  readonly projectiles:Projectile[]=[];
  readonly cues:VisualCue[]=[];
  private readonly swings:ActiveSwing[]=[];
  phase:Phase='ready'; paused=false; wave=0; tickCount=0; time=0; lab:LabId|''='';
  private serial=0;private accumulator=0;
  private readonly combatRandom:Random;
  private spawnRandom=0;private spawnSerial=0;
  checkpointRevision=0;
  private checkpoint?:RunCheckpoint;
  get savedRun():RunCheckpoint|undefined{return this.checkpoint?detached(this.checkpoint):undefined;}
  private developerAttributeConfig?:Pick<DeveloperConfig,'attributeModifiers'|'attributeTarget'>;
  private readonly developerOptions?:DeveloperOptions;
  constructor(readonly seed=1234,readonly mapId:MapId='ember',developerOptions?:DeveloperOptions) {
    this.developerOptions=developerOptions?{...developerOptions}:undefined;
    this.map=mapDefinition(mapId);this.nav=new Pathfinder(this.map,HERO.radius);
    this.collision=new CollisionWorld(this.map);this.enemies=new EnemySystem(this.map);
    this.random=new Random(seed);
    this.addPlayer('hero');
    this.combatRandom=new Random(seed^0x51ed270b);
    this.combat=new CombatEngine(this.actors,cue=>this.addCue(cue),(hit,target)=>target.team==='hero'&&this.developerOptions?.invincible?0:hit.amount,this.collision,{
      onEvent:event=>this.equipmentEffects.onEvent(event),
      random:()=>this.combatRandom.next(),attackDamage:id=>this.actors.get(id)?.attributes.value.attackDamage??0,
      reduceCooldown:(id,seconds)=>{const p=this.players.get(id);if(p)for(const key of new Set(Object.values(p.loadout)))p.cooldowns[key]=Math.max(0,p.cooldowns[key]-seconds);},
      projectile:(source,aim,effect,damage)=>this.shootAugment(source,aim,effect,damage),
    });
    this.equipmentEffects=new EquipmentEffectSystem(this.combat,this.actors,()=>this.time);
  }
  get stats():HeroStats {return this.statsFor('hero');}
  statsFor(id:string):HeroStats {const p=this.players.get(id)!;return p.equipment.stats;}
  private refreshStats(p=this.players.get('hero')!):void {this.equipmentEffects?.sync(p.id,p.equipment.equipped);p.hero.maxHp=this.statsFor(p.id).maxHp;p.hero.hp=Math.min(p.hero.hp,p.hero.maxHp);p.hero.mana=Math.min(p.hero.mana,p.hero.attributes.value.maxMana);}
  /** New members join before the run; disconnected members retain their slot. */
  addPlayer(id:string):boolean {
    if(this.players.has(id))return true;if(this.phase!=='ready'||this.players.size>=4||!/^([a-zA-Z0-9_-]){1,48}$/.test(id))return false;
    const at=this.nav.nearest(levelSpawn(this.map,1,this.players.size));
    const hero=this.makeUnit(id,'hero',at,HERO.hp);
    this.players.set(id,{id,active:true,hero,loadout:{...this.map.loadout},equipment:new EquipmentSystem(hero.attributes),cooldowns:hero.skillCooldowns,choices:[],ready:false,dashTime:0,dashDirection:{x:0,y:0},dashSpeed:0});return true;
  }
  setPlayerActive(id:string,active:boolean):void {const p=this.players.get(id);if(!p||p.active===active)return;p.active=active;this.stopControls(p);if(!active)this.equipmentEffects.deactivate(id);if(active)this.actors.set(id,p.hero);else this.actors.delete(id);
    if(!active&&this.activePlayers.length&&this.activePlayers.every(member=>member.ready)){if(this.phase==='shop')this.spawnWave();else if(this.phase==='reward')this.finishReward(this.activePlayers[0]!);this.saveBoundary();}
  }
  private get activePlayers():PlayerState[]{return Array.from(this.players.values()).filter(p=>p.active);}
  stopPlayer(id:string):void {const p=this.players.get(id);if(p)this.stopControls(p);}
  stopAll():void {for(const p of this.players.values())this.stopControls(p);}
  /** A fresh, explicitly enabled test world starts directly at the selected encounter. */
  startDeveloper(config:DeveloperConfig):void {
    if(!this.developerOptions||this.phase!=='ready')return;
    const c=parseDeveloperConfig(config);if(c.mapId!==this.mapId||c.seed!==this.seed)return;
    this.developerAttributeConfig=c;for(const player of this.players.values())this.applyDeveloperAttributes(player.hero);
    Object.assign(this.loadout,c.loadout);for(const p of c.perks)this.combat.addPerk(p);
    for(const id of Object.values(c.equipment))this.equipment.inventory.add(id);
    Object.assign(this.equipment.equipped,c.equipment);this.equipment.purchaseOrder.push(...c.purchaseOrder);this.refreshStats();this.hero.hp=this.hero.maxHp;
    this.wave=c.wave-1;this.spawnWave();
  }
  command(command:GameCommand,playerId='hero'):void {
    const phase=this.phase,wave=this.wave;
    this.handleCommand(command,playerId);
    const boundary=['Start','LeaveShop','BuyEquipment','EquipEquipment','UnequipEquipment','ChooseReward','ConfirmSkill','CancelSkill'].includes(command.type);
    if(boundary&&this.phase!=='defeat'&&(this.phase!=='fighting'||phase!=='fighting'||wave!==this.wave))this.saveBoundary();
  }
  private handleCommand(command:GameCommand,playerId:string):void {
    const p=this.players.get(playerId);if(!p||!p.active)return;
    if(command.type==='DevAction'){
      if(!this.developerOptions)return;
      if(command.action==='recover'){
        for(const effect of p.hero.attributeEffects)p.hero.attributes.remove(effect.sourceId);p.hero.attributeEffects=[];p.hero.combatEffects=[];this.refreshStats(p);
        Object.assign(p.hero,{alive:true,hp:p.hero.maxHp,statuses:[],shield:0,shields:[],shieldTime:0,diedAt:-1,hurtAt:-1});
        if(this.phase==='defeat')this.phase='fighting';this.stopControls(p);this.accumulator=0;
      }
      if(command.action==='health25'&&p.hero.alive)p.hero.hp=Math.max(1,p.hero.maxHp*.25);
      if(command.action==='cooldowns'){for(const id of Object.keys(SKILLS) as SkillId[])p.cooldowns[id]=0;p.hero.attackCd=0;}
      if(command.action==='clearEnemies'){
        this.enemies.reset();
        for(const [id,a] of this.actors)if(a.team==='enemy')this.actors.delete(id);
        for(let i=this.projectiles.length-1;i>=0;i--)if(this.projectiles[i]!.enemy)this.projectiles.splice(i,1);
      }
      if(command.action==='step'&&this.phase==='fighting'){this.stopControls(p);this.accumulator=0;this.step();}
      return;
    }
    if(command.type==='DevSpawn'){
      if(!this.developerOptions||!Object.prototype.hasOwnProperty.call(ENEMIES,command.enemyId)||![1,5].includes(command.count)||this.phase!=='fighting')return;
      let count=command.count;const radius=ENEMIES[command.enemyId].radius;
      for(let ring=3;ring<=8&&count>0;ring++)for(let i=0;i<24&&count>0;i++){
        if(this.actors.size>=128)return;
        const angle=Math.atan2(p.hero.facing.y,p.hero.facing.x)+i*Math.PI/12,point={x:p.hero.x+Math.cos(angle)*ring,y:p.hero.y+Math.sin(angle)*ring};
        if(!this.nav.walkable(point,radius)||Array.from(this.actors.values()).some(a=>a.alive&&distance(a,point)<a.radius+radius+.15))continue;
        this.spawnEnemy(command.enemyId,point,(enemy(command.enemyId).template.stats.maxHealth??1)*this.map.waves[this.wave-1]!.hpScale);count--;
      }
      return;
    }
    if(command.type==='CastSlot'&&SKILL_SLOTS.includes(command.slot)){this.command({type:'CastSkill',skillId:p.loadout[command.slot],point:command.point},playerId);return;}
    if(command.type==='Stop'){this.stopControls(p);return;}
    if (command.type==='Start' && this.phase==='ready') {
      this.lab=command.lab ?? '';
      if(this.lab)p.loadout.Q='fireball';
      for(const member of this.players.values()){if(this.lab)member.loadout.Q='fireball';for(const id of this.lab?LAB_PRESETS[this.lab]:[])this.combat.addPerk(id,member.id);this.refreshStats(member);member.ready=false;}
      this.phase='shop';return;
    }
    if (command.type==='TogglePause' && this.phase==='fighting') { this.paused=!this.paused; this.accumulator=0; this.stopAll(); return; }
    if(this.phase==='shop'){
      if(command.type==='LeaveShop'){p.ready=true;if(this.activePlayers.every(member=>member.ready))this.spawnWave();return;}
      if(p.ready)return;
      let changed=false;
      if(command.type==='BuyEquipment')changed=p.equipment.buy(command.equipmentId,command.replaceSlot);
      if(command.type==='EquipEquipment')changed=p.equipment.equip(command.equipmentId,command.slot);
      if(command.type==='UnequipEquipment')changed=p.equipment.unequip(command.slot);
      if(changed)this.refreshStats(p);
      return;
    }
    if(this.phase==='reward'){
      if(p.ready)return;
      if(command.type==='CancelSkill'){p.pendingSkill=undefined;return;}
      if(command.type==='ChooseReward'&&!p.pendingSkill){
        const choice=p.choices.find(c=>c.id===command.choiceId);if(!choice)return;
        if(choice.kind==='skill'){p.pendingSkill=choice.skillId;return;}
        this.combat.addPerk(choice.perkId,p.id);this.refreshStats(p);this.finishReward(p);return;
      }
      if(command.type==='ConfirmSkill'&&p.pendingSkill&&SKILL_SLOTS.includes(command.slot)&&!Object.values(p.loadout).includes(p.pendingSkill)){
        p.loadout[command.slot]=p.pendingSkill;p.pendingSkill=undefined;this.finishReward(p);
      }
      return;
    }
    if (this.phase!=='fighting' || this.paused || !p.hero.alive) return;
    if(command.type==='AttackInput'&&(!command.point||this.validPoint(command.point))){
      p.attackPoint=command.point?{...command.point}:undefined;
    } else if(command.type==='DirectInput'&&this.validPoint(command.movement)){
      const length=Math.hypot(command.movement.x,command.movement.y),scale=1/Math.max(1,length);
      p.direct={movement:{x:command.movement.x*scale,y:command.movement.y*scale}};
      p.destination=undefined;p.hero.path=[];
    } else if (command.type==='MoveTo' && this.validPoint(command.point)) {
      p.direct=undefined;
      p.destination=this.nav.nearest(command.point);
      p.hero.path=this.nav.find(p.hero,p.destination); p.hero.repath=0;
      this.addCue({kind:'cast',at:p.destination,radius:0.3});
    } else if (command.type==='CastSkill' && this.validPoint(command.point)) this.cast(p,command.skillId,command.point);
    else if(command.type==='Attack'&&this.validPoint(command.point)&&p.hero.attackCd<=0&&p.dashTime<=0)this.attackToward(p,command.point);
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
  snapshot(playerId='hero'):WorldSnapshot {
    const p=this.players.get(playerId)??this.players.get('hero')!;
    const units=Array.from(this.actors.values(),u=>this.unitSnapshot(u));
    return {tick:this.tickCount,time:this.time,phase:this.phase,paused:this.paused,wave:this.wave,seed:this.seed,lab:this.lab,
      equipmentPassives:this.equipmentEffects.snapshot(p.id),
      hero:units.find(u=>u.id===p.id)??this.unitSnapshot(p.hero),units,projectiles:this.projectiles.map(p=>({...p,previous:{...p.previous},payload:p.payload?{...p.payload}:undefined,targetExpression:p.targetExpression?{...p.targetExpression}:undefined,onHit:p.onHit?.map(s=>({...s}))})),
      zones:this.combat.zones.map(z=>({...z,from:{...z.from},to:{...z.to}})),
      swings:this.swings.map(({hitIds,...s})=>({...s,center:{...s.center},facing:{...s.facing}})),
      cues:this.cues.map(c=>({...c,at:{...c.at},to:c.to?{...c.to}:undefined,facing:c.facing?{...c.facing}:undefined})),mapId:this.mapId,totalWaves:this.map.waves.length,level:levelSnapshot(this.map,Math.max(1,this.wave),this.levelParticipants(),this.remainingEnemies),enemies:this.enemies.snapshot(),loadout:{...p.loadout},
      cooldowns:Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,p.cooldowns[p.loadout[slot]]])) as Record<SkillSlot,number>,
      perks:Array.from(this.combat.perksFor(p.id)),choices:p.choices.map(c=>({...c})),pendingSkill:p.pendingSkill,...p.equipment.snapshot(),stats:this.statsFor(p.id),destination:p.destination?{...p.destination}:undefined,
      kills:this.combat.metrics.kills,primed:this.combat.isPrimed(p.id),metrics:{...this.combat.metrics},party:Array.from(this.players.values(),member=>({id:member.id,ready:member.ready,equipment:{...member.equipment.equipped},purchaseOrder:[...member.equipment.purchaseOrder],appearance:{...member.equipment.appearance}}))};
  }
  private unitSnapshot(u:Unit):UnitSnapshot {const {attributes,...rest}=u;return detached({...rest,attributeValues:{...attributes.value},attributeExplanation:attributes.explain(),movementPoints:movementSpeed(attributes.value,movementMultiplier(u))/.01,worldMoveSpeed:movementSpeed(attributes.value,movementMultiplier(u))});}
  /** Capture only a stable stage boundary, never an arbitrary combat frame. */
  private saveBoundary():void {
    if(this.developerOptions||this.phase==='defeat')return;
    this.checkpoint={version:3,seed:this.seed,mapId:this.mapId,wave:this.wave,phase:this.phase,time:this.time,tick:this.tickCount,
      kills:this.combat.metrics.kills,random:this.random.save(),combatRandom:this.combatRandom.save(),spawnRandom:this.spawnRandom,serial:this.serial,spawnSerial:this.spawnSerial,
      players:Array.from(this.players.values(),p=>({id:p.id,loadout:{...p.loadout},perks:Array.from(this.combat.perksFor(p.id)),gold:p.equipment.gold,
        inventory:Array.from(p.equipment.inventory),equipment:{...p.equipment.equipped},purchaseOrder:[...p.equipment.purchaseOrder],attributeSources:p.hero.attributes.exportSources().filter(s=>!s.sourceId.startsWith('equipment:')&&!s.sourceId.startsWith('perk:')&&s.sourceId!=='developer'&&!s.sourceId.startsWith('temporary:')),hp:p.hero.hp,mana:p.hero.mana,position:{x:p.hero.x,y:p.hero.y},facing:{...p.hero.facing},
        choices:detached(p.choices),pendingSkill:p.pendingSkill,ready:p.ready}))};
    this.checkpointRevision++;
  }
  saveLobby():void {if(this.phase==='ready')this.saveBoundary();}
  static resume(value:unknown):GameWorld {
    const c=parseRunCheckpoint(value),w=new GameWorld(c.seed,c.mapId);
    for(const saved of c.players){
      w.addPlayer(saved.id);const p=w.players.get(saved.id)!;
      Object.assign(p.loadout,saved.loadout);for(const id of saved.perks)w.combat.addPerk(id,p.id);
      p.equipment.gold=saved.gold;for(const id of saved.inventory)p.equipment.inventory.add(id);Object.assign(p.equipment.equipped,saved.equipment);p.equipment.purchaseOrder.push(...saved.purchaseOrder);
      for(const source of saved.attributeSources)p.hero.attributes.upsert(source);w.refreshStats(p);Object.assign(p.hero,saved.position,{previous:{...saved.position},facing:{...saved.facing},mana:Math.min(saved.mana,p.hero.attributes.value.maxMana),hp:Math.min(saved.hp,p.hero.maxHp),alive:saved.hp>0});
      p.choices=detached(saved.choices);p.pendingSkill=saved.pendingSkill;p.ready=saved.ready;
    }
    if(c.phase==='fighting'){
      w.wave=c.wave-1;w.random.restore(c.spawnRandom);w.serial=c.spawnSerial;w.spawnWave();
      for(const saved of c.players)w.players.get(saved.id)!.hero.hp=Math.min(saved.hp,w.players.get(saved.id)!.hero.maxHp);
    }else{w.wave=c.wave;w.phase=c.phase;}
    w.time=c.time;w.tickCount=c.tick;w.combat.metrics.kills=c.kills;w.random.restore(c.random);w.combatRandom.restore(c.combatRandom);w.spawnRandom=c.spawnRandom;w.serial=c.serial;w.spawnSerial=c.spawnSerial;
    w.stopAll();w.saveBoundary();return w;
  }
  /** Used by wave spawning, headless fixtures and explicitly enabled developer tools. */
  spawnEnemy(kind:EnemyKind,at:Vec2,hp=enemy(kind).template.stats.maxHealth??1):Unit {
    return this.makeUnit(`enemy-${++this.serial}`,kind,this.enemies.navigation.forRadius(enemy(kind).radius).nearest(at),hp);
  }
  private makeUnit(id:string,kind:Unit['kind'],at:Vec2,hp:number):Unit {
    const cfg=kind==='hero'?undefined:ENEMIES[kind];
    const base=createActor(id,kind==='hero'?'hero':'enemy',at,kind==='hero'?PLAYER_TEMPLATE:{...cfg!.template,stats:{...cfg!.template.stats,maxHealth:hp}},kind==='hero'?HERO.radius:ENEMIES[kind].radius);
    const unit:Unit={...base,kind,skillCooldowns:Object.fromEntries(Object.keys(SKILLS).map(key=>[key,0])) as Record<SkillId,number>,attackWindup:0,
      radius:kind==='hero'?HERO.radius:ENEMIES[kind].radius,previous:{...at},velocity:{x:0,y:0},attackCd:0,path:[],repath:0,windup:0,aim:{...at},facing:{x:1,y:0},action:{id:0,kind:'attack',time:0},hurtAt:-1,diedAt:-1};
    this.applyDeveloperAttributes(unit);unit.maxHp=unit.attributes.value.maxHealth;unit.hp=Math.min(unit.hp,unit.maxHp);unit.mana=unit.attributes.value.maxMana;this.actors.set(id,unit); return unit;
  }
  private applyDeveloperAttributes(unit:Unit):void {const c=this.developerAttributeConfig;if(c?.attributeModifiers&&(c.attributeTarget==='all'||c.attributeTarget==='enemies'&&unit.team==='enemy'||c.attributeTarget!=='enemies'&&unit.team==='hero'))unit.attributes.upsert({sourceId:'developer',modifiers:c.attributeModifiers});}
  private finishReward(p:PlayerState):void {
    p.choices=[];p.pendingSkill=undefined;p.ready=true;
    if(!this.activePlayers.every(member=>member.ready))return;
    for(const member of this.players.values())member.ready=false;
    if(this.wave===this.map.waves.length)this.phase='victory';
    else if(this.map.shopAfterWaves.includes(this.wave))this.phase='shop';
    else this.spawnWave();
  }
  private spawnWave():void {
    this.spawnRandom=this.random.save();this.spawnSerial=this.serial;
    this.stopAll();this.combat.resetEncounter();this.equipmentEffects.resetEncounter();this.enemies.reset();
    for (const [id,a] of this.actors) if (a.team==='enemy') this.actors.delete(id);
    this.wave++;this.phase='fighting';this.paused=false;this.accumulator=0;
    this.swings.length=0;this.projectiles.length=0;this.cues.length=0;
    for(const [index,p] of Array.from(this.players.values()).entries()){
      const at=levelSpawn(this.map,this.wave,index);Object.assign(p.hero,at,{previous:{...at},velocity:{x:0,y:0},attackCd:0});
      p.ready=false;p.dashStart=undefined;p.dashTime=0;p.destination=undefined;const h=p.hero;
      h.hp=this.wave===1?h.maxHp:Math.min(h.maxHp,h.hp+30);h.alive=true;h.diedAt=-1;for(const effect of h.attributeEffects)h.attributes.remove(effect.sourceId);h.attributeEffects=[];h.combatEffects=[];h.shield=0;h.shields=[];h.shieldTime=0;h.statuses=[];h.action.id=0;h.hurtAt=-1;
      for(const key of Object.keys(SKILLS) as SkillId[])p.cooldowns[key]=0;
    }
    for(const spawn of enemyPlacements(this.map,this.wave))this.spawnEnemy(spawn.enemyId,spawn.at,(enemy(spawn.enemyId).template.stats.maxHealth??1)*spawn.hpScale);
  }
  private get remainingEnemies():number {return Array.from(this.actors.values()).filter(a=>a.team==='enemy'&&a.alive).length;}
  private levelParticipants(){return Array.from(this.players.values(),p=>({id:p.id,active:p.active,alive:p.hero.alive,x:p.hero.x,y:p.hero.y}));}

  private cast(p:PlayerState,id:SkillId,point:Vec2):void {
    if(!Object.values(p.loadout).includes(id)||p.cooldowns[id]>1e-8)return;
    if(skill(id).behavior.kind==='dash'&&p.dashTime>0)return;
    this.castFrom(p.hero,id,point);
  }
  private animateAction(source:Unit,point:Vec2,kind:'attack'|'cast'):void {
    const aim=direction(source,point);if(aim.x||aim.y)source.facing=aim;source.action={id:source.action.id+1,kind,time:this.time};
  }
  private castFrom(source:Unit,id:SkillId,point:Vec2):void {
    const definition=skill(id),cost=definition.manaCost??0;if(source.skillCooldowns[id]>1e-8||source.attributes.template.resourceKind==='mana'&&source.mana<cost)return;if(source.attributes.template.resourceKind==='mana')source.mana-=cost;source.skillCooldowns[id]=source.team==='hero'&&this.developerOptions?.noCooldown?0:definition.cooldown*cooldownMultiplier(source.attributes.value);
    this.animateAction(source,point,'cast');
    executeSkill({source,point,skillId:id,combat:this.combat,actors:this.actors,
      shoot:(actor,aim,skillId,behavior,damage,multiplier)=>this.shoot(actor,aim,skillId,behavior,damage,multiplier),
      dash:(aim,length,duration)=>{const p=this.players.get(source.id);if(!p)throw new Error('Dash behavior requires a player');p.dashStart={x:source.x,y:source.y};p.dashTime=duration;p.dashSpeed=length/duration;p.dashDirection=aim;this.stopControls(p);},
      cue:cue=>this.addCue(cue)});
  }
  private step():void {
    const dt=FIXED_DT; this.tickCount++; this.time+=dt;
    for (const a of this.actors.values()) { a.previous={x:a.x,y:a.y}; a.attackCd=Math.max(0,a.attackCd-dt); a.repath-=dt; }
    for(const unit of this.actors.values())for(const key of Object.keys(SKILLS) as SkillId[])unit.skillCooldowns[key]=Math.max(0,unit.skillCooldowns[key]-dt);
    this.combat.tick(dt);
    for(const p of this.players.values())if(p.active&&p.hero.alive)this.updateHero(p,dt);
    this.enemies.step(dt,{time:this.time,actors:this.actors,players:this.activePlayers.map(p=>p.hero),collision:this.collision,combat:this.combat,freezeAI:this.developerOptions?.freezeEnemies});
    this.updateSwings(dt);this.updateProjectiles(dt);
    for (let i=this.cues.length-1;i>=0;i--) { this.cues[i]!.ttl-=dt; if(this.cues[i]!.ttl<=0) this.cues.splice(i,1); }
    // Death is resolved before wave rewards; simultaneous lethal hits cannot revive the hero.
    if(this.activePlayers.length&&!this.activePlayers.some(p=>p.hero.alive)){this.phase='defeat';this.stopAll();return;}
    if (exitProgress(this.map,this.wave,this.levelParticipants(),this.remainingEnemies).complete) {
      if(this.developerOptions)return; // Keep a cleared sandbox available for spawning and inspection.
      this.phase='reward';this.equipmentEffects.releaseAttacks();this.projectiles.length=0;this.swings.length=0;this.enemies.reset();
      this.stopAll();this.combat.zones.length=0;
      for(const p of this.players.values()){p.ready=false;p.equipment.gold+=waveGold(this.wave);p.choices=rewardChoices(this.random,p.loadout,this.combat.perksFor(p.id));}
      this.saveBoundary();
    }
  }
  private updateHero(p:PlayerState,dt:number):void {
    const h=p.hero;
    if(h.attributes.template.canMove===false){h.path=[];h.velocity={x:0,y:0};if(p.attackPoint&&h.attackCd<=0)this.attackToward(p,p.attackPoint);return;}
    if (p.dashTime>0) {
      const duration=Math.min(dt,p.dashTime); p.dashTime-=duration;
      const next=this.nav.sweep(h,{x:h.x+p.dashDirection.x*p.dashSpeed*duration,y:h.y+p.dashDirection.y*p.dashSpeed*duration},h.radius);
      h.x=next.x; h.y=next.y; this.addCue({kind:'cast',at:{...h},radius:0.5});
      if(p.dashTime<=1e-8&&p.dashStart){this.combat.dashEnded(h.id,p.dashStart,h);p.dashStart=undefined;}
      return;
    }
    if(p.direct){
      const {movement}=p.direct,speed=movementSpeed(h.attributes.value,movementMultiplier(h));
      if(movement.x||movement.y)h.facing={...movement};
      const next=this.nav.sweep(h,{x:h.x+movement.x*speed*dt,y:h.y+movement.y*speed*dt},h.radius);
      h.velocity={x:(next.x-h.x)/dt,y:(next.y-h.y)/dt};h.x=next.x;h.y=next.y;
      if(p.attackPoint&&h.attackCd<=0)this.attackToward(p,p.attackPoint);
      return;
    }
    this.move(h,movementSpeed(h.attributes.value,movementMultiplier(h)),dt);
    if(p.attackPoint&&h.attackCd<=0)this.attackToward(p,p.attackPoint);
    if (p.destination && distance(h,p.destination)<0.08) p.destination=undefined;
  }
  private stopControls(p:PlayerState):void {
    p.direct=undefined;p.attackPoint=undefined;p.destination=undefined;
    p.hero.path=[];p.hero.velocity={x:0,y:0};
  }
  /** No target IDs: direction is fixed at release; only intersecting bodies can be damaged. */
  private attackToward(p:PlayerState,point:Vec2):void {
    const h=p.hero;if(h.attributes.template.canAttack===false)return;const aim=direction(h,point);if(aim.x===0&&aim.y===0)return;
    this.animateAction(h,point,'attack');
    h.attackCd=1/h.attributes.value.attackSpeed;
    const attack=p.equipment.attack,stats=p.equipment.stats;
    const attackId=++this.serial;this.equipmentEffects.beginAttack(h.id,attackId);
    this.combat.attack(h.id,aim,attackId);
    if(attack.kind==='projectile'){
      this.projectiles.push({id:attackId,attackId,x:h.x,y:h.y,previous:{x:h.x,y:h.y},sourceId:h.id,vx:aim.x*attack.speed,vy:aim.y*attack.speed,
        remaining:stats.attackRange/attack.speed,radius:attack.radius,damage:stats.attackDamage,enemy:false,cause:'basic',appearance:attack.appearance});
    }else{
      // Cap the whole swing below the attack cadence even with future high attack-speed items.
      const scale=Math.min(1,h.attackCd/(attack.windup+attack.active));
      this.swings.push({id:attackId,attackId,sourceId:h.id,center:{x:h.x,y:h.y},facing:aim,radius:stats.attackRange,arc:attack.arc,
        age:0,windup:attack.windup*scale,active:attack.active*scale,damage:stats.attackDamage,appearance:attack.appearance,hitIds:new Set()});
    }
  }
  private updateSwings(dt:number):void {
    for(let i=this.swings.length-1;i>=0;i--){
      const swing=this.swings[i]!,source=this.actors.get(swing.sourceId),before=swing.age;swing.age+=dt;
      if(!source?.alive||(this.players.get(swing.sourceId)?.dashTime??0)>0){this.equipmentEffects.endAttack(swing.sourceId,swing.id);this.swings.splice(i,1);continue;}
      swing.center={x:source.x,y:source.y};
      if(swing.age+1e-9>=swing.windup&&before<swing.windup+swing.active){
        for(const target of this.collision.targets(this.actors.values(),source.team,{kind:'sector',center:swing.center,facing:swing.facing,radius:swing.radius,arc:swing.arc})){
          if(swing.hitIds.has(target.id))continue;swing.hitIds.add(target.id);
          this.combat.damage({sourceId:source.id,targetId:target.id,amount:swing.damage,attackId:swing.attackId,cause:'basic',damageType:'physical',area:true,delivery:'attack'});
        }
      }
      if(swing.age>=swing.windup+swing.active){this.equipmentEffects.endAttack(swing.sourceId,swing.id);this.swings.splice(i,1);}
    }
  }
  private move(unit:Unit,speed:number,dt:number):void {
    if(unit.attributes.template.canMove===false){unit.velocity={x:0,y:0};return;}
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
  private shoot(source:Actor,dir:Vec2,skillId:SkillId,b:ProjectileBehavior,damage:number,expressionMultiplier=1):void {
    this.projectiles.push({id:++this.serial,x:source.x,y:source.y,previous:{x:source.x,y:source.y},sourceId:source.id,
      vx:dir.x*b.speed,vy:dir.y*b.speed,payload:{area:false,delivery:'spell'},targetExpression:{targetMaxHealth:skill(skillId).expression?.targetMaxHealth??0,targetCurrentHealth:skill(skillId).expression?.targetCurrentHealth??0,targetMissingHealth:skill(skillId).expression?.targetMissingHealth??0},targetExpressionMultiplier:expressionMultiplier,expressionCap:skill(skillId).expression?.cap===undefined?undefined:skill(skillId).expression!.cap!*expressionMultiplier,remaining:b.range/b.speed,radius:b.radius,damage,enemy:source.team==='enemy',cause:source.team==='enemy'?'enemy':'skill',skillId,appearance:skill(skillId).appearance,onHit:b.onHit});
  }
  private shootAugment(source:Actor,dir:Vec2,effect:MissileEffect,damage:number):void {
    if(this.projectiles.length>=256)return;
    this.projectiles.push({id:++this.serial,x:source.x,y:source.y,previous:{x:source.x,y:source.y},sourceId:source.id,
      vx:dir.x*effect.speed,vy:dir.y*effect.speed,remaining:effect.range/effect.speed,radius:effect.radius,damage,enemy:source.team==='enemy',cause:'augment',appearance:effect.appearance,
      payload:{proc:true,appliesOnHit:effect.appliesOnHit,damageType:effect.damageType??'magic',delivery:'proc'},
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
        this.combat.damage({sourceId:p.sourceId,targetId:impact.actor.id,amount:Math.min(p.expressionCap??Infinity,(p.damage+hpDamage+(p.targetExpression?evaluate(p.targetExpression,this.actors.get(p.sourceId)!,impact.actor)*(p.targetExpressionMultiplier??1):0))*scale),attackId:p.attackId,damageSourceTeam:p.enemy?'enemy':'hero',cause:p.cause,skillId:p.skillId,damageType:p.skillId?skill(p.skillId).damageType:undefined,...p.payload});
      }
      if(impact||p.remaining<=1e-9){if(p.attackId!==undefined)this.equipmentEffects.endAttack(p.sourceId,p.attackId);this.projectiles.splice(i,1);}
    }
  }
  private addCue(cue:CombatCue):void {
    if(cue.kind==='damage'&&cue.actorId){const unit=this.actors.get(cue.actorId);if(unit){unit.hurtAt=this.time;if(unit.hp<=0&&unit.diedAt<0)unit.diedAt=this.time;}}
    const duration=cue.kind==='damage'||cue.kind==='heal'?0.8:0.45;
    this.cues.push({...cue,at:{x:cue.at.x,y:cue.at.y},to:cue.to?{x:cue.to.x,y:cue.to.y}:undefined,id:++this.serial,ttl:duration,duration});
    if(this.cues.length>192) this.cues.shift();
  }
  private validPoint(p:Vec2):boolean { return Number.isFinite(p.x)&&Number.isFinite(p.y); }
  private perkMultiplier(stat:'speedMultiplier'|'attackMultiplier',id:string):number {
    return PERKS.reduce((value,definition)=>{const p:PerkDefinition=definition;return value*(this.combat.perksFor(id).has(definition.id)?p[stat]??1:1);},1);
  }
}
