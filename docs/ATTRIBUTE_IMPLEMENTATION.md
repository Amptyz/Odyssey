# 统一属性系统实施记录 · STAT-02

日期：2026-10-16。规则版本 `ATTRIBUTE_RULE_VERSION = 1`；房间协议 `ember-coop-4`；关卡恢复格式 `version: 3`。本文件记录实际 API、旧内容迁移和已运行验证；产品设计见 [ATTRIBUTE_SYSTEM.md](ATTRIBUTE_SYSTEM.md)。

## 状态归属与入口

所有逻辑战斗单位通过 `combat-core/ActorFactory.ts:createActor` 创建，强制持有独立 `AttributeSet`。`GameWorld.makeUnit` 在这个唯一入口上增加移动、动画信号和技能冷却。当前玩家、4 种敌人共用此路径；未来召唤物可使用同一工厂和 `classification: pet`，本任务没有另行增加召唤技能、召唤 AI 或召唤物跨波保存。

- `AttributeSet.ts`：22 项属性、模板/成长、来源 upsert/remove、脏缓存、解释明细、表达式、抗性、移速、急速与吸血效率的纯 TS 规则。不依赖 cc、DOM、真实时钟或全局随机。Map/Set迭代器转数组使用Array.from，避免Creator默认Babel宽松编译将迭代器spread当成单个数组元素。
- `UnitTemplate`：`stats`、`baseAttackSpeed`、`attackSpeedRatio`、可选攻速上限/成长，`resourceKind`、`classification`、`canMove/canAttack/controlImmune`。模板入实例时复制并冻结；成长由构造参数 level 使用，现有局没有经验升级玩法。
- `Actor`：当前 hp/mana、shield 实例、status 实例、combatEffects 和临时 attributeEffects。状态不写回共享模板；`hp/maxHp/shield/shieldTime` 暂保留表现兼容字段，实际护盾使用实例数组。
- `EquipmentSystem`：只负责购买/库存/槽位，装备变更时同步 `equipment:<slot>` 来源。`deriveStats` 和 `HeroStats` 是统一解析器的兼容视图，没有第二套英雄属性公式。
- `CombatEngine`：伤害、治疗、护盾和临时效果的统一入口；不再按 team 限制暴击、OnDamaged 或海克斯规则。
- `SkillSystem`：表达式与行为；`EnemyBehaviors` 消费同一属性。敌人没有玩家商店或背包 UI。

## 属性来源与运算

```ts
actor.attributes.upsert({
  sourceId: 'permanent:example',
  modifiers: [
    {stat: 'attackDamage', operation: 'flat', value: 40},
    {stat: 'attackSpeed', operation: 'percent', value: .30},
    {stat: 'armorPenPercent', operation: 'percent', value: .20},
  ],
});
actor.attributes.remove('permanent:example');
const readonlyFinal = actor.attributes.value;
const plainExplanation = actor.attributes.explain();
```

`sourceId` 为替换/撤销身份；`instanceId` 未指定时按修正项索引生成。upsert 替换整个同 ID 来源，不累加已解析结果。导入的模板、来源、表达式有字段和有限数校验；表达式拒绝 `baseAttackDamage/bonusAttackDamage` 及其他未知键。输出缓存只读；来源/解释导出为复制对象。

| 属性种类 | 实际 operation 语义 |
| --- | --- |
| 普通数值、AD、AP、移速原值 | `(模板与成长 + flat和) × (1 + percent和) × multiply积` |
| 攻速 | `模板攻速 + 攻速收益系数 × 额外攻速比例`，再乘专属倍率，最后限制上限；flat/percent 在此属性都表示额外攻速比例，推荐 percent |
| 穿透百分比、韧性、减速抗性 | flat 进入同类加法组，percent 表示独立剩余比例组，`1 - (1 - 基础与flat和) × ∏(1-percent)`；multiply 显式乘最终结果，不被解释成减免 |
| 命名唯一来源 | 相同 stat/operation/stackingGroup 默认取数值最大；可显式 `stackingRule: min/sum`；同一组不允许冲突的 stackingRule |
| 暴击率 | 加法后限制 0–1；普通倍率起点 2.0 |
| 全能吸血 | 加法，不设 100% 隐藏上限 |

独立韧性来源应使用 percent；只有明确属于同一加法组时使用 flat。这个规则是项目的显式分组接口，不意味着所有 LoL 特殊韧性被动都拥有同一分组。最大生命按整数取整；最大生命/法力重算仅截断当前资源，不免费治疗或复活。HSP、穿透点数等有效输出有非负边界，避免负护盾反向增加伤害。

