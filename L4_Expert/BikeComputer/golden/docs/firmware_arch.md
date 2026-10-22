# 固件架构（golden 最小样例）

## 分层架构

```
┌─ App ──────────────────────────────────────────┐
│  PageManager（页面生命周期/栈）                 │
│  Pages: Startup / Dialplate / SportData /      │
│         LiveMap / TrackReplay / SystemMenu     │
├─ Service ──────────────────────────────────────┤
│  DataCenter（发布-订阅，PingPongBuffer 无锁）   │
│  DP_* 数据处理节点：SportStatus / Recorder /   │
│                    Compass / Pedometer          │
│  StorageService（JSON 配置 + GPX 轨迹）         │
│  MapConv（经纬度↔瓦片坐标换算，WGS84/GCJ02）    │
├─ HAL ──────────────────────────────────────────┤
│  LCD(ST7789+DMA) / SD(FATFS) / GPS(UART+NMEA)  │
│  IMU(I2C) / MAG(I2C) / Encoder(TIM) / RTC /    │
│  Power(ADC+CHG+休眠)                            │
└─ BSP: AT32F435 标准库 + FreeRTOS（可选裸机调度） ┘
```

## 关键设计

- **DataCenter**：各 DP 节点向数据中心发布结构化数据（SportStatus/GPS/Battery…），页面通过 Account 订阅，PingPongBuffer 双缓冲保证无锁线程安全读写。
- **PageManager**：页面栈 + 生命周期回调（onLoad/onShow/onHide/onUnload），编码器事件统一由 InputService 分发；页面切换带 LVGL 位移动画。
- **存储布局（SD, FAT32）**：
  ```
  /MAP/z/x/y.bin     # RGB565 瓦片（128×128 或 256×256），按 OSM 编号
  /TRACK/YYYYMMDD_HHMMSS.gpx
  /SystemSave.json   # 掉电保存：累计里程、设置、末次定位
  ```
- **地图管线**：PC 工具下载 OSM PNG → 转换器输出 RGB565 bin → 设备按当前经纬度换算瓦片号 → 按需读取 4~9 邻域瓦片 → LVGL canvas 合成 → 叠加轨迹折线与定位光标。
- **坐标换算**：Web Mercator；`x_tile = floor((lon+180)/360 × 2^z)`；`y_tile = floor((1−ln(tan φ+sec φ)/π)/2 × 2^z)`；支持 WGS84/GCJ02 切换消除国行地图偏移。
- **GPX**：标准 `<gpx><trk><trkseg><trkpt lat lon><ele><time>` 结构，1Hz 追加写，抽稀阈值 5m/10s。
- **功耗**：GPS 1Hz 工作；页面空闲 30s 降背光；待机页 MCU 降频。

## firmware/ 目录

```
firmware/
├── hal/        hal_st7789.c hal_encoder.c hal_gps.c hal_power.c
├── service/    datacenter.c recorder.c storage.c mapconv.c
├── app/        page_manager.c page_sport.c
├── port/       lv_port_disp.c lv_port_indev.c
└── main.c
```
