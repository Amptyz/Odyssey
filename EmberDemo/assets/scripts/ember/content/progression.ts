/** Economy is deterministic; maps choose when shops open. Currency lasts for one run. */
export const ECONOMY={startingGold:160,waveGold:100,waveGoldStep:20} as const;
export function waveGold(wave:number):number{return ECONOMY.waveGold+(wave-1)*ECONOMY.waveGoldStep;}
