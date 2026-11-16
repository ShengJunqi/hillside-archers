# 给 Codex 与其他代码助手

先阅读 `README.md`、`CONTRIBUTING.md` 和 `docs/GAME_DESIGN.md`。用户本次的明确要求优先于这里的默认约定。

## 项目边界

这是已能游玩的像素弓箭游戏。沿用原生 JavaScript + Canvas，不为了小改动重写框架或引入后端。中文界面，支持电脑和手机横竖屏，支持离线运行。运行不需要 API key、模型服务或账号。

`dist/` 同时是可维护源码和可部署静态站点；目前没有另一份 `src/`。修改模块文件，使用 `npm run build` 生成 `dist/download.html`，不要直接手改生成文件。

## 必须保留的玩法

- 瞄准角度显示和操作为整数；不恢复游戏下方的数字参数面板。
- 玩家回合先展示对手，再回到当前弓手；观察阶段不允许误射。电脑对手回合直接出箭，无需观察或思考等待；同机双人保留双方观察。
- 取消圈、右键、Esc、指针取消、失焦均不能误发箭或消耗回合。
- 每关开局没有道具；主线前两章不生成，第三章回合结束后生成。
- 每个 +1 球只消费一次；连续穿球为 1→2→3→4；全部箭结束后才结算回合。
- 通关三章或玩家主动跳过新手教程后解锁其他模式；跳过不额外发放余烬、纪录或修行奖励。保留同机双人。
- 肉鸽升级和元素必须有真实效果；保留现有属性组合和永久成长。
- 兼容已有 `hillside-archers-save-v2` 存档。变更格式时写迁移，不能静默清空进度。
- 同一网址保留「自动识别 / 电脑版 / 手机版」切换；手动选择优先，切换不能重开对局或误射。显示偏好与游戏存档分开存储。
- 保留 NPC 单轮伤害预算，覆盖追加箭、暴击、元素和随后一次持续伤害；玩家与同机双人不受此限制。不要重新引入 NPC 穿两个 +1 全爆头秒杀。
- 初始角色天赋、弓术、远征遗物分别记录；新增角色参考 `docs/CHARACTERS.md`。
- 受击用关节约束和移动碰撞体；角色起身后才交回控制，倒地不能扣除行动回合。
- 火毒等级、目标异常层数、持续回合分别记录；重复升级必须有明确收益。新手首战对手半血，其他主线关卡不受影响。
- 保留永久进度迁移；导入只在旅营进行，不清空较高纪录，不累计重复导入的余烬。不同域名不自动共享 localStorage。
- 短点只触发角色小动作，长按或拉弓回圈取消不算短点；动画不改变碰撞、角度、伤害或随机序列。飞行中点击弓术优先。

## 协作方式

先检查 `git status` 与当前分支，不覆盖另一位作者的改动。默认使用 `feat/<主题>` 或 `fix/<主题>` 分支，每次 PR 围绕一个明确问题。主线分支为 `main`。没有写权限时走 fork + PR。

物理和规则尽量集中在 `dist/core.mjs`，强度与角色配置在 `dist/combat.mjs`，受击关节在 `dist/body.mjs`；画面在 `dist/render.mjs`；输入在 `dist/input.mjs`，显示模式在 `dist/display.mjs`，UI 和屏幕适配在 `dist/app.mjs`；手机样式在 `dist/mobile.css`。同时改同一模块前，在任务或 PR 中说明范围。

默认提交可审查的 PR，由维护者合并及统一发布线上游戏。用户明确要求合并或发布时再执行该动作。GitHub 本仓库没有线上部署凭证；不要提交密钥、`.env`、`.openai/` 或其他服务的访问令牌。

## 验证与交付

运行 `npm test`、`npm run build`。涉及界面和交互应尽可能在真实浏览器检查；Node 逻辑测试不等于浏览器验收。没有浏览器工具时如实报告。

不要把所有控制台临时文件和截图放进 `dist/`；放在忽略的 `work/`。代码应独立原创；可以参考 Bowmasters 的一般机制，不搬运其角色、图片、音乐、视频或代码。

完成后用中文说明：改了什么、主要文件、验证结果、尚未验证的部分、PR 链接。不把“已经部署”用于仅本地运行或仅推送 GitHub 的状态。

角色显示名字可在旅营/暂停修改，不替换角色ID或技能；兼容没有names字段的旧v2存档。中文名字通过ASCII转义继续使用HA2迁移码，取消改名不能保存输入。

CloudBase 管理连接已配置：国内站、上海，已有环境见 `.cloudbase/project.json`，数据库已验证为 PostgreSQL。后续按 PG/RLS 实现，不误用文档数据库API；使用已购个人版环境，不另建环境或擅自升级套餐。游戏离线模式须保留。

