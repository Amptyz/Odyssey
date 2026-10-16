# 内容扩展架构 · 五关探索与17种敌人

游戏源码根目录为 `EmberDemo/assets/scripts/ember/`。下面所有源码路径均相对此目录。

本文负责“新增内容具体改哪些文件”；运行机制见 [整体架构](ARCHITECTURE.md)，实施与测试流程见 [开发架构指南](DEVELOPMENT_GUIDE.md)。以下示例是供开发时注册的新内容，**并未加入当前游戏**。除特别说明外，示例对象应作为条目加入对应注册表，不要另建一份不被系统读取的配置。

新一批装备、技能、增益使用 [统一属性契约](ATTRIBUTE_SYSTEM.md)：技能只使用总攻击力，吸血只有全能吸血；AP 为点数，急速为点数。属性由每单位 AttributeSet 解析；不要恢复旧 skillPower 百分比放大或英雄专用 deriveStats 公式。

## 扩展入口速查

| 内容 | 必改定义 | 关联入口 | 新机制才修改 |
| --- | --- | --- | --- |
| 主动技能 | skills 的 SKILLS；描述从表达式生成 | hero 标签 → HERO_SKILLS → RewardSystem；F2 自动枚举 | SkillBehavior、SkillSystem、必要的世界状态 / 判定 |
| 装备 | equipment 的 EQUIPMENT | SHOP_CATALOG → ShopPanel；F2 自动枚举 | 属性推导 / 消费、普攻行为、装备槽与渲染 |
| 敌人 | enemies 的 ENEMIES、enemy-actions 的动作/动作集 | maps.waves[].level.groups；F2枚举 | EnemySystem、CollisionWorld、MonsterVisual |
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
  World --> AI[EnemySystem + enemy-actions]
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
2. 添加 `hero` 标签，即自动进入技能奖励池。`SKILL_DESCRIPTIONS` 从 expression / behavior 生成；新增行为要同步扩展格式化函数，不另写容易漂移的伤害数字。敌方技能不加 hero 标签。玩家从三选一选中技能后，确认替换任意 Q/W/E/R 槽位；不可同时装备重复技能。
3. 添加对应逻辑测试。全新机制才需要扩展 `SkillBehavior` 与 `simulation/SkillSystem.ts` 的处理函数。

已接通的示例：

```ts
icebolt: {
  name: '霜凝弹', cooldown: 1.6,
  expression: { flat: 30, abilityPower: 0.30 }, damageType: 'magic',
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
  expression: { flat: 22, abilityPower: 0.22 }, damageType: 'magic',
  tags: ['hero', 'projectile', 'ice'], appearance: 'ice',
  behavior: {
    kind: 'projectile', damage: 22, speed: 14, range: 10, radius: 0.14,
    onHit: [{ id: 'slow', duration: 1.5, power: 0.65 }],
  },
},
```

描述应展示 `22 + 0.22 AP` 魔法伤害、减速 35%、持续 1.5 秒，与 expression 一致。`power: 0.65` 表示减速后保留 65% 的原始速度，之后仍经过减速抗性与移速软阈值。SkillId、HERO_SKILLS、奖励池及 F2 技能列表会随注册表更新；投射行为的目标生命系数不能在发射时把施法者误当目标。

按以下顺序验收：F2 选择任意槽装备 → 应用关卡 → 指针朝敌人脚底施放 → 碰撞后伤害与减速生效 → 射程外 / 墙后不命中 → 换另一槽仍保留 skillId → 关闭开发者开关测试正常冷却。再检查普通奖励能够提供它、四槽不可重复，以及 double / reserve 能生效、fire 限定的 burn 不误触发。

对应测试从 `tests/simulation/content.test.ts` 的 icebolt 案例开始；不是把新技能永久绑定 Q。敌人技能也要写描述，但不加 hero 标签，不进入玩家候选。

### 全新技能行为

例如穿透弹或指定落点范围，当前配置不能完整表达。扩展 `SkillBehavior` 的区分联合 → 实现 SkillSystem.handlers → 按需扩展 SkillContext / GameWorld 状态 → 扩展引用校验 → 更新快照 / cue / 预警 → 测试实际碰撞与结束清理。当前 area 以施法者为中心，cone 立即结算，不能仅改描述就声称有鼠标落点 AOE 或前摇。

## 添加状态和联动效果

