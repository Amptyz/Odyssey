# 内容扩展架构 v0.6

游戏源码根目录为 `EmberDemo/assets/scripts/ember/`。下面所有源码路径均相对此目录。

本文负责“新增内容具体改哪些文件”；运行机制见 [整体架构](ARCHITECTURE.md)，实施与测试流程见 [开发架构指南](DEVELOPMENT_GUIDE.md)。以下示例是供开发时注册的新内容，**并未加入当前游戏**。除特别说明外，示例对象应作为条目加入对应注册表，不要另建一份不被系统读取的配置。

## 扩展入口速查

| 内容 | 必改定义 | 关联入口 | 新机制才修改 |
| --- | --- | --- | --- |
| 主动技能 | skills 的 SKILLS、SKILL_DESCRIPTIONS | hero 标签 → HERO_SKILLS → RewardSystem；F2 自动枚举 | SkillBehavior、SkillSystem、必要的世界状态 / 判定 |
| 装备 | equipment 的 EQUIPMENT | SHOP_CATALOG → ShopPanel；F2 自动枚举 | 属性推导 / 消费、普攻行为、装备槽与渲染 |
| 敌人 | enemies 的 ENEMIES | maps 的 spawns；F2 刷怪自动枚举 | EnemyBehaviorId、EnemyBehaviors、行为状态 / 预警 |
| 地图 | maps 的 MAPS | 首页和 F2 自动枚举 | 导航 / 投影模型、环境布局、阶段规则 |
| 增益 / 海克斯 | perks 的 PERKS | RewardSystem 按技能条件过滤；F2 自动枚举 | Rule / Effect 类型、EffectHandlers、CombatHooks |
| 状态 | statuses 的 STATUSES | 技能 onHit 或增益 effect 引用 | StatusSystem 的行为与重置语义 |
| 外观 / 动作 | appearances、animation、art-manifest 与真实资源 | ArtLibrary / AnimatedUnit / HeroRig / EnvironmentView | 新图集布局、全新表现方式 |

注册后检查 `content/validate.ts`；新字段的语义约束需要同步加入，不能把 TypeScript 类型通过当成内容已经可玩。

## 数据、行为、表现分层

```mermaid
flowchart LR
  Input[键鼠输入] --> Slots[技能槽 Q/W/E/R]
  Slots --> World[GameWorld 固定步进]
  Content[地图 / 技能 / 敌人 / 增益配置] --> World
  World --> Skills[SkillSystem 行为注册表]
  World --> AI[EnemyBehaviors 行为注册表]
  World --> Combat[CombatEngine 事件队列]
  Skills --> Combat
  AI --> Skills
  Combat --> Effects[EffectHandlers / StatusSystem]
  World --> Snapshot[脱离引擎的快照]
  Snapshot --> View[ArenaView / Hud]
  Visuals[外观定义 / ArtLibrary / AnimatedUnit] --> View
```

- `GameWorld` 负责时间、实体、移动、波次和系统调度，不再按 Q/W/E/R 分支执行技能，也不按敌人种类分支执行 AI。
- `content/skills.ts` 中的 `fireball`、`icebolt` 等是技能 ID。Q/W/E/R 仅是槽位，输入发送 `CastSlot`，系统解析当前装备。
- 技能投射物保存真实 `skillId`，命中、状态来源、增益条件和渲染颜色都沿用它。新增投射物不会被识别为旧的 Q。
- `CombatEngine` 保留事件预算 128、链深度 6、规则去重和单次击杀保障；效果实现放在 `EffectHandlers.ts`。
- 首批 12 个海克斯已接入统一奖励池，新增出手 / 攻击特效 / 治疗 / 受伤 / 冲刺结束事件、条件限频与叠层状态。通过 `CombatHooks` 连接弹体和技能冷却，详细配置约定与数值见 [HEX_AUGMENTS.md](HEX_AUGMENTS.md)。
- 开发者模式通过版本化 `DeveloperConfig` 与 LocalTransport 单独的命令边界提供组合 / 关卡测试；面板枚举同一内容注册表。应用配置创建全新测试世界，普通世界拒绝测试动作，退出会清空测试状态；操作与扩展见 [DEVELOPER_MODE.md](DEVELOPER_MODE.md)。
- `content/validate.ts` 在启动时检查内容引用、正数参数、地图出生点、怪物配置、外观引用和奖励池容量。类型检查及测试同样覆盖这些定义。

