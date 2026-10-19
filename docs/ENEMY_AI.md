# 敌人行为配置

这里描述已接入的决策接口。配置是编译期 TypeScript；修改后检查并重新用 Creator 构建。F2 是检查器，不是运行时配置编辑器。可使用 [ember-enemy-ai skill](../.agents/skills/ember-enemy-ai/SKILL.md) 配置敌人行为。

## 注册与调度

| 文件（相对于 EmberDemo/assets/scripts/ember） | 职责 |
| --- | --- |
| content/enemies.ts | 属性、体型、距离控制和 actionSet；可选 ai 引用行为 ID，默认与 actionSet 同名 |
| content/enemy-actions.ts | 前摇、分段几何 / 伤害、冷却、收招移动和额外停顿 |
| content/enemy-behaviors.ts | ENEMY_BEHAVIORS：目标策略、优先级规则和序列 |
| ai/EnemyDecision.ts | 每只敌人独立的目标记忆、规则次数、CD 与序列状态 |
| simulation/EnemySystem.ts | 固定步进、共用执行门槛、预警、命中、弹体与导航 |

所有17种敌人已接入。已有动作 → 转阶段 / 硬控 / AI冻结 → 守区返巢 → 动作额外停顿 → 已有序列 → Boss时间轴 → 优先级规则 → 接近 / 后退 / 侧移。Boss保留 enemies.ts 的阶段循环，时间轴提交技能、规则填补空档；所有入口都经过相同的距离、视线、安全和冷却检查。

动作执行时不重选本招目标，不重写预警。目标死亡也不会把已预警招式转给队友；新动作筛选存活目标。冻结AI禁止新步骤 / 追击，已起手动作和弹体继续，等待及CD仍经过模拟时间；全局暂停不推进模拟时间。

## 目标策略 targeting

规则上的 targeting 可覆盖 profile；序列的 target 步骤可覆盖后续步骤。

| 字段 | 含义 / 默认 |
| --- | --- |
| strategy | 必填：nearest最近、farthest最远、leastTargeted本敌人点名次数最少 |
| reconsider | decision每次决策；actionEnd收招后；sequenceEnd序列结束后；默认decision |
| minHoldSeconds | 当前目标仍合法时至少保持多久，默认0 |
| switchDistanceRatio | 最近目标切换阈值(0,1]，默认1；0.75表示新目标距离至多为当前的75% |
| avoidLastTarget | 重选时优先避开本敌人上一招目标，默认false |
| fallback | 没有其他合法目标时：current保留当前、nearest选最近、wait本次不出招；缺省允许重复 |

先筛选存活、距离、视线、CD及规则条件，再排序。点名次数相同时按距离排序，最终按玩家ID排序，无随机分支。点名计数从动作起手累计，含普攻和未命中动作，属于各只敌人。当前目标仍合法时，保持时间和重选边界优先于普通重复规避；目标死亡、出界或被本招点名CD排除时可立即换人。

序列target步骤显式授权下一招重选，跳过保持时间 / 重选边界，仍检查合法性。该步骤到下一招实际能起手时才锁定目标。

Boss时间轴使用profile.timeline.targeting，默认leastTargeted；profile.targeting仍用于普通规则和追击。timeline.unavailable默认skip，改为wait可等待就绪，timeout默认2秒，从该时间点应执行的时刻起算，超时跳过；进入新循环会清理旧循环的待执行时间点。等待期间仍可接近目标，暂不执行普通规则。阶段阈值和循环时间点仍配置在enemies.ts的boss字段。

## 优先级规则 rules

id和priority必填；恰有一个action或sequence请求。高优先级先尝试，同优先级按声明顺序。请求无法起手时尝试下一条规则。

- when.hpRatioBelow / hpRatioAbove：生命比例严格小于 / 大于阈值。
- when.distance:[min,max]：候选目标的有效世界距离闭区间，不自动乘攻击范围倍率。
- when.phase:1|2：Boss当前阶段，普通怪为1。
- when.minPlayers：参与战斗且存活的玩家最少数量。
- once:true：每只敌人本次遭遇只接受一次；打断、返巢、转阶段不退还，关卡重置清理。
- cooldown：规则被接受后起算的间隔秒数，不受急速影响，不等同于招式CD。

序列规则接受前检查第一个action能否施放，前置wait不绕过该门槛。规则targeting适用于整个序列；when仅在序列被接受时检查，后续每招仍重新检查执行门槛。普攻预留即将就绪的特殊技能 / 时间轴窗口，已消费的once和不满足条件的技能不会永久阻止普攻。

## 序列 sequences

每序列最多32步，至少含一个action，不支持递归 / 嵌套。下面是苔角冲阵者实际使用的配置：

