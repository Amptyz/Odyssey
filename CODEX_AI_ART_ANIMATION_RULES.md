# Project Ember — AI 美术与动画生成准则（Codex 审阅草案）

> **后续方向已更新为像素遗迹风（2026-10-16）：** 本文中“非像素 / 卡通”、高分辨率画布等旧意见均保留为历史，不得用于新制作。当前权威标准是 [ART_DIRECTION](docs/ART_DIRECTION.md) 与 [PIXEL_VFX](docs/PIXEL_VFX.md)，现有素材尚未像素化。

> **2026-10-16 审核说明：**下方保留原草案正文，不作为当前执行规则。差异与采用方案见 [审阅结果](docs/ART_ANIMATION_REVIEW.md)，后续素材制作使用 [ember-art skill](.agents/skills/ember-art/SKILL.md)；人物风格、坐标、播放窗口和工具路线已按现有工程修订。

> 状态：供 Codex **审阅并适配**的草案，不是无条件覆盖现有工程的命令。\
> 适用：Cocos Creator 3.8.x + TypeScript，Web-first，固定斜视角 2D 动作肉鸽，未来最多 5 人合作 PVE。\
> 目的：统一 AI 资产的视觉语言、动画 Prompt、加工流程、验收标准与后续维护规则。\
> 本文并非外部文章原文；“项目准则”和 Prompt 为针对 Project Ember 的建议，外部来源见第一节。

## 0. Codex 执行原则：先调研现状，再适配

1. 首先检查仓库的 README、现有代码、素材目录、Cocos 场景和动画加载方式，**不要推断项目结构**。
2. 阅读第 1 节所列公开资料，重点理解动画一致性、图生视频抽帧、帧归一化和反例；不得未经验证声称已经阅读或运行。
3. 比对本文与现有规范，输出差异与建议，然后把适用条款写入已有 `AGENTS.md` / `ART_STYLE.md` / 项目指定文档；**不要直接覆盖旧规则**。如文件不存在，创建合适位置的规则文件。
4. **本次任务仅审阅并整合准则和 Prompt，不执行素材生成、付费模型调用、场景重做或大规模脚本重构**。后续如经确认需要验证，优先只对一个普通怪物做 `idle`、`walk`、`attack` 动画闭环。
5. 资产生成模型不是工程可执行工具的前提：即使当前环境无法调用图像/视频模型，也可完成 Prompt 模板和资源规格设计；质量校验脚本与导入流水线请先列入后续实施计划，不要本次擅自实施。不能宣称已经生成或审核不可访问的画面。
6. 保留原图、原视频、提帧素材、生成 Prompt、模型/版本、参数、版权与使用权限来源，支持重做和回溯。
7. 优先使用项目已有脚本和依赖；新增 FFmpeg/Pillow 等工具前检查现状；不得无故修改已可玩的战斗逻辑。

## 1. 公开参考链接（2026-10 核实）

### 主要阅读（按优先级）

1. **AI Game Spritesheets：完整开源工作流、原始 Prompt 与资源示例**\
   https://github.com/chongdashu/ai-game-spritesheets\
   - 项目结构中的 `prompts/`、`references/`，包含 canonical anchor、方向图、走路、攻击、待机及归一化。
   - 攻击 Prompt（10 帧 5×2 作为其项目示例，不是 Ember 强制规格）：\
     https://github.com/chongdashu/ai-game-spritesheets/blob/main/prompts/06-attack-spritesheet.md
   - 方向锚点：\
     https://github.com/chongdashu/ai-game-spritesheets/blob/main/prompts/04-directional-anchors.md
   - 归一化：\
     https://github.com/chongdashu/ai-game-spritesheets/blob/main/prompts/08-normalization.md
2. **Layr Kits：Codex + 图生视频 + FFmpeg + Pillow，含详细脚本约定**\
   https://www.layrkits.com/guides/sprite-sheet\
   - 先生成 animation-safe pose，然后图生视频，抽取全部帧、挑关键帧、合成动画图集。
   - 尤其留意作者针对**锁定视频画布**提出的 `preserve-canvas`：不要逐帧自动居中/重新贴脚底。