## 添加技能

1. 在 `content/skills.ts` 添加唯一 ID、名字、冷却、标签、外观 ID 与行为参数。当前共用行为为 projectile / shield / dash / area / cone。投射物必须配置世界单位半径 `radius`；圆形范围配置 `radius`，扇形配置 `radius + arc`（弧度），共用碰撞查询。
2. 添加 `hero` 标签并在 `SKILL_DESCRIPTIONS` 写描述，即自动进入技能奖励池。敌方技能不加 hero 标签。玩家从三选一选中技能后，确认替换任意 Q/W/E/R 槽位；不可同时装备重复技能。
3. 添加对应逻辑测试。全新机制才需要扩展 `SkillBehavior` 与 `simulation/SkillSystem.ts` 的处理函数。

已接通的示例：

```ts
icebolt: {
  name: '霜凝弹', cooldown: 1.6,
  tags: ['hero', 'projectile', 'ice'], appearance: 'ice',
  behavior: {
    kind: 'projectile', damage: 30, speed: 10, range: 13, radius: 0.18,
    onHit: [{ id: 'slow', duration: 2.5, power: 0.55 }],
  },
}
```

双重施法和奥能储备通过 `hero + projectile` 标签同时支持火弹、冰弹。燃烧弹限定 `hero + projectile + fire`；冰弹不会误触发灼烧。奖励池按当前技能标签过滤无法使用的增益；`requiresSkillTags` 表示同一技能必须匹配全部标签，`requiresSkillGroups` 表示每组标签各自至少有一个技能匹配。奥能储备要求护盾与投射物同时存在。已获得增益不因换技能被删除，缺少触发条件时保持休眠。

当前 dash 的移动状态属于英雄，敌人调用会明确报错。若要添加冲锋敌人，应实现独立冲锋行为或先将冲刺状态扩展到各实体，不要直接把英雄 dash 配给怪物。

### 可复制示例：高速冰针

在 SKILLS 中新增下面的属性。复用现有 projectile、slow 和 ice 外观，不需要修改 GameWorld：

```ts
frostNeedle: {
  name: '霜叶冰针', cooldown: 2,
  tags: ['hero', 'projectile', 'ice'], appearance: 'ice',
  behavior: {
    kind: 'projectile', damage: 22, speed: 14, range: 10, radius: 0.14,
    onHit: [{ id: 'slow', duration: 1.5, power: 0.65 }],
  },
},
```

在 SKILL_DESCRIPTIONS 同时加入 `frostNeedle` 的描述：造成 22 点基础伤害，减速 35%，持续 1.5 秒。`power: 0.65` 表示保留 65% 移速；damage 不含装备与增益加成。SkillId、HERO_SKILLS、奖励池及 F2 技能列表会随注册表更新。

按以下顺序验收：F2 选择任意槽装备 → 应用关卡 → 指针朝敌人脚底施放 → 碰撞后伤害与减速生效 → 射程外 / 墙后不命中 → 换另一槽仍保留 skillId → 关闭开发者开关测试正常冷却。再检查普通奖励能够提供它、四槽不可重复，以及 double / reserve 能生效、fire 限定的 burn 不误触发。

对应测试从 `tests/simulation/content.test.ts` 的 icebolt 案例开始；不是把新技能永久绑定 Q。敌人技能也要写描述，但不加 hero 标签，不进入玩家候选。

### 全新技能行为

例如穿透弹或指定落点范围，当前配置不能完整表达。扩展 `SkillBehavior` 的区分联合 → 实现 SkillSystem.handlers → 按需扩展 SkillContext / GameWorld 状态 → 扩展引用校验 → 更新快照 / cue / 预警 → 测试实际碰撞与结束清理。当前 area 以施法者为中心，cone 立即结算，不能仅改描述就声称有鼠标落点 AOE 或前摇。

## 添加状态和联动效果

