/* lv_port_indev.c — LVGL v8 编码器输入移植 */
#include "lvgl.h"
#include "hal_input.h"

static lv_indev_drv_t indev_drv;
static lv_indev_t *enc_indev;
static int32_t pending_diff;
static uint8_t pending_key;

static void enc_read(lv_indev_drv_t *drv, lv_indev_data_t *data)
{
    data->enc_diff = (int16_t)pending_diff;
    pending_diff = 0;
    data->state = pending_key ? LV_INDEV_STATE_PR : LV_INDEV_STATE_REL;
    pending_key = 0;
}

void lv_port_indev_init(void)
{
    hal_encoder_init();
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_ENCODER;
    indev_drv.read_cb = enc_read;
    enc_indev = lv_indev_drv_register(&indev_drv);
}

/* 10ms 周期调度：累积旋转量 + 分发按键事件 */
void lv_port_indev_poll(uint32_t now_ms)
{
    pending_diff += hal_encoder_get_diff();
    uint8_t ev = hal_encoder_key_poll(now_ms);
    if (ev == 1)      pending_key = 1;               /* 短按 → LVGL press */
    else if (ev == 2) input_service_post(INPUT_LONG_PRESS);
}

lv_indev_t *lv_port_indev_get(void) { return enc_indev; }