账号与云存档模块为 `dist/cloud-save.mjs`、`dist/cloud-client.mjs`、`dist/cloud-ui.mjs`；不把 SDK/网络耦合进纯游戏物理。CloudBase 匿名登录保持禁用，本机游客不创建云身份。读存档走 RLS，写存档只走 `archer_save_for_account`，必须传 expected_owner、版本号与幂等请求 ID；禁止直接 update/upsert 或将余烬按 max 合并。首次关联、账号切换和冲突都需玩家在旅营选整组修行与余额；替换前留本机备份。`.env.local` 与生成的 `dist/cloud-config.json` 不提交；只允许 Publishable Key 进入发布产物。新增 SQL 用 `cloudbase/migrations/` 版本化，不编辑已应用迁移。

账号入口按用户要求只保留账号密码登录（兼容邮箱密码）与验证邮箱注册；不恢复验证码登录或自助密码重置。找回入口联系 sheng.327@osu.edu，管理员核对注册邮箱后只改原用户密码，不删号重建，避免 UID 变化导致丢云存档。新账号注册保留一次邮箱验证，不能用前端管理密钥绕过 CloudBase 认证。

0.16起 `game.world` / `game.arena.terrain` 才是真实物理地形，`game.map` 仅区域／美术色系；不要把新地图接成只换背景。自由模式使用12个arenaChoice，重开须保留。AI chooseAI会设置本轮power，不得在readyTurn/shoot前写回100。受击同volley共享位移边界；起身保留落点，动态碰撞跟真实nodes。站位建立／改变后调用syncGroundContact采样双脚（射靶x220覆盖也要同步）。悬赏、重选、finisher均是局内临时状态，不写永久存档。KO只在真实HP归零触发一次，退出清除；非战斗预览的睁眼／起身只改视觉副本。

0.16.1起W1600仅是画面／原交战区基准；真实世界边界用encounters.arenaBounds(game.world)，当前为−1000..2600。人物、关节、箭、补给、镜头与地表缓存需共用此范围。扩展两侧空间时不增加人物初始距离，中央profile采样不变；不要重新硬编码0..W为物理限位。updateBody通过worldMinX/worldMaxX接收真实边界，minX/maxX仍用于对手安全间距。

0.17起星坠通过beginSkillAim/aimSkill/releaseSkillAim/cancelSkillAim管理按住预瞄，timeScale=1/3；previewSkill与实际释放共用diveTrajectory，不改随机数／生命。空格发射的第一次松开不得施展，暂停／失焦／指针取消要恢复正常时间。追加箭继承diving/bomb/boosted/bounces和剩余pierce，不重乘技能倍率。爆炸保留原箭，范围副本才有noStick；真实箭继续正常命中。助推地面跳弹仅一次，不能无限续飞。skillAim与箭状态均不进入永久存档，详见docs/ACTIVE_BOW_SKILLS.md。

0.17.1的少补给／快节奏仅用于rogue：每次行动最多1球，场上4球、每种2球，expiresRound为生成回合+4，lastSupplyRound防同回合重复生成并在setup清空。首次观察1.8秒、后续1秒，settleDuration=.5；仍须等存活body起身，不得通过强制清除飞箭／跳过恢复来加速。其他模式的双球、观察及等待保持原值。

0.18起特箭弹药开局2／每新关+1／上限5，只在activateSkill成功时每整轮扣1份；多箭与+1不额外扣，预瞄取消不扣。setup不得补弹，推进新关才补。奇数关仅选路补给continueRun，偶数关hasRelicReward才可chooseUpgrade或重选；保留每关休息与三关额外休息。新奖励增量／预览在relics.mjs（离线和VM须在core前加载），legacyapplyUpgrade继续旧阶数接口。新池过滤RETIRED_RELICS但保留旧ID。echo落羽和追加箭不递归；普通落羽按实际关节有限转向，改vx须连续重设起点且不得重置寿命，手动特殊化后停止自动转向以保留预瞄真实性；fuse仅b.special真实伤害触发，头部／掩体回弹均每关最多一次，NPC不得获得这些收益；均不写永久存档。详见docs/ROGUE_AMMO_AND_RELICS.md。

0.19用户新要求覆盖旧固定出生点约束：教程1固定，其余新局由varyEncounter按种子选安全站位，setup重复不能再随机；无尽选路预览和实际开局必须同一描述，两个变体仍须有明显差异。NPCtimeScale=1.7只加快播放，误差／弹道／伤害预算不变。左下角普通／特箭选择在shoot快照为volleyArrowType，普通轮不得中途特殊化。

collection.mjs为纯成就／商店模型，v2可选collection包含完整钱包和购买快照；不得把余额max与物品并集合并。只在真实玩家事件记录成就，complete一次性结算；皮肤纯视觉，天赋仅无尽且下一局生效。作者码仅进入内存练习副本：persist不得写正式数据，云getSave／迁移导出必须permanentSave，外来云更新用applyPermanentSave，练习整局assistedRun不可提前取消再记奖励。collection须在core前打包，后台迁移20261116050000已应用且保留旧客户端遗漏的收藏。详见docs/STYLE_SHOP.md。
