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

管理端已完成登录和环境绑定；游戏客户端仍使用本机存档和迁移码，尚未加入云登录或云存档界面。

最相关的下一步是先做账号云存档：配置游客/邮箱身份，建立 PostgreSQL 玩家存档表及按用户隔离的 RLS，接入当前存档格式，验证两个网站使用同一账号能够读取同一份进度。数据库已确认是 PostgreSQL，不使用文档数据库的 `collection()` 接口代替 PG/RLS 路径。

云存档验证完成后，再实现邀请码好友房间、回合状态和断线重连。新增计费资源须先核对套餐与预算，不因接入而另建环境、升级套餐或迁移现有网站。

参考：[用户指定的官方接入说明](https://docs.cloudbase.net/skill.md)。
