import { PERKS } from '../content/perks';
import type { PerkDefinition,PerkId } from '../combat-core/types';
import { HERO_SKILLS,skill,type SkillId,type Loadout } from '../content/skills';
import type { Random } from '../utils/Random';
export type RewardChoice={id:string;kind:'perk';perkId:PerkId}|{id:string;kind:'skill';skillId:SkillId};
/** One active skill and two passives where possible; fill shortages from remaining skills. */
export function rewardChoices(random:Random,loadout:Loadout,owned:ReadonlySet<PerkId>):RewardChoice[]{
  const skills:RewardChoice[]=HERO_SKILLS.filter(id=>!Object.values(loadout).includes(id)).map(skillId=>({id:`skill:${skillId}`,kind:'skill',skillId}));
  const perks:RewardChoice[]=PERKS.filter(data=>{const p:PerkDefinition=data;return !owned.has(data.id)&&(!p.requiresSkillTags||Object.values(loadout).some(id=>p.requiresSkillTags!.every(tag=>skill(id).tags.includes(tag))))&&(!p.requiresSkillGroups||p.requiresSkillGroups.every(group=>Object.values(loadout).some(id=>group.every(tag=>skill(id).tags.includes(tag)))));}).map(p=>({id:`perk:${p.id}`,kind:'perk',perkId:p.id}));
  const selected=[...random.pick(perks,2),...random.pick(skills,1)];
  const remaining=[...skills,...perks].filter(p=>!selected.some(s=>s.id===p.id));
  return [...selected,...random.pick(remaining,3-selected.length)];
}