`applyAttributeEffect(targetId, source, duration)` 用于临时属性来源，要求 `sourceId` 以 `temporary:` 开头，计时结束移除来源；替换同 ID 会更新时长。离开波次及开发者恢复时清除临时来源。

## 移速映射与旧内容数字

所有单位共用 `MOVE_SPEED_SCALE = .01` 格 / 速度点。模板和来源先合成 raw 速度，再乘适用减速（幅度受 slowResist 修正），再做软阈值：

```text
raw > 490：0.5 × raw + 230
415 < raw ≤ 490：0.8 × raw + 83
220 ≤ raw ≤ 415：raw
raw < 220：0.5 × raw + 110
世界格/秒 = 阈值后点数 × .01
```

为同时保留初始玩家 4.2 格/秒及旧慢怪速度，玩家模板 rawMS 使用 421.25，最终面板 420 点。普通面板 `snapshot.stats.moveSpeed` 是阈值后 420 点，`stats.speed` 是 4.2 格/秒。单位 `attributeValues.moveSpeed` 和解释 `final.moveSpeed` 是来源合成后的 raw 值；`attributeExplanation.movement` 明确提供 rawPoints/points/worldSpeed，`unit.movementPoints/worldMoveSpeed` 额外包含当下减速。F2 将原始项标为 rawMoveSpeed。

皮衣 +10% 与兜帽 +5% 先相加为 rawMS ×1.15，再经软阈值，得到 4.7055 格/秒；不会简单变成 4.2×1.15。MS 为零不代表不可移动；固定单位用 `canMove: false`。

| 单位 | HP | 总AD | AP | 基础AS/收益系数 | rawMS | 格/秒 | 攻击距离 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 玩家 | 240 | 20 | 0 | 1/.7 | 421.25 | 4.2 | 2.5 |
| 遗迹小精灵 | 62 | 11 | 0 | 1/(.42+1.25) | 130 | 1.75 | .9 |
| 雾灯精灵 | 48 | 13 | 0 | 1/(.65+2.4) | 40 | 1.3 | 6.5 |
| 霜叶精灵 | 56 | 10 | 0 | 1/(.85+2.8) | 20 | 1.2 | 6 |
| 古树守卫 | 105 | 16 | 0 | 1/(.8+1.8) | 10 | 1.15 | 1.4 |

玩家 classification 为 champion；4 种旧敌人为 monster，不按贴图大小当成小兵。基础 armor/MR 均为 0；所有单位现有 resourceKind 为 none，未平空增加蓝耗。

敌人模板基准 AS 对应旧 `windup + interval`，不单独取 interval 的倒数。前摇受额外攻速缩短，后摇由完整攻速周期扣去本次前摇；远程技能后摇再使用急速倍率，施法本身也检查同一份技能冷却和法力。前摇不随急速统一缩短。逻辑仍按 30 Hz 量化。

## 旧装备迁移与新增写法

下表是统一属性首次迁移时的历史数值。当前已改成六个通用栏，现18件统一100金币并重新平衡，最新数值见`content/equipment.ts`及[六格装备设计](design/EQUIPMENT_DESIGN.md)。

| 装备 | 迁移后属性 |
| --- | --- |
| sword 赤铜长剑 | AD16、护甲8 |
| staff 星辉法杖 | 射程4、AP45、急速15 |
| bow 猎风长弓 | 射程5、额外AS30%、AD6 |
| bulwark 壁垒重盾 | 护甲40、生命60 |
| plate 赤铜胸甲 | 护甲25、生命60 |
| robe 星纹法袍 | AP25、生命20 |
| leather 游侠皮衣 | 额外AS20%、raw移速10% |
| helm 壁垒战盔 | 护甲15、生命40 |
| circlet 奥能头环 | AP15、急速10 |
| hood 猎风兜帽 | AD5、raw移速5% |

原 skillPower 的三个百分比数值通过逐技能 AP 系数和 45/25/15 AP 重新设计，不是把百分比字段改名为 AP。物理技能、固定伤害海克斯和生命附伤不再吃通用全技能倍率。护甲只处理物理伤害，不再替代魔抗。弓/法杖的普攻目前均为总 AD 的物理伤害。

新增装备直接使用完整统一属性修正，`stats` 只为旧内容保留薄适配：

