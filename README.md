# Project Ember · 余烬试炼 v0.8 · 十八件装备与探索关卡

Cocos Creator 3.8.x / TypeScript 单人 / 2–4 人好友合作 PVE 肉鸽 Demo 源码。

本仓库包含可直接导入的 **Cocos Creator 3.8.8** 工程、游戏源码、测试和构建模板。主场景 `EmberDemo/assets/Main.scene` 已配置 Canvas、Camera 与 GameBootstrap，无需重新创建场景。

后续美术采用**黑暗、血腥但清晰可读的像素奇幻风**：盗火盛世熄灭后，残星点燃死尸，玩家带着对火与燃烧的渴望踏上旅途。2026-10-21用户确认采用[矮胖Q版主角](art-source/rekindled-chibi-v1/README.md)，无血、无发、无五官，阴影面孔保留神秘感。正式设定见[世界观](docs/WORLD_LORE.md)与[风格指南](docs/ART_DIRECTION.md)。

当前运行主角使用[整身序列帧](art-source/chibi-runtime-v1/README.md)，五个绘制视角加三个镜像方向，覆盖走 / 跑、近战 / 远程、施法、受击和死亡；装备不改变角色贴图。左上角“人物配色”提供六种共享图集材质配色，支持单人、联机同步和进度恢复，见[配色指南](docs/HERO_COLORS.md)。Q版粗像素完整动作已接入；现有17怪、环境与特效尚未统一重制为新基调。

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

## 开发文档入口

其他 AI 或新开发者接手时，先读 [AGENTS.md](AGENTS.md)，再按下表选择文档：

| 文档 | 解决的问题 |
| --- | --- |
| [独立任务清单](todoList.md) | 属性实现、装备与怪物设计的分工和验收；服务器部署暂缓 |
| [统一属性系统](docs/ATTRIBUTE_SYSTEM.md) | 每单位独立属性来源、总 AD / AP 表达式、双抗 / 穿透 / 全能吸血；迁移规则与边界 |
| [属性实现与扩展 API](docs/ATTRIBUTE_IMPLEMENTATION.md) | ActorFactory / AttributeSet、来源操作、实际迁移数字、护盾 / 治疗 / 临时效果、恢复版本 |
| [18 件装备设计](docs/design/EQUIPMENT_DESIGN.md) | 六格不限类型、固定角色形象、预算与构筑；18件均可购买，含符击/石息 |
| [装备实现与被动扩展](docs/design/EQUIPMENT_IMPLEMENTATION.md) | 攻击实例锁定、事件来源、两被动生命周期和测试边界 |
| [17 种怪物设计](docs/design/MONSTER_DESIGN.md) | 10 小怪、5 精英、两地图各一个 Boss；17种均已接入，包含独立动作与阶段 |
| [怪物美术设定](docs/design/MONSTER_ART_BRIEFS.md) | 各怪轮廓、配色、动作与后续PNG制作规格；当前为 PNG 姿态帧与状态驱动动画 |
| [怪物与装备设计草图册](art-source/design-sketches-v1/README.md) | 17 种怪物三视图、动作 / 技能、18 件装备图标；22 张设计板与 PDF，尚未替换运行素材 |
| [营地与场景交互](docs/SCENES.md) | 出生余烬、商人、休息点配置、全员集合、房主出发和恢复 |
| [探索关卡](docs/LEVELS.md) | 两张大地图各五关、起终点、固定敌群、镜头与出口规则 |
| [房间联机与恢复](docs/MULTIPLAYER.md) | 房间码、中转服务、角色重连、波次保存与重新开房续玩、部署边界 |
| [单人存档与文件备份](docs/SAVES.md) | 自动保存、首页继续、暂停存取、文件导入导出与战斗起点恢复 |
| [整体架构](docs/ARCHITECTURE.md) | 模块职责、输入到画面的数据流、状态归属、碰撞 / 事件链、阶段和已知限制 |
| [开发架构指南](docs/DEVELOPMENT_GUIDE.md) | 需求该改哪一层、如何实施和验证、兼容性检查、交付标准与 AI 任务模板 |
| [内容扩展指南](docs/CONTENT_ARCHITECTURE.md) | 新技能、装备、敌人、地图、状态、海克斯的注册步骤与可复制示例 |
| [世界观](docs/WORLD_LORE.md) | 盗火、熄灭、死者复燃的已确认前提；故事留白与候选设定的边界 |
| [美术风格设计指南](docs/ART_DIRECTION.md) | 黑暗像素奇幻、血腥与亮度、网格与色板、无固定职业的人物、地图 / 动作 / 特效与验收 |
| [复燃主角概念](art-source/rekindled-hero-v1/README.md) | 第一版候选图、生成提示词、设计意图与生产前待调整项；尚未接入游戏 |
| [双风格与八方向动作](art-source/rekindled-style-studies-v2/README.md) | 死亡细胞取向像素 / 哈迪斯取向手绘，概念与三类动作各八方向三关键姿；含交互对照页，尚未接入游戏 |
| [无面主角03与跑步](art-source/rekindled-hero-v3/README.md) | 采用死亡细胞取向；无血无发无五官，行走 / 近战 / 远程 / 跑步设计板；作为生产身份参考，海报本身不入游戏 |
| [主角整身贴图与动作](art-source/chibi-runtime-v1/README.md) | 五张整身图集、八方向、固定地面基准、实际构建与检查记录 |
| [UI 候选设计](docs/UI_DESIGN.md) | 战斗 HUD、余烬、商店、首页与联机房间效果图；保留初版布局，比较《哈迪斯》参考方向，尚未接入游戏 |
| [美术管线](docs/ART_PIPELINE.md) | 图集、动画、整身锚点、资源导入与 .meta |
| [美术制作 skill](.agents/skills/ember-art/SKILL.md) | 用 `$ember-art` 制作或修复像素贴图、装备、怪物动画、地图与特效；包含 Prompt 和验收约束 |
| [AI 动画准则审阅](docs/ART_ANIMATION_REVIEW.md) | 外来草案的适用范围、需要调整的风格 / 坐标 / 时长规则与后续试作方案 |
| [开发者模式](docs/DEVELOPER_MODE.md) | 快速构筑 / 跳关 / 刷怪、配置导出和 Bug 复现 |
| [海克斯机制](docs/HEX_AUGMENTS.md) | 已实现效果、数值、触发和连锁边界 |

