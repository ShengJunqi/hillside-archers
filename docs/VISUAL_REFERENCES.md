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

## 0.14.0 荒诞漫画竞技

用户选择了夸张漫画竞技方向。当前实现与创意清单见 [COMIC_EXPEDITION.md](COMIC_EXPEDITION.md)。场景剪影按赛场分别绘制：林间看台、水面码头、夜市楼群、桥下峡谷、气球领奖台；降低背景轮廓强度，用粗黑边的箱／黄条木桩标明可破坏物。

- [得意黑官方仓库](https://github.com/atelier-anchor/smiley-sans)：短标题自带倾斜，不额外 skew，不伪造粗体；原始 WOFF2 与完整 OFL 随站提供。
- [Barlow Condensed 官方 Google Fonts 目录](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)：窄体竞技数字，用于血量等读数，正文保留系统中文字体。
- [The Art of Screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U)、[Math for Game Programmers: Juicing Your Cameras With Math](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing)：借鉴事件触发与衰减思路，本项目强度与时长自行设定，独立测试，不是照抄所谓通用最佳参数。
- [Xbox Accessibility Guideline 117: Visual distractions](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)：提供减弱／关闭冲击，减少同时大范围运动；系统减少动态效果优先。

排查确认旧版类内重复的 `particles` 方法覆盖了新版效果，已移除。新的回归检查直接验证漫画命中字确实由当前粒子方法绘制。

## 0.15.0 高清场景方向

本轮生成五种原创绘景和一种土岩材质，以真实素材代替大块平填几何；没有下载商业游戏的画面作素材。以下公开参考只用于分析构图、景深与材质，不代表完整观看了讲座视频，也不照搬角色或关卡。

- [Rayman Legends: The Design Process（GDC）](https://www.gdcvault.com/play/1020398/Rayman-Legends-The-Design-Process)：夸张手绘景观与清楚的活动空间。
- [The Art of Ori（GDC）](https://gdcvault.com/play/1027035/The-Art-of-Ori-and)、[官方合作美术书](https://www.future-press.com/books/the-art-of-ori-and-the-will-of-the-wisps/)：空气透视、冷暖焦点、材质细节。
- [Media Molecule 官方 Tearaway 介绍](https://www.mediamolecule.com/blog/article/announcing_tearaway_unfolded_for_playstation_4)：纸纤维、厚度、折痕和层间阴影，而非只有多边形轮廓。
- [Thunder Lotus 官方 Spiritfarer 页面](https://thunderlotusgames.com/games/spiritfarer/)：手绘港湾、建筑剪影、暖窗灯与开阔天空。

完成内容、图片原始尺寸、选择入口及验证边界见 [高清场景说明](HD_SCENERY.md)。
