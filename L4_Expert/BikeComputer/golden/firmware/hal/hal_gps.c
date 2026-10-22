/* hal_gps.c — ATGM336H NMEA0183 解析（RMC/GGA），USART2 中断收包 */
#include "at32f435_437.h"
#include "hal_gps.h"
#include <string.h>
#include <stdlib.h>

static gps_data_t g_gps;
static char nmea_buf[128];
static uint8_t nmea_len;

static double nmea_to_deg(const char *f, char hemi)
{
    double v = atof(f) / 100.0;
    int d = (int)v;
    double deg = d + (v - d) / 0.6;
    return (hemi == 'S' || hemi == 'W') ? -deg : deg;
}

static void parse_rmc(char *s)
{
    /* $GNRMC,hhmmss.sss,A,lat,N,lon,E,spd,crs,ddmmyy,... */
    char *f[16]; int n = 0;
    for (char *p = strtok(s + 7, ","); p && n < 16; p = strtok(NULL, ",")) f[n++] = p;
    if (n < 9) return;
    g_gps.valid = (f[2][0] == 'A');
    if (!g_gps.valid) { g_gps.lat = g_gps.lon = 0; return; }
    g_gps.lat = nmea_to_deg(f[3], f[4][0]);
    g_gps.lon = nmea_to_deg(f[5], f[6][0]);
    g_gps.speed_kmh = (float)(atof(f[7]) * 1.852);   /* 节 → km/h */
    g_gps.course = (float)atof(f[8]);
}

static void parse_gga(char *s)
{
    /* $GNGGA,hhmmss,q,sat,hdop,alt,M,... */
    char *f[16]; int n = 0;
    for (char *p = strtok(s + 7, ","); p && n < 16; p = strtok(NULL, ",")) f[n++] = p;
    if (n < 9) return;
    g_gps.sats = atoi(f[7]);
    g_gps.alt = (float)atof(f[9]);
}

void hal_gps_init(void)
{
    gpio_init_type g;
    crm_periph_clock_enable(CRM_GPIOA_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_USART2_PERIPH_CLOCK, TRUE);
    gpio_default_para_init(&g);
    g.gpio_pins = GPIO_PINS_2 | GPIO_PINS_3;
    g.gpio_mode = GPIO_MODE_MUX;
    g.gpio_pull = GPIO_PULL_UP;
    gpio_init(GPIOA, &g);
    gpio_pin_mux_config(GPIOA, GPIO_PINS_SOURCE2, GPIO_MUX_7);
    gpio_pin_mux_config(GPIOA, GPIO_PINS_SOURCE3, GPIO_MUX_7);

    usart_init(USART2, 9600, USART_DATA_8BITS, USART_STOP_1_BIT);
    usart_receiver_enable(USART2, TRUE);
    usart_transmitter_enable(USART2, TRUE);
    usart_interrupt_enable(USART2, USART_RDBF_INT, TRUE);
    usart_enable(USART2, TRUE);
    nvic_irq_enable(USART2_IRQn, 2, 0);
}

/* 提至 115200 + 5Hz 更新（PCAS 语句，按需启用） */
void hal_gps_config_5hz(void)
{
    const char *cmd = "$PCAS04,5*18\r\n";            /* 5Hz */
    while (*cmd) {
        while (usart_flag_get(USART2, USART_TDBE_FLAG) == RESET);
        usart_data_transmit(USART2, *cmd++);
    }
}

void USART2_IRQHandler(void)
{
    if (usart_flag_get(USART2, USART_RDBF_FLAG)) {
        char ch = (char)usart_data_receive(USART2);
        if (ch == '$') { nmea_len = 0; }
        else if (ch == '\n') {
            nmea_buf[nmea_len] = 0;
            if (!strncmp(nmea_buf, "$GNRMC", 6) || !strncmp(nmea_buf, "$GPRMC", 6))
                parse_rmc(nmea_buf);
            else if (!strncmp(nmea_buf, "$GNGGA", 6) || !strncmp(nmea_buf, "$GPGGA", 6))
                parse_gga(nmea_buf);
        }
        else if (nmea_len < sizeof(nmea_buf) - 1) nmea_buf[nmea_len++] = ch;
    }
}

const gps_data_t *hal_gps_data(void) { return &g_gps; }
