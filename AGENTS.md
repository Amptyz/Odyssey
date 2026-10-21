# Project Ember：AI 开发入口

这是 Cocos Creator 3.8.8 / TypeScript 单人 / 房主联机 PVE 游戏。开始修改前，先检查 `git status --short`，阅读本文件，再按任务选择下方文档。不覆盖已有工作，不将历史任务书当成当前版本的待办清单。

## 阅读顺序

1. [README.md](README.md)：环境、启动、当前玩法和命令。
2. [整体架构](docs/ARCHITECTURE.md)：运行流程、状态归属、模块依赖与限制。
3. [开发架构指南](docs/DEVELOPMENT_GUIDE.md)：改动落点、实施顺序、验证和交付。
4. 按需阅读：[内容扩展](docs/CONTENT_ARCHITECTURE.md)、[世界观](docs/WORLD_LORE.md)、[美术风格设计](docs/ART_DIRECTION.md)、[美术管线](docs/ART_PIPELINE.md)、[海克斯](docs/HEX_AUGMENTS.md)、[开发者模式](docs/DEVELOPER_MODE.md)、[联机与恢复](docs/MULTIPLAYER.md)。

后续独立任务统一维护在 [todoList.md](todoList.md)。接手其中一项时核对依赖与实际代码基线，登记负责人和状态，交付后补充验证证据；清单本身不表示要求一次执行全部任务。

属性相关开发遵循 [统一属性系统](docs/ATTRIBUTE_SYSTEM.md)：全单位共用，技能与触发伤害只使用总攻击力，只保留全能吸血。`combat-core/ActorFactory.ts` 为统一创建入口，`attributes/AttributeSet.ts` 管理每单位来源与解析；伤害、治疗、护盾交给 CombatEngine。不要恢复 HeroStats 内的独立英雄公式；当前验证进度见 STAT-02。

`CODEX_GAME_MVP_SPEC.md` 是 v0.1 历史需求，部分内容已被后续设计替代：目前已有装备与正式 PNG，普攻不锁定敌人，QWER 可替换。具体变更见 [实现记录](docs/IMPLEMENTATION_LOG.md)。用户本次明确提出的新要求可以调整现有设计；同步更新相关文档，不要因旧文档而恢复旧行为。

## 唯一源码与工具链

- 游戏源码仅在 `EmberDemo/assets/scripts/ember/`；Cocos 工程根目录是 `EmberDemo/`，仓库根目录负责依赖和测试。
- 使用 Creator **3.8.8**；Node 版本见 `.nvmrc`，pnpm 版本见根 `package.json`。根目录执行 `pnpm install --frozen-lockfile`。
- 不另建 Web 游戏实现，不复制第二份核心代码，不用 Vite 替换 Cocos 构建。
- `pnpm check` = 核心 / Cocos / 工具类型检查 + Vitest + 核心编译；它不生成浏览器游戏。
- Creator 构建 Web Desktop 至 `EmberDemo/build/web-desktop` 后，`pnpm play` 才能提供 8080 试玩。改代码后需重新构建并刷新；`?v=...` 只是 URL 参数，不会自动生成新构建。

## 开发时保持的约定

