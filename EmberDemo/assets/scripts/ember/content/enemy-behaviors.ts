import {ENEMY_ACTIONS,ENEMY_ACTION_SETS,type EnemyActionDefinition} from './enemy-actions';
import {ENEMIES} from './enemies';

export interface EnemyTargetPolicy {
  strategy:'nearest'|'farthest'|'leastTargeted';
  reconsider?:'decision'|'actionEnd'|'sequenceEnd';
  minHoldSeconds?:number;
  /** Nearest-target switches require new distance <= current distance * ratio. */
  switchDistanceRatio?:number;
  avoidLastTarget?:boolean;
  fallback?:'current'|'nearest'|'wait';
}
export interface EnemyCondition {
  hpRatioBelow?:number;hpRatioAbove?:number;distance?:readonly [number,number];
  phase?:1|2;minPlayers?:number;
}
export type EnemySequenceStep=
  |{kind:'action';action:string;unavailable?:'wait'|'skip'|'abort';timeout?:number;afterTimeout?:'skip'|'abort'}
  |{kind:'wait';seconds:number;movement?:'stop'|'chase'}
  |{kind:'target';policy:EnemyTargetPolicy};
export type EnemyDecisionRule={id:string;priority:number;when?:EnemyCondition;once?:boolean;cooldown?:number;targeting?:EnemyTargetPolicy}&
  ({action:string;sequence?:never}|{sequence:string;action?:never});
export interface EnemyBehaviorDefinition {
  targeting:EnemyTargetPolicy;
  rules:readonly EnemyDecisionRule[];
  sequences?:Readonly<Record<string,readonly EnemySequenceStep[]>>;
  /** Default global cooldown for actions in this profile; seconds, unaffected by haste. */
  globalCooldown?:number;
  timeline?:{targeting?:EnemyTargetPolicy;unavailable?:'skip'|'wait';timeout?:number};
}
const nearest:EnemyTargetPolicy={strategy:'nearest',reconsider:'decision'};
const basic=(action:string):EnemyBehaviorDefinition=>({targeting:nearest,rules:[{id:'basic',priority:0,action}]});
const elite=(action:string,skill:string):EnemyBehaviorDefinition=>({...basic(action),rules:[{id:'skill',priority:50,action:skill},{id:'basic',priority:0,action}]});
const boss=(action:string):EnemyBehaviorDefinition=>({...basic(action),timeline:{targeting:{strategy:'leastTargeted'},unavailable:'skip'},rules:[{id:'basic',priority:0,action}]});
/** Profiles are shared definitions. Every mutable timer/target/sequence lives on its enemy instance. */
export const ENEMY_BEHAVIORS:Record<string,EnemyBehaviorDefinition>={
  melee:basic('mossJab'),ranged:basic('mistPearl'),stoneback:basic('carapaceSweep'),reedLancer:basic('reedThrust'),
  sunbud:basic('sunSeed'),frostling:basic('frostNeedle'),shardCrab:basic('pincerCross'),rimeMoth:basic('mothFan'),
  chimeSentry:basic('chimeDart'),snowHare:basic('hareKick'),
  warden:elite('wardenHammer','rootPlates'),bellKeeper:elite('bellPearl','bellEcho'),
  mirrorKnight:elite('mirrorCut','splitEdge'),rimeWeaver:elite('weaverThread','wovenRing'),
  courtyardHeart:boss('hearthPalm'),mirrorRegent:boss('regentScissor'),
  emberRam:{
    targeting:{strategy:'nearest',reconsider:'sequenceEnd',minHoldSeconds:2,switchDistanceRatio:.75},
    globalCooldown:.25,
    rules:[{id:'pressure',priority:50,when:{distance:[2,14]},sequence:'pressure'},{id:'basic',priority:0,action:'ramButt'}],
    sequences:{pressure:[
      {kind:'action',action:'ramLane',unavailable:'abort'},
      {kind:'wait',seconds:.6,movement:'stop'},
      {kind:'target',policy:{strategy:'leastTargeted',avoidLastTarget:true,fallback:'current'}},
      {kind:'action',action:'ramButt',unavailable:'wait',timeout:1.5,afterTimeout:'skip'},
      {kind:'wait',seconds:.45,movement:'stop'},
    ]},
  },
};

