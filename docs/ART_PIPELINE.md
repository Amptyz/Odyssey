# 美术资源与动画接入指南

设计方向、细节预算、角色 / 装备 / 地图 / 特效规范和制作任务模板见 [美术风格设计指南](ART_DIRECTION.md)。本文负责资源格式、动画与换装挂点、Cocos 接入和工程验证；下列首批素材从 v0.4 开始使用，挂点约定包含后续修复。

制作入口为 [ember-art skill](../.agents/skills/ember-art/SKILL.md)。外来视频 / 动画工作流的取舍见 [审阅结果](ART_ANIMATION_REVIEW.md)，不能直接将第三方 manifest 或坐标规则当成已有接口。

目标是保留明亮古代遗迹、自然与魔法的氛围，降低参考图的细节密度。大面积浅石板承担地面，低对比接缝替代密集棋盘；植物主要位于边缘，技能预警与角色轮廓优先。颜色集中在象牙白、鼠尾草绿、浅青水色及少量珊瑚色、金色。

人物基础只使用普通短发、浅灰短衣、褐灰裤与软靴，没有职业标志。剑、杖、弓、盾、衣甲和头饰承担流派辨识；基础身体不随技能组合换成固定职业。

## 现有资源

运行时目录：`EmberDemo/assets/resources/art/living-ruins/`。PNG 保留真实透明通道，加载和运行不调用在线服务。

| 图集 | 实际尺寸 | 区域 | 内容 |
|---|---:|---:|---|
| ruin-sprite.png | 1254×1254 | 16 | 小精灵动作；远程 / 霜叶变种复用并调色 |
| grovewarden.png | 1254×1254 | 16 | 古树守卫动作 |
| hero-parts.png | 1536×1024 | 6 | 头、身体、左右臂、左右腿 |
| equipment.png | 1448×1086 | 12 | 10 件装备外观；叶片与光球为备用区域 |
| environment.png | 1254×1254 | 9 | 柱、低矮残垣、植物、水晶、拱门、瀑布、铺石、地徽 |

以上资源使用内置 **image_gen** 工具生成，按用户提供的图片作风格参考并简化；人物背景做过一次透明清理编辑。原始参考、完整提示词、每张图的 SHA-256 / 尺寸 / 切片检查在 `art-source/living-ruins-v1/`。保存的 PNG 没有通过程序重新绘制或删改像素。提示词中的请求尺寸与实际输出不完全一致，运行时使用实际测量尺寸。

## 当前17怪程序美术

运行敌人由render/MonsterVisual.ts和monster-palettes.ts绘制，保留明亮自然遗迹、大色块、独立器具和轮廓。它是正式代码美术，不是PNG生成结果；无新AI图、视频或怪物图集。17种身份与动作对应[战斗稿](design/MONSTER_DESIGN.md)和[美术Brief](design/MONSTER_ART_BRIEFS.md)，其中旧小场地/三槽/BossHP等纸面值以当前源码与本轮实施记录为准。

MonsterVisual.update(unit,pose,time)读取EnemySystem的EnemyPose，windup显示准备姿、strike对每个实际分段产生出手脉冲、phase控制炉盖/镜盘变化；步态由velocity与模拟time控制，整体左右镜像，死亡压低并淡出。本体不画预警/飞弹。drawEnemyWarnings按快照shape/contours绘制同世界坐标地面形状和独立敌弹，圆/扇形轮廓按地形视线裁切，环保留真实安全内圈；不能靠调整贴图覆盖碰撞错误。

属性六个通用slot不等于六层显示。EquipmentSystem.appearance/appearanceLoadout由购买顺序从仍穿戴项为weapon/body/head选代表，HeroRig和商店预览共用这三层；其余装备继续提供属性。新增显示层先改渲染契约，不给现有角色直接叠六把武器。

## 旧PNG动作约定（兼容路径）

保留的旧怪物PNG为4×4图集，按行排列：待机 0–3、行走 4–7、攻击 8–11、受击 12、死亡 13–15。`content/animation.ts` 定义默认帧速、循环和优先级；每个 `UNIT_SPRITES` 外观可以选择自己的 clips。攻击 / 死亡不循环，死亡视图在 0.9 秒内淡出。

旧PNG小精灵刺击、守卫重拳、远程复用帧只描述兼容资源，不代表本轮MonsterVisual的17套轮廓。图像为同一三分之四视角，左右镜像形成两向表现，没有八方向转身贴图。人物采用轻量纸娃娃部件运动：行走摆臂摆腿、普攻挥动武器、施法抬臂、受击倾斜、死亡倒下。它不依赖 Spine，也不包含导出的骨骼工程。

位置与遮挡以地面脚底为基准。怪物保持每张图集固定物理像素比例，帧切换不把每张图片拉伸成统一方框。装备与基础手臂、身体、头部共用挂点，换装保留动作与镜像朝向。战场和商店预览使用同一个 HeroRig。

人物手臂使用 `HERO_ARM_ATTACHMENTS`：左右按未镜像时的屏幕方向命名，左臂为图集帧 3、右臂为帧 2。`anchor` 指向贴图内实际肩关节，`shoulder` 为角色局部坐标，`grip` 指向掌心；`anchor / grip` 均使用从图片左下角计的归一化坐标。两侧肩部接头在衣服后方，避免重复袖口和暴露断面；武器使用独立前景层复制右肩变换，再以掌心定位。剑 / 杖的挥击额外绕握点转腕，镜像时身体和所有挂点一起翻转。

