# TypeSafe / JEV 接入

官方技能已通过以下命令安装到当前用户的 Codex：

```powershell
npx --yes skills add typesafe-ai/skills --skill typesafe-ai --agent codex --global --yes
```

凭据使用 Windows 用户环境变量 `TYPESAFE_API_KEY`，不写入仓库或 Codex
`config.toml`。调用脚本优先读取进程环境变量，再读取用户环境变量，因而当前
已打开的 Codex 也可直接调用。其他 SDK 若无法读取新变量，可在其启动前执行：

```powershell
$env:TYPESAFE_API_KEY = [Environment]::GetEnvironmentVariable('TYPESAFE_API_KEY', 'User')
```

## 调用

```powershell
# 查询账号可用模型
& 'F:\benchmark\tools\typesafe\invoke-jev.ps1' -ListModels

# 运行示例：一次请求包含 Choice、Noul、Score 三种问题
& 'F:\benchmark\tools\typesafe\invoke-jev.ps1'

# 输入自定义请求 JSON（model、state、questions）
& 'F:\benchmark\tools\typesafe\invoke-jev.ps1' -RequestPath 'C:\path\request.json'
```

示例默认使用 `jev-latest`。实际版本和 token 用量以响应的 `model`、`usage`
为准。每次执行评估都会产生一次付费 API 请求。脚本遇到服务错误即报错，
不会自动重试；生产批量调用建议采用官方 SDK 的限流退避机制。

JEV 是结构化判断模型，通过 `/v1/systemone` 返回值和概率，不能直接替代
Codex 主对话模型所需的 Responses 接口。本接入供 Codex 通过技能及脚本使用。

文档：https://docs.typesafe.ai/introduction

接口：https://docs.typesafe.ai/api

模型：https://docs.typesafe.ai/models