[原始 MVP 任务书](CODEX_GAME_MVP_SPEC.md) 保留为 v0.1 历史参考，其中锁敌普攻、固定 QWER、暂不做商店 / PNG 美术等内容已经过后续迭代，不能用于覆盖当前玩法。

后续制作美术可直接说：`使用 $ember-art，依据当前世界观与美术指南，为复燃主角设计另一版像素形象，只交付概念图。` Skill 位于仓库 `.agents/skills/ember-art`，随 Git 拉取；若工具没有自动发现，直接让 AI 读取上方 SKILL.md 即可。需要制作动画或接入游戏时，在请求中说明对象、采用的形象与交付范围。

## 内容扩展架构

全单位普通移动与飞行道具速度目前统一提高50%，地面采用45°旋转和统一缩放，任意方向的世界速度与屏幕速度都一致，不使用方向移速补偿；视角放大25%并平滑跟随。参数集中在content/tuning.ts，见 [战斗平面、速度与镜头](docs/GAME_FEEL.md)。

敌人行为可配置优先级条件、多人目标策略、出招后停顿、有限连招及单招 / 公共 / 组 / 点名冷却，见 [敌人行为指南](docs/ENEMY_AI.md)。可直接说：`使用 $ember-enemy-ai，给苔角冲阵者配置冲锋后停顿并换目标攻击。` F2右上角「敌人 AI」查看执行原因和计时。

技能、状态、敌人、地图和外观已拆成独立配置与行为模块。首页可以选择 **余烬庭院 / 霜镜回廊**，普通开局与重新开始时 Q/W/E/R 均为空槽。与场景中的余烬互动可获得技能，装备到空槽或替换已有技能；配置的休息点提供可互动的行商。地图配置定义出生、路线、敌群和出口；所有怪物通过 EnemySystem 与动作注册表执行。

新增内容的文件入口、示例和当前边界见 [内容扩展指南](docs/CONTENT_ARCHITECTURE.md)。首批简化遗迹贴图、怪物序列帧和整身序列帧人物已经接入；资源制作及动画扩展见 [美术管线](docs/ART_PIPELINE.md)。

## 已实现功能

- 单人进度自动保存在浏览器；首页「继续存档」，Esc 暂停后可保存 / 读取，也可导入 / 导出 JSON 文件备份。新开局覆盖本地进度槽；战斗读档从本关起点恢复并暂停。详见 [存档说明](docs/SAVES.md)。

- 房间码合作联机：左上角「联机房间」创建 / 加入，房主计算战斗，轻量服务转发并保存波次恢复点；独立装备、技能和奖励，断线重连与队友重新开房续玩。`pnpm relay` 启动本机中转；跨互联网需要另外部署 WSS 服务。首版最多 4 人，详见 [联机指南](docs/MULTIPLAYER.md)。

