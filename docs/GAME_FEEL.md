# 全局速度与镜头

统一调节入口：`EmberDemo/assets/scripts/ember/content/tuning.ts` 的 `GAME_TUNING`。修改后运行检查并重新构建 Creator Web Desktop。

| 参数 | 当前值 | 作用 |
| --- | ---: | --- |
| moveSpeedMultiplier | 1.5 | 全单位普通移动速度增加50%；在统一速度点换算处应用一次，保留装备、减速和软阈值关系 |
| projectileSpeedMultiplier | 1.5 | 玩家普攻、技能、余烬飞弹和所有敌方弹体统一加快50%，保留各招基础速度差异 |
| cameraZoom | 1.25 | 等距投影、角色、怪物、环境、交互物与装饰特效一起放大25%，HUD保持原大小 |
| cameraFollowHalfLife | 0.1秒 | 镜头每0.1秒收敛一半剩余距离；调大更柔和，调小更紧跟 |
| cameraSnapDistance | 12格 | 大跨度传送直接重定位；进新场景、重开、换本地玩家及恢复也直接重定位 |

`MOVE_SPEED_SCALE = .01 * moveSpeedMultiplier`。玩家基础 rawMS421.25 经软阈值为420点，目前基准6.3格/秒；苔刃精灵4.68、霜足跳兽5.94格/秒。属性面板的速度点仍是软阈值后点数，worldMoveSpeed是含减速的基准格/秒，实际方向速度还要经过下述投影补偿。固定单位继续使用canMove:false，MS0仍遵循已有低速软阈值。冲刺距离 / 技能专用冲锋速度不乘普通移速倍率。

## 上下、横向与斜向的视觉速度

原先固定世界速度，经54×28等距投影后，上下屏幕速度只有横向的28/54（约52%）。现在 `GROUND_PROJECTION` 统一提供渲染和移动使用的宽高，`utils/GroundMovement.ts` 按方向补偿压缩，以原横向速度为基准，各方向屏幕速度一致，斜按两个方向不额外加速。

玩家WASD、右键路径移动与敌人普通追逐 / 退避 / 返巢使用同一补偿。右键加速与终点减速按投影后的距离计算；敌人攻击的可逃离性检查也按对应方向的实际步行距离判断。属性、加速与减速只应用一次；按键松开、不可移动标志、世界坐标扫掠碰撞和到点停止继续生效。

玩家普通横向基准仍为6.3格/秒，纵向世界位移约12.15格/秒，放大1.25时二者均约300.7设计像素/秒。`worldMoveSpeed / stats.speed` 保留为横向基准，`velocity` 表示实际方向速度。相机平移、平滑跟随和zoom不参与方向补偿，调整zoom时各方向同步缩放。技能冲刺、敌人技能冲锋与飞行道具仍按各招自身的世界距离 / 速度定义。

所有弹体在生成时调用 `projectileSpeed(base)` 一次，并用实际速度计算存活时间 `range / speed`，因此射程与伤害不随加速增长。飞弹的距离加成仍按实际飞行距离计算；碰撞仍采用连续扫掠，不用更快速度跳过墙或角色。方向预警时刻及技能冷却没有随弹速改变。

镜头用独立的 `SmoothCameraFollow` 对插值后的本地玩家位置做指数跟随，按渲染dt计算，响应不依赖FPS。平滑跟随允许玩家移动时略微偏离中心，停下后自然回到中心。暂停时保持镜头，场景切换 / 重开直接定位，避免跨图长距离滑动。

每帧顺序必须保持：准备一次平滑Projection → InputController用它做鼠标反投影 → ArenaView用同一Projection绘制。不在ArenaView.update再次更新相机，否则输入会使用不同的原点。WASD仍按屏幕方向移动，右键仍对应实际点击的地面。

验证：`pnpm check`；Creator构建后运行 `pnpm test:movement`，用真实WASD组合键和右键测量八方向屏幕位移、松键与到点停止，并抵消镜头跟随对测量的影响。`pnpm test:feel`覆盖镜头滞后与收敛、移动中的准星、实体缩放、重开定位及真实敌弹速度；`pnpm test:scenes`回归F交互与两图休息点。`tests/movement-directions.test.ts`验证方向速度、减速 / 模拟量、碰撞、敌人步行及固定步进；`tests/game-feel.test.ts`另验证30/144FPS镜头响应、传送与射程保持。
