# 接入与验收

## 已有资源与工具

运行时 PNG 在 `EmberDemo/assets/resources/art/living-ruins/`；制作记录在 `art-source/`。人物部件、装备和环境分别使用 hero-parts、equipment、environment 图集；兼容旧怪物图集使用 ruin-sprite、grovewarden，当前 17 怪默认由 MonsterVisual 程序绘制。上述资产均未因新规范自动像素化。实际尺寸查当前 PNG 与 `art-source/living-ruins-v1/atlas-inspection.json`，不拿 Prompt 请求尺寸代替。

源码根目录为 `EmberDemo/assets/scripts/ember/`。修改前定位：

| 变更 | 数据 / 消费位置 |
| --- | --- |
| 图集布局与切片 | 根目录 `scripts/inspect-art.py` → `content/art-manifest.ts` → `render/ArtLibrary.ts` |
| 怪物外观与动作 | 当前 `render/MonsterVisual.ts` / monster-palettes 与 EnemyPose；旧 PNG 路径为 UNIT_SPRITES、`content/animation.ts`、`render/AnimatedUnit.ts` |
| 人物与装备 | HERO_ARM_ATTACHMENTS、EQUIPMENT_SPRITES、`render/HeroRig.ts`；装备图集目前固定 equipment |
| 环境 | ENVIRONMENT_APPEARANCES、`content/maps.ts`、`render/ArenaView.ts` |
| 技能特效 | EFFECT_APPEARANCES、`render/ArenaView.ts`；复杂新表现需相应 cue 数据 |

`inspect-art.py` 依赖可选 Pillow，只读 PNG、生成 TS 和检查 JSON；它不是去背景、重排像素或任意视频帧导入器。新增布局要先扩展其来源配置，并核对 [动画空间策略](animation.md)。不要在只做审阅或 Prompt 的任务中运行它覆盖已提交数据。

## 素材检查

- 检查实际图片尺寸、alpha 范围、非空区域、帧数和边界。RGBA 模式不等于真实透明；空白帧、半透明残影或假棋盘背景都需报告。
- 浅色 / 深色底上看边缘，避免背景溢色、漏抠叶片、手指或武器尖端；新像素主体应有干净硬边与二值 alpha；旧非像素图单独记录，不用强阈值清边冒充像素重制。
- 序列帧看实际速度的循环 / 单播预览，逐帧核对肢体、装备和朝向；怪物缩小到游戏内大小后仍需能读懂攻击。
- 玩家检查无装备、相关单件、跨流派混搭与左右镜像。肩部接头在衣服后，武器以实际掌心握点定位；头饰的脸部区域透明。
- 大图、contact sheet 和静态截图各能发现不同问题；只看 contact sheet 不能证明播放流畅。新素材检查有意设计的像素簇、有限色板与帧间统一网格；自动量化 / 缩小旧图不能直接算作风格通过。

## 像素显示迁移检查

以 [像素网格标准](../../../../docs/ART_DIRECTION.md#源像素网格与显示目标) 为制作依据。新像素资源应验证最近邻、整数显示倍率、透明边缘与图集串色；这是接入目标，当前 ArtLibrary 未显式配置最近邻，跟随镜头、HeroRig 连续旋转、环境正弦运动和 Graphics 仍需适配。

检查纹理实际 min/mag 采样与 mipmap、Sprite 尺寸 / 节点缩放 / 相机输出，再检查 1280×720 和实际 CSS 缩放 / DPR。平移及镜像不能使源 texel 交替粗细或爬边；实现不满足时记录缺口，在已授权接入任务中补代码，不能当作已有能力。只对表现层应用像素方案，不能舍入世界模拟、CollisionWorld 或输入逆投影。

粒子按 [像素特效规范](../../../../docs/PIXEL_VFX.md) 验收单发 / 密集 / 多人叠加、暂停清理及目标设备性能；单元测试或生成结果不代表预算自动生效。

## Cocos 接入

素材验收后将选中 PNG 放入运行时资源目录，由 Creator 3.8.8 导入生成 `.meta`；移动既有素材保留 UUID，不手写 meta。记录候选到运行时文件的对应关系，避免旧图被误覆盖。

改图集布局时维护 `inspect-art.py` 的生成来源、运行时图集数据和相关 clips；新文件 / 路径需要核对 ArtLibrary，不假设已支持任何 JSON manifest 或多图集装备。新增图片即使加载成功，也不自动创建装备、敌人或技能。

修改脚本 / 配置后运行 `pnpm check`。使用 Creator 构建 Web Desktop，再 `pnpm play` 提供本机 8080 页面；查询参数不能重新构建。运行 `pnpm test:art` 并检查本次受影响画面；涉及装备获得 / 地图或技能流程时按 `docs/DEVELOPMENT_GUIDE.md` 增加对应测试。

F2 的停止 AI、0.25 倍速和单帧步进可检查接缝与动作，F3 对照脚底 / 预警 / 碰撞体积。最后回到正常速度、正常购买 / 奖励流程，观察多敌人和多个海克斯同时触发。当前支持单人 / 2–4 人房主合作；涉及联机效果时按实际玩家数记录，不把本机多怪或旧单人报告称为多人粒子验收。

## 记录与交付层级

在批次制作记录中保留：对象 ID、参考与最终 Prompt、实际工具 / 可获得的模型信息、源输出、选中结果、尺寸 / hash、逻辑画布 / 色板 / 网格 / 实际显示倍率、帧序 / FPS、空间策略 / 挂点原点与单位、加工步骤、验收证据及拒绝原因。源媒体较大时选择合适存储，保留可定位索引；不要强行加入 Git、静默丢弃或把密钥写进记录。

| 完成层级 | 可以声称的结果 | 不可替代的下一层检查 |
| --- | --- | --- |
| 设计 / Prompt | 约束与生成规格已完成 | 不等于图片或视频已生成 |
| 素材文件 | 文件和静态质量已检查 | 不等于动画连续、挂点正确 |
| 动画预览 | 动作、朝向、循环和帧对齐已检查 | 不等于 Cocos 状态时长和效果叠加正确 |
| 游戏接入 | 本次构建、相关测试和实际画面通过 | 不以旧报告替代本次验证 |

失败时写明具体对象 / 帧、可观察缺陷、证据路径及下一步修正；只保留已经达到的交付层级。没有视频 / 编辑器 / 图片工具时完成仍可执行的部分，清楚报告剩余能力缺口。
