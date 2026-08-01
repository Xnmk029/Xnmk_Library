// ==UserScript==
// @name         B站评论区显示IP归属地
// @namespace    https://www.bilibili.com/
// @version      1.0
// @description  在B站电脑端评论区强制显示IP归属地信息
// @author       User
// @match        https://www.bilibili.com/*
// @match        https://t.bilibili.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'ip-location-style';
    const ATTR_FLAG = 'data-ip-loc-done';

    // 注入样式
    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .ip-loc-tag {
                display: inline-block;
                font-size: 12px;
                color: #9499a0;
                margin-left: 8px;
                vertical-align: middle;
                white-space: nowrap;
            }
            .ip-loc-tag::before {
                content: "IP属地：";
            }
        `;
        document.head.appendChild(style);
    }

    // 从评论DOM元素中提取IP属地文本（B站新版评论区已有该字段时直接读取）
    function extractLocationFromEl(container) {
        // 新版评论区：.reply-item 内 .sub-reply-item 或 .root-reply-container 下
        // B站有时在 .reply-time 旁边放 .ip-location 或含 "IP属地" 的 span
        const allSpans = container.querySelectorAll('span, div');
        for (const span of allSpans) {
            const text = span.textContent.trim();
            if (text.startsWith('IP属地') && text.includes('：')) {
                return text.replace(/^IP属地[：:]\s*/, '').trim();
            }
        }
        return null;
    }

    // 在指定评论节点中插入IP属地标签
    function insertIpTag(container, location) {
        if (!location) return;
        if (container.querySelector('.ip-loc-tag')) return;

        // 查找插入位置：优先放在时间/点赞栏附近
        const insertTargets = [
            container.querySelector('.reply-time'),
            container.querySelector('.reply-con .time'),
            container.querySelector('.info .time'),
            container.querySelector('.sub-reply-time'),
        ];

        const tag = document.createElement('span');
        tag.className = 'ip-loc-tag';
        tag.textContent = location;

        let inserted = false;
        for (const target of insertTargets) {
            if (target && target.parentNode) {
                target.parentNode.insertBefore(tag, target.nextSibling);
                inserted = true;
                break;
            }
        }

        // 备选：放在用户名后面
        if (!inserted) {
            const nameEl = container.querySelector('.user-name, .name, .sub-user-name');
            if (nameEl && nameEl.parentNode) {
                nameEl.parentNode.insertBefore(tag, nameEl.nextSibling);
                inserted = true;
            }
        }

        // 最终备选：追加到容器
        if (!inserted) {
            container.appendChild(tag);
        }
    }

    // 处理单条评论
    function processComment(el) {
        if (el.getAttribute(ATTR_FLAG)) return;
        el.setAttribute(ATTR_FLAG, '1');

        const loc = extractLocationFromEl(el);
        if (loc) {
            // 如果页面已有IP属地文本但样式不明显，增强显示
            return;
        }
    }

    // 拦截XHR获取评论API中的location字段
    function hookXHR() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...args) {
            this._ipLocUrl = url;
            return origOpen.call(this, method, url, ...args);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (!this._ipLocUrl) return;
                if (!this._ipLocUrl.includes('/x/v2/reply') && !this._ipLocUrl.includes('/reply/main')) return;

                try {
                    const data = JSON.parse(this.responseText);
                    if (data && data.data && data.data.replies) {
                        cacheReplies(data.data.replies);
                        if (data.data.replies) {
                            data.data.replies.forEach(r => {
                                if (r.replies) cacheReplies(r.replies);
                            });
                        }
                    }
                    // 新版API cursor模式
                    if (data && data.data && data.data.cursor && data.data.replies) {
                        cacheReplies(data.data.replies);
                    }
                } catch (e) { /* ignore */ }

                // 延迟处理DOM
                setTimeout(processAllComments, 300);
            });
            return origSend.apply(this, args);
        };
    }

    // 拦截fetch
    function hookFetch() {
        const origFetch = window.fetch;
        window.fetch = function (...args) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
            return origFetch.apply(this, args).then(response => {
                if (url.includes('/x/v2/reply') || url.includes('/reply/main')) {
                    response.clone().json().then(data => {
                        if (data && data.data && data.data.replies) {
                            cacheReplies(data.data.replies);
                            data.data.replies.forEach(r => {
                                if (r.replies) cacheReplies(r.replies);
                            });
                        }
                        setTimeout(processAllComments, 300);
                    }).catch(() => {});
                }
                return response;
            });
        };
    }

    // 缓存 rpid -> location 映射
    const locationCache = new Map();

    function cacheReplies(replies) {
        if (!Array.isArray(replies)) return;
        replies.forEach(r => {
            if (r.rpid && r.location) {
                locationCache.set(String(r.rpid), r.location);
            }
            // 新版字段
            if (r.rpid_str && r.location) {
                locationCache.set(r.rpid_str, r.location);
            }
        });
    }

    // 遍历所有评论节点，尝试从缓存中匹配并插入IP属地
    function processAllComments() {
        injectStyle();

        // 新版评论区选择器
        const commentEls = document.querySelectorAll(
            '.reply-item, .sub-reply-item, .list-item.reply-wrap, .comment-list .list-item'
        );

        commentEls.forEach(el => {
            if (el.querySelector('.ip-loc-tag')) return;

            // 尝试从DOM中获取rpid
            let rpid = null;

            // 方式1：data属性
            rpid = el.getAttribute('data-rpid') || el.getAttribute('data-id');

            // 方式2：从链接中提取
            if (!rpid) {
                const link = el.querySelector('a[href*="/reply/"], a[data-rpid]');
                if (link) {
                    rpid = link.getAttribute('data-rpid');
                    if (!rpid) {
                        const m = link.href.match(/reply\/(\d+)/);
                        if (m) rpid = m[1];
                    }
                }
            }

            // 方式3：从评论ID隐藏字段
            if (!rpid) {
                const idEl = el.querySelector('[id^="comment_"]');
                if (idEl) {
                    rpid = idEl.id.replace('comment_', '');
                }
            }

            if (rpid && locationCache.has(String(rpid))) {
                insertIpTag(el, locationCache.get(String(rpid)));
            } else {
                // 尝试直接从DOM读取已有的IP属地
                const loc = extractLocationFromEl(el);
                if (loc) {
                    // 已有显示，无需处理
                }
            }
        });
    }

    // MutationObserver 监听动态加载
    function observeDOM() {
        const observer = new MutationObserver(mutations => {
            let shouldProcess = false;
            for (const m of mutations) {
                if (m.addedNodes.length > 0) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1 && (
                            node.matches?.('.reply-item, .sub-reply-item, .comment-list, .reply-list') ||
                            node.querySelector?.('.reply-item, .sub-reply-item')
                        )) {
                            shouldProcess = true;
                            break;
                        }
                    }
                }
                if (shouldProcess) break;
            }
            if (shouldProcess) {
                setTimeout(processAllComments, 200);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 初始化
    function init() {
        injectStyle();
        hookXHR();
        hookFetch();
        observeDOM();

        // 首次处理（页面可能已加载评论）
        setTimeout(processAllComments, 1000);
        setTimeout(processAllComments, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