- `content/statuses.ts` 定义状态，`Actor.statuses` 保存实例；没有为每种负面状态增加专用角色字段。
- 已实现灼烧、减速和导管灼烧。灼烧 / 减速保留较强效果、较长剩余时间；导管灼烧使用 add-refresh，最多 5 层。状态刷新不重置下一次跳伤时间。
- 减速倍率作用于英雄的普通移动与敌人移动；不会改变技能冷却或冲刺距离。暂停冻结持续时间，重开 / 新波次清理英雄状态。
- `content/perks.ts` 配置触发事件、技能 / 标签条件、目标状态和效果。增加新组合通常只需增加定义，PerkId 从定义自动推导。
- 全新效果原语需要扩展 `combat-core/types.ts` 的 Effect 与 `EffectHandlers.ts`；全新状态行为需要扩展 `StatusSystem.ts`。事件队列不需要增加具体效果分支。
- 护盾仍使用独立的护盾数值与持续时间，尚未统一为通用状态实例。冰冻、击退、召唤、持续施法未实现。

### 可复制示例：冰系命中附带更久减速

向 PERKS 数组新增一个元素，复用现有规则 / 状态处理器：

```ts
{
  id: 'coldFocus', name: '凝霜专注', color: '#A9E5F1',
  description: '冰系投射技能直接命中后，使目标减速 40%，持续 3 秒。',
  requiresSkillTags: ['hero', 'projectile', 'ice'],
  rules: [{
    event: 'OnHit', causes: ['skill'], directOnly: true,
    skillTags: ['hero', 'projectile', 'ice'],
    effect: { type: 'status', status: { id: 'slow', duration: 3, power: 0.6 } },
  }],
},
```

`requiresSkillTags` 决定是否出现于正常奖励候选，`rules.skillTags` 决定实际战斗何时触发，两者不要混淆。F2 故意不按技能过滤增益，便于测试不满足条件时的休眠。这里增加了规则，仍然只有一个 slow 状态实例，按现有 strongest-refresh 语义合并。

如果添加一个全新状态 ID，要填写 STATUSES，再从技能 / effect 引用它。`interval` 是跳伤间隔，power 是每次跳伤量；只有 interval=1 时才等于每秒伤害。当前每个目标按状态 ID 合并，不是每个来源各一份；若需要独立施法者叠层，先修改状态键和对应测试。新 speed 状态还需自行限制倍率范围，现有运行时对 `slow` 的专门校验不会自动覆盖任意新 ID。

需要新效果原语时，除 `Effect / EffectHandlers` 之外，检查 `validateContent`、事件来源、波次重置、CombatHooks 的实际实现和快照表现。命中、出手、攻击特效、掉血、治疗分别使用不同事件；完整说明见 [海克斯](HEX_AUGMENTS.md)。

## 添加敌人

`content/enemies.ts` 将敌人 ID 与 `behavior`、`skillId`、`appearance` 分开。

霜叶精灵 `frostling` 共用 ranged 行为，使用 frostBolt 和 frostling 外观，因此无需在 GameWorld 中为它添加判断。

- 同行为变种：加敌人定义、外观定义，然后加入地图刷怪列表。
- 新行为：扩展 `EnemyBehaviorId` 与 `ai/EnemyBehaviors.ts` 的更新函数，可复用追击 / 攻击前摇，也可实现自己的移动策略。行为通过上下文访问寻路、移动、伤害和技能施放。
- 近战与远程共用现有自动寻路，不包含行为树编辑器或复杂 Boss 阶段系统。

### 可复制示例：冰霜斥候

在 ENEMIES 中新增条目，先复用已有外观与敌方技能：

```ts
iceScout: {
  name: '冰霜斥候', hp: 42, speed: 1.6, radius: 0.3,
  damage: 10, range: 5.5, interval: 3, windup: 0.9,
  behavior: 'ranged', appearance: 'frostling', skillId: 'frostBolt',
},
```

在某张地图的某一波 spawns 中加入 `{ enemyId: 'iceScout', count: 2 }`，或明确替换原有数量；这才接通普通关卡。F2 刷怪列表会自动出现新 ID。若要独立贴图，appearance 需同时注册到 UNIT_APPEARANCES 和 UNIT_SPRITES，并提供真实图集 / clip。

当前 ranged 行为的实际伤害和弹速来自 frostBolt，射击间隔来自 interval，前摇来自 windup；敌人定义中的 damage 在此行为不负责弹体伤害。新怪如果要不同弹道，新增敌方技能后让 skillId 引用它。