3. **Higgsfield 2D 动画工作流示例**（社区提供的技能文档，不代表官方引擎标准）\
   https://github.com/kaveone/higgsfield-skills/blob/main/higgsfield-game-generation/references/2d-animation.md\
   - `locked camera`、方向锁定、loop 与 one-shot 区分、帧数与 FPS 区分、循环重复帧处理。
4. **AI Pixel-Snapped Game Sprites：像素资产的处理和质量门禁**\
   https://github.com/chongdashu/ai-pixel-snapped-game-sprites\
   - 参考其帧漂移/错位/去背景处理，不要把该项目的“纯像素画风”套用到 Ember。
5. **Neptune Vibes Sprite Manager 开发日志**\
   https://neptunevibes.com/devlog/sprite-manager/\
   - 审核图库、拒绝原因记录、以统一角色基图为身份约束、动画逐姿势检查。
6. **TheSpriteWizard 分享的游戏 Sprite Prompt**\
   https://www.reddit.com/r/aigamedev/comments/1uacn8h/my_best_prompts_for_sprite_generation/\
   - 学习“有限配色、简化形状、可读轮廓、孤立主体、高对比背景”的描述方式。
7. **Scenario 一致性资产生成方案（选读）**\
   https://docs.scenario.com/get-started/documentation/integrating-with-applications-real-world-scenarios\
   - 后期资产批量化才考虑风格训练/模型定制，当前先做参考图加风格规范。
8. **Cocos Creator 3.8 官方动画事件说明**\
   https://docs.cocos.com/creator/3.8/manual/zh/animation/animation-event.html\
   - 了解动画时间轴事件；权威伤害判定需以战斗逻辑/服务器为准，不能只依赖视觉动画事件。

**引用方式说明：**外部仓库部分内容聚焦像素风，但我们的目标是清爽的非像素卡通美术；仅提取其**工程和 Prompt 约束**。单个作者的经验并非普遍保证，必须实际验证。

## 2. 已确认的 Project Ember 美术基线（禁止随意漂移）

### 当前锁定

- **固定斜视角 2D（slanted top-down）**；不是自由旋转 3D。优先锁定摄像机的方向、角度、缩放和角色画面尺寸。
- **地图风格 B**：明快清爽的自然 + 魔法遗迹；卡通简化、清楚的外轮廓、干净的色块、适量柔和光影。C 风格仅借鉴**光影层次和氛围**，不得整体替换成纹理繁复的绘本风。
- 地图可行走区域**低视觉噪声**：较大的平静底色、简洁地砖、低对比纹理，不铺满草叶、碎石、花瓣、亮点和阴影纹理。复杂装饰集中在**不可行走的边界、栏杆、水域、建筑、高台和远景**；障碍边界清晰。
- **怪物延续现有简化造型**：普通怪小而圆润、面具式/符号化脸部、大形体与有限配色；精英怪强轮廓和明确辨识点；不要靠堆甲片、花纹、宝石来显得“高级”。
- 角色目前**不是美术生成重点**；未经用户要求不要重新生成英雄、技能特效或动作展示概念板。
- 将来如需生成玩家角色：现代、利索、潮流感的幻想服装，简化卡通造型；**没有脸部细节**（不生成完整眼、鼻、嘴），优先有辨识度的发型、面罩/阴影、配色和轮廓。
- 战斗需要有力的动画/声音反馈，但不能让五人联机的技能覆盖敌方攻击预警。

### 风格验收优先级

1. 游戏实际缩放下的**可读性** > 大图精美程度。
2. 固定视角、角色体型、阴影/光照方向一致 > 单张画作细节。
3. 地图操作区域低干扰 > 丰富地面纹样。
4. 角色/怪物轮廓与动作清晰 > 粒子数量。
5. 长时间游玩舒适 > 强烈泛光/闪屏。

## 3. 资产生成须分阶段

推荐：

`approved style references` → `single identity/neutral anchor` → `directional anchors (if needed)` → `motion generation` → `frame selection` → `alpha cleanup` → `sheet + manifest` → `visual QA in game`。

- **地图**：AI 输出概念图、独立 Tile、边缘装饰、背景；真正可走地面与障碍通过 Cocos 场景/网格组合。不要把单张概念图直接当作具有碰撞信息的地图。
- **普通怪物**：单个中性站立锚点在先，待机/走路/攻击分别生成；每次一个动作。
- **精英怪**：优先关键攻击预警、动作时序和大轮廓，不要把额外细节当成质量。
- **动画本体与 VFX 分离**：刀光、冰火雷电、命中粒子、地面圈及击杀闪光单独生成；肉鸽增益会改变特效，避免把所有效果画死在怪物/角色每帧中。
- **SFX 分离**：挥击、击中、护甲破碎、精英击杀、连杀提示分层管理，不嵌入动画资产。

