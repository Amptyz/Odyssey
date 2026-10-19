# 美术资源与动画接入指南

风格、细节预算与制作目标见 [ART_DIRECTION](ART_DIRECTION.md)，制作入口为 [ember-art skill](../.agents/skills/ember-art/SKILL.md)。本文描述实际加载路径；PNG 已接入与最近邻采样不表示严格24色、二值 alpha、低分辨率网格或整数 texel 显示已验收。

## 当前运行资源

所有资源本地加载，运行时不调用生成服务。`art/living-ruins/` 的五张旧图集保留兼容：ruin-sprite、grovewarden、hero-parts、equipment、environment；原始制作记录在 `art-source/living-ruins-v1/`。

`pixel-v1` 原26张生产图集已接入，覆盖17怪、Boss阶段、人物部件、18件装备、环境、技能与增益图标。本次替换四张、增加五张，当前注册31张。变更如下：

| 稳定图集 ID | 运行资源 | 用途 |
| --- | --- | --- |
| hero / weapons / bodies / heads | `art/pixel-v2/` 同名文件 | 替换六人物部件及18件可穿戴装备；UI可复用 |
| environment-frost-v2 | `art/pixel-v1/environment-frost-v2` | 霜镜回廊九个独立环境部件 |
| vfx-bursts-v2 | `art/pixel-v1/vfx-bursts-v2` | 火 / 冰 / 挥击 / 护盾各四帧 |
| courtyardHeart-phase2-death | `art/pixel-v2/monsters/` 同名文件 | 闭盖熄火三帧，0 / .25 / .5秒 |
| mirrorRegent-strike / mirrorRegent-phase2-strike | `art/pixel-v2/monsters/` 同名文件 | 两阶段分别使用完整独立出手补片 |

当前候选与量测见 `art-source/art-completion-v2/`。人物装备主体 alpha 主要为253/254，仍有低 alpha 边缘与超出目标的色数；查看器可能显示透明区隐藏 RGB，应读取 alpha 并结合游戏画面判断，不能仅凭暗底认定背景烘焙。头饰脸孔与眼孔需检查真实透明及对脸位置。

## 数据来源与生成

- 旧兼容表：`scripts/inspect-art.py` → `content/art-manifest.ts`。
- 当前生产表：`art-source/pixel-production-v1/production.json`，叠加 `art-source/art-completion-v2/manifest.json` 引用的定义片段 → `scripts/inspect-pixel-art.py` → `content/pixel-art.ts`。
- 定义可保存显式 `rect / anchor`、固定 scale 与 resourcePath。实际生成网格可能偏离请求，跨格素材必须量测，不能强行按等格切断。
- `pixel-art.ts` 是生成结果，不手工维护。修改来源后运行 `python3 scripts/inspect-pixel-art.py`，再运行 `python3 scripts/inspect-pixel-art.py --check` 核对一致性。需要 Python3 与 Pillow；脚本只分析 PNG、生成元数据，不重绘或清理像素。
- ArtLibrary 按生成表加载 resourcePath，共享纹理 / SpriteFrame，并明确设置最近邻；运行时不直接解析任意制作 JSON。

## 动画、挂点与分层

MonsterVisual 优先使用17怪 PNG，按 EnemyPose 选择通用 idle / walkA / walkB / windup / strike / recovery / hurt / death，以及可用的专属动作、Boss阶段图集；程序轮廓保留为缺图回退。显式切片、脚底锚点与早期 strike 显示时序已校正，受损且无法分开的帧使用同角色完整姿态替代，镜Boss实际出手选独立补片；映射与复用限制见制作记录。图集帧数不代表每技能都有独立动画。每帧以同一来源比例显示，使用生成表的归一化 anchor；不能逐帧拉成同样方框，也不能让武器 bbox 决定身体比例。

AnimatedUnit 的旧兼容路径仍使用4×4图集：idle 0–3、walk 4–7、attack 8–11、hurt 12、death 13–15；仅消费旧 ArtFrame 的 pivot X，anchor Y 固定0。这个限制不等于 MonsterVisual 新 PNG 路径也只能贴底。两者均按模拟时间表现，动画不触发伤害。

人物为六部件纸娃娃，由 HeroRig 驱动待机、行走、攻击、施法、受击与倒下。旧 `HERO_ARM_ATTACHMENTS` 定义肩位置与兼容挂点；pixel-v2 使用 HeroRig 内独立实测 anchor / grip，保留肩位置和8×19手臂尺寸。归一化坐标从裁切图左下角计。衣甲盖住肩接头，武器前景层复制右肩变换并挂掌心，头饰随头骨旋转。身体整体镜像；肢体角度量化为15度仍不能保证全场统一像素密度。

六个属性栏按购买顺序从仍装备项中选出 weapon / body / head 各一个显示代表，战场和商店共用 HeroRig。三套装备 PNG 优先；旧 EQUIPMENT_SPRITES 与 PROCEDURAL_EQUIPMENT 保留兼容。武器握点须实测，弓 / 盾不能套用剑柄锚点。换装不改变碰撞。

EnvironmentView 为霜图选择 environment-frost-v2，庭院使用原环境；非地面PNG在场景盒内保持原比例并贴地。PixelVfxView 使用快照 cue 年龄播放16帧短翻页，最多24个复用节点，并避让敌方危险边界；主要预警、弹体核心、浮字与部分特效仍用 Graphics。不是完整粒子编辑器或统一像素合成系统，密集 / 多人画面需另验。

## 新资源接入与验证

1. 内置 image_gen 输出保存到候选目录，量测尺寸、alpha、帧序、关节、脸孔和跨格边界；保留 Prompt、源图与拒收理由。动画保持身份、尺度、朝向及共同地面基准。
2. 通过候选复制到本地 resources，更新定义来源与消费者。不要直接改生成 TS，不以图片存在代替节点实际选用该路径。
3. 由 Creator 3.8.8 导入生成 `.meta`；不手写 UUID，移动旧资源保留 UUID。新增 TS 也需要真实导入元数据。
4. 运行元数据 `--check` 与 `pnpm check`，再实际 Creator 构建 Web Desktop。运行 `pnpm play` 后执行 `pnpm test:art` 及受影响浏览器回归；URL 参数不会重建游戏。
5. 实际1280×720下检查两向镜像、混搭、移动 / 最大挥击 / 施法 / 受击 / 死亡、暂停及怪物专属动作与Boss阶段。F2慢速 / 单步辅助查接缝，F3对照碰撞；再用正常商店购买和战斗验收。

本次实际验证结果写在对应制作记录与实现记录；这里列的是必需流程，不表示本次构建、Cocos画面或多人压力验收已经通过。八方向、Spine、布料模拟、美术布局编辑器、音效与完整粒子系统仍不是默认能力。不提交 library、temp、build 等生成目录。
