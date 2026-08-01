// ==UserScript==
// @name         Bilibili IP归属地显示
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在B站电脑端显示用户IP归属地
// @author       You
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.live.bilibili.com
// @connect      api.bilibili.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .ip-location-badge {
            display: inline-block;
            padding: 2px 6px;
            margin-left: 6px;
            font-size: 12px;
            font-weight: 400;
            color: #fff;
            background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
            border-radius: 4px;
            vertical-align: middle;
            line-height: 1.4;
        }
        .ip-location-badge.gray {
            background: linear-gradient(45deg, #888, #aaa);
        }
    `);

    const cache = new Map();

    async function fetchIpLocation(mid) {
        if (cache.has(mid)) return cache.get(mid);

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.live.bilibili.com/live_user/v1/UserInfo/get_user_info_by_uid?uid=${mid}`,
                timeout: 8000,
                onload: function (resp) {
                    try {
                        const data = JSON.parse(resp.responseText);
                        if (data.code === 0 && data.data) {
                        }
                        resolve(null);
                    } catch (e) {
                        resolve(null);
                    }
                },
                onerror: function () {
                    resolve(null);
                },
                onloadtimeout: function () {
                    resolve(null);
                }
            });
        }).then(result => {
            cache.set(mid, result);
            return result;
        });
    }

    function createBadge(text) {
        const badge = document.createElement('span');
        badge.className = 'ip-location-badge';
        badge.textContent = text;
        return badge;
    }

    function insertBadge(container, badge) {
        if (!container) return;
        if (container.querySelector('.ip-location-badge')) return;
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.appendChild(badge);
    }

    function processUserCard(cardEl, mid) {
        if (!cardEl || !mid) return;
        const badge = createBadge('加载中...');
        badge.classList.add('gray');
        insertBadge(cardEl, badge);

        fetchIpLocation(mid).then(loc => {
            if (loc) {
                badge.textContent = loc;
                badge.classList.remove('gray');
            } else {
                badge.textContent = '未知';
                badge.classList.add('gray');
            }
        });
    }

    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    const userCard = node.matches ? node : node.querySelector?.('.user-card, .user-info-card, .bili-user-card');
                    if (userCard) {
                        const midLink = userCard.querySelector('a[href*="/user/"], a[href*="/space/"]');
                        const mid = midLink ? midLink.href.match(/(\d+)/)?.[1] : null;
                        if (mid) processUserCard(userCard, mid);
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        observeDOM();

        const userLinks = document.querySelectorAll('a[href*="/space/"], a[href*="/user/"]');
        userLinks.forEach(link => {
            const mid = link.href.match(/(\d+)/)?.[1];
            if (mid) {
                const card = link.closest('.user-card, .user-info, .user-item, .follow-item');
                if (card) processUserCard(card, mid);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('load', () => {
        setTimeout(init, 1000);
    });
})();
