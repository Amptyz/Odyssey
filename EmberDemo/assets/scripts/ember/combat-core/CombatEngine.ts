import { PERKS } from '../content/perks';
import { skill } from '../content/skills';
import { tickStatuses } from './StatusSystem';
import { executeEffect } from './EffectHandlers';
import { CollisionWorld } from './CollisionWorld';
import { Random } from '../utils/Random';
import type { Vec2 } from '../utils/math';
import type { Actor, CastResult, CombatCue, CombatEvent, CombatHooks, DamageZone, Hit, PerkDefinition, PerkId, Rule } from './types';
import type { SkillId } from '../content/config';
export const MAX_CHAIN_DEPTH = 6;
export const EVENT_BUDGET = 128;
/** Queue-driven deterministic rules. No renderer, engine time, or global random state. */
export class CombatEngine {
  readonly perks = new Set<PerkId>();
  readonly history: CombatEvent[] = [];
  readonly metrics = { processed: 0, dropped: 0, maxDepth: 0, kills: 0 };
  private queue: CombatEvent[] = [];
  private draining = false;
  private rootSerial = 0;
  private budget = new Map<number, number>();
  private scheduled = new Map<number, number>();
  private dedup = new Set<string>();
  private primed = new Set<string>();
  private healCooldown = new Map<string, number>();
  private ruleCooldown = new Map<string, number>();
  private counters = new Map<string, number>();
  private regeneration:{sourceId:string;remaining:number;rate:number;accrued:number}[]=[];
  readonly zones:DamageZone[]=[];
  private zoneSerial=0;
  private readonly random=new Random(0);
  private castResult?: CastResult;
  constructor(readonly actors: Map<string,Actor>, private readonly cue: (cue: CombatCue) => void = () => {},private readonly damagePolicy:(hit:Hit,target:Actor)=>number=hit=>hit.amount,readonly collision=new CollisionWorld(),private readonly hooks:CombatHooks={}) {}
  addPerk(id: PerkId): void { this.perks.add(id); }
  isPrimed(id: string): boolean { return this.primed.has(id); }
  modifier(stat:'maxHpMultiplier'):number {return PERKS.reduce((n,p)=>n*(this.perks.has(p.id)?(p as PerkDefinition)[stat]??1:1),1);}
  private sum(stat:'critChance'|'trueBonusRatio'):number {return PERKS.reduce((n,p)=>n+(this.perks.has(p.id)?(p as PerkDefinition)[stat]??0:0),0);}
  /** Encounter-local timers/counters never leak into a new wave; owned perks survive. */
  resetEncounter():void {this.ruleCooldown.clear();this.healCooldown.clear();this.counters.clear();this.primed.clear();this.regeneration.length=0;this.zones.length=0;}
  private emit(event:Omit<CombatEvent,'rootId'|'depth'> & Partial<Pick<CombatEvent,'rootId'|'depth'>>):void {
    const rootId=event.rootId??++this.rootSerial,depth=event.depth??0,reserved=this.scheduled.get(rootId)??0;
    if(depth>MAX_CHAIN_DEPTH||reserved>=EVENT_BUDGET){this.metrics.dropped++;return;}
    this.scheduled.set(rootId,reserved+1);this.queue.push({...event,rootId,depth});this.drain();
  }
  attack(sourceId:string,aim:Vec2):void {this.emit({type:'OnAttack',sourceId,targetId:sourceId,cause:'basic',tags:['attack'],amount:0,aim:{...aim}});}
  dashEnded(sourceId:string,from:Vec2,to:Vec2):void {this.emit({type:'OnDashEnd',sourceId,targetId:sourceId,cause:'skill',tags:['movement'],amount:0,from:{...from},to:{...to}});}
  heal(sourceId:string,requested:number,parent?:CombatEvent):number {
    const actor=this.actors.get(sourceId);
    if(!actor?.alive||!Number.isFinite(requested)||requested<=0)return 0;
    const amount=Math.min(requested,actor.maxHp-actor.hp);if(amount<=1e-8)return 0;
    // Healing caused by a proc preserves lineage; death-ring kills cannot create an unbounded heal loop.
    if(parent&&parent.depth>=MAX_CHAIN_DEPTH){this.metrics.dropped++;return 0;}
    actor.hp+=amount;this.cue({kind:'heal',actorId:actor.id,at:{...actor},amount});
    this.emit({type:'OnHeal',sourceId,targetId:sourceId,cause:'augment',tags:['heal'],amount,proc:true,rootId:parent?.rootId,depth:parent?parent.depth+1:0});
    return amount;
  }
  damage(hit: Hit): void {
    const target = this.actors.get(hit.targetId), depth = hit.depth ?? 0;
    if (!target?.alive || !Number.isFinite(hit.amount) || hit.amount<=0) return;
    const isHero=this.actors.get(hit.sourceId)?.team==='hero';
    const canCrit=!hit.proc&&(hit.cause==='basic'||hit.cause==='skill'&&PERKS.some(p=>this.perks.has(p.id)&&(p as PerkDefinition).skillCrit));
    const chance=isHero&&canCrit?this.sum('critChance'):0;
    const critical=chance>0&&(this.hooks.random?.()??this.random.next())<chance;
    hit={...hit,amount:hit.amount*(critical?1.5:1)};
    const bonus=isHero&&!hit.trueDamage?this.damagePolicy({...hit,trueDamage:true},target)*this.sum('trueBonusRatio'):0;
    hit={...hit,amount:this.damagePolicy(hit,target)+bonus};
    if(!Number.isFinite(hit.amount)||hit.amount<=0)return;
    const rootId = hit.rootId ?? ++this.rootSerial;
    if (depth>MAX_CHAIN_DEPTH || (this.budget.get(rootId) ?? 0)>=EVENT_BUDGET) { this.metrics.dropped++; return; }
    const absorbed = Math.min(target.shield, hit.amount);
    // Reserve hit + possible kill before mutation, bounding both queue size and damage work.
    const attackHit=hit.cause==='basic'||hit.appliesOnHit;
    const damaged=target.team==='hero'&&hit.amount>absorbed;
    const events = 1+(target.hp<=hit.amount-absorbed?1:0)+(attackHit?1:0)+(damaged?1:0);
    const reserved = this.scheduled.get(rootId) ?? 0;
    if (reserved+events>EVENT_BUDGET) { this.metrics.dropped++; return; }
    this.scheduled.set(rootId,reserved+events);
    target.shield -= absorbed;
    const lostHp=Math.min(target.hp,hit.amount-absorbed);
    target.hp = Math.max(0, target.hp - lostHp);
    const event: CombatEvent = { type:'OnHit', sourceId:hit.sourceId, targetId:target.id,
      cause:hit.cause, depth, skillId:hit.skillId, tags:hit.tags ?? [hit.cause], amount:hit.amount, rootId,proc:hit.proc };
    this.queue.push(event);
    if(attackHit)this.queue.push({...event,type:'OnAttackHit'});
    if(damaged)this.queue.push({...event,type:'OnDamaged',sourceId:target.id,targetId:hit.sourceId,amount:lostHp});
    this.cue({kind:'damage',actorId:target.id,at:{x:target.x,y:target.y},amount:hit.amount,cause:hit.cause,critical,trueDamage:hit.trueDamage});
    if (target.hp<=0) {
      target.alive = false; this.metrics.kills++;
      this.queue.push({...event,type:'OnKill'});
    }
    this.drain();
  }
  cast(sourceId: string, skillId: SkillId): CastResult {
    const result: CastResult = {damageMultiplier:1,shots:1};
    this.castResult = result;
    const rootId=++this.rootSerial;this.scheduled.set(rootId,1);
    this.queue.push({type:'OnSkillCast',sourceId,targetId:sourceId,cause:'skill',depth:0,skillId,tags:['skill'],amount:0,rootId});
    this.drain(); this.castResult = undefined;
    return result;
  }
  tick(dt: number): void {
    if(!Number.isFinite(dt)||dt<=0)return;
    for (const [id,remaining] of this.healCooldown) this.healCooldown.set(id,Math.max(0,remaining-dt));
    for (const [id,remaining] of this.ruleCooldown) {if(remaining<=dt)this.ruleCooldown.delete(id);else this.ruleCooldown.set(id,remaining-dt);}
    for(let i=this.regeneration.length-1;i>=0;i--){const r=this.regeneration[i]!;r.accrued+=Math.min(dt,r.remaining);r.remaining=Math.max(0,r.remaining-dt);
      while(r.accrued>=.5-1e-8){this.heal(r.sourceId,r.rate*.5);r.accrued=Math.max(0,r.accrued-.5);}
      if(r.remaining<=1e-8){this.heal(r.sourceId,r.rate*r.accrued);this.regeneration.splice(i,1);}else if(!this.actors.get(r.sourceId)?.alive)this.regeneration.splice(i,1);
    }
    for(let i=this.zones.length-1;i>=0;i--){const z=this.zones[i]!;z.remaining-=dt;if(z.remaining>1e-8)continue;this.zones.splice(i,1);
      const source=this.actors.get(z.sourceId);if(!source?.alive)continue;
      this.cue({kind:'quake',at:{...z.from},to:{...z.to},radius:z.radius,appearance:z.appearance});
      for(const target of this.collision.targets(this.actors.values(),source.team,{kind:'capsule',center:z.from,end:z.to,radius:z.radius}))this.damage({sourceId:z.sourceId,targetId:target.id,amount:z.damage,cause:'augment',proc:true,tags:['trail']});
    }
    for (const actor of this.actors.values()) {
      if (!actor.alive) continue;
      if (actor.shieldTime>0) { actor.shieldTime = Math.max(0,actor.shieldTime-dt); if (actor.shieldTime===0) actor.shield=0; }
      tickStatuses(actor,dt,(status,hit)=>{
        const rootId=++this.rootSerial;this.scheduled.set(rootId,1);
        this.queue.push({type:'OnStatusTick',sourceId:status.sourceId,targetId:actor.id,cause:hit.cause,depth:0,skillId:status.skillId,tags:['dot',status.id],amount:hit.amount,rootId,proc:true});
        this.damage({...hit,rootId});
        this.drain();
      });
    }
  }
  private drain(): void {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let index=0; index<this.queue.length; index++) {
        const event = this.queue[index]!;
        const count = this.budget.get(event.rootId) ?? 0;
        if (count>=EVENT_BUDGET || event.depth>MAX_CHAIN_DEPTH) { this.metrics.dropped++; continue; }
        this.budget.set(event.rootId,count+1); this.metrics.processed++;
        this.metrics.maxDepth = Math.max(this.metrics.maxDepth,event.depth);
        this.history.push(event);
        // Content order is stable regardless of the order perks were acquired.
        if (this.actors.get(event.sourceId)?.team !== 'hero') continue;
        for (const definition of PERKS) if (this.perks.has(definition.id)) {
          (definition as PerkDefinition).rules.forEach((rule,index) => {
            const key = `${event.rootId}:${definition.id}:${index}:${event.targetId}`;
            if (this.dedup.has(key) || !this.matches(rule,event)) return;
            this.dedup.add(key);
            const ruleId=`${definition.id}:${index}`,gate=`${event.sourceId}:${ruleId}${rule.perTarget?':'+event.targetId:''}`;
            if((this.ruleCooldown.get(gate)??0)>1e-8)return;
            if(rule.every){const count=(this.counters.get(gate)??0)+1;this.counters.set(gate,count%rule.every);if(count%rule.every)return;}
            if(rule.cooldown)this.ruleCooldown.set(gate,rule.cooldown);
            this.apply(rule,event,ruleId);
          });
        }
      }
    } finally {
      this.history.splice(0,Math.max(0,this.history.length-256));
      this.queue.length=0; this.budget.clear(); this.scheduled.clear(); this.dedup.clear(); this.draining=false;
    }
  }
  private matches(rule: Rule, event: CombatEvent): boolean {
    return rule.event===event.type && (!rule.skillId || rule.skillId===event.skillId) &&
      (!rule.causes || rule.causes.includes(event.cause)) &&
      (!rule.directOnly || !event.proc) &&
      (!rule.tags || rule.tags.every(tag=>event.tags.includes(tag))) &&
      (!rule.healthBelow || !!this.actors.get(event.sourceId)?.alive && this.actors.get(event.sourceId)!.hp/this.actors.get(event.sourceId)!.maxHp<rule.healthBelow) &&
      (!rule.targetStatus || !!this.actors.get(event.targetId)?.statuses.some(s=>s.id===rule.targetStatus)) &&
      (!rule.skillTags || !!event.skillId && rule.skillTags.every(tag=>skill(event.skillId!).tags.includes(tag))) &&
      (!rule.sourcePrimed || this.primed.has(event.sourceId));
  }
  private apply(rule:Rule,event:CombatEvent,ruleId:string):void {
    const target=this.actors.get(event.targetId),source=this.actors.get(event.sourceId);
    if(!target||!source)return;
    executeEffect({source,target,event,ruleId,actors:this.actors,collision:this.collision,primed:this.primed,healCooldown:this.healCooldown,
      castResult:this.castResult,maxDepth:MAX_CHAIN_DEPTH,cue:this.cue,damage:hit=>this.damage(hit),drop:()=>{this.metrics.dropped++;},hooks:this.hooks,
      heal:(amount)=>this.heal(source.id,amount,event),onHit:()=>this.emit({...event,type:'OnAttackHit',proc:true,depth:event.depth+1}),
      regenerate:(ratio,duration)=>this.regeneration.push({sourceId:source.id,remaining:duration,rate:source.maxHp*ratio/duration,accrued:0}),
      trail:(effect)=>{if(event.from&&event.to&&this.zones.length<32)this.zones.push({id:++this.zoneSerial,sourceId:source.id,from:{...event.from},to:{...event.to},remaining:effect.delay,...effect});}},rule.effect);
  }
}
