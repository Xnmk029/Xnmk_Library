# Unified Controller Input Manager Benchmark

## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: Python Tools & Native Engines
- **Difficulty Level (难度等级)**: `L4 (Expert)`
- **Primary Tech Stack (核心技术栈)**: Python / ctypes / C++ Bindings / Win32 RawInput / XInput / SteamInput SDK / HID Protocol
- **Core Evaluation Focus (核心考核点)**: Standard interface documentation research, multi-hardware protocol data structure parsing, unified abstraction layer, and async concurrency architecture.

---

## 任务定位

本 Benchmark 用于评估 AI 大语言模型在查阅、理解并精准落地硬件与底层 SDK 官方标准接口文档方面的综合能力，涵盖 Windows XInput、Steam Input C++ API、Win32 Raw HID、PlayStation DualShock4/DualSense HID Report 以及 Nintendo Switch Pro Controller Subcommand 协议。重点考核：
1. **官方接口文档理解**：能否贴合各协议官方规范（如 Data Types、Memory Layout、Report ID、I/O 模式）。
2. **底层数据结构与 C-Binding 还原**：能否手写 Python `ctypes` / C++ 接口声明与二进制数据解析。
3. **架构统合与并发解耦**：能否解决轮询（Polling）与事件驱动（Event-driven Callback）、阻塞与非阻塞 I/O 的架构冲突。

---

## 标准化提示词

```markdown
# 任务背景
本项目为一款跨平台 Python 应用程序，现需开发一个「统一控制器输入管理模块 (Unified Input Manager)」。系统需要直接与多种底层硬件接口及平台协议进行交互。

# 需求范围
请为该项目规划并设计对以下五种输入协议的支持。设计必须严格贴合它们各自官方文档的底层逻辑与数据规范：
1. XInput
2. Steam Input
3. Raw HID Input
4. PlayStation Input
5. Switch Input

# 交付要求
请输出具体的技术设计方案，包含以下三个部分：

## 一、 架构设计 (Architecture)
* 设计一个统一的输入管理器抽象层。
* 详细说明这五种底层结构完全不同的协议，如何被标准化并统一暴露给上层业务逻辑。

## 二、 核心实现 (Core Implementation)
* 分别提供这五种协议最核心的底层数据接入与解析代码（核心逻辑或伪代码）。
* 代码需直观展现你对该协议专属初始化流程或原始数据结构的理解。
* 明确标注其中需要依赖系统级调用或外部 C/C++ 封装的部分。

## 三、 架构冲突与解决方案 (Challenges & Solutions)
* 结合这五类协议官方文档中关于数据获取方式（如生命周期、并发机制、I/O 模式）的定义，分析将它们统合在一个 Python 进程中运行时，最核心的架构冲突是什么？
* 给出你的代码级解决方案。
```

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
