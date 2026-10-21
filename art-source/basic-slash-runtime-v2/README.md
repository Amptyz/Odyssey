# 普通近战：透明光流纹理修订

> 历史方案，实机造型已被用户否定。运行资源已移除，当前实现见 [runtime-v3](../basic-slash-runtime-v3/README.md)。下文保留当时的做法与检查记录，不能作为当前判定或美术验收依据。

2026-10-21。用户否定v1的实机效果：几条平行灰带和黑色扇形线框偏离[v7定稿](../basic-slash-v7/README.md)。本次删除旧的七层曲线带，改用内置 image_gen 生成的透明光流纹理，再由Cocos材质沿实际挥击展开。此记录表示修订已接入及代理检查结果，不表示用户已认可新版美术。

## 资源与制作

- `white-flow.png`：选中素材，2172×724 RGBA，宽亮的右端为当前斩头，左端为旧尾迹。生产PNG是工具输出的原样副本，未用脚本重绘、抠图或将黑底概念图变成伪透明素材。
- `texture-final.prompt.txt`：选中素材完整Prompt；`generation.json`记录来源、sha256和alpha统计。`white-flow-candidate-1.png`为未采用的第一张候选，头部偏窄。
- 运行PNG：`EmberDemo/assets/resources/art/melee-v2/white-flow.png`；Creator 3.8.8实际导入生成meta。
- `effects/melee-flow.effect`以[0.01,0.20]–[0.995,0.76]的UV窗口采样源图。纹理灰度表示光密度，经alpha合成白色光，避免灰色油漆感；旧尾迹另外按年龄减弱。使用线性过滤控制连续旋转的细边，不宣称严格像素网格；角色像素图仍保持最近邻。

## 播放、范围与生命周期

`MeleeVfxTimeline`保留实际Swing前摇 / 生效 / 结束和渲染插值。材质将横向纹理连续弯成实际弧度；当前头更厚更亮，尾部按路径收细变透。不复制八方向PNG，不由图片定义伤害，也不增加身体动作帧。概念图的近整圈轨迹并未照搬：实际仍是基础117°扇区，射程读取Swing.radius。

`MeleeVfxView`使用同一CollisionWorld的shapeContours作为Stencil，限制所有刀光像素在真实扇区及遮挡范围内。完整生效区在人物下方以向中心减弱的低对比明暗显示，不再画黑色三角线框；F3继续保留精确调试边界。生效结束即撤掉底层范围，最多保留0.12秒低亮余迹。挥空没有命中爆点，爆点只关联真实伤害cue。

每个同时存在的挥击复用一组Sprite / Mask / Material，全角色共用一张纹理。素材与材质由ArtLibrary持有并统一销毁；暂停、重开、切图和中断沿用原时间线清理。敌方危险提示仍在友方刀光上方。

## 本次检查

- `pnpm check`：34个文件、427项通过；包含16方向扇区 / 遮挡轮廓、时间插值、暂停、重开、双玩家独立来源和真实命中。
- Creator 3.8.8 Web Desktop实际构建；`scripts/browser-melee-review.mjs`捕获两个方向的前 / 中 / 后段实机图，浏览器错误为0。见[画面检查](../../reports/melee-vfx-v2/review.json)。
- `pnpm test:melee`通过30项：实际新渲染器、正常营地 / 余烬 / 出发后的鼠标攻击、16方向、暂停、射程变化、高攻速、重开、真实命中；`pnpm test:hitboxes`通过94项。两项浏览器错误均为0，见[运行报告](../../reports/melee-vfx/runtime.json)和`reports/browser-hitboxes.json`。

已检查浅色地面上的头部宽度、内部交叠、透明尾迹和线框移除。身体精修、停姿 / 声音（ART-15）、元素变体（ART-14）、四人网络与GPU压力仍另行验收。不能用程序检查数量替代用户对造型和打击感的评价。
