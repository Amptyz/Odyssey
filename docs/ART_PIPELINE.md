# 美术资源与动画接入指南

风格、细节预算与制作目标见 [ART_DIRECTION](ART_DIRECTION.md)，制作入口为 [ember-art skill](../.agents/skills/ember-art/SKILL.md)。本文描述实际加载路径；PNG 已接入与最近邻采样不表示严格24色、二值 alpha、低分辨率网格或整数 texel 显示已验收。

2026-10-20 起目标改为黑暗、血腥但清晰可读的像素奇幻，故事见 [WORLD_LORE](WORLD_LORE.md)。首轮交付 [复燃主角概念](../art-source/rekindled-hero-v1/README.md)，未替换下列运行资源。新比例、伤痕与服饰进入生产前需重新量测整身动作的画布与地面锚点；概念板不能直接按图集切片，也没有证明真实动画质量。

后续同日增加 [双风格八方向关键帧](../art-source/rekindled-style-studies-v2/README.md)，属于概念与动作设计交付；图中的底色、版式及局部预览坐标不属于生产资源契约。

用户选定死亡细胞取向，要求无血、无发、无五官；身份参考为[主角03](../art-source/rekindled-hero-v3/README.md)。2026-10-20随后取消装备换皮与分部件角色：旧[关节实验](../art-source/rekindled-runtime-v1/README.md)仅留制作历史，当前接入[整身序列帧](../art-source/chibi-runtime-v1/README.md)。

## 主角配色与新Q版

2026-10-21已选[Q版概念](../art-source/rekindled-chibi-v1/README.md)，完整动作已接入chibi-v1，制作依据包含已确认的粗像素修订。五张整身图集共用材质换色，不复制每色PNG；具体入口、分区限制与网络恢复契约见[主角配色](HERO_COLORS.md)。

## 当前运行资源

所有资源本地加载，运行时不调用生成服务。`art/living-ruins/` 的五张旧图集保留兼容：ruin-sprite、grovewarden、hero-parts、equipment、environment；原始制作记录在 `art-source/living-ruins-v1/`。

`pixel-v1` 原26张生产图集已接入，覆盖17怪、Boss阶段、人物部件、18件装备、环境、技能与增益图标。补齐批次替换四张、增加五张；本次停用复燃主角部件，改为五张整身图集，当前注册36张。变更如下：

| 稳定图集 ID | 运行资源 | 用途 |
| --- | --- | --- |
| hero-run / hero-walk / hero-melee / hero-ranged / hero-states | `art/chibi-v1/` 对应文件 | 五绘制视角×8列整身帧；三方向镜像 |
| hero / weapons / bodies / heads | `art/pixel-v2/` 同名文件 | 旧六人物部件保留；18件装备图仅用于UI，不加载到角色身上 |
| environment-frost-v2 | `art/pixel-v1/environment-frost-v2` | 霜镜回廊九个独立环境部件 |
| vfx-bursts-v2 | `art/pixel-v1/vfx-bursts-v2` | 火 / 冰 / 挥击 / 护盾各四帧 |
| courtyardHeart-phase2-death | `art/pixel-v2/monsters/` 同名文件 | 闭盖熄火三帧，0 / .25 / .5秒 |
| mirrorRegent-strike / mirrorRegent-phase2-strike | `art/pixel-v2/monsters/` 同名文件 | 两阶段分别使用完整独立出手补片 |

当前候选与量测见 `art-source/art-completion-v2/`。人物装备主体 alpha 主要为253/254，仍有低 alpha 边缘与超出目标的色数；查看器可能显示透明区隐藏 RGB，应读取 alpha 并结合游戏画面判断，不能仅凭暗底认定背景烘焙。完整身体不得被切断；物品图只按UI尺寸验收。

## 数据来源与生成

- 旧兼容表：`scripts/inspect-art.py` → `content/art-manifest.ts`。
- 当前生产表：`art-source/pixel-production-v1/production.json`，叠加 `art-source/art-completion-v2/manifest.json` 引用的定义片段 → `scripts/inspect-pixel-art.py` → `content/pixel-art.ts`。
- 定义可保存显式 `rect / anchor`、固定 scale 与 resourcePath。实际生成网格可能偏离请求，跨格素材必须量测，不能强行按等格切断。
- `pixel-art.ts` 是生成结果，不手工维护。修改来源后运行 `python3 scripts/inspect-pixel-art.py`，再运行 `python3 scripts/inspect-pixel-art.py --check` 核对一致性。需要 Python3 与 Pillow；脚本只分析 PNG、生成元数据，不重绘或清理像素。
- ArtLibrary 按生成表加载 resourcePath，共享纹理 / SpriteFrame，并明确设置最近邻；运行时不直接解析任意制作 JSON。

## 动画、挂点与分层

MonsterVisual 优先使用17怪 PNG，按 EnemyPose 选择通用 idle / walkA / walkB / windup / strike / recovery / hurt / death，以及可用的专属动作、Boss阶段图集；程序轮廓保留为缺图回退。显式切片、脚底锚点与早期 strike 显示时序已校正，受损且无法分开的帧使用同角色完整姿态替代，镜Boss实际出手选独立补片；映射与复用限制见制作记录。图集帧数不代表每技能都有独立动画。每帧以同一来源比例显示，使用生成表的归一化 anchor；不能逐帧拉成同样方框，也不能让武器 bbox 决定身体比例。