- 游戏内开发者模式：F2 打开，选地图 / 波次 / 种子，自由配置四槽技能、全部海克斯和装备；支持免伤、无技能冷却、冻结敌人 AI、时间倍率、单帧步进、回血 / 复活、刷怪 / 清怪、3 个本地预设和配置文本导入导出。[使用与扩展说明](docs/DEVELOPER_MODE.md)。
- 56×44 余烬庭院、60×44 霜镜回廊，各5关。地图大于屏幕，镜头中心跟随本地玩家，等比例地面投影和鼠标逆投影共用同一镜头；小地图与战场方向一致，最近敌人方向和出口指引帮助探索。地表和环境按视口裁剪，使用已有本地PNG环境资源。
- 30 Hz 固定步进、渲染插值、可序列化操作命令、脱离引擎的逻辑与快照。
- 两种可选操作：首页 / Esc 暂停菜单切换，浏览器记住选择；右键寻路移动或 WASD 直接移动，两种模式都用左键朝鼠标指针挥击 / 发射，不锁敌、不自动追击、不吸附鼠标。移动保留边界 / 障碍扫掠碰撞。
- 9 个玩家技能：火弹、冰弹、护盾、冲刺、余烬绽放、裂空斩、穿云箭、钢铁壁垒、寒霜环；可通过奖励自由替换四个槽位；独立冷却、攻击预警、方向准星、落点、伤害浮字和血条。
- 10种小怪、5种精英、2个Boss，分别有近战、远射、扇弹、延迟落点、冲锋、矩形斩和圆环等行为。每图第5关含专属Boss，支持阶段切换。当前怪物使用17套PNG图集与2套Boss阶段图集；动画读取敌人状态与实际出手时间。
- 先进入可移动的出生营地，在中央余烬处按 F 选择首次效果；全员到出发点后，房主按 F 开始关卡。清场只结算金币并开放出口，不自动弹出奖励或商店。第2、4关后有商人休息点，第2关休息点还有余烬；第1、3、5关清场可领余烬。每人独立三选一，首次必选，其余可跳过；集合圈内站定准备，房主互动推进。详见 [场景指南](docs/SCENES.md)。
- 六个不限类型的装备栏；18件装备每件100金币，160初始金币。优先填空栏，满格必须选择替换栏才扣款；替下物品保留库存、可免费重装，同ID限购一次。新增暴击、吸血、法穿和魔抗方向；符刻刃提供施法后强化普攻，回响石披提供低血受伤护盾。商品详情显示公式与冷却。
- 全单位共用属性来源与结算，装备提供攻击力、AP 点数、急速等；技能使用明确系数，护甲与魔抗分别结算物理 / 魔法伤害，独立护盾分别到期。F2 的「属性 / 来源」页可检查玩家与敌人并应用测试修正。18件装备和17种怪物都使用统一属性；两种装备被动按玩家独立保存冷却，普通/联机界面显示蓄能与就绪状态。
- 六个装备栏允许同类混搭；装备只提供属性、被动与UI图标，购买或卸装不改变角色形象和普攻形式。角色采用固定整身序列帧，五绘制视角加三镜像覆盖八方向，走跑、近战、远程、施法、受击与倒地由快照驱动。默认近战挥砍，“飞弹普攻”余烬将其改为直线弹体。
- 统一逻辑碰撞：角色 / 障碍圆形体积、近战移动亮锋多边形与连续扫掠范围、技能圆形 / 圆环 / 矩形范围和带半径的连续弹体碰撞；弹体按最早接触结算，近战同次挥击每目标只命中一次。默认挥砍或余烬飞弹均使用碰撞；F3 可查看碰撞体积。
- 21 个数据配置余烬，含首批 12 个 PvE 适配海克斯：技能暴击、飞弹、叠层灼烧、攻击特效、冷却缩减、冲刺爆炸、低血量治疗及治疗转伤害。效果、数值与扩展入口见 [海克斯说明](docs/HEX_AUGMENTS.md)。事件链仍有深度 6、预算 128 和去重保护。
- 首页六个联动实验入口：原有三组火焰联动，加上“法术爆发 / 普攻联动 / 冲刺续航”三组海克斯。实验只预授指定余烬，四个技能槽同样为空，仍通过余烬获得技能并使用正常战斗和购买规则；Esc 可查看本局完整余烬说明。
- URL `?seed=1234`，默认种子 1234。重开使用原种子；默认普通试炼不带余烬。
- 1280×720 设计分辨率，`SHOW_ALL` 保持比例，非 16:9 窗口留边；F3 调试信息，单人切到后台自动暂停；联机房主切后台会暂停房间，队友失焦只清除自己的输入。

