# 美术生成 Prompt 模板

只读取并使用当前任务涉及的类型。以下为本项目自用模板，字段需要填成具体值；不在最终调用中遗留占位符。先实际查看参考图，明确哪个提供身份、哪个提供布局，哪个只是风格。新对象没有身份图时先按 brief 生成单体基图，经技术检查后复用，不假称已有人工批准。

## 公共块

```text
Use case: stylized-concept
Asset type: [runtime sprite / modular equipment / environment prop / animation frame group]
Request: [specific asset and intended gameplay role]
Inputs: image 1 is [identity or edit target]; image 2 is [style or layout reference].
Match the existing Project Ember three-quarter gameplay view and proportions.
Bright living ruins in deliberate pixel art, broad readable pixel clusters,
a shared limited palette, two or three hard-edged shades per material,
clean stepped warm-dark outlines, restrained surface detail.
Logical canvas: [width x height source texels]; palette: [palette reference].
Grid origin: [origin]; display: [integer design-pixel scale after sample check].
No antialiasing, soft gradients, blur, photo textures or faux pixel filter.
Keep the subject readable at [actual in-game display size].
Use true transparent alpha outside the asset. No ground shadow, scenery,
labels, watermark, grid lines, checkerboard backdrop, or background halo.
Preserve [identity invariants]. Keep [all relevant silhouette extremes] inside
the canvas with [specified transparent padding].
Avoid dense engravings, tiny leaves, veins, scratches and photoreal textures.
Output layout: [actual requested columns, rows, ordered contents and target size].
```

实际编辑现有图时将 Use case 改为合适的 edit 类型，如 `precise-object-edit`，明确“只改什么、哪些位置 / 颜色 / 部件不动”。逻辑画布与目标尺寸是生成请求，不保证返回值；接入前测量真实网格、像素簇、色板和显示倍率。高分辨率输出即使放大后可见方格也不等于像素成品；修正制作或在当前工具授权范围内处理并记录网格映射，不能仅缩小旧图后宣称重制。镜头参数以实际参考为准，不擅自指定一个与原画不同的角度。

## 怪物身份图与动作

身份图在公共块中补充一个完整、非战斗中性姿势，以及面具、叶团、武器等主要识别点。一次只生成一只怪物；参考已经清楚时不要给它添加新配饰。

生成每个动作时复用同一身份图，加下面的动作块。将动作阶段映射到所需帧数；这些描述不强制生成视频，也不自动赋予游戏相应状态。

| 动作 | 可直接使用的动作块 |
| --- | --- |
| idle | `Subtle breathing and weight shift. Feet planted. Small leaf or accessory motion only. Continuous loop, no wandering, turning or extra action.` |
| walk | `One complete walk-in-place cycle. Alternate left and right strides with passing poses, modest counter-swing. Fixed implied ground plane; world movement is applied by the game.` |
| melee attack | `One attack: pull the weapon back, readable anticipation, decisive strike, follow-through and recovery toward ready. Clear pose changes, no extra attack.` |
| ranged cast | `One cast: prepare the casting limb or implement, release gesture, then recover. The projectile is rendered separately; do not paint it into body frames.` |
| hurt | `One brief recoil, then recover toward the ready stance. Keep the same weapon and facing. No involuntary turn or new wound decoration.` |
| death | `One readable collapse into a resting pose, preserving recognizable body materials. Do not stand back up, loop, or add a bright explosion.` |

```text
Use the supplied [identity image] for this exact subject.
Create ONLY [action] facing [reference-relative screen direction].
[Selected action block, with the exact ordered poses for this frame group.]
Keep camera position, zoom, facing, body scale, limb count, palette,
mask/face, weapon and foliage shapes, palette ramps and pixel grid consistent throughout.
Use a common logical canvas, integer source offsets and unchanged body scale.
No subpixel antialiasing or randomly changing single-pixel noise.
Allow the intended pose changes; do not resize each pose to the same bounding box.
The full weapon and silhouette remain within each frame.
No camera motion, cuts, extra actions, added limbs, new equipment,
sword arcs, projectiles, impact sparks, ground rings or damage numbers.
Background and grid: [true alpha and measured target layout].
```

