import {BASIC_ATTACKS,DEFAULT_BASIC_ATTACK,resolveBasicAttack,type BasicAttackId} from '../content/attacks';
import {effectiveResistance,resistanceMultiplier,omnivampEfficiency,evaluate,type Modifier,type AttributeSource} from './attributes/AttributeSet';
import { PERKS } from '../content/perks';
import { skill } from '../content/skills';
import { tickStatuses } from './StatusSystem';
import { executeEffect } from './EffectHandlers';
import { CollisionWorld } from './CollisionWorld';
import { Random } from '../utils/Random';
import type { Vec2 } from '../utils/math';
import type { Actor, CastResult, CombatCue, CombatEvent, CombatHooks, DamageZone, Hit, PerkDefinition, PerkId, Rule,DamageComponent,CombatEffect,DamageType } from './types';
import type { SkillId } from '../content/config';
export const MAX_CHAIN_DEPTH = 6;
export const EVENT_BUDGET = 128;
/** Queue-driven deterministic rules. No renderer, engine time, or global random state. */
export class CombatEngine {
  readonly perks = new Set<PerkId>();
  private readonly playerPerks = new Map<string,Set<PerkId>>();
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
  private readonly pendingVamp=new Map<CombatEvent,number>();
  private castResult?: CastResult;
  constructor(readonly actors: Map<string,Actor>, private readonly cue: (cue: CombatCue) => void = () => {},private readonly damagePolicy:(hit:Hit,target:Actor)=>number=hit=>hit.amount,readonly collision=new CollisionWorld(),private readonly hooks:CombatHooks={}) {}
  perksFor(actorId='hero'):Set<PerkId> {if(actorId==='hero')return this.perks;let perks=this.playerPerks.get(actorId);if(!perks){perks=new Set();this.playerPerks.set(actorId,perks);}return perks;}
  basicAttackFor(actorId='hero'):BasicAttackId {
    return resolveBasicAttack(Array.from(this.perksFor(actorId),id=>PERKS.find(p=>p.id===id)! as PerkDefinition));
  }
  addPerk(id:PerkId,actorId='hero'):void {
    const p=PERKS.find(p=>p.id===id) as PerkDefinition|undefined;if(!p)return;
    this.perksFor(actorId).add(id);
    const actor=this.actors.get(actorId);if(!actor)return;
    const modifiers:Modifier[]=[];
    if(p.critChance)modifiers.push({stat:'critChance',operation:'flat',value:p.critChance});
    if(p.maxHpMultiplier)modifiers.push({stat:'maxHealth',operation:'multiply',value:p.maxHpMultiplier});
    if(p.speedMultiplier)modifiers.push({stat:'moveSpeed',operation:'multiply',value:p.speedMultiplier});
    if(p.attackMultiplier)modifiers.push({stat:'attackSpeed',operation:'multiply',value:1/p.attackMultiplier});
    actor.attributes.upsert({sourceId:'perk:'+id,modifiers});
    // One replaceable source, never a sum of multiple form ranges. Independent reach modifiers still apply.
    const form=this.basicAttackFor(actorId);
    actor.attributes.remove('perk:attack-form');
    if(form!==DEFAULT_BASIC_ATTACK)actor.attributes.upsert({sourceId:'perk:attack-form',modifiers:[{
      stat:'attackRange',operation:'flat',value:BASIC_ATTACKS[form].range-(actor.attributes.template.stats.attackRange??BASIC_ATTACKS[DEFAULT_BASIC_ATTACK].range),
    }]});
  }
  isPrimed(id: string): boolean { return this.primed.has(id); }
  modifier(stat:'maxHpMultiplier',actorId='hero'):number {return PERKS.reduce((n,p)=>n*(this.perksFor(actorId).has(p.id)?(p as PerkDefinition)[stat]??1:1),1);}
  private sum(stat:'critChance'|'trueBonusRatio',actorId:string):number {return PERKS.reduce((n,p)=>n+(this.perksFor(actorId).has(p.id)?(p as PerkDefinition)[stat]??0:0),0);}
  /** Encounter-local timers/counters never leak into a new wave; owned perks survive. */
  resetEncounter():void {this.ruleCooldown.clear();this.healCooldown.clear();this.counters.clear();this.primed.clear();this.regeneration.length=0;this.zones.length=0;}
  private emit(event:Omit<CombatEvent,'rootId'|'depth'> & Partial<Pick<CombatEvent,'rootId'|'depth'>>):void {
    const rootId=event.rootId??++this.rootSerial,depth=event.depth??0,reserved=this.scheduled.get(rootId)??0;
    if(depth>MAX_CHAIN_DEPTH||reserved>=EVENT_BUDGET){this.metrics.dropped++;return;}
    this.scheduled.set(rootId,reserved+1);this.queue.push({...event,rootId,depth});this.drain();
  }
  attack(sourceId:string,aim:Vec2,attackId?:number):void {this.emit({type:'OnAttack',attackId,sourceId,targetId:sourceId,cause:'basic',tags:['attack'],amount:0,aim:{...aim}});}
  dashEnded(sourceId:string,from:Vec2,to:Vec2):void {this.emit({type:'OnDashEnd',sourceId,targetId:sourceId,cause:'skill',tags:['movement'],amount:0,from:{x:from.x,y:from.y},to:{x:to.x,y:to.y}});}
  applyAttributeEffect(targetId:string,source:AttributeSource,duration:number):void {const target=this.actors.get(targetId);if(!target||!Number.isFinite(duration)||duration<=0)return;if(!source.sourceId.startsWith('temporary:'))throw Error('Temporary attribute source must use temporary: prefix');target.attributes.upsert(source);target.attributeEffects=target.attributeEffects.filter(e=>e.sourceId!==source.sourceId);target.attributeEffects.push({...source,modifiers:source.modifiers.map(m=>({...m})),remaining:duration});}
  applyCombatEffect(targetId:string,effect:CombatEffect):void {const target=this.actors.get(targetId);if(!target||!effect.sourceId||!effect.instanceId||!Number.isFinite(effect.remaining)||effect.remaining<=0)return;if(effect.invulnerable!==undefined&&typeof effect.invulnerable!=='boolean')throw Error('Invalid invulnerability');for(const [key,v] of Object.entries(effect)){if(['sourceId','instanceId','remaining','invulnerable'].includes(key))continue;if(!['armorReductionFlat','armorReductionPercent','magicReductionFlat','magicReductionPercent','healingReceived','grievousWounds'].includes(key)||typeof v!=='number'||!Number.isFinite(v)||v<0||key.endsWith('Percent')&&v>1||key==='grievousWounds'&&v>1)throw Error('Invalid combat effect');}target.combatEffects=target.combatEffects.filter(e=>e.sourceId!==effect.sourceId||e.instanceId!==effect.instanceId);target.combatEffects.push({...effect});}
  removeCombatEffect(targetId:string,sourceId:string,instanceId:string):void {const target=this.actors.get(targetId);if(target)target.combatEffects=target.combatEffects.filter(e=>e.sourceId!==sourceId||e.instanceId!==instanceId);}
  private effects(actor:Actor){const effects=actor.combatEffects;const sum=(key:'armorReductionFlat'|'magicReductionFlat')=>effects.reduce((n,e)=>n+(e[key]??0),0);const remaining=(key:'armorReductionPercent'|'magicReductionPercent')=>1-effects.reduce((n,e)=>n*(1-(e[key]??0)),1);return{armorReductionFlat:sum('armorReductionFlat'),magicReductionFlat:sum('magicReductionFlat'),armorReductionPercent:remaining('armorReductionPercent'),magicReductionPercent:remaining('magicReductionPercent'),healingReceived:effects.reduce((n,e)=>n*(e.healingReceived??1),1),grievousWounds:Math.max(0,...effects.map(e=>e.grievousWounds??0)),invulnerable:effects.some(e=>e.invulnerable)};}
  heal(sourceId:string,requested:number,parent?:CombatEvent,kind:'direct'|'omnivamp'|'regen'='direct'):number {return this.healTarget(sourceId,sourceId,requested,parent,kind);}
  healTarget(sourceId:string,targetId:string,requested:number,parent?:CombatEvent,kind:'direct'|'omnivamp'|'regen'='direct'):number {
    const actor=this.actors.get(targetId),source=this.actors.get(sourceId);
    if(!source||!actor?.alive||!Number.isFinite(requested)||requested<=0)return 0;
    const effects=this.effects(actor),modifier=(kind==='direct'?1+source.attributes.value.healShieldPower:1)*effects.healingReceived*(1-effects.grievousWounds),amount=Math.min(requested*modifier,actor.maxHp-actor.hp);if(amount<=1e-8)return 0;
    const rootId=parent?.rootId??++this.rootSerial,depth=parent?parent.depth+1:0,reserved=this.scheduled.get(rootId)??0;
    if(depth>MAX_CHAIN_DEPTH||reserved>=EVENT_BUDGET){this.metrics.dropped++;return 0;}
    actor.hp+=amount;this.cue({kind:'heal',actorId:actor.id,at:{x:actor.x,y:actor.y},amount});
    this.emit({type:'OnHeal',sourceId,targetId,cause:'augment',tags:['heal',kind,...(parent?.tags.includes('derived-heal')?['derived-heal']:[])],amount,effectiveHeal:amount,proc:true,rootId,depth});return amount;
  }
  damage(hit: Hit): void {
    const target = this.actors.get(hit.targetId), depth = hit.depth ?? 0;
    if (!target?.alive || (!hit.expression&&(!Number.isFinite(hit.amount)||hit.amount<=0))) return;
    const reductions=this.effects(target);if(reductions.invulnerable)return;
    const source=this.actors.get(hit.sourceId),a=source?.attributes.value,t=target.attributes.value;
    const damageType=hit.damageType??(hit.skillId?skill(hit.skillId).damageType??'magic':hit.cause==='basic'||hit.cause==='enemy'?'physical':'magic');
    const canCrit=hit.canCrit??(!hit.proc&&(hit.cause==='basic'||hit.cause==='enemy'&&!hit.skillId||hit.cause==='skill'&&PERKS.some(p=>this.perksFor(hit.sourceId).has(p.id)&&(p as PerkDefinition).skillCrit)));
    const critical=!!a&&canCrit&&a.critChance>0&&(this.hooks.random?.()??this.random.next())<a.critChance;
    let raw=hit.expression&&source?evaluate(hit.expression,source,target):hit.amount;
    raw*=critical?1+(hit.critRatio??1)*((a?.critDamage??2)-1):1;
    const resistance=damageType==='physical'?effectiveResistance(t.armor,reductions.armorReductionFlat,reductions.armorReductionPercent,a?.armorPenPercent,a?.armorPenFlat):effectiveResistance(t.magicResist,reductions.magicReductionFlat,reductions.magicReductionPercent,a?.magicPenPercent,a?.magicPenFlat);
    const ordinary=this.damagePolicy({...hit,amount:raw,damageType},target)*(damageType==='true'?1:resistanceMultiplier(resistance));
    const trueBonus=damageType!=='true'?this.damagePolicy({...hit,amount:raw,damageType:'true'},target)*this.sum('trueBonusRatio',hit.sourceId):0;
    const components:DamageComponent[]=[];
    const shields=target.shields.map(s=>({...s,types:[...s.types]}));let legacyShield=target.shield,hp=target.hp;
    for(const [type,amount] of [[damageType,ordinary],['true',trueBonus]] as [DamageType,number][]){if(!Number.isFinite(amount)||amount<=0)continue;let remaining=amount,absorbed=0;if(shields.length){for(const shield of shields){if(!shield.types.includes(type))continue;const used=Math.min(shield.amount,remaining);shield.amount-=used;remaining-=used;absorbed+=used;}}else{absorbed=Math.min(legacyShield,remaining);legacyShield-=absorbed;remaining-=absorbed;}const lost=Math.min(hp,remaining);hp-=lost;components.push({damageType:type,postMitigation:amount,shieldAbsorbed:absorbed,healthLost:lost,overkill:Math.max(0,remaining-lost)});}
    if(!components.length)return;
    hit={...hit,damageType,amount:components.reduce((n,c)=>n+c.postMitigation,0)};
    const shieldAbsorbed=components.reduce((n,c)=>n+c.shieldAbsorbed,0),lostHp=target.hp-hp,pending=components.reduce((n,c)=>n+c.healthLost+c.overkill,0);
    const rootId=hit.rootId??++this.rootSerial;
    const attackHit=hit.cause==='basic'||hit.appliesOnHit,damaged=lostHp>0,events=1+(hp<=0?1:0)+(attackHit?1:0)+(damaged?1:0),reserved=this.scheduled.get(rootId)??0;
    if(depth>MAX_CHAIN_DEPTH||(this.budget.get(rootId)??0)>=EVENT_BUDGET||reserved+events>EVENT_BUDGET){this.metrics.dropped++;return;}
    this.scheduled.set(rootId,reserved+events);
    target.shields=shields.filter(s=>s.amount>1e-8);target.shield=shields.length?target.shields.reduce((n,s)=>n+s.amount,0):legacyShield;target.hp=hp;
    const event: CombatEvent = { type:'OnHit', sourceId:hit.sourceId, targetId:target.id,
      cause:hit.cause, damageSourceTeam:source?.team??hit.damageSourceTeam, attackId:hit.attackId,healthAfter:hp,targetMaxHealth:target.maxHp, depth, skillId:hit.skillId, tags:hit.tags ?? [hit.cause], amount:hit.amount,postMitigation:hit.amount,shieldAbsorbed,healthLost:lostHp,overkill:Math.max(0,pending-lostHp),components,damageType:components.length===1?damageType:undefined,rootId,proc:hit.proc };
    this.queue.push(event);
    if(attackHit)this.queue.push({...event,type:'OnAttackHit'});
    if(damaged)this.queue.push({...event,type:'OnDamaged',sourceId:target.id,targetId:hit.sourceId,amount:lostHp});
    this.cue({kind:'damage',actorId:target.id,sourceId:hit.sourceId,attackId:hit.attackId,at:{x:target.x,y:target.y},amount:hit.amount,cause:hit.cause,critical,trueDamage:damageType==='true'});
    if (target.hp<=0) {
      target.alive = false; this.metrics.kills++;
      this.queue.push({...event,type:'OnKill'});
    }
    if(source?.alive&&a&&hit.vampEligible!==false&&a.omnivamp>0)this.pendingVamp.set(event,hit.amount*a.omnivamp*omnivampEfficiency(hit.delivery??(hit.cause==='burn'?'periodic':hit.proc?'proc':hit.cause==='basic'?'attack':'spell'),hit.area??false,target.attributes.template.classification));
    this.drain();
  }
  shield(sourceId:string,targetId:string,amount:number,duration:number,id='shield',types:DamageType[]=['physical','magic','true'],parent?:CombatEvent):boolean {
    const source=this.actors.get(sourceId),target=this.actors.get(targetId);if(!source||!target?.alive||!Number.isFinite(amount)||amount<=0||!Number.isFinite(duration)||duration<=0)return false;
    const scaled=amount*(1+source.attributes.value.healShieldPower);if(!Number.isFinite(scaled)||scaled<=0||!Array.isArray(types)||!types.length||!types.every(type=>['physical','magic','true'].includes(type)))return false;
    if(parent&&(parent.depth+1>MAX_CHAIN_DEPTH||(this.scheduled.get(parent.rootId)??0)>=EVENT_BUDGET)){this.metrics.dropped++;return false;}
    const key=sourceId+':'+id;target.shields=target.shields.filter(s=>s.id!==key);target.shields.push({id:key,sourceId,remaining:duration,amount:scaled,types:[...types]});target.shield=target.shields.reduce((n,s)=>n+s.amount,0);target.shieldTime=Math.max(...target.shields.map(s=>s.remaining));
    if(parent)this.emit({type:'OnShield',sourceId,targetId,amount:scaled,cause:'augment',proc:true,tags:['shield'],rootId:parent.rootId,depth:parent.depth+1});
    return true;
  }
  removeShield(targetId:string,sourceId:string,id:string):void {const target=this.actors.get(targetId);if(!target||!target.shields.some(s=>s.id===sourceId+':'+id))return;target.shields=target.shields.filter(s=>s.id!==sourceId+':'+id);target.shield=target.shields.reduce((n,s)=>n+s.amount,0);target.shieldTime=Math.max(0,...target.shields.map(s=>s.remaining));}

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
      this.cue({kind:'quake',at:{x:z.from.x,y:z.from.y},to:{x:z.to.x,y:z.to.y},radius:z.radius,appearance:z.appearance});
      for(const target of this.collision.targets(this.actors.values(),source.team,{kind:'capsule',center:z.from,end:z.to,radius:z.radius}))this.damage({sourceId:z.sourceId,targetId:target.id,amount:z.damage,cause:'augment',proc:true,area:true,delivery:'proc',tags:['trail']});
    }
    for (const actor of this.actors.values()) {
      if (!actor.alive) continue;
      for(const effect of actor.attributeEffects){effect.remaining-=dt;if(effect.remaining<=1e-8)actor.attributes.remove(effect.sourceId);}actor.attributeEffects=actor.attributeEffects.filter(e=>e.remaining>1e-8);
      for(const effect of actor.combatEffects)effect.remaining-=dt;actor.combatEffects=actor.combatEffects.filter(e=>e.remaining>1e-8);
      const attrs=actor.attributes.value;actor.maxHp=attrs.maxHealth;actor.hp=Math.min(actor.hp,actor.maxHp);actor.mana=actor.attributes.template.resourceKind==='mana'?Math.min(attrs.maxMana,actor.mana+attrs.manaRegen*dt):0;if(attrs.healthRegen>0)this.heal(actor.id,attrs.healthRegen*dt,undefined,'regen');
      if(actor.shields.length){for(const shield of actor.shields)shield.remaining-=dt;actor.shields=actor.shields.filter(s=>s.remaining>1e-8&&s.amount>1e-8);actor.shield=actor.shields.reduce((n,s)=>n+s.amount,0);actor.shieldTime=Math.max(0,...actor.shields.map(s=>s.remaining));}
      else if (actor.shieldTime>0) { actor.shieldTime = Math.max(0,actor.shieldTime-dt); if (actor.shieldTime===0) actor.shield=0; }
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
        this.hooks.onEvent?.(event);
        // Content order is stable regardless of the order perks were acquired.

        for (const definition of PERKS) if (this.perksFor(event.sourceId).has(definition.id)) {
          (definition as PerkDefinition).rules.forEach((rule,index) => {
            const key = `${event.rootId}:${event.sourceId}:${definition.id}:${index}:${event.targetId}`;
            if (this.dedup.has(key) || !this.matches(rule,event)) return;
            this.dedup.add(key);
            const ruleId=`${definition.id}:${index}`,gate=`${event.sourceId}:${ruleId}${rule.perTarget?':'+event.targetId:''}`;
            if((this.ruleCooldown.get(gate)??0)>1e-8)return;
            if(rule.every){const count=(this.counters.get(gate)??0)+1;this.counters.set(gate,count%rule.every);if(count%rule.every)return;}
            if(rule.cooldown)this.ruleCooldown.set(gate,rule.cooldown);
            this.apply(rule,event,ruleId);
          });
        }
        const vamp=this.pendingVamp.get(event);if(vamp){this.pendingVamp.delete(event);this.heal(event.sourceId,vamp,event,'omnivamp');}
      }
    } finally {
      this.history.splice(0,Math.max(0,this.history.length-256));
      this.queue.length=0;this.pendingVamp.clear(); this.budget.clear(); this.scheduled.clear(); this.dedup.clear(); this.draining=false;
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
      attributeEffect:(target,source,duration)=>this.applyAttributeEffect(target,source,duration),combatEffect:(target,effect)=>this.applyCombatEffect(target,effect),shield:(target,amount,duration,id,types)=>this.shield(source.id,target,amount,duration,id,types,event),
      regenerate:(ratio,duration)=>this.regeneration.push({sourceId:source.id,remaining:duration,rate:source.maxHp*ratio/duration,accrued:0}),
      trail:(effect)=>{if(event.from&&event.to&&this.zones.length<32)this.zones.push({id:++this.zoneSerial,sourceId:source.id,from:{x:event.from.x,y:event.from.y},to:{x:event.to.x,y:event.to.y},remaining:effect.delay,...effect});}},rule.effect);
  }
}