## 4. 每个动画生成任务必须明确的 12 条约束

1. `Identity lock`：同一角色/怪物的体型、肢体数量、头身比、材质、武器、标志性轮廓、配色全程不变。
2. `Perspective lock`：固定斜视角；使用第一帧的确切视角；不能因为 Prompt 写 `isometric` 就强迫角色旋转。
3. `Facing lock`：一个动画片段只面向指定方向；不能中途转身。需要转身的动作另建 one-shot clip。
4. `Camera lock`：不允许 zoom、pan、tilt、dolly、camera shake、镜头切换；主体全程在画布内。
5. `Scale lock`：不同帧角色的身体尺度保持稳定；允许姿势造成的投影尺寸变化，不允许无故变大变小。
6. `Safe framing`：全身和武器都在画布内，动作极值保留余量；不能截手、脚、武器尖、角或尾巴。
7. `Static background`：透明背景优先；否则用与主体不冲突的固定纯色做抠图底，不要地面、投影、光晕或镜头景深。
8. `One action per clip`：`idle/walk/attack/hurt/death` 分开生成；Prompt 描述**身体动作**，而非“很酷很有力量”这样的抽象形容词。
9. `Animation beats`：一次性攻击具有 ready → anticipation → strike → contact → recovery；不同阶段比例可调整。
10. `Loop correctness`：idle/walk 是 loop；attack/hurt/death 是 one-shot。循环需检查首尾姿势连续，必要时删除重复结束帧。
11. `No baked-in combat FX`：除非特殊授权，不包含刀光、火焰、闪电、爆炸、击中火花、伤害数字和屏幕抖动。运行时独立组合。
12. `No hallucinated additions`：不能新增长臂、衣服挂饰、眼睛/嘴、背包、第二把武器、附肢、文本或水印。

> 以上是 **Prompt 与人工验收目标**，不是文字能百分百约束生成模型的保证。

## 5. 可直接套用的英文 Prompt 模板

下列 Prompt 应由 Codex 生成具体实例，填入实体参数，并输入**已确认的单体参考图**。若模型不支持 negative prompt，直接将限制写入主 Prompt。不要让模型凭文字“复原”尚未附上的参考图。

### 5.1 怪物中性姿势（IDENTITY ANCHOR）

```text
Use the attached APPROVED [MONSTER_ID] reference image as the exact
identity and style anchor. This is a production source sprite,
not a marketing illustration.

Create ONE neutral, full-body standing pose of [MONSTER_ID].
Preserve its exact silhouette, body proportions, number of limbs,
mask/face design, outfit and weapon placement, main colors,
outline weight, and simplified cel-shaded rendering.

Camera: match the attached reference's fixed slanted top-down
three-quarter gameplay view EXACTLY.
Facing: [DIRECTION] — do not improvise a new camera angle.
Composition: one monster, centered, full body visible,
with generous motion-safe margins, feet visible.
Background: perfectly flat removable [CHROMA_COLOR], with no
floor, ground shadow, gradient, scenery, particles, text or watermark.

Style: bright readable cartoon shapes, low-frequency surface detail,
soft controlled shading, no unnecessary ornaments.

Do not add details, limbs, horns, foliage clusters, jewels,
weapons or facial expressions not found in the identity reference.
```

注意：若绿色植物怪包含饱和绿色，**不要**无脑使用 `#00FF00` 抠图底，改用与角色所有像素明显不同的底色；去背景时检查绿色发梢与薄叶子是否被吃掉。

### 5.2 待机循环（IDLE LOOP）

```text
Use the approved [MONSTER_ID] neutral image as the exact first-frame
identity reference. Make ONE subtle idle animation, facing [DIRECTION]
for the entire clip.

Motion only: gentle breathing, slight body-weight shift,
subtle accessory sway. Feet remain planted; avoid wandering,
rotating or jumping. The last pose must transition seamlessly
back to the first pose.

Keep design, palette, proportions, weapon, outline and visual scale
unchanged. Locked camera, static flat [CHROMA_COLOR] background,
full subject always in frame.

No camera motion, extra actions, new props, scenery,
particles, glow, hit effects, shadows or text.
```

