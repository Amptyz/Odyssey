import type {Actor,Hit} from '../combat-core/types';
import {CombatEngine} from '../combat-core/CombatEngine';
import {CollisionWorld,overlaps,type HitShape} from '../combat-core/CollisionWorld';
import {evaluate,movementSpeed,cooldownMultiplier} from '../combat-core/attributes/AttributeSet';
import {groundSpeedScale} from '../utils/GroundMovement';
import {applyStatus,movementMultiplier} from '../combat-core/StatusSystem';
import {enemy,type EnemyKind} from '../content/enemies';
import {ENEMY_ACTIONS,ENEMY_ACTION_SETS,type EnemyActionDefinition,type EnemyActionStep} from '../content/enemy-actions';
import {ENEMY_BEHAVIORS,type EnemyBehaviorDefinition,type EnemyTargetPolicy,type EnemyDecisionRule} from '../content/enemy-behaviors';
import {EnemyDecision,type CooldownTicket} from '../ai/EnemyDecision';
import {projectileSpeed} from '../content/tuning';
import type {MapDefinition} from '../content/maps';
import {PathfinderPool} from '../ai/Pathfinder';
import {direction,distance,type Vec2} from '../utils/math';

export interface EnemyUnit extends Actor {kind:'hero'|EnemyKind;previous:Vec2;velocity:Vec2;path:Vec2[];repath:number;windup:number;attackWindup:number;attackCd:number;aim:Vec2;facing:Vec2;action:{id:number;kind:'attack'|'cast';time:number};hurtAt:number;diedAt:number}
export interface EnemyContext {time:number;actors:ReadonlyMap<string,EnemyUnit>;players:readonly Actor[];collision:CollisionWorld;combat:Pick<CombatEngine,'damage'|'attack'>;freezeAI?:boolean}
export interface EnemyDecisionSnapshot {profile:string;targetId?:string;actionTargetId?:string;targetReason:string;reason:string;ruleId?:string;sequence?:{id:string;step:number;waitRemaining:number};pauseRemaining:number;cooldowns:{key:string;remaining:number}[]}
export interface EnemyPose {id:string;kind:EnemyKind;state:'idle'|'walk'|'windup'|'attack'|'recover'|'transition'|'broken'|'death';actionId?:string;age:number;windup:number;duration:number;strike:number;phase:1|2;facing:1|-1;awake:boolean;decision?:EnemyDecisionSnapshot}
export interface EnemyWarning {id:number;sourceId:string;actionId:string;shape:HitShape;createdAt:number;triggerAt:number;expiresAt:number;damageType:Hit['damageType'];colour:string;segment:number;contours?:Vec2[][]}
export interface EnemyBulletSnapshot extends Vec2 {id:number;sourceId:string;previous:Vec2;radius:number;colour:string;damageType:Hit['damageType']}
export interface EnemySnapshot {units:EnemyPose[];warnings:EnemyWarning[];projectiles:EnemyBulletSnapshot[]}
interface StepState {definition:EnemyActionStep;shape?:HitShape;direction?:Vec2;sampled:boolean;fired:boolean;hit:Set<string>;amount:number;dashMoved:number}
interface ActionState {id:number;definition:EnemyActionDefinition;start:number;origin:Vec2;aim:Vec2;targetId:string;duration:number;windup:number;steps:StepState[];counts:Map<string,number>;sign:number;damageSampled:boolean;cooldown:CooldownTicket;impactStarted:boolean;targeting:EnemyTargetPolicy}
interface State {awake:boolean;anchor:Vec2;born:number;lastHp:number;phase:1|2;transitionUntil:number;brokenUntil:number;phaseEpoch:number;slot:number;nextAttack:number;current?:ActionState;brain:EnemyDecision;controlRequests:{time:number;rootId:number}[];breakReady:number;castCounts:Map<string,number>;leashing:boolean;usedSkills:Set<string>}
interface Bullet extends EnemyBulletSnapshot {team:Actor['team'];vx:number;vy:number;remaining:number;amount:number;rootId:number;delivery:'attack'|'spell';slow?:{power:number;duration:number};counts:Map<string,number>;maxHits:number}
const point=(v:Vec2):Vec2=>({x:v.x,y:v.y});
const rotate=(v:Vec2,a:number):Vec2=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)});
export function copyHitShape(s:HitShape):HitShape {if(s.kind==='capsule')return {...s,center:point(s.center),end:point(s.end)};if(s.kind==='sector'||s.kind==='rectangle')return {...s,center:point(s.center),facing:point(s.facing)};return {...s,center:point(s.center)};}
/** Pure deterministic enemy scheduler. Owns enemy actions/projectiles; all hits use the shared combat engine. */
export class EnemySystem {
 readonly navigation:PathfinderPool;
 private readonly states=new Map<string,State>();
 private readonly warnings:EnemyWarning[]=[];
 private readonly bullets:Bullet[]=[];
 private readonly pathTimes=new Map<string,number>();
 private serial=0;private latestTime=0;
  constructor(readonly map:MapDefinition,readonly profiles:Readonly<Record<string,EnemyBehaviorDefinition>>=ENEMY_BEHAVIORS,readonly actions:Readonly<Record<string,EnemyActionDefinition>>=ENEMY_ACTIONS){this.navigation=new PathfinderPool(map);}
 reset():void {this.states.clear();this.lastKinds.clear();this.pathTimes.clear();this.warnings.length=0;this.bullets.length=0;}
 /** Called by a future hard-control ability, not by visual hurt feedback. Bosses use the explicit two-hit break rule. */
 interrupt(id:string,time:number,kind:'stun'|'root'|'silence'|'displace',rootId:number):boolean {
  const s=this.states.get(id);if(!s?.current)return false;
  const def=enemy((this.lastKinds.get(id))!);
  if(def.category==='boss'){
   if(time<s.breakReady)return false;
   s.controlRequests=s.controlRequests.filter(r=>time-r.time<=3);
   if(!s.controlRequests.some(r=>r.rootId===rootId)&&(!s.controlRequests.length||time-s.controlRequests[s.controlRequests.length-1]!.time>=.2))s.controlRequests.push({time,rootId});
   if(s.controlRequests.length<2)return false;s.controlRequests=[];s.breakReady=time+12;s.brokenUntil=time+1;
  }else if(kind==='silence'&&s.current.definition.kind!=='spell')return false;
   this.cancel(id,s,time);return true;
 }
 private readonly lastKinds=new Map<string,EnemyKind>();
 step(dt:number,ctx:EnemyContext):void {
  if(!(dt>0)||!Number.isFinite(dt))return;this.latestTime=ctx.time;
  const units=Array.from(ctx.actors.values()).filter(e=>e.team==='enemy').sort((a,b)=>a.id.localeCompare(b.id));
  const present=new Set(units.map(e=>e.id));
  for(const [id,s] of Array.from(this.states))if(!present.has(id)){this.cancel(id,s);this.states.delete(id);this.lastKinds.delete(id);this.pathTimes.delete(id);}
  for(const e of units){
   const cfg=enemy(e.kind as EnemyKind),set=ENEMY_ACTION_SETS[cfg.actionSet]!;this.lastKinds.set(e.id,e.kind as EnemyKind);
    const profile=this.profiles[cfg.ai??cfg.actionSet]!;
    let s=this.states.get(e.id);if(!s){s={awake:false,anchor:point(e),born:ctx.time,lastHp:e.hp,phase:1,transitionUntil:0,brokenUntil:0,phaseEpoch:ctx.time,slot:0,nextAttack:0,brain:new EnemyDecision(),controlRequests:[],breakReady:0,castCounts:new Map(),leashing:false,usedSkills:new Set()};this.states.set(e.id,s);}
    e.velocity={x:0,y:0};
   if(!e.alive){this.cancel(e.id,s);e.velocity={x:0,y:0};e.windup=0;continue;}
   const players=ctx.players.filter(p=>p.alive);
   const nearest=players.slice().sort((a,b)=>distance(e,a)-distance(e,b)||a.id.localeCompare(b.id))[0];
   if(!nearest){e.velocity={x:0,y:0};continue;}
   if(!s.awake&&(distance(e,nearest)<=(cfg.category==='boss'?12:10)||e.hp<s.lastHp)){
    s.awake=true;s.born=ctx.time;s.phaseEpoch=ctx.time;s.nextAttack=ctx.time+(cfg.category==='boss'?2:.4);
     const configured=new Set([...set.skills,...profile.rules.flatMap(r=>r.action?[r.action]:[]),...Object.values(profile.sequences??{}).flatMap(steps=>steps.flatMap(st=>st.kind==='action'?[st.action]:[]))]);
     for(const id of configured)s.brain.readyTimes.set(`action:${id}`,Math.max(s.brain.readyTimes.get(`action:${id}`)??0,ctx.time+this.actions[id]!.firstDelay));
   }
   s.lastHp=e.hp;if(!s.awake){e.velocity={x:0,y:0};continue;}
   if(s.current){this.advance(e,s,dt,ctx);continue;}
   e.windup=0;
    if(cfg.boss&&s.phase===1&&e.hp/e.maxHp<=cfg.boss.threshold){s.phase=2;s.transitionUntil=ctx.time+2;s.phaseEpoch=ctx.time+2;s.slot=0;s.controlRequests=[];s.brain.abandon();for(const id of set.skills)if(!s.usedSkills.has(id))s.brain.readyTimes.set(`action:${id}`,s.phaseEpoch);e.path=[];e.windup=0;e.velocity={x:0,y:0};continue;}
    if(ctx.time<s.transitionUntil||ctx.time<s.brokenUntil||ctx.freezeAI){s.brain.reason=ctx.freezeAI?'frozen':ctx.time<s.transitionUntil?'transition':'broken';e.velocity={x:0,y:0};e.windup=0;continue;}
   // Groups guard their authored area. Aggro does not pull an entire large map into the entrance.
   if(distance(e,s.anchor)>18||distance(e,nearest)>22)s.leashing=true;
    if(s.leashing){s.brain.abandon();s.brain.targetId=undefined;s.brain.reason='returning';this.move(e,s.anchor,dt,1);if(distance(e,s.anchor)<.7){s.leashing=false;s.awake=false;}continue;}
    const pursuit=s.brain.pick(e,players,profile.targeting,ctx.time)??nearest;
    if(ctx.time+1e-8<s.brain.pauseUntil){s.brain.reason='pause';if(s.brain.pauseMovement==='chase')this.move(e,pursuit,dt,.5);continue;}
    if(s.brain.sequence&&this.advanceSequence(e,s,profile,dt,ctx))continue;
    let timelineWaiting=false;
    if(cfg.boss){const loop=cfg.boss,slots=s.phase===1?loop.phase1:loop.phase2;
    let age=ctx.time-s.phaseEpoch;if(age>=loop.loop){s.phaseEpoch+=Math.floor(age/loop.loop)*loop.loop;s.slot=0;age=ctx.time-s.phaseEpoch;}
     const slot=slots[s.slot];if(slot&&age>=slot.at){const candidate=this.actions[slot.action]!,policy=profile.timeline?.targeting??{strategy:'leastTargeted' as const};
      const target=this.targetFor(e,s,candidate,ctx,policy);
      if(target){s.brain.ruleId=`timeline:${s.slot}`;s.slot++;this.start(e,s,candidate,target,ctx,policy);continue;}
      if(profile.timeline?.unavailable==='wait'&&age-slot.at<(profile.timeline.timeout??2))timelineWaiting=true;
      else s.slot++;}
   }
    if(!timelineWaiting&&this.decide(e,s,profile,dt,ctx))continue;
    s.brain.select(pursuit,ctx.time,'pursuit');
    let goal:Vec2=pursuit;
    if(cfg.keepDistance&&distance(e,pursuit)<cfg.keepDistance){const away=direction(pursuit,e);goal={x:e.x+away.x*2,y:e.y+away.y*2};}
    else if(distance(e,pursuit)<=e.attributes.value.attackRange){
     if(cfg.strafe){const tangent=rotate(direction(e,pursuit),Math.PI/2*(Math.floor(ctx.time)%2?1:-1));goal={x:e.x+tangent.x*cfg.strafe,y:e.y+tangent.y*cfg.strafe};}
    else {e.velocity={x:0,y:0};continue;}
   }
   this.move(e,goal,dt,1);
  }
  this.updateBullets(dt,ctx);
  for(let i=this.warnings.length-1;i>=0;i--)if(this.warnings[i]!.expiresAt<ctx.time)this.warnings.splice(i,1);
 }
  private targetFor(e:EnemyUnit,s:State,a:EnemyActionDefinition,ctx:EnemyContext,policy:EnemyTargetPolicy,force=false,condition?:EnemyDecisionRule['when']):Actor|undefined {
   const target=s.brain.pick(e,ctx.players,policy,ctx.time,p=>!this.blockReason(e,p,a,s,ctx)&&s.brain.matches(condition,e,p,s.phase,ctx.players.filter(p=>p.alive).length),force);
   if(!target){const closest=ctx.players.filter(p=>p.alive).sort((a,b)=>distance(e,a)-distance(e,b)||a.id.localeCompare(b.id))[0];s.brain.reason=`blocked:${closest?this.blockReason(e,closest,a,s,ctx)??'target-policy-or-condition':'no-target'}`;}
   return target;
  }
  private reserve(e:EnemyUnit,s:State,ctx:EnemyContext,before:EnemyDecisionRule):number {
   const cfg=enemy(e.kind as EnemyKind),profile=this.profiles[cfg.ai??cfg.actionSet]!;
   if(cfg.boss)return ((s.phase===1?cfg.boss.phase1:cfg.boss.phase2)[s.slot]?.at??cfg.boss.loop)+s.phaseEpoch;
   const times:number[]=[];
   for(const rule of profile.rules){
    if(rule.priority<before.priority||rule.priority===before.priority&&profile.rules.indexOf(rule)>=profile.rules.indexOf(before))continue;
    if(rule.once&&s.brain.usedRules.has(rule.id))continue;
    const first=profile.sequences?.[rule.sequence??'']?.find(st=>st.kind==='action');
    const a=this.actions[rule.action??(first?.kind==='action'?first.action:'')];if(!a||a.kind!=='spell')continue;
    const target=s.brain.pick(e,ctx.players,rule.targeting??profile.targeting,ctx.time,p=>!this.blockReason(e,p,a,s,ctx,true)&&s.brain.matches(rule.when,e,p,s.phase,ctx.players.filter(p=>p.alive).length));
    if(!target)continue;
    const keys=[`action:${a.id}`,'global',`target:${a.id}:${target.id}`,...(a.cooldownPolicy?.group?[`group:${a.cooldownPolicy.group.id}`]:[])];
    times.push(Math.max(s.brain.ruleReadyTimes.get(rule.id)??0,...keys.map(key=>s.brain.readyTimes.get(key)??0)));
   }
   return Math.min(Infinity,...times);
  }
  private decide(e:EnemyUnit,s:State,profile:EnemyBehaviorDefinition,dt:number,ctx:EnemyContext):boolean {
   s.brain.reason='no-rule';
   // Stable sort preserves declaration order for equal priorities. Checking a rule never consumes its cooldown.
   for(const rule of profile.rules.map((rule,index)=>({rule,index})).sort((a,b)=>b.rule.priority-a.rule.priority||a.index-b.index).map(p=>p.rule)){
    if(rule.once&&s.brain.usedRules.has(rule.id))continue;
    if((s.brain.ruleReadyTimes.get(rule.id)??0)>ctx.time+1e-8){s.brain.reason=`blocked:rule:${rule.id}`;continue;}
    const first=profile.sequences?.[rule.sequence??'']?.find(step=>step.kind==='action');
    const action=rule.action?this.actions[rule.action]:first?.kind==='action'?this.actions[first.action]:undefined;
    if(!action)continue;
    const policy=rule.targeting??profile.targeting;
    const target=this.targetFor(e,s,action,ctx,policy,false,rule.when);if(!target)continue;
    if(action.kind==='attack'&&ctx.time+1/e.attributes.value.attackSpeed>=this.reserve(e,s,ctx,rule)-.05){s.brain.reason='reserved-for-skill';continue;}
    const cfg=enemy(e.kind as EnemyKind);
    if(action.kind==='attack'&&action.steps.some(st=>st.shape.kind==='projectile')&&cfg.keepDistance&&distance(e,target)<=Math.min(2,cfg.keepDistance)){s.brain.reason='too-close';continue;}
    s.brain.ruleId=rule.id;s.brain.usedRules.add(rule.id);s.brain.ruleReadyTimes.set(rule.id,ctx.time+(rule.cooldown??0));
    if(rule.sequence){s.brain.sequence={id:rule.sequence,index:0,enteredAt:ctx.time,waitingAction:false,policy:rule.targeting};return this.advanceSequence(e,s,profile,dt,ctx);}
    this.start(e,s,action,target,ctx,policy);return true;
   }
   return false;
  }
  private advanceSequence(e:EnemyUnit,s:State,profile:EnemyBehaviorDefinition,dt:number,ctx:EnemyContext):boolean {
   const q=s.brain.sequence!,steps=profile.sequences![q.id]!;
   // No recursive sequences: at most 32 zero-duration configuration steps can be visited in one tick.
   for(let visits=0;visits<=steps.length;visits++){
    const step=steps[q.index];
    if(!step){s.brain.sequence=undefined;s.brain.boundary(q.policy??profile.targeting,'sequenceEnd');s.brain.reason='sequence-end';return true;}
    if(step.kind==='target'){q.policy=step.policy;q.forceTarget=true;q.index++;q.enteredAt=ctx.time;continue;}
    if(step.kind==='wait'){
     if(ctx.time-q.enteredAt+1e-8>=step.seconds){q.index++;q.enteredAt=ctx.time;continue;}
     s.brain.reason='sequence-wait';if(step.movement==='chase'){const target=ctx.players.find(p=>p.alive&&p.id===s.brain.targetId);if(target)this.move(e,target,dt,1);}return true;
    }
    const action=this.actions[step.action]!,target=this.targetFor(e,s,action,ctx,q.policy??profile.targeting,q.forceTarget);
    if(target){q.waitingAction=true;q.forceTarget=false;this.start(e,s,action,target,ctx,q.policy??profile.targeting);return true;}
    const timedOut=ctx.time-q.enteredAt+1e-8>=(step.timeout??2),response=step.unavailable??'wait';
    const outcome=response==='wait'?(timedOut?step.afterTimeout??'abort':'wait'):response;
    if(outcome==='wait')return true;
    if(outcome==='skip'){q.index++;q.enteredAt=ctx.time;continue;}
    s.brain.sequence=undefined;s.brain.boundary(q.policy??profile.targeting,'sequenceEnd');s.brain.reason='sequence-aborted';return true;
   }
   return true;
  }
  private blockReason(e:EnemyUnit,target:Actor,a:EnemyActionDefinition,s:State,ctx:EnemyContext,ignoreCooldown=false):string|undefined {
   if(!target.alive)return 'dead-target';
   if(e.attributes.template.canAttack===false)return 'cannot-attack';
   if(!ignoreCooldown){const cd=s.brain.block(a.id,target.id,a.cooldownPolicy?.group?.id,ctx.time);if(cd)return cd;
    if(a.kind==='attack'&&ctx.time+1e-8<s.nextAttack)return 'attack-delay';}
   const d=distance(e,target);if(d>a.range+target.radius||d<(a.minimumRange??0))return 'range';
   if(ctx.collision.blocker(e,target,.02)!==undefined)return 'line-of-sight';
   const margin=a.edgeMargin;if(margin){const centre=a.steps[0]?.location==='target'?target:e;if(centre.x<margin||centre.y<margin||centre.x>this.map.width-margin||centre.y>this.map.height-margin)return 'map-edge';}
  const remote=a.steps.some(step=>step.shape.kind==='projectile'||step.location==='target');
   if(remote&&new Set(this.warnings.filter(w=>w.triggerAt>ctx.time&&w.sourceId!==e.id).map(w=>w.sourceId)).size>=3)return 'warning-budget';
  if(a.kind==='spell'){
   const active=this.warnings.filter(w=>w.triggerAt>ctx.time);
    if(active.filter(w=>w.sourceId!==e.id).length>=3)return 'warning-budget';
   // Reject an unavoidable self-centred blast, including obstacle-constrained escape routes.
   for(const st of a.steps){if(st.shape.kind!=='circle'&&st.shape.kind!=='ring')continue;
    const centre=st.location==='target'?point(target):point(e),shape:HitShape=st.shape.kind==='circle'?{kind:'circle',center:centre,radius:st.shape.radius}:{kind:'ring',center:centre,radius:st.shape.radius,innerRadius:st.shape.innerRadius};
     if(!this.hasEscape(target,shape,st.at,ctx))return 'no-escape';
   }
  }
   return undefined;
 }
 private hasEscape(target:Actor,shape:HitShape,delay:number,ctx:EnemyContext):boolean {
  const nav=this.navigation.forRadius(target.radius),reach=Math.max(0,delay-.35)*movementSpeed(target.attributes.value,movementMultiplier(target));
  if(!overlaps(shape,target))return true;
  for(const length of [reach*.5,reach])for(let i=0;i<16;i++){
   const a=i*Math.PI/8,dir={x:Math.cos(a),y:Math.sin(a)},travel=length*groundSpeedScale(dir),p={x:target.x+dir.x*travel,y:target.y+dir.y*travel};
   if(nav.walkable(p)&&nav.clear(target,p)&&!overlaps(shape,{...p,radius:target.radius})&&ctx.collision.blocker(target,p,target.radius)===undefined)return true;
  }
  return false;
 }
 private start(e:EnemyUnit,s:State,a:EnemyActionDefinition,target:Actor,ctx:EnemyContext,targeting:EnemyTargetPolicy):void {
  const ratio=a.kind==='attack'?Math.min(1,e.attributes.template.baseAttackSpeed/e.attributes.value.attackSpeed):1;
  const windup=a.windup*ratio,duration=a.kind==='attack'?1/e.attributes.value.attackSpeed:s.phase===2&&a.phase2Duration?a.phase2Duration:a.windup+a.recovery;
  const steps=(s.phase===2&&a.phase2?a.phase2:a.steps).map(st=>({definition:{...st,at:st.at*(a.kind==='attack'?ratio:1),sampleAt:(st.sampleAt??0)*(a.kind==='attack'?ratio:1)},sampled:false,fired:false,hit:new Set<string>(),amount:evaluate(st.expression,e),dashMoved:0}));
   const cfg=enemy(e.kind as EnemyKind),profile=this.profiles[cfg.ai??cfg.actionSet]!;
   const cd=a.kind==='attack'?Math.max(duration,a.cooldownPolicy?.seconds??0):(a.cooldownPolicy?.seconds??a.cooldown)*(a.cooldownPolicy?.affectedByHaste===false?1:cooldownMultiplier(e.attributes.value));
   const cooldown=s.brain.ticket(a.id,target.id,a.cooldownPolicy,cd,profile.globalCooldown??0);
   const c:ActionState={id:++this.serial,definition:a,start:ctx.time,origin:point(e),aim:point(target),targetId:target.id,duration,windup,steps,counts:new Map(),sign:(s.castCounts.get(a.id)??0)%2?-1:1,damageSampled:a.kind==='spell',cooldown,impactStarted:false,targeting};
   s.castCounts.set(a.id,(s.castCounts.get(a.id)??0)+1);s.current=c;if(a.kind==='spell')s.usedSkills.add(a.id);
   s.brain.actionStarted(target,ctx.time,s.brain.sequence?'sequence':s.brain.ruleId?.startsWith('timeline:')?'timeline':'rule');s.brain.reason='windup';
   s.brain.commit(cooldown,'start',ctx.time);
  e.windup=windup;e.attackWindup=windup;e.attackCd=duration;e.aim=point(target);e.facing=direction(e,target);e.velocity={x:0,y:0};e.path=[];
  e.action={id:e.action.id+1,kind:a.kind==='attack'?'attack':'cast',time:ctx.time+windup};
  for(const st of c.steps)if((st.definition.sampleAt??0)===0)this.sample(e,c,st,ctx);
 }
 private sample(e:EnemyUnit,c:ActionState,st:StepState,ctx:EnemyContext):void {
  const def=st.definition,target=ctx.players.find(p=>p.id===c.targetId);
  const centre=def.location==='target'?((def.sampleAt??0)>0&&target?.alive?point(target):point(c.aim)):point(c.origin);
  // Direction remains locked at action start, including late releases and sequential slashes.
  const dir=rotate(direction(c.origin,c.aim),(def.angle??0)*c.sign),shape=def.shape;st.direction=dir;st.sampled=true;
  if(shape.kind==='projectile'){const end={x:centre.x+dir.x*shape.range,y:centre.y+dir.y*shape.range};st.shape={kind:'rectangle',center:centre,facing:dir,length:shape.range*(ctx.collision.blocker(centre,end,shape.radius)??1),width:shape.radius*2};}
  else if(shape.kind==='dash'){const end={x:centre.x+dir.x*shape.length,y:centre.y+dir.y*shape.length},t=ctx.collision.blocker(centre,end,this.navigation.forRadius(e.radius).radius)??1;st.shape={kind:'capsule',center:centre,end:{x:centre.x+(end.x-centre.x)*t,y:centre.y+(end.y-centre.y)*t},radius:shape.radius};}
  else if(shape.kind==='sector')st.shape={...shape,center:centre,facing:dir};
  else if(shape.kind==='rectangle'){
   const end={x:centre.x+dir.x*shape.length,y:centre.y+dir.y*shape.length},wall=ctx.collision.blocker(centre,end,shape.width/2);
   st.shape={...shape,center:centre,facing:dir,length:shape.length*(wall??1)};
  }else st.shape={...shape,center:centre};
  if(shape.kind==='projectile'&&shape.spread){for(const angle of shape.spread){const facing=rotate(dir,angle),end={x:centre.x+facing.x*shape.range,y:centre.y+facing.y*shape.range};this.warn(e,c,st,{kind:'rectangle',center:centre,facing,length:shape.range*(ctx.collision.blocker(centre,end,shape.radius)??1),width:shape.radius*2},ctx);}}
  else this.warn(e,c,st,st.shape,ctx);
 }
 private warn(e:EnemyUnit,c:ActionState,st:StepState,shape:HitShape,ctx:EnemyContext):void {
  const contours=this.warningContours(shape,ctx.collision);
  this.warnings.push({contours,id:++this.serial,sourceId:e.id,actionId:c.definition.id,shape:copyHitShape(shape),createdAt:ctx.time,triggerAt:c.start+st.definition.at,expiresAt:c.start+st.definition.at+(st.definition.active??.15),damageType:st.definition.damageType,colour:c.definition.colour,segment:c.steps.indexOf(st)});
 }
 private warningContours(shape:HitShape,collision:CollisionWorld):Vec2[][]|undefined {
  if(shape.kind!=='circle'&&shape.kind!=='sector'&&shape.kind!=='ring')return undefined;
  const start=shape.kind==='sector'?Math.atan2(shape.facing.y,shape.facing.x)-shape.arc/2:0,arc=shape.kind==='sector'?shape.arc:Math.PI*2,count=Math.max(16,Math.ceil(arc*20));
  const rays=Array.from({length:count+1},(_,i)=>{const angle=start+arc*i/count,end={x:shape.center.x+Math.cos(angle)*shape.radius,y:shape.center.y+Math.sin(angle)*shape.radius},t=collision.blocker(shape.center,end)??1;return {angle,length:shape.radius*t,point:{x:shape.center.x+(end.x-shape.center.x)*t,y:shape.center.y+(end.y-shape.center.y)*t}};});
  if(shape.kind!=='ring')return [shape.kind==='sector'?[point(shape.center),...rays.map(r=>r.point)]:rays.map(r=>r.point)];
  const outer:Vec2[][]=[],inner:Vec2[][]=[];let out:Vec2[]=[],inside:Vec2[]=[];
  for(const ray of rays){if(ray.length<shape.innerRadius){if(out.length>1){outer.push(out);inner.push(inside);}out=[];inside=[];continue;}out.push(ray.point);inside.push({x:shape.center.x+Math.cos(ray.angle)*shape.innerRadius,y:shape.center.y+Math.sin(ray.angle)*shape.innerRadius});}
  if(out.length>1){outer.push(out);inner.push(inside);}return [...outer,...inner];
 }
 private advance(e:EnemyUnit,s:State,dt:number,ctx:EnemyContext):void {
  const c=s.current!,age=ctx.time-c.start;e.windup=Math.max(0,c.windup-age);e.velocity={x:0,y:0};
   s.brain.reason=age<c.windup?'windup':'executing';
  for(const st of c.steps){const spec=st.definition;if(!st.sampled&&age+1e-8>=(spec.sampleAt??0))this.sample(e,c,st,ctx);
   if(!st.sampled||age+1e-8<spec.at)continue;
   if(!c.impactStarted){c.impactStarted=true;s.brain.commit(c.cooldown,'impact',ctx.time);}
   if(!c.damageSampled){for(const part of c.steps)part.amount=evaluate(part.definition.expression,e);c.damageSampled=true;ctx.combat.attack(e.id,direction(c.origin,c.aim));}
   if(spec.shape.kind==='dash'){
    if(st.fired)continue;const nav=this.navigation.forRadius(e.radius),travel=Math.min(spec.shape.length-st.dashMoved,spec.shape.speed*dt),dir=st.direction!,from=point(e),to=nav.sweep(from,{x:e.x+dir.x*travel,y:e.y+dir.y*travel});
    const actual=distance(from,to);st.dashMoved+=actual;e.x=to.x;e.y=to.y;e.velocity={x:dir.x*actual/dt,y:dir.y*actual/dt};
    this.hitShape(e,c,st,{kind:'capsule',center:from,end:to,radius:spec.shape.radius},ctx);
    if(actual<travel-.001||st.dashMoved>=spec.shape.length-.001){st.fired=true;if(actual<travel-.001){c.duration=Math.max(c.duration,age+1.8);s.nextAttack=Math.max(s.nextAttack,c.start+c.duration);}}continue;
   }
   if(spec.shape.kind==='projectile'){
    if(st.fired)continue;st.fired=true;const shape=spec.shape,speed=projectileSpeed(shape.speed);
    for(const angle of shape.spread??[0]){if(this.bullets.length>=256)break;const dir=rotate(st.direction!,angle),origin=st.shape!.center;this.bullets.push({id:++this.serial,sourceId:e.id,team:e.team,x:origin.x,y:origin.y,previous:point(origin),radius:shape.radius,colour:c.definition.colour,damageType:spec.damageType,vx:dir.x*speed,vy:dir.y*speed,remaining:shape.range/speed,amount:st.amount,rootId:-c.id,delivery:c.definition.kind,slow:spec.slow,counts:c.counts,maxHits:c.definition.maxHits??1});}continue;
   }
   if(!st.fired||age<=spec.at+(spec.active??0)+1e-8)this.hitShape(e,c,st,st.shape!,ctx);
   if(age+1e-8>=spec.at+(spec.active??0))st.fired=true;
  }
  const endOfStrike=Math.max(...c.steps.map(st=>st.definition.at+(st.definition.active??0)));
   if(age>endOfStrike+.05){s.brain.reason='recovery';
    if((c.definition.recoveryMovement??(c.definition.kind==='attack'?'chase':'stop'))==='chase'&&!ctx.freezeAI){const target=ctx.players.find(p=>p.id===c.targetId&&p.alive);if(target&&distance(e,target)>e.attributes.value.attackRange)this.move(e,target,dt,.5);}}
   if(age+1e-8>=c.duration&&c.steps.every(st=>st.fired)){
    s.brain.commit(c.cooldown,'end',ctx.time);s.current=undefined;e.windup=0;
    s.brain.pauseUntil=ctx.time+(c.definition.pauseAfter??0);s.brain.pauseMovement=c.definition.pauseMovement??'stop';
    s.brain.boundary(c.targeting,'actionEnd');
    if(s.brain.sequence?.waitingAction){s.brain.sequence.waitingAction=false;s.brain.sequence.index++;s.brain.sequence.enteredAt=ctx.time;}
   }
 }
 private hitShape(e:EnemyUnit,c:ActionState,st:StepState,shape:HitShape,ctx:EnemyContext):void {
  for(const target of ctx.collision.targets(ctx.actors.values(),e.team,shape)){
   if(st.hit.has(target.id)||(c.counts.get(target.id)??0)>=(c.definition.maxHits??c.steps.length))continue;
   st.hit.add(target.id);c.counts.set(target.id,(c.counts.get(target.id)??0)+1);
   ctx.combat.damage({sourceId:e.id,targetId:target.id,amount:st.amount,cause:c.definition.kind==='attack'?'basic':'enemy',damageType:st.definition.damageType,delivery:c.definition.kind,canCrit:c.definition.kind==='attack',area:true,rootId:-c.id,tags:['enemy',c.definition.id],appliesOnHit:c.definition.kind==='attack'});
   if(st.definition.slow&&target.alive)applyStatus(target,{id:'slow',...st.definition.slow},e.id);
  }
 }
 private updateBullets(dt:number,ctx:EnemyContext):void {
  for(let i=this.bullets.length-1;i>=0;i--){const b=this.bullets[i]!;
   const travel=Math.min(dt,b.remaining),from=point(b),to={x:b.x+b.vx*travel,y:b.y+b.vy*travel};b.previous=from;
   const hit=ctx.collision.firstImpact(ctx.actors.values(),b.team,from,to,b.radius,travel/dt),t=hit?.t??1;b.x=from.x+(to.x-from.x)*t;b.y=from.y+(to.y-from.y)*t;b.remaining-=travel;
   if(hit?.actor&&(b.counts.get(hit.actor.id)??0)<b.maxHits){b.counts.set(hit.actor.id,(b.counts.get(hit.actor.id)??0)+1);ctx.combat.damage({sourceId:b.sourceId,damageSourceTeam:b.team,targetId:hit.actor.id,amount:b.amount,cause:b.delivery==='attack'?'basic':'enemy',damageType:b.damageType,delivery:b.delivery,area:false,canCrit:b.delivery==='attack',rootId:b.rootId,tags:['enemy','projectile'],appliesOnHit:b.delivery==='attack'});if(b.slow&&hit.actor.alive)applyStatus(hit.actor,{id:'slow',...b.slow},b.sourceId);}
   if(hit||b.remaining<=1e-8)this.bullets.splice(i,1);
  }
 }
 private move(e:EnemyUnit,goal:Vec2,dt:number,scale:number):void {
  if(e.attributes.template.canMove===false)return;const nav=this.navigation.forRadius(e.radius);
  if(this.latestTime>=(this.pathTimes.get(e.id)??0)||!e.path.length){e.path=nav.find(e,goal);this.pathTimes.set(e.id,this.latestTime+.55);}
  while(e.path.length&&distance(e,e.path[0]!)<.08)e.path.shift();const next=e.path[0];if(!next){e.velocity={x:0,y:0};return;}
  // Keep endpoints valid for the same conservative radius used by path finding.
  const dir=direction(e,next),travel=Math.min(distance(e,next),movementSpeed(e.attributes.value,movementMultiplier(e))*groundSpeedScale(dir)*dt*scale),to=nav.sweep(e,{x:e.x+dir.x*travel,y:e.y+dir.y*travel}),dx=to.x-e.x,dy=to.y-e.y;
  e.x=to.x;e.y=to.y;e.velocity={x:dx/dt,y:dy/dt};e.facing=dir;if(Math.hypot(dx,dy)<.001)this.pathTimes.set(e.id,0);
 }
  private cancel(id:string,s:State,time=this.latestTime):void {if(s.current)s.brain.interrupted(s.current.cooldown,time);s.current=undefined;s.brain.abandon();for(let i=this.warnings.length-1;i>=0;i--)if(this.warnings[i]!.sourceId===id)this.warnings.splice(i,1);}
 snapshot():EnemySnapshot {
  const units:EnemyPose[]=Array.from(this.states.entries()).map(([id,s])=>{const c=s.current,age=c?Math.max(0,this.latestTime-c.start):0;return {id,kind:this.lastKinds.get(id)!,state:this.latestTime<s.transitionUntil?'transition':this.latestTime<s.brokenUntil?'broken':c?age<c.windup?'windup':age<c.windup+.2?'attack':'recover':'idle',actionId:c?.definition.id,age,windup:c?.windup??0,duration:c?.duration??0,strike:c?Math.max(...c.steps.map(st=>Math.max(0,1-Math.abs(age-st.definition.at)/.18))):0,phase:s.phase,facing:c?(c.aim.x-c.origin.x-(c.aim.y-c.origin.y)<0?-1:1):1,awake:s.awake};});
   for(const unit of units){
    const s=this.states.get(unit.id)!,b=s.brain,cfg=enemy(unit.kind),q=b.sequence;
    const step=q?this.profiles[cfg.ai??cfg.actionSet]?.sequences?.[q.id]?.[q.index]:undefined;
    const wait=q&&step&&!q.waitingAction?Math.max(0,(step.kind==='wait'?step.seconds:step.kind==='action'?step.timeout??2:0)-(this.latestTime-q.enteredAt)):0;
    unit.decision={profile:cfg.ai??cfg.actionSet,targetId:b.targetId,actionTargetId:s.current?.targetId,targetReason:b.targetReason,reason:b.reason,ruleId:b.ruleId,sequence:q?{id:q.id,step:q.index,waitRemaining:wait}:undefined,pauseRemaining:Math.max(0,b.pauseUntil-this.latestTime),cooldowns:b.cooldowns(this.latestTime)};
   }
   return {units,warnings:this.warnings.map(w=>({...w,shape:copyHitShape(w.shape),contours:w.contours?.map(points=>points.map(point))})),projectiles:this.bullets.map(b=>({id:b.id,sourceId:b.sourceId,x:b.x,y:b.y,previous:point(b.previous),radius:b.radius,colour:b.colour,damageType:b.damageType}))};
 }
}
