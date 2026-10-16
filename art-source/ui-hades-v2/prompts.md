# Hades 图形气质 UI 候选 v2 制作记录

2026-10-16。基于用户“布局不错，画风老土，希望模仿《哈迪斯》风格”的反馈，只重做三个代表界面。原像素遗迹世界方向保持，UI 允许清晰高分辨率手绘图形表达。本批为候选静态效果图，未接入游戏。

## 工具与参考

工具：内置 `image_gen`（`tools.image_gen__imagegen`），每屏独立编辑一次，三屏并行。没有使用 CLI / API、付费外部服务、程序重绘或模型/seed猜测。实际参数为 `prompt`、`referenced_image_paths`、`transparent_background:false`。

风格参考：[Hades 官方游戏页](https://www.supergiantgames.com/games/hades/)（由主 agent 查阅）；借鉴图形设计气质，未拿官网截图或专有图形作为图像输入。图像输入只有本项目自己的 v1 候选，已逐张实际查看。

| 输出 | 编辑目标（项目内相对路径） |
| --- | --- |
| 01-combat-hud.png | [../ui-pixel-v1/01-combat-hud.png](../ui-pixel-v1/01-combat-hud.png) |
| 02-augment-choice.png | [../ui-pixel-v1/02-augment-choice.png](../ui-pixel-v1/02-augment-choice.png) |
| 03-shop.png | [../ui-pixel-v1/03-shop.png](../ui-pixel-v1/03-shop.png) |

这三张输入是布局与编辑目标，保留原有大区位置、信息与像素场景；UI 风格本身由下列文字描述重新设计，非颜色滤镜。

## 共用 Prompt 前缀

每次实际调用由此完整前缀与对应屏正文拼接；每屏仅引用自己的编辑目标。

```text
Use case: style-transfer
Asset type: ONE complete Chinese PC game UI screen, horizontal 16:9, target design 1280x720.
Input image 1 is EDIT TARGET and layout reference. Preserve the overall positions, sizes, information hierarchy, functional elements and original project characters. Keep the isometric world/character/background as PIXEL natural ancient ruins, keep gameplay action and objects unchanged. Do NOT turn the environment into a Greek temple or change the original game identity.
Primary request: The user likes the layout but finds the UI old-fashioned. Substantially redesign ONLY the overlay UI graphic language to evoke the sharp, high-contrast, hand-inked mythic action UI design sensibility of Hades. This must be a clear visual redesign, not just recoloring the original gold boxes black. Original characters and original game wording only, no Hades logo, Zagreus, Greek god portraits or copied proprietary UI graphics.
NEW UI visual system: charcoal black #151416 and blackened ink-purple #25212C broad flat shapes, bone-white #F2E6D4 type and occasional short sharp bone-white outline strokes, restrained vermilion #E64B32 and burnt orange accents, selective icy cyan #77D9DF or acidic pale green #C3DE75 for functional states. High-resolution sharply inked 2–3 tone illustrated UI icons, woodcut silhouette energy and confident negative space. Asymmetric clipped corners, wedge cuts, a few broad paint slash shapes, varying thick/thin contours, elegant but forceful titles and condensed bold numerals. The UI chrome does NOT need to be pixelated; pixel world and high-resolution hand-inked UI coexist intentionally. Clear exact Chinese typography.
DELETE old medieval-RPG vocabulary: all double gold rectangular borders, tiny floral corner curls, jewel bezels, leather/parchment panels, embossed bronze gradients, gold glow and brown metallic raised buttons. No dark gold repainting. No cyberpunk sci-fi HUD. Sparse muted warm line accents permitted, NOT outlining every box. Use flat panels with partial edges, graphic slash separators, clear typographic hierarchy.
Invariants: whole complete screen, no outside captions, no browser/device frame, no collage, no new gameplay systems, no payments or refresh costs, all important labels and numbers readable.
```

## 01-combat-hud 最终 Prompt 正文

```text
Specific screen: COMBAT HUD. Preserve center battlefield, people, enemies, pixel attacks and salmon enemy danger ellipse exactly. Keep top-left portrait/resources/stats grouping but remove its heavy rectangular gold frame; make a compact black ink-cut backing, clipped portrait silhouette, resource lines with pointed ends. Name "阿烬"; HP "生命 240 / 320" in vivid ember red, MP "法力 80 / 100" icy cyan. Four stats directly below "攻击 32" "法强 54" "护甲 18" "急速 10", bone-white little ink icons.
Top-center stage text MUST change to correct "余烬庭院 · 第 2 关", underneath "剩余敌人 6"; understated narrow black slashed banner. Top-right "金币 260", ESC/settings preserved but frame simplified. Left teammate mini panels 阿岚 / 青禾 / 石墨 and right buffs 燃烧弹 / 电弧 retain their locations and meaning.
Bottom-center EXACTLY FOUR skill cards Q W E R with sharply cut black/plum backplates and hand-inked high-contrast flat icons instead of antique gold frames: Q red fire projectile, W bone shield, E orange slashing dash silhouette, R red burst. Keep cooldown overlays "4.2" and "8.6" bold pale numerals. Correct labels EXACTLY "烬火弹" "琥珀护盾" "流火步" "余烬绽放". No changes to skill function. Bottom-left keep SIX universal numbered equipment slots 1–6: sword, armor, circlet, then three empty plus slots, angular matte backing. No potion icons. Bottom-right control hint preserved. Center remains open and readable; new UI visually light, decisive and contemporary, not large ornamental frames.
```

## 02-augment-choice 最终 Prompt 正文

```text
Specific screen: AUGMENT SELECTION. Preserve overall exact arrangement: heading top, THREE large equal cards in one horizontal row, existing build strip below, confirmation button bottom center, currency top right. Replace every old gold frame and ornamental corner with broad black/ink-purple clipped planes, partial bone-white strokes, slash separators and strong typography. Top title "选择增益", subtitle "三选一 · 本次选择将持续整局", currency "金币 260".
Card1 "燃烧弹" with new striking vermilion flat woodcut flame graphic; preserve "主收益 附加 3 秒灼烧" and "每秒造成 9 点伤害", bottom "联动 烬火弹".
Card2 "电弧" SELECTED, icy cyan graphic lightning, preserve "主收益 命中弹射 16 点电击", "范围 3.2 格 · 电击不再弹射", "联动 技能 / 爆炸". Selected state MUST be a bold diagonal cyan corner slash and small check with off-white header stripe, NOT bright gold outline or glow.
Card3 "迅捷步伐", acidic pale-green ink-cut winged boot, "主收益 移动速度 +15%", "灵活走位，便于躲避", "联动 所有构筑".
Below retain "当前构筑" and exactly FOUR QWER icons/names "烬火弹" "琥珀护盾" "流火步" "余烬绽放". Bottom "确认选择" is a wide FLAT vermilion graphic button with one clipped corner and bone-white words, no metallic embossing. "选择后等待队友", "队友进度 2 / 4 已选择" remain. Dimmed pixel ruins backdrop retained, no gods or large portraits. Dramatic hand-inked modern mythic game menu graphic style with ample breathing room.
```

## 03-shop 最终 Prompt 正文

```text
Specific screen: EQUIPMENT SHOP. Preserve overall original THREE-column layout: left 2x3 merchandise grid and category tabs; middle selected staff detail, before/after stats, purchase action; right character preview and six universal equipment slots; bottom team preparation strip and finish button. Pixel world and character preview untouched.
Header "遗迹商店", subtitle "第 2 关前 · 购买装备，调整构筑", currency "金币 260". Remove all gold box outlines, curled corner flourishes and embossed orange-bronze buttons. Use open charcoal flat sections, asymmetrical clipped top header tabs, narrow bone-white separators and occasional vermilion slash accents. Strong clear titles and confident whitespace. No intricate frame enclosing each item.
Left heading "装备货架", tabs "全部" "武器" "身体" "头部", 6 real equipment item icons and labels "赤铜长剑" "星辉法杖" "猎风长弓" "赤铜胸甲" "奥能头环" "壁垒重盾", each "100 金币". Redraw item icons as original clean hand-inked woodcut forms with flat shades while retaining identities. Select 星辉法杖 by pale icy-cyan header strip plus clipped accent at top corner, no gold glow.
Middle selected "星辉法杖", "100 金币", "法术强度 +30", "技能急速 +10", "普攻：魔法弹 · 射程 6.5". "购买后预览", "法强 24 → 54", "急速 0 → 10", use acidic pale green gains. "购买装备" FLAT vermilion clipped button, "购买后余额 160".
Right "我的装备", "2 / 6 已装备", "任意栏可放任意类型"; keep original neutral pixel adventurer preview, SIX numbered slots in 2 rows x3, sword and armor then four empty plus slots. No class locks, no fixed weapon/body binding. Bottom "队伍整备 2 / 4" and "完成整备" clean bone-white on black with small vermilion wedge. Preserve all functions, no new discounts or currencies. Visual identity sharp and graphic, distinctly different from antique RPG gold rectangles.
```

## 04-combat-hud-refined 定向精修 Prompt

追加一次内置 image_gen 编辑，以已实际查看的 `01-combat-hud.png` 为编辑目标。主 agent 审阅发现初试红黑抓痕过密、气质偏漫画涂鸦，因此定向降低装饰密度；保留 01–03 初稿，不覆盖。

```text
Use case: precise-object-edit
Asset type: refined complete Chinese PC game combat HUD, original Project Ember, horizontal 16:9.
Input image 1 is EDIT TARGET. Keep the EXACT overall layout, pixel-art world, all characters, enemies, attacks, danger warning ellipse, camera and bright background exposure unchanged. Preserve all functional information, numbers, player and team positions, SIX universal equipment slots and FOUR QWER abilities. No scene repainting. Change only UI graphic styling.

Goal: refine toward the sophisticated mythic hand-painted interface design sensibility of Hades / Supergiant Games. The current image overuses jagged red-black comic graffiti and feels like Persona 5. Remove at least 80 percent of red scratch marks, torn-paper teeth, paint splatters, zigzag fringes, rough brush flashes and the large red flame border behind the portrait. NO graffiti, punk comic, military, cyberpunk or screen-wide slashes.

NEW graphic language:
75 percent of each black interface surface is CLEAN quiet obsidian / deep ink-purple slate, matte flat depth with just 2–3 subtle shade planes. Strong elegant silhouette built from a few long knife-cut planes, with one or two asymmetrically clipped corners, NOT every edge shredded. The top-left backing remains same general location/scale but feels lighter and more composed; portrait small and calm, framed by a simple original spearhead or leaf notch, NO fiery halo.
Use extremely restrained irregular fine cream-gold or bone-white metal inlay at SELECTED corners and short separators, not double rectangular gold boxes. A few abstract original laurel-leaf, spear-tip or small symmetrical rune nodes as delicate focal accents only, never literal copied Hades ornaments. Hand-painted mythic stone-cut elegance with crisp flat artwork, elegant but forceful typography and numerals. NOT brown/gold MMORPG embossed metal or jewel frames.
Vermilion ONLY where function needs emphasis: HP fill, one active/selected corner, two or three tiny markers. Ice cyan MP. Bone-white text. Restful blacks surround functional icons. Bottom skill backplates should be calm obsidian/slate with subtly uneven thin bone-white/cream-gold rim strokes and a single angular corner accent. Icon interiors may retain orange fire and cyan elements. Keep cooldown dimming and bold numbers readable. Remove almost all red perimeter strokes from top stage, coins, teammates, right buffs, bottom equipment and controls.

Exact invariants and Chinese labels:
Top-left nickname "阿烬", "生命 240 / 320", "法力 80 / 100"; stats "攻击 32", "法强 54", "护甲 18", "急速 10".
Top-center correct map "余烬庭院 · 第 2 关", "剩余敌人 6". Top-right "金币 260", ESC and settings.
Left 3 teammate rows 阿岚 / 青禾 / 石墨, green online dots and HP.
Right buffs 燃烧弹 / 电弧.
Bottom FOUR distinct Q W E R with names EXACTLY "烬火弹" "琥珀护盾" "流火步" "余烬绽放"; W cooldown "4.2" and R "8.6"; keep original icon meanings.
Bottom-left exactly six universal equipment slots numbered 1–6, sword/armor/circlet then 3 empty plus.
Bottom-right control hint "右键移动 · 左键普攻 · Q W E R 施法".
No external IP character, no Hades logo or Greek god portrait. Original project content only. Preserve the pixel world and bright exposure; refinement is UI-only. Full complete screen, no outside captions, no cropping.
```

实际返回源文件：`exec-e32e5ef7-bb9a-48ad-8b99-934c2dad70af.png`，复制为 `04-combat-hud-refined.png`。同目录来源与尺寸详见 README。

## 来源与验收

真实工具返回来源和最终自检见 [README](README.md)。原始文件留在工具默认 generated_images 下，最终 PNG 复制至本目录；没有覆盖 v1、重采样、裁切或拼接。场景像素与UI高清图形混合是本轮用户授权方向，不表示世界素材取消像素规范。

