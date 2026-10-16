# Project Ember：AI 开发入口

这是 Cocos Creator 3.8.8 / TypeScript 单人 PVE 游戏。开始修改前，先检查 `git status --short`，阅读本文件，再按任务选择下方文档。不覆盖已有工作，不将历史任务书当成当前版本的待办清单。

## 阅读顺序

1. [README.md](README.md)：环境、启动、当前玩法和命令。
2. [整体架构](docs/ARCHITECTURE.md)：运行流程、状态归属、模块依赖与限制。
3. [开发架构指南](docs/DEVELOPMENT_GUIDE.md)：改动落点、实施顺序、验证和交付。
4. 按需阅读：[内容扩展](docs/CONTENT_ARCHITECTURE.md)、[美术风格设计](docs/ART_DIRECTION.md)、[美术管线](docs/ART_PIPELINE.md)、[海克斯](docs/HEX_AUGMENTS.md)、[开发者模式](docs/DEVELOPER_MODE.md)。

`CODEX_GAME_MVP_SPEC.md` 是 v0.1 历史需求，部分内容已被后续设计替代：目前已有装备与正式 PNG，普攻不锁定敌人，QWER 可替换。具体变更见 [实现记录](docs/IMPLEMENTATION_LOG.md)。用户本次明确提出的新要求可以调整现有设计；同步更新相关文档，不要因旧文档而恢复旧行为。

## 唯一源码与工具链

- 游戏源码仅在 `EmberDemo/assets/scripts/ember/`；Cocos 工程根目录是 `EmberDemo/`，仓库根目录负责依赖和测试。
- 使用 Creator **3.8.8**；Node 版本见 `.nvmrc`，pnpm 版本见根 `package.json`。根目录执行 `pnpm install --frozen-lockfile`。
- 不另建 Web 游戏实现，不复制第二份核心代码，不用 Vite 替换 Cocos 构建。
- `pnpm check` = 核心 / Cocos / 工具类型检查 + Vitest + 核心编译；它不生成浏览器游戏。
- Creator 构建 Web Desktop 至 `EmberDemo/build/web-desktop` 后，`pnpm play` 才能提供 8080 试玩。改代码后需重新构建并刷新；`?v=...` 只是 URL 参数，不会自动生成新构建。

## 开发时保持的约定

- 无固定职业。玩家通过主动技能奖励与确定性装备购买形成构筑；装备同时决定外观。基础人物保持中性、简洁的遗迹风格。
- 两种操作都以左键朝鼠标地面方向普攻，允许挥空；不恢复锁定、自动追击或鼠标吸附。QWER 是槽位，技能逻辑使用稳定 `SkillId`。
- 先判断能否复用已有配置和处理器。新技能 / 装备 / 敌人变种通常不需要在 `GameWorld` 加 ID 分支。
- `simulation / combat-core / ai / content / utils` 保持不依赖 `cc`、DOM、真实时钟和全局随机数。输入和 UI 发命令，战斗状态由逻辑层修改，表现层消费快照。
- 命中使用 `CollisionWorld` 的世界坐标查询；移动使用 `Pathfinder.sweep`。不能用贴图距离、动画回调或 Cocos 刚体另建一套伤害判定。
- 战斗时间使用 `FIXED_DT` / `GameWorld.time`，随机使用已有 `Random`。保留暂停、重开、阶段切换与旧输入清理。
- 伤害 / 治疗进入 `CombatEngine`；连锁效果保留 `rootId / depth / proc` 等来源信息和预算保护。不要用直接扣 HP 绕过事件链。
- 配置是共享定义，不作为可变的角色实例存储。新增快照字段要复制其中的可变对象，不把实体、Node 或 Set 暴露给 UI 修改。
- 开发者开关仅在显式应用的测试世界中生效；新增工具继续经过配置校验、命令和模式检查，不默认给普通局加作弊效果。

## 常见修改入口

