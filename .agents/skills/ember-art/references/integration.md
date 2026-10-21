# 接入与验收

## 已有资源与工具

当前主角使用chibi-v1五张整身PNG，生产记录与锚点见art-source/chibi-runtime-v1；原rekindled部件图集不再注册，hero旧身体留作历史兼容。weapons / bodies / heads仅作UI图标。17怪、霜图环境与VFX仍见art-source/art-completion-v2。图集接入不代表严格像素网格、有限色板或二值alpha已验收。

源码根目录为 `EmberDemo/assets/scripts/ember/`。修改前定位：

| 变更 | 数据 / 消费位置 |
| --- | --- |
| 图集布局与切片 | production.json + art-completion-v2/manifest.json 定义片段 → inspect-pixel-art.py → content/pixel-art.ts → ArtLibrary；旧路径 inspect-art.py → art-manifest.ts |
| 怪物外观与动作 | MonsterVisual PNG + EnemyPose；程序轮廓为回退；旧兼容为 UNIT_SPRITES / animation.ts / AnimatedUnit |
| 人物配色 | content/hero-palettes.ts → party.paletteId → HeroSprite → resources/effects/hero-palette.effect；同图集、共享Material；新素材专用衣料色阶见docs/HERO_COLORS.md |
| 人物与装备 | HeroSprite显示整身PNG，HERO_CLIPS / wholeHeroFrame选择帧；装备图只供ArtLibrary.icon，不接入人物 |
| 环境 | ENVIRONMENT_APPEARANCES、`content/maps.ts`、`render/EnvironmentView.ts` / `ArenaView.ts`；`utils/GroundPlane.ts` / `render/GroundProjection.ts`统一地面度量 |
| 技能特效 | EFFECT_APPEARANCES、`render/ArenaView.ts`；复杂新表现需相应 cue 数据 |
| 普通近战实测曲线 | `scripts/measure-melee.mjs` → `content/melee-outline.ts`；MeleeSweep.meleeArea按同一测量相位生成填到脚底的曲面。MeleeVfxPlan / MeleeVfxView共用相位、轮廓、源像素尺度和地形遮罩；F3只显示当前一块曲面；sourceId / attackId关联真实伤害 |

`inspect-pixel-art.py` 与旧 `inspect-art.py` 依赖可选 Pillow，只读 PNG、生成 TS 和检查 JSON；它不是去背景、重排像素或任意视频帧导入器。新增布局要先扩展其来源配置，并核对 [动画空间策略](animation.md)。不要在只做审阅或 Prompt 的任务中运行它覆盖已提交数据。

## 素材检查

