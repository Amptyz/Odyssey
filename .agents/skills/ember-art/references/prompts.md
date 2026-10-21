# 美术生成 Prompt 模板

只读取并使用当前任务涉及的类型。以下为本项目自用模板，字段需要填成具体值；不在最终调用中遗留占位符。先实际查看参考图，明确哪个提供身份、哪个提供布局，哪个只是风格。新对象没有身份图时先按 brief 生成单体基图，经技术检查后复用，不假称已有人工批准。世界观以 [WORLD_LORE](../../../../docs/WORLD_LORE.md) 为准，风格以 [ART_DIRECTION](../../../../docs/ART_DIRECTION.md) 为准；旧批次提示词是历史记录。

## 公共块

```text
Use case: stylized-concept
Asset type: [runtime sprite / item icon / environment prop / animation frame group]
Request: [specific asset and intended gameplay role]
Inputs: image 1 is [identity or edit target]; image 2 is [style or layout reference].
Match the approved subject view and proportions. Upright props use a fixed
three-quarter view; ground assets follow Ember's equal-scale ground plane.
Dark, blood-marked fantasy after the extinction of a stolen primordial fire,
in deliberate pixel art: clear clusters, a controlled palette and stepped tones.
Keep medium-value environments readable, separate character silhouettes from
the ground, use pale ash/bone, cool charcoal and concentrated warm ember accents.
Blood (where appropriate for the subject) and charring form readable shapes,
not a noisy coating. The base PLAYER HERO is explicitly bloodless.
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
| run | `Run in place with forward lean, bent-elbow counter-swing, contact/compression, toe push-off and a clearly airborne phase. Both feet leave the fixed ground reference during flight; preserve vertical body movement. A full loop includes the opposite-leg stride too. Do not simply speed up walking or duplicate the same leg poses.` |
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

## 玩家整身序列帧

```text
Create complete full-body animation frames of the selected CHIBI Ember hero identity.
Large round bald head, very short stocky body, broad torso and stubby limbs.
Use an exclusive cool violet color ramp for dyeable cloth across all frames.
Keep skin warm ash-grey and the featureless face neutral charcoal, never using
the cloth ramp there. One atlas supports every player palette; do not make
separate red/blue/green character sheets. Match the selected chibi reference.
Long-dead ash-grey human, BALD, BLOODLESS, FACELESS: bare cranium,
uninterrupted charcoal shadow face; no eyes, nose, mouth, eyebrows, detailed
 ears or hair. No red wounds, helmet, mask or hood. Class-neutral simple wraps,
