# AI 美术动画草案评估与采用方案

> **后续风格修订（2026-10-16）：** 用户已确定像素遗迹风。以下是此前 v0.6 的历史评估，不代表当前风格或多人能力；其中“不采用像素吸附 / 不采用像素化标准”等结论由 [ART_DIRECTION](ART_DIRECTION.md)、[PIXEL_VFX](PIXEL_VFX.md) 和更新后的 [ember-art](../.agents/skills/ember-art/SKILL.md) 替代。旧 PNG / Graphics 尚未迁移，当前支持 2–4 人房主合作，原单人评估不能作为多人验收。

评估日期：2026-10-16。对象为 [用户提供的草案](../CODEX_AI_ART_ANIMATION_RULES.md)，代码基线为 v0.6 的现有美术与挂点实现。

结论：固定身份与镜头、单动作制作、本体与特效分离、逐帧检查、实际尺寸验收都值得采用；风格身份、坐标契约、动画时长和工具路线需要适配。草案正文保留作为审阅来源，实际执行入口为 [ember-art skill](../.agents/skills/ember-art/SKILL.md)，视觉标准仍由 [ART_DIRECTION](ART_DIRECTION.md) 维护，工程接入由 [ART_PIPELINE](ART_PIPELINE.md) 维护。

## 原评估：必须修改的部分

