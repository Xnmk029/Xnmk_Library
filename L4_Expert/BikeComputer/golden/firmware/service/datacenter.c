/* datacenter.c — 发布-订阅数据中心：Account 订阅 + PingPongBuffer 无锁读 */
#include "datacenter.h"
#include <string.h>

typedef struct {
    const char   *topic;
    void         *buf[2];        /* ping-pong */
    uint32_t      size;
    volatile int  cur;           /* 当前可读 buffer */
    dc_cb_t       cb[DC_MAX_SUB];
    int           nsub;
} dc_topic_t;

static dc_topic_t topics[DC_MAX_TOPIC];
static int ntopic;

int dc_publish_register(const char *topic, void *b0, void *b1, uint32_t size)
{
    if (ntopic >= DC_MAX_TOPIC) return -1;
    dc_topic_t *t = &topics[ntopic];
    t->topic = topic; t->buf[0] = b0; t->buf[1] = b1;
    t->size = size; t->cur = 0; t->nsub = 0;
    return ntopic++;
}

int dc_subscribe(const char *topic, dc_cb_t cb)
{
    for (int i = 0; i < ntopic; i++)
        if (!strcmp(topics[i].topic, topic) && topics[i].nsub < DC_MAX_SUB)
            { topics[i].cb[topics[i].nsub++] = cb; return 0; }
    return -1;
}

/* 生产者：写非当前 buffer → 原子切换 → 通知订阅者 */
int dc_commit(int tid, const void *data)
{
    dc_topic_t *t = &topics[tid];
    int next = t->cur ^ 1;
    memcpy(t->buf[next], data, t->size);
    __DMB();
    t->cur = next;
    for (int i = 0; i < t->nsub; i++) t->cb[i](t->topic, t->buf[next]);
    return 0;
}

const void *dc_read(int tid)
{
    dc_topic_t *t = &topics[tid];
    return t->buf[t->cur];
}