- `content/statuses.ts` 定义状态，`Actor.statuses` 保存实例；没有为每种负面状态增加专用角色字段。
- 已实现灼烧、减速和导管灼烧。减速保留各实例与时长，最强者生效，结束后较弱者可继续；韧性影响时长，减速抗性影响幅度。伤害状态按来源保存归属与跳伤节奏，导管层数与来源规则见属性实现说明，不将另一玩家的叠层、吸血或击杀转交最后施加者。
- 减速倍率作用于英雄的普通移动与敌人移动；不会改变技能冷却或冲刺距离。暂停冻结持续时间，重开 / 新波次清理英雄状态。
- `content/perks.ts` 配置触发事件、技能 / 标签条件、目标状态和效果。增加新组合通常只需增加定义，PerkId 从定义自动推导。
- 全新效果原语需要扩展 `combat-core/types.ts` 的 Effect 与 `EffectHandlers.ts`；全新状态行为需要扩展 `StatusSystem.ts`。事件队列不需要增加具体效果分支。
- 护盾通过 CombatEngine.shield 施加，保存独立来源、吸收类型与到期时间；shield / shieldTime 仅为汇总表现兼容字段，不允许直接覆盖它们实现新护盾。冰冻、击退、召唤、持续施法仍需新行为实现。

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

`requiresSkillTags` 决定是否出现于正常奖励候选，`rules.skillTags` 决定实际战斗何时触发，两者不要混淆。F2 故意不按技能过滤增益，便于测试不满足条件时的休眠。这里新增独立减速实例；移动时取最强，实例各自过期，不把短强减速和长弱减速拼成一个长强减速。

如果添加一个全新状态 ID，要填写 STATUSES，再从技能 / effect 引用它。`interval` 是跳伤间隔，power 是每次跳伤量；只有 interval=1 时才等于每秒伤害。明确来源键、最大层数、刷新与跳伤规则，并检查多玩家归属。新 speed 状态还需定义合法倍率及控制适用性，不把所有新控制都当作 slow。

需要新效果原语时，除 `Effect / EffectHandlers` 之外，检查 `validateContent`、事件来源、波次重置、CombatHooks 的实际实现和快照表现。命中、出手、攻击特效、掉血、治疗分别使用不同事件；完整说明见 [海克斯](HEX_AUGMENTS.md)。

## 添加敌人

`ENEMIES`现在包含10小怪、5精英、2Boss，使用统一属性template与`behavior:'monster'`，`actionSet`引用`ENEMY_ACTION_SETS`。普通/精英/Boss分类和地图绑定独立于阵营；appearance使用同名程序美术ID。新同类内容的落点是定义与动作，不是在GameWorld复制update循环。

1. 在enemies添加name/template/radius/windup/recovery/category/map/actionSet/appearance，基础AS为完整普攻周期倒数。AD/AP和伤害类型分开；不增加基础/额外AD与不同种吸血。
2. 在enemy-actions添加一个attack和零到多个spell，动作集写`{attack:'...',skills:['...']}`。每段声明at/sampleAt/location/shape/expression/damageType；动作级windup/recovery/cooldown/firstDelay/range控制调度。矩形length/width、圆radius、环innerRadius/radius、扇形arc为弧度，弹体有真实radius/speed/range。多个弹体可共享maxHits去重。
3. EnemySystem调度动作、采样落点、连续扫掠冲锋/弹体、CollisionWorld查询、CombatEngine结算。攻击方向在开始锁定，不追踪玩家；分段位置按sampleAt离散采样。保留rootId/sourceId、目标计数和类型。通过validateEnemyActions验证动作与模板引用。
4. 在MonsterVisual/monster-palettes增加独立轮廓、器具与相位姿势，视图读取EnemyPose（含多段strike），不反向触发伤害。新PNG路线另按美术管线导入，不能只添加虚假appearance字符串。
5. 加入地图具体level.groups，并保证关卡spawns总表与groups一致；F2里能刷不等于正常关卡已放置。

当前动作样例可以直接在ENEMY_ACTIONS中参考：`reedThrust`窄矩形、`sunSeed`锁定落点圆、`pincerCross`错拍两扇、`mothFan`组限一次三弹、`ramLane`受阻停止冲锋、`wovenRing`真实空心环。新原语必须扩展EnemyActionShape与EnemySystem消费逻辑、CollisionWorld及预警；不能加一个从未读取的字段。

Boss配置包含threshold/loop/phase1/phase2槽表，技能表支持phase2覆盖段列表与phase2Duration。当前动作完成后跨血量阶段，转换两秒不发伤害；不重置HP。循环槽不能并发压缩前摇，未满足射程/CD/边界/可逃脱条件可以跳过。独立守区为10格唤醒（Boss12），超过18格守点或22格目标距离返回；每.55秒按模拟时刻寻路。每单位用PathfinderPool不小于自身radius的网格，Boss大体型必须有实际可通行路线。