| 需求 | 首先查看 |
| --- | --- |
| 新技能 / 新技能行为 | `content/skills.ts` → `simulation/SkillSystem.ts` |
| 装备 / 属性 / 武器普攻 | `content/equipment.ts`、`content/attacks.ts`、`simulation/EquipmentSystem.ts` |
| 敌人 / AI | `content/enemies.ts` → `ai/EnemyBehaviors.ts` |
| 增益 / 新效果 / 状态 | `content/perks.ts`、`content/statuses.ts` → `combat-core/types.ts`、`EffectHandlers.ts`、`StatusSystem.ts` |
| 地图 / 波次 / 开店阶段 | `content/maps.ts`、`content/progression.ts` |
| 人物 / 装备贴图、动画 | `content/appearances.ts`、`content/animation.ts` → `render/HeroRig.ts`、`AnimatedUnit.ts` |
| 命中 / 遮挡 / 弹体 | `combat-core/CollisionWorld.ts`、`simulation/GameWorld.ts` |
| 开发者面板 | `simulation/DeveloperConfig.ts`、`platform/LocalTransport.ts`、`render/DeveloperPanel.ts` |

以上路径相对于游戏源码根目录；完整步骤与可复制示例见内容扩展指南。

## Cocos 资源与美术

- 生成、修改、审查或接入本项目贴图 / 动画时使用 [ember-art skill](.agents/skills/ember-art/SKILL.md)（`$ember-art`）；它按需提供 Prompt、动画契约和验收流程。纯战斗数值修改不需要加载。外来动画草案的取舍见 [审阅结果](docs/ART_ANIMATION_REVIEW.md)。
- 制作美术先读 [风格设计指南](docs/ART_DIRECTION.md)：参考图只提供氛围，实际游戏使用低细节、大色块；基础人物不带职业标志，装备表达流派。按实际战斗尺寸和多效果叠加场景验收。
- 新资源通过 Creator 导入生成 `.meta`，与资源一起提交；不要手写 UUID 或伪造 `.scene / .prefab / .meta`。移动已有资源保留其 UUID。
- `content/art-manifest.ts` 是 `scripts/inspect-art.py` 的生成结果；调整切片时同时维护生成来源，避免下次生成覆盖手工改动。
- 武器握点、肩部挂点与脚底锚点是表现数据；换装不改变碰撞半径。验证左右镜像、待机、攻击、移动以及衣甲遮挡；最近的手臂修复约定见美术管线。
- 不提交 `node_modules / dist-core / library / temp / profiles / build` 等生成目录；遵守 `.gitignore`。运行时素材使用本地资源。

## 验证与交付

- 逻辑 / 内容改动运行 `pnpm check`；为真实新增机制和缺陷补合适测试，不为简单文案或坐标调整堆重复测试。
- Cocos、UI、素材或可见行为变化需要实际 Creator 构建及对应画面检查。根据 [验证矩阵](docs/DEVELOPMENT_GUIDE.md#验证矩阵) 选择浏览器回归，避免每次无差别跑所有长测试。
- 使用 F2 快速配置，F3 查看碰撞；测试模式可以验证组合，不能代替正常商店 / 奖励流程验收。
- 新增内容会影响奖励抽取顺序和固定种子的候选；检查受影响的测试数据，不通过修改真实战斗数值让旧脚本勉强过关。
- 纯文档变更检查引用路径、示例和说明与代码一致；不需要重建 Cocos。测试数量和历史报告不等于本次运行结果。
- 交付说明写明变化、验证命令与结果、未覆盖的边界，必要时保存截图。同步相关指南与实现记录。
- Git 推送遵循当前任务授权；维护者要求本机推送走 `http://127.0.0.1:7890`，可以用 `git -c http.proxy=http://127.0.0.1:7890 push origin HEAD`。这是本机代理偏好，其他电脑先确认代理存在，不把代理写进共享项目配置。