AnimatedUnit 的旧兼容路径仍使用4×4图集：idle 0–3、walk 4–7、attack 8–11、hurt 12、death 13–15；仅消费旧 ArtFrame 的 pivot X，anchor Y 固定0。这个限制不等于 MonsterVisual 新 PNG 路径也只能贴底。两者均按模拟时间表现，动画不触发伤害。

人物由 `HeroSprite` 显示完整身体，`wholeHeroFrame` 选择动作 / 绘制方向 / 帧 / 整体镜像，`HERO_CLIPS` 管理FPS与循环。行走12 FPS、跑步20 FPS、近战与远程 / 施法18 FPS；待机2帧、受击1帧、死亡5帧。每个方向共用地面基准，所有动作共用 .4 来源比例，不逐帧按包围盒缩放。死亡从 .65 秒后淡出，使最后倒地帧可见；伤害仍由模拟决定。ArenaView使用插值后的模拟时间，暂停冻结。

原 `HeroRig / EquipmentVisuals / UnitVisuals` 已删除。战场、主菜单和商店展示同一整身人物；商人暂复用该人物与独立柜台。装备仍有六栏与数值 / 被动，商品 PNG 只供 `ArtLibrary.icon` 使用，没有角色挂点、外观购买顺序或按部位换皮。新增装备只需配置数值 / 被动并补UI图标。

切片来源为 `art-source/chibi-runtime-v1/atlas-definitions.json`，坐标量测见 `alignment.json`。rect是源图左上角像素；anchor是裁切矩形左下角归一化坐标，指向共同地面原点，不是本帧最低不透明点。源 PNG 保持工具输出不变，真实透明、低alpha残边与细节预算须结合实际画面检查。

EnvironmentView 为霜图选择 environment-frost-v2，庭院使用原环境；非地面PNG在场景盒内保持原比例并贴地。PixelVfxView 使用快照 cue 年龄播放16帧短翻页，最多24个复用节点，并避让敌方危险边界；主要预警、弹体核心、浮字与部分特效仍用 Graphics。不是完整粒子编辑器或统一像素合成系统，密集 / 多人画面需另验。

普通近战由 MeleeVfxPlan / MeleeVfxView 驱动[原稿帧序](../art-source/basic-slash-runtime-v3/README.md)，固定 UV 窗口采样原始 RGB 板，在 melee-keyframes 材质中转换白光 alpha，并按非均匀关键时刻做亮锋对齐混合。前摇 / 有效期读取 Swing，年龄和中心与单位位置一起在上一已结算状态到当前状态之间插值，禁止预测未判定的未来角度；结束余迹按模拟时间清理；不复制八方向贴图。MeleeSweep 独立计算同相位的世界亮锋与连续扫掠，CollisionWorld 判定目标体积和遮挡；地形 Stencil 只裁剪画面，不将整个遮罩作为伤害区。原图字节保留，运行素材不冒称恢复了原始透明 alpha。仅该光流使用线性过滤及连续 alpha，不将例外扩展到角色 / 地图，也不宣称严格像素网格已验收。旧 v1 / v2 已因视觉不符停用。

FEEL-03将地面改为等比例旋转平面，契约见[战斗平面](GAME_FEEL.md)。所有地面轮廓统一通过GroundProjection，圆形范围保持圆形；旧地面徽纹的运行覆盖由130×67展开为130×130，直立角色 / 建筑不拉伸。旧PNG预绘斜面仍需后续重制适配，不能为匹配贴图而重新压扁范围或提高纵向移动速度。新主角方向通过GroundPlane取八方向，动作速度读取真实世界速度。

后续环境采用[斜俯视物件 + 等比例地面的2.5D规则](ART_DIRECTION.md#环境视角与地面度量)。制作记录区分地面 / 直立素材、目标占地、地面锚点、是否已按屏幕方向绘制以及遮挡 / 阴影分层；接入时核对EnvironmentView的地面层、物件定位与ArenaView深度排序。独立阴影、跨通道拆层或遮挡淡化若超出现有实现，需配套渲染开发，不能只凭PNG宣称功能已完成。

## 新资源接入与验证

1. 内置 image_gen 输出保存到候选目录，量测尺寸、alpha、帧序、关节、脸孔和跨格边界；保留 Prompt、源图与拒收理由。动画保持身份、尺度、朝向及共同地面基准。
2. 通过候选复制到本地 resources，更新定义来源与消费者。不要直接改生成 TS，不以图片存在代替节点实际选用该路径。
3. 由 Creator 3.8.8 导入生成 `.meta`；不手写 UUID，移动旧资源保留 UUID。新增 TS 也需要真实导入元数据。
4. 运行元数据 `--check` 与 `pnpm check`，再实际 Creator 构建 Web Desktop。运行 `pnpm play` 后执行 `pnpm test:art` 及受影响浏览器回归；URL 参数不会重建游戏。
5. 实际1280×720下检查人物八方向、装备形象不变、走 / 跑 / 最大挥击 / 远程 / 施法 / 受击 / 死亡、暂停及怪物专属动作与Boss阶段。主角专项入口为 `node scripts/browser-whole-hero.mjs`。F2慢速 / 单步辅助查接缝，F3对照碰撞；再用正常商店购买和战斗验收。

本次实际验证结果写在对应制作记录与实现记录；这里列的是必需流程，不表示所有任务的构建、Cocos画面或多人压力验收都已通过。怪物的完整八方向、Spine、布料模拟、美术布局编辑器、音效与完整粒子系统仍不是默认能力。不提交 library、temp、build 等生成目录。
