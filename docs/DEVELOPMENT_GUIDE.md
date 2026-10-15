# 开发架构指南

目标是让没有参与历史对话的开发者或 AI，能找到修改位置、接通完整链路，并给出可复核的结果。先读 [整体架构](ARCHITECTURE.md)；具体注册示例在 [内容扩展指南](CONTENT_ARCHITECTURE.md)。文中的源码路径相对于 `EmberDemo/assets/scripts/ember/`，命令在仓库根目录执行。

## 开始工作

1. 查看 `git status --short`，确认现有修改和当前任务范围。阅读根 [AGENTS.md](../AGENTS.md) 与相关专题；不要重新执行历史 MVP 任务书。
2. 检查 `package.json`、`.nvmrc`、`EmberDemo/package.json`，使用项目固定的工具链。首次安装运行 `pnpm install --frozen-lockfile`，新电脑步骤见 [环境与构建](MANUAL_SETUP.md)。
3. 将需求描述成可观察结果：如何获得内容、何时触发、目标 / 范围 / 前摇、数值、能否叠加、外观、暂停和重开后应怎样。缺省沿用同类内容的规则，不自行引入职业锁定或另一套经济。
4. 找一份最接近的现有实现和测试，沿命令 → 模拟 → 战斗 → 快照 → 表现追踪。先确认配置能否表达，再决定是否扩展行为。

可用的定位命令：

```bash
rg --files EmberDemo/assets/scripts/ember tests scripts docs
rg -n 'icebolt|frostling|windBow' EmberDemo/assets/scripts/ember tests
rg -n 'CastSlot|executeSkill|firstImpact|OnAttackHit' EmberDemo/assets/scripts/ember
```

## 判断改动应放在哪一层

| 需求形态 | 应修改的位置 | 不应采取的做法 |
| --- | --- | --- |
| 火弹变成低伤害高速冰弹 | skills 定义、描述、必要的已有外观引用 | 在 GameWorld 中判断某个新技能 ID |
| 新武器使用现有剑挥击，增加属性 | equipment 定义，可复用 attack / appearance | 购买时直接给角色字段反复累加属性 |
| 新远程怪物使用已有冰弹 | enemies 定义、地图波次、可选新外观 | 复制一份敌人更新循环 |
| 已有事件加减速 / 爆炸 / 冷却效果 | perks 条件与 effect 配置 | 在每个技能命中点分别写联动判断 |
| 穿透弹、召唤、击退、新 AI 阶段 | 先扩展相应联合类型、处理器和必要状态，再加内容 | 写一个配置字段但没有消费逻辑 |
| 新反馈、颜色、动画、贴图 | appearances / animation / render | 用动画帧事件扣血，或让贴图尺寸决定碰撞 |
| 新输入或玩家操作 | protocol → 处理边界 → InputController / Hud | UI 直接改 port.world、背包或 HP |
| 新测试配置字段 | DeveloperConfig → 解析 / 拷贝 / 捕获 → LocalTransport / 世界 → 面板 | 只给表单加开关，普通世界默认生效 |

“数据驱动”表示已有行为参数化，不表示任意新玩法都只写配置。当前内容注册表在编译时生成 ID 类型；没有运行时动态注册 API。

## 一次功能修改的实施顺序

### 1. 定义契约

对同类内容，使用稳定的英文 camelCase ID，显示名称与其分离。`SkillId / EquipmentId / EnemyKind / MapId` 从对象键推导，`PerkId` 从 PERKS 元素推导；不要再维护第二份相同 ID 枚举。

对新机制，先定义类型与状态归属。例如新技能行为扩展 `SkillBehavior`，新效果扩展 `Effect`，新 AI 扩展 `EnemyBehaviorId`。判断是否需要每个实体独立保存计时、是否需要在波次 / 重开清理、是否需要显示在快照中。

### 2. 实现最小可用行为

- 技能按 `SkillSystem` 的穷尽 handlers 实现；新增能力通过 SkillContext 注入。需要长生命周期的弹体 / 实体状态再由模拟层持有。
- 效果按 `EffectHandlers` 实现，复用 CombatEngine、CollisionWorld 和 CombatHooks。派生伤害保留来源、根事件与深度，明确是否允许攻击特效和属性放大。
- 新 AI 放入 `ENEMY_BEHAVIORS`。现有 EnemyContext.move 沿 unit.path 移动；新策略要自行提供路径或扩展上下文，不能把 move 当成传入目标的通用寻路接口。
- 新属性走 `StatBonus → HeroStats → deriveStats → 消费位置 → HUD 文案`；新装备槽还需检查 EQUIPMENT_SLOTS、SLOT_NAMES、HeroRig / ShopPanel / DeveloperPanel、配置解析与测试。
- 不新增无需求的网络框架、资源编辑器或通用插件系统。若局部模型已经无法表达需求，应明确实现所需能力，而不是隐藏为一次性 ID 特判。

### 3. 接通获得入口和表现

