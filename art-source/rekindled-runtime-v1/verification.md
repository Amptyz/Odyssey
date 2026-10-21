# 本次验证（2026-10-20）

> 已停用：用户随后改为完整身体序列帧并取消装备换皮；此处保留十部件方案的制作历史。当前入口为[整身角色](../whole-hero-v1/README.md)，不要恢复本批次的关节或装备叠层。

## 已运行

- Creator **3.8.8** 实际导入 `rekindled-v1/parts.png`，生成资源与目录 `.meta`；未手写 UUID。Web Desktop 最终构建成功，日志：`reports/rekindled/creator-build.log`。
- `pnpm check`：32 个测试文件、406 项测试通过，含核心 / Cocos / 工具类型检查和核心编译。最终报告在 `reports/rekindled/check.log`。
- `pnpm test:art`：107 项通过；包含本批新增图集加载/最近邻、真实商人购买、装备、怪物、两地图、技能 VFX 与暂停。日志在 `reports/rekindled/art.log`，完整报告在 `reports/browser-art.json`。首次运行浏览器被关闭，重跑通过。随后血条高度与 appearance 回退修订由最终专用回归和 pnpm check 覆盖。
- `node scripts/browser-rekindled.mjs`：最终构建通过。39 组样本：8 方向正常跑步、8 方向减速行走、8 方向近战、8 方向飞弹普攻、6 组装备组合、1 组 90 渲染帧采样；额外每组装备有一次火弹施法。脚本使用真实 Creator 页面和校验后的命令 / 开发者配置，不修改战斗快照。
- 90 个真实浏览器渲染帧跨越 46 个模拟 tick；同一 tick 内最多有 **2 个不同动画年龄**，确认动画按渲染插值采样，未退化为 30 Hz 姿态跳变。该采样不是持续性能基准，不承诺所有设备 60 FPS。
- 暂停前后人物表现快照一致。方向检查核对实际 `MotionPose.direction` 与十部件新 rig；正常基础 / 远程形态和施法均没有切回旧人物。
- `inspect-pixel-art.py --check`：32 张图集生成表与来源一致。
- `git diff --check`：通过。

## 可见证据

- **无入场横幅**的最终基础人物：`reports/rekindled/neutral-clear.png`。
- 八方向：`run-0.png` 至 `run-7.png`，`walk-*`，`melee-*`，`ranged-*`（均在 `reports/rekindled/`）。
- 六组外观：`outfit-0.png` 至 `outfit-5.png`；对应 `cast-*` 为施法中画面。
- 实际浏览器动作录屏：`reports/rekindled/runtime-directions.webm`。包含方向循环、装备更换、近战 / 远程与慢速行走；为真实 Cocos 输出，没有用独立 Web 人物模拟替代。
- 结构化诊断：`reports/rekindled/result.json`。截图未加工；仅额外捕获完整清晰画面。

## 扩展与边界

装备仍从 `equipment(id).appearance` 选择表现。复用已有 appearance 的新物品共享对应像素外观；没有像素表项时保留 `PROCEDURAL_EQUIPMENT` / `EQUIPMENT_SPRITES` 回退，以及图层合法性校验。18 件商品 ID 只用于当前生产图集索引，不是新增商品限制。

受击 / 死亡使用同一新 rig 的反冲 / 倾倒，并由纯逻辑姿态测试覆盖方向和数值；本次没有保存真实玩家受击到死亡的专项截图。没有多人换装专项录屏，也没有测试全部 18×18×18 混搭、严苛像素网格或持续 GPU 性能。六组交叉搭配覆盖全部现有 18 件装备。

旧装备仅单视角，新基础人物为五绘制视角与三镜像方向；背面衣甲 / 头饰并非重绘背图。RGBA 有 1,014,902 个全透明像素，557,962 个分数 alpha 像素，源图不满足严格二值 alpha / 限色色板验收。源 PNG 完全未改写。循环为程序骨骼动画，不宣称为逐帧手绘。

本次未提交或推送 Git。工作区原有美术候选与文档保持保留；顶层文档由主会话统一更新。