验收新怪出生、追击绕柱、进入射程后的预警、离开原瞄准点能够躲开、弹体被墙挡住、状态来源归属、受击 / 死亡动作。大体型需额外检查导航半径与出生间距，不能只放大贴图。修改波次数量后更新确实依赖该总数的回归期望。

## 添加地图

在 `content/maps.ts` 注册地图：名字、宽高、英雄出生点、敌人出生间距、障碍、波次、初始技能、`shopAfterWaves`（在哪些非最终波之后开店）、环境外观 ID 和颜色主题。地图选择按钮自动枚举注册表。

寻路边界、地面绘制、出生范围、镜头居中和 HUD 总波次数全部读取同一份定义。

现有地图：

| 地图 | 尺寸 | 波次 / 敌人 | 默认 Q |
|---|---|---|---|
| 余烬庭院 | 20×20 | 3 波 / 27 个 | 烬火弹 |
| 霜镜回廊 | 24×16 | 2 波 / 13 个 | 烬火弹 |

当前地图为整数尺寸矩形，障碍为圆形碰撞体。不支持房间串联、传送门、动态地形或程序化关卡。地图切换只在首页允许，切换会重置本局；重开保留地图，但恢复统一初始技能、空装备和初始金币。

被动增益不可重复领取，技能奖励排除当前已装备技能；被替换掉的技能以后可以再次出现。正常奖励为两被动加一技能，被动耗尽时由其他技能补足三张，技能注册数量会在启动校验。无法找到安全出生位置会明确报错，不会静默少刷敌人。

### 地图注册步骤

以 frost 为完整模板，在 MAPS 加新 ID，逐项改 name、width / height、heroSpawn、spawnMargin / spawnDistance、obstacles、waves、shopAfterWaves、theme / environment。当前设计使用共同的 DEFAULT_LOADOUT，不要顺带为地图引入职业选择。

确保出生点能容纳英雄半径，障碍完整位于边界内、ID 不重复，波次非空、敌人 ID 存在、count 是正整数、hpScale 为正数。shopAfterWaves 用 1 起始的非最终波编号；留空表示没有波间商店，开局商店仍保留。每波先奖励再按配置进入商店，最终波仍先选奖励才胜利。

通过引用校验后，还要实际生成每一波，测试安全出生位置容量、导航可达、地图投影 / 输入逆变换、UI 总波数及正常通关。开发模式跳到第三波只生成第三波初始场景，不会重放前两波消耗的随机数和玩家操作，不能拿它替代普通流程测试。

## 装备、经济与阶段流程

- `content/equipment.ts`：装备 ID、槽位、固定价格、属性增量、外观 ID 和武器普攻 `attack` 配置 ID；`SHOP_CATALOG` 自动枚举全部装备，不用维护 UI 商品分支。新装备使用已有属性与外观形状时只需添加配置。
- `simulation/EquipmentSystem.ts`：金币、已购库存、装备槽与购买 / 换装 / 卸装。购买事务检查 ID、重复购买和余额后才扣款；同槽旧装备保留。所有操作仅在 GameWorld 的 shop 阶段被接受，战斗、奖励或结算阶段的购买命令无效。
- `content/progression.ts`：初始 160 金币，每波固定收入 `100 + (wave - 1) × 20`，波次完成时仅发一次；地图配置商店阶段。当前不卖出、不退款、不跨局保存装备或货币。
- `simulation/RewardSystem.ts`：统一 `RewardChoice` 联合类型，明确区分 perk / skill。`ChooseReward` 选增益，技能需要 `ConfirmSkill` 确认槽位；`CancelSkill` 只撤销预选，不重新抽卡。确认后才消耗整次奖励。
- 流程为 ready → 开局 shop → fighting → reward → 可配置的 shop → 下一波；最终 reward 后 victory。暂停只影响 fighting，商店 / 奖励自身冻结模拟时间。
- `deriveStats` 每次从基础属性和当前槽位重算，旧装备不会残留加成。平坦加值求和；同类百分比先相加，攻速和急速分别用 `基础间隔 / (1 + 加值总和)`。
- 护甲使承伤乘以 `100 / (100 + 护甲)`，之后扣护盾 / 生命；真实伤害绕过护甲但不绕过护盾。技能威力作用于英雄普通非普攻伤害和护盾生成值，`unscaled` 标记避免按普攻 / 生命 / 治疗比例派生的附伤重复放大。普攻独立读取普攻伤害、间隔和射程。长弓和法杖生成独立普攻弹体，`cause: basic` 且没有 `skillId`。法杖获得 +4 普攻射程。最终最大生命由 GameWorld 在装备统计基础上应用增益倍率，快照 stats 与角色 maxHp 保持一致。
- 换装只更新生命上限并截断超出的当前生命，不回补生命，防止反复换装回血。第一波开始补满装备后的生命上限；其余波次仅恢复 30 点。
- 新属性先扩展 `StatBonus / HeroStats / deriveStats`，再在实际消费位置应用；装备不直接改技能数据。新装备槽还需扩展 `EQUIPMENT_SLOTS`、槽名和表现层绘制顺序。

