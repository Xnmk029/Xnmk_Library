/* page_sport.c — 骑行数据页示例：订阅 DataCenter 的 SportStatus */
#include "page_manager.h"
#include "datacenter.h"
#include "lvgl.h"

static lv_obj_t *lb_speed, *lb_grid[6];
static int tid_sport = -1;

typedef struct {
    float speed, dist, alt, climb, kcal, course;
    uint32_t ride_sec;
} sport_status_t;

static void on_sport(const char *topic, const void *data)
{
    const sport_status_t *s = data;
    char buf[32];
    lv_snprintf(buf, sizeof(buf), "%.1f", s->speed);
    lv_label_set_text(lb_speed, buf);
    lv_snprintf(buf, sizeof(buf), "%.2f km", s->dist);
    lv_label_set_text(lb_grid[0], buf);
    lv_snprintf(buf, sizeof(buf), "%02d:%02d:%02d",
                s->ride_sec / 3600, s->ride_sec / 60 % 60, s->ride_sec % 60);
    lv_label_set_text(lb_grid[1], buf);
    lv_snprintf(buf, sizeof(buf), "%.0f m", s->alt);
    lv_label_set_text(lb_grid[2], buf);
    lv_snprintf(buf, sizeof(buf), "+%.0f m", s->climb);
    lv_label_set_text(lb_grid[3], buf);
    lv_snprintf(buf, sizeof(buf), "%.0f", s->kcal);
    lv_label_set_text(lb_grid[4], buf);
    lv_snprintf(buf, sizeof(buf), "%.0f°", s->course);
    lv_label_set_text(lb_grid[5], buf);
}

static const char *cap[6] = {"DIST", "TIME", "ALT", "CLIMB", "KCAL", "HDG"};

static void on_load(lv_obj_t *root, lv_group_t *grp)
{
    lv_obj_set_style_bg_color(root, lv_color_black(), 0);
    lb_speed = lv_label_create(root);
    lv_obj_set_style_text_font(lb_speed, &lv_font_montserrat_48, 0);
    lv_obj_set_style_text_color(lb_speed, lv_palette_main(LV_PALETTE_GREEN), 0);
    lv_obj_align(lb_speed, LV_ALIGN_TOP_MID, 0, 46);

    for (int i = 0; i < 6; i++) {
        lv_obj_t *cap_l = lv_label_create(root);
        lv_label_set_text(cap_l, cap[i]);
        lv_obj_set_style_text_color(cap_l, lv_palette_main(LV_PALETTE_GREY), 0);
        lv_obj_set_pos(cap_l, 34 + (i % 2) * 96, 128 + (i / 2) * 32);
        lb_grid[i] = lv_label_create(root);
        lv_obj_set_style_text_color(lb_grid[i], lv_color_white(), 0);
        lv_obj_set_pos(lb_grid[i], 34 + (i % 2) * 96, 144 + (i / 2) * 32);
    }
    if (tid_sport >= 0) dc_subscribe("SportStatus", on_sport);
}

static void on_unload(void) { /* dc_unsubscribe */ }

const page_def_t PAGE_SPORT = {
    .name = "SportData",
    .on_load = on_load,
    .on_hide = NULL,
    .on_show = NULL,
    .on_unload = on_unload,
};

void page_sport_bind(int sport_topic_id) { tid_sport = sport_topic_id; }
