# CloudBase 浏览器 SDK

来源：官方 npm 包 `@cloudbase/js-sdk@3.11.0` 的 `dist/index.esm.js`，通过 esbuild 0.28.2 打包为自包含 ESM。依赖已打入同一个文件，没有浏览器无法解析的裸包导入。未修改 SDK 实现。

SHA-256：`891130156287277daee0c39e0412adaa6065933d92bc6c799de01680b0bb0bd4`。主许可证、原包第三方声明和打包依赖声明保存在同目录。

复现（中间依赖只放到忽略的 work/，不改变游戏依赖）：

```sh
npm install --prefix work/cloudbase-sdk @cloudbase/js-sdk@3.11.0 esbuild@0.28.2
work/cloudbase-sdk/node_modules/.bin/esbuild work/cloudbase-sdk/node_modules/@cloudbase/js-sdk/dist/index.esm.js --bundle --format=esm --platform=browser --target=es2022 --minify --legal-comments=linked --outfile=dist/vendor/cloudbase-3.11.0.mjs
```

SDK 只在首次使用账号或恢复已关联账号时载入，离线单文件不包含它。不从境外 CDN 载入依赖。升级时固定版本、保留全部许可声明，并重新验证真实登录及 PG 权限。