### 可复制示例：复用剑外观的新武器

在 EQUIPMENT 中增加条目：

```ts
trainingBlade: {
  name: '轻练长剑', slot: 'weapon', price: 80,
  description: '扇形挥斩；普攻伤害 +12，冷却急速 +10%',
  stats: { attackDamage: 12, haste: 0.1 },
  appearance: 'copperSword', attack: 'sword',
},
```

这个例子沿用现有挥击和图片，不需要新资源。SHOP_CATALOG 和 F2 的装备选项自动更新，ShopPanel 按目录分页；装备属性由 deriveStats 重新计算。若需要独立的挥击速度 / 形状，先在 BASIC_ATTACKS 注册 melee 行为并引用其 ID；若需要新属性，则落实推导和消费位置。

验收固定价格购买、余额不足 / 重复购买不扣款、替换后旧装备仍在库存、免费切回 / 卸下恢复属性、来回换装不回血、不在商店时交易被拒绝，以及实际普攻的伤害 / 形状。新增装备也要检查既有测试中对货架数量和分页坐标的假设。

### 新装备外观

为新 appearance 同时填写 EQUIPMENT_APPEARANCES（layer / shape / 颜色）与 EQUIPMENT_SPRITES（frame / width / height / anchorX / anchorY 或 y）。appearance.layer 必须与装备 slot 对应；武器 shape 也参与当前 HeroRig 的摆臂 / 转腕方式。新 shape 的动作语义不是只改字符串就完成。

当前装备精灵统一读取 equipment 图集；新增独立 PNG 需要扩展这个表现契约和资源加载，不能把它当成已存在的 atlas 字段。通过 Creator 导入素材并提交 .meta 后，按 [美术管线](ART_PIPELINE.md) 更新图集生成来源。

人物手臂使用 HERO_ARM_ATTACHMENTS 的真实肩关节和掌心坐标，武器以其握把 anchor 对齐掌心；不是每张图都用 `.5 / .2`。先看放大的商店预览，再看战场实际大小、左右镜像和攻击最大角度，检查衣甲遮挡与武器漂移。视觉改动不修改角色 radius。

## 普攻与命中体积

