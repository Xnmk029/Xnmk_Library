# 硬件系统设计（golden 最小样例）

## 系统框图

```
                 ┌──────────── AT32F435CGU7 (QFN48, 288MHz) ────────────┐
 ST7789 LCD ──── │ SPI1 (SCK/MOSI/CS) + DC/RST/BLK (GPIO)               │
 SD Card ────── │ SDIO1 (4-bit) 或 SPI2 + CS                            │
 ATGM336H ───── │ USART2 RX/TX (NMEA 0183, 9600bps@1Hz 默认)            │
 LSM6DSM ────── │ I2C1 SDA/SCL (0x6B) + INT1 计步中断                   │
 LIS3MDL ────── │ I2C1 共用 (0x1E)                                      │
 编码器 ─────── │ TIM3 CH1/CH2 编码器模式 + GPIO 按键                   │
 电量检测 ───── │ ADC1_INx (分压) + GPIO 充电状态 (MCP73831 STAT)       │
 USB-C ──────── │ 充电输入 → MCP73831 → 电池 → LP5907-3.3 → 3V3 全域    │
                 └──────────────────────────────────────────────────────┘
```

## 引脚分配表（节选关键引脚，QFN48 预算 ≤37 GPIO）

| 功能 | 引脚 | 外设复用 | 备注 |
|------|------|----------|------|
| LCD_SCK | PA5 | SPI1_SCK | 90MHz 能力域 |
| LCD_MOSI | PA7 | SPI1_MOSI | |
| LCD_CS | PA4 | GPIO | 低有效 |
| LCD_DC | PA6 | GPIO | |
| LCD_RST | PB0 | GPIO | |
| LCD_BLK | PB1 | GPIO/PWM | 背光调光 |
| SD_D0..D3/CMD/CLK | PC8-PC12, PD2 | SDIO1 | 4-bit 模式 |
| GPS_TX→RX | PA3 | USART2_RX | NMEA 输入 |
| GPS_RX←TX | PA2 | USART2_TX | 配置语句下发 |
| I2C1_SCL/SDA | PB6/PB7 | I2C1 | 4.7kΩ 上拉，两传感器共总线 |
| ENC_A/B | PA8/PA9 | TIM3_CH1/CH2（重映射） | 正交解码 |
| ENC_SW | PA10 | GPIO | 上拉，低有效 |
| BAT_ADC | PA0 | ADC1_IN0 | 100k/100k 分压 |
| CHG_STAT | PA1 | GPIO | MCP73831 STAT 开漏 |
| PWR_KEY | PB5 | GPIO | 电源开关检测 |

合计占用 ≈ 24 GPIO，QFN48 预算内充裕。

## 功耗预算与续航

| 子系统 | 典型电流 | 备注 |
|--------|---------|------|
| LCD 背光（常亮） | 60-80mA | 主导项 |
| LCD 面板+SPI | 8-12mA | |
| MCU @288MHz | 45-70mA | 含 FPU 满速 |
| ATGM336H | 25-40mA | 捕获态峰值更高 |
| 传感器+SD+其他 | 15-25mA | |
| **合计** | **~160-210mA** | |

续航 = 700mAh ÷ 175mA(均值) ≈ **4.0h**（常亮骑行场景，与目标一致）。休眠策略：熄屏待机（LCD_BLK 关 + GPS 备份模式 + MCU sleep）→ <5mA。

## 结构/电气要点

- GPS 陶瓷天线置于壳体后缘顶部，下方 PCB 对应区域净空铺铜；远离 SD 卡槽与编码器磁环。
- 屏幕 FPC 排线自上壳视窗下方引出至 PCB 正面座子；PCB 厚度 0.8-1.0mm。
- SD 卡槽置于左侧壁开口，USB-C 置于前侧壁开口（充电线朝下利于把立安装）。
- 编码器滚轮右侧壁开槽半外露；充电时建议软件抑制自动开机回路（硬件上注意充电路径二极管方向）。
