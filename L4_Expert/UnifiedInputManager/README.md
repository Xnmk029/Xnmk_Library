# Unified Controller Input Manager Benchmark

## 分类元数据

- **测试领域**: Python 工具与原生引擎
- **难度等级**: `L4`（专家级）
- **核心技术栈**: Python / ctypes / C++ Bindings / Win32 RawInput / XInput / SteamInput SDK / HID Protocol
- **核心考核点**: 标准接口文档调研、多硬件协议数据结构解析、统一抽象层与异步并发架构

---

## 任务定位

本 Benchmark 用于评估 AI 大语言模型在查阅、理解并精准落地硬件与底层 SDK 官方标准接口文档方面的综合能力，涵盖 Windows XInput、Steam Input C++ API、Win32 Raw HID、PlayStation DualShock4/DualSense HID Report 以及 Nintendo Switch Pro Controller Subcommand 协议。重点考核：
1. **官方接口文档理解**：能否贴合各协议官方规范（如 Data Types、Memory Layout、Report ID、I/O 模式）。
2. **底层数据结构与 C-Binding 还原**：能否手写 Python `ctypes` / C++ 接口声明与二进制数据解析。
3. **架构统合与并发解耦**：能否解决轮询（Polling）与事件驱动（Event-driven Callback）、阻塞与非阻塞 I/O 的架构冲突。

---

## 提示词

> 📋 **完整提示词以 [`PROJECT_PROMPT.md`](./PROJECT_PROMPT.md) 为唯一标准**，本页不再内嵌副本（避免版本漂移）。一键复制请见仓库根目录 [`DOMAIN_INDEX.zh.md`](../../DOMAIN_INDEX.zh.md)。
> 评测时请直接使用提示词原文，**不要修改任何技术约束**。
>
> 下方小节为任务要点速览，仅供理解项目背景；**评测输入请以 PROJECT_PROMPT.md 原文为准**。

---

## 验收与评分标准

1. **协议规范贴合度 (40%)**：
   - XInput: 能否正确定义 `XINPUT_STATE` 与 `XINPUT_GAMEPAD` 结构体及摇杆 Deadzone 处理。
   - Steam Input: 能否正确定义 `ISteamInput` 句柄、Action Set (`ControllerActionSetHandle_t`) 与 Digital/Analog Action 获取流程。
   - Raw HID: 能否区分 Raw Input (`WM_INPUT` / `GetRawInputData`) 或 SetupAPI 与 Preparsed Data 解析。
   - PlayStation Input: 能否区分 DS4/DualSense USB 与 BT 模式下的 64-byte/78-byte Report ID 及触控/陀螺仪数据偏移。
   - Switch Input: 能否指出 Switch Controller 的 Subcommand 0x30 / 0x21 通信模式及 SPI Flash / Calibration 校准数据读取。

2. **统一抽象层设计 (30%)**：
   - 状态标准化：统一暴露为归一化轴输入（$-1.0 \sim +1.0$ 或 $0.0 \sim 1.0$）、按键位掩码及传感器（Gyro/Accel）三轴矢量。
   - 设备发现与热插拔：支持设备连接/断开事件监听。

3. **架构冲突与 Python 并发方案 (30%)**：
   - 正确指出线程与 I/O 模型冲突（XInput 的 60-120Hz 轮询 vs Raw HID 的 OS Window Message Loop / IOCP vs Steam Input 的 `RunFrame()` 引擎步进）。
   - 提供基于 Python `asyncio` / 独立无锁 Queue 线程环形缓冲区的解耦方案。