- `combat-core/CollisionWorld.ts` 是独立于 Cocos 渲染 / 刚体的确定性几何查询。角色 `radius` 是脚底世界平面上的受击圆；地图障碍同样是圆。图像透明像素和装备外观不会改变碰撞尺寸。
- `HitShape` 支持 circle / sector / capsule；`targets` 统一处理存活、敌我、整圆与攻击形状相交、障碍遮挡及稳定排序。扇形边缘与外圆弧都考虑目标半径，不再只检查目标中心夹角。当前范围 / 近战 / 尸爆 / 电弧搜寻都使用它。
- `firstImpact` 对弹体上一位置到下一位置执行连续圆扫掠，并考虑目标一帧内的相对移动。角色、地图障碍和边界按最早接触排序，墙与目标同时命中时墙优先；当前弹体命中一个敌人后消失。最后不足一帧的剩余射程也会检测，避免提前消失和高速穿透。
- `content/attacks.ts` 注册空手、剑、盾、弓、法杖的普攻行为。近战配置 `arc / windup / active`，远程配置 `speed / radius`；装备的 `attack` 引用行为。伤害、攻速、射程仍由装备属性计算。新增同类武器不需要修改 GameWorld 的装备 ID 分支。
- 近战挥击在前摇后短暂生效，朝向在出手时固定，中心跟随角色移动；同一挥击的 `hitIds` 保证每个敌人最多命中一次，可以同时打到多个相交敌人。冲刺会取消尚未完成的挥击。近战怪物前摇时保存朝向，结束后通过同一扇形查询结算。
- 两种模式均左键攻击；右键模式只发送 MoveTo，移除 SetTarget / targetId / 自动追击。Attack 是单次出手，AttackInput 保存按住状态，松开 / 暂停 / 失焦 / 阶段切换清理。DirectInput 只负责 WASD 移动，寻路移动与按住攻击可以同时存在。
- 输入使用 screenToWorld 原始鼠标地面坐标，不再吸附敌人。弹体表现与碰撞位于同一地面平面，挥击轮廓来自实际半径 / 角度。F3 显示角色、障碍及弹体体积，缩放使用同一投影；不增加常驻复杂特效。
- 已附着的灼烧只在首次命中时检测碰撞，后续跳伤按状态计时，不重新要求视线。护盾作用自身，冲刺用已有移动扫掠。当前没有角色之间的刚体推挤、复杂多边形地形、穿透弹或高度层碰撞。

## 贴图、动画与装备外观

`content/appearances.ts` 使用稳定外观 ID：`UNIT_SPRITES` 配置图集、比例、色调和动作片段；`EQUIPMENT_SPRITES` 配置装备帧、尺寸和挂点；`ENVIRONMENT_APPEARANCES` 配置地图素材角色与水色。`content/art-manifest.ts` 保存真实像素区域，和 Cocos `.meta` 独立。启动检查引用，测试验证区域没有越过 PNG 边界。

`ArtLibrary` 预加载本地透明 PNG 并共享 Texture2D / SpriteFrame；`AnimatedUnit` 按外观 ID 播放怪物序列帧。`HeroRig` 使用六个中性身体部件及三个装备层，战场和商店共用；换装仅重建变化的装备组合，不更改角色实体。

`GameWorld` 快照包含 `facing / action / hurtAt / diedAt`，`motionPose` 将其转换为 idle / walk / attack / cast / hurt / death。伤害、攻击间隔及冷却仍由固定步进控制，动画不回调游戏规则。暂停冻结表现时间；战斗结束时允许死亡动画播完。死亡视图短暂保留并淡出，不再参与碰撞和选择。

古树守卫用较大的图集和独立数值，复用近战 AI；本轮只把第三波的一只普通近战替换为守卫，总敌人数仍为 27。重拳使用前摇结束后按预告方向生效的扇形体积；玩家可以通过移动到扇形之外躲避。

当前两个地图共用遗迹素材，霜镜回廊使用冷色地板与水色；环境布局为按地图尺寸适配的模板。地图障碍沿用碰撞配置，植物及瀑布主要在通行边界外。全新关卡布局可以扩展 `EnvironmentView`，不影响导航定义。旧 `UnitVisuals.ts` 保留作几何版本参考，运行时已改用贴图视图。

制作规范、帧序、换装挂点、素材来源与当前限制见 [ART_PIPELINE.md](ART_PIPELINE.md)。

## 验证

下面是可用验证入口，按 [开发指南的验证矩阵](DEVELOPMENT_GUIDE.md#验证矩阵) 选择相关项，不要求每次内容变更都执行全部长流程。

```bash
pnpm check
pnpm playthrough
# 先完成 Cocos Web Desktop 构建，并保持 pnpm play 服务运行
node --import tsx scripts/browser-playthrough.ts
pnpm test:controls
pnpm test:content
pnpm test:art
pnpm test:hitboxes
pnpm test:hexes
pnpm test:developer
```

`test:content` 使用种子 16、真实键鼠和正常数值通关霜镜回廊，覆盖开局商店、跨页购买、余额不足、技能奖励 / 取消 / E 槽替换、波间收入、购弓、换装、卸下、外观预览、缩放、双向减速和重开清空本局。奖励池扩充后更新种子，继续从正常抽取获得冰弹。
