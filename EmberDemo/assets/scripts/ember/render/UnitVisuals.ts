import type { Graphics } from 'cc';
import { UNIT_APPEARANCES,type UnitAppearance } from '../content/appearances';
import { EQUIPMENT_APPEARANCES,type EquipmentAppearance } from '../content/appearances';
import { equipment,EQUIPMENT_CATEGORIES,type EquipmentAppearanceLoadout } from '../content/equipment';
import { color,disk,polygon } from './Primitives';

// Replace or extend these presentation factories when integrating sprites / animation.
const shapes:Record<UnitAppearance['shape'],(g:Graphics,appearance:UnitAppearance)=>void>={
hero:(g,appearance)=>{
      polygon(g,[{x:-7,y:29},{x:-16,y:5},{x:0,y:1},{x:15,y:5},{x:7,y:29}],appearance.body,'#365966');
      polygon(g,[{x:0,y:26},{x:0,y:1},{x:15,y:5},{x:7,y:29}],appearance.highlight);
      disk(g,0,33,10,'#F2D2AE');polygon(g,[{x:-12,y:35},{x:0,y:48},{x:12,y:35}],'#EADBB7');
      disk(g,3,34,1.5,'#34464B');

},
stone:(g,appearance)=>{
      polygon(g,[{x:-18,y:12},{x:-13,y:31},{x:0,y:40},{x:15,y:29},{x:18,y:10},{x:0,y:3}],appearance.body,'#7C7665');
      polygon(g,[{x:-14,y:29},{x:0,y:40},{x:15,y:29},{x:2,y:24}],appearance.highlight);
      disk(g,-6,22,3,'#FAE7A4');disk(g,7,22,3,'#FAE7A4');
      polygon(g,[{x:-14,y:29},{x:-19,y:42},{x:-6,y:34}],appearance.accent);

},
spirit:(g,appearance)=>{
      polygon(g,[{x:0,y:45},{x:17,y:25},{x:0,y:4},{x:-17,y:25}],appearance.body,'#716F94');
      polygon(g,[{x:0,y:45},{x:17,y:25},{x:0,y:26}],appearance.highlight);disk(g,0,25,6,appearance.accent);disk(g,0,25,2,'#71667F');
      g.strokeColor=color('#C5B5D9');g.lineWidth=2;g.ellipse(0,13,22,6);g.stroke();
},
};
export function drawUnit(g:Graphics,id:string):void {
 const appearance=UNIT_APPEARANCES[id];if(!appearance)throw new Error('Unknown unit appearance: '+id);
 g.clear();g.fillColor=color('#4A645744');g.ellipse(4,-2,19,9);g.fill();shapes[appearance.shape](g,appearance);
}

const gearShapes:Record<EquipmentAppearance['shape'],(g:Graphics,a:EquipmentAppearance)=>void>={
  sword:(g,a)=>{polygon(g,[{x:19,y:9},{x:15,y:34},{x:20,y:45},{x:25,y:34},{x:23,y:9}],a.color);polygon(g,[{x:12,y:12},{x:28,y:12},{x:28,y:16},{x:12,y:16}],a.accent);},
  staff:(g,a)=>{g.strokeColor=color(a.color);g.lineWidth=4;g.moveTo(20,1);g.lineTo(20,40);g.stroke();disk(g,20,41,7,a.accent);disk(g,20,42,3,'#FFF5D2');},
  bow:(g,a)=>{g.strokeColor=color(a.color);g.lineWidth=4;g.moveTo(18,4);g.quadraticCurveTo(42,24,18,44);g.stroke();g.lineWidth=1;g.strokeColor=color(a.accent);g.moveTo(18,4);g.lineTo(18,44);g.stroke();},
  shield:(g,a)=>{polygon(g,[{x:10,y:34},{x:29,y:34},{x:30,y:12},{x:20,y:2},{x:9,y:12}],a.color,a.accent);polygon(g,[{x:18,y:29},{x:22,y:29},{x:22,y:10},{x:18,y:10}],a.accent);},
  armor:(g,a)=>{polygon(g,[{x:-15,y:30},{x:14,y:30},{x:13,y:10},{x:0,y:5},{x:-14,y:10}],a.color,a.accent);disk(g,-16,27,7,a.accent);disk(g,15,27,7,a.accent);},
  robe:(g,a)=>{polygon(g,[{x:-9,y:28},{x:9,y:28},{x:19,y:2},{x:-19,y:2}],a.color,a.accent);polygon(g,[{x:-2,y:27},{x:2,y:27},{x:4,y:3},{x:-4,y:3}],a.accent);},
  leather:(g,a)=>{polygon(g,[{x:-10,y:28},{x:10,y:28},{x:12,y:7},{x:-12,y:7}],a.color,a.accent);g.strokeColor=color(a.accent);g.lineWidth=3;g.moveTo(-9,26);g.lineTo(11,9);g.stroke();},
  helm:(g,a)=>{polygon(g,[{x:-13,y:33},{x:-12,y:44},{x:0,y:49},{x:12,y:44},{x:13,y:33}],a.color,a.accent);polygon(g,[{x:-2,y:44},{x:2,y:44},{x:2,y:31},{x:-2,y:31}],a.accent);},
  circlet:(g,a)=>{g.strokeColor=color(a.color);g.lineWidth=4;g.moveTo(-10,39);g.lineTo(0,37);g.lineTo(10,39);g.stroke();disk(g,0,38,4,a.accent);},
  hood:(g,a)=>{polygon(g,[{x:-13,y:32},{x:-14,y:43},{x:0,y:51},{x:14,y:43},{x:13,y:32},{x:8,y:39},{x:0,y:43},{x:-8,y:39}],a.color,a.accent);},
};
/** Layer order is stable; future sprites can implement the same slot/appearance contract. */
export function drawHero(g:Graphics,loadout:EquipmentAppearanceLoadout):void {
  drawUnit(g,'hero');
  for(const slot of ['body','head','weapon'] as const){const id=loadout[slot];if(!id)continue;const a=EQUIPMENT_APPEARANCES[equipment(id).appearance]!;gearShapes[a.shape](g,a);}
}
export function equipmentVisualKey(loadout:EquipmentAppearanceLoadout):string{return EQUIPMENT_CATEGORIES.map(s=>loadout[s]??'').join(':');}
