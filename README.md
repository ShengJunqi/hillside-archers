# 坡地弓手 · 一箭过山河

中文像素弓箭游戏：三章故事、同机双人、电脑对手、肉鸽远征和射靶挑战。原生 JavaScript + Canvas，运行不需要账号、后端或模型 API。

**[在线游玩](https://hillside-archers-first-duel.soundhorse9.chatgpt.site)** · [合作开发](CONTRIBUTING.md) · [给合作作者的 Codex 提示词](docs/CODEX_COLLABORATOR_PROMPT.md) · [MIT 许可证](LICENSE)

## 运行

手机可直接打开在线链接，支持横屏和竖屏；不需要安装应用。

本地开发需要 Node.js 22+。项目没有 npm 依赖，不需要安装依赖。

```sh
git clone https://github.com/ShengJunqi/hillside-archers.git
cd hillside-archers
npm run dev
```

打开 **http://127.0.0.1:8080**。也可以下载 `dist/download.html`，直接用浏览器打开离线游玩。

```sh
npm test        # 语法与游戏逻辑检查
npm run build   # 重新生成单文件离线版
```

## 已有玩法

- 三张不同地形的地图、整数角度、拖拽蓄力和可取消射击。
- 每回合先展示对手，再回到自己；箭飞行时镜头跟随。
- 木箱可打碎、木桩可击倒；头、身体、腿、脚有不同伤害。
- 开局没有道具；主线第三章交锋后开始生成。穿过 `+1` 连续加箭，爱心回血。
- 三章通关后解锁自由人机、同机双人、无尽远征、百步穿杨。
- 远征有三种空中二段弓术、12 类遗物、五种属性组合、守关敌人与永久成长。
- 主线进度、解锁、纪录和永久成长保存在当前浏览器；当前远征的临时构筑不跨重开保留。

## 操作

手机：按住画面向弓手身后拉，松开射箭；拉回圆圈或点“取消拉弓”撤销。也可点 − / ＋ 微调整数角度，再点“射箭”。观察镜头可点“开始本回合”跳过。支持屏幕旋转、安全区与全屏／沉浸模式。

电脑：拖拽向弓手身后拉弓，松手射箭。拉回取消圈、右键或 Esc 取消蓄力。左右键微调整数角度；空格射箭或跳过观察镜头。远征中，箭飞行时再按空格或点击画面触发弓术。

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `dist/core.mjs` | 物理、碰撞、状态机、AI、升级与存档 |
| `dist/render.mjs` | 地图、角色、镜头、粒子和剧情动画 |
| `dist/app.mjs` | UI、屏幕适配、音效与浏览器存储 |
| `dist/input.mjs` | 鼠标、触屏、取消蓄力和多指保护 |
| `dist/index.html` / `dist/style.css` / `dist/mobile.css` | 页面结构、桌面样式与手机布局 |
| `dist/download.html` | 构建生成的单文件离线版 |
| `tests/` | 可移植的 Node 逻辑与回归检查 |
| `scripts/` | 本地服务器与离线版生成工具 |

`dist/` 同时是可维护源码和部署目录，尚未拆分为单独的 `src/`。详细规则和数值见 [游戏设计说明](docs/GAME_DESIGN.md)。

## 一起开发

请先读 [AGENTS.md](AGENTS.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)，使用独立分支和 PR 协作。一位作者可以主要负责规则和物理，另一位主要负责地图、角色、动画和 UI。

GitHub 推送**不会自动更新现有游玩链接**。线上发布由维护者统一执行；本仓库不包含部署账号或凭证。任何静态托管服务都可以托管 `dist/`，不需要服务端程序。

## 参考与许可

玩法研究参考 Bowmasters 的抛物线对决、空中二次触发和技巧挑战；角色、美术、代码与剧情独立实现，未打包原作素材。参考来源记录在 [设计说明](docs/GAME_DESIGN.md)。本项目以 MIT 许可证开源。
