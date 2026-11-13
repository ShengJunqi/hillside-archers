# 给 DeepSeek harness 的美术协作提示词

当前 Codex 会话没有 DeepSeek harness 的工具或命令入口，因此没有实际调用 DeepSeek。可将以下内容交给你自己的 DeepSeek 编码环境：

```text
请直接改进这个浏览器弓箭游戏的原创美术和动效，并交付可审查的 PR。
仓库：https://github.com/ShengJunqi/hillside-archers
先阅读 feat/comic-expedition 分支和 AGENTS.md、README.md、docs/GAME_DESIGN.md、docs/COMIC_EXPEDITION.md，再从它另开 feat/deepseek-art 分支。不要覆盖其他作者正在修改的文件。

用户反馈：人物像塑料／木偶，地图单薄重复，特效不够。
参考 Bowmasters 的鲜明角色剪影、受力动作、分层场景和出手—飞行—命中节奏。角色、美术、音乐、代码必须原创，不搬运原作素材。

当前 0.14.0 已实现用户选择的“荒诞漫画竞技”：暖纸色海报、得意黑标题和 Barlow 数字；青蓝／珊瑚红弓手；八种独立场景剪影和地形；选路、四种敌人打法、事件衰减震动设置、命中拟声字。请基于实际最新版继续，不回退成金色衬线字卡片或仅换颜色的同一座山。
涉及模块是 render.mjs、encounters.mjs、feedback.mjs、arena.css；game.world 是实际地形，game.map 只是地图色系。遇到同名绘制方法先检查覆盖，避免新效果实际未被执行。
可优先做：
1. 独立角色皮肤或面部表情、蓄力和受击恢复动作，遵循 body.mjs 的关节位置，避免美术轮廓与命中部位明显脱节。
2. 三张地图的局部手工地标、近远景和非重复材质。
3. 分裂、俯冲、爆炸、火冰毒、回血的可读视觉区别。必须对应真实状态，不增加实际伤害或无限增加粒子。
4. 手机性能和 reduced-motion；缓存静态绘制，限制尾迹、粒子和闪光。

保留原生 JavaScript + Canvas、整数角度、取消拉弓、NPC 单轮伤害预算、开局无道具、+1 每球一次且线性加箭、同机双人、NPC 直接出箭、v2 存档、HA2 迁移、账号云存档与单文件离线版。
不改 AI、数值、碰撞、数据库或存档格式，不增加游戏运行时 AI 调用、密钥、海外 CDN 或框架重写。

实现前说明要改哪些模块；与 render.mjs 有冲突时先提供独立模块或素材方案。
交付前运行 npm test、npm run build、git diff --check。用可用浏览器检查桌面与手机、reduced-motion；若只能做 Canvas 渲染或 DOM 适配器检查，明确说明，不能称为浏览器验收。
提供前后对比、验证结果和独立 PR，不直接合并 main 或覆盖他人改动。
```
