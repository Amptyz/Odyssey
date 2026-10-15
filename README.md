# Project Ember · 余烬试炼 v0.2

Cocos Creator 3.8.x / TypeScript 单人 PVE 肉鸽 Demo 源码。

本仓库包含可直接导入的 **Cocos Creator 3.8.8** 工程、游戏源码、测试和构建模板。主场景 `EmberDemo/assets/Main.scene` 已配置 Canvas、Camera 与 GameBootstrap，无需重新创建场景。

## 在另一台电脑开发

准备 **Cocos Creator 3.8.8、Node.js 26.x、pnpm 11.25.0、Git**。Node 版本也记录在 `.nvmrc`；没有 pnpm 时执行 `npm install -g pnpm@11.25.0`。

```bash
git clone https://github.com/Amptyz/Odyssey.git
cd Odyssey
pnpm install --frozen-lockfile
pnpm check
```

在 Cocos Dashboard 中导入仓库内的 **EmberDemo** 文件夹，用 Creator 3.8.8 打开，再打开 `assets/Main.scene`，点击顶部预览按钮即可运行。

**唯一游戏源码位于 `EmberDemo/assets/scripts/ember/`。** 直接编辑这里，测试与 Cocos 读取同一份源码，不需要复制或运行同步脚本。不要把仓库根目录作为 Cocos 工程导入。

## 生成独立试玩页面

首次在新电脑上打开 **Project → Build**，创建 Web Desktop 构建任务，包含并设置 Main 为启动场景，输出目录使用 `build`、输出名 `web-desktop`，然后 Build。构建后在仓库根目录执行：

```bash
pnpm play
```

