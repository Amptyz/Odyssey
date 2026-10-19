---
name: ember-enemy-ai
description: 在 Project Ember / Odyssey 中配置或扩展敌人决策、多人选目标、出招节奏、冷却、连招和 Boss 行为，并验证实际运行效果。适用于敌人行为逻辑；纯贴图制作或仅改属性数值不必使用。
---

# 配置余烬试炼敌人 AI

在包含 EmberDemo/assets/scripts/ember/ 的 Odyssey 仓库工作。先读根 AGENTS.md 和 [docs/ENEMY_AI.md](../../../docs/ENEMY_AI.md)，后者是已实现字段及边界的维护入口。下列源码路径相对于该源码根目录，命令在仓库根目录运行。

## 将需求落到真实配置

明确可观察行为：什么条件选谁、什么时候锁方向、整招后停多久、等待时是否移动、下一招失败如何处理。“换一个人”要区分优先避重复与严格禁止，明确单人回退；“内置冷却”要区分单招 / 公共 / 组 / 点名，明确起手 / 生效 / 收招起算和打断消耗。

- content/enemies.ts：属性、体型、距离控制、actionSet，可选ai引用profile。新增怪物接入地图groups，不能只在F2出现。
- content/enemy-actions.ts：前摇、分段采样、碰撞 / 伤害、cooldownPolicy、recoveryMovement、pauseAfter / pauseMovement。
- content/enemy-behaviors.ts：优先级规则、条件、目标策略、序列。参考实际emberRam.pressure；不要把配置当任意脚本语言。
- ai/EnemyDecision.ts 与 simulation/EnemySystem.ts：仅在配置无法表达新机制时扩展，同时补类型、启动校验、快照和行为测试，不在GameWorld添加敌人ID特判。

普通规则、序列、Boss时间轴均走统一执行门槛，不通过直接调用start / damage绕过CD。下一步不可执行时使用有限等待、跳过或中止。保持当前目标与本招锁定点分离，换人不能移动已出现的预警。

## 容易误配的语义

- 时间为模拟秒，不用setTimeout、Date.now或动画结束回调调度战斗。
- 共享配置只读；每只敌人的记忆 / 次数 / CD / 序列放运行状态，联机由房主计算。
- 先筛选该招合法目标再排序，不能选了打不到的人就放弃整招。保持时间 / 重选边界仅保护仍合法目标；target步骤授权下一招强制重选，仍检查距离、视线和CD。
- avoidLastTarget不是绝对禁重复；严格等待需fallback:'wait'和超时或其他规则回退。
- 普攻周期来自攻速，技能单招CD默认受急速影响。pauseAfter和紧随的序列wait同时计时，不自动累加。
- once在规则接受时消耗，打断 / 返巢 / 转阶段不退还；动作CD退款不退规则once / cooldown。
- 攻击几何经scaleAttackRange链路转换一次；条件distance和保持距离使用有效世界单位，不自动乘倍率。
- 全局移速 / 弹速看content/tuning.ts及docs/GAME_FEEL.md；ENEMY_ACTIONS里的弹速是基础值，生成时统一乘全局倍率，不能重复乘。冲锋专用速度不属于普通移速倍率。
- Boss时间轴点名用profile.timeline.targeting（默认leastTargeted），不是profile.targeting；不可用时timeline.unavailable选择skip或限时wait。当前没有仇恨值、概率权重、递归行为树，需要时先实现再配置。

## 验证与交付

用已有夹具或EnemySystem(map,profiles,actions)注入隔离配置编写测试，避免修改共享生产注册表。验证实际动作 / 命中 / 计时边界，不能只断言字段存在。

按需求覆盖停顿与移动，多人候选 / 单人回退 / 目标死亡，序列和时间轴不绕CD，打断、等待超时、暂停 / 重开及实例隔离；快照不泄漏Actor / Map / Set。

运行pnpm check。可见行为变动需Creator构建后运行pnpm test:enemy-ai或对应回归，通过F2「敌人AI」检查规则、目标、步骤、CD和拒绝原因。?debug=1的__EMBER__仅用于诊断，浏览器验证用输入 / 已验证开发命令操作，不直接修改世界对象。

更新docs/ENEMY_AI.md及涉及的扩展入口和实现记录，说明接入配置、实际验证与未覆盖范围；不把计划写成已支持能力，不自行推送。
