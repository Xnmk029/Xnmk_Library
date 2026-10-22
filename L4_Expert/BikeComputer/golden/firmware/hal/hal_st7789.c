/* hal_st7789.c — ST7789 240x240 SPI 驱动 + DMA 局部刷新（AT32F435） */
#include "at32f435_437.h"
#include "hal_lcd.h"

#define LCD_CS_LOW()   gpio_bits_reset(GPIOA, GPIO_PINS_4)
#define LCD_CS_HIGH()  gpio_bits_set(GPIOA, GPIO_PINS_4)
#define LCD_DC_CMD()   gpio_bits_reset(GPIOA, GPIO_PINS_6)
#define LCD_DC_DATA()  gpio_bits_set(GPIOA, GPIO_PINS_6)
#define LCD_RST_LOW()  gpio_bits_reset(GPIOB, GPIO_PINS_0)
#define LCD_RST_HIGH() gpio_bits_set(GPIOB, GPIO_PINS_0)
#define LCD_BLK_ON()   gpio_bits_set(GPIOB, GPIO_PINS_1)

static volatile uint8_t dma_busy = 0;

static void lcd_write(uint8_t dc, const uint8_t *data, uint32_t len)
{
    if (dc) LCD_DC_DATA(); else LCD_DC_CMD();
    LCD_CS_LOW();
    while (len--) {
        while (spi_i2s_flag_get(SPI1, SPI_I2S_TDBE_FLAG) == RESET);
        spi_i2s_data_transmit(SPI1, *data++);
    }
    while (spi_i2s_flag_get(SPI1, SPI_I2S_BF_FLAG) != RESET);
    LCD_CS_HIGH();
}

static void lcd_cmd(uint8_t cmd, const uint8_t *args, uint32_t n)
{
    lcd_write(0, &cmd, 1);
    if (n) lcd_write(1, args, n);
}

void hal_st7789_init(void)
{
    gpio_init_type g;
    crm_periph_clock_enable(CRM_GPIOA_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_GPIOB_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_SPI1_PERIPH_CLOCK, TRUE);
    crm_periph_clock_enable(CRM_DMA1_PERIPH_CLOCK, TRUE);

    /* SCK=PA5 MOSI=PA7 AF5；CS=PA4 DC=PA6 RST=PB0 BLK=PB1 推挽输出 */
    gpio_default_para_init(&g);
    g.gpio_pins = GPIO_PINS_5 | GPIO_PINS_7;
    g.gpio_mode = GPIO_MODE_MUX;
    g.gpio_out_type = GPIO_OUTPUT_PUSH_PULL;
    g.gpio_pull = GPIO_PULL_NONE;
    g.gpio_drive_strength = GPIO_DRIVE_STRENGTH_STRONGER;
    gpio_init(GPIOA, &g);
    gpio_pin_mux_config(GPIOA, GPIO_PINS_SOURCE5, GPIO_MUX_5);
    gpio_pin_mux_config(GPIOA, GPIO_PINS_SOURCE7, GPIO_MUX_5);

    g.gpio_mode = GPIO_MODE_OUTPUT;
    g.gpio_pins = GPIO_PINS_4 | GPIO_PINS_6;
    gpio_init(GPIOA, &g);
    g.gpio_pins = GPIO_PINS_0 | GPIO_PINS_1;
    gpio_init(GPIOB, &g);

    /* SPI1: 主机 8bit, fPCLK/2 ≈ 90MHz 上限由屏规格决定，先用 /4 保守档 */
    spi_init_type s;
    spi_default_para_init(&s);
    s.transmission_mode = SPI_TRANSMIT_FULL_DUPLEX;
    s.master_slave_mode = SPI_MODE_MASTER;
    s.mclk_freq_division = SPI_MCLK_DIV_4;
    s.first_bit_transmission = SPI_FIRST_BIT_MSB;
    s.frame_bit_num = SPI_FRAME_8BIT;
    s.clock_polarity = SPI_CLOCK_POLARITY_HIGH;
    s.clock_phase = SPI_CLOCK_PHASE_2EDGE;
    s.cs_mode_selection = SPI_CS_SOFTWARE_MODE;
    spi_init(SPI1, &s);
    spi_enable(SPI1, TRUE);

    /* DMA1 CH3 -> SPI1 TX */
    dma_init_type d;
    dma_default_para_init(&d);
    d.buffer_size = 0;
    d.direction = DMA_DIR_MEMORY_TO_PERIPHERAL;
    d.memory_base_addr = 0;
    d.memory_data_width = DMA_MEMORY_DATA_WIDTH_BYTE;
    d.memory_inc_enable = TRUE;
    d.peripheral_base_addr = (uint32_t)&SPI1->dt;
    d.peripheral_data_width = DMA_PERIPHERAL_DATA_WIDTH_BYTE;
    d.peripheral_inc_enable = FALSE;
    d.priority = DMA_PRIORITY_HIGH;
    d.loop_mode_enable = FALSE;
    dma_init(DMA1_CHANNEL3, &d);
    dmamux_enable(DMA1, TRUE);
    dmamux_init(DMA1MUX_CHANNEL3, DMAMUX_DMAREQ_ID_SPI1_TX);
    nvic_irq_enable(DMA1_Channel3_IRQn, 1, 0);

    /* ST7789 初始化序列（240x240, IPS, RGB565） */
    LCD_RST_LOW();  delay_ms(20); LCD_RST_HIGH(); delay_ms(120);
    lcd_cmd(0x01, NULL, 0); delay_ms(120);          /* SWRESET */
    lcd_cmd(0x11, NULL, 0); delay_ms(120);          /* SLPOUT  */
    { uint8_t a = 0x55; lcd_cmd(0x3A, &a, 1); }      /* COLMOD 16bit */
    { uint8_t a[4] = {0x00, 0x00, 0x00, 0xF0}; lcd_cmd(0x36, &a[0], 1); a[0] = 0x70; lcd_cmd(0x36, a, 1); } /* MADCTL */
    { uint8_t a[2] = {0x00, 0x00}; lcd_cmd(0x21, NULL, 0); (void)a; } /* INVON */
    lcd_cmd(0x13, NULL, 0);                          /* NORON  */
    lcd_cmd(0x29, NULL, 0); delay_ms(20);            /* DISPON */
    LCD_BLK_ON();
}

