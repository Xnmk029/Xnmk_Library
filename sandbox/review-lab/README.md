# review-lab — BENCH 对照实验室

> 本目录是 sandbox 的**离线对照展示子系统**，与受测流水线（prepare/review/collect）解耦。
> 受测与审阅会话**禁止**读取 `reference-assets/`（SOTA 参考实现，属"其他模型输出"级敏感物）。

打开 `sandbox/review-lab/review.html`，或在仓库根目录运行 `python -m http.server 8798 --bind 127.0.0.1` 后访问 `http://127.0.0.1:8798/sandbox/review-lab/review.html`。

## 生成

在仓库根目录执行 `python sandbox/review-lab/build_review_ui.py`。
界面源文件是 `sandbox/review-lab/review_ui_shell.html`；不要只修改生成后的 HTML。
题库页 `index.html` / `catalog.json` 由 `python sandbox/review-lab/build_catalog.py` 生成。
生成物（review.html / index.html / catalog.json）与 `reference-assets/`、`shots/` 均不入库。

## 身份与来源

- live-test → mimo-x-flash
- live-test-b → pangu-2.0-flash（实际目录仍为 runs/live-test）
- live-pro → mimo-x-pro
- pangu-2.0-pro → pangu-2.0-pro
- 暂存的三份 Astra 文件 → astra / SOTA 参考（用户指定）
- V4pro0902灰度测试.zip → v4-pro-0902-gray / 陆家嘴参考（用户指定，未推断更具体的供应商身份）
- 续写网文.md → 原作参照，不计入模型成果。

四批共 20 份成果，加 4 份参考成果。原始自报、日志与审阅保留，不将人工确认 ID 写回交付文件。
压缩包只读取正式 dist 入口、源码和 README 到 review-lab/reference-assets/v4-pro-0902；跳过 .probe 调试输出。

## 对比行为

按题目分组，支持 2 / 3 / 4 面板、首栏基准锁定、模型交换、文件选择、源码、逐行差异、原文阅读、同步滚动、放大、来源与审阅、题面抽屉。
URL hash 保存题目、模型、面板数、视图、锁定、同步滚动和所选文件。复制的链接在同一仓库/本地服务环境使用，不是公开分享网址。
同步滚动对文本生效；不同作品的 3D 镜头和时间轴没有通用协议，不自动同步。
大规模且差异悬殊的文件采用共同首尾段对齐，并在界面明确标注。

## 预览依赖

预览使用 review-lab/reference-assets/vendor 中与作品声明一致的 Three.js 0.152.0 / 0.157.0 / 0.160.0 / 0.170.0，以及匹配的控制器。
来自 jsDelivr 的对应 npm three 版本；MIT 许可见 vendor/LICENSE。
构建时将依赖嵌入页面，避免 CDN 网络波动影响比较。此替换仅作用于预览，原始源码与"打开原文件"保留原样（原文件可能仍需联网）。
所有交付物预览在隔离 iframe 中运行，SVG 也不注入父页面。关闭或切换面板销毁 iframe。

## 验证

`verify_review.cjs` 覆盖数据路径、无效检查项、面板数量、锁定、同步滚动、差异、刷新恢复、详情、题面、源码选择、放大和移动布局，并检查三类 3D 预览。
当前验证脚本使用本机 bundled Playwright 和 Edge；运行前需开启上述本地 HTTP 服务。截图输出到 `shots/`（不入库）。
`dev/` 下为一次性调试脚本（`debug-expand.cjs`、`offline-check.cjs`），非流水线组成部分。