视频路线使用同样的身份与动作约束，但把网格要求替换为单个固定画布、所需时长和工具实际支持的参数；不要要求视频模型生成图集网格。视频不支持 alpha 时，明确改用与主体颜色不冲突的纯色底，并记录后续处理；树叶怪不能无脑用绿幕。接入前阅读 [动画与坐标契约](animation.md)。

## 玩家部件

```text
Create [named paper-doll parts] matching the existing neutral Ember hero.
Ordinary short hair, simple friendly face, plain ivory-grey short tunic,
muted taupe trousers and charcoal soft boots. No fixed class identity.
Match the existing torso, head and limb proportions exactly.
One isolated part per specified cell; no complete dressed characters.
Rounded joint ends overlap under the torso clothing; keep shoulders and palms
compatible with the existing rig. Screen-left/right labels describe the
unmirrored assembled character; do not include these labels in the image.
No permanent armor, robe, hat, cape, emblem, weapon or magic aura.
```

现有部件能用时不重新生成。单纯手错位先检查左右部件、肩轴、掌心与遮挡，不以重画人物代替定位问题。

## 装备与换装

```text
Create ONE isolated [weapon / body armor / headgear] for the existing Ember hero.
Use the supplied assembled hero as a proportion and fitting reference only;
do not paint the hero, a mannequin, skin, face, extra hands or legs into this asset.
Express [build tendency] through [one main silhouette or material feature].
Keep the same three-quarter perspective and low-detail shading.
[Weapon: expose a clear physical grip at the specified position.]
[Body: fit the current torso and cover shoulder joins without embedding limbs.]
[Head: leave the face aperture truly transparent so the base face shows through.]
The item must work with equipment from other build tendencies.
```

只保留匹配槽位的句子。设计目标可给握点草案，但实际 anchor / grip 必须在返回图上测量。盾目前占武器槽，新副手不能仅靠生成图片实现。

## 地图与环境

```text
Create [individual environment element or requested concept view] for Ember.
Ivory ancient stone, sage foliage, calm teal water and restrained warm accents.
Use broad shapes and low-contrast seams; keep walkable surfaces visually quiet.
For props, isolate one complete reusable element per specified cell.
For ground tiles, match the current isometric ground projection and make seams
subtle; do not add dense grass, cracks or bright decoration to every tile.
No hero, monster, UI, labels or combat effects.
```

概念图可以有场景背景；运行时独立素材需在公共块中指定真实透明。地图装饰不隐含碰撞，独特场景布置还要接地图与渲染代码。复用现有运行时环境图作比例参考，不用复杂 AI 风格海报作为严格细节标准。

## 特效与技能贴图

```text
Create an isolated [specific effect] matching Ember's bright pixel-ruins style.
Show [preparation / readable core / short burst / fast decay as appropriate].
Use [element palette plus distinct pixel shape], a short bright core, stepped trails
and grouped fragments. Keep decoration weaker than hostile warnings.
Logical pixel size, frames, lifetime and density: [PIXEL_VFX specification].
Use hard-edged pixel clusters and discrete fading steps, without soft bloom.
Keep the actual direction and core boundary clear at gameplay scale.
No body, weapon, enemy, map, ground shadow, UI, text or baked background.
Avoid full-screen flashes, high-frequency flicker, dense tiny particles,
long bright trails and persistent halos that obscure enemy warnings.
```

形态、色板、节奏与装饰预算遵循 [像素特效规范](../../../../docs/PIXEL_VFX.md)。现有 Graphics 可作结构参考，尚不是统一像素粒子系统；用户要求新位图特效时生成真实素材并说明接入需要。受击、刀光和弹体与角色动画分开，不用图片内的大小代替逻辑判定范围。