`action` 带自增编号与模拟时间，伤害提示按实体 ID 记录受击 / 死亡时间；动画不参与命中判定。暂停冻结动作，渲染帧率不改变攻击频率和技能结果。技能弹体、命中和范围特效当前仍为简洁的 Graphics 表现。

### 新动画必须核对的接口限制

- `AnimationClips` 只配置 frames / fps / loop，当前无方向表、逐帧时长或视觉事件数组。`motionPose` 的出手显示窗口约 0.45 秒、受击窗口约 0.18 秒，windup 期间固定在 attack age 0.08 秒；新增长帧组时同时核对这些窗口及死亡淡出，不能以 `帧数 / FPS` 直接断言游戏里能播完。
- `ArtFrame.rect` 是图集左上角像素区域；生成器输出的 pivot 是裁切区内像素值。目前 AnimatedUnit 只使用 pivot X，Cocos anchor Y 固定为 0，每帧贴图底边贴地。它不支持任意 Y pivot，低垂武器或死亡碎片也可能影响最低像素。
- 锁定镜头视频需要保留共同画布 / 锚点，而默认生成器逐帧裁边。采用视频或整体跳跃位移时，要实现保持画布的切片模式及对应渲染映射，不能直接沿用贴底流程；也不能误用纸娃娃的左下角归一化 anchor / grip。详见 skill 的 [动画与坐标契约](../.agents/skills/ember-art/references/animation.md)。
- 制作批次的 JSON 只记录来源与验收，不是自动导入格式。实际运行时仍使用生成的 art-manifest.ts、appearances.ts 与 animation.ts。

## 添加或替换资源

1. 将透明 PNG 放入 resources 下的对应目录，通过 Creator 导入并提交编辑器生成的 `.meta`；不要手写或重建 UUID。大幅修改建议先保留版本文件。
2. 更新 `scripts/inspect-art.py` 的图集布局，安装可选 Pillow 后运行 `python3 scripts/inspect-art.py`。它只读取 PNG，输出像素区域、脚底基准和检查报告，不修改图片与 `.meta`。若美术存在非均匀动作格，需检查每帧锚点，不能只依赖自动裁边。
3. 当前新怪优先扩MonsterVisual/monster-palettes与EnemyPose相位；若明确采用PNG，才在UNIT_SPRITES配置atlas/pixelScale/height/tint/clips并实现该怪的视图选择与动作映射。不能注册图片却仍默认走程序视图后声称已加载。
4. PNG装备在 `EQUIPMENT_SPRITES` 配置帧和挂点；原生Graphics装备在 `PROCEDURAL_EQUIPMENT` 配置分层多边形与y位置，经EquipmentVisuals创建，两者都在装备定义引用稳定appearance ID。武器 `anchorX / anchorY` 应标在实际握把位置，不能将弓、法杖都默认设为图片底部居中。武器跟随掌心，衣甲盖住肩部接头，头饰盖在头部；确认空脸区域透明、活动时不漂移。
5. 新地图素材在 `ENVIRONMENT_APPEARANCES` 指定图集与素材角色，再通过地图 environment 引用。当前采用疏朗边缘模板，独立关卡装饰布局尚无可视编辑器。
6. 运行 `pnpm check`，在 Creator 构建 Web Desktop，再运行 `pnpm test:art`。检查缩小到实际游玩尺寸后的轮廓、地板对比、血条位置、预警可读性和装备动作。

普通运行与开发不需要 Python、Pillow、生成 API 密钥或图像生成工具。五张 PNG 当前单张约 1–2 MB，可用普通 Git 管理；以后较大 PSD、模型和音频使用 Git LFS 时，应将 `.gitattributes` 一起提交，另一台电脑安装 LFS 并拉取真实文件。不要提交 library、temp 或 build。

## 导入元数据与验证

新增TS表现/模拟模块也由Creator导入生成.meta；源文件与真实编辑器生成元数据一起交付，不手写UUID。核心/Vitest/Cocos类型通过不等于Creator已生成元数据或画面验收完成。新程序轮廓至少在实际1280×720、单个与密集组合、左右镜像、前摇/多段/死亡、两张跟随大图上检查；设计Brief建议帧组不是当前播放器或生成资产事实。

## 验证与边界

单元测试检查动画循环 / 停帧、动作优先级、实际施法与死亡信号、PNG 格式和像素区域边界。浏览器回归在普通数值下购买装备，验证帧加载、移动 / 攻击 / 施法 / 受击 / 死亡、暂停冻结、17种代表出手、Boss阶段和五关出口流程，不直接修改生命或伤害。

可选录制动作视频：`pnpm exec playwright install ffmpeg`，然后 `EMBER_RECORD_VIDEO=1 pnpm test:art`，输出 `reports/24-art-playthrough.webm`。截图和录像仅保存在本机，JSON 验证报告随 Git 管理。

旧PNG与本轮程序美术并用，素材与程序姿态都可继续精修。尚未制作八方向、美术编辑器、专属远程动作、独立冰霜建筑套装、音效与复杂粒子动画；这些不会影响本轮资源在游戏中使用。

## v0.8 八件装备程序外观

八件新装备按[外观实施规格](design/EQUIPMENT_VISUAL_IMPLEMENTATION.md)使用大色块、多边形轮廓，挂在现有HeroRig掌心/身体/头部；沿用同一套移动、攻击、施法与镜像姿态。它们不是新生成PNG，原equipment.png仍仅含原有10件。完整PNG升级仍可作为独立ART-01任务，不影响本轮八件装备可正常显示与战斗。