最低验收为怪物专测、content/world/collision/hitboxes、多玩家目标与属性隔离；真实Creator构建后确认准备/出手/多段/恢复、遮挡、躲避、守区、Boss转阶段和出口。不能把改变windup999当成冻结新EnemySystem；测试定靶用显式canMove/canAttack能力，开发者freezeEnemies不等同于全局暂停。

## 添加地图与关卡

现有地图是ember 56×44、frost 60×44，各五关，仍只有两张地图。每关配置`WaveDefinition.level`：id/name/start/exit（带radius）/route/groups；groups含id/center/radius/spawns。外层spawns是该关全部敌人的汇总，用于内容校验和工具，运行放置由LevelSystem.enemyPlacements读取固定群组。hpScale当前均为1，不能暗叠旧波次倍率。

LevelSystem是纯函数入口：levelDefinition/levelSpawn决定起点与队友偏移；enemyPlacements产生确定位置与groupId；exitProgress/levelSnapshot声明出口条件。清场只激活出口，所有活跃且存活的玩家都走进出口才完成；离线和倒地不阻塞其余存活玩家。最终Boss击败后也要到出口，再选奖励进入胜利。

新增关卡按如下顺序：

1. 配置整数尺寸、圆障碍、环境/主题、DEFAULT_LOADOUT和shopAfterWaves；两图当前都在第1/2/3/4关后开店。起点、出口完整容纳玩家，Boss房周边至少4.5格净空。
2. 配start/route/exit，route相邻点必须通过同一地图导航。群组避开起点安全距离，按每只敌人的实际体型检查出生可走、与障碍不重叠，并且玩家能从start接近每组再到exit；不可静默少刷。
3. `ArenaView`采用本地玩家跟随镜头而不是fit整张大图。渲染投影和InputController逆投影必须消费同一Projection；缩放/CSS/设备像素比依然经过输入适配，不用固定屏幕中心替代相机。
4. 测试五个关卡的所有路线、全部敌群/体型、出口多人集合条件、暂停/重开、恢复到正确start。开发模式跳关不会重放前关消耗，仍需正常流程验收。

地图保持静态障碍、没有动态挖路、传送、任意多边形地形或通用地牢生成器。重开保留所选地图，重置本局技能/装备/货币；地图切换只在首页。

## 装备、经济与阶段流程

- `content/equipment.ts`：装备 ID、category、固定价格、属性增量、外观 ID 和武器普攻 `attack` 配置 ID；`SHOP_CATALOG` 自动枚举全部装备，不用维护 UI 商品分支。新装备使用已有属性与外观形状时只需添加配置。
- `simulation/EquipmentSystem.ts`：金币、已购库存、装备槽与购买 / 换装 / 卸装。六个通用slot1..slot6不限制category。购买事务检查ID/重复/余额/目标栏后扣款，自动填空栏；满栏必须显式replaceSlot，替换者留库存。所有操作仅在 GameWorld 的 shop 阶段被接受，战斗、奖励或结算阶段的购买命令无效。
- `content/progression.ts`：初始 160 金币，每波固定收入 `100 + (wave - 1) × 20`，清场并抵达出口后仅发一次；地图配置商店阶段。当前不卖出、不退款、不跨局保存装备或货币。
- `simulation/RewardSystem.ts`：统一 `RewardChoice` 联合类型，明确区分 perk / skill。`ChooseReward` 选增益，技能需要 `ConfirmSkill` 确认槽位；`CancelSkill` 只撤销预选，不重新抽卡。确认后才消耗整次奖励。
- 流程为 ready → 开局 shop → fighting（清场+到出口）→ reward → 可配置的 shop → 下一波；最终 reward 后 victory。暂停只影响 fighting，商店 / 奖励自身冻结模拟时间。
- 装备变更替换对应 AttributeSet 来源，旧装备不会残留加成；兼容 statsView / deriveStats 只委托统一解析器。攻速按模板收益系数解析，急速采用 `100 / (100 + abilityHaste)`，百分比与急速点不能混用。
- 物理伤害走护甲，魔法伤害走魔抗；削减、穿透和负抗性按统一规则。真实组件跳过双抗，但仍受适用护盾与无敌规则。技能和护盾通过 AD/AP/生命表达式产生数值，不再有普遍 skillPower 放大。长弓、法杖普攻为独立弹体，cause 为 basic 且没有 skillId；外观不决定伤害类型。生命倍率也是属性来源，快照与实际单位读取同一结果。
- 换装只更新生命上限并截断超出的当前生命，不回补生命，防止反复换装回血。第一波开始补满装备后的生命上限；其余波次仅恢复 30 点。
- 新属性扩展 AttributeSet 的字段 / 合成规则及真实消费位置；装备提供来源，不直接改技能定义。新装备槽还需扩展 EQUIPMENT_SLOTS、槽名和表现层绘制顺序。

