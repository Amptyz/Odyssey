# 怪物与装备设计草图册

本批按当前配置覆盖 17 种怪物和 18 件装备。制作范围是设定与动作 / 技能草图，不是运行时图集或已接入动画。怪物三视图用于造型参考，不代表新增运行时转向能力。

共 22 张设计板：装备 3 张、怪物本体 17 张、Boss 完整技能 2 张。可下载 [22 页 PDF 草图册](../../output/pdf/ember-design-sketchbook.pdf)，或在下方逐张查看 PNG；精确形状与时序见 [战斗配置核对表](combat-notes.md)。

风格：像素遗迹的清楚轮廓与硬边色阶，沿用象牙石、鼠尾草、霜青配色；页面采用精简的现代图形排版。技能图参考当前放大后的攻击配置，图中文字与实际数值以本目录 manifest.json 为准。

## 装备图标

18 个图标按类别放在三张 3×2 设计板上，阅读顺序为从左到右、从上到下。这里只交付图标设计，不含穿戴三视图。

### 武器

![武器六图标](equipment/weapon-icons.png)

| 位置 | ID | 名称 |
| --- | --- | --- |
| 第1行 第1列 | `sword` | 赤铜长剑 |
| 第1行 第2列 | `staff` | 星辉法杖 |
| 第1行 第3列 | `bow` | 猎风长弓 |
| 第2行 第1列 | `bulwark` | 壁垒重盾 |
| 第2行 第2列 | `reaver` | 饮烬短刃 |
| 第2行 第3列 | `runeblade` | 符刻刃 |

### 衣甲

![衣甲六图标](equipment/body-icons.png)

| 位置 | ID | 名称 |
| --- | --- | --- |
| 第1行 第1列 | `plate` | 赤铜胸甲 |
| 第1行 第2列 | `robe` | 星纹法袍 |
| 第1行 第3列 | `leather` | 游侠皮衣 |
| 第2行 第1列 | `duelistVest` | 逐风轻甲 |
| 第2行 第2列 | `wardMantle` | 回响石披 |
| 第2行 第3列 | `sanguineWrap` | 烬纹裹衣 |

### 头饰

![头饰六图标](equipment/head-icons.png)

| 位置 | ID | 名称 |
| --- | --- | --- |
| 第1行 第1列 | `helm` | 壁垒战盔 |
| 第1行 第2列 | `circlet` | 奥能头环 |
| 第1行 第3列 | `hood` | 猎风兜帽 |
| 第2行 第1列 | `keenVisor` | 棱光面罩 |
| 第2行 第2列 | `sageMask` | 裂纹石面 |
| 第2行 第3列 | `aegisCrown` | 苔石冠 |

## 怪物三视图、动作与技能

每只包含正面 / 侧面 / 背面，待机 / 两个行走关键姿 / 受击 / 死亡，普攻起手 / 出手 / 恢复，以及独立的预警和效果研究。精英增加专属技能；Boss 另有完整技能页。图中比例是造型研究，不从贴图推导受击体积。

### 01 苔刃精灵 · `melee`

![苔刃精灵三视图与动作](monsters/01-melee.png)

普攻：`mossJab`；类别：normal；地图：ember。

### 02 雾灯精灵 · `ranged`

![雾灯精灵三视图与动作](monsters/02-ranged.png)

普攻：`mistPearl`；类别：normal；地图：ember。

### 03 石背甲虫 · `stoneback`

![石背甲虫三视图与动作](monsters/03-stoneback.png)

普攻：`carapaceSweep`；类别：normal；地图：ember。

### 04 芦枪侍从 · `reedLancer`

![芦枪侍从三视图与动作](monsters/04-reedLancer.png)

普攻：`reedThrust`；类别：normal；地图：ember。

### 05 日芽投手 · `sunbud`

![日芽投手三视图与动作](monsters/05-sunbud.png)

普攻：`sunSeed`；类别：normal；地图：ember。

### 06 霜叶精灵 · `frostling`

![霜叶精灵三视图与动作](monsters/06-frostling.png)

普攻：`frostNeedle`；类别：normal；地图：frost。

### 07 镜壳蟹 · `shardCrab`

![镜壳蟹三视图与动作](monsters/07-shardCrab.png)

普攻：`pincerCross`；类别：normal；地图：frost。

### 08 霜纱蛾 · `rimeMoth`

![霜纱蛾三视图与动作](monsters/08-rimeMoth.png)

普攻：`mothFan`；类别：normal；地图：frost。

### 09 铃冠哨兵 · `chimeSentry`

![铃冠哨兵三视图与动作](monsters/09-chimeSentry.png)

普攻：`chimeDart`；类别：normal；地图：frost。

### 10 霜足跳兽 · `snowHare`

![霜足跳兽三视图与动作](monsters/10-snowHare.png)

普攻：`hareKick`；类别：normal；地图：frost。

### 11 古树守卫 · `warden`

![古树守卫三视图与动作](monsters/11-warden.png)

普攻：`wardenHammer`；类别：elite；地图：ember。

技能：`rootPlates`。

### 12 苔角冲阵者 · `emberRam`

![苔角冲阵者三视图与动作](monsters/12-emberRam.png)

普攻：`ramButt`；类别：elite；地图：ember。

技能：`ramLane`。

### 13 回响钟侍 · `bellKeeper`

![回响钟侍三视图与动作](monsters/13-bellKeeper.png)

普攻：`bellPearl`；类别：elite；地图：ember。

技能：`bellEcho`。

### 14 镜棱骑士 · `mirrorKnight`

![镜棱骑士三视图与动作](monsters/14-mirrorKnight.png)

普攻：`mirrorCut`；类别：elite；地图：frost。

技能：`splitEdge`。

### 15 霜环织者 · `rimeWeaver`

![霜环织者三视图与动作](monsters/15-rimeWeaver.png)

普攻：`weaverThread`；类别：elite；地图：frost。

技能：`wovenRing`。

### 16 庭院司炉者 · `courtyardHeart`

![庭院司炉者三视图与动作](monsters/16-courtyardHeart.png)

普攻：`hearthPalm`；类别：boss；地图：ember。

技能：`hearthFurrows`、`hearthSeeds`、`hearthVent`。

![庭院司炉者完整技能与阶段变化](monsters/16-courtyardHeart-skills.png)

### 17 霜镜执仪者 · `mirrorRegent`

![霜镜执仪者三视图与动作](monsters/17-mirrorRegent.png)

普攻：`regentScissor`；类别：boss；地图：frost。

技能：`regentLanes`、`regentHalo`、`regentMarks`、`regentOath`。

![霜镜执仪者完整技能与阶段变化](monsters/17-mirrorRegent-skills.png)

## 来源与交付边界

- 素材使用内置 image_gen 生成，基础 Prompt 见 [prompts.json](prompts.json)，实际参考图 / 提示前缀及修订调用见 [制作记录](generation-records.json) 和 `sources/*-correction.json`，对象与有效技能配置见 [manifest.json](manifest.json)。
- 覆盖清单、最终 PNG 摘要与 PDF 打包检查见 [validation.json](validation.json)。修订前草稿保存在 `sources/`，不计入最终 22 张。
- 本批全图为草图设定板，具有文字、底色和分解示意；不声称是透明、已切片、统一原生像素网格的生产 Sprite。
- 个别生成字形或透视 / 色阶需在生产时重新核对；稳定 ID 和本目录配置记录用于识别对象。
- 不修改游戏伤害、动作时长、碰撞、地图、当前运行素材或 UI；没有将静态设计检查当成动画播放、像素采样或性能验收。