- 六个通用装备栏slot1–slot6不限类型；category只用于物品分类。装备只提供属性、被动与UI图标，不改变角色贴图；默认普攻近战挥砍，只由余烬改变形式。不要恢复外观层、挂点或purchaseOrder；v4存档读取时迁移至v5并丢弃旧外观字段。
- 场景与交互遵循 [营地与休息点](docs/SCENES.md)：Start 进入营地；商店/余烬是每人面板，不能恢复每关自动弹窗。交互按世界坐标 F 校验，全员集合后仅房主出发；首个余烬必选。
- 每个地点遵循 `content/locations.ts` 的 `LocationDefinition`，必填 name、可选 subtitle；在 maps / scenes 中编辑，由 SceneSnapshot 和 SceneTransition 统一显示入场标题。显示名称不参与稳定 ID、存档或领取标记。
- 无固定职业。玩家通过主动技能奖励与确定性装备购买形成构筑。主角已选[矮胖Q版](art-source/rekindled-chibi-v1/README.md)，保留死亡细胞取向像素材质，死去已久、无血迹、无头发、无五官的阴影面孔；固定整身形象，不预设职业。当前为[整身序列帧](art-source/chibi-runtime-v1/README.md)，五绘制视角加三镜像；旧十部件纸娃娃已停用；Q版完整动作已接入，细节精修见ART-08。多人独立paletteId共用图集材质调色，见[主角配色](docs/HERO_COLORS.md)，不得按配色复制动画或恢复装备换皮。
- 两种操作都以左键朝鼠标地面方向普攻，允许挥空；不恢复锁定、自动追击或鼠标吸附。QWER 是槽位，普通开局 / 重开四槽均为显式 null，技能从余烬奖励获得；空槽不施法。技能逻辑使用稳定 `SkillId`。
- 先判断能否复用已有配置和处理器。新技能 / 装备 / 敌人变种通常不需要在 `GameWorld` 加 ID 分支。
- `simulation / combat-core / ai / content / utils` 保持不依赖 `cc`、DOM、真实时钟和全局随机数。输入和 UI 发命令，战斗状态由逻辑层修改，表现层消费快照。
- 命中使用 `CollisionWorld` 的世界坐标查询；移动使用 `Pathfinder.sweep`。不能用贴图距离、动画回调或 Cocos 刚体另建一套伤害判定。
- 默认近战以实测原稿曲线为准：`scripts/measure-melee.mjs` 离线采样材质可见轮廓，生成 `content/melee-outline.ts`；`MeleeSweep.meleeArea`生成一块填到人物中心的连续曲面，动画、F3和判定共用同一测量相位。不得恢复固定180°圆弧裁剪、任意大圆或外圈亮锋盲区；射程统一缩放曲线，详见[基础近战规格](docs/design/BASIC_MELEE_VFX.md)。
- 地面采用 `utils/GroundPlane.ts` 的单位正交基和 `render/GroundProjection.ts` 的统一缩放；移动、弹速、射程、碰撞共用欧氏世界距离。不得恢复双轴压缩或按方向加速；鼠标、动画方向、小地图和范围显示共用此变换，见 [战斗平面](docs/GAME_FEEL.md)。
- 战斗时间使用 `FIXED_DT` / `GameWorld.time`，随机使用已有 `Random`。保留暂停、重开、阶段切换与旧输入清理。
- 伤害 / 治疗进入 `CombatEngine`；连锁效果保留 `rootId / depth / proc` 等来源信息和预算保护。不要用直接扣 HP 绕过事件链。
- 多人逻辑必须通过 playerId 访问 `GameWorld.players`，事件规则按 sourceId 读取余烬；`world.hero / equipment / loadout` 只是初始玩家的兼容入口。恢复点不是任意战斗快照；跨波字段同步保存 / 校验 / 恢复。
- 配置是共享定义，不作为可变的角色实例存储。新增快照字段要复制其中的可变对象，不把实体、Node 或 Set 暴露给 UI 修改。
- 开发者开关仅在显式应用的测试世界中生效；新增工具继续经过配置校验、命令和模式检查，不默认给普通局加作弊效果。

## 常见修改入口

| 需求 | 首先查看 |
| --- | --- |
| 新技能 / 新技能行为 | `content/skills.ts` → `simulation/SkillSystem.ts` |
| 装备 / 属性 / 被动 | `content/equipment.ts`、`simulation/EquipmentSystem.ts` |
| 玩家普攻形式 / 形式余烬 | `content/attacks.ts`、`content/perks.ts` → `combat-core/CombatEngine.ts`、`simulation/GameWorld.ts` |
| 装备独立被动 / 内部冷却 | `content/equipment.ts` 的 passives → `simulation/EquipmentEffectSystem.ts`；通过 CombatEngine 实际事件触发 |
| 全单位属性 / 公式 / 来源 | `combat-core/attributes/AttributeSet.ts`、`combat-core/ActorFactory.ts`；`content/enemies.ts` 的 template |
| 敌人 / AI | `content/enemies.ts`、`content/enemy-actions.ts`、`content/enemy-behaviors.ts` → `ai/EnemyDecision.ts`、`simulation/EnemySystem.ts`；[配置指南](docs/ENEMY_AI.md)、[ember-enemy-ai skill](.agents/skills/ember-enemy-ai/SKILL.md) |
| 全局移速 / 弹速 / 镜头 | `content/tuning.ts` → `attributes/AttributeSet.ts`、弹体生成入口、`utils/GroundPlane.ts`、`render/GroundProjection.ts` / `ArenaView.ts`；[参数指南](docs/GAME_FEEL.md) |
| 余烬 / 新效果 / 状态 | `content/perks.ts`、`content/statuses.ts` → `combat-core/types.ts`、`EffectHandlers.ts`、`StatusSystem.ts` |
| 地图 / 波次 / 营地与休息点 | `content/maps.ts`、`content/scenes.ts` → `simulation/LevelSystem.ts`、`simulation/SceneSystem.ts` |
| 人物贴图 / 动画、物品图标 | `content/animation.ts`、`content/pixel-art.ts` → `render/HeroSprite.ts`、`AnimatedUnit.ts`、`ArtLibrary.ts` |
| 命中 / 遮挡 / 弹体 | `combat-core/CollisionWorld.ts`、`simulation/GameWorld.ts` |
| 联机 / 存档 / 掉线 | `platform/RoomTransport.ts`、`platform/room-protocol.ts`、`simulation/RunCheckpoint.ts`；根 `scripts/relay-server.ts` |
| 单人存档 / 文件备份 | `platform/LocalTransport.ts`、`RunSaveStorage.ts`、`RunSaveFiles.ts` → `MainMenuLayout.ts` / `Hud.ts`；[使用与契约](docs/SAVES.md) |
| 开发者面板 | `simulation/DeveloperConfig.ts`、`platform/LocalTransport.ts`、`render/DeveloperPanel.ts` |

