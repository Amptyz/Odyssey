# Q版主角接入验收 · 2026-10-21

本记录对应当前 `chibi-v1` 五张运行PNG和四格侧面收势复用，非旧人物的历史测试结果。

## 已执行

| 检查 | 命令 / 结果 |
| --- | --- |
| 来源图 / 运行图、透明间隙与共同锚点 | `python3 scripts/inspect-chibi-hero.py --check`：200格，原图哈希一致，未改PNG像素 |
| 生成资源表一致性 | `python3 scripts/inspect-pixel-art.py --check`：36张注册图集通过 |
| 类型、逻辑和核心编译 | `pnpm check`：33个测试文件、421项通过 |
| 实际编辑器构建 | Creator 3.8.8 Web Desktop，日志Finished；PNG及目录meta由导入生成 |
| 玩家动作 | `EMBER_HERO_REPORT_DIR=reports/chibi-hero pnpm test:hero`：39组方向 / 动作 / 装备检查；受击、五帧死亡、淡出、延迟失败面板通过 |
| 正常配色UI | `EMBER_PALETTE_REPORT_DIR=reports/chibi-hero/palettes pnpm test:palettes`：12项通过 |
| 房间码双人流程 | `pnpm test:multiplayer`：25项通过，含各自配色、重连及原客机恢复开房 |
| 通用美术回归 | `pnpm test:art`：111项通过，含真实商人购买、地图切换、技能特效与Boss场景 |
| 文本补丁 | `git diff --check`通过 |

Python使用带Pillow的环境；脚本不修改位图。此次没有新增战斗机制，没有改变角色碰撞半径、世界移速、装备规则或技能判定。

## 画面证据与边界

- 已查看真实1280×720截图：营地实际尺寸、跑动侧面 / 背面、六配色中的霜蓝 / 暗绯、商店、受击 / 倒地及双人营地。源图五行和动作阶段另逐张检查。
- 首页移除挡在人物背后的大叶片装饰，避免它看起来像角色附属装备。
- 八方向选择、暂停冻结和插值时钟通过；录屏与逐方向截图在 `reports/chibi-hero/`，`runtime-directions.webm` 保留实际播放。不能仅凭帧索引测试声称步态已达到最终动画质量。
- 正面与斜前的脸部阴影方向相近；部分跑动姿势仍相似。E/W攻击恢复有四格完整姿势复用，具体映射见README和alignment.json。继续ART-08精修。
- 源图保留分数alpha、多于目标的色数和非严格均匀像素簇；最近邻采样与粗像素外观已应用，但严格低分辨率像素制作标准尚未全部完成。
- 染色采用共享颜色域遮罩，验证了实际衣料换色、暖肤 / 腰带 / 火光保留；不声称所有边缘像素已经做语义分区。四人高负荷性能与所有DPR未覆盖。
- 当前环境和敌人仍是旧美术，尚未统一成新黑暗主题；本轮只替换主角。

汇总与命令日志位于 `reports/chibi-hero/validation.json`。没有提交或推送Git。