主动技能进入奖励池，装备进入固定货架，敌人加入地图波次；开发面板里能选到并不等于普通玩法能够获得。新增 LAB_PRESETS 不会自动生成首页实验按钮，首页目前由 Hud 显式绘制，需要另接入口。

外观 ID 要有真实注册项，素材要有合法 `.meta`。新特效若已有颜色 / 形状不够表达，扩展 cue 数据及 ArenaView 绘制；说明预警何时出现，确保预警和实际判定一致。新敌人行为也要检查 `ArenaView.drawGround` 的预警分支。

新增美术先按 [风格设计指南](ART_DIRECTION.md) 确定细节、轮廓、混搭与战斗可读性，再按 [美术管线](ART_PIPELINE.md) 制作和接入；概念预览不等于运行时图集，现有素材能力与未来设计目标要区分。

新增嵌套状态要更新 `GameWorld.snapshot` 的复制逻辑；新增事件要明确谁发出、谁消费，不把反馈 cue 当成玩法事件。新增资源由 ArtLibrary 管理生命周期，不能每帧创建纹理。

### 4. 补充内容校验与边界验证

`validateContent` 会在游戏启动和内容测试中运行。它已检查主要外观 / 状态引用、正数参数、地图尺寸 / 出生点、装备槽位、部分效果参数等，但不是通用 schema 校验器。

新增行为字段要补充其特有约束，例如概率范围、层数整数、持续时间、引用、目标数量。标签本身是字符串，拼错不会自动得到类型错误；需要验证奖励资格和实际触发。握点坐标即使合法也可能画错，仍需看实际图像。

### 5. 用针对性测试验证，再构建画面

优先复用下表测试夹具。对于逻辑机制，至少验证正常触发、边界 / 拒绝条件及与已有系统的组合；不要仅断言配置对象里存在刚写入的字段。

| 测试文件 | 适合覆盖 |
| --- | --- |
| `tests/simulation/content.test.ts` | 内容校验、技能身份、标签联动、敌人变种、地图与出生 |
| `tests/simulation/progression.test.ts` | 奖励替换、确定性交易、装备属性、阶段权限 |
| `tests/combat-core/combat.test.ts` | 伤害 / 状态 / 原有连锁效果 |
| `tests/combat-core/hexes.test.ts` | 新事件、计数 / 限频、治疗链、来源和循环保护 |
| `tests/simulation/hexes.test.ts` | 海克斯与技能、装备、弹体、世界重置的集成 |
| `tests/combat-core/collision.test.ts` | 几何边界、相对移动、墙与目标接触顺序 |
| `tests/simulation/hitboxes.test.ts` | 实际普攻 / 技能命中、挥空、遮挡、高速弹体 |
| `tests/simulation/world.test.ts` | 固定步进、阶段、导航、输入与确定性 |
| `tests/simulation/projection.test.ts` | 投影、逆投影、矩形地图缩放 |
| `tests/simulation/animation.test.ts` | 动作信号、优先级、图集边界 / 元数据 |
| `tests/simulation/developer.test.ts` | 开发模式隔离、配置校验、存储、跳波 / 重测 |

例如只开发装备逻辑时可以先运行：

```bash
pnpm exec vitest run tests/simulation/progression.test.ts
pnpm check
```

纯逻辑测试可以设置测试夹具的 HP、敌人位置或直接构造命中事件来覆盖边界；这是单测安排，不能据此声称正常玩法可通关。端到端验收通过实际键鼠和正常流程操作；F2 组合试验另行记录。不要把隐藏控制台注入数值当成正常玩家操作。

## 验证矩阵

| 改动 | 逻辑 / 类型 | 实际引擎与浏览器检查 |
| --- | --- | --- |
| 技能、范围、弹体、普攻 | pnpm check；content / hitboxes 对应机制测试 | Creator Web Desktop 构建；test:hitboxes；验证奖励替换时加 test:content |
| 装备、属性、经济、奖励 | pnpm check；progression | 构建；test:content；换装外观变化加 test:art / 人工画面 |
| 敌人、地图、导航 | pnpm check；content / world / collision | 构建；相关地图正常通关；必要时 playthrough 与 benchmark |
| 海克斯、状态、触发系统 | pnpm check；两层 hexes / combat | 构建；test:hexes；涉及弹体或普攻再加 test:hitboxes |
| 操作方式、输入坐标、HUD 交互 | pnpm check；projection / world | 构建；test:controls；缩放、失焦、暂停、松键 |
| 贴图、动作、挂点 | pnpm check；有格式变更时核对图集 | 构建；test:art 与人工检查，含镜像、动作最大角度、换装 |
| 开发者模式 | pnpm check；developer | 构建；test:developer；退出后普通模式不带测试效果 |
| 纯文档 / 注释 | 引用、示例类型与源码一致性；git diff --check | 通常无需重建或重跑游戏全流程 |

相关浏览器脚本先查看其当前前置条件。大多固定使用 8080，只有 smoke 读取 `EMBER_PREVIEW_URL`；在服务端设置其他 PORT 不会自动修改测试目标。它们使用本机 Chrome，构建后先运行 `pnpm play`，测试建议逐个执行，避免同时争用截图 / 报告路径。

