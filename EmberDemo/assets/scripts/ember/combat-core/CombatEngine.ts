import { PERKS } from '../content/perks';
import { distance } from '../utils/math';
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
  constructor(readonly actors: Map<string,Actor>, private readonly cue: (cue: CombatCue) => void = () => {}) {}
  addPerk(id: PerkId): void { this.perks.add(id); }
  isPrimed(id: string): boolean { return this.primed.has(id); }
  damage(hit: Hit): void {
    const target = this.actors.get(hit.targetId), depth = hit.depth ?? 0;
    if (!target?.alive || !Number.isFinite(hit.amount) || hit.amount<=0) return;
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
      const burn = actor.burn;
      if (!burn) continue;
      const elapsed = Math.min(dt,burn.remaining);
      burn.remaining = Math.max(0,burn.remaining-dt); burn.tickIn -= elapsed;
      while (burn.tickIn<=1e-8 && actor.alive) {
        burn.tickIn += 1;
        const rootId = ++this.rootSerial;
        this.scheduled.set(rootId,1);
        this.queue.push({type:'OnStatusTick',sourceId:burn.sourceId,targetId:actor.id,cause:'burn',depth:0,tags:['dot','burn'],amount:burn.damage,rootId});
        this.damage({sourceId:burn.sourceId,targetId:actor.id,amount:burn.damage,cause:'burn',rootId});
      }
      if (actor.alive && burn.remaining<=0) actor.burn=undefined;
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
            this.dedup.add(key); this.apply(rule,event);
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
      (!rule.targetBurning || !!this.actors.get(event.targetId)?.burn) &&
      (!rule.sourcePrimed || this.primed.has(event.sourceId));
  }
  private apply(rule: Rule, event: CombatEvent): void {
    const effect=rule.effect, target=this.actors.get(event.targetId), source=this.actors.get(event.sourceId);
    if (!target || !source) return;
    switch (effect.type) {
      case 'burn': target.burn={remaining:effect.duration,tickIn:target.burn?.tickIn ?? 1,sourceId:event.sourceId,damage:effect.damage}; break;
      case 'prime': this.primed.add(source.id); break;
      case 'empower': if (this.castResult) { this.castResult.damageMultiplier*=effect.multiplier; this.primed.delete(source.id); } break;
      case 'extraShot': if (this.castResult) this.castResult.shots++; break;
      case 'heal': {
        if (!source.alive || (this.healCooldown.get(source.id) ?? 0)>0) break;
        const amount=Math.min(effect.amount,source.maxHp-source.hp);
        source.hp+=amount; this.healCooldown.set(source.id,effect.cooldown);
        if (amount>0) this.cue({kind:'heal',at:{...source},amount}); break;
      }
      case 'explode': case 'arc': {
        if (event.depth>=MAX_CHAIN_DEPTH) { this.metrics.dropped++; break; }
        const nearby=Array.from(this.actors.values()).filter(a => a.alive && a.team!==source.team && a.id!==target.id && distance(a,target)<=effect.radius)
          .sort((a,b) => distance(a,target)-distance(b,target) || a.id.localeCompare(b.id));
        const victims=effect.type==='arc' ? nearby.slice(0,1) : nearby;
        if (effect.type==='explode') this.cue({kind:'explosion',at:{...target},radius:effect.radius});
        for (const victim of victims) {
          if (effect.type==='arc') this.cue({kind:'arc',at:{...target},to:{...victim}});
          this.damage({sourceId:source.id,targetId:victim.id,amount:effect.damage,cause:effect.type==='arc'?'arc':'explosion',depth:event.depth+1,rootId:event.rootId,tags:[effect.type]});
        }
        break;
      }
    }
  }
}