```ts
{
  name: '示例装备', category: 'head', price: 100, description: '魔抗与全能吸血',
  stats: {},
  modifiers: [
    {stat: 'magicResist', operation: 'flat', value: 30},
    {stat: 'omnivamp', operation: 'flat', value: .08},
    {stat: 'critChance', operation: 'flat', value: .15},
  ],
  appearance: 'ironHelm',
}
```

当前17种怪物均已接入EnemySystem与两图10关；18件装备均已进入商店和F2。符击、石息由独立EquipmentEffectSystem消费实际战斗事件，详见[装备实施记录](design/EQUIPMENT_IMPLEMENTATION.md)。

## 技能表达式、类型与采样

| 技能 | 实际表达式 | 伤害类型/行为 |
| --- | --- | --- |
| fireball 烬火弹 | 38 + .38 AP | 魔法 |
| icebolt 霜凝弹 | 30 + .30 AP | 魔法，减速 |
| nova 余烬绽放 | 72 + .72 AP | 魔法范围 |
| frostNova 寒霜环 | 42 + .42 AP | 魔法范围，减速 |
| cleave 裂空斩 | 45 + 1 AD | 物理扇形 |
| volley 穿云箭 | 25 + 1 AD | 物理投射 |
| shield 琥珀护盾 | 65 + .65 AP | 护盾，4秒 |
| ironGuard 钢铁壁垒 | 120 + 1.2 AP | 护盾，6秒 |
| dash 流火步 | 无伤害表达式 | 3.5格、.18秒 |
| mistBolt/frostBolt 敌人弹体 | 1 AD | 魔法 |

技能说明从 expression 格式化，UI 和运行时使用同一份系数。内容校验要求伤害/护盾技能配置 expression；behavior.damage/amount 暂留作为旧结构兼容，但新增内容不能依赖 fallback 绕过校验。

普攻与投射技能的 AD/AP/施法者生命系数在释放时采样一次；目标生命项在命中时读取，整体 cap 在合成后应用。无 target 调用目标生命表达式会抛错，不能把施法者当目标。暴击率/倍率、攻击者穿透/吸血、目标双抗/护盾/承受治疗在结算时读取。弹道期间不会再次给已经采样的 AD/AP 乘一遍技能威力。

`Hit.damageType` 使用 physical/magic/true，`delivery/area/proc/canCrit/critRatio/vampEligible` 分别说明投递/范围/连锁与资格。旧 Hit.trueDamage/unscaled 已移除；CombatCue.trueDamage 仅是浮字表现信号。

## 战斗结算和可复用效果

抗性按固定削减→百分比削减→百分比穿透→固定穿透处理，护甲/MR共用函数。削减可以制造负抗性，穿透不能。真实伤害跳过双抗；不能绕过 invulnerable。

普通伤害与 glassCannon 的真实附伤分别生成组件，逐类型吸收护盾，保留每组件 `postMitigation/shieldAbsorbed/healthLost/overkill`；一笔命中只生成一次 OnHit/OnAttackHit。先纯计算真实吸收和生命损失，再做事件预算预留，最后提交资源修改，避免类型盾导致预算或 OnDamaged 漏算。

- `shield(sourceId,targetId,amount,duration,id,types?)`：source的HSP作用一次；不同 ID 独立，到期独立移除，同source+id替换。type可限定 physical/magic/true，默认三者。
- `healTarget(sourceId,targetId,amount,parent?,kind?)`：施加者 HSP、目标 received、最强重伤各作用一次。`heal` 是 self-heal薄封装。有效治疗才产生 OnHeal；自然回复和全能吸血不乘 HSP。死亡不能被普通治疗或回复复活。
- `applyCombatEffect(targetId,{sourceId,instanceId,remaining,...})`：支持双抗固定/百分比削减、healingReceived、grievousWounds、invulnerable；同来源实例替换，固定削减求和、百分比削减乘剩余比例、重伤取强，tick到期。`removeCombatEffect` 显式撤销。
- `applyAttributeEffect`：临时属性来源，见上文。

内容 `Effect` 具备 `attribute/combatEffect/shield/damage` 原语；heal可配置 expression。例如普通命中减甲：

```ts
{event: 'OnHit', directOnly: true,
 effect: {type: 'combatEffect', effect: {remaining: 3, armorReductionFlat: 10}}}
```

给自己临时急速：

```ts
{event: 'OnSkillCast',
 effect: {type: 'attribute', target: 'source', sourceId: 'brief-haste', duration: 2,
   modifiers: [{stat: 'abilityHaste', operation: 'flat', value: 20}]}}
```