### 5.3 原地行走循环（WALK/RUN LOOP）

```text
Use the approved [MONSTER_ID] [DIRECTION]-facing anchor as the
exact first-frame identity reference.

Animate a clean, repeatable walk-in-place cycle:
left and right feet alternate, knees bend naturally,
body weight shifts slightly, arms and carried weapon counter-swing.
Keep the feet on a consistent implied ground plane.
Stay centered in the same frame, at the same scale.
The whole animation faces [DIRECTION] throughout.

The animation shows leg movement in place only; the game engine
will apply world-space movement. No traveling through depth.
Camera fully locked, background flat and unchanged,
all limbs and equipment visible.

Do not turn, yaw, grow, shrink, slide off-screen, invent limbs,
change equipment, add shadow, scenery, particles or text.
```

### 5.4 一次性普通近战攻击（MELEE ATTACK / ONE-SHOT）

```text
Use the approved [MONSTER_ID] [DIRECTION]-facing neutral/transition
pose as the exact identity and camera reference.

Create ONE short readable melee attack animation, ONE-SHOT:
1. Ready: balanced combat stance.
2. Anticipation: shift weight back, raise [WEAPON] clearly.
3. Swing start: rotate shoulders and accelerate the weapon.
4. Contact: one strong readable strike pose, weapon extended.
5. Follow-through: momentum carries the body slightly forward.
6. Recovery: return naturally toward the ready stance.

Use exaggerated but anatomically consistent poses.
Preserve exact identity, silhouette, proportions, palette,
weapon placement, outfit details and fixed [DIRECTION] facing.
Keep feet and full weapon inside the frame.
Locked camera, fixed scale, static solid [CHROMA_COLOR] background.
No camera movements or cuts.

Generate ONLY the character motion: no sword arc, hit spark,
explosion, particles, damage numbers, screen shake,
new weapons, extra limbs or additional creatures.
```

### 5.5 受击/死亡（HURT / DEATH, separated）

```text
Use the approved [MONSTER_ID] reference. Create ONE [HURT_OR_DEATH]
one-shot animation only. Keep the character facing [DIRECTION],
with camera, scale, design and palette locked throughout.

For HURT: a brief clear recoil and return toward combat-ready pose.
For DEATH: a readable collapse OR a short dissolve-ready pose sequence;
do not add spontaneous bright explosions.

Keep full silhouette within the frame and preserve identity.
Static flat [CHROMA_COLOR] background, no scenery or combat VFX.
```

### 5.6 单独生成精英怪击杀效果（VFX ONLY）

```text
Create an isolated 2D elite-enemy defeat VFX sequence for the
approved bright, clean cartoon fantasy game style.

Visual beats: brief concentrated golden emblem flash,
chunky readable energy fragments, fast outward burst,
quick decay into a few small particles.

The effect should feel rewarding but remain readable in
5-player co-op combat. Centered, no camera movement.
No enemy body, no player, no ground, no UI, no text.
Transparent background preferred.
Avoid full-screen white flashes, high-frequency flicker,
long-lasting bloom, noisy tiny particles or excessive screen coverage.
```

### 5.7 地图与装饰素材（ENVIRONMENT / NO HERO）

```text
Use the approved Style B living-ruins map reference as the
strict visual style, color and slanted-camera reference.

Create [MAP_ASSET_TYPE] for a clean 2D slanted-view action roguelite.
Bright nature-magic ruins, simplified cel-shaded shapes,
gentle atmospheric light and restrained texture.

Walkable ground must remain visually quiet, with broad even color,
subtle tile texture and clear obstacle boundaries.
Place decorative richness along non-walkable edges, water,
architecture, platforms, plants and distant background.

Match the camera projection and lighting direction of the approved
reference. Output separable/reusable scene elements where requested.

No heroes, no people, no animation storyboard, no combat VFX,
no UI, no labels and no dense decoration across the walkable floor.
```

## 6. 后处理：务必区分两套技术路线

### 路线 A：AI 逐张生成姿势 / 一张 Pose Sheet

