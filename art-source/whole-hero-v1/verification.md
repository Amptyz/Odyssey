# 本轮整身角色验证

日期：2026-10-20。此记录仅对应 whole-hero-v1，不把此前纸娃娃报告视为当前结论。

- `pnpm check`：核心 / Cocos / 工具类型检查、414项Vitest及核心编译通过。
- Creator 3.8.8 Web Desktop构建成功，CLI退出36，日志包含Finished。新PNG和HeroSprite.ts的.meta由真实导入产生。
- `node scripts/browser-whole-hero.mjs`：39组观察，涵盖八方向跑步、八方向慢速移动、近战 / 远程、六组三类装备组合、施法、暂停。完整身体只有一个Sprite；装备改变属性但不换人物图集。
- `node scripts/browser-hero-impact.mjs`：由真实敌人攻击触发受击和死亡，采到倒地列3–7全部五帧，淡出后回收；失败面板等待1.2秒，未盖住倒地动作。
- `pnpm test:scenes`：52项，两种输入、两张地图的营地与商人交互；正常买入更新金币与六栏。
- `pnpm test:hitboxes`：94项，指针方向挥击 / 飞弹、六栏同类并存、形式余烬与碰撞规则。
- `pnpm test:multiplayer`：21项，真实双浏览器房间码、独立奖励与集合、移动、重连、新房主恢复。
- `pnpm test:art`：111项，36张图集加载、本地图像、怪物 / Boss / VFX及UI；不代表角色纹理已达到最终像素规范。
- `inspect-pixel-art.py --check`：36张生成定义一致，源PNG像素未修改；skill quick_validate通过。

证据：`reports/whole-hero/`中的构建 / 检查日志、`result.json`、`impact.json`、八方向截图和`runtime-directions.webm`；通用回归报告为`reports/browser-scenes.json / browser-hitboxes.json / browser-multiplayer.json / browser-art.json`。审阅过正常营地人物、装备组合攻击、倒地终帧和商店画面。

固定画布切片保留原有起伏，没有逐帧缩放人体；背景PNG仍是既有明亮遗迹，本轮没有重制场景。图像包含高分辨率细节与分数alpha，手形 / 衣褶 / 步态一致性仍需ART-08精修；五绘制方向通过三镜像形成八方向，不声称八套独立手绘。四人公网、GPU帧时压力与最终严格像素网格未覆盖。