以上路径相对于游戏源码根目录；完整步骤与可复制示例见内容扩展指南。

## Cocos 资源与美术

- 生成、修改、审查或接入本项目贴图 / 动画时使用 [ember-art skill](.agents/skills/ember-art/SKILL.md)（`$ember-art`）；它按需提供 Prompt、动画契约和验收流程。纯战斗数值修改不需要加载。外来动画草案的取舍见 [审阅结果](docs/ART_ANIMATION_REVIEW.md)。
- 所有攻击 / 技能特效必须轮廓清晰，与实际生效范围、方向和时段一致；玩家、敌人、普攻与触发效果均适用。环境 / UI / 纯装饰特效不受此要求限制。以模拟判定校准美术，不反过来修改碰撞迁就贴图；详见[判定一致性](docs/PIXEL_VFX.md#攻击与技能特效的判定一致性)。
- 制作美术先读 [世界观](docs/WORLD_LORE.md) 与 [风格设计指南](docs/ART_DIRECTION.md)：2026-10-20起保留像素表现，基调改为黑暗、血腥但清晰可读；使用像素簇、共享有限色板和硬边色阶，不能将画面整体压黑。旧明亮自然遗迹图仅作历史参考，不能覆盖新方向；基础人物不带职业标志，装备不改变角色形象。严格像素网格、整数显示和镜头像素对齐仍需后续验收；粒子形态、节奏和预算见 [像素特效规范](docs/PIXEL_VFX.md)。按实际战斗尺寸和多效果叠加场景验收。
- 环境美术采用斜俯视物件 + 等比例地面的2.5D表现；顶面 / 侧面、独立阴影与遮挡提供立体感。制作时明确地面锚点、世界占地和分层，遵循[环境规则](docs/ART_DIRECTION.md#环境视角与地面度量)；不得压缩地面、规则范围或通过方向移速补偿适配贴图。
- 新资源通过 Creator 导入生成 `.meta`，与资源一起提交；不要手写 UUID 或伪造 `.scene / .prefab / .meta`。移动已有资源保留其 UUID。
- `content/art-manifest.ts` 是 `scripts/inspect-art.py` 的生成结果；调整切片时同时维护生成来源，避免下次生成覆盖手工改动。
- 玩家每帧为一个完整身体，以共同地面锚点和固定比例播放；检查八方向、走跑、攻击、受击和死亡，不按逐帧最低像素贴底。装备图仅用于UI；角色贴图、动画和装备不改变碰撞半径。
- 不提交 `node_modules / dist-core / library / temp / profiles / build` 等生成目录；遵守 `.gitignore`。运行时素材使用本地资源。

## 验证与交付

- 逻辑 / 内容改动运行 `pnpm check`；为真实新增机制和缺陷补合适测试，不为简单文案或坐标调整堆重复测试。
- Cocos、UI、素材或可见行为变化需要实际 Creator 构建及对应画面检查。根据 [验证矩阵](docs/DEVELOPMENT_GUIDE.md#验证矩阵) 选择浏览器回归，避免每次无差别跑所有长测试。
- 使用 F2 快速配置，F3 查看碰撞；测试模式可以验证组合，不能代替正常商店 / 奖励流程验收。
- 新增内容会影响奖励抽取顺序和固定种子的候选；检查受影响的测试数据，不通过修改真实战斗数值让旧脚本勉强过关。
- 纯文档变更检查引用路径、示例和说明与代码一致；不需要重建 Cocos。测试数量和历史报告不等于本次运行结果。
- 交付说明写明变化、验证命令与结果、未覆盖的边界，必要时保存截图。同步相关指南与实现记录。
- Git 推送遵循当前任务授权；维护者要求本机推送走 `http://127.0.0.1:7890`，可以用 `git -c http.proxy=http://127.0.0.1:7890 push origin HEAD`。这是本机代理偏好，其他电脑先确认代理存在，不把代理写进共享项目配置。
