# 两个人一起开发

项目采用 MIT 许可证。贡献的代码和原创资源按同一许可证提供。

## 第一次运行

安装 Node.js 22 或更新版本后：

```sh
git clone https://github.com/ShengJunqi/hillside-archers.git
cd hillside-archers
npm test
npm run dev
```

打开 `http://127.0.0.1:8080`。项目没有 npm 依赖，不需要 `npm install`。云开发环境若要求对外监听，可设置 `HOST=0.0.0.0` 后运行；端口默认 8080，可用 `PORT` 修改。

## 开始一项改动

确认工作区干净，再从最新主线创建分支。若有未提交内容，先保存自己的改动，不要直接 reset。

```sh
git switch main
git pull --ff-only
git switch -c feat/你的功能
```

推荐一位作者负责规则、物理、AI，另一位负责画面、动画、剧情和 UI；具体按每次任务调整。跨模块的改动先在任务说明中写清范围。

## 提交前

```sh
npm test
npm run build
git diff --check
git add 具体改动的文件
git commit -m "Describe the concrete change"
git push -u origin feat/你的功能
```

在 GitHub 开 PR 到 `main`，说明玩家可见的改动和测试。CI 会验证规则测试和离线版是否与源码一致。合并前由另一位作者看一下；没有仓库写权限时先 fork，再从 fork 开 PR。

## 线上版本

现在的游玩链接由独立的 Sites 部署维护，源码功能分支的 GitHub 推送不会自动更新该网站。额外的免费 Pages 入口已启用，使用独立 gh-pages 发布分支；发布方式与访问范围见 docs/DEPLOYMENT.md。这个仓库不包含 Sites 项目配置或凭证。合并后的站点内容是整个 `dist/`；维护者按自己的发布流程部署。

页面底部的离线版由 `npm run build` 生成。构建后需要把更新后的 `dist/download.html` 一起提交。

## 给合作创作者的 Codex 提示词

见 [`docs/CODEX_COLLABORATOR_PROMPT.md`](docs/CODEX_COLLABORATOR_PROMPT.md)。把仓库连接到她的 Codex 后复制提示词即可；没有写权限时采用 fork + PR。
