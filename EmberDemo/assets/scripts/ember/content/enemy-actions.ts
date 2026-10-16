import {ENEMIES} from './enemies';
import type {ValueExpression} from '../combat-core/attributes/AttributeSet';
import type {DamageType} from '../combat-core/types';
export type EnemyActionShape=
 |{kind:'sector';radius:number;arc:number}
 |{kind:'rectangle';length:number;width:number}
 |{kind:'circle';radius:number}
 |{kind:'ring';radius:number;innerRadius:number}
 |{kind:'projectile';radius:number;speed:number;range:number;spread?:readonly number[]}
 |{kind:'dash';radius:number;speed:number;length:number};
export interface EnemyActionStep {at:number;sampleAt?:number;location?:'self'|'target';angle?:number;shape:EnemyActionShape;expression:ValueExpression;damageType:DamageType;slow?:{power:number;duration:number};maxHits?:number;active?:number}
export interface EnemyActionDefinition {id:string;kind:'attack'|'spell';windup:number;recovery:number;cooldown:number;firstDelay:number;range:number;minimumRange?:number;edgeMargin?:number;steps:readonly EnemyActionStep[];phase2?:readonly EnemyActionStep[];phase2Duration?:number;maxHits?:number;colour:string}
const deg=(v:number)=>v*Math.PI/180;
const sector=(radius:number,arc:number):EnemyActionShape=>({kind:'sector',radius,arc:deg(arc)});
const rect=(length:number,width:number):EnemyActionShape=>({kind:'rectangle',length,width});
const circle=(radius:number):EnemyActionShape=>({kind:'circle',radius});
const bullet=(radius:number,speed:number,range:number,spread?:readonly number[]):EnemyActionShape=>({kind:'projectile',radius,speed,range,spread:spread?.map(deg)});
const step=(at:number,shape:EnemyActionShape,expression:ValueExpression,damageType:DamageType='physical',extra:Partial<EnemyActionStep>={}):EnemyActionStep=>({at,shape,expression,damageType,...extra});
function action(id:string,windup:number,recovery:number,range:number,steps:EnemyActionStep[],extra:Partial<EnemyActionDefinition>={}):EnemyActionDefinition{return {id,kind:'attack',windup,recovery,cooldown:windup+recovery,firstDelay:0,range,steps,colour:'#B48B68',...extra};}
const spell=(id:string,windup:number,recovery:number,range:number,cd:number,first:number,steps:EnemyActionStep[],extra:Partial<EnemyActionDefinition>={})=>action(id,windup,recovery,range,steps,{kind:'spell',cooldown:cd,firstDelay:first,colour:'#A8B8CA',...extra});
export const ENEMY_ACTIONS:Record<string,EnemyActionDefinition>={
 mossJab:action('mossJab',.45,1.15,.95,[step(.45,sector(.95,90),{attackDamage:1},'physical',{active:.1})]),
 mistPearl:action('mistPearl',.75,2.25,6.5,[step(.75,bullet(.18,6,6.5),{flat:4,abilityPower:.6},'magic')],{colour:'#B5A6CF'}),
 carapaceSweep:action('carapaceSweep',.8,1.7,1.05,[step(.8,sector(1.05,160),{attackDamage:1.2},'physical',{active:.15})]),
 reedThrust:action('reedThrust',.85,1.65,2.7,[step(.85,rect(2.7,.45),{attackDamage:1.1},'physical',{active:.1})]),
 sunSeed:action('sunSeed',1.1,2.9,5.5,[step(1.1,circle(1.05),{flat:6,abilityPower:.8},'magic',{location:'target'})],{colour:'#D9A477'}),
 frostNeedle:action('frostNeedle',.9,2.6,6,[step(.9,bullet(.12,7,6),{flat:3,abilityPower:.6},'magic',{slow:{power:.8,duration:1}})],{colour:'#8AC7D8'}),
 pincerCross:action('pincerCross',.6,1.4,1.35,[step(.6,sector(1.35,80),{attackDamage:.8},'physical',{angle:deg(-35),active:.1}),step(.85,sector(1.35,80),{attackDamage:.8},'physical',{angle:deg(35),active:.05})],{maxHits:2}),
 mothFan:action('mothFan',.95,3.05,5,[step(.95,bullet(.12,5.5,5,[-25,0,25]),{flat:4,abilityPower:.5},'magic')],{colour:'#BCB4D5',maxHits:1}),
 chimeDart:action('chimeDart',1.2,3.3,8,[step(1.2,bullet(.1,10,8),{attackDamage:1.3})]),
 hareKick:action('hareKick',.35,.65,.8,[step(.35,sector(.8,70),{attackDamage:.8},'physical',{active:.08})]),
 wardenHammer:action('wardenHammer',.85,2.15,1.8,[step(.85,sector(1.8,120),{attackDamage:1},'physical',{active:.15})]),
 ramButt:action('ramButt',.65,1.85,1.2,[step(.65,sector(1.2,90),{attackDamage:1},'physical',{active:.1})]),
 bellPearl:action('bellPearl',.85,3.15,6.5,[step(.85,bullet(.18,5.5,6.5),{flat:5,abilityPower:.5},'magic')],{colour:'#C0AFCD'}),
 mirrorCut:action('mirrorCut',.8,2.2,2.2,[step(.8,sector(2.2,110),{attackDamage:1},'physical',{active:.1})]),
 weaverThread:action('weaverThread',.9,3.1,6,[step(.9,bullet(.14,6,6),{flat:4,abilityPower:.5},'magic')],{colour:'#A2D0D3'}),
 hearthPalm:action('hearthPalm',1,3,2.4,[step(1,sector(2.4,120),{attackDamage:1},'physical',{active:.15})]),
 regentScissor:action('regentScissor',1.1,3.4,2.6,[step(1.1,sector(2.6,100),{attackDamage:1},'physical',{active:.15})]),
 rootPlates:spell('rootPlates',1.65,.35,5,10,4,[0,.35,.7].map(t=>step(t+.95,circle(.85),{flat:12,abilityPower:.8},'magic',{sampleAt:t,location:'target'})),{maxHits:2,colour:'#8BA68A'}),
 ramLane:spell('ramLane',1.1,1.58,7,9,3,[step(1.1,{kind:'dash',radius:.48,speed:7,length:4},{flat:8,attackDamage:1.1})],{minimumRange:2,colour:'#CBA476'}),
 bellEcho:spell('bellEcho',2,.3,6.5,12,5,[1.05,2].map(at=>step(at,circle(1.15),{flat:10,abilityPower:.7},'magic',{location:'target'})),{maxHits:2,colour:'#B7A3C7'}),
 splitEdge:spell('splitEdge',1.75,.4,5,11,4,[step(1.1,rect(5,.65),{flat:8,attackDamage:.9}),step(1.75,rect(5,.65),{flat:6,abilityPower:.8},'magic',{angle:deg(60)})],{maxHits:2,colour:'#9FBCCB'}),
 wovenRing:spell('wovenRing',1.2,.35,6,12,5,[step(1.2,{kind:'ring',radius:2,innerRadius:.9},{flat:12,abilityPower:.8},'magic',{location:'target'})],{edgeMargin:2.5,colour:'#A9D0D7'}),
 hearthFurrows:spell('hearthFurrows',1.2,.45,9,8,2,[-35,0,35].map(a=>step(1.2,rect(7,.75),{flat:12,attackDamage:.9},'physical',{angle:deg(a)})),{maxHits:1,colour:'#D5AB79'}),
 hearthSeeds:spell('hearthSeeds',1.6,.4,8,10,6,[0,.5].map(t=>step(t+1.1,circle(1.2),{flat:10,abilityPower:.9},'magic',{sampleAt:t,location:'target'})),{maxHits:2,phase2:[0,.5,1].map(t=>step(t+1.1,circle(1.2),{flat:10,abilityPower:.9},'magic',{sampleAt:t,location:'target'})),phase2Duration:2.5,colour:'#DCA280'}),
 hearthVent:spell('hearthVent',1.4,1.8,9,14,12,[step(1.4,circle(3.2),{flat:18,abilityPower:.8},'magic')],{colour:'#D5B981'}),
 regentLanes:spell('regentLanes',1.25,.55,9,10,2,[step(1.25,rect(9,.8),{flat:14,abilityPower:.8},'magic')],{phase2:[step(1.25,rect(9,.8),{flat:14,abilityPower:.8},'magic'),step(2.15,rect(9,.8),{flat:14,abilityPower:.8},'magic',{angle:deg(70)})],phase2Duration:2.6,maxHits:2,colour:'#A1C9DA'}),
 regentHalo:spell('regentHalo',1.5,.5,9,13,7,[step(1.5,{kind:'ring',radius:3.6,innerRadius:1.5},{flat:16,abilityPower:.9},'magic')],{edgeMargin:4,phase2:[step(1.5,{kind:'ring',radius:3.6,innerRadius:1.5},{flat:16,abilityPower:.9},'magic'),step(2.3,bullet(.22,6,8),{flat:8,abilityPower:.6},'magic',{sampleAt:1.5})],phase2Duration:2.8,maxHits:2,colour:'#ABD6DD'}),
 regentMarks:spell('regentMarks',2.4,.4,8,12,13,[1.2,2.4].map(at=>step(at,circle(1.25),{flat:18,abilityPower:.7},'magic',{location:'target'})),{maxHits:2,colour:'#AFB9D6'}),
 regentOath:spell('regentOath',1.3,.5,9,22,4,[step(1.3,rect(8,.6),{flat:30},'true')],{colour:'#E8EEE7'}),
};
export const ENEMY_ACTION_SETS:Record<string,{attack:string;skills:readonly string[]}>= {
 melee:{attack:'mossJab',skills:[]},ranged:{attack:'mistPearl',skills:[]},stoneback:{attack:'carapaceSweep',skills:[]},reedLancer:{attack:'reedThrust',skills:[]},sunbud:{attack:'sunSeed',skills:[]},frostling:{attack:'frostNeedle',skills:[]},shardCrab:{attack:'pincerCross',skills:[]},rimeMoth:{attack:'mothFan',skills:[]},chimeSentry:{attack:'chimeDart',skills:[]},snowHare:{attack:'hareKick',skills:[]},
 warden:{attack:'wardenHammer',skills:['rootPlates']},emberRam:{attack:'ramButt',skills:['ramLane']},bellKeeper:{attack:'bellPearl',skills:['bellEcho']},mirrorKnight:{attack:'mirrorCut',skills:['splitEdge']},rimeWeaver:{attack:'weaverThread',skills:['wovenRing']},courtyardHeart:{attack:'hearthPalm',skills:['hearthFurrows','hearthSeeds','hearthVent']},mirrorRegent:{attack:'regentScissor',skills:['regentLanes','regentHalo','regentMarks','regentOath']},
};

