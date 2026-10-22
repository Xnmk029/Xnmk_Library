# ASCII Logo — AgnesCode v1 提交报告

## 参考来源
自主命题，无需外部素材引用。

## 合规对照表

| PROJECT_PROMPT.md 要求 | 状态 | 说明 |
|---|:---:|---|
| 单文件 HTML，双击可运行 | ✔ | `index.html` 自包含，零外部依赖 |
| 模型 ID + Logo ASCII 画 | ✔ | "AGNES-CODE v1.0" 文字 + 终端风格 logo |
| 主体尺寸 ≥ 80×16 | ✔ | 每行 ~94 字符，共 52 行 |
| 深色终端风（黑底绿字/琥珀） | ✔ | #0a0e08 背景 + #33ff33 前景色 |
| 「复制全部」按钮 | ✔ | Clipboard API，含 toast 反馈 |
| 「下载 .txt」按钮 | ✔ | Blob → Object URL 自动触发下载 |
| 禁止图片/SVG/canvas | ✔ | 纯 ASCII `<pre>` 渲染 |
| 无 TODO / placeholder | ✔ | 全文无占位符 |
| 等宽字体展示 | ✔ | Courier New / Consolas |

## 文件清单

| 文件 | 大小 | 用途 |
|------|------|------|
| `index.html` | 9.3 KB | 主交付物（ASCII art + 交互 UI） |
| `README.md` | ~1 KB | 本提交报告 |

## 运行方式
浏览器直接打开 `F:\benchmark\L1_Basic\ASCII_Logo\agnes-code-v1\index.html`
