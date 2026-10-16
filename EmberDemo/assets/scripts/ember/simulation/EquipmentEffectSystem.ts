import {equipment,EQUIPMENT_SLOTS,type EquipmentLoadout,type EquipmentPassiveDefinition} from '../content/equipment';
import {evaluate} from '../combat-core/attributes/AttributeSet';
import type {Actor,CombatEvent} from '../combat-core/types';
import type {CombatEngine} from '../combat-core/CombatEngine';
type Candidate={id:string;definition:EquipmentPassiveDefinition};
type Lock={attackId:number;amount:number;cooldown:number};
interface GroupState {kind:EquipmentPassiveDefinition['kind'];group:string;candidates:Candidate[];readyAt:number;armedUntil:number;lock?:Lock}
export interface EquipmentPassiveSnapshot {group:string;kind:EquipmentPassiveDefinition['kind'];readyIn:number;armedFor:number;lockedAttackId?:number}
/** Equipment rules are owned by actor+unique group, independently of the perk registry. */
export class EquipmentEffectSystem {
  private readonly owners=new Map<string,Map<string,GroupState>>();
  constructor(private readonly combat:CombatEngine,private readonly actors:ReadonlyMap<string,Actor>,private readonly now:()=>number){}
  sync(ownerId:string,loadout:EquipmentLoadout):void {
    let states=this.owners.get(ownerId);if(!states){states=new Map();this.owners.set(ownerId,states);}
    const groups=new Map<string,Candidate[]>();
    for(const slot of EQUIPMENT_SLOTS){const id=loadout[slot];if(!id)continue;for(const definition of equipment(id).passives??[]){const list=groups.get(definition.group)??[];list.push({id,definition});groups.set(definition.group,list);}}
    for(const state of Array.from(states.values()))if(!groups.has(state.group)){state.candidates=[];state.armedUntil=0;state.lock=undefined;this.combat.removeShield(ownerId,ownerId,state.group);}
    for(const [group,candidates] of Array.from(groups)){const old=states.get(group);if(old)old.candidates=candidates;else states.set(group,{kind:candidates[0]!.definition.kind,group,candidates,readyAt:0,armedUntil:0});}
  }
  /** Capture eligibility and AD/AP at release. A later cast cannot empower an older attack. */
  beginAttack(ownerId:string,attackId:number):void {
    const source=this.actors.get(ownerId);if(!source?.alive)return;
    for(const state of Array.from(this.owners.get(ownerId)?.values()??[])){this.expire(state);if(state.kind!=='spellblade'||!state.candidates.length||state.lock||state.armedUntil<=this.now()||state.readyAt>this.now()+1e-8)continue;
      const candidate=this.strongest(state,source);state.lock={attackId,amount:evaluate(candidate.definition.expression,source),cooldown:candidate.definition.cooldown};
    }
  }
  endAttack(ownerId:string,attackId:number):void {for(const state of Array.from(this.owners.get(ownerId)?.values()??[]))if(state.lock?.attackId===attackId)state.lock=undefined;}
  releaseAttacks(ownerId?:string):void {for(const [id,states] of Array.from(this.owners))if(ownerId===undefined||ownerId===id)for(const state of Array.from(states.values()))state.lock=undefined;}
  deactivate(ownerId:string):void {for(const state of Array.from(this.owners.get(ownerId)?.values()??[])){state.lock=undefined;state.armedUntil=0;this.combat.removeShield(ownerId,ownerId,state.group);}}
  resetEncounter():void {for(const [id,states] of Array.from(this.owners))for(const state of Array.from(states.values())){state.readyAt=0;state.armedUntil=0;state.lock=undefined;this.combat.removeShield(id,id,state.group);}}
  snapshot(ownerId:string):EquipmentPassiveSnapshot[]{return Array.from(this.owners.get(ownerId)?.values()??[]).filter(s=>s.candidates.length).map(s=>({group:s.group,kind:s.kind,readyIn:Math.max(0,s.readyAt-this.now()),armedFor:Math.max(0,s.armedUntil-this.now()),lockedAttackId:s.lock?.attackId}));}
  onEvent(event:CombatEvent):void {
    const owner=this.actors.get(event.sourceId);if(!owner?.alive){if(event.type==='OnDamaged')this.deactivate(event.sourceId);return;}
    for(const state of Array.from(this.owners.get(owner.id)?.values()??[])){this.expire(state);if(!state.candidates.length)continue;
      if(state.kind==='spellblade'){
        if(event.type==='OnSkillCast'&&!event.proc&&state.readyAt<=this.now()+1e-8){const selected=this.strongest(state,owner).definition;if(selected.kind==='spellblade')state.armedUntil=this.now()+selected.armDuration;}
        if(event.type==='OnHit'&&event.cause==='basic'&&!event.proc&&event.attackId!==undefined&&state.lock?.attackId===event.attackId){
          const target=this.actors.get(event.targetId);if(!target||target.team===owner.team)continue;
          const {amount,cooldown}=state.lock;state.armedUntil=0;state.lock=undefined;state.readyAt=this.now()+cooldown;
          // A killing base hit consumes the charge but cannot damage a corpse or create vamp.
          if(target.alive)this.combat.damage({sourceId:owner.id,targetId:target.id,amount,cause:'augment',damageType:'magic',delivery:'proc',proc:true,canCrit:false,appliesOnHit:false,vampEligible:true,rootId:event.rootId,depth:event.depth+1,tags:['equipment','spellblade']});
        }
      }else if(event.type==='OnDamaged'&&(event.healthLost??0)>0&&state.readyAt<=this.now()+1e-8){
        const attackerTeam=event.damageSourceTeam??this.actors.get(event.targetId)?.team;if(!attackerTeam||attackerTeam===owner.team)continue;
        const selected=this.strongest(state,owner).definition;if(selected.kind!=='safetyShield')continue;
        const after=event.healthAfter??owner.hp,max=event.targetMaxHealth??owner.maxHp;if(after<=0||after>=max*selected.healthBelow)continue;
        if(this.combat.shield(owner.id,owner.id,evaluate(selected.expression,owner),selected.duration,state.group,undefined,event))state.readyAt=this.now()+selected.cooldown;
      }
    }
  }
  private expire(state:GroupState):void {if(state.armedUntil<=this.now()+1e-8)state.armedUntil=0;}
  private strongest(state:GroupState,source:Actor):Candidate {return state.candidates.slice().sort((a,b)=>evaluate(b.definition.expression,source)-evaluate(a.definition.expression,source)||a.id.localeCompare(b.id))[0]!;}
}