- 原始素材可能存在主体位置、缩放、脚底线漂移；可测量 alpha bbox，确定**统一角色体型尺度和基准锚点**。
- 对中性待机帧/分开生成的不同 clip 进行尺寸归一化；保留攻击/跳跃本应存在的姿势变化，不得把每一帧的脚直接贴到同一底线而抹除真实动作。
- 网格切帧不要假定 AI 必然严格遵守单元格边界；必要时通过前景连通区与人工检查恢复姿势。
- 对齐只是补救，严重变形/错方向的帧应该拒绝重生成。

参考：AI Game Spritesheets `08-normalization.md`。

### 路线 B：锁定镜头的图生视频 → 抽帧（优先尝试）

- 使用固定画布的视频作为全部帧的空间坐标基准。
- 先**按顺序提取全部原始帧**，制作带编号 contact sheet，再选关键动作帧；不要盲目每 N 帧截一次。
- `preserve-canvas`：每帧同一原始画布、同一比例、同一贴图位置；统一裁切必须基于整段视频的**联合边界**，不能逐帧裁切/居中/脚底贴齐。
- 若原视频里角色原地漂移、换方向或缩放失真，优先重做视频，不靠逐帧平移强行修复。
- 循环素材检查首尾衔接；若终点与起点是完全重复帧，导入播放时通常移除多余最后一帧。
- 走路/待机使用 loop；攻击/死亡使用 one-shot。若视频模型把“同时给首尾同一张图”解释为静止或橡皮筋式回弹，调整生成约束；不要硬套此招。

参考：Layr Kits、Higgsfield 2D animation workflow。

### 通用导出建议（初期可调整，不是固定行业标准）

- 资源主格式：带真实 alpha 的 PNG / 帧图集；保留无损中间文件。
- 单帧尺寸：初期可测试 `256×256`；大精英怪可单独更大，不要靠生硬拉伸实现尺寸。
- 动画抽帧数起点：`idle 6–10`、`walk 8–12`、`attack 6–12`、`hurt 3–6`、`death 6–12`。
- 播放帧率要和**帧数**分别定义。初期可测试 10–16 FPS 的 Sprite 动画，具体以游戏内手感为准；不是越高越好。
- 每个 SpriteSheet 应有 `manifest.json`：实体 ID、动作 ID、方向、帧数、grid 行列、cell 尺寸、FPS、loop/once、脚底 pivot、帧文件顺序、关键动作时间/帧、源文件和 Prompt 版本。
- 建议限制单张图集在项目目标设备 GPU 可接受纹理尺寸内（例如首先按 4096 边长预算评估，必须对真实目标设备测试）；需要时拆 Atlas。
- 代码可在 Cocos 端使用 SpriteFrame 序列/AnimationClip 映射，但不得假设已经存在可直接使用的自动导入插件。

建议 manifest：

```json
{
  "entityId": "ruin_sprite",
  "clipId": "melee_attack_south",
  "direction": "south",
  "frameSize": [256, 256],
  "frameCount": 8,
  "fps": 12,
  "playback": "once",
  "pivotNormalized": [0.5, 1.0],
  "frameOrder": "row-major",
  "events": [{"type": "contact_visual", "frame": 4}],
  "source": {"mode": "video", "model": "<actual model/version>", "promptVersion": "v1"}
}
```

注意：`contact_visual` 仅表示视觉/音效配合的时机，**不是**权威判伤逻辑。联机状态下，命中判定由战斗系统/服务器决定。

## 7. 最小自动化工具和 QA 门禁

先检查仓库是否已有同类脚本；有则扩展，不重复造轮子。

### 候选工具

- `extract_frames`: FFmpeg/ffprobe 抽帧，输出源帧及 metadata。
- `contact_sheet`: 带帧号与时间戳的动画概览图。
- `select_keyframes`: 显式挑选关键帧，记录原始帧索引与动作节奏。
- `remove_background`: alpha 或纯色抠图；检查溢色和细小叶片/武器尖端。
- `pack_spritesheet`: 保持空间锚点、稳定格子尺寸，生成 SpriteSheet + manifest。
- `preview_animation`: 可循环/单播预览，包含实际游戏背景和实际角色缩放。
- `validate_asset`: 输出 JSON 报告，能标记但不能盲目自动修复形体漂移问题。

### 必须检查

