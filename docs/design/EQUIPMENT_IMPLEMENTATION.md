# EQ-02：18件装备与独立被动实施记录

日期：2026-10-16。依据：[六栏装备设计v2](EQUIPMENT_DESIGN.md)、[统一属性契约](../ATTRIBUTE_SYSTEM.md)、[属性实施](../ATTRIBUTE_IMPLEMENTATION.md)。本文记录本次实际逻辑；Creator、浏览器及外观的最终结果见[整体验收](../../reports/equipment-validation.json)，不将纸面DPS当作实测。

## 完成范围

原10件保留，新增8件全部进入同一固定商店和F2目录：

| ID | 分类 | 统一modifiers加成 | 被动 |
| --- | --- | --- | --- |
| reaver | weapon | AD8、全能吸血.06 | 无 |
| runeblade | weapon | AD6、AP18、急速8 | 符击 |
| duelistVest | body | AD3、额外AS.16、暴击.18 | 无 |
| wardMantle | body | HP55、MR20 | 石息 |
| sanguineWrap | body | HP45、AD6、全能吸血.06 | 无 |
| keenVisor | head | AD8、暴击.18 | 无 |
| sageMask | head | AP20、固定魔穿10 | 无 |
| aegisCrown | head | HP55、MR22 | 无 |

全部100金币，六栏任意分类，同ID一次购买/一次穿戴。8件用`modifiers`，旧`stats:{}`兼容字段不重复提供属性。两新武器复用sword攻击形状/时序与2.5格profile；属性、外观按已装备集合及原始purchaseOrder选择，旧物重装不变购序。8个appearance同装备ID，表现分支提供本地程序化形状；不伪造图集切片、PNG或meta。

`equipmentDetails(id)`从实际被动配置生成完整公式、时长、内部CD和资格说明，普通物品返回短description。商品短文保持两行范围，完整规则由父任务详情弹层展示；面向玩家只说同名被动一份，不展示内部group键。

## 接口与职责

- `content/equipment.ts`：18件、`EquipmentPassiveDefinition`（spellblade/safetyShield两种通用行为）、参数与表达式。新增效果不塞进PERKS或领取海克斯集合。
- `simulation/EquipmentEffectSystem.ts`：每actorId/唯一group独立状态，`sync`挂载/卸装、`beginAttack/endAttack`锁定/释放、`onEvent`消费、`resetEncounter`清关，`snapshot`返回普通数组副本。新模块的Map迭代显式`Array.from`，兼容Creator转译。
- `CombatEngine`：`CombatHooks.onEvent`在实际预留并处理的事件上观察；Hit/Event携带可选attackId。统一结算伤害、盾、吸血、root/depth/事件预算；带parent的shield先检查预算，再创建独立盾并排入OnShield。`removeShield`只移除此来源/ID的盾，不影响其他技能盾。
- `GameWorld`：装备变更同步模块；原始普通攻击出手分配attackId并锁定，实际挥击/弹体命中携带该ID；挥空、墙、飞完、取消或来源死亡清该实例锁。没有按8个具体装备ID分支。
- `Hit/CombatEvent.damageSourceTeam`：原伤害来源阵营快照。CombatEngine优先取存在单位的真实team，来源已移除时才用Hit快照；OnDamaged交换source/target ID时保留该快照。GameWorld旧弹体enemy标记与EnemySystem已有Bullet.team传入，避免敌弹发射者移除后石息失去敌对身份。不能靠cause字符串假扮敌人。

## 符击的实际时序

成功OnSkillCast且内部CD就绪时获得5秒未出手蓄能，重复施法只刷新同一份。直接普通攻击在释放时锁定资格、`8+.20×总AD+.12×AP`采样值和所属攻击ID。已锁定攻击不在后续施法时重新取系数，也不会赋予先前未获资格的旧箭。

**5秒限制尚未出手的蓄能，不清除已在飞行的锁。** 例如4.9秒发箭、5.2秒命中仍有效；未命中结束解锁后，只有尚未过期的蓄能能供下次攻击使用。多个同时在飞的箭只有最先锁定者可消费；其他箭不能偷走它的资格。取消/挥空/撞墙不进3秒CD。

