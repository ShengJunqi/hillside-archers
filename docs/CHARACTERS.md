# 添加角色和技能

目前仍使用现有的青松、赤岩，尚未增加角色选择页面。先维护原有主线和三张弓的入口；不要为角色扩展清空旧存档。

## 三种独立来源

| 来源 | 配置／状态 | 生命周期 |
| --- | --- | --- |
| 角色初始天赋 | `combat.mjs` 的 `CHARACTERS`，`player.skills.initial` | 角色携带；每场的使用次数在 `skills.used` |
| 选择的弓术 | `core.mjs` 的 `BOWS`，`player.skills.weapon` | 本次远征；现有 `game.skill` 继续兼容 |
| 额外遗物能力 | `UPGRADES`、`game.upgrades`、`player.skills.extra` | 远征中叠加，重开清除 |

现有「沉着」在 `turnSkillHealing()` 执行：当自己的回合到来，首次生命不高于 35% 时回复 10 点。青松和赤岩都有此天赋，同机双人仍对称。

## 新增步骤

1. 在 `CHARACTERS` 添加稳定 ID、名称、天赋 ID 与玩家能理解的说明。在对应回合／命中处理函数实现天赋的实际效果；不要只显示说明。
2. `Game.start(mode, stage, bowId, characterId)` 接收角色 ID；未识别的 ID 回退为青松。现有入口省略该参数时继续正常工作。
3. 角色美术在 `render.mjs` 根据 `player.characterId` 选择。四肢沿用 `body.mjs` 的骨段和约束；若改变尺寸，碰撞体与插箭附着也要一起调整。
4. 远征取得能力时，保留初始天赋和已选弓术；让 `skills.extra` 跟随 `game.upgrades`。需要额外主动技能按钮时，要明确释放时机、多指取消和冷却，不复用蓄力松手事件。
5. 新敌人技能通过 `Game.damage()` 结算，保留 NPC 伤害预算。元素持续伤害传入真实来源，不能绕过预算。强敌可增加战术、耐久和命中压力，避免无预警的一轮秒杀。

验证至少覆盖旧存档、初始技能一次性触发、远征叠加／重开、同机双人、NPC 多箭与元素预算，以及受击后正常交回控制。运行 `npm run build` 和 `npm test`，提交更新后的离线版。
