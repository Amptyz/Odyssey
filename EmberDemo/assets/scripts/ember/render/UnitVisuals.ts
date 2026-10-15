import type { Graphics } from 'cc';
import { UNIT_APPEARANCES,type UnitAppearance } from '../content/appearances';
import { color,disk,polygon } from './Primitives';

// Replace or extend these presentation factories when integrating sprites / animation.
const shapes:Record<UnitAppearance['shape'],(g:Graphics,appearance:UnitAppearance)=>void>={
hero:(g,appearance)=>{
      polygon(g,[{x:-7,y:29},{x:-16,y:5},{x:0,y:1},{x:15,y:5},{x:7,y:29}],appearance.body,'#365966');
      polygon(g,[{x:0,y:26},{x:0,y:1},{x:15,y:5},{x:7,y:29}],appearance.highlight);
      disk(g,0,33,10,'#F2D2AE');polygon(g,[{x:-12,y:35},{x:0,y:48},{x:12,y:35}],'#EADBB7');
      disk(g,3,34,1.5,'#34464B');g.strokeColor=color('#7A624D');g.lineWidth=3;g.moveTo(15,5);g.lineTo(18,35);g.stroke();
      disk(g,18,36,6,appearance.accent);disk(g,18,38,3,'#FFF1BA');

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
