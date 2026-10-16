# UI 像素候选制作记录

日期：2026-10-16。来源：内置 `image_gen`（`tools.image_gen__imagegen`），不是 CLI/API。生成参数仅使用实际可用的 `prompt`、`referenced_image_paths` 和 `transparent_background:false`；未指定或猜测模型、seed、质量档。每屏一次独立调用；HUD 另一次定向修正。

所有输出实测 1672×941。1280×720 为提示词设计目标，未缩放、裁切、拼接或程序重绘。复制到本目录后用于评审，未接入 Cocos。

内置工具返回源目录：`C:\Users\Administrator\.codex\generated_images\01a144af-9769-7933-b64a-6dcdf3c23a7d\`（本机审计来源，不是项目运行时依赖）。所有最终成果均已复制进工作区。

## 来源索引

| 交付 | 工具返回源文件 | 参考 |
| --- | --- | --- |
| 01-combat-hud.png | `exec-51f861fb-337a-4fc4-8593-41a897182a15.png` | 无图输入 |
| 02-augment-choice.png | `exec-17140330-48ca-4864-9457-8d6baf5cbcfc.png` | 01-combat-hud 首次输出，仅风格参考 |
| 03-shop.png | `exec-497faee1-089d-4082-91f7-a59639c6d361.png` | 01-combat-hud 首次输出，仅风格参考 |
| 04-main-menu.png | `exec-e4ac9b93-04f6-471b-ba67-cd49c4295c1e.png` | 01-combat-hud 首次输出，仅风格参考 |
| 05-create-room.png | `exec-f8bb3afc-4208-48cf-9605-c7545a4d3020.png` | 01-combat-hud 首次输出，仅风格参考 |
| 06-join-room.png | `exec-b4b309db-55e3-4527-af28-3c1112bc7224.png` | 01-combat-hud 首次输出，仅风格参考 |
| 07-room-lobby.png | `exec-a525c95c-19e6-4b42-82d0-c5c9e156d77a.png` | 01-combat-hud 首次输出，仅风格参考 |
| 01-combat-hud.png 最终修正版 | `exec-833d6a38-ba20-4fef-bd0e-b5d30446f9f8.png` | 原 HUD，定向编辑装备栏及标签 |

首次HUD留存在 [sources/01-combat-hud-before-equipment-fix.png](sources/01-combat-hud-before-equipment-fix.png)。参考图已实际查看；后续图以首屏为风格参考，非保留布局的编辑目标。

## 01 原始生成 Prompt

```text
Use case: ui-mockup
Asset type: single complete game screen, pixel-art candidate UI for Project Ember, Chinese title 余烬试炼.
Primary request: Generate ONE finished 16:9 landscape combat HUD mockup, target design viewport 1280x720. No contact sheet, no annotations outside screen, no browser frame. Practical playable pixel game UI, not concept art poster.
Style/medium: deliberately designed native low-resolution pixel art: chunky coherent pixel clusters, crisp regular stair-step edges, flat hard 2–3 color shade ramps, no antialiasing, no fuzzy light bloom. UI dark petrol teal #17343A panels, ivory #F0E6CD text, restrained copper-gold #BC965A thin stepped borders, warm ember orange HP, icy cyan MP, muted moss green success. Angular concise buttons and generous padding. Clear readable Chinese font may be smooth; visual art and chrome pixelated. No ornate carving, rounded mobile UI, photorealism, painted cartoon, neon cyberpunk or external IP.
Scene/backdrop: bright quiet isometric pale-stone ancient courtyard, sparse moss and plants at edges, shallow aquamarine pools, three-quarter view small neutral short-haired adventurer with interchangeable simple tunic equipment; a few distinct stone-and-leaf enemies. Player at center and readable salmon outlined enemy danger ellipse off to one side. Short discrete orange and blue square-pixel projectile sparks, no effects obscuring player feet or danger area. Calm open center occupies 65 percent of screen.
Composition: compact top-left character resource panel with small portrait and name 阿烬, segmented horizontal orange HP bar labeled "生命 240 / 320", blue MP bar labeled "法力 80 / 100". Beneath, compact stat row with four easily read icons and values "攻击 32", "法强 54", "护甲 18", "急速 10". Top center small stage banner "苔光庭院 · 第 2 关" and "剩余敌人 6". Top-right compact "金币 260" and ESC gear. Small unobtrusive left teammate list 阿岚, 青禾, 石墨, each mini HP and connection dot, no invented class. Small right edge buff strip with icons labeled "燃烧弹" and "电弧".
Bottom center exactly FOUR generously spaced square ability slots Q W E R, crisp pixel ability icons and legible names: Q 烬火弹 (ready), W 琥珀护盾 (dark cooldown overlay with large "4.2"), E 流火步 (ready), R 余烬绽放 (dark cooldown overlay large "8.6"). Distinct keyboard badges. Bottom-left six small equipment slots numbered 1–6, not fixed body slots. Bottom short control hint "右键移动 · 左键普攻 · Q W E R 施法". Use crisp clear correctly spelled Chinese labels, high contrast and no extra gibberish. Each described UI element visible in full; entire full screen composition.
```

## 02–07 共用前缀

每次实际发送的是以下前缀 + 对应屏幕正文；每屏均引用首次 HUD 实际本地路径，且为独立输出。

```text
Use case: ui-mockup
Asset type: ONE single full-screen candidate for Chinese PC co-op action game 余烬试炼, 16:9 landscape, target 1280x720 design viewport. No collage, contact sheet, captions outside screen, browser/device frame or watermark.
Input image 1 is STYLE REFERENCE ONLY: preserve its dark petrol teal panels, ivory clear Chinese typography, restrained thin copper-gold stepped borders, pixel icon and pixel isometric ruins aesthetic. Make an entirely NEW screen with the layout described below, not the reference combat UI. All seven screens belong to one game.
Style: native deliberate pixel clusters, crisp regular stepped silhouettes, limited hard-shaded flat palette, 2–3 shade steps per material. Bright pale-stone natural ancient ruins and quiet aquamarine water, simple moss plants at edges, no lavish ornate carving or dense texture. Chinese labels large and exact, high contrast, generous whitespace. Angular concise UI, no rounded mobile popups, no painterly or photorealistic art, no antialiasing or blurry bloom. All human avatars are neutral customizable adventurers; no fixed classes.

