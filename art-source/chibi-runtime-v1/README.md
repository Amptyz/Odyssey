# 粗像素 Q 版主角：运行素材 v1

2026-10-21。用户确认[矮胖形象](../rekindled-chibi-v1/README.md)与[粗像素修订](../rekindled-chibi-v2/README.md)后要求开发。本批次替换旧修长的 whole-hero-v1，保留无血、无发、无五官的灰白死者、冷紫裹衣和小余火。每帧一个完整身体，不拼接四肢，不随装备换皮。

## 动作与接入

| PNG | 每个方向的帧 | 播放 |
| --- | --- | --- |
| run | 8帧跑动，包含压低与腾空 | 20 FPS循环 |
| walk | 8帧慢走 | 12 FPS循环 |
| melee | 8帧蓄力、挥臂、收势 | 18 FPS单次 |
| ranged | 8帧聚势、推出、回收；施法共用 | 18 FPS单次 |
| states | 0–1待机、2受击、3–7倒地 | 待机2 FPS；受击 / 死亡8 FPS |

五张1536×1024 RGBA，各8列×5行，共200格。行序S、SE、E、NE、N，另外三个方向整身镜像。刀光、飞弹与技能光效由现有表现层单独绘制，不烘焙进角色图。

侧面近战的第5–7列收势复用该方向的第2 / 0 / 0列，侧面远程末列复用第0列（均从0计）；西侧共用镜像。原候选在这些格中转向了镜头，运行映射避开错误朝向，复用记录在 `alignment.json`，没有重绘或分拆身体。

- 稳定图集ID沿用 `hero-run / hero-walk / hero-melee / hero-ranged / hero-states`，运行资源改为 `EmberDemo/assets/resources/art/chibi-v1/`。
- 全动作固定来源比例 `.4`，站立约70–76设计像素；不得逐帧按包围盒缩放。真实渲染大小还受镜头缩放影响。
- `scripts/inspect-chibi-hero.py`仅测量透明间隙并生成 `atlas-definitions.json / alignment.json`，保留各行共同地面基准、规则列原点，不按最低可见脚点贴底。变更原图后须重新检查基准。
- `art-source/art-completion-v2/manifest.json`引用本定义；随后运行 `scripts/inspect-pixel-art.py`生成 `content/pixel-art.ts`。两脚本均支持 `--check`。
- 原图原样复制到运行目录；Creator负责生成真实 `.meta`。六种衣料配色共用纹理与材质，见[主角配色](../../docs/HERO_COLORS.md)。
- 动画不改变移动、碰撞或伤害时刻；以插值后的模拟时钟采样，暂停冻结。死亡末帧停留后淡出。

## 来源与质量边界

使用内置 `image_gen`。各 `*-prompt.txt` 保存实际调用文本，`generation.json` 记录实际返回文件与哈希。run做过一次步态修订，原始候选路径保留在记录中；其他动作参考同一概念和 states / run 保持身份。未使用脚本重绘、抠图、量化或插帧。

当前版本已经显著减少旧人物的细密衣褶与四肢细节，但仍是首版生成动画：部分相邻步态较接近，正面与斜前视图区分不够强，侧面攻击收势有少量完整姿势复用。严格逻辑像素网格、有限色数、二值alpha与步态自然度继续由ART-08精修，不将“200格”描述为200个充分区别的手绘姿势。源图有分数alpha，查看器显示的透明区隐藏RGB不等于游戏内有棕底。

实际构建、截图、动作与换色检查见[验收记录](verification.md)；不以素材张数或测试数量代替画面质量。
