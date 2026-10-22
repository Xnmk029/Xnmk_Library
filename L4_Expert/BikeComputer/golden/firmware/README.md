# firmware/ — 固件源码骨架（golden 最小样例）

面向 AT32F435CGU7 的分层固件骨架，关键模块为可读实现代码。

## 目录

```
firmware/
├── hal/     # hal_st7789.c(SPI+DMA flush) hal_encoder.c(TIM编码器+按键) hal_gps.c(NMEA) hal_power.c(ADC/休眠)
├── service/ # datacenter.c(pub/sub+pingpong) recorder.c(GPX) mapconv.c(Web Mercator)
├── app/     # page_manager.c(页面栈+编码器导航) page_sport.c(数据页示例)
├── port/    # lv_port_disp.c lv_port_indev.c
├── main.c
└── README.md
```

构建目标：Keil MDK(ARMCC) / arm-none-eabi-gcc；同款 App 层可平移至 PC 模拟器（见 `../ui_demo/` 的演示等价物）。
