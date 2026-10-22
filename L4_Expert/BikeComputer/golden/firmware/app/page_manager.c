/* page_manager.c — 页面栈 + 生命周期管理 + 编码器导航 */
#include "page_manager.h"
#include "lvgl.h"
#include <string.h>

#define PAGE_STACK_MAX 8

typedef struct {
    const page_def_t *def;
    lv_obj_t *root;
} page_ent_t;

static page_ent_t pstack[PAGE_STACK_MAX];
static int ptop = -1;
static lv_group_t *enc_group;

int pm_init(lv_indev_t *indev)
{
    enc_group = lv_group_create();
    lv_indev_set_group(indev, enc_group);
    return 0;
}

lv_group_t *pm_group(void) { return enc_group; }

int pm_push(const page_def_t *def)
{
    if (ptop + 1 >= PAGE_STACK_MAX) return -1;
    if (ptop >= 0 && pstack[ptop].def->on_hide)
        pstack[ptop].def->on_hide();
    page_ent_t *e = &pstack[++ptop];
    e->def = def;
    e->root = lv_obj_create(NULL);
    lv_group_remove_all_objs(enc_group);
    if (def->on_load) def->on_load(e->root, enc_group);
    lv_scr_load_anim(e->root, LV_SCR_LOAD_ANIM_MOVE_LEFT, 220, 0, false);
    return 0;
}

int pm_pop(void)
{
    if (ptop <= 0) return -1;
    page_ent_t *e = &pstack[ptop--];
    if (e->def->on_unload) e->def->on_unload();
    lv_obj_del(e->root);
    page_ent_t *prev = &pstack[ptop];
    lv_group_remove_all_objs(enc_group);
    if (prev->def->on_show) prev->def->on_show(enc_group);
    lv_scr_load_anim(prev->root, LV_SCR_LOAD_ANIM_MOVE_RIGHT, 220, 0, false);
    return 0;
}

/* 旋转切页：主层级页面在栈底平移切换 */
int pm_next_home(const page_def_t **home_pages, int n, int dir)
{
    if (ptop != 0) return -1;                        /* 仅在主层级生效 */
    const page_def_t *cur = pstack[0].def;
    int idx = 0;
    for (int i = 0; i < n; i++) if (home_pages[i] == cur) idx = i;
    idx = (idx + dir + n) % n;
    page_ent_t *e = &pstack[0];
    if (e->def->on_hide) e->def->on_hide();
    e->def = home_pages[idx];
    e->root = lv_obj_create(NULL);
    lv_group_remove_all_objs(enc_group);
    if (e->def->on_load) e->def->on_load(e->root, enc_group);
    lv_scr_load_anim(e->root,
        dir > 0 ? LV_SCR_LOAD_ANIM_MOVE_LEFT : LV_SCR_LOAD_ANIM_MOVE_RIGHT,
        220, 0, true);                               /* 旧页自动删除 */
    return 0;
}
