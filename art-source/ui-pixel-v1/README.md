# 像素遗迹 UI 候选 A

2026-10-16，为用户选择 UI 方向制作的七张独立完整屏幕；**候选设计，尚未定稿或接入游戏**。风格依据 [ART_DIRECTION](../../docs/ART_DIRECTION.md)，布局及具体色值仍可调整。完整说明与七图预览见 [UI_DESIGN](../../docs/UI_DESIGN.md)。

| 文件 | 覆盖 |
| --- | --- |
| [01-combat-hud.png](01-combat-hud.png) | 自己的 HP / MP、四项属性、QWER 技能 CD、队友、六格装备 |
| [02-augment-choice.png](02-augment-choice.png) | 增益三选一、收益比较、联动、当前技能、队友确认 |
| [03-shop.png](03-shop.png) | 货架、商品详情、金币、购买后属性预览、六个通用装备栏 |
| [04-main-menu.png](04-main-menu.png) | 首页、单人、创建 / 加入房间、设置 |
| [05-create-room.png](05-create-room.png) | 昵称、人数说明、创建房间、高级连接折叠 |
| [06-join-room.png](06-join-room.png) | 昵称、六位房间码、加入、恢复入口 |
| [07-room-lobby.png](07-room-lobby.png) | 四人卡、房主、在线 / 重连 / 空位、复制码、开始等待 |

- 工具：内置 `image_gen`，共 7 次独立生成 + 1 次 HUD 定向修正；未使用 CLI / API、程序绘图或外部 IP。
- 实际 PNG：每张 1672×941（约 16:9）；1280×720 为构图目标，未重采样成精确生产尺寸。
- 最终提示词、参考图角色和真实来源见 [prompts.md](prompts.md)。[首次 HUD](sources/01-combat-hud-before-equipment-fix.png) 保留作修改记录，最终图修正了六装备栏。
- 已逐屏目视检查布局、主操作中文、4 技能 / 6 装备栏 / 4 队员；仍有“烬 / 绽 / 垒”等字形变体、地图名误写、背景局部景深模糊。正确命名与能力差异见 UI_DESIGN，不能直接切图入库。
- 没有修改游戏源码、运行时资源或 Cocos 导入配置；未构建和执行玩法测试。