small dry amber chest ember, no carried weapon or purchased equipment.
Every cell contains ONE connected head, torso and all four limbs; natural
shoulders, elbows, knees, and coherent cloth. NO separated paper-doll parts.
Hold [facing] through [ordered action frames]; match body scale, palette and
pixel grid. Use [common ground origin / pivot]. Preserve airborne rise and
collapse; do not bottom-align, recenter or resize individual poses.
Keep full silhouettes inside cells with transparent gutters. Effects, shadows
and gameplay movement are separate. No weapon trails or projectiles baked in.
```

明确每行动作 / 朝向，不能用转身板充当移动循环。当前S、SE、E、NE、N五视角各8列；西侧三方向整图镜像。`HERO_CLIPS`控制播放；动作时长和空间策略见[动画契约](animation.md)。身份与动作一致性优先，返回布局必须实测；不以脚本重绘补救关节断裂。

## 主角形象概念

概念稿使用独立背景与版式，可以有正背面、特写、色板和游戏尺度示意；不要直接套用运行时公共块中的透明切片 / 现有比例限制。死亡细胞取向像素、无血无发无五官已确定；比例、服饰和火痕的具体安排由 brief 指定，不恢复首版的头发、眼睛和血迹。

```text
Create an original pixel-art concept sheet for a nameless dead human rekindled
by the last spark after the world's stolen fire was extinguished.
The playable corpse is distinct from the ancient hero who originally stole fire.
Selected direction: original Dead Cells-inspired authored pixel art.
The hero has been dead a long time: NO blood or raw red wounds, NO hair,
NO facial features. Bare ash-grey head, featureless dark shadow face;
no eyes, nose, mouth, eyebrows or detailed ears; no hood or mask.
Design details: [proportions, simple clothing, dry charring / small ember].
Keep the complete character class-neutral; purchased equipment does not change its image.
Use expressive poses, authored pixel clusters and clear material planes;
dark and visceral atmosphere with readable midtones, no underexposed black fog.
Show the SAME identity in [requested views, close-ups and scale vignette].
No unrequested armor, weapons, class emblems, extra limbs or permanent fire halo.
Label this as a concept, not a finished animation atlas or real gameplay capture.
```

使用 [已选Q版形象](../../../../art-source/rekindled-chibi-v1/README.md) 作当前身份与比例参考；旧批次只提供比较历史。方向与用户限制已确认，不把代理生成的细节记成用户逐项批准，也不把英文临时称呼当成正式设定。

## 装备物品图标

```text
Create ONE isolated [item] as a readable inventory/shop icon for Ember.
Use [build tendency] through one main silhouette and material accent.
Same dark pixel-art palette and restrained shading as the game.
No character, mannequin, hands, face, extra limbs, UI labels or background.
This is an ITEM ICON, not a wearable body part: no rig fitting, joint openings,
attachment pivots or directional character variants are needed.
```

装备不改变角色贴图；只注册商品图标，不恢复穿戴层或按购买顺序显示外观。

## 地图与环境

先读 [环境视角与地面度量](../../../../docs/ART_DIRECTION.md#环境视角与地面度量)。以下按素材选择对应句子，明确是直立物件还是地面资产；不能只写“isometric”让生成器自行套用2:1扁菱形地面。地面45°旋转不代表物件俯角也必须是45°。

```text
Create [individual environment element or requested concept view] for Ember.
Use a fixed-view 2.5D sprite presentation over an equal-scale gameplay ground.
Ashen medium-value ruins and traces of a lost golden age, adapted to the
specific location brief; cool grey light, limited warm fire and dark blood accents.
Keep traversable ground visible; deep black belongs to cavities and local shadows.
Use broad shapes and low-contrast seams; keep walkable surfaces visually quiet.
Upright props: show readable top and side faces from the approved three-quarter
view. Keep consistent apparent elevation and lighting across the set.
Preserve upright proportions and isolate one reusable element per specified cell.
Ground assets: equal distances in all ground directions have equal screen length.
A world-axis square appears as a rotated square with equal diagonals, not a
flattened 2:1 diamond. Ground circles remain circles; keep seams subtle.
No perspective convergence, distance-based shrinking, or vertically compressed map.
Asset class and target footprint: [ground / upright; world dimensions and display size].
Ground contact anchor and orientation: [explicit reference; already screen-oriented or not].
Occlusion plan: [base, upright silhouette and any separately rendered overhang].
Keep ground shadows separate from the prop PNG. State anchors and footprints
in the accompanying specification, never as drawn marks in the production image.
No hero, monster, UI, labels or combat effects.
```

概念图可以有场景背景；运行时独立素材需在公共块中指定真实透明。地图装饰不隐含碰撞，独特场景布置还要接地图与渲染代码。复用现有运行时环境图作比例参考，但旧图预绘的扁底座不作为新地面标准；不用复杂 AI 风格海报作为严格细节标准。不通过非等比拉伸整个场景、移动补偿或修改碰撞来迎合生成结果。

## 特效与技能贴图

```text
Create an isolated [specific effect] matching Ember's dark-fantasy pixel style.
Show [preparation / readable core / short burst / fast decay as appropriate].
Use [element palette plus distinct pixel shape], a short bright core, stepped trails
and grouped fragments. Keep decoration weaker than hostile warnings.
Logical pixel size, frames, lifetime and density: [PIXEL_VFX specification].
Effect role: [attack / skill / non-combat decoration].
For any attack or skill, use a clear contour matching the actual simulation
shape at each active phase: [shape, origin, facing, radius, angle, width,
safe gaps, movement and timing from the gameplay definition].
Show the whole currently effective area clearly, even when the brightest
weapon head moves within it. Do not imply a wider or smaller effective area.
Keep internal detail and fading trails subordinate to that readable boundary;
glow and feedback fragments must not create a false effective boundary.
Distinguish anticipation, active effect and expired residue. Feedback without
its own hit area stays anchored to the real event or affected unit.
Preserve the equal-scale footprint: circles stay circular, sectors keep their
angle. Do not squash gameplay boundaries to imitate painted perspective.
Non-combat environment, UI and cosmetic effects are exempt from the clear
contour / collision-matching requirement; soft glow, smoke and free contours
are allowed when they do not obscure combat information.
No body, weapon, enemy, map, ground shadow, UI, text or baked background.
Avoid full-screen flashes, high-frequency flicker, dense tiny particles,
long bright trails and persistent halos that obscure enemy warnings.
```

形态、色板、节奏与装饰预算遵循 [像素特效规范](../../../../docs/PIXEL_VFX.md)。当前 Graphics 与 PixelVfxView 的火 / 冰 / 挥击 / 护盾16帧短翻页并用，后者有24节点上限并避让危险边界，尚不是完整粒子编辑器或统一像素合成；新位图仍需实际生成、注册与画面检查。受击、刀光和弹体与角色动画分开，不用图片内的大小代替逻辑判定范围。
