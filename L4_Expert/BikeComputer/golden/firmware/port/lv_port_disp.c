/* lv_port_disp.c — LVGL v8 显示移植：双 1/4 屏 buffer + DMA flush */
#include "lvgl.h"
#include "hal_lcd.h"

#define DISP_HOR 240
#define DISP_VER 240
#define BUF_LINES 60                                 /* 1/4 屏 */

static lv_disp_draw_buf_t draw_buf;
static lv_color_t buf1[DISP_HOR * BUF_LINES];        /* 2×28.1KB */
static lv_color_t buf2[DISP_HOR * BUF_LINES];
static lv_disp_drv_t disp_drv;

static void disp_flush(lv_disp_drv_t *drv, const lv_area_t *area,
                       lv_color_t *color_p)
{
    hal_st7789_flush(area->x1, area->y1, area->x2, area->y2,
                     (const uint16_t *)color_p,
                     (area->x2 - area->x1 + 1) * (area->y2 - area->y1 + 1));
}

void lv_port_disp_init(void)
{
    hal_st7789_init();
    lv_disp_draw_buf_init(&draw_buf, buf1, buf2, DISP_HOR * BUF_LINES);
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = DISP_HOR;
    disp_drv.ver_res = DISP_VER;
    disp_drv.flush_cb = disp_flush;
    disp_drv.draw_buf = &draw_buf;
    lv_disp_drv_register(&disp_drv);
}