逻辑检查与实际 Cocos 构建分别验证；当前场景改造结果见 [验收报告](reports/scenes-validation.json)，旧报告中的计数只代表当时版本。

2026-10-16 攻击范围调整：玩家与敌方的普攻射程、技能半径、条形长度 / 宽度、投射物半径 / 射程及海克斯攻击范围统一为原来的 2 倍。当前近战挥砍范围 5 格，飞弹普攻余烬射程 15 格（2026-10-19 已解除武器绑定）；伤害、冷却、角度、单位碰撞与纯冲刺距离不变。倍率由 `content/attacks.ts` 的 `ATTACK_RANGE_MULTIPLIER` 维护，预警与判定读取同一有效配置。

## 操作

首页或 **Esc 暂停菜单**选择操作方式，无需重开。默认保留右键模式；切换、重开与刷新后会记住选择（浏览器允许本地存储时）。

| 操作 | 右键移动模式 | WASD 移动模式 |
|---|---|---|
| 移动 | 右键地面，自动寻路 | WASD 沿屏幕上左下右移动，松键即停；斜向不加速 |
| 普攻 | 左键点击 / 按住，朝指针挥击或发射 | 左键点击 / 按住，朝指针挥击或发射，可边走边打 |
| 第一槽技能 | Q 朝指针施放 | 右键或 Q 朝指针施放 |
| 第二槽技能 | W | 空格（避免与 W 移动冲突） |
| 第三槽技能 | E | E |
| 第四槽技能 | R | R |
| 场景互动（余烬 / 行商 / 出发） | F | F |
| 关闭交互面板 | Esc | Esc |
| 暂停 / 操作设置 | Esc | Esc |
| 奖励选择 | 1 / 2 / 3 或鼠标点击 | 1 / 2 / 3 或鼠标点击 |
| 技能替换槽位 | 1 / 2 / 3 / 4 或对应技能键 | 1 / 2 / 3 / 4 或对应技能键 |
| 开始 / 离开商店 / 结果页返回首页 | Enter | Enter |
| 调试信息与碰撞体积 | F3 / 右下角 DEBUG | F3 / 右下角 DEBUG |
| 开发者配置面板 | F2 / 游戏内入口 | F2 / 游戏内入口 |

普通开局没有预装技能，空槽按键不会施法。技能通过余烬奖励获得，并选择 Q/W/E/R 槽位装备；已有技能可被新技能替换。两种模式的普攻均沿鼠标方向判定，受攻击间隔、统一攻击距离属性和障碍限制。默认环扫有前摇和短暂的移动亮锋命中窗口；仅当前亮锋及其移动路径有效，内部空洞与旧尾迹不伤害；“飞弹普攻”余烬替换为真正飞行、碰撞后结算的弹体。飞弹仍为总攻击力的物理普攻，可暴击、吸血并触发装备被动。准星对应地面世界坐标，瞄准敌人脚下碰撞圈；不会自动吸附到贴图中心。暂停、失焦、奖励、重开、操作模式切换会清除旧的移动和连击输入。

完成营地首次余烬后以当前最大生命进入第一关；后续波次恢复 30 点生命并重置冷却。换装不会免费回血，降低生命上限会截断当前生命；重开清空本局技能选择、装备和金币，只保留地图与操作模式。双重施法中的两枚投射物 共享奥能储备强化；电弧只从技能和爆炸触发，电击自身不会再弹射。

## 验证命令

```bash
pnpm check        # 纯核心 TS + 官方 Cocos 类型 + 工具脚本类型 + Vitest + 核心 JS/declaration 编译
pnpm benchmark    # 50 敌人 / 120 秒模拟 / 3600 tick；逻辑耗时与 GC 后内存，不是 FPS
pnpm test:campaign # 两张地图各5关，正常命令自动玩家（无数值作弊）
```

`pnpm check` 中 `build:core` **不是 Cocos Web 构建**。Cocos 脚本类型检查使用官方 `@cocos/creator-types@3.8.7`，不包含引擎运行时。Vitest 的间接依赖不用于游戏开发服务器。

历史实测结果见 [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md)、[reports/benchmark.json](reports/benchmark.json)、[reports/playthrough.json](reports/playthrough.json)。

浏览器测试使用已安装的 Google Chrome；先完成 Creator 构建并启动 `pnpm play`。已适配营地流程的入口：

