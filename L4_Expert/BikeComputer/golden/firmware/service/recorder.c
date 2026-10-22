/* recorder.c — GPX 轨迹记录：1Hz 采点、5m/10s 抽稀、追加写 FATFS */
#include "ff.h"
#include "recorder.h"
#include "hal_gps.h"
#include <stdio.h>
#include <string.h>

static FIL gpx;
static uint8_t recording;
static double last_lat, last_lon;
static uint32_t last_tick;

static double dist_m(double la1, double lo1, double la2, double lo2)
{
    /* equirectangular 近似，码表精度足够 */
    double x = (lo2 - lo1) * 111320.0 * 0.0174533 *
               __builtin_cos((la1 + la2) * 0.5 * 0.0174533);
    double y = (la2 - la1) * 110540.0;
    return __builtin_sqrt(x * x + y * y);
}

int recorder_start(const char *iso_now)
{
    char path[48];
    snprintf(path, sizeof(path), "/TRACK/%s.gpx", iso_now);
    if (f_open(&gpx, path, FA_WRITE | FA_CREATE_ALWAYS) != FR_OK) return -1;
    const char *hdr =
        "<?xml version=\"1.0\"?>\n"
        "<gpx version=\"1.1\" creator=\"BikeComputer\">\n<trk><trkseg>\n";
    UINT bw; f_write(&gpx, hdr, strlen(hdr), &bw);
    recording = 1; last_tick = 0;
    return 0;
}

/* 每秒调用一次；满足 5m 位移或 10s 间隔才落点 */
void recorder_tick(const gps_data_t *g, const char *iso_time)
{
    if (!recording || !g->valid) return;
    double d = dist_m(last_lat, last_lon, g->lat, g->lon);
    uint32_t now = xTaskGetTickCount() / 1000;
    if (last_tick && d < 5.0 && now - last_tick < 10) return;

    char line[128];
    int n = snprintf(line, sizeof(line),
        "<trkpt lat=\"%.6f\" lon=\"%.6f\"><ele>%.1f</ele>"
        "<time>%s</time></trkpt>\n",
        g->lat, g->lon, g->alt, iso_time);
    UINT bw; f_write(&gpx, line, n, &bw);
    f_sync(&gpx);                                    /* 掉电保护：逐点刷写 */
    last_lat = g->lat; last_lon = g->lon; last_tick = now;
}

void recorder_stop(void)
{
    if (!recording) return;
    const char *tail = "</trkseg></trk>\n</gpx>\n";
    UINT bw; f_write(&gpx, tail, strlen(tail), &bw);
    f_close(&gpx);
    recording = 0;
}