### 六栏属性与显示选择

EquipmentSystem的buy(id,replaceSlot?)/equip(id,slot?)/unequip(slot)事务不按category排斥同类装备；每ID仅拥有一次。purchaseOrder保留购买顺序，appearanceLoadout仅从仍穿戴条目中为weapon/body/head各取最后购买的一件；同一六栏构筑的属性不会随选择显示外观而漏算。最后武器决定普攻形状与attackRange，多个武器射程不叠加。所有装备价格当前统一100，累计160/260/380/520/680金币支持进入1/2/3/4/5关时1/2/3/5/6件，最终结算860不能用于已结束Boss。18件均已注册，暴击/全能吸血/法穿/魔抗走统一modifiers；具名被动在EquipmentEffectSystem执行。新增机制参见[装备实施指南](design/EQUIPMENT_IMPLEMENTATION.md)。

### 可复制示例：复用剑外观的新武器

在 EQUIPMENT 中增加条目：

```ts
trainingBlade: {
  name: '轻练长剑', category: 'weapon', price: 100,
  description: '扇形挥斩；攻击力 +12，技能急速 +10',
  stats: {},
  modifiers: [
    { stat: 'attackDamage', operation: 'flat', value: 12 },
    { stat: 'abilityHaste', operation: 'flat', value: 10 },
  ],
  appearance: 'copperSword', attack: 'sword', attackRange: 2.5,
},
```

这个例子沿用现有挥击和图片，不需要新资源。SHOP_CATALOG 和 F2 的装备选项自动更新，ShopPanel 按目录分页；属性通过装备来源进入统一解析器。若需要独立挥击速度 / 形状，先在 BASIC_ATTACKS 注册 melee 行为并引用其 ID；若需要新属性，则落实解析和消费位置。

新装备优先使用 `modifiers`，可直接配置 `magicResist`、`omnivamp` 等统一字段。旧 `stats` 是现有 10 件装备的薄兼容入口；同一个属性不要同时在两处写一遍。额外攻速 / 移速通常使用 `percent`，例如 20% 写 0.2；急速 20 点使用 `flat: 20`。具名组及各操作语义按 AttributeSet 规则校验，不把所有百分比视为同一种叠加。

验收固定价格购买、余额不足 / 重复购买不扣款、替换后旧装备仍在库存、免费切回 / 卸下恢复属性、来回换装不回血、不在商店时交易被拒绝，以及实际普攻的伤害 / 形状。新增装备也要检查既有测试中对货架数量和分页坐标的假设。

### 新装备外观

为新 appearance 填写 EQUIPMENT_APPEARANCES（layer / shape / 颜色），然后选择一种实际美术来源：PNG使用 EQUIPMENT_SPRITES（frame / width / height / anchorX / anchorY 或 y）；原生多边形使用 PROCEDURAL_EQUIPMENT（layer / y / polygons），由EquipmentVisuals创建。不要用假图集帧冒充程序形状。appearance.layer必须与装备category对应，不能拿slot1作为渲染层；武器 shape 也参与当前 HeroRig 的摆臂 / 转腕方式。新 shape 的动作语义不是只改字符串就完成。

当前装备精灵统一读取 equipment 图集；新增独立 PNG 需要扩展这个表现契约和资源加载，不能把它当成已存在的 atlas 字段。通过 Creator 导入素材并提交 .meta 后，按 [美术管线](ART_PIPELINE.md) 更新图集生成来源。

人物手臂使用 HERO_ARM_ATTACHMENTS 的真实肩关节和掌心坐标，武器以其握把 anchor 对齐掌心；不是每张图都用 `.5 / .2`。先看放大的商店预览，再看战场实际大小、左右镜像和攻击最大角度，检查衣甲遮挡与武器漂移。视觉改动不修改角色 radius。

## 普攻与命中体积