```ts
sequences: {
  pressure: [
    {kind:'action',action:'ramLane',unavailable:'abort'},
    {kind:'wait',seconds:0.6,movement:'stop'},
    {kind:'target',policy:{strategy:'leastTargeted',avoidLastTarget:true,fallback:'current'}},
    {kind:'action',action:'ramButt',unavailable:'wait',timeout:1.5,afterTimeout:'skip'},
    {kind:'wait',seconds:0.45,movement:'stop'},
  ],
}
```

对应规则：`{id:'pressure',priority:50,when:{distance:[2,14]},sequence:'pressure'}`，另有普攻回退。换人后的近战目标必须在可攻击范围内；单人时允许重复选人。

- action等待整招完成，不能绕过任何CD。
- wait的movement默认stop；chase按正常速度追逐当前存活目标。
- action.unavailable默认wait，也可skip / abort。等待上限timeout默认2秒，afterTimeout默认abort，也可skip。从进入步骤开始计时，等待不可执行动作时原地停留，没有自动接近该动作目标的步骤。
- target策略保留到序列结束；下一动作不能执行时按该动作的等待 / 超时策略处理。
- 动作pauseAfter和紧随的wait同时从动作结束计时，取更晚结束时间；若想累加，用一个统一的更长wait。
- 死亡、硬控打断、返巢、阶段转换结束序列；已发弹体继续。中止后下一逻辑步重新决策。

## 动作与冷却

全局手感参数位于content/tuning.ts：目前普通移动与弹体速度均为原来的1.5倍。招式shape.speed是基础弹速，生成时统一应用projectileSpeed，不能在配置中重复乘倍率。范围和冷却不随弹速增加；详见 [全局速度与镜头](GAME_FEEL.md)。

windup为前摇；普攻完整周期为1/attackSpeed，前摇 / 命中时间随攻速向下缩放。技能计划总时长为windup+recovery，二阶段可用phase2Duration；所有段执行完才结束。多段招式不是“最后命中后再加recovery”。最终收招后固定空档用pauseAfter。

| 新字段 | 语义 |
| --- | --- |
| recoveryMovement | stop / chase；缺省普攻收招可半速追击，技能原地。chase在目标超出普攻距离时才追击 |
| pauseAfter | 整招实际结束后禁止新动作的秒数，默认0 |
| pauseMovement | 额外停顿时stop / 半速chase，默认stop |
| cooldownPolicy.start | start起手、impact第一段生效（不要求命中）、end整招结束，默认start |
| cooldownPolicy.seconds | 覆盖单招CD；技能默认用cooldown，普攻取该值与1/AS较大值 |
| cooldownPolicy.affectedByHaste | 技能单招CD默认受技能急速影响，false关闭；普攻使用攻速。其他CD秒数不受急速影响 |
| cooldownPolicy.globalSeconds | 本招触发的公共CD，未填用profile.globalCooldown，默认0 |
| cooldownPolicy.group:{id,seconds} | 本敌人共享组CD；同组动作各自声明相同id，建议统一时长 |
| cooldownPolicy.targetSeconds | 本敌人、本招、该玩家的点名CD，默认0 |
| cooldownPolicy.consumeOnInterrupt | 默认true：保留已开始的CD，尚未计时则从中断时起算；false恢复起手前各CD截止时间 |

四类动作CD共用start事件选择，各自时长独立，每次只提交一次，不随多段命中刷新。弹体impact为发射时刻，延迟落点为生效时刻。挥空消耗CD，返巢不清CD。firstDelay从唤醒开始，所有配置引用动作均支持；Boss新阶段重排未用技能初始时间，不清除已用技能CD。规则once / cooldown不受动作CD退款影响。

## 验证与诊断

validateContent检查profile / action / sequence引用、规则唯一ID、时间和区间。新机制同时扩类型、处理器、校验和测试，不能只添加字段。

```powershell
pnpm check
# Creator 3.8.8 构建 Web Desktop 后保持 pnpm play 运行
pnpm test:enemy-ai
```

核心测试：tests/enemy-decision.test.ts、tests/monster-system.test.ts。复杂配置至少覆盖正常出招→停顿 / 换人→下一招，冷却不能绕过，单人回退 / 目标死亡，打断 / 等待超时，以及暂停 / 重开和每只怪状态隔离。多人点名用真实第二玩家验证，不能只检查字段。

F2 →「敌人AI」查看profile、当前 / 本招目标、规则、序列步与等待剩余、额外停顿和CD。单帧步进需先应用测试配置。blocked:action / global / group / target / rule表示CD；range / line-of-sight / warning-budget / no-escape表示执行条件。enemies.units[].decision为隔离纯数据快照，不能用于修改AI。

当前无仇恨值、概率权重、巡逻搜索、递归行为树、实时配置导入；这些需要另扩运行时接口。