全能吸血以减伤后伤害为基数，包含盾吸收与过量伤害，不用 healthLost 替代。默认100%效率；v1明确采用 pet/periodic为33%，AOE对minion为33%，现有monster范围伤害维持100%。近战扇形、敌人扇形、爆炸和轨迹范围伤害显式携带area/delivery身份；真实近战碰撞命中minion/monster的集成测试分别验证33%与100%吸血效率。吸血由drain内执行，保留root/depth/proc、预算及去重。治疗派生的死亡之环伤害标记 derived-heal 且不可吸血；其派生治疗不能再次触发同类环，避免以治疗给自己制造额外吸血。

普通减速实例独立计时，取最强，结束后回退弱者；tenacity缩短时间、slowResist减幅。v1最短常规控制时长.3秒，但原本短于.3秒的效果绝不延长。当前内容只有减速；没有声称已实现眩晕、击飞、压制的完整技能状态机。burn/infernal按source+status保留归属，infernal上限5层是每来源独立上限，不把两玩家DOT转给最后施加者。

## 快照、F2与恢复

展示 `UnitSnapshot` 是移除了 AttributeSet 的纯数据。attributes值、来源解释、盾、状态、冷却、临时效果和弹体表达式对象均复制；不含Map/Set/Actor实例。网络快照不是任意战斗恢复点。

F2第五页「属性/来源」可循环查看单位、全部最终属性、移速映射与来源。可配置 `attributeModifiers: Modifier[]` 和 `attributeTarget: players/enemies/all`；直接输入框提供固定加成，百分比/倍率/分组可由复现JSON配置。配置经过解析校验，只有显式应用测试世界才生效；普通局调用不会应用测试属性。

checkpoint v3保留法力和额外永久来源；装备与perks按ID重建，永久来源过滤equipment:/perk:/temporary:/developer，避免重复加成。恢复当前生命/法力截断至重建上限；不相信展示快照的最终属性。战斗保存仍代表波次起点，盾/状态/冷却按原波次语义重置。旧v1/v2恢复点与旧房间协议明确拒绝，不静默迁移。

## 规则依据、边界与验证

本次核验官方 primary sources：[26.1版本说明](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)确认普通暴击200%及全能吸血效率；[2025.S1.3版本说明](https://www.leagueoflegends.com/en-us/news/game-updates/patch-2025-s1-3-notes/)确认普通AS上限3.0。规则固定在本地，不按联网最新规则热更新。

移速软阈值、.3秒控制最短时长、来源分组、护盾/过量伤害吸血基数及特殊英雄机制没有在这些官方说明中逐项公开。本实现将上文数值和采样契约固定为 Ember v1规则并用测试覆盖；它们不是逐帧复刻所有LoL英雄和装备的声明。全能吸血官方句子对目标范围存在语法歧义，v1显式固定了本节列出的解释，后续核验若变更应提升规则/协议版本。

### 属性系统首次交付的历史验收（六栏 / 十关升级前）

以下数字和 ember-coop-2 只记录当时结果；当前六栏装备、17怪与大地图的验收见 [本轮报告](../reports/campaign-validation.json)，当前运行协议为 ember-coop-4。

当时执行 `pnpm check`：核心/Cocos/工具类型检查、Vitest 15个文件170项测试、核心编译全部通过。属性新增27项测试覆盖公式、来源替换/隔离、双抗/负抗性/穿透、敌人暴击、类型盾、混合真实组件、各伤害类型吸血/盾/过量/免疫、治疗归属/重伤、负HSP、减速回退、多人DOT归属、临时来源、资源消耗、永久来源恢复、旧版本拒绝与快照隔离。`git diff --check` 通过。

父流程已完成 Creator 3.8.8 官方 CLI Web Desktop 构建（15:55:00，退出码36），49份运行源码与隔离构建副本逐文件一致，3份新增.meta由Creator导入生成。本地8080产物已更新；本机中转已使用 ember-coop-2。

最终构建的浏览器回归：attributes 21、hitboxes 14、hexes 21、multiplayer 15、content 26、developer 30、controls 31，共158项通过。实际检查商店与属性来源面板、技能替换文字和双人战斗画面；正常霜镜通关、独立属性与新房恢复均通过。耐久基准使用统一属性来源设置夹具HP，50敌人/3600实际tick，平均0.787ms、P95 1.670ms，属于逻辑加快照耗时，不是渲染FPS。完整证据和未覆盖范围见 [验证报告](../reports/attributes-validation.json)。