/* LVGL flush: 局部窗口 DMA 推送，完成回调 lv_disp_flush_ready */
void hal_st7789_flush(uint16_t x1, uint16_t y1, uint16_t x2, uint16_t y2,
                      const uint16_t *pixels, uint32_t len)
{
    uint8_t col[4] = {x1 >> 8, x1 & 0xFF, x2 >> 8, x2 & 0xFF};
    uint8_t row[4] = {y1 >> 8, y1 & 0xFF, y2 >> 8, y2 & 0xFF};
    lcd_cmd(0x2A, col, 4);                          /* CASET */
    lcd_cmd(0x2B, row, 4);                          /* RASET */
    lcd_cmd(0x2C, NULL, 0);                         /* RAMWR */

    while (dma_busy);
    dma_busy = 1;
    LCD_DC_DATA(); LCD_CS_LOW();
    DMA1_CHANNEL3->maddr = (uint32_t)pixels;
    DMA1_CHANNEL3->dtcnt = len * 2;                 /* 16bit 像素 → 字节数 */
    dma_channel_enable(DMA1_CHANNEL3, TRUE);
    spi_i2s_dma_transmitter_enable(SPI1, TRUE);
}

void DMA1_Channel3_IRQHandler(void)
{
    if (dma_flag_get(DMA1_FDT3_FLAG)) {
        dma_flag_clear(DMA1_FDT3_FLAG);
        while (spi_i2s_flag_get(SPI1, SPI_I2S_BF_FLAG) != RESET);
        spi_i2s_dma_transmitter_enable(SPI1, FALSE);
        LCD_CS_HIGH();
        dma_busy = 0;
        lv_disp_flush_ready(NULL);                  /* 通知 LVGL 本区刷完 */
    }
}

void hal_st7789_backlight(uint8_t on) { if (on) LCD_BLK_ON(); else gpio_bits_reset(GPIOB, GPIO_PINS_1); }
