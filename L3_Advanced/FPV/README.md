# FPV：穿越机花飞 3D 模拟器 Benchmark

## 分类元数据

- **测试领域**: 3D 图形、物理仿真与 Shaders
- **难度等级**: `L3`（高级）
- **核心技术栈**: WebGL / SO(3) Rigid Body / Gamepad API / VTX Shader
- **核心考核点**: SO(3) 姿态积分、PID 控制环、手柄映射、VTX 噪声着色器

## 任务定位

测试模型在纯 Web 环境下开发 SO(3) 刚体动力学积分、手写 PID 闭环控制、硬件 Gamepad 通道映射及 VTX 图像衰减后处理 Shader 的能力。

## 提示词

> 📋 **完整提示词以 [`PROJECT_PROMPT.md`](./PROJECT_PROMPT.md) 为唯一标准**，本页不再内嵌副本（避免版本漂移）。一键复制请见仓库根目录 [`DOMAIN_INDEX.zh.md`](../../DOMAIN_INDEX.zh.md)。
> 评测时请直接使用提示词原文，**不要修改任何技术约束**。
