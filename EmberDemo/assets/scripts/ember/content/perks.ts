import {scaleAttackRange} from './attacks';
import type { PerkDefinition, PerkId } from '../combat-core/types';
export const PERKS = [
  { id:'burn', requiresSkillTags:['fire','projectile'], name:'燃烧弹', color:'#E3A16D', description:'烬火弹附加 3 秒灼烧，每秒造成 9 点伤害。', rules:[{event:'OnHit',skillTags:['hero','projectile','fire'],causes:['skill'],effect:{type:'status',status:{id:'burn',power:9,duration:3}}}] },
  { id:'corpse', requiresSkillTags:['fire','projectile'], name:'尸爆', color:'#D69B85', description:`燃烧中的敌人死亡时爆炸，对 ${scaleAttackRange(2.6)} 格内敌人造成 30 点伤害。`, rules:[{event:'OnKill',targetStatus:'burn',effect:{type:'explode',damage:30,radius:scaleAttackRange(2.6)}}] },
  { id:'arc', name:'电弧', color:'#95B8E5', description:`技能或爆炸命中时，向 ${scaleAttackRange(3.2)} 格内另一个敌人弹射 16 点电击。电击不再弹射。`, rules:[{event:'OnHit',causes:['skill','explosion'],effect:{type:'arc',damage:16,radius:scaleAttackRange(3.2)}}] },
  { id:'double', requiresSkillTags:['projectile'], name:'双重施法', color:'#D3B1DF', description:'投射物技能额外发射一枚偏转弹体，两枚共享本次施法加成。', rules:[{event:'OnSkillCast',skillTags:['hero','projectile'],effect:{type:'extraShot'}}] },
  { id:'swift', name:'迅捷步伐', color:'#9FCAB6', description:'移动速度提升 15%。', speedMultiplier:1.15, rules:[] },
  { id:'rhythm', name:'战斗节奏', color:'#E1CA8D', description:'普通攻击间隔降低 15%。', attackMultiplier:0.85, rules:[] },
  { id:'reserve', requiresSkillGroups:[['shield'],['projectile']], name:'奥能储备', color:'#A7B5DE', description:'施放护盾后，下次投射物技能伤害提高 50%，包括双重施法。', rules:[{event:'OnSkillCast',skillTags:['hero','shield'],effect:{type:'prime'}},{event:'OnSkillCast',skillTags:['hero','projectile'],sourcePrimed:true,effect:{type:'empower',multiplier:1.5}}] },
  { id:'leech', name:'嗜战恢复', color:'#B3C38C', description:'击杀恢复 12 点生命；每 1.5 秒最多触发一次。', rules:[{event:'OnKill',effect:{type:'heal',amount:12,cooldown:1.5}}] },
  { id:'magicMissile', name:'魔法飞弹', color:'#ADC8E8', description:'技能命中发射 3 飞弹，每枚 8 + 目标 0.5% 生命上限真实伤害（比例部分上限 20）。飞行 10 格升至双倍，冷却 0.5 秒。', rules:[{event:'OnHit',causes:['skill'],directOnly:true,cooldown:.5,effect:{type:'missiles',aim:'victim',count:3,spread:.09,damage:8,targetHpRatio:.005,hpDamageCap:20,distanceScale:10,damageType:'true',speed:13,range:scaleAttackRange(16),radius:scaleAttackRange(.13),appearance:'mist'}}] },
  { id:'jeweledGauntlet', name:'珠光护手', color:'#D3B1DF', description:'获得 25% 暴击率，普攻和技能直击可造成 200% 暴击伤害。持续伤害与海克斯附伤不暴击。', critChance:.25,skillCrit:true,rules:[] },
  { id:'infernalConduit', name:'炼狱导管', color:'#E3A16D', description:'技能叠加 4 秒导管灼烧，每层每秒 4 点，最多 5 层。跳伤减少全部技能冷却 0.15 秒（间隔 0.2 秒）。', rules:[{event:'OnHit',causes:['skill'],directOnly:true,effect:{type:'status',status:{id:'infernal',power:4,duration:4}}},{event:'OnStatusTick',tags:['infernal'],cooldown:.2,effect:{type:'cooldown',seconds:.15}}] },
  { id:'etherealWeapon', name:'虚幻武器', color:'#A7B5DE', description:'技能直击可触发重量级打击手、秘术冲拳等攻击特效；每个目标冷却 1 秒。', rules:[{event:'OnHit',causes:['skill'],directOnly:true,cooldown:1,perTarget:true,effect:{type:'onHit'}}] },
  { id:'lightEmUp', name:'点亮他们！', color:'#E1CA8D', description:'每第 4 次普攻出手，向鼠标方向额外发射 3 枚飞弹，每枚 12 点伤害。挥空也计数。', rules:[{event:'OnAttack',every:4,effect:{type:'missiles',aim:'forward',count:3,spread:.13,damage:12,speed:15,range:scaleAttackRange(14),radius:scaleAttackRange(.14),appearance:'shield'}}] },
  { id:'heavyHitter', name:'重量级打击手', color:'#B3C38C', description:'攻击特效：额外造成自身生命上限 3% 的伤害。近战同一次挥击对每个敌人触发一次。', rules:[{event:'OnAttackHit',effect:{type:'bonusDamage',maxHpRatio:.03}}] },
  { id:'mysticPunch', name:'秘术冲拳', color:'#95B8E5', description:'攻击特效：全部技能剩余冷却减少 0.35 秒；每 0.25 秒最多触发一次。', rules:[{event:'OnAttackHit',cooldown:.25,effect:{type:'cooldown',seconds:.35}}] },
  { id:'typhoon', name:'台风', color:'#9FCAB6', description:`普攻出手时，向 ${scaleAttackRange(8)} 格内另一敌人发射一枚 45% 普攻伤害的副弹；可触发攻击特效。`, rules:[{event:'OnAttack',effect:{type:'missiles',aim:'secondary',count:1,spread:0,damage:0,attackRatio:.45,appliesOnHit:true,speed:14,range:scaleAttackRange(8),radius:scaleAttackRange(.12),appearance:'ice'}}] },
  { id:'earthwake', requiresSkillTags:['movement'],name:'大地苏醒', color:'#D9BC87', description:`冲刺后留下真实路径，0.6 秒后爆炸，对路径两侧 ${scaleAttackRange(.85)} 格内敌人造成 45 点伤害。`, rules:[{event:'OnDashEnd',effect:{type:'trail',damage:45,radius:scaleAttackRange(.85),delay:.6,appearance:'shield'}}] },
  { id:'dawnbringer', name:'黎明使者的坚决', color:'#A8D3AD', description:'受伤后低于 50% 生命时，3 秒内恢复 30% 生命上限；冷却 45 秒。致命伤害不会触发。', rules:[{event:'OnDamaged',healthBelow:.5,cooldown:45,effect:{type:'regenerate',maxHpRatio:.3,duration:3}}] },
  { id:'circleOfDeath', name:'死亡之环', color:'#BEAED2', description:`战斗中有效治疗量的 70% 转化为伤害，作用于 ${scaleAttackRange(5)} 格内最近敌人。溢出治疗与波间补给不触发。`, rules:[{event:'OnHeal',effect:{type:'healNova',ratio:.7,radius:scaleAttackRange(5)}}] },
  { id:'glassCannon', name:'玻璃大炮', color:'#D9A6A0', description:'生命上限降低 30%；非真实伤害额外附带 25% 真实伤害。装备生命加成同样受此影响。', maxHpMultiplier:.7,trueBonusRatio:.25,rules:[] },
] as const satisfies readonly PerkDefinition[];
export function perk(id: PerkId): PerkDefinition { return PERKS.find(p => p.id===id)!; }
/** Explicit reproducible demonstration presets; normal play starts with no perks. */
export const LAB_PRESETS = {
  burn: ['burn','corpse'], arc: ['burn','corpse','arc'], reserve: ['reserve','double'],
  hexMage:['magicMissile','jeweledGauntlet','infernalConduit','glassCannon'],
  hexAttack:['etherealWeapon','lightEmUp','heavyHitter','mysticPunch','typhoon'],
  hexSurvive:['earthwake','dawnbringer','circleOfDeath','leech'],
} satisfies Record<string,PerkId[]>;
export type LabId=keyof typeof LAB_PRESETS;