| 草案位置 / 问题 | 当前证据与影响 | 已采用的修订 |
| --- | --- | --- |
| §2：把“潮流幻想服装、没有脸部细节”称为已确认 | 与用户要求和现有 [基础人物规则](ART_DIRECTION.md#基础人物中性与换装兼容) 不符，可能把职业风格画死在人物上 | 保留简单五官、中性短衣和普通短发；装备体现构筑。英雄是否生成按本次任务决定，不固化“永远不是重点” |
| §2 / §5.7：“地图风格 B、C”没有可解析的工程定义 | 仓库没有对应标签体系，容易让其他 AI 自行猜图或追随高细节海报 | 使用已接入 PNG 的比例与线条，明确低细节自然遗迹标准；原始图只提供氛围 |
| §6：视频保留画布可直接进入图集 | [生成器](../scripts/inspect-art.py) 每帧裁边并贴底；[AnimatedUnit](../EmberDemo/assets/scripts/ember/render/AnimatedUnit.ts) 忽略 pivot Y，anchor Y 固定 0，会抹去画布内上下位移 | 保留画布是新模式的目标，需扩展生成器与渲染映射；旧贴地模式继续兼容，不能把二者混用 |
| §6：示例 pivot 没有坐标定义，JSON 看起来像可直接导入 | 当前 ArtFrame 用像素坐标，纸娃娃挂点用左下角归一化坐标；[ArtLibrary](../EmberDemo/assets/scripts/ember/render/ArtLibrary.ts) 不读取草案 JSON、direction 或 events | 明确原点、单位、裁切偏移；制作记录和实际 TS 运行时契约分开，不伪造通用 manifest 导入器 |
| §6：建议帧数 / FPS 没有检查实际状态窗口 | [motionPose](../EmberDemo/assets/scripts/ember/content/animation.ts) 出手后 attack / cast 约 0.45 秒、hurt 约 0.18 秒；死亡另有淡出。12 帧 / 12 FPS 的动作无法仅靠换图完整播放 | 帧数、FPS、播放窗口、前摇和打断一起评估。非均匀抽帧按统一 FPS 播放会改变节奏，需记录并适配 |
| §6 / §10：默认优先图生视频，再扩四方向 | 现有工具已支持图片生成，未接通视频服务；当前仅同一三分之四朝向加镜像 | 默认按可用图片工具制作姿势帧；视频是具备工具与授权时的可选路线，多方向是独立开发范围 |
| 开头 / §7–8：将五人、服务器、音效事件作为验收前提 | 当前 [架构](ARCHITECTURE.md) 是单人本机模拟；没有多人、音频系统、通用动画事件消费器 | 保留多效果画面的低噪声要求，用实际多怪 / 多海克斯测试；不声称完成五人或音效验收 |
| §0 / §11：一次性任务限制和逐阶段人工批准混在长效准则中 | 后续用户调用 skill 制作素材时，会被“本次只审阅”与反复确认阻塞 | 由本次用户请求决定交付层级，沿用已有授权；新服务、额外费用或未要求的风格更换仍不自行扩展 |

## 原评估：保留并补强的条款

- 保留身份、视角、朝向、相机、身体尺度、动作留白等约束，但明确这是生成目标，需要看实际结果。
- 保留一动作一组的制作方式；不要求“一帧一次调用”，也不把整张漂亮图集当作动作连续性的证明。
- 动作本体和战斗 VFX 分离；允许保留守卫金色面部等身份特征。禁止“新增五官”不应导致删除原有面具眼睛。
- one-shot 表示只播放一次，攻击恢复到准备姿势合理；只有真正重复且造成停顿的循环末帧才删，不能机械删掉所有末帧。
- alpha bbox 不等于身体尺寸或脚底。武器低垂、树角、下蹲、跳跃和死亡都可能改变边界，不能按各帧 bbox 强制等高。
- 透明 PNG 优先；只有不支持 alpha 的路线才选择与主体不冲突的纯色底。非像素卡通不使用像素吸附或强制调色板量化。
- 源输出、Prompt、参考、实际工具信息与拒绝原因可追溯；没有暴露的模型版本 / seed 记录为 unknown。保存来源不等于将所有大视频和中间帧提交普通 Git。
- 4096 边长只是可能的设备上限参考，不能当性能预算；4096×4096 的未压缩 RGBA 基础层已是 64 MiB，还未计 mipmap 或引擎开销。按实际显示尺寸、对象数量和目标设备验证。

## 原评估：外部资料核对

以下为原审阅读取到的资料（本轮风格修订未重新访问外链）及采用范围，不代表运行过作者工具、模型或其示例工程。外部网页可能变化，新增服务 / API 接入时再核对实时能力。

| 来源 | 本次采用与限制 |
| --- | --- |
| [AI Game Spritesheets](https://github.com/chongdashu/ai-game-spritesheets) | 采用身份参考和阶段化思路；其像素风、四方向及特定供应商不是本项目标准 |
| [08 Normalization](https://github.com/chongdashu/ai-game-spritesheets/blob/main/prompts/08-normalization.md) | 页面确实主张裁边 / 尺度 / 脚底归一化；只对独立姿势的漂移修正有参考意义，不能无条件处理已稳定的视频画布 |
| [06 Attack](https://github.com/chongdashu/ai-game-spritesheets/blob/main/prompts/06-attack-spritesheet.md) 与 [04 Directions](https://github.com/chongdashu/ai-game-spritesheets/blob/main/prompts/04-directional-anchors.md) | 5×2 / 10 帧与多方向属于其例子；攻击模板还允许将动态特效画入攻击帧，不采用这一点 |
| [Layr Kits 工作流](https://www.layrkits.com/guides/sprite-sheet) | 页面包含 preserve-canvas 与全量抽帧的说明；采用固定画布原则，不自动引入其模型、脚本、输出尺寸或加工服务 |
| [Higgsfield 社区工作流](https://github.com/kaveone/higgsfield-skills/blob/main/higgsfield-game-generation/references/2d-animation.md) | 可参考相机 / 朝向约束与 loop / one-shot 区分；固定供应商参数、必删末帧、失败后取最佳结果补救等规则不直接照搬 |
| [Pixel-snapped 示例](https://github.com/chongdashu/ai-pixel-snapped-game-sprites) | 可参考跨格和帧漂移问题；不采用像素化处理作为本项目美术标准 |
| [Neptune Vibes 开发日志](https://neptunevibes.com/devlog/sprite-manager/) | 参考审核记录和拒绝原因；不表示本项目已有同类资产管理工具 |
| [Scenario 官方资料](https://docs.scenario.com/get-started/documentation/integrating-with-applications-real-world-scenarios) | 页面介绍一致性批量生成与定制模型；当前不需要训练、安装或接入该服务 |
| [Cocos 官方动画事件](https://docs.cocos.com/creator/3.8/manual/zh/animation/animation-event.html) | 引擎支持时间轴回调；当前自定义序列帧并不因此自动支持它，权威命中仍属于模拟层 |

草案中的 [Reddit 帖子](https://www.reddit.com/r/aigamedev/comments/1uacn8h/my_best_prompts_for_sprite_generation/) 可访问，只保留为灵感线索，不作为工程接口或模型能力保证。外部 Prompt 不逐字复制到 skill，新模板按本项目现有风格和实际接口编写。

## 原评估：已落地的 skill

入口为 `.agents/skills/ember-art/SKILL.md`，按任务读取 Prompt、动画 / 坐标契约、接入 / 验收；像素风修订后另按需读取项目 PIXEL_VFX。它覆盖贴图、纸娃娃部件、装备、怪物动作、环境及特效；不默认生成整套职业角色、安装视频服务或改战斗判定。

项目级位置随 Git 携带；[官方 skill 文档](https://learn.chatgpt.com/docs/build-skills)说明 Codex 会扫描仓库 `.agents/skills`。在当前项目中可直接说：

```text
使用 $ember-art，给遗迹小精灵制作更清楚的原地行走和刺击动画，并接入游戏。
```

只需要设计时写“只输出 Prompt 与资源规格”；只需要素材时写“生成候选，暂不替换现有资源”。其他不支持 skill 自动发现的 AI，可以直接读取该 SKILL.md，并按其中的相对链接读取参考。

## 更新后的首次像素动画试作建议

这是后续实际调用 skill 时可执行的最小试作，不属于本次已经制作的成果：

1. 使用当前 ruin-sprite 作为身份 / 比例参考，按新像素网格与色板先做一个方向的 idle / walk / attack，保持旧图可回退；旧图不再充当像素边缘标准。
2. 先以现有 4 / 4 / 4 帧做清楚的关键姿势；若不够表达，再设计更长动作与播放窗口的适配，不能先堆帧数。
3. 选定底边贴地或保留画布方案，测量真实输出、帧序、锚点和播放节奏；后者需实际实现新的数据 / 渲染契约。
4. 检查正常速度动作与相互切换、镜像、暂停、受击打断；F3 对照脚底和预警，最后在普通战斗中验收。
5. 通过后再制作同族其他动作与变种，不自动扩展四方向或联网。

## 原评估：当时的工具边界

已有 `inspect-art.py`、`pnpm check`、`pnpm test:art` 和 F2 / F3；本机可找到 FFmpeg / ffprobe，但这不代表项目已经有抽帧 / 选帧 / 视频生成流水线。Pillow 是美术分析的可选依赖，当前默认 Python 未安装；普通开发不依赖它。本次没有安装视频服务、编写新的媒体加工脚本或执行素材生成。

后续真正需要视频素材时，再实现源时间戳记录、概览 / 选帧、保留画布导入和预览验证。工具可用性按当次环境检查，不让 skill 强制依赖本机路径。

## 原评估：当时的验证记录

- skill-creator 的 `quick_validate.py` 通过；UI 元数据中的调用名称、简述长度和默认自动选择配置检查通过。
- 10 份相关文档 / skill 文件的 68 个本地链接与锚点、代码围栏检查通过；skill 无本机绝对路径、未完成的初始化模板。
- 直接调用当前 animation.ts 做只读时序复核：12 帧 / 12 FPS 的候选攻击在 0.44 秒为第 5 号帧，0.46 秒已切回 idle，证实需要检查播放窗口；没有修改运行时逻辑。
- 做了不调用模型的流程走查：只写 Prompt 不生成；中性人物不被草案改为无脸职业装；手错位先查挂点；无视频能力不虚构影片；长攻击检查窗口；多套装备先做一套闭环再按请求批量。此走查不等于生成质量测试。
- 本次仅交付规则、skill 与审阅文档，没有运行完整游戏回归或重新构建 Cocos；真实生成与动画效果需在后续素材任务中验证。
