import { SKILLS,skill,SKILL_SLOTS,PRIMARY_SKILLS,type SkillId } from './skills';
import { ENEMIES,enemy } from './enemies';
import { MAPS,mapDefinition } from './maps';
import { PERKS,LAB_PRESETS } from './perks';
import { STATUSES } from './statuses';
import { EFFECT_APPEARANCES,UNIT_APPEARANCES } from './appearances';
import { HERO } from './config';
import type { PerkDefinition } from '../combat-core/types';
function requireContent(ok:unknown,path:string):asserts ok {if(!ok)throw new Error(`Invalid game content: ${path}`);}
function positive(value:number,path:string):void {requireContent(Number.isFinite(value)&&value>0,path);}
/** Run at startup and in tests so missing content references fail before combat. */
export function validateContent():void {
  requireContent(UNIT_APPEARANCES[HERO.appearance],'hero appearance');
  for(const id of Object.keys(SKILLS) as (keyof typeof SKILLS)[]){
    const s=skill(id);positive(s.cooldown,`skills.${id}.cooldown`);requireContent(EFFECT_APPEARANCES[s.appearance],`skills.${id}.appearance`);
    const b=s.behavior;
    for(const [key,value] of Object.entries(b))if(typeof value==='number')positive(value,`skills.${id}.${key}`);
    if(b.kind==='projectile')for(const status of b.onHit??[]){requireContent(STATUSES[status.id],`skills.${id}.status`);positive(status.duration,`skills.${id}.status duration`);positive(status.power,`skills.${id}.status power`);}
  }
  for(const id of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]){
    const e=enemy(id);requireContent(UNIT_APPEARANCES[e.appearance],`enemies.${id}.appearance`);
    for(const [key,value] of Object.entries(e))if(typeof value==='number')positive(value,`enemies.${id}.${key}`);
    if(e.behavior==='ranged')requireContent(e.skillId&&SKILLS[e.skillId]&&skill(e.skillId).behavior.kind==='projectile',`enemies.${id}.projectile skill`);
  }
  for(const id of Object.keys(MAPS) as (keyof typeof MAPS)[]){
    const m=mapDefinition(id);requireContent(Number.isInteger(m.width)&&m.width>=4&&Number.isInteger(m.height)&&m.height>=4,`maps.${id}.size`);
    requireContent(m.heroSpawn.x>HERO.radius&&m.heroSpawn.x<m.width-HERO.radius&&m.heroSpawn.y>HERO.radius&&m.heroSpawn.y<m.height-HERO.radius,`maps.${id}.heroSpawn`);
    requireContent(m.waves.length>0,`maps.${id}.waves`);positive(m.spawnDistance,`maps.${id}.spawnDistance`);
    requireContent(m.spawnMargin>0&&m.spawnMargin<Math.min(m.width,m.height)/2,`maps.${id}.spawnMargin`);
    const obstacleIds=new Set<string>();
    for(const o of m.obstacles){requireContent(!obstacleIds.has(o.id),`maps.${id}.duplicate obstacle`);obstacleIds.add(o.id);positive(o.radius,`maps.${id}.obstacle radius`);
      requireContent(o.x-o.radius>=0&&o.x+o.radius<=m.width&&o.y-o.radius>=0&&o.y+o.radius<=m.height,`maps.${id}.obstacle bounds`);
      requireContent(Math.hypot(o.x-m.heroSpawn.x,o.y-m.heroSpawn.y)>o.radius+HERO.radius,`maps.${id}.blocked heroSpawn`);}
    for(const slot of SKILL_SLOTS)requireContent(SKILLS[m.loadout[slot]]&&skill(m.loadout[slot]).tags.includes('hero'),`maps.${id}.loadout.${slot}`);
    // Unique-perk rewards need three choices even at the final wave.
    for(const primary of PRIMARY_SKILLS){
      const loadout:SkillId[]=Object.values({...m.loadout,Q:primary});
      const eligible=PERKS.filter(data=>{const p:PerkDefinition=data;return !p.requiresSkillTags||loadout.some(id=>p.requiresSkillTags!.every(tag=>skill(id).tags.includes(tag)));});
      requireContent(eligible.length>=m.waves.length+2,`maps.${id}.reward pool for ${primary}`);
    }
    for(const preset of Object.values(LAB_PRESETS))requireContent(PERKS.length-new Set(preset).size>=m.waves.length+2,`maps.${id}.lab reward pool`);
    for(const wave of m.waves){positive(wave.hpScale,`maps.${id}.hpScale`);requireContent(wave.spawns.length>0,`maps.${id}.empty wave`);
      for(const spawn of wave.spawns)requireContent(ENEMIES[spawn.enemyId]&&Number.isInteger(spawn.count)&&spawn.count>0,`maps.${id}.spawn`);}
  }
  const ids=new Set<string>();
  for(const data of PERKS){const p:PerkDefinition=data;requireContent(!ids.has(p.id),`duplicate perk ${p.id}`);ids.add(p.id);
    for(const rule of p.rules){if(rule.skillId)requireContent(SKILLS[rule.skillId],`perks.${p.id}.skillId`);
      if(rule.targetStatus)requireContent(STATUSES[rule.targetStatus],`perks.${p.id}.targetStatus`);
      if(rule.effect.type==='status')requireContent(STATUSES[rule.effect.status.id],`perks.${p.id}.status`);}
  }
}