/** Run from validateContent; rejects inert action references and invalid timings before combat. */
export function validateEnemyActions():void {
 const finite=(n:number)=>Number.isFinite(n)&&n>=0;
 const positive=(n:number)=>Number.isFinite(n)&&n>0;
 for(const [id,a] of Object.entries(ENEMY_ACTIONS)){
  if(id!==a.id||!positive(a.windup)||!positive(a.recovery)||!positive(a.cooldown)||!finite(a.firstDelay)||!positive(a.range)||!a.steps.length)throw Error(`Invalid enemy action ${id}`);
  for(const steps of [a.steps,a.phase2??[]])for(const s of steps){
   if(!positive(s.at)||!finite(s.sampleAt??0)||(s.sampleAt??0)>=s.at)throw Error(`Invalid enemy action ${id} timing`);
   for(const value of Object.values(s.expression))if(typeof value!=='number'||!Number.isFinite(value))throw Error(`Invalid enemy action ${id} expression`);
   const allowed=['flat','attackDamage','abilityPower','sourceMaxHealth','sourceMissingHealth','cap'];
   if(Object.keys(s.expression).some(k=>!allowed.includes(k)))throw Error(`Invalid enemy action ${id} expression key`);
   const shape=s.shape;if(!['physical','magic','true'].includes(s.damageType))throw Error(`Invalid enemy action ${id} damage type`);
   for(const [key,value] of Object.entries(shape))if(typeof value==='number'&&!positive(value))throw Error(`Invalid enemy action ${id} shape ${key}`);
   if(shape.kind==='ring'&&shape.innerRadius>=shape.radius)throw Error(`Invalid enemy action ${id} ring`);
   if(shape.kind==='sector'&&shape.arc>Math.PI*2)throw Error(`Invalid enemy action ${id} arc`);
   if(s.slow&&(!positive(s.slow.duration)||!positive(s.slow.power)||s.slow.power>1))throw Error(`Invalid enemy action ${id} slow`);
  }
 }
 for(const [id,cfg] of Object.entries(ENEMIES))if(!ENEMY_ACTION_SETS[cfg.actionSet]||cfg.appearance!==id)throw Error(`Invalid enemy template ${id} action/visual`);
 for(const [id,set] of Object.entries(ENEMY_ACTION_SETS))if(ENEMY_ACTIONS[set.attack]?.kind!=='attack'||!set.skills.every(skill=>ENEMY_ACTIONS[skill]?.kind==='spell'))throw Error(`Invalid enemy action set ${id}`);
}
