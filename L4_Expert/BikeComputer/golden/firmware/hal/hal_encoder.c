/* hal_encoder.c — TIM3 编码器模式 + 按压按键（短按/长按） */
#include "at32f435_437.h"
#include "hal_input.h"

#define ENC_SW_PIN   GPIO_PINS_10
#define ENC_SW_PORT  GPIOA

static int32_t  enc_last_cnt = 0;
static uint32_t press_tick = 0;
static uint8_t  press_state = 0;

void hal_encoder_init(void)
{
    gpio_init_type g;
    crm_periph_clock_enable(CRM_GPIOA_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_TMR3_PERIPH_CLOCK, TRUE);

    /* PA8/PA9 -> TIM3_CH1/CH2 (MUX2)，正交输入上拉 */
    gpio_default_para_init(&g);
    g.gpio_pins = GPIO_PINS_8 | GPIO_PINS_9;
    g.gpio_mode = GPIO_MODE_MUX;
    g.gpio_pull = GPIO_PULL_UP;
    gpio_init(GPIOA, &g);
    gpio_pin_mux_config(GPIOA, GPIO_PINS_SOURCE8, GPIO_MUX_2);
    gpio_pin_mux_config(GPIOA, GPIO_PINS_SOURCE9, GPIO_MUX_2);

    /* PA10 按键输入上拉 */
    g.gpio_pins = ENC_SW_PIN;
    g.gpio_mode = GPIO_MODE_INPUT;
    gpio_init(ENC_SW_PORT, &g);

    /* TIM3 编码器模式：两沿计数，自动重装 0xFFFF */
    tmr_input_config_type ic;
    tmr_input_default_para_init(&ic);
    ic.input_channel_select = TMR_SELECT_CHANNEL_1;
    ic.input_mapped_select = TMR_CC_CHANNEL_MAPPED_DIRECT;
    ic.input_polarity_select = TMR_INPUT_RISING_EDGE;
    ic.input_filter_value = 6;                       /* 消抖滤波 */
    tmr_input_channel_init(TMR3, &ic, TMR_CHANNEL_INPUT_DIV_1);
    ic.input_channel_select = TMR_SELECT_CHANNEL_2;
    tmr_input_channel_init(TMR3, &ic, TMR_CHANNEL_INPUT_DIV_1);
    tmr_encoder_mode_config(TMR3, TMR_ENCODER_MODE_C,
                            TMR_INPUT_RISING_EDGE, TMR_INPUT_RISING_EDGE);
    tmr_period_buffer_enable(TMR3, FALSE);
    TMR3->pr = 0xFFFF;
    tmr_counter_enable(TMR3, TRUE);
}

/* 返回自上次调用起的增量步数（含方向），用于 LVGL indev enc_diff */
int32_t hal_encoder_get_diff(void)
{
    int32_t now = (int32_t)(uint16_t)TMR3->cval;
    int32_t diff = now - enc_last_cnt;
    if (diff > 32767) diff -= 65536;
    if (diff < -32767) diff += 65536;
    enc_last_cnt = now;
    return diff / 2;                                 /* 一格=两沿，按器件规格调整 */
}

/* 按键状态机：返回 0=无事件 1=短按 2=长按（>800ms 触发一次） */
uint8_t hal_encoder_key_poll(uint32_t now_ms)
{
    uint8_t down = (gpio_input_data_bit_read(ENC_SW_PORT, ENC_SW_PIN) == RESET);
    switch (press_state) {
    case 0:
        if (down) { press_state = 1; press_tick = now_ms; }
        break;
    case 1:
        if (!down) { press_state = 0;
            return (now_ms - press_tick < 800) ? 1 : 0; }
        if (now_ms - press_tick >= 800) { press_state = 2; return 2; }
        break;
    case 2:
        if (!down) press_state = 0;
        break;
    }
    return 0;
}