- 文件存在、帧数一致、PNG 透明通道真实存在。
- 所有帧保留完整武器/肢体/叶片，非预期裁切或近背景色丢失需要报警。
- 方向不反转；镜头静止；角色没有突然尺度跳变。
- **画布稳定**：不能因为每帧中心/脚底重新计算导致角色在图集中抖动。
- 待机/跑步循环播放没有明显“停一下”或跳帧；一次性攻击可自然衔接待机。
- 接触帧明显可读；打击音效触发点接近动作接触时刻。
- 战斗怪物在实际镜头尺寸下可辨识；与地图颜色、地面杂纹对比足够。
- 五人同屏时控制闪光、音量峰值和粒子叠加；危险技能预警优先级高于普通击杀效果。

**失败时：**输出失败原因 + contact sheet/预览引用 + 建议重生成 Prompt；不要悄悄把所有失败动画标记通过。

## 8. 游戏打击感和音效建议（独立于 AI 角色动画）

- 普通近战攻击分层：挥击 whoosh → 命中 transient（短而脆）→ 材质反馈（木、石、护甲）→ 适度低频冲击。
- 精英怪击杀：独立、短促而有辨识度的“破裂 + 能量消散 + 标识音”，不依赖长时间满屏白闪。
- 连杀音效：建立 2～4 个递进层级，使用有限窗口和节流；不要让 5 人各自的所有连杀音效无控制地叠加。
- 特效：短暂蓄力、明确接触帧、快速爆发、迅速消失；hit-stop 仅谨慎用于本地表现，**不能停住权威服务器整个世界**。
- 无障碍与舒适性：提供粒子浓度、屏幕震动和闪光强度选项；避免高频闪烁。
- 如使用 AI 音效：每个效果生成时约束为 `isolated dry one-shot sound, no music, no speech, no long reverb tail, no layered ambient noise`，然后由代码按材质、距离、连击状态组合。

## 9. 建议项目文件组织（Codex 应适配现有仓库）

```text
art/
  STYLE_GUIDE.md
  refs/approved/                  # 人工批准参考图（不要自动覆盖）
  prompts/
    monster-anchor.md
    monster-idle.md
    monster-walk.md
    monster-melee-attack.md
    monster-hurt-death.md
    vfx-elite-defeat.md
    environment.md
  sources/                         # 原始图、原始视频、prompt、模型版本
  staging/                         # 未验收资产
  manifests/
  previews/
  qa-reports/

scripts/art/                         # 抽帧、接触表、背景处理、图集、校验
```

## 10. 第一个落地实验（只做一个怪物）

1. 选择用户当前已认可的普通遗迹怪物图作为**身份锚点**（未找到真实源文件时先请求/标记待补，不自行更换造型）。
2. 生成（或准备生成）`idle`、`walk`、`melee_attack` 三条独立 Prompt；锁同一朝向。先单方向成功，再扩展四方向。
3. 给 `walk` 优先尝试图生视频 → 全量抽帧 → 选帧 → preserve-canvas；给 `attack` 可以对比视频抽帧与 Pose Sheet 两条路线，选稳定的。
4. 输出 `idle/walk/attack` 的 contact sheet、SpriteSheet、manifest、运行预览，并记录 QA 结果。
5. 在实际 Cocos 镜头中展示，确认动作切换、帧锚点、角色尺寸、地面遮挡、音效事件是否正确。
6. 汇总：生成成本、可用帧比例、失败原因、可复用脚本；**只在验证通过后**再批量扩展怪物库。

## 11. Codex 完成此任务的交付要求

请优先交付：

- 现有工程检查结果与差异清单。
- 合并后的准则所在路径，以及与 `AGENTS.md` 的挂接方式（如适用）。
- 统一 Prompt 模板与可配置参数列表。
- 本次只列出现有工具、待实施工具、建议命令与验收方式；**不要把尚未实现的工具说成已完成**。
- 一个怪物的最小验证计划（经确认后再制作可运行成果）。
- 任何未经人工批准的风格变化、工具外部 API 使用、付费模型调用，必须先列为待确认事项；不直接执行。

最终标准不是“看起来像一张好看的 AI 图”，而是“在真实游戏尺寸、固定视角、多个怪物同屏时，动画稳定、风格一致、好辨认、可复用且容易维护”。
