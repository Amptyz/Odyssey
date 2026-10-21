/** Cosmetic only. Stable IDs travel in commands/checkpoints, never combat attributes. */
export const HERO_PALETTES = {
  ash:{name:'灰烬',color:'#837C98',cloth:[0.48,0.44,0.57,0]},
  moss:{name:'苔青',color:'#80B6A0',cloth:[0.28,0.53,0.43,1]},
  frost:{name:'霜蓝',color:'#86B6DB',cloth:[0.30,0.47,0.66,1]},
  wine:{name:'暗绯',color:'#CF8D99',cloth:[0.62,0.30,0.38,1]},
  ochre:{name:'赭金',color:'#D4B875',cloth:[0.62,0.48,0.25,1]},
  violet:{name:'暮紫',color:'#B69AD9',cloth:[0.50,0.34,0.65,1]},
} as const;
export type HeroPaletteId=keyof typeof HERO_PALETTES;
export const HERO_PALETTE_IDS=Object.keys(HERO_PALETTES) as HeroPaletteId[];
export const DEFAULT_HERO_PALETTE:HeroPaletteId='ash';
export function isHeroPaletteId(value:unknown):value is HeroPaletteId {
  return typeof value==='string'&&Object.prototype.hasOwnProperty.call(HERO_PALETTES,value);
}
export function defaultHeroPalette(index:number):HeroPaletteId {
  return HERO_PALETTE_IDS[index%HERO_PALETTE_IDS.length]??DEFAULT_HERO_PALETTE;
}
