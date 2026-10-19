import {openMerchantFixture} from '../helpers/scenes';
import {describe,it,expect} from 'vitest';
import {AttributeSet,PLAYER_TEMPLATE,cooldownMultiplier,movementSpeed,evaluate,effectiveResistance,resistanceMultiplier,type UnitTemplate,type Modifier} from '../../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import {createActor} from '../../EmberDemo/assets/scripts/ember/combat-core/ActorFactory';
import {CombatEngine,EVENT_BUDGET} from '../../EmberDemo/assets/scripts/ember/combat-core/CombatEngine';
import {applyStatus,movementMultiplier} from '../../EmberDemo/assets/scripts/ember/combat-core/StatusSystem';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {parseDeveloperConfig,DEFAULT_DEV_OPTIONS} from '../../EmberDemo/assets/scripts/ember/simulation/DeveloperConfig';
import {DEVELOPER_LOADOUT as DEFAULT_LOADOUT,SKILLS,skillDescription,SKILL_DESCRIPTIONS,type SkillDefinition} from '../../EmberDemo/assets/scripts/ember/content/skills';
const mod=(a:AttributeSet,modifiers:Modifier[],sourceId='test')=>a.upsert({sourceId,modifiers});
function fixture(source:Partial<UnitTemplate['stats']>={},target:Partial<UnitTemplate['stats']>={}){
 const a=createActor('hero','hero',{x:10,y:10},{...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:1000,...source}},.3);
 const b=createActor('enemy','enemy',{x:11,y:10},{...PLAYER_TEMPLATE,classification:'monster',stats:{...PLAYER_TEMPLATE.stats,maxHealth:1000,...target}},.3);
 const actors=new Map([[a.id,a],[b.id,b]]),core=new CombatEngine(actors,()=>{},h=>h.amount,undefined,{random:()=>0});return{a,b,core};
}
describe('shared attribute rule contract',()=>{
 it('generates damage identity, caps and concrete per-status descriptions from the same definitions',()=>{
  expect(SKILL_DESCRIPTIONS.icebolt).toContain('减速 45%，持续 2.5 秒');expect(SKILL_DESCRIPTIONS.frostNova).toContain('减速 55%，持续 3 秒');
  const description=skillDescription({name:'test',cooldown:1,tags:[],appearance:'fire',expression:{flat:10,attackDamage:1,cap:100},damageType:'true',behavior:{kind:'projectile',damage:10,speed:1,range:1,radius:.1,onHit:[{id:'burn',duration:3,power:9}]}});
  expect(description).toContain('上限 100');expect(description).toContain('真实伤害');expect(description).toContain('灼烧：每 1 秒造成 9 点魔法伤害，持续 3 秒');expect(description).not.toContain('减速');
 });
 it('combines total AD expressions once and rejects unknown/base/bonus AD and nonfinite coefficients',()=>{
  const {a,b}=fixture({attackDamage:60});mod(a.attributes,[{stat:'attackDamage',operation:'flat',value:40}]);expect(evaluate({flat:50,attackDamage:1.2},a,b)).toBe(170);
  for(const expression of [{baseAttackDamage:1},{bonusAttackDamage:1},{flat:Infinity},{abilityPower:NaN}])expect(()=>evaluate(expression as any,a)).toThrow();
 });
 it('keeps template/source copies isolated, caches until dirty, replaces and removes without drift',()=>{
  const template={...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats}},a=new AttributeSet(template),b=new AttributeSet(template),source={sourceId:'gear',modifiers:[{stat:'attackDamage',operation:'flat',value:40} as Modifier]};
  const initial=a.value;expect(a.value).toBe(initial);a.upsert(source);source.modifiers[0]!.value=99;template.stats.attackDamage=999;expect(a.value.attackDamage).toBe(60);expect(b.value.attackDamage).toBe(20);
  for(let i=0;i<10;i++)a.upsert({sourceId:'gear',modifiers:[{stat:'attackDamage',operation:'flat',value:40}]});expect(a.value.attackDamage).toBe(60);a.remove('gear');expect(a.value.attackDamage).toBe(20);
  const explain=a.explain();explain.final.attackDamage=123;expect(a.value.attackDamage).toBe(20);
 });
 it('uses AS ratio, group-specific uniqueness, independent penetration and haste points',()=>{
  const a=new AttributeSet({...PLAYER_TEMPLATE,baseAttackSpeed:1,attackSpeedRatio:.6});mod(a,[{stat:'attackSpeed',operation:'percent',value:.5},{stat:'abilityHaste',operation:'flat',value:50},{stat:'armorPenPercent',operation:'percent',value:.3},{stat:'armorPenPercent',operation:'percent',value:.2},{stat:'tenacity',operation:'percent',value:.3},{stat:'tenacity',operation:'percent',value:.2}]);expect(a.value.attackSpeed).toBeCloseTo(1.3);expect(10*cooldownMultiplier(a.value)).toBeCloseTo(6.6666667);expect(a.value.armorPenPercent).toBeCloseTo(.44);expect(a.value.tenacity).toBeCloseTo(.44);
  mod(a,[{stat:'attackDamage',operation:'flat',value:10,stackingGroup:'unique'},{stat:'attackDamage',operation:'flat',value:20,stackingGroup:'unique'}],'unique');expect(a.value.attackDamage).toBe(40);
  mod(a,[{stat:'attackSpeed',operation:'percent',value:100}],'cap');expect(a.value.attackSpeed).toBe(3);
 });
 it('matches positive/negative resistance and reduction-penetration order',()=>{
  expect(200*resistanceMultiplier(100)).toBe(100);expect(200*resistanceMultiplier(-50)).toBeCloseTo(266.6667,3);const r=effectiveResistance(100,10,.2,.3,10);expect(r).toBeCloseTo(40.4);expect(200*resistanceMultiplier(r)).toBeCloseTo(142.4501,3);expect(effectiveResistance(10,0,0,0,99)).toBe(0);expect(effectiveResistance(-50,0,0,.9,99)).toBe(-50);
 });
 it('uses soft caps consistently for all movement, including slow resistance',()=>{
  const a=new AttributeSet(PLAYER_TEMPLATE);expect(movementSpeed(a.value)).toBeCloseTo(6.3);for(const [raw,expected] of [[10,1.15],[130,1.75],[40,1.3],[20,1.2],[500,4.8]]){mod(a,[{stat:'moveSpeed',operation:'flat',value:raw-421.25}]);expect(movementSpeed(a.value)).toBeCloseTo(expected*1.5);}
  mod(a,[{stat:'slowResist',operation:'flat',value:.2}]);expect(movementSpeed(a.value,.5)).toBeCloseTo(movementSpeed({...a.value,moveSpeed:421.25*.6}));
 });
});
describe('uniform combat and dynamic runtime state',()=>{
 it('uses damage identity independently of AD coefficient and applies enemy crit/rules too',()=>{
  const {a,b,core}=fixture({attackDamage:100},{armor:100,magicResist:0});core.damage({sourceId:a.id,targetId:b.id,amount:0,expression:{attackDamage:1},damageType:'magic',cause:'skill'});expect(b.hp).toBe(900);
  core.addPerk('jeweledGauntlet',b.id);mod(b.attributes,[{stat:'critChance',operation:'flat',value:.75}]);core.damage({sourceId:b.id,targetId:a.id,amount:100,cause:'enemy',damageType:'physical'});expect(a.hp).toBe(800);
 });
 it('separates mixed true components, type-specific shields and single on-hit identity',()=>{
  const {a,b,core}=fixture({}, {armor:100});core.addPerk('glassCannon');core.shield(b.id,b.id,50,3,'physical',['physical']);core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'basic',damageType:'physical'});
  const event=core.history.find(e=>e.type==='OnHit')!;expect(event.components).toEqual([{damageType:'physical',postMitigation:50,shieldAbsorbed:50,healthLost:0,overkill:0},{damageType:'true',postMitigation:25,shieldAbsorbed:0,healthLost:25,overkill:0}]);expect(b.hp).toBe(975);expect(core.history.filter(e=>e.type==='OnAttackHit')).toHaveLength(1);expect(core.history.filter(e=>e.type==='OnDamaged')).toHaveLength(1);
 });
 it('expires shields independently and prevents incompatible shield types from hiding health loss',()=>{
  const {a,b,core}=fixture();core.shield(a.id,a.id,10,.5,'short');core.shield(a.id,a.id,20,2,'long');core.tick(.6);expect(a.shield).toBe(20);expect(a.shields).toHaveLength(1);
  core.shield(b.id,b.id,100,2,'magic',['magic']);core.damage({sourceId:a.id,targetId:b.id,amount:30,cause:'basic',damageType:'physical'});expect(b.hp).toBe(970);expect(b.shield).toBe(100);expect(core.history.find(e=>e.type==='OnDamaged')?.amount).toBe(30);
 });
 it.each(['physical','magic','true'] as const)('omnivamp uses post mitigation including shield and overkill for %s',damageType=>{
  const {a,b,core}=fixture({omnivamp:.1});a.hp=500;b.hp=1;core.shield(b.id,b.id,30,5);core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'skill',damageType});expect(a.hp).toBe(510);const hit=core.history.find(e=>e.type==='OnHit')!;expect(hit.shieldAbsorbed).toBe(30);expect(hit.healthLost).toBe(1);expect(hit.overkill).toBe(69);expect(core.history.find(e=>e.type==='OnHeal')?.effectiveHeal).toBe(10);expect(core.history.every(e=>e.rootId===hit.rootId)).toBe(true);
 });
 it('uses delivery/target vamp efficiency, ignores immunity/dead targets and caps effective healing',()=>{
  const {a,b,core}=fixture({omnivamp:.1});a.hp=500;core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'burn',delivery:'periodic'});expect(a.hp).toBeCloseTo(503.3);core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'skill',area:true});expect(a.hp).toBeCloseTo(513.3);
  core.applyCombatEffect(b.id,{sourceId:b.id,instanceId:'immune',remaining:1,invulnerable:true});core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'skill'});expect(a.hp).toBeCloseTo(513.3);core.tick(1);a.hp=994;core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'basic'});expect(a.hp).toBe(1000);b.alive=false;core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'basic'});expect(a.hp).toBe(1000);
 });
 it('separates caster HSP from recipient healing/strongest wounds and expires/removes sources',()=>{
  const {a,b,core}=fixture({healShieldPower:.5});b.hp=500;core.applyCombatEffect(b.id,{sourceId:a.id,instanceId:'received',remaining:2,healingReceived:1.2,grievousWounds:.4});core.applyCombatEffect(b.id,{sourceId:b.id,instanceId:'weak',remaining:1,grievousWounds:.2});expect(core.healTarget(a.id,b.id,100)).toBeCloseTo(108);core.tick(2);expect(core.healTarget(a.id,b.id,100)).toBe(150);
  core.applyAttributeEffect(b.id,{sourceId:'temporary:armor',modifiers:[{stat:'armor',operation:'flat',value:100}]},1);expect(b.attributes.value.armor).toBe(100);core.tick(1);expect(b.attributes.value.armor).toBe(0);
 });
 it('keeps slow instances, returns to weaker effect, distinguishes tenacity and slow resistance',()=>{
  const {b,core}=fixture({}, {tenacity:.3,slowResist:.2});applyStatus(b,{id:'slow',duration:2,power:.5},'a');applyStatus(b,{id:'slow',duration:4,power:.8},'b');expect(b.statuses[0]!.remaining).toBeCloseTo(1.4);expect(movementMultiplier(b)).toBe(.5);core.tick(1.4);expect(movementMultiplier(b)).toBe(.8);core.tick(1.4);expect(movementMultiplier(b)).toBe(1);
 });
 it('does not convert healing-derived damage back into omnivamp or another healing nova',()=>{
  const {a,b,core}=fixture({omnivamp:1});a.hp=100;core.addPerk('circleOfDeath');core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'skill'});expect(a.hp).toBe(200);expect(b.hp).toBe(830);expect(core.history.filter(e=>e.type==='OnHeal')).toHaveLength(1);expect(core.history.find(e=>e.tags.includes('derived-heal'))?.amount).toBe(70);
 });
 it('prevents negative HSP and negative shields from increasing damage',()=>{
  const {a,b,core}=fixture();mod(b.attributes,[{stat:'healShieldPower',operation:'flat',value:-2}]);core.shield(b.id,b.id,65,4);expect(b.shield).toBe(65);core.damage({sourceId:a.id,targetId:b.id,amount:10,cause:'basic',damageType:'physical'});expect(b.hp).toBe(1000);expect(b.shield).toBe(55);expect(core.history.find(e=>e.type==='OnHit')?.shieldAbsorbed).toBe(10);
 });
 it('keeps DOT ownership and per-source stack caps independent across players',()=>{
  const {a,b,core}=fixture({omnivamp:1}),other=createActor('p2','hero',{x:10,y:11},{...PLAYER_TEMPLATE,stats:{maxHealth:1000,omnivamp:1}},.3);core.actors.set(other.id,other);a.hp=100;other.hp=100;core.addPerk('infernalConduit',a.id);core.addPerk('infernalConduit',other.id);
  core.damage({sourceId:a.id,targetId:b.id,amount:1,cause:'skill'});core.damage({sourceId:other.id,targetId:b.id,amount:1,cause:'skill'});expect(b.statuses).toHaveLength(2);core.tick(1);const ticks=core.history.filter(e=>e.type==='OnStatusTick');expect(ticks.map(e=>[e.sourceId,e.amount])).toEqual([[a.id,4],[other.id,4]]);expect(a.hp).toBeCloseTo(102.32);expect(other.hp).toBeCloseTo(102.32);
 });
 it('never extends a short control effect to the normal tenacity minimum',()=>{
  const {b}=fixture({}, {tenacity:.9});applyStatus(b,{id:'slow',duration:.1,power:.5},'a');expect(b.statuses[0]!.remaining).toBe(.1);
 });
 it('rejects target terms without a target instead of interpreting the caster as the victim',()=>{
  const {a,b}=fixture();expect(()=>evaluate({targetMaxHealth:.1},a)).toThrow();expect(evaluate({targetMaxHealth:.1},a,b)).toBe(100);
 });
 it('carries actual melee area identity through collision to minion omnivamp efficiency',()=>{
  for(const [classification,expectedHeal] of [['minion',6.6],['monster',20]] as const){
   const w=new GameWorld(1,'ember',{...DEFAULT_DEV_OPTIONS,freezeEnemies:true});w.startDeveloper(parseDeveloperConfig({version:2,seed:1,mapId:'ember',wave:1,loadout:DEFAULT_LOADOUT,equipment:{},purchaseOrder:[],perks:[],options:DEFAULT_DEV_OPTIONS}));for(const [id,actor] of w.actors)if(actor.team==='enemy')w.actors.delete(id);const target=w.spawnEnemy('melee',{x:w.hero.x+1.5,y:w.hero.y},1000);target.attributes=new AttributeSet({...target.attributes.template,stats:{...target.attributes.template.stats,armor:0},classification});w.hero.hp=100;mod(w.hero.attributes,[{stat:'omnivamp',operation:'flat',value:1}]);w.command({type:'Attack',point:target});for(let i=0;i<6;i++)w.advance(1/30);expect(target.hp).toBe(980);expect(w.hero.hp).toBeCloseTo(100+expectedHeal);
  }
 });
 it('samples projectile source terms once, target terms at impact, and empowers both under the expression cap',()=>{
  const w=new GameWorld(1,'ember',{...DEFAULT_DEV_OPTIONS,freezeEnemies:true});w.startDeveloper(parseDeveloperConfig({version:2,seed:1,mapId:'ember',wave:1,loadout:DEFAULT_LOADOUT,equipment:{},purchaseOrder:[],perks:['reserve'],options:DEFAULT_DEV_OPTIONS}));for(const [id,actor] of w.actors)if(actor.team==='enemy')w.actors.delete(id);const target=w.spawnEnemy('melee',{x:w.hero.x+1,y:w.hero.y},1000);target.windup=999;
  const definition=SKILLS.fireball as SkillDefinition,oldExpression=definition.expression;try{definition.expression={flat:10,attackDamage:1,targetMaxHealth:.1,cap:200};w.command({type:'CastSkill',skillId:'shield',point:w.hero});w.command({type:'CastSkill',skillId:'fireball',point:target});mod(w.hero.attributes,[{stat:'attackDamage',operation:'flat',value:1000}]);for(let i=0;i<5;i++)w.advance(1/30);expect(target.hp).toBe(805);definition.expression={flat:10,attackDamage:1,targetMaxHealth:.1,cap:100};w.cooldowns.fireball=0;w.cooldowns.shield=0;w.command({type:'CastSkill',skillId:'shield',point:w.hero});w.command({type:'CastSkill',skillId:'fireball',point:target});for(let i=0;i<5;i++)w.advance(1/30);expect(target.hp).toBe(655);}finally{definition.expression=oldExpression;}
 });
 it('restores mana and checks spell mana consumption through the shared unit cast entry',()=>{
  const w=new GameWorld(1,'ember',{...DEFAULT_DEV_OPTIONS,freezeEnemies:true});w.startDeveloper(parseDeveloperConfig({version:2,seed:1,mapId:'ember',wave:1,loadout:DEFAULT_LOADOUT,equipment:{},purchaseOrder:[],perks:[],options:DEFAULT_DEV_OPTIONS}));w.hero.attributes=new AttributeSet({...PLAYER_TEMPLATE,resourceKind:'mana',stats:{...PLAYER_TEMPLATE.stats,maxMana:100,manaRegen:30}});w.hero.mana=0;w.advance(1/30);expect(w.hero.mana).toBe(1);
  const definition=SKILLS.fireball as SkillDefinition,oldCost=definition.manaCost;try{definition.manaCost=20;w.command({type:'CastSkill',skillId:'fireball',point:{x:12,y:10}});expect(w.hero.skillCooldowns.fireball).toBe(0);expect(w.projectiles).toHaveLength(0);w.hero.mana=50;w.command({type:'CastSkill',skillId:'fireball',point:{x:12,y:10}});expect(w.hero.skillCooldowns.fireball).toBeGreaterThan(0);expect(w.hero.mana).toBe(30);}finally{if(oldCost===undefined)delete definition.manaCost;else definition.manaCost=oldCost;}
 });
 it('bounds healing-proc-vamp loops by shared event budget',()=>{
  const {a,b,core}=fixture({omnivamp:1});a.hp=1;core.addPerk('circleOfDeath');core.addPerk('leech');core.damage({sourceId:a.id,targetId:b.id,amount:100,cause:'basic'});expect(core.metrics.processed).toBeLessThanOrEqual(EVENT_BUDGET);expect(core.metrics.maxDepth).toBeLessThanOrEqual(6);expect(Number.isFinite(a.hp)).toBe(true);
 });
});
describe('world lifecycle and authority',()=>{
 it('restores external permanent sources exactly once for each player and rejects old checkpoint version',()=>{
  const w=new GameWorld();w.addPlayer('p2');mod(w.players.get('p2')!.hero.attributes,[{stat:'attackDamage',operation:'flat',value:40}],'permanent:test');openMerchantFixture(w);const saved=w.savedRun!;expect(saved.version).toBe(4);const restored=GameWorld.resume(saved);expect(restored.players.get('p2')!.hero.attributes.value.attackDamage).toBe(60);expect(restored.hero.attributes.value.attackDamage).toBe(20);expect(GameWorld.resume(restored.savedRun!).players.get('p2')!.hero.attributes.value.attackDamage).toBe(60);expect(()=>GameWorld.resume({...saved,version:1})).toThrow();const tampered=JSON.parse(JSON.stringify(saved));tampered.players[0].attributeSources=[{sourceId:'temporary:forged',modifiers:[]}];expect(()=>GameWorld.resume(tampered)).toThrow();
 });
 it('exposes detached plain snapshots and supports F2 attribute testing without enabling normal-world cheats',()=>{
  const config=parseDeveloperConfig({version:2,seed:1,mapId:'ember',wave:1,loadout:DEFAULT_LOADOUT,equipment:{},purchaseOrder:[],perks:[],options:DEFAULT_DEV_OPTIONS,attributeTarget:'all',attributeModifiers:[{stat:'armor',operation:'flat',value:100}]});const w=new GameWorld(1,'ember',DEFAULT_DEV_OPTIONS);w.startDeveloper(config);expect([...w.actors.values()].every(a=>a.attributes.value.armor===(a.attributes.template.stats.armor??0)+100)).toBe(true);const snap=w.snapshot();expect('attributes' in JSON.parse(JSON.stringify(snap.hero))).toBe(false);snap.hero.attributeValues.armor=999;snap.hero.attributeExplanation.sources[0]!.modifiers[0]!.value=999;expect(w.hero.attributes.value.armor).toBe(100);const normal=new GameWorld(1);normal.startDeveloper(config);expect(normal.hero.attributes.value.armor).toBe(0);
 });
 it('advances regeneration and mana only in live combat, freezes during pause and cannot revive',()=>{
  const w=new GameWorld(1,'ember',{...DEFAULT_DEV_OPTIONS,freezeEnemies:true});w.startDeveloper(parseDeveloperConfig({version:2,seed:1,mapId:'ember',wave:1,loadout:DEFAULT_LOADOUT,equipment:{},purchaseOrder:[],perks:[],options:DEFAULT_DEV_OPTIONS}));mod(w.hero.attributes,[{stat:'healthRegen',operation:'flat',value:30}]);w.hero.hp=100;w.advance(1/30);expect(w.hero.hp).toBe(101);w.paused=true;w.advance(.2);expect(w.hero.hp).toBe(101);w.paused=false;w.hero.hp=0;w.hero.alive=false;w.advance(1/30);expect(w.hero.hp).toBe(0);
 });
});
