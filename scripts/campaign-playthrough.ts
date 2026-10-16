import {writeFileSync} from 'node:fs';
import {GameWorld,type Unit} from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {MAPS,type MapId} from '../EmberDemo/assets/scripts/ember/content/maps';
import {equipment,SHOP_CATALOG,type EquipmentId} from '../EmberDemo/assets/scripts/ember/content/equipment';
import {enemy} from '../EmberDemo/assets/scripts/ember/content/enemies';
import {overlaps} from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import {distance,direction,type Vec2} from '../EmberDemo/assets/scripts/ember/utils/math';
const requested=process.env.EMBER_CAMPAIGN_BUILD?.split(',');
if(requested&&(requested.length!==6||new Set(requested).size!==6||requested.some(id=>!SHOP_CATALOG.includes(id as EquipmentId))))throw Error('EMBER_CAMPAIGN_BUILD must contain six different catalog IDs');
const build:EquipmentId[]=(requested as EquipmentId[]|undefined)??['staff','bow','robe','plate','circlet','hood'];
const preference=['burn','reserve','double','leech','arc','heavyHitter','rhythm','swift','mysticPunch','dawnbringer','infernalConduit','circleOfDeath'];
const outcomes=[];
function buy(world:GameWorld):void {for(const id of build)if(!world.equipment.inventory.has(id)&&world.equipment.gold>=equipment(id).price)world.command({type:'BuyEquipment',equipmentId:id});}
function dodge(world:GameWorld,target:Unit):Vec2|undefined {
 const hero=world.hero,snapshot=world.enemies.snapshot(),warnings=snapshot.warnings.filter(w=>w.expiresAt>=world.time&&w.triggerAt-world.time<1.5);
 const atRisk=warnings.some(w=>overlaps(w.shape,{x:hero.x,y:hero.y,radius:hero.radius+.4})),bulletRisk=snapshot.projectiles.some(p=>distance(p,hero)<2);
 const range=world.stats.attackRange,desired=Math.max(4,range*.76),near=distance(hero,target),mustMove=atRisk||bulletRisk||near<desired-1.2;
 if(!mustMove)return;
 const toward=direction(target,hero),base=Math.atan2(toward.y,toward.x);let best:Vec2|undefined,bestScore=-Infinity;
 for(const offset of [0,.55,-.55,1.1,-1.1,Math.PI/2,-Math.PI/2,Math.PI]){
  const angle=base+offset,requested={x:hero.x+Math.cos(angle)*3,y:hero.y+Math.sin(angle)*3},candidate=world.nav.sweep(hero,requested,hero.radius);
  if(distance(candidate,hero)<1)continue;
  const danger=warnings.filter(w=>overlaps(w.shape,{...candidate,radius:hero.radius+.45})).length,enemyDistance=distance(candidate,target),bullets=snapshot.projectiles.filter(p=>distance(p,candidate)<1.6).length;
  const score=-danger*100-bullets*40-Math.abs(enemyDistance-desired)*3+distance(candidate,hero)-Math.abs(offset)*.1;
  if(score>bestScore){bestScore=score;best=candidate;}
 }
 return best;
}
for(const mapId of (Object.keys(MAPS) as MapId[]).filter(id=>!process.env.EMBER_CAMPAIGN_MAP||id===process.env.EMBER_CAMPAIGN_MAP)){
 const world=new GameWorld(1234,mapId);world.command({type:'Start'});const levels:{wave:number;time:number;hp:number;gold:number}[]=[],seen=new Set<string>(),diagnostics:unknown[]=[];let nextDecision=0,nextDiagnostic=0;
 for(let tick=0;tick<30*900&&world.phase!=='victory'&&world.phase!=='defeat';tick++){
  if(world.phase==='shop'){buy(world);world.command({type:'LeaveShop'});nextDecision=world.time;}
  if(world.phase==='reward'){
   levels.push({wave:world.wave,time:world.time,hp:world.hero.hp,gold:world.equipment.gold});const choices=world.choices;
   const guard=choices.find(c=>c.kind==='skill'&&c.skillId==='ironGuard');
   const perk=preference.map(id=>choices.find(c=>c.kind==='perk'&&c.perkId===id)).find(Boolean)??choices.find(c=>c.kind==='perk');const choice=guard??perk??choices[0]!;
   world.command({type:'ChooseReward',choiceId:choice.id});if(world.pendingSkill)world.command({type:'ConfirmSkill',slot:'E'});continue;
  }
  if(world.phase==='fighting'&&world.time>=nextDecision){
   nextDecision=world.time+.16;const hero=world.hero,enemies=Array.from(world.actors.values()).filter((a):a is Unit=>a.team==='enemy'&&a.alive).sort((a,b)=>distance(a,hero)-distance(b,hero)||a.id.localeCompare(b.id));const target=enemies[0];
   if(target&&world.time>=nextDiagnostic){nextDiagnostic=world.time+10;diagnostics.push({time:world.time,wave:world.wave,hero:{x:hero.x,y:hero.y,hp:hero.hp,path:hero.path.slice(0,4),velocity:hero.velocity},target:{id:target.id,kind:target.kind,x:target.x,y:target.y,hp:target.hp,path:target.path.slice(0,4)},gap:distance(hero,target),navClear:world.nav.clear(hero,target),blocker:world.collision.blocker(hero,target,.1),pose:world.enemies.snapshot().units.find(p=>p.id===target.id),warnings:world.enemies.snapshot().warnings.length});if(diagnostics.length>30)diagnostics.shift();}
   for(const pose of world.enemies.snapshot().units)if(pose.awake)seen.add(pose.kind);
   if(!target){world.command({type:'AttackInput'});world.command({type:'MoveTo',point:world.snapshot().level.exit});}
   else {
    const gap=distance(hero,target),escape=dodge(world,target),range=world.stats.attackRange;
    if(escape)world.command({type:'MoveTo',point:escape});else if(gap>range*.8||!world.nav.clear(hero,target))world.command({type:'MoveTo',point:target});else world.command({type:'Stop'});
    const flight=gap/12,aim={x:target.x+target.velocity.x*flight,y:target.y+target.velocity.y*flight};world.command({type:'AttackInput',point:aim});
    if(gap<12&&world.nav.clear(hero,target,.1))world.command({type:'CastSlot',slot:'Q',point:aim});
    if(gap<11)world.command({type:'CastSlot',slot:'W',point:hero});
    if(world.loadout.E==='ironGuard'&&gap<10)world.command({type:'CastSlot',slot:'E',point:hero});
    if(gap<3.6)world.command({type:'CastSlot',slot:'R',point:hero});
    if(escape&&world.enemies.snapshot().warnings.some(w=>w.triggerAt-world.time<.7&&overlaps(w.shape,hero))&&world.loadout.E==='dash')world.command({type:'CastSlot',slot:'E',point:escape});
   }
  }
  world.advance(1/30);
 }
 const lastDamage=world.combat.history.filter(e=>e.type==='OnDamaged'&&e.sourceId==='hero').at(-1),remaining=Array.from(world.actors.values()).filter(a=>a.team==='enemy'&&a.alive);
 outcomes.push({mapId,seed:world.seed,phase:world.phase,wave:world.wave,time:world.time,hp:world.hero.hp,maxHp:world.hero.maxHp,equipment:{...world.equipment.equipped},purchaseOrder:[...world.equipment.purchaseOrder],perks:Array.from(world.combat.perks),loadout:{...world.loadout},kills:world.combat.metrics.kills,levels,diagnostics,observedEnemies:Array.from(seen),remaining:remaining.map(a=>({kind:a.kind,hp:a.hp,maxHp:a.maxHp})),lastDamage:lastDamage?{amount:lastDamage.amount,attacker:lastDamage.targetId,cause:lastDamage.cause,damageType:lastDamage.damageType}:undefined});
 console.log(`${mapId}: ${world.phase}, level ${world.wave}/5, ${world.time.toFixed(1)}s, HP ${world.hero.hp.toFixed(1)}/${world.hero.maxHp}, remaining ${remaining.length}`);
}
writeFileSync(requested?'reports/equipment-campaign.json':'reports/campaign-playthrough.json',JSON.stringify({scope:'Normal authoritative GameWorld commands only; no developer options, HP/damage/cooldown mutations or forced progress. Bot reads snapshots for movement/dodging and uses normal shop/reward/exit rules.',status:outcomes.every(o=>o.phase==='victory')?'passed':'incomplete',outcomes},null,2)+'\n');
if(outcomes.some(o=>o.phase!=='victory'))process.exitCode=1;