- 检查实际图片尺寸、alpha 范围、非空区域、帧数和边界。RGBA 模式不等于真实透明；空白帧、半透明残影或假棋盘背景都需报告。
- 浅色 / 深色底上看边缘，避免背景溢色、漏抠叶片、手指或武器尖端；新像素主体应有干净硬边与二值 alpha；旧非像素图单独记录，不用强阈值清边冒充像素重制。
- 序列帧看实际速度的循环 / 单播预览，逐帧核对肢体、装备和朝向；怪物缩小到游戏内大小后仍需能读懂攻击。
- 所有攻击 / 技能特效按[判定一致性](../../../../docs/PIXEL_VFX.md#攻击与技能特效的判定一致性)对照实际形状与相位：范围轮廓清晰，中心、半径、角度、宽度、安全缺口和当前生效时段一致。F3或等效叠层覆盖八方向及中间角、移动 / 范围变化、浅深背景与叠加；核验边界内外目标碰撞体的实际命中，不能只检查动画累计扫过的区域。无独立判定的反馈核对事件锚点；环境、UI与纯装饰特效无需硬边或碰撞匹配。
- 旋转对齐还要检查时间：普攻范围、刀光和中心与角色位置使用同一个已完成模拟步的插值，不能把刀光外推到尚未判定的下一步。实机应检查“当前实测曲面覆盖静止靶时已实际扣血”，不能只核对最终有没有扣血；可复用 `pnpm test:melee-alignment`。
- 玩家检查八方向、完整肢体连接、共同地面基准、步态首尾及死亡落地；对比购买 / 替换 / 卸装前后同姿态，整身图集和比例必须不变。商店放大图与实际战斗大小都检查。
- 环境按[环境视角与地面度量](../../../../docs/ART_DIRECTION.md#环境视角与地面度量)核对分类、占地、地面锚点与遮挡：斜俯视只表达物件体积，地面方格 / 圆形范围不压缩。实际绕行前后左右，检查F3底座、脚底、危险圈与镜头移动中的尺度；阴影独立，重复投影、漂浮底座和大物件遮挡缺口必须修正或明确列为待接入。
- 大图、contact sheet 和静态截图各能发现不同问题；只看 contact sheet 不能证明播放流畅。新素材检查有意设计的像素簇、有限色板与帧间统一网格；自动量化 / 缩小旧图不能直接算作风格通过。

## 像素显示迁移检查

以 [像素网格标准](../../../../docs/ART_DIRECTION.md#源像素网格与显示目标) 为制作依据。新像素资源应验证最近邻、整数显示倍率、透明边缘与图集串色；ArtLibrary 已显式配置最近邻，HeroSprite以整身帧播放、整体镜像，无分段肢体旋转；仍须检查源 texel 倍率、旋转、镜头 / DPR、透明边缘与 PNG / Graphics 混合密度，不因此宣称严格像素网格达标。

检查纹理实际 min/mag 采样与 mipmap、Sprite 尺寸 / 节点缩放 / 相机输出，再检查 1280×720 和实际 CSS 缩放 / DPR。平移及镜像不能使源 texel 交替粗细或爬边；实现不满足时记录缺口，在已授权接入任务中补代码，不能当作已有能力。只对表现层应用像素方案，不能舍入世界模拟、CollisionWorld 或输入逆投影。

粒子按 [像素特效规范](../../../../docs/PIXEL_VFX.md) 验收单发 / 密集 / 多人叠加、暂停清理及目标设备性能；单元测试或生成结果不代表预算自动生效。

## Cocos 接入

素材验收后将选中 PNG 放入运行时资源目录，由 Creator 3.8.8 导入生成 `.meta`；移动既有素材保留 UUID，不手写 meta。记录候选到运行时文件的对应关系，避免旧图被误覆盖。

改图集布局时维护 production.json 或 art-completion-v2/manifest.json 引用的定义来源，再生成 pixel-art.ts，并运行 `python3 scripts/inspect-pixel-art.py --check`；不要直接改生成表。旧 art-manifest.ts 继续由 inspect-art.py 生成。ArtLibrary 读取生成 TS 的 resourcePath，不在运行时解析任意 JSON。新增图片即使加载成功，也不自动创建装备、敌人或技能。

修改脚本 / 配置后运行 `pnpm check`。使用 Creator 构建 Web Desktop，再 `pnpm play` 提供本机 8080 页面；查询参数不能重新构建。运行 `pnpm test:art` 并检查本次受影响画面；涉及装备获得 / 地图或技能流程时按 `docs/DEVELOPMENT_GUIDE.md` 增加对应测试。

F2 的停止 AI、0.25 倍速和单帧步进可检查接缝与动作，F3 对照脚底 / 预警 / 碰撞体积。最后回到正常速度、正常购买 / 奖励流程，观察多敌人和多个海克斯同时触发。当前支持单人 / 2–4 人房主合作；涉及联机效果时按实际玩家数记录，不把本机多怪或旧单人报告称为多人粒子验收。

## 记录与交付层级

在批次制作记录中保留：对象 ID、参考与最终 Prompt、实际工具 / 可获得的模型信息、源输出、选中结果、尺寸 / hash、逻辑画布 / 色板 / 网格 / 实际显示倍率、帧序 / FPS、空间策略 / 地面锚点原点与单位、加工步骤、验收证据及拒绝原因。源媒体较大时选择合适存储，保留可定位索引；不要强行加入 Git、静默丢弃或把密钥写进记录。

| 完成层级 | 可以声称的结果 | 不可替代的下一层检查 |
| --- | --- | --- |
| 设计 / Prompt | 约束与生成规格已完成 | 不等于图片或视频已生成 |
| 素材文件 | 文件和静态质量已检查 | 不等于动画连续、挂点正确 |
| 动画预览 | 动作、朝向、循环和帧对齐已检查 | 不等于 Cocos 状态时长和效果叠加正确 |
| 游戏接入 | 本次构建、相关测试和实际画面通过 | 不以旧报告替代本次验证 |

失败时写明具体对象 / 帧、可观察缺陷、证据路径及下一步修正；只保留已经达到的交付层级。没有视频 / 编辑器 / 图片工具时完成仍可执行的部分，清楚报告剩余能力缺口。
