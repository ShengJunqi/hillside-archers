# 免费备用入口与离线分享

游戏不需要服务器程序、外部字体、模型 API 或 ChatGPT 登录。把 `dist/` 中的文件完整放在静态网站根目录即可；页面和模块使用相对路径，也能放在 `/hillside-archers/` 子目录。

## GitHub Pages

已准备独立的 `gh-pages` 发布分支：入口是根目录 `index.html`，包含全部模块、样式、离线 HTML 和 `.nojekyll`。业务开发继续使用功能分支和 PR，不要在发布分支编辑源码。

本仓库已启用 GitHub Pages。其他仓库首次启用时，由所有者完成：

1. 打开 https://github.com/ShengJunqi/hillside-archers/settings/pages 。
2. Source 选择 **Deploy from a branch**。
3. Branch 选择 **gh-pages**，目录选择 **/(root)**，点击 **Save**。
4. 等待 Pages 构建成功，访问设置页给出的链接。

已发布地址为 https://shengjunqi.github.io/hillside-archers/ 。GitHub Pages 是免费海外备用入口；并非中国大陆托管，也没有中国大陆稳定访问保证。应请目标玩家用当地网络实测。

GitHub 集成可能缺少开启 Pages 所需的管理权限。此仓库首次创建 API 曾返回 403，由所有者在设置页启用后已正常发布；不需要提供密码、令牌或付费。

后续发布应先在源码分支完成 `npm run build`、`npm test`，提交源码和离线文件，再将该提交的 `dist/` 内容复制到 `gh-pages` 根目录。仅推送源码功能分支不会自动更新备用站。

## 进度迁移

不同网址的浏览器存档互不共享。原站旅营点击「迁移进度」，复制 `HA2:` 代码，在新站旅营粘贴导入。

代码包含章节、模式解锁、纪录、余烬、永久修行和自定义弓手名字。两边按较高进度合并，重复导入不会叠加余烬；本地已有自定义名字时保留本地名字，仍为默认名字的位置可使用导入的名字。进行中的远征、临时遗物和当前对局不跨站迁移。

## 不联网的分享方式

下载 `dist/download.html` 后可直接发给朋友，用浏览器打开。它内联所有代码与样式，不依赖原站或 GitHub 在当地能否访问。离线版同样支持手机／电脑切换和进度迁移；文件来源的浏览器存档行为可能因系统而异，换设备前可先复制迁移代码。

如以后需要中国大陆稳定低延迟入口，再使用具有相应账号和域名的国内托管，并按托管服务要求配置域名；当前没有购买任何域名或托管服务。

## 可选账号云存档

在线发布前，在当前开发机的 `.env.local` 填好已有 CloudBase 环境的 Publishable Key，再运行 `npm run build`。将生成的 `dist/cloud-config.json` 与整个 `dist/` 一同打包到原站和 Pages 分支；这个生成文件被 Git 忽略，不会随源码 PR 自动到达网站。不要将 `.env.local` 或任何管理 API Key 放进站点。

未配置时游戏仍可本机游玩，账号弹窗提示本站暂未配置。`download.html` 始终是完全离线版本，不载入 SDK 或云配置。新增站点域名时需同步 CloudBase 安全来源；现有两个游戏域名已添加。参见 [账号存档说明](ACCOUNT_SAVES.md)。

## 0.12.1 账号密码测试发布

- 原站已发布为 Sites 第 15 版，部署工具返回 `succeeded`：https://hillside-archers-first-duel.soundhorse9.chatgpt.site 。源码提交为 `44df5d8a77d7b298f9105fb8975dffae7480b095`；保留公开访问方式及原有协作提示词／源码 ZIP 下载。
- 备用站已发布 `gh-pages` 提交 `d51c418839ecd75c82f47e140e970264e8ad74f0`：https://shengjunqi.github.io/hillside-archers/ 。[Pages 构建](https://github.com/ShengJunqi/hillside-archers/actions/runs/42671999913)成功。
- 已核对备用站的页面、两个账号模块、云配置及浏览器 SDK 共五个文件，与本机已验证构建的摘要一致；模块返回 JavaScript MIME。两个站点来源的 CloudBase API 跨域响应已核对，未登录访问被拒绝。
- 当前执行环境的原站 HTTP 探测收到 Cloudflare `1010` 拒绝，因此原站只确认原生发布工具成功，未独立复核页面。真实浏览器／手机登录与邮箱收码仍待玩家实测；DOM 表单验证不等同于浏览器验收。

## 0.13.0 原创画面与特效发布

原站已发布 Sites 第 16 版，原生发布工具返回 succeeded，静态源码提交 `c24dc8d690c5a7c8b1c3cd69da1d55bf358b6d71`。备用站发布 `gh-pages` 提交 `5f42223fa87ea1796338d2b69bc2da3d2ea6f33c`，Actions 构建成功：https://github.com/ShengJunqi/hillside-archers/actions/runs/43379808039 。

已按 SHA-256 比对备用站 render.mjs、download.html、index.html 与本机构建，结果一致；DeepSeek 提示词下载与文档字节一致。原有协作提示词及源码 ZIP 继续保留。1160 项检查及离线构建通过，三图／角色／元素效果已用原生 Canvas 出图检查；真实浏览器和手机性能仍待实测。

手动协作提示词：https://shengjunqi.github.io/hillside-archers/deepseek-art-prompt.txt 。当前会话没有调用 DeepSeek harness，没有增加游戏运行时 AI 请求或服务费用。
