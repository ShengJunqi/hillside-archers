# CloudBase 国内站开发连接

当前开发环境已安装官方 CloudBase 插件（0.2.5，包含配套 Skills）和 CloudBase CLI 3.9.1，通过腾讯云官方设备授权完成管理登录，并查询验证了已有环境。

| 项目 | 已验证值 |
| --- | --- |
| 站点 | 国内站 |
| 环境 ID | `inappropriate-bobcat-d6a8d8c4daf` |
| 环境名称 | `inappropriate-bobcat` |
| 地域 | 上海 `ap-shanghai` |
| 环境状态 | `NORMAL` |
| 套餐 | 个人版 `baas_personal` |
| 数据库 | PostgreSQL；Document 扩展未启用 |

项目绑定写在 `.cloudbase/project.json`，只含公开连接信息。登录凭据由官方 CLI 保存在当前开发机器的 CloudBase 凭据目录，不进入代码仓库。克隆仓库不会自动获得环境权限，其他开发者需使用有权访问该环境的账号登录。

## 重新进入开发环境

官方插件已为当前 Codex 环境安装；工具加载情况取决于会话重载。当前会话可直接使用 CLI，无需等待 MCP 出现。以下命令都明确指定已有环境，不创建或购买新环境。

```sh
npm exec --yes --package=@cloudbase/cli -- tcb login --intl false --flow device
npm exec --yes --package=@cloudbase/cli -- tcb env use inappropriate-bobcat-d6a8d8c4daf --region ap-shanghai
npm exec --yes --package=@cloudbase/cli -- tcb env detail --env-id inappropriate-bobcat-d6a8d8c4daf --region ap-shanghai --json
```

设备授权页面由 CLI 当次生成，使用自己的账号完成登录；不要在仓库或文档保存短期授权码、密码、SecretId、SecretKey 或管理 API Key。

国内站 MCP 入口是 `https://tcb-api.cloud.tencent.com/mcp/v1`。当前项目是 Web 游戏，无需配置微信开发者工具或小程序 AppID。

## 两个游戏入口

已将原站和 GitHub 备用站添加为安全来源，并通过独立查询确认均为 ENABLE。配置使用纯域名，不带协议或项目路径：

```text
hillside-archers-first-duel.soundhorse9.chatgpt.site
shengjunqi.github.io
```

这属于调用来源配置，不会把游戏网站迁移到 CloudBase 托管，也不会赋予访客数据库管理权限。

## 当前完成范围与下一步

管理端已完成登录和环境绑定。邮箱登录、密码登录与平台默认邮件通道已开启，匿名登录与手机登录保持关闭。客户端代码提供可选账号云存档，具体流程、发布配置和验证范围见 [账号存档说明](ACCOUNT_SAVES.md)。

数据库已应用 `20261109165200_player_cloud_saves` 和 `20261109170600_guard_save_account` 两份迁移。`archer_saves` 的读取按账号 UID 隔离；写入仅通过核对账号、版本和幂等请求 ID 的 RPC。未创建云函数、Realtime 或新环境，未升级已购个人版。

下一步先验证真实邮箱验证码的收取和手机上的登录界面，再考虑邀请码好友房间、回合状态和断线重连。
参考：[用户指定的官方接入说明](https://docs.cloudbase.net/skill.md)。
