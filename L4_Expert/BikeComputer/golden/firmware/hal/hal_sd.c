/* hal_sd.c — SD 卡 SDIO + FatFs 挂载、掉电保存（SystemSave.json） */
#include "at32f435_437.h"
#include "ff.h"
#include "hal_sd.h"
#include <string.h>
#include <stdio.h>

static FATFS sd_fs;
static uint8_t mounted;

int hal_sd_init(void)
{
    /* SDIO1: PC8-PC12(D0-D3,CLK) PD2(CMD)，硬件层初始化由 sdio_init 完成 */
    gpio_init_type g;
    crm_periph_clock_enable(CRM_GPIOC_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_GPIOD_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_SDIO1_PERIPH_CLOCK, TRUE);
    gpio_default_para_init(&g);
    g.gpio_pins = GPIO_PINS_8 | GPIO_PINS_9 | GPIO_PINS_10 |
                  GPIO_PINS_11 | GPIO_PINS_12;
    g.gpio_mode = GPIO_MODE_MUX;
    g.gpio_pull = GPIO_PULL_UP;
    g.gpio_drive_strength = GPIO_DRIVE_STRENGTH_STRONGER;
    gpio_init(GPIOC, &g);
    g.gpio_pins = GPIO_PINS_2;
    gpio_init(GPIOD, &g);

    if (f_mount(&sd_fs, "0:", 1) != FR_OK) { mounted = 0; return -1; }
    mounted = 1;
    return 0;
}

uint8_t hal_sd_ready(void) { return mounted; }

/* 掉电保存：里程累计/设置/末次定位 → /SystemSave.json */
int hal_sd_save_system(const sys_save_t *s)
{
    if (!mounted) return -1;
    FIL f;
    if (f_open(&f, "/SystemSave.json", FA_WRITE | FA_CREATE_ALWAYS) != FR_OK)
        return -2;
    char buf[256];
    int n = snprintf(buf, sizeof(buf),
        "{\"totalKm\":%.2f,\"lon\":%.6f,\"lat\":%.6f,"
        "\"mapDirPath\":\"/MAP\",\"mapWGS84\":%d,\"brightness\":%d}",
        s->total_km, s->last_lon, s->last_lat, s->map_wgs84, s->brightness);
    UINT bw; f_write(&f, buf, n, &bw);
    f_close(&f);
    return 0;
}