```

## 02-augment-choice

```text
Primary request: full screen selecting a post-combat augment. Muted and dimmed pixel courtyard behind a large orderly selection panel occupying middle 85 percent. At top centered title "选择增益" and subtitle "三选一 · 本次选择将持续整局". Top-right small "金币 260". Three equally sized LARGE cards in one horizontal row with generous text, each has unique pixel icon, name, two clear benefit lines and bottom synergy tag. Cards:
1 orange flame icon, "燃烧弹"; "主收益  附加 3 秒灼烧"; "每秒造成 9 点伤害"; tag "联动  烬火弹".
2 ice-blue lightning icon, "电弧"; "主收益  命中弹射 16 点电击"; "范围 3.2 格 · 电击不再弹射"; tag "联动  技能 / 爆炸".
3 moss-green boot icon, "迅捷步伐"; "主收益  移动速度 +15%"; "灵活走位，便于躲避"; tag "联动  所有构筑".
Middle card selected with thin gold edge and small check, others no huge glow. Beneath cards one orderly current-build strip "当前构筑" followed by four small Q W E R icons labeled "烬火弹" "琥珀护盾" "流火步" "余烬绽放". Bottom centered primary button "确认选择", secondary text "选择后等待队友". Small footer "队友进度  2 / 4 已选择". No reroll, no paid currency, no refresh cost, no arbitrary rarity system. Keep panel legible, no huge illustrations displacing text.
```

## 03-shop

```text
Primary request: full screen intermission equipment purchase shop. Full functional desktop layout, header "遗迹商店", subheader "第 2 关前 · 购买装备，调整构筑", top-right coin icon "金币 260". Content split 3 columns: left 45 percent catalog, middle 30 percent selected item details, right 25 percent character and six universal equipment slots. Catalog header "装备货架" with compact tabs "全部" "武器" "身体" "头部"; clean 2-column 3-row item grid with six actual equipment pixel icons and names each "100 金币": "赤铜长剑", "星辉法杖", "猎风长弓", "赤铜胸甲", "奥能头环", "壁垒重盾". Star staff card selected with gold edge.
Detail panel heading "星辉法杖", large pixel staff icon, "100 金币", exactly readable short lines "法术强度 +30", "技能急速 +10", "普攻：魔法弹 · 射程 6.5". Comparison table title "购买后预览", rows "法强 24 → 54" and "急速 0 → 10". Large copper primary button "购买装备", beneath "购买后余额 160". No arbitrary discount or selling price.
Right panel title "我的装备", small neutral character preview wearing simple equipment, SIX equal universal square slots arranged 2 rows of 3 numbered 1–6, first has sword second tunic remaining empty plus sign. Label "2 / 6 已装备" and helpful note "任意栏可放任意类型". No fixed class or fixed weapon/armor slot binding. Bottom full width team progress "队伍整备 2 / 4" with primary button at right "完成整备". Clear detail reading and price hierarchy, no dense text or overlapping panels.
```

## 04-main-menu

```text
Primary request: full screen game main menu. Title "余烬试炼" large elegant angular ivory Chinese text at upper left, smaller "PROJECT EMBER" below. Left 38 percent contains a calm vertically stacked menu of wide concise buttons: highlighted copper primary "单人试炼", secondary "创建房间", secondary "加入房间", small quiet "设置". At lower left small text "自由搭配技能与装备 · 最多 4 人合作". Right 62 percent displays attractive original PIXEL ART game world: spacious bright pale-stone isometric ruined courtyard with a compact ancient arch, moss growing in a few clumps, quiet blue water beside paths, four small neutral adventurers gathering near arch wearing varied interchangeable simple tunics, copper or ice accents, no fixed classes. Big restful shapes, deliberate low-resolution pixels, no lush painted detail. A few tiny square ember particles near ancient arch only, subtle anticipatory mood. Lower right small unobtrusive "像素遗迹 · UI 方向 A". Entire composition is a functional entry screen, not a promotional poster, no login, battle pass, store, gems or unsupported multiplayer matchmaking.
```

## 05-create-room

```text
Primary request: full game Create Room screen. Restrained pixel ruins backdrop with readable dark teal content card slightly left of center, clear stepped gold border, top-left "← 返回", top header "创建房间". Form content: visible label "你的昵称" then broad input with exact value "阿烬", helper "队友将看到这个名字"; next non-editable information row "合作人数  最多 4 人"; next row "房间码  创建后自动生成". Primary large gold button "创建并进入房间". Bottom of card folded accordion line "▸ 高级连接设置" containing NO visible technical address. To right, quiet pixel illustration of four stepping-stone platforms around ancient aquamarine portal; one small neutral adventurer, three empty faint slots. Descriptive concise line "邀请好友，共同穿越遗迹". Bottom small privacy-neutral help "创建后复制房间码发给好友". No passwords, account sign-in, payment, class pick, map voting, unsupported privacy switch or invite URL. Clear hierarchy and legible Chinese, entire full screen and all fields visible.
```

## 06-join-room

```text
Primary request: full game Join Room screen, matching create room screen's composition, restrained natural pixel ruins backdrop and dark teal form panel. Top-left "← 返回", header "加入房间". Form: label "你的昵称", input exact "青禾"; label "六位房间码", big input showing SIX separate legible glyph boxes "K" "7" "M" "4" "P" "X" as one 6-character value K7M4PX; helper "向房主索取房间码". Full-width primary button "加入房间". Below visible calm status "等待加入" with tiny neutral connection dot. Folded accordion "▸ 高级连接设置" with no technical endpoints visible. Small secondary action "从该房间进度续玩" and concise help "原队友可从最近保存点创建新房间". Right side quiet pixel portal entrance and two small neutral adventurers, no classes. No server browser, matchmaking, unsupported passwords, accounts or purchase. All Chinese crisp, visual grouping practical, no random text.
```

## 07-room-lobby

```text
Primary request: full screen co-op room lobby waiting to start. Dark petrol teal content panels over bright soft-contrast isometric pixel ruins courtyard. Top-left "← 离开房间". Large header "队伍集结". Header right big room label "房间码 K7M4PX" and small outlined button "复制房间码". Subheader "3 / 4 人 · 等待队友加入". Middle exactly FOUR equal vertical member cards in a single horizontal row, numbered 1 2 3 4. Card1 name "阿烬（你）", clear crown badge "房主", visible neutral short-haired adventurer with tunic and small copper weapon, green connection dot "在线". Card2 name "青禾", different neutral adventurer with simple cloak, green dot "在线". Card3 name "石墨", third simple equip-compatible avatar slightly dim, amber connection icon and "等待重连". Card4 empty outlined silhouette and big plus mark, label "空位", small "等待好友加入". No role lock, no mage/warrior classes. Under cards left compact information strip "起始地图  苔光庭院", "最多 4 人合作", "开始后仅原成员可重连". Bottom-right large primary button "开始试炼", above it modest text "等待石墨重连后开始" so disabled button visual and amber wait state clear. Bottom-left secondary "复制房间码" may be omitted if already top. Do not add ready toggles or map voting. No chat textbox, no premium cosmetics, no server endpoint. Ensure all 4 cards fit with generous whitespace, exact readable Chinese.
```

## 01 定向修正最终 Prompt

```text
Use case: precise-object-edit
Asset type: single Chinese game combat HUD mockup.
Input image 1: edit target, original full-screen combat HUD. Preserve the entire scene composition, panel positions, characters, pixel style, palette, 16:9 full-screen framing, HP/MP and all existing stats, countdowns, stage, coins and teammate labels.
Change ONLY these two specific issues:
1. In the bottom-left six numbered equipment slots, replace the existing potion/material icons with correct EQUIPMENT: slot1 small copper sword, slot2 simple copper chest armor, slot3 blue crystal circlet; slots4,5,6 empty clean dark teal squares with subtle plus signs. Keep exactly SIX slots numbered 1 2 3 4 5 6. These are universal equipment slots, not consumables, no fixed-type labels.
2. Carefully redraw the bottom skill names in clean readable Chinese type exactly as written: under Q "烬火弹", under W "琥珀护盾", under E "流火步", under R "余烬绽放". The character 烬 is 火 plus 尽, not 煜, not 焻. Preserve all four icon images, Q W E R labels, and countdowns 4.2 and 8.6. Also top-left player nickname exactly "阿烬". Clear typography can use a normal Chinese font for exact glyphs; do not use invented pseudo-Chinese. Keep everything else unchanged.
```

## 检查与局限

七图逐屏查看，覆盖用户要求的全部屏幕；确认HUD四技能CD、商店六通用装备栏、房间六位码、四队员卡与连接/等待状态。首次HUD错误消耗品占位已修正。未继续无限重试中文生成字形；地图提示词错误“苔光庭院”应为真实配置的“余烬庭院”，少量“烬 / 绽 / 垒”及04右下标记仍有字形瑕疵。背景景深与装饰密度不视为生产像素基准。数值和价格为示例，MP、独立全屏房间流程、重连开始门槛均按 [UI_DESIGN](../../docs/UI_DESIGN.md) 的边界说明。无游戏代码修改、用户定稿或实机验收声明。

