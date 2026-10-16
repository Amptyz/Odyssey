# 新增八件装备：程序外观接入

> 2026-10-16 美术方向更新：后续按 [像素遗迹风](../ART_DIRECTION.md) 与 [像素特效规范](../PIXEL_VFX.md) 制作。本文既有数值、身份、挂点和历史程序外观记录继续有效；现有 PNG / Graphics 尚未像素化，旧验收不代表像素迁移通过。

本次使用 Cocos Graphics 绘制低细节部件，没有生成 PNG、没有新增或复用图集帧冒充新素材。制作工具为 TypeScript 与现有 HeroRig；未使用图片生成/编辑工具。图形定义在 `content/appearances.ts` 的 `PROCEDURAL_EQUIPMENT`，一次装备时由 `render/EquipmentVisuals.ts` 绘制，随后只随骨骼变换，不逐帧重绘。appearance ID 与八件装备 ID 相同。

| appearance | 主要识别点 | 部位与原点 |
| --- | --- | --- |
| reaver | 偏厚短刃、暗红单槽、短铜护手 | weapon，掌心(0,0) |
| runeblade | 宽直石刃、尖端、单蓝槽 | weapon，掌心(0,0) |
| duelistVest | 窄铜肩片、对角深带 | body，(0,27) |
| wardMantle | 灰蓝下披、两块圆钝厚肩 | body，(0,27) |
| sanguineWrap | 暗红短衣、浅色交叉布带 | body，(0,27) |
| keenVisor | 扁宽浅金属面带、单深色缝 | head，(0,47) |
| sageMask | 单侧石面、非发光折裂 | head，(0,47) |
| aegisCrown | 低石冠心、两侧钝苔石 | head，(0,47) |

所有部件使用暖深轮廓与少量大色块。新增头饰保留口鼻及至少半侧眼部；衣甲覆盖固定肩缝，基础肩骨坐标不动。部位胜出顺序仍由装备系统提供 `EquipmentAppearanceLoadout`，不能因为六栏同时持有多件而叠出六把武器。

两新刃保持 `shape:sword`。共用右肩 `(9.5,34.2)`，从既有 arm anchor/grip 推导本地掌心；Graphics 顶点已以掌心为零点，不设 PNG 锚点。肩旋转与原右臂完全相同，腕旋转围绕零点，因此左右整体镜像、待机、步行和攻击均不改变握把与掌心的重合。现有最大步行动作肩摆约 ±15.2°，剑攻击肩摆峰值85°、腕转−120°；短刃长至27、石刃长至32单位，不超过旧剑握点上方约33.6单位。头/身装备保留原遮挡层级：衣甲在肩接头上、头饰在头部上，武器保持前景掌层。

蓝槽为静态低亮色块，不冒充符击蓄能状态；实际符击状态与伤害由装备逻辑负责。本轮未添加持续光环、新材质或 shader，程序外观不改变碰撞、武器射程和伤害。若后续需蓄能闪烁，应由纯快照驱动独立提示，而非从贴图颜色推断状态。

已执行：Cocos 类型检查与 `tests/equipment-visuals.test.ts` 四项专项（八件独立几何/非伪图集、握把与刃连接、肩缝覆盖、头部留白）通过。父任务已完成 Creator 导入与包含装备模板的 production 构建；本次浏览器结果见 [browser-equipment.json](../../reports/browser-equipment.json)，时间为 2026-10-16T09:18:36.772Z，51 项通过、errors 为空。该运行覆盖八件正常购买/详情只读/入战及独立 F2 混搭、暂停和被动触发，开发者场景不混作正常获得证据。

本次逐图查看八件各自的 `reports/eq-{id}-shop.png` 与 `reports/eq-{id}-details.png`（共16张），确认厚短刃红槽/宽石刃蓝槽、三种衣甲、三种头饰均有独立轮廓，部位替换正常。又查看 `reports/eq-mix-{1,2,3}-{right-attack,left-attack,walk}.png` 九张：未见两刃脱手、肩缝断开、镜像后部件遗漏或头饰遮住整张脸；两刃颜色槽与弓形可辨，衣甲仍盖住接头。另查看 [960宽详情](../../reports/eq-details-960.png)，正文/预览/返回按钮未被裁切。代表性证据：[符刃详情](../../reports/eq-runeblade-details.png)、[石披单穿](../../reports/eq-wardMantle-shop.png)、[左向符刃](../../reports/eq-mix-2-left-attack.png)、[裹衣石冠与弓步行](../../reports/eq-mix-3-walk.png)。

验收边界：这是八件代码原生 Graphics 外观，不是八张新 PNG；较平整的大色块与棱角属于本轮简化方案。截图能确认采样姿势中的握点/遮挡与界面可读性，不能单独证明每一帧的连续流畅度、所有18件混搭或所有分辨率。未发现需阻塞本次交付的可见缺陷，未因此修改产品源码。