打开 [余烬试炼](http://127.0.0.1:8080/)。服务只监听本机地址，游戏资源全部在本地。构建输出不提交 Git，所以刚拉取后不能直接执行 `pnpm play`，需要先完成一次 Cocos 构建；编辑器预览不需要这一步。

详细步骤和资源提交约定见 [docs/MANUAL_SETUP.md](docs/MANUAL_SETUP.md)。

## 内容扩展架构

技能、状态、敌人、地图和外观已拆成独立配置与行为模块。首页可以选择 **余烬庭院 / 霜镜回廊**，并切换 Q 槽的 **烬火弹 / 霜凝弹**。霜灯守卫、冰弹减速和第二张矩形地图作为扩展实例已经接通。

新增内容的文件入口、示例和当前边界见 [内容扩展指南](docs/CONTENT_ARCHITECTURE.md)。素材仍为几何占位，后续可在表现层接入正式贴图 / 动画。

## 已实现功能

- 20×20 庭院与 24×16 冰霜地图、等距投影/逆投影、棋盘地砖、六个障碍、按脚底深度排序；原创几何角色和特效，无网络美术资源。
- 30 Hz 固定步进、渲染插值、可序列化操作命令、脱离引擎的逻辑与快照。
- 两种可选操作：首页 / Esc 暂停菜单切换，浏览器记住选择；右键移动/锁敌、自动追击与普攻，或 WASD 直接移动、鼠标瞄准攻击。两种模式均有边界/障碍扫掠碰撞。
- Q 可装备火焰弹 / 冰弹，W 护盾、E 冲刺、R 范围爆发；独立冷却、攻击预警、选中环、落点、伤害浮字和血条。
- 苔石兽、雾灯灵与霜灯守卫；庭院三波 27 个敌人，霜镜回廊两波 13 个敌人；波次和刷怪由地图配置决定。
- 每波结束暂停并随机三选一，包括最后一波；按装备过滤无法使用的增益，选择最终奖励后结算胜利。失败、暂停帮助、重开。
- 8 个数据配置增益，事件队列串联技能/命中/灼烧/击杀；最大深度 6、每条根事件最多 128 个事件、规则去重、一次死亡一次击杀事件。
- 首页三个联动实验入口：燃烧弹→尸爆、尸爆→电弧、奥能储备→双重施法。实验使用真实战斗，只额外预授指定增益。
- URL `?seed=1234`，默认种子 1234。重开使用原种子；默认普通试炼不带增益。
- 1280×720 设计分辨率，`SHOW_ALL` 保持比例，非 16:9 窗口留边；F3 调试信息，切到后台自动暂停。

游戏已通过 Cocos 3.8.8 真实预览。发布版单独执行浏览器测试，结果见下方报告。

## 操作

首页或 **Esc 暂停菜单**选择操作方式，无需重开。默认保留右键模式；切换、重开与刷新后会记住选择（浏览器允许本地存储时）。

| 操作 | 右键移动模式 | WASD 移动模式 |
|---|---|---|
| 移动 | 右键地面，自动寻路 | WASD 沿屏幕上左下右移动，松键即停；斜向不加速 |
| 普攻 | 右键敌人，自动追击和攻击 | 左键点击 / 按住，朝指针近距离攻击；不会自动追击，可边走边打 |
| 主技能（火焰弹 / 冰弹） | Q 朝指针施放 | 右键或 Q 朝指针施放 |
| 护盾 | W | 空格（避免与 W 移动冲突） |
| 冲刺 | E 朝指针冲刺 | E 朝指针冲刺 |
| 范围爆发 | R 在自身周围施放 | R 在自身周围施放 |
| 暂停 / 操作设置 | Esc | Esc |
| 奖励选择 | 1 / 2 / 3 或鼠标点击 | 1 / 2 / 3 或鼠标点击 |
| 开始 / 结果页返回首页 | Enter | Enter |
| 调试信息 | F3 / 右下角 DEBUG | F3 / 右下角 DEBUG |

护盾为 65 点、持续 4 秒；冲刺不能穿越障碍；R 范围为自身周围 3.8 格。WASD 普攻沿鼠标方向判定近距离目标，受攻击间隔、距离和障碍限制。暂停、失焦、奖励、重开、操作模式切换会清除旧的移动和连击输入。

波次切换恢复 30 点生命并重置技能冷却。双重施法中的两枚 Q 共享奥能储备强化；电弧只从技能和爆炸触发，电击自身不会再弹射。

## 验证命令

```bash
pnpm check        # 纯核心 TS + 官方 Cocos 类型 + 工具脚本类型 + Vitest + 核心 JS/declaration 编译
pnpm benchmark    # 50 敌人 / 120 秒模拟 / 3600 tick；逻辑耗时与 GC 后内存，不是 FPS
pnpm playthrough  # 10 个固定种子，正常数值的输入命令机器人，统计胜负
```

`pnpm check` 中 `build:core` **不是 Cocos Web 构建**。Cocos 脚本类型检查使用官方 `@cocos/creator-types@3.8.7`，不包含引擎运行时。Vitest 的间接依赖不用于游戏开发服务器。

历史实测结果见 [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md)、[reports/benchmark.json](reports/benchmark.json)、[reports/playthrough.json](reports/playthrough.json)。

浏览器测试使用已安装的 Google Chrome；先启动 `pnpm play`：

```bash
EMBER_PREVIEW_URL=http://127.0.0.1:8080 pnpm smoke
node --import tsx scripts/browser-playthrough.ts
pnpm test:controls
pnpm test:content
```

冒烟测试通过真实鼠标/键盘检查启动、移动、Q、打怪、奖励选择、暂停、缩放和重开。完整通关测试覆盖 QWER、三波奖励、胜利与重开，并禁止外部 HTTP 资源请求。报告为 `reports/browser-smoke.json`、`reports/browser-playthrough.json`，截图保存在 `reports/`。

双模式回归额外验证 WASD 四向移动、松键停止、对向键抵消、空格护盾、鼠标普攻与火焰弹、暂停中切换、刷新记忆、重开、缩放和失焦清理。报告见 `reports/browser-controls.json`。

Cocos 发布编译对 Map/Set 展开存在与预览不同的处理，已将集合转数组改为 `Array.from`。网页使用官方支持的 `build-templates/web-desktop` 模板，适配窗口尺寸。

## 代码导览

| 目录 | 职责 |
|---|---|
| `EmberDemo/assets/scripts/ember/bootstrap` | 单个 Cocos 组件 `GameBootstrap`，初始化与帧循环 |
| `EmberDemo/assets/scripts/ember/input` | 鼠标/键盘 → 世界坐标 → 输入命令 |
| `EmberDemo/assets/scripts/ember/render` | Cocos Graphics/Label、对象复用、排序、HUD；投影函数独立于引擎 |
| `EmberDemo/assets/scripts/ember/simulation` | 单机权威状态、固定步进、技能、波次、碰撞 |
| `EmberDemo/assets/scripts/ember/ai` | 障碍扩张网格、预计算邻接表、最小堆 A*、扫掠 |
| `EmberDemo/assets/scripts/ember/combat-core` | 不依赖 `cc` 的伤害/状态/事件/效果系统 |
| `EmberDemo/assets/scripts/ember/content` | 技能 / 槽位、敌人、地图 / 波次、状态、增益、外观配置与引用校验 |
| `EmberDemo/assets/scripts/ember/platform` | `GameCommand` / `LocalTransport`，未来联网边界；无服务器依赖 |
| `tests` | 核心与模拟验证，不使用伪造 Cocos 对象 |
| `scripts` | 源码导入工具、性能测试、自动战斗与预览冒烟 |

## 验收边界与下一步

1. 继续人工试玩并调整第三波强度和技能手感。
2. 做更长时间、多次重开的内存观察；当前压力报告仅测量逻辑层，不能代表 50 敌人的 GPU/渲染 FPS。
3. 扩大浏览器覆盖（Safari、Firefox）；当前实测浏览器为 Google Chrome。

未实现多人/服务端、账号、商店、音效、正式美术、移动端触控及发行 SDK；这些不属于本轮范围。
