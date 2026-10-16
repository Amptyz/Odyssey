import {AttributeSet,validateExpression,validModifier} from '../combat-core/attributes/AttributeSet';
import { SKILLS,skill,SKILL_SLOTS,HERO_SKILLS } from './skills';
import {ENEMY_ACTION_SETS,ENEMY_ACTIONS,validateEnemyActions} from './enemy-actions';
import { ENEMIES,enemy } from './enemies';
import { MAPS,mapDefinition } from './maps';
import { LAB_PRESETS,PERKS } from './perks';
import { STATUSES } from './statuses';
import { EFFECT_APPEARANCES,UNIT_APPEARANCES,EQUIPMENT_APPEARANCES,EQUIPMENT_SPRITES,PROCEDURAL_EQUIPMENT,UNIT_SPRITES,ENVIRONMENT_APPEARANCES } from './appearances';
import { ATLAS_FRAMES } from './art-manifest';
import { EQUIPMENT,SHOP_CATALOG,EQUIPMENT_CATEGORIES,equipment } from './equipment';
import { BASIC_ATTACKS } from './attacks';
import { ECONOMY } from './progression';
import { HERO } from './config';
import type { PerkDefinition } from '../combat-core/types';
function requireContent(ok:unknown,path:string):asserts ok {if(!ok)throw new Error(`Invalid game content: ${path}`);}
function positive(value:number,path:string):void {requireContent(Number.isFinite(value)&&value>0,path);}
/** Run at startup and in tests so missing content references fail before combat. */
export function validateContent():void {
  requireContent(UNIT_APPEARANCES[HERO.appearance],'hero appearance');
  for(const [id,frames] of Object.entries(ATLAS_FRAMES))for(const [index,frame] of frames.entries()){
    requireContent(frame.rect.every(Number.isFinite)&&frame.rect[0]>=0&&frame.rect[1]>=0&&frame.rect[2]>0&&frame.rect[3]>0,`art.${id}.${index}.rect`);
    requireContent(frame.pivot.every(Number.isFinite),`art.${id}.${index}.pivot`);
  }
  for(const [id,visual] of Object.entries(UNIT_SPRITES)){
    positive(visual.pixelScale,`art.${id}.scale`);positive(visual.height,`art.${id}.height`);
    for(const [state,clip] of Object.entries(visual.clips)){
      positive(clip.fps,`art.${id}.${state}.fps`);
      requireContent(clip.frames.length>0&&clip.frames.every(i=>Number.isInteger(i)&&ATLAS_FRAMES[visual.atlas][i]),`art.${id}.${state}.frames`);
    }
  }
  for(const [id,visual] of Object.entries(ENVIRONMENT_APPEARANCES))requireContent(Object.values(visual.frames).every(i=>Number.isInteger(i)&&ATLAS_FRAMES[visual.atlas][i]),`environment.${id}.frames`);
  for(const id of Object.keys(SKILLS) as (keyof typeof SKILLS)[]){
    const s=skill(id);positive(s.cooldown,`skills.${id}.cooldown`);requireContent(EFFECT_APPEARANCES[s.appearance],`skills.${id}.appearance`);
    if(s.expression)validateExpression(s.expression);if(s.manaCost!==undefined)requireContent(Number.isFinite(s.manaCost)&&s.manaCost>=0,`skills.${id}.manaCost`);
    const b=s.behavior;if(b.kind!=='dash')requireContent(s.expression,`skills.${id}.expression required`);
    if(b.kind==='cone')requireContent(b.arc<=Math.PI*2,`skills.${id}.arc`);
    for(const [key,value] of Object.entries(b))if(typeof value==='number')positive(value,`skills.${id}.${key}`);
    if(b.kind==='projectile'||b.kind==='area')for(const status of b.onHit??[]){requireContent(STATUSES[status.id],`skills.${id}.status`);positive(status.duration,`skills.${id}.status duration`);positive(status.power,`skills.${id}.status power`);}
  }
  for(const [id,attack] of Object.entries(BASIC_ATTACKS)){
    requireContent(EFFECT_APPEARANCES[attack.appearance],`attacks.${id}.appearance`);
    for(const [key,value] of Object.entries(attack))if(typeof value==='number')positive(value,`attacks.${id}.${key}`);
    if(attack.kind==='melee')requireContent(attack.arc<=Math.PI*2,`attacks.${id}.arc`);
  }
  validateEnemyActions();
  for(const id of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]){
    const e=enemy(id);requireContent(ENEMY_ACTION_SETS[e.actionSet]&&e.appearance===e.actionSet,`enemies.${id}.procedural appearance/action set`);
    if(e.boss){requireContent(e.boss.threshold>0&&e.boss.threshold<1,`enemies.${id}.phase`);for(const step of [...e.boss.phase1,...e.boss.phase2])requireContent(step.at>=0&&step.at<e.boss.loop&&ENEMY_ACTIONS[step.action],`enemies.${id}.boss loop`);}
    for(const [key,value] of Object.entries(e))if(typeof value==='number')positive(value,`enemies.${id}.${key}`);
    new AttributeSet(e.template);
    if(e.behavior==='ranged')requireContent(e.skillId&&SKILLS[e.skillId]&&skill(e.skillId).behavior.kind==='projectile',`enemies.${id}.projectile skill`);
  }
  for(const id of Object.keys(MAPS) as (keyof typeof MAPS)[]){
    const m=mapDefinition(id);requireContent(Number.isInteger(m.width)&&m.width>=4&&Number.isInteger(m.height)&&m.height>=4,`maps.${id}.size`);
    requireContent(ENVIRONMENT_APPEARANCES[m.environment],`maps.${id}.environment`);
    requireContent(m.heroSpawn.x>HERO.radius&&m.heroSpawn.x<m.width-HERO.radius&&m.heroSpawn.y>HERO.radius&&m.heroSpawn.y<m.height-HERO.radius,`maps.${id}.heroSpawn`);
    requireContent(m.waves.length>0,`maps.${id}.waves`);positive(m.spawnDistance,`maps.${id}.spawnDistance`);
    requireContent(m.spawnMargin>0&&m.spawnMargin<Math.min(m.width,m.height)/2,`maps.${id}.spawnMargin`);
    const obstacleIds=new Set<string>();
    for(const o of m.obstacles){requireContent(!obstacleIds.has(o.id),`maps.${id}.duplicate obstacle`);obstacleIds.add(o.id);positive(o.radius,`maps.${id}.obstacle radius`);
      requireContent(o.x-o.radius>=0&&o.x+o.radius<=m.width&&o.y-o.radius>=0&&o.y+o.radius<=m.height,`maps.${id}.obstacle bounds`);
      requireContent(Math.hypot(o.x-m.heroSpawn.x,o.y-m.heroSpawn.y)>o.radius+HERO.radius,`maps.${id}.blocked heroSpawn`);}
    for(const slot of SKILL_SLOTS)requireContent(SKILLS[m.loadout[slot]]&&skill(m.loadout[slot]).tags.includes('hero'),`maps.${id}.loadout.${slot}`);
    requireContent(new Set(Object.values(m.loadout)).size===4,`maps.${id}.duplicate skills`);
    requireContent(HERO_SKILLS.length>=7,`maps.${id}.skill reward pool`);
    requireContent(new Set(m.shopAfterWaves).size===m.shopAfterWaves.length&&m.shopAfterWaves.every(w=>Number.isInteger(w)&&w>0&&w<m.waves.length),`maps.${id}.shop stages`);
    for(const wave of m.waves){
      const level=wave.level;requireContent(level&&level.groups.length>0&&level.route.length>=2,`maps.${id}.level`);
      for(const point of [level.start,level.exit,...level.route,...level.groups.map(g=>g.center)])requireContent(Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>0&&point.y>0&&point.x<m.width&&point.y<m.height,`maps.${id}.level bounds`);
      positive(level.exit.radius,`maps.${id}.exit radius`);requireContent(new Set(level.groups.map(g=>g.id)).size===level.groups.length,`maps.${id}.group IDs`);
      const aggregate:Record<string,number>={};for(const group of level.groups){positive(group.radius,`maps.${id}.group radius`);for(const spawn of group.spawns){requireContent(ENEMIES[spawn.enemyId]&&Number.isInteger(spawn.count)&&spawn.count>0,`maps.${id}.group spawn`);aggregate[spawn.enemyId]=(aggregate[spawn.enemyId]??0)+spawn.count;}}
      requireContent(wave.spawns.length===Object.keys(aggregate).length&&wave.spawns.every(spawn=>aggregate[spawn.enemyId]===spawn.count),`maps.${id}.group aggregate`);
      positive(wave.hpScale,`maps.${id}.hpScale`);requireContent(wave.spawns.length>0,`maps.${id}.empty wave`);
      for(const spawn of wave.spawns)requireContent(ENEMIES[spawn.enemyId]&&Number.isInteger(spawn.count)&&spawn.count>0,`maps.${id}.spawn`);}
  }
  requireContent(SHOP_CATALOG.length===Object.keys(EQUIPMENT).length&&new Set(SHOP_CATALOG).size===SHOP_CATALOG.length,'shop catalog');
  for(const id of SHOP_CATALOG){const e=equipment(id);requireContent(EQUIPMENT_CATEGORIES.includes(e.category),`equipment.${id}.category`);positive(e.price,`equipment.${id}.price`);requireContent(Number.isInteger(e.price),`equipment.${id}.integer price`);
    requireContent(EQUIPMENT_APPEARANCES[e.appearance]?.layer===e.category,`equipment.${id}.appearance layer`);
    if(e.category==='weapon')requireContent(e.attack&&BASIC_ATTACKS[e.attack],`equipment.${id}.attack`);
    requireContent((e.modifiers??[]).every(validModifier),`equipment.${id}.modifiers`);
    const sprite=EQUIPMENT_SPRITES[e.appearance],procedural=PROCEDURAL_EQUIPMENT[e.appearance];
    requireContent(procedural?.layer===e.category||sprite&&ATLAS_FRAMES.equipment[sprite.frame],`equipment.${id}.sprite or procedural`);
    if(sprite){positive(sprite.width,`equipment.${id}.sprite width`);positive(sprite.height,`equipment.${id}.sprite height`);}
    const groups=new Set<string>();for(const passive of e.passives??[]){requireContent(!groups.has(passive.group)&&passive.group.startsWith('equipment.'),`equipment.${id}.passive group`);groups.add(passive.group);validateExpression(passive.expression);positive(passive.cooldown,`equipment.${id}.passive cooldown`);if(passive.kind==='spellblade')positive(passive.armDuration,`equipment.${id}.arm duration`);else{positive(passive.duration,`equipment.${id}.shield duration`);requireContent(passive.healthBelow>0&&passive.healthBelow<1,`equipment.${id}.shield threshold`);}}
    for(const [key,value] of Object.entries(e.stats))requireContent(Number.isFinite(value)&&value>=0,`equipment.${id}.stats.${key}`);}
  for(const [key,value] of Object.entries(ECONOMY))requireContent(Number.isInteger(value)&&value>=0,`economy.${key}`);
  const ids=new Set<string>();
  for(const data of PERKS){const p:PerkDefinition=data;requireContent(!ids.has(p.id),`duplicate perk ${p.id}`);ids.add(p.id);
    for(const key of ['speedMultiplier','attackMultiplier','maxHpMultiplier'] as const)if(p[key]!==undefined)positive(p[key]!,`perks.${p.id}.${key}`);
    if(p.critChance!==undefined)requireContent(p.critChance>=0&&p.critChance<=1,`perks.${p.id}.critChance`);
    if(p.trueBonusRatio!==undefined)positive(p.trueBonusRatio,`perks.${p.id}.trueBonusRatio`);
    for(const rule of p.rules){if(rule.skillId)requireContent(SKILLS[rule.skillId],`perks.${p.id}.skillId`);
      if(rule.cooldown!==undefined)positive(rule.cooldown,`perks.${p.id}.cooldown`);
      if(rule.every!==undefined)requireContent(Number.isInteger(rule.every)&&rule.every>0,`perks.${p.id}.every`);
      if(rule.healthBelow!==undefined)requireContent(rule.healthBelow>0&&rule.healthBelow<=1,`perks.${p.id}.healthBelow`);
      if(rule.targetStatus)requireContent(STATUSES[rule.targetStatus],`perks.${p.id}.targetStatus`);
      const e=rule.effect;if('expression' in e&&e.expression)validateExpression(e.expression);if(e.type==='attribute')requireContent(e.modifiers.every(validModifier)&&e.duration>0,`perks.${p.id}.attribute`);
      if(e.type==='status'){requireContent(STATUSES[e.status.id],`perks.${p.id}.status`);positive(e.status.power,`perks.${p.id}.status.power`);positive(e.status.duration,`perks.${p.id}.status.duration`);}
      for(const [key,value] of Object.entries(e))if(typeof value==='number')requireContent(Number.isFinite(value)&&value>=0,`perks.${p.id}.effect.${key}`);
      if(e.type==='missiles'){
        requireContent(Number.isInteger(e.count)&&e.count>0&&e.count<=8,`perks.${p.id}.missile count`);
        for(const key of ['speed','range','radius'] as const)positive(e[key],`perks.${p.id}.${key}`);
        requireContent(EFFECT_APPEARANCES[e.appearance],`perks.${p.id}.appearance`);
        if(e.distanceScale!==undefined)positive(e.distanceScale,`perks.${p.id}.distanceScale`);
      }
      if(e.type==='regenerate')positive(e.duration,`perks.${p.id}.duration`);
      if(e.type==='trail'){positive(e.delay,`perks.${p.id}.delay`);positive(e.radius,`perks.${p.id}.radius`);requireContent(EFFECT_APPEARANCES[e.appearance],`perks.${p.id}.appearance`);}
    }
  }
  for(const [id,preset] of Object.entries(LAB_PRESETS))requireContent(preset.length>0&&new Set(preset).size===preset.length&&preset.every(p=>ids.has(p)),`labs.${id}`);
}