- `combat-core/CollisionWorld.ts` 是独立于 Cocos 渲染 / 刚体的确定性几何查询。角色 `radius` 是脚底世界平面上的受击圆；地图障碍同样是圆。图像透明像素和装备外观不会改变碰撞尺寸。
- `HitShape` 支持circle / sector / capsule / rectangle / ring；`targets` 统一处理存活、敌我、整圆与攻击形状相交、障碍遮挡及稳定排序。扇形边缘与外圆弧都考虑目标半径，不再只检查目标中心夹角。当前范围 / 近战 / 尸爆 / 电弧搜寻都使用它。
- `firstImpact` 对弹体上一位置到下一位置执行连续圆扫掠，并考虑目标一帧内的相对移动。角色、地图障碍和边界按最早接触排序，墙与目标同时命中时墙优先；当前弹体命中一个敌人后消失。最后不足一帧的剩余射程也会检测，避免提前消失和高速穿透。
- `content/attacks.ts` 注册空手、剑、盾、弓、法杖的普攻行为。近战配置 `arc / windup / active`，远程配置 `speed / radius`；装备的 `attack` 引用行为。伤害、攻速、射程仍由装备属性计算。新增同类武器不需要修改 GameWorld 的装备 ID 分支。
- 近战挥击在前摇后短暂生效，朝向在出手时固定，中心跟随角色移动；同一挥击的 `hitIds` 保证每个敌人最多命中一次，可以同时打到多个相交敌人。冲刺会取消尚未完成的挥击。近战怪物前摇时保存朝向，结束后通过同一扇形查询结算。
- 两种模式均左键攻击；右键模式只发送 MoveTo，移除 SetTarget / targetId / 自动追击。Attack 是单次出手，AttackInput 保存按住状态，松开 / 暂停 / 失焦 / 阶段切换清理。DirectInput 只负责 WASD 移动，寻路移动与按住攻击可以同时存在。
- 输入使用 screenToWorld 原始鼠标地面坐标，不再吸附敌人。弹体表现与碰撞位于同一地面平面，挥击轮廓来自实际半径 / 角度。F3 显示角色、障碍及弹体体积，缩放使用同一投影；不增加常驻复杂特效。
- 已附着的灼烧只在首次命中时检测碰撞，后续跳伤按状态计时，不重新要求视线。护盾作用自身，冲刺用已有移动扫掠。当前没有角色之间的刚体推挤、复杂多边形地形、穿透弹或高度层碰撞。

## 贴图、动画与装备外观

`content/appearances.ts` 使用稳定外观 ID：`UNIT_SPRITES` 配置图集、比例、色调和动作片段；`EQUIPMENT_SPRITES` 配置装备帧、尺寸和挂点，`PROCEDURAL_EQUIPMENT`配置原生多边形与挂层；`ENVIRONMENT_APPEARANCES` 配置地图素材角色与水色。`content/art-manifest.ts` 保存真实像素区域，和 Cocos `.meta` 独立。启动检查引用，测试验证区域没有越过 PNG 边界。

`ArtLibrary` 预加载本地透明 PNG 并共享 Texture2D / SpriteFrame；`MonsterVisual`用独立程序图形绘制17怪，按EnemyPose相位驱动。`AnimatedUnit`保留旧图集能力与玩家桥接。`HeroRig` 使用六个中性身体部件及三个装备层，战场和商店共用；换装仅重建变化的装备组合，不更改角色实体。

`GameWorld` 快照包含 `facing / action / hurtAt / diedAt`，`motionPose` 将其转换为 idle / walk / attack / cast / hurt / death。伤害、攻击间隔及冷却仍由固定步进控制，动画不回调游戏规则。暂停冻结表现时间；战斗结束时允许死亡动画播完。死亡视图短暂保留并淡出，不再参与碰撞和选择。

古树守卫现在是660HP精英，含独立三次落点技能；两Boss为庭院司炉者和霜镜执仪者，各自绑定第五关。不能把旧守卫图集放大作为Boss，也不能以仅换色宣布17种美术完成。

当前两个地图共用遗迹素材，霜镜回廊使用冷色地板与水色；环境布局为按地图尺寸适配的模板。地图障碍沿用碰撞配置，植物及瀑布主要在通行边界外。全新关卡布局可以扩展 `EnvironmentView`，不影响导航定义。旧UnitVisuals保留作参考；运行玩家/装备/环境PNG与17怪正式程序美术并用。

角色、装备、怪物、地图与特效的设计标准见 [美术风格设计指南](ART_DIRECTION.md)；资源制作规范、帧序、换装挂点、素材来源与当前限制见 [美术管线](ART_PIPELINE.md)。

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
pnpm test:attributes
```

浏览器脚本的旧坐标、3/2波与三类装备槽假设需要按当前版本迁移。执行前查看脚本前置条件，记录本轮真实结果；历史reports不能证明六栏/五关/新敌人已通过。单测中的直接定位出口用于阶段契约，不能冒称正常键鼠走图通关。
