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

/** Stable appearance IDs are independent of item IDs and gameplay values. */
export interface EquipmentAppearance {layer:'weapon'|'body'|'head';shape:'sword'|'staff'|'bow'|'shield'|'armor'|'robe'|'leather'|'helm'|'circlet'|'hood';color:string;accent:string}
export const EQUIPMENT_APPEARANCES:Record<string,EquipmentAppearance>={
  copperSword:{layer:'weapon',shape:'sword',color:'#E8C69B',accent:'#BD6E4E'},
  starStaff:{layer:'weapon',shape:'staff',color:'#BAA1E5',accent:'#8DEBFF'},
  windBow:{layer:'weapon',shape:'bow',color:'#CDA87C',accent:'#BDE1A7'},
  towerShield:{layer:'weapon',shape:'shield',color:'#779DBB',accent:'#E2E6C2'},
  copperPlate:{layer:'body',shape:'armor',color:'#AA705E',accent:'#E5BD82'},
  starRobe:{layer:'body',shape:'robe',color:'#7663B0',accent:'#D6C4F4'},
  rangerLeather:{layer:'body',shape:'leather',color:'#608C6D',accent:'#D4C596'},
  ironHelm:{layer:'head',shape:'helm',color:'#8CA7B8',accent:'#F1D4A0'},
  arcaneCirclet:{layer:'head',shape:'circlet',color:'#E5C882',accent:'#C2A0F1'},
  rangerHood:{layer:'head',shape:'hood',color:'#527D65',accent:'#BDD29B'},
};
