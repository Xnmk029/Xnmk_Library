/* hal_power.c — 电量 ADC、充电状态、关机/休眠 */
#include "at32f435_437.h"
#include "hal_power.h"

void hal_power_init(void)
{
    gpio_init_type g;
    crm_periph_clock_enable(CRM_GPIOA_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_ADC1_PERIPH_CLOCK, TRUE);

    gpio_default_para_init(&g);
    g.gpio_pins = GPIO_PINS_0;                       /* PA0 分压输入 */
    g.gpio_mode = GPIO_MODE_ANALOG;
    gpio_init(GPIOA, &g);
    g.gpio_pins = GPIO_PINS_1;                       /* PA1 CHG_STAT 开漏输入 */
    g.gpio_mode = GPIO_MODE_INPUT;
    g.gpio_pull = GPIO_PULL_UP;
    gpio_init(GPIOA, &g);

    adc_base_config_type c;
    adc_base_default_para_init(&c);
    c.sequence_mode = FALSE;
    c.repeat_mode = FALSE;
    c.data_align = ADC_RIGHT_ALIGNMENT;
    c.ordinary_channel_length = 1;
    adc_base_config(ADC1, &c);
    adc_ordinary_channel_set(ADC1, ADC_CHANNEL_0, 1, ADC_SAMPLETIME_247_5);
    adc_ordinary_part_trigger_enable(ADC1, FALSE);
    adc_enable(ADC1, TRUE);
    adc_calibration_init(ADC1);
    while (adc_calibration_init_status_get(ADC1));
    adc_calibration_start(ADC1);
    while (adc_calibration_start_status_get(ADC1));
}

/* 分压 100k/100k → ADC = Vbat/2；3.3V 参考, 12bit */
uint16_t hal_battery_mv(void)
{
    adc_ordinary_software_trigger_enable(ADC1, TRUE);
    while (adc_flag_get(ADC1, ADC_OCCO_FLAG) == RESET);
    uint32_t v = adc_ordinary_conversion_data_get(ADC1);
    return (uint16_t)((v * 3300 * 2) / 4095);
}

uint8_t hal_battery_percent(void)
{
    uint16_t mv = hal_battery_mv();
    if (mv >= 4150) return 100;                      /* 4.15V 满 */
    if (mv <= 3400) return 0;                        /* 3.4V 截止 */
    return (uint8_t)((mv - 3400) * 100 / 750);       /* 线性近似 */
}

uint8_t hal_charge_status(void)
{
    return gpio_input_data_bit_read(GPIOA, GPIO_PINS_1) == RESET ? 1 : 0;
}

/* 休眠：关背光 → GPS 备份模式 → MCU sleep（WFE） */
void hal_power_sleep(void)
{
    extern void hal_st7789_backlight(uint8_t);
    hal_st7789_backlight(0);
    __WFE();
}
