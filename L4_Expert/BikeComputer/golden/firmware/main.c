/* main.c — 系统启动：HAL → Service → App */
#include "at32f435_437.h"
#include "lvgl.h"
#include "hal_lcd.h"
#include "hal_input.h"
#include "hal_gps.h"
#include "hal_power.h"
#include "ff.h"

extern void lv_port_disp_init(void);
extern void lv_port_indev_init(void);
extern void lv_port_indev_poll(uint32_t);
extern int  pm_init(lv_indev_t *);
extern const void *lv_port_indev_get(void);

static FATFS sd_fs;

int main(void)
{
    system_clock_config();                           /* 288MHz PLL */
    delay_init();
    nvic_priority_group_config(NVIC_PRIORITY_GROUP_4);

    hal_power_init();
    hal_gps_init();
    f_mount(&sd_fs, "0:", 1);                        /* SD 卡挂载 */

    lv_init();
    lv_port_disp_init();
    lv_port_indev_init();
    pm_init((lv_indev_t *)lv_port_indev_get());

    /* service 层：datacenter / recorder / storage / mapconv 初始化… */
    extern int services_init(void);
    services_init();

    /* 页面栈：Startup → Dialplate */
    extern const void *app_pages_init(void);
    app_pages_init();

    for (;;) {
        lv_port_indev_poll(system_get_ms());
        lv_task_handler();
        extern void services_tick(void);
        services_tick();
    }
}
