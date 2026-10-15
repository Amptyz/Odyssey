/** Stable presentation IDs. Gameplay never imports Cocos nodes, sprites or animation clips. */
export interface UnitAppearance {shape:'hero'|'stone'|'spirit';body:string;highlight:string;accent:string}
export const UNIT_APPEARANCES:Record<string,UnitAppearance> = {
  hero:{shape:'hero',body:'#4B8190',highlight:'#6FA5AC',accent:'#E5A16A'},
  moss:{shape:'stone',body:'#A98C7C',highlight:'#C7AE91',accent:'#839E8B'},
  mistling:{shape:'spirit',body:'#9D96B9',highlight:'#CEC2D6',accent:'#F2DAB2'},
  frostling:{shape:'spirit',body:'#78B8D4',highlight:'#D8F7FA',accent:'#9CEAFF'},
};
export const EFFECT_APPEARANCES:Record<string,{color:string;core:string}> = {
  fire:{color:'#E4A16C',core:'#FFF0B6'},ice:{color:'#83CEEE',core:'#E5FFFF'},
  mist:{color:'#B59CC6',core:'#F3C6E1'},shield:{color:'#BFECF2',core:'#E8FDFF'},
};
