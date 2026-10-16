import type {EnemyKind} from '../content/enemies';
interface MonsterPalette {body:string;light:string;dark:string;accent:string;gold:string;height:number}
const p=(body:string,light:string,accent:string,height:number):MonsterPalette=>({body,light,accent,height,dark:'#60757A',gold:'#D9C384'});
const PALETTES:Record<EnemyKind,MonsterPalette>={
 melee:p('#B49B82','#D5C7A9','#86A58B',54),ranged:p('#9BB8C7','#E8DFC8','#C3AECF',53),stoneback:p('#A4AF95','#CDC8AD','#879A80',43),reedLancer:p('#D6CDB4','#E6DFCB','#91A57D',65),sunbud:p('#D99D79','#E6D08D','#86A17D',58),frostling:p('#9FCBD6','#E0EFED','#719DAB',66),shardCrab:p('#90B9C1','#D7E5E1','#71899D',46),rimeMoth:p('#A4B9C0','#D5E7E3','#B9B6D0',55),chimeSentry:p('#8BA6B5','#D9DFD3','#D9C794',74),snowHare:p('#E1E8DF','#EAF0E7','#9AB5C7',58),warden:p('#A8B19D','#D4C7AA','#82A082',87),emberRam:p('#C6AD8C','#E4D7BD','#8FA681',65),bellKeeper:p('#D5C79D','#E6DCC0','#ACA7BD',80),mirrorKnight:p('#9DBCC5','#D4E4E0','#687F99',82),rimeWeaver:p('#B1D4D5','#E4EBDD','#AEA8C7',79),courtyardHeart:p('#D8CCB3','#E9DDC4','#D99B79',120),mirrorRegent:p('#9DBFC9','#E0ECE7','#7586A6',137),
};
export const colourForMonster=(kind:EnemyKind):MonsterPalette=>PALETTES[kind];