首个成立的直接普攻命中消费一次，扇形按CollisionWorld稳定目标顺序；攻击本体击杀也消费并启动CD，但不对尸体补伤或发放符击吸血。免疫没有成立命中，不消费；全盾吸收的成立命中可消费。3秒内部CD从消费时刻算，急速/秘术冲拳不缩短，CD期间施法不排队预存。

附伤走CombatEngine，magic/proc，canCrit=false、appliesOnHit=false、vampEligible=true，继承普通命中的rootId/depth+1。台风、虚幻武器和其他派生OnAttackHit没有原始锁资格，不会多触发。其真实附伤/全能吸血仍遵循既有合法规则和事件预算，不重复缩放已采样AD/AP。

## 石息的实际时序

实际敌对伤害失HP后的OnDamaged，保存的结算后生命满足`0<hp<.5×maxHP`且装备者仍活着时，创建`18+.05×触发时自身maxHP`通用盾，HSP作用一次，持续3秒、内部CD18秒。处于低血的后续受伤也能触发，不只认第一次越线；精确50%、友方/自伤、仅打盾、换装截断、波间恢复和致死伤害都不触发。

同一来源组盾按独立实例与技能盾共存、独立到期；施盾不是治疗、不产生OnHeal、没有暴击或吸血。盾不能倒吸收使它触发的那笔伤害。root深度/预算不足时不发盾、不启动CD。

## 生命周期、多人和恢复

- 每玩家独立两组状态、CD、蓄能和锁。来源读取实际playerId；source仍存在时，伪造damageSourceTeam不能把友伤当敌伤。
- 暂停/商店/奖励的模拟时间冻结，内部计时使用GameWorld.time。卸装丢掉蓄能、锁及装备自身盾，但保存该组readyAt；重装不刷CD、不补HP、不赠盾。断开参与前先清该玩家的蓄能/锁/装备盾，再移出actors；保留CD防重新接入套利。
- 新关resetEncounter清蓄能、锁、装备盾与内部CD；死亡不能触发自救盾。重开是新世界，无遗留状态。
- 只读WorldSnapshot.equipmentPassives含group/kind/readyIn/armedFor/lockedAttackId，父任务将其映射到本地与真实relay客机HUD；协议由父提升至ember-coop-4。
- checkpoint继续v3，结构不变：只保存稳定阶段/关起点。18件及购买顺序按原ID恢复，重建每关初始状态，无战斗中任意帧保存的承诺。旧10件v3恢复点仍可用，不凭空加新装备或新属性。

## 验证证据

本次执行：

```text
pnpm exec vitest run tests/simulation/equipment-effects.test.ts
→ 27项通过
pnpm check
→ 核心/Cocos/工具类型检查，20文件263项Vitest，核心编译全部通过
```

新27项包括18件配置/详情、各分类6件混搭与全部来源、暴击与吸血相加、释放系数采样、普通命中root归属、非暴击魔法proc、过期前真实弓箭跨截止命中、多在飞箭、出手后施法不追溯、真实墙与挥空释放、扇形首目标、冲刺取消、免疫/全盾/击杀、两玩家符击/石息CD隔离、精确50%/致死/友伤边界、技能盾独立到期、卸装重装、死亡之环有限链、深度预算、暂停/跨关/checkpoint，以及真实EnemySystem弹体在发射者删除后仍按敌对伤害触发石息。

首轮完整检查仅旧货架数量断言10与新18不符，已更新该预期，不改战斗数值维持旧脚本；上述最终pnpm check是更新后重新完整运行的结果。差异空白检查通过。产品源码已于17:13后冻结供父任务构建；后续只补测试/文档，如有产品修复须再次通知并重构建。

未在本逻辑分支声称的结果：真实Creator导入meta、最终production构建、18件分页/详情/动作外观、普通购买与多人浏览器回归；它们由父/表现分支执行并在总交付报告记录。纸面算表是平衡上界，不代表新8件或海克斯组合已完成全部实战调优。
