import { PERKS } from '../content/perks';
import { skill } from '../content/skills';
import { tickStatuses } from './StatusSystem';
import { executeEffect } from './EffectHandlers';
import type { Actor, CastResult, CombatCue, CombatEvent, Hit, PerkId, Rule } from './types';
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
  private castResult?: CastResult;
  constructor(readonly actors: Map<string,Actor>, private readonly cue: (cue: CombatCue) => void = () => {},private readonly damagePolicy:(hit:Hit,target:Actor)=>number=hit=>hit.amount) {}
  addPerk(id: PerkId): void { this.perks.add(id); }
  isPrimed(id: string): boolean { return this.primed.has(id); }
  damage(hit: Hit): void {
    const target = this.actors.get(hit.targetId), depth = hit.depth ?? 0;
    if (!target?.alive || !Number.isFinite(hit.amount) || hit.amount<=0) return;
    hit={...hit,amount:this.damagePolicy(hit,target)};
    if(!Number.isFinite(hit.amount)||hit.amount<=0)return;
    const rootId = hit.rootId ?? ++this.rootSerial;
    if (depth>MAX_CHAIN_DEPTH || (this.budget.get(rootId) ?? 0)>=EVENT_BUDGET) { this.metrics.dropped++; return; }
    const absorbed = Math.min(target.shield, hit.amount);
    // Reserve hit + possible kill before mutation, bounding both queue size and damage work.
    const events = target.hp <= hit.amount-absorbed ? 2 : 1;
    const reserved = this.scheduled.get(rootId) ?? 0;
    if (reserved+events>EVENT_BUDGET) { this.metrics.dropped++; return; }
    this.scheduled.set(rootId,reserved+events);
    target.shield -= absorbed;
    target.hp = Math.max(0, target.hp - (hit.amount-absorbed));
    const event: CombatEvent = { type:'OnHit', sourceId:hit.sourceId, targetId:target.id,
      cause:hit.cause, depth, skillId:hit.skillId, tags:hit.tags ?? [hit.cause], amount:hit.amount, rootId };
    this.queue.push(event);
    this.cue({kind:'damage',at:{x:target.x,y:target.y},amount:hit.amount,cause:hit.cause});
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
    for (const [id,remaining] of this.healCooldown) this.healCooldown.set(id,Math.max(0,remaining-dt));
    for (const actor of this.actors.values()) {
      if (!actor.alive) continue;
      if (actor.shieldTime>0) { actor.shieldTime = Math.max(0,actor.shieldTime-dt); if (actor.shieldTime===0) actor.shield=0; }
      tickStatuses(actor,dt,(status,hit)=>{
        const rootId=++this.rootSerial;this.scheduled.set(rootId,1);
        this.queue.push({type:'OnStatusTick',sourceId:status.sourceId,targetId:actor.id,cause:hit.cause,depth:0,skillId:status.skillId,tags:['dot',status.id],amount:status.power,rootId});
        this.damage({...hit,rootId});
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
          definition.rules.forEach((rule,index) => {
            const key = `${event.rootId}:${definition.id}:${index}:${event.targetId}`;
            if (this.dedup.has(key) || !this.matches(rule,event)) return;
            this.dedup.add(key); this.apply(rule,event,`${definition.id}:${index}`);
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
      (!rule.targetStatus || !!this.actors.get(event.targetId)?.statuses.some(s=>s.id===rule.targetStatus)) &&
      (!rule.skillTags || !!event.skillId && rule.skillTags.every(tag=>skill(event.skillId!).tags.includes(tag))) &&
      (!rule.sourcePrimed || this.primed.has(event.sourceId));
  }
  private apply(rule:Rule,event:CombatEvent,ruleId:string):void {
    const target=this.actors.get(event.targetId),source=this.actors.get(event.sourceId);
    if(!target||!source)return;
    executeEffect({source,target,event,ruleId,actors:this.actors,primed:this.primed,healCooldown:this.healCooldown,
      castResult:this.castResult,maxDepth:MAX_CHAIN_DEPTH,cue:this.cue,damage:hit=>this.damage(hit),drop:()=>{this.metrics.dropped++;}},rule.effect);
  }
}
