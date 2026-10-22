/* mapconv.c — Web Mercator 瓦片坐标换算（WGS84；GCJ02 纠偏另表） */
#include "mapconv.h"
#include <math.h>

#define TILE_PX 128                                  /* 设备端瓦片边长 */

void mapconv_ll2tile(double lat, double lon, int z, map_tile_t *t)
{
    double n = (double)(1 << z);
    double xr = (lon + 180.0) / 360.0 * n;
    double la = lat * M_PI / 180.0;
    double yr = (1.0 - log(tan(la) + 1.0 / cos(la)) / M_PI) / 2.0 * n;
    t->x = (int)xr;
    t->y = (int)yr;
    t->z = z;
    /* 视口内像素偏移（定位光标/轨迹投影用） */
    t->px = (int)((xr - t->x) * TILE_PX);
    t->py = (int)((yr - t->y) * TILE_PX);
}

int mapconv_tile_path(char *out, int cap, const char *root, const map_tile_t *t)
{
    return snprintf(out, cap, "%s/%d/%d/%d.bin", root, t->z, t->x, t->y);
}
