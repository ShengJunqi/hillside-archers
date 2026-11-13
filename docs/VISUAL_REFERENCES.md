# Bowmasters 视觉研究与原创实现

本轮参考官方商店介绍及公开玩法截图，观察角色轮廓、材质分区、背景景深和命中反馈，不下载或打包原作角色、音乐、贴图或代码。

- [官方 Google Play](https://play.google.com/store/apps/details?id=com.playgendary.bowmasters)：武器差异与 ragdoll 反馈是主要卖点，不能只增加升级数字。
- [官方 App Store](https://apps.apple.com/us/app/bowmasters-multiplayer-games/id1118431695)：多种角色与投射物提供可辨识的轮廓和攻击风格。商店描述不等于本项目已实现的模式。
- [Common Sense Media 的玩法截图与评测](https://www.commonsensemedia.org/app-reviews/bowmasters)：对比角色与背景的对比度、完整弹道空间、地貌层次。
- [Multiplayer.it 的旧版评测与截图](https://multiplayer.it/recensioni/173559-bowmasters-angry-bows.html)：参考夜景中角色、飞行武器及局部地标的可读性；历史版本画面不作为当前模式或数值依据。

## 本项目的落实

人物采用原创青松／赤岩外形：粗描边、哑光皮革和布料、箭袋、面部表情、可跟随关节的四肢。地图各自有牌楼、砂岩残关、发光断柱；地面加入岩层、根草、碎石，破坏物保持明确轮廓。

反馈覆盖出手、实际弹道尾迹、火冰毒附着、命中星芒、木屑、扬尘、爆炸和伤害字。保留真实碰撞和原有 hit-stop，新增部分只观察事件／状态，不修改 Game 或随机序列。减少动态效果偏好和有界粒子数量用于控制闪烁及多箭开销。

已运行完整规则检查、离线构建、渲染状态纯度检查，并用原生 Canvas 实际导出三张地图、角色特写和元素效果图。图像留在忽略的 work/visual-pass/，不是浏览器验收。当前没有可调用的 cua_repl.js；未安装替代浏览器或绕过环境限制，手机帧率与浏览器真实操作仍待实测。

当前没有 DeepSeek harness 工具或命令入口，未声称已调用。可手动交给 DeepSeek 的提示词见 DEEPSEEK_ART_PROMPT.md。
