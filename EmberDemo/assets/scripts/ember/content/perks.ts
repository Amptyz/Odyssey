import type { PerkDefinition, PerkId } from '../combat-core/types';
export const PERKS: readonly PerkDefinition[] = [
  { id:'burn', name:'燃烧弹', color:'#E3A16D', description:'烬火弹附加 3 秒灼烧，每秒造成 9 点伤害。', rules:[{event:'OnHit',skillId:'Q',causes:['skill'],effect:{type:'burn',damage:9,duration:3}}] },
  { id:'corpse', name:'尸爆', color:'#D69B85', description:'燃烧中的敌人死亡时爆炸，对 2.6 格内敌人造成 30 点伤害。', rules:[{event:'OnKill',targetBurning:true,effect:{type:'explode',damage:30,radius:2.6}}] },
  { id:'arc', name:'电弧', color:'#95B8E5', description:'技能或爆炸命中时，向 3.2 格内另一个敌人弹射 16 点电击。电击不再弹射。', rules:[{event:'OnHit',causes:['skill','explosion'],effect:{type:'arc',damage:16,radius:3.2}}] },
  { id:'double', name:'双重施法', color:'#D3B1DF', description:'每次 Q 额外发射一枚偏转火焰弹，两枚共享本次施法加成。', rules:[{event:'OnSkillCast',skillId:'Q',effect:{type:'extraShot'}}] },
  { id:'swift', name:'迅捷步伐', color:'#9FCAB6', description:'移动速度提升 15%。', speedMultiplier:1.15, rules:[] },
  { id:'rhythm', name:'战斗节奏', color:'#E1CA8D', description:'普通攻击间隔降低 15%。', attackMultiplier:0.85, rules:[] },
  { id:'reserve', name:'奥能储备', color:'#A7B5DE', description:'施放 W 后，下一次 Q 伤害提高 50%，包括双重施法。', rules:[{event:'OnSkillCast',skillId:'W',effect:{type:'prime'}},{event:'OnSkillCast',skillId:'Q',sourcePrimed:true,effect:{type:'empower',multiplier:1.5}}] },
  { id:'leech', name:'嗜战恢复', color:'#B3C38C', description:'击杀恢复 12 点生命；每 1.5 秒最多触发一次。', rules:[{event:'OnKill',effect:{type:'heal',amount:12,cooldown:1.5}}] },
];
export function perk(id: PerkId): PerkDefinition { return PERKS.find(p => p.id===id)!; }
/** Explicit reproducible demonstration presets; normal play starts with no perks. */
export const LAB_PRESETS: Record<string, PerkId[]> = {
  burn: ['burn','corpse'], arc: ['burn','corpse','arc'], reserve: ['reserve','double'],
};