```bash
# 已完成新的 Creator Web Desktop 构建；另一个终端保持 pnpm play 运行
EMBER_PREVIEW_URL=http://127.0.0.1:8080 pnpm smoke
pnpm test:content
# 其余按上表选择：test:controls / test:art / test:hitboxes / test:hexes / test:developer
```

`pnpm build:core` 只输出无引擎核心到 `dist-core`。类型通过不代表图集已导入、组件已挂载或发布构建成功。不要编辑 `build/` 修问题；回到源码 / 模板修复后重新通过 Creator 构建。没有可用编辑器时保留已完成的源码和验证结果，明确报告尚未运行的引擎检查。

## 使用开发者模式复现

按 [开发者模式说明](DEVELOPER_MODE.md) 选择地图 / 波次 / 种子，搭配技能、装备和增益，再应用。面板关闭继续模拟；重测恢复已应用的初始配置。F3 检查命中体积。低血量 / 治疗触发需要真实战斗事件：调试回血和设血量工具不会伪造这些事件。

提交 Bug 时保存：代码版本、导出的 DeveloperConfig、操作方式、输入步骤 / 时机、预期与实际结果、截图 / 控制台错误。配置不是战斗中途存档，也不是输入录像。随机种子只复现随机流；内容表变更、额外随机调用或不同命令时刻都可能改变结果。

`?debug=1` 是可选浏览器诊断开关，会挂出 `window.__EMBER__`，包含快照 / 画面诊断 / 命令发送能力；不是安全隔离边界，也不应成为普通玩法的隐藏入口。当前浏览器回归主要读取它的快照，并通过 UI 操作。真实开发面板无需这个参数。

## 兼容性与容易漏掉的改动

- **新增内容数量**：SHOP_CATALOG、HERO_SKILLS、开发面板由注册表枚举；但已有测试含固定装备数量、总击杀数、商店坐标 / 页码或特定种子。先读失败原因，因产品变化更新相应预期，不盲目删除断言。
- **更改技能池 / 增益池**：会改变奖励随机序列。检查已有构筑是否还能获得要求的技能、后续波次能否始终生成三张候选，以及更换技能后的增益是否休眠。
- **重命名 ID**：会影响地图 / 技能引用、奖励、测试、开发者预设文本。v1 导入会拒绝不存在的 ID；如果需要兼容旧配置，要明确迁移策略或升级版本，不静默映射成别的内容。
- **新配置字段**：同步 parse / clone / capture / 应用 / 默认值 / UI / 导出导入 / 测试；只有界面上有值但世界未消费不算完成。
- **扩大敌人体积**：实测窄路、边界、出生和攻击扇形。导航默认半径与实际实体半径目前不同，见架构中的边界表。
- **新装备槽或图集**：检查硬编码的三层角色、固定 equipment 图集和资源枚举，不能只加 EQUIPMENT_SLOTS。新资源遵循 [美术管线](ART_PIPELINE.md)。
- **改动画**：攻击前摇和伤害窗口属于模拟；若修改手感要同时考虑判定与预警。纯摆臂变化不自动改变碰撞。

## 交付检查

1. 内容在普通玩法中可获得；F2 可快速配置，F3 能检查必要形状。
2. 实际数值、描述、冷却 / 范围与表现一致；未破坏输入释放、暂停和阶段重置。
3. 相关测试通过，实际构建 / 浏览器结果有记录；区分本次结果与 reports 中的历史数据。性能报告区分纯逻辑耗时和渲染 FPS。
4. 更新涉及的扩展指南、资源约定与 IMPLEMENTATION_LOG；新增文件保留 `.meta`，生成缓存不进入提交。
5. `git diff --check`，复核差异，按照任务授权提交 / 推送。交付说明包含变化、验证、剩余限制，不虚报未运行的检查。

## 给其他 AI 的任务模板

下面模板可以直接随需求一起发送，方括号内容按本次需求填写：

```text
请在此仓库实现：[可观察的游戏行为]。
先读 AGENTS.md、docs/ARCHITECTURE.md、docs/DEVELOPMENT_GUIDE.md，
再按 docs/CONTENT_ARCHITECTURE.md 找到该内容的注册、获得入口和表现链路。

内容定义：[名称、稳定 ID 或命名要求、数值、范围、前摇、持续时间、叠加 / 触发规则]。
获得方式：[主动技能奖励 / 固定装备商店 / 地图波次 / 被动增益]。
美术要求：[复用现有 appearance 或新增资源、动作与握点要求]。
验收：[正常案例、边界案例、需测试的已有组合]。

先复用现有行为，确有新机制时扩展类型和处理器；不要按内容 ID 在主循环里堆分支。
接通正常入口和开发者模式，按变更范围完成测试、Creator 构建及画面验证，
更新相关文档，交付实际结果与未验证部分。提交 / 推送范围以本次明确要求为准。
```
