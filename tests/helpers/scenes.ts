import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {DEVELOPER_LOADOUT} from '../../EmberDemo/assets/scripts/ember/content/skills';
import {CAMP,JOURNEYS} from '../../EmberDemo/assets/scripts/ember/content/scenes';
import type {LabId} from '../../EmberDemo/assets/scripts/ember/content/perks';
import type {InteractionKind} from '../../EmberDemo/assets/scripts/ember/content/scenes';
/** Unit-test setup only: seed a rest boundary, so equipment tests isolate transactions. */
export function openMerchantFixture(w:GameWorld,lab?:LabId):void {
 if(w.phase==='ready')w.command({type:'Start',lab});w.phase='camp';w.wave=2;
 for(const p of w.players.values()){w.command({type:'CloseInteraction'},p.id);Object.assign(p.hero,CAMP.merchant,{previous:{...CAMP.merchant}});w.command({type:'Interact'},p.id);}
}
/** Isolated combat fixtures intentionally seed a claimed initial ember with NO passive,
 * preventing unrelated randomly offered stats from changing damage assertions.
 * Normal command-only camp/claim/embark paths are covered in scenes.test.ts. */
export function startCombatFixture(w:GameWorld,wave=1):void {
 // Mechanics fixtures explicitly opt into skills; ordinary Start/Restart remain empty.
 for(const p of w.players.values())for(const slot of ['Q','W','E','R'] as const)
  if(p.loadout[slot]===null&&!Object.values(p.loadout).includes(DEVELOPER_LOADOUT[slot]))p.loadout[slot]=DEVELOPER_LOADOUT[slot];
 if(w.phase==='ready')w.command({type:'Start'});w.wave=wave-1;
 // Only seed configured places; other boundaries depart directly from a cleared level.
 w.phase=wave===1||JOURNEYS[w.mapId].rests[w.wave]?'camp':'cleared';
 const departure=w.phase==='camp'?CAMP.departure:w.map.waves[w.wave-1]!.level!.exit;
 for(const p of w.players.values()){
   p.panel=undefined;p.interactionId=undefined;p.pendingSkill=undefined;p.choices=[];
   if(!p.claimed.includes('camp:0:ember'))p.claimed.push('camp:0:ember');
   Object.assign(p.hero,{x:departure.x,y:departure.y},{previous:{x:departure.x,y:departure.y}});
 }
 w.command({type:'Interact'},w.hostId);
}
export function interactFixture(w:GameWorld,kind:InteractionKind,id='hero'):void {
 const node=w.snapshot(id).scene.interactions.find(n=>n.kind===kind&&!n.claimed);if(!node)throw Error(`No ${kind} in ${w.phase}/${w.wave}`);
 w.command({type:'CloseInteraction'},id);Object.assign(w.players.get(id)!.hero,{x:node.x,y:node.y,previous:{x:node.x,y:node.y}});w.command({type:'Interact'},id);
}
export function departFixture(w:GameWorld):void {
 const node=w.snapshot().scene.interactions.find(n=>n.kind==='departure')!;
 for(const p of w.players.values()){w.command({type:'CloseInteraction'},p.id);Object.assign(p.hero,{x:node.x,y:node.y,previous:{x:node.x,y:node.y}});}
 w.command({type:'Interact'},w.hostId);
}
export function chooseFixture(w:GameWorld,id='hero'):void {
 interactFixture(w,'ember',id);const p=w.players.get(id)!,c=p.choices.find(c=>c.kind==='perk')??p.choices[0]!;
 w.command({type:'ChooseReward',choiceId:c.id},id);if(p.pendingSkill)w.command({type:'ConfirmSkill',slot:'Q'},id);
}