```bash
pnpm test:scenes
pnpm test:transitions # 0.22 秒切换黑幕、暂停、面板例外与连续切图
pnpm test:locations # 地点入场标题、16 个地点配置与两种窗口尺寸
pnpm test:art
pnpm test:multiplayer
pnpm test:hitboxes
```

场景回归通过真实键鼠覆盖两种操作方式的出生余烬、集合和出发；休息点通过显式 F2 入口检查真实移动、F 交互与商店购买。碰撞回归检查左键方向判定、松键停止、鼠标不吸附、暂停、换装与 F3 碰撞显示。报告为 `reports/browser-scenes.json` 和 `reports/browser-hitboxes.json`。两图十关正常命令通关由 `test:campaign` 验证；双浏览器房间、集合、重连与新房恢复由 `test:multiplayer` 验证。

美术回归 `test:art` 检查本地 PNG 加载、显式 F2 休息点中的真实商店购买、怪物动作 / Boss 阶段、两图环境、真实技能翻页特效、暂停及 24 实例预算，输出 `reports/browser-art.json`。它不代替完整战役或多人性能验收；美术制作记录见 [美术补齐与修复](art-source/art-completion-v2/README.md)。

`smoke`、`browser-playthrough`、`test:controls/content/hexes/developer/attributes/levels/equipment` 仍保留旧阶段的操作配方，不能作为当前营地版本的通过证据；迁移见 [TEST-01](todoList.md#test-01--历史浏览器配方迁移)。其历史报告保留原有适用版本。当前改动需以上述可运行脚本与针对性人工验收为准，截图保存在 `reports/`。

Cocos 发布编译对 Map/Set 展开存在与预览不同的处理，已将集合转数组改为 `Array.from`。网页使用官方支持的 `build-templates/web-desktop` 模板，适配窗口尺寸。

## 代码导览

| 目录 | 职责 |
|---|---|
| `EmberDemo/assets/scripts/ember/bootstrap` | 单个 Cocos 组件 `GameBootstrap`，初始化与帧循环 |
| `EmberDemo/assets/scripts/ember/input` | 鼠标/键盘 → 世界坐标 → 输入命令 |
| `EmberDemo/assets/scripts/ember/render` | Cocos Sprite/Graphics/Label、图集缓存、完整人物与怪物序列帧、排序、HUD；投影函数独立于引擎 |
| `EmberDemo/assets/scripts/ember/simulation` | 单人 / 房主权威状态、独立玩家构筑、固定步进、技能、波次、碰撞和恢复点 |
| `EmberDemo/assets/scripts/ember/ai` | 障碍扩张网格、预计算邻接表、最小堆 A*、扫掠 |
| `EmberDemo/assets/scripts/ember/combat-core` | 不依赖 `cc` 的伤害/状态/事件/效果系统 |
| `EmberDemo/assets/scripts/ember/content` | 技能 / 槽位、装备 / 经济、敌人、地图 / 波次、状态、余烬、外观配置与引用校验 |
| `EmberDemo/assets/scripts/ember/platform` | 单人适配、房间协议 / UI、房主同步、重连与保存确认；中转服务位于根 scripts |
| `EmberDemo/assets/resources/art` | 随工程提交的透明 PNG 运行时资源及编辑器生成的 .meta |
| `art-source` | 风格参考、生成提示词、图集检查报告 |
| `tests` | 核心与模拟验证，不使用伪造 Cocos 对象 |
| `scripts` | 性能测试、自动战斗与预览冒烟 |

## 验收边界与下一步

1. 继续人工试玩并调整十关节奏、Boss强度和技能手感。
2. 做更长时间、多次重开的内存观察；当前压力报告仅测量逻辑层，不能代表 50 敌人的 GPU/渲染 FPS。
3. 扩大浏览器覆盖（Safari、Firefox）；当前实测浏览器为 Google Chrome。

当前为首版游戏美术：左右镜像朝向、部件动画与怪物序列帧，尚无八方向美术、Spine 骨骼文件或完整地图编辑器。火、冰、斩击、护盾已增加位图序列特效，判定边界与其他效果继续使用几何绘制。已有房主联机与本机中转，尚未部署公网服务；账号、音效、移动端触控及发行 SDK 尚未实现。后续独立任务统一维护在 [todoList.md](todoList.md)。

装备构筑专项：`EMBER_CAMPAIGN_BUILD=staff,runeblade,bow,wardMantle,sanguineWrap,sageMask pnpm test:campaign` 运行指定六件构筑的正常命令通关，独立写入 `reports/equipment-campaign.json`。八件新装备的旧版浏览器购买配方见 TEST-01，不能直接用于新营地流程。
