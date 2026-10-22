# Antigravity 纯正文 TPS 测速工具 (`tps-bench.mjs`)

用于测量当前会话模型在 **纯正文生成阶段（Body Content）** 的输出吞吐率（Tokens Per Second, TPS），严格剔除思维链（Chain-of-Thought, `thinking`）与首字延迟（TTFT / Prefill）。

## 核心原理

1. **2ms 高频轨迹监听 (`watch-worker`)**
   后台守护进程以 `2ms` 采样间隔监听会话日志 `transcript_full.jsonl` 的文件落盘时间（`mtimeMs`），消除终端启动 `pwsh` / `node` 的进程开销。
2. **零思维链直测 (`Zero-Thinking Probe`)**
   测速轮次中模型跳过思维链通道（`thinking` 为空，0 Token 思维链），直接输出正文并在末尾触发 `report` 采样。
3. **长短载荷差分消元 (`Differential Calibration`)**
   通过一次**长正文无思维链探针**（$N_{\text{long}}, T_{\text{long}}$）与一次**短基线无思维链探针**（$N_{\text{short}}, T_{\text{short}}$，调用完全相同的收尾工具）做差分：
   $$\text{Net Body TPS} = \frac{N_{\text{long}} - N_{\text{short}}}{T_{\text{long}} - T_{\text{short}}}$$
   该差分值直接由 API 真实计费的 `output_tokens` 差值除以毫秒级时间差得出，**完全抵消了首字延迟（TTFT）、网络往返开销以及工具调用自身的 Token 耗时**。

## 快速使用

```powershell
# 1. 启动 2ms 后台监听（默认监听 30 秒）
node f:\benchmark\tools\tps-bench\tps-bench.mjs start-watch --duration 30

# 2. 模型输出零思维链测试载荷后，立即生成测速报告
node f:\benchmark\tools\tps-bench\tps-bench.mjs report
```

输出文件：
- `last-trace.json`：最近一次 2ms 采样原始事件轨迹
- `watch-history.json`：跨轮次持久化的毫秒级步骤时间戳
- `last-result.json`：完整测速分析报告（含单步详情与差分结果）