export function validateEnemyBehaviors(
  profiles:Readonly<Record<string,EnemyBehaviorDefinition>>=ENEMY_BEHAVIORS,
  actions:Readonly<Record<string,EnemyActionDefinition>>=ENEMY_ACTIONS,
):void {
  const fail=(ok:unknown,path:string):void=>{if(!ok)throw Error(`Invalid enemy behavior ${path}`);};
  const nonnegative=(n:number)=>Number.isFinite(n)&&n>=0;
  const policy=(p:EnemyTargetPolicy,path:string)=>{
    fail(p&&['nearest','farthest','leastTargeted'].includes(p.strategy),`${path}.strategy`);
    fail(p.reconsider===undefined||['decision','actionEnd','sequenceEnd'].includes(p.reconsider),`${path}.reconsider`);
    fail(p.minHoldSeconds===undefined||nonnegative(p.minHoldSeconds),`${path}.minHoldSeconds`);
    fail(p.switchDistanceRatio===undefined||p.switchDistanceRatio>0&&p.switchDistanceRatio<=1,`${path}.switchDistanceRatio`);
    fail(p.fallback===undefined||['current','nearest','wait'].includes(p.fallback),`${path}.fallback`);
    fail(p.avoidLastTarget===undefined||typeof p.avoidLastTarget==='boolean',`${path}.avoidLastTarget`);
  };
  for(const [id,p] of Object.entries(profiles)){
    policy(p.targeting,id);fail(Array.isArray(p.rules)&&p.rules.length>0,`${id}.rules`);
    fail(p.globalCooldown===undefined||nonnegative(p.globalCooldown),`${id}.globalCooldown`);
    if(p.timeline){
      if(p.timeline.targeting)policy(p.timeline.targeting,`${id}.timeline`);
      fail(p.timeline.unavailable===undefined||['skip','wait'].includes(p.timeline.unavailable),`${id}.timeline.unavailable`);
      fail(p.timeline.timeout===undefined||Number.isFinite(p.timeline.timeout)&&p.timeline.timeout>0,`${id}.timeline.timeout`);
    }
    const ids=new Set<string>();
    for(const rule of p.rules){
      fail(!!rule.id&&!ids.has(rule.id),`${id}.rule.id`);ids.add(rule.id);fail(Number.isFinite(rule.priority),`${id}.${rule.id}.priority`);
      fail((rule.action!==undefined)!==(rule.sequence!==undefined),`${id}.${rule.id}.request`);
      if(rule.action!==undefined)fail(actions[rule.action],`${id}.${rule.id}.action`);
      if(rule.sequence!==undefined)fail(p.sequences?.[rule.sequence],`${id}.${rule.id}.sequence`);
      if(rule.targeting)policy(rule.targeting,`${id}.${rule.id}`);
      fail(rule.cooldown===undefined||nonnegative(rule.cooldown),`${id}.${rule.id}.cooldown`);
      fail(rule.once===undefined||typeof rule.once==='boolean',`${id}.${rule.id}.once`);
      const c=rule.when;if(c){
        for(const v of [c.hpRatioBelow,c.hpRatioAbove])fail(v===undefined||Number.isFinite(v)&&v>=0&&v<=1,`${id}.${rule.id}.hp`);
        fail(c.hpRatioAbove===undefined||c.hpRatioBelow===undefined||c.hpRatioAbove<c.hpRatioBelow,`${id}.${rule.id}.hpInterval`);
        fail(!c.distance||c.distance.length===2&&c.distance.every(nonnegative)&&c.distance[0]<=c.distance[1],`${id}.${rule.id}.distance`);
        fail(c.phase===undefined||c.phase===1||c.phase===2,`${id}.${rule.id}.phase`);
        fail(c.minPlayers===undefined||Number.isInteger(c.minPlayers)&&c.minPlayers>0,`${id}.${rule.id}.minPlayers`);
      }
    }
    for(const [name,steps] of Object.entries(p.sequences??{})){
      fail(steps.length>0&&steps.length<=32&&steps.some(s=>s.kind==='action'),`${id}.${name}.steps`);
      for(const step of steps){
        if(step.kind==='action'){
          fail(actions[step.action],`${id}.${name}.action`);
          fail(step.unavailable===undefined||['wait','skip','abort'].includes(step.unavailable),`${id}.${name}.unavailable`);
          fail(step.timeout===undefined||Number.isFinite(step.timeout)&&step.timeout>0,`${id}.${name}.timeout`);
          fail(step.afterTimeout===undefined||['skip','abort'].includes(step.afterTimeout),`${id}.${name}.afterTimeout`);
        }else if(step.kind==='wait'){
          fail(nonnegative(step.seconds),`${id}.${name}.seconds`);
          fail(step.movement===undefined||['stop','chase'].includes(step.movement),`${id}.${name}.movement`);
        }else if(step.kind==='target')policy(step.policy,`${id}.${name}.target`);
        else fail(false,`${id}.${name}.kind`);
      }
    }
  }
  // Check real content only for the production registry; custom registries are useful in isolated tests.
  if(profiles===ENEMY_BEHAVIORS)for(const [id,e] of Object.entries(ENEMIES)){
    const p=profiles[e.ai??e.actionSet];fail(p,`${id}.profile`);
    const set=ENEMY_ACTION_SETS[e.actionSet];fail(set,`${id}.actionSet`);
  }
}
