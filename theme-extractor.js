'use strict';

// 此脚本运行在 MAIN world（页面上下文），可访问页面 JS 对象（如 ntpApp.theme_）
// 提取 theme_ 中的元信息并写入隐藏 DOM 元素，供隔离 world 的 content.js 读取

(function () {
    function writeToDom(theme) {
        if (!theme) return;
        var el = document.getElementById('__bgdl_theme_data__');
        if (!el) {
            el = document.createElement('div');
            el.id = '__bgdl_theme_data__';
            el.style.display = 'none';
            document.body.appendChild(el);
        }
        el.dataset.title        = theme.backgroundImageAttribution1 || '';
        el.dataset.attribution2 = theme.backgroundImageAttribution2 || '';
        el.dataset.collectionId = theme.backgroundImageCollectionId || '';
        el.dataset.attrUrl      = (theme.backgroundImageAttributionUrl && theme.backgroundImageAttributionUrl.url) || '';
        el.dataset.imageUrl     = (theme.backgroundImage && theme.backgroundImage.url && theme.backgroundImage.url.url) || '';
    }

    function init() {
        var ntpApp = document.querySelector('ntp-app');
        if (!ntpApp) return;

        // 初始同步：脚本可能在 setTheme 回调之后才运行
        if (ntpApp.theme_) writeToDom(ntpApp.theme_);

        // 监听后续主题变更（壁纸切换时触发）
        var router = ntpApp.callbackRouter_;
        if (router && router.setTheme && typeof router.setTheme.addListener === 'function') {
            router.setTheme.addListener(function (theme) {
                writeToDom(theme);
            });
        }
    }

    // ntp-app 在 document_idle 时通常已存在，直接尝试
    if (document.querySelector('ntp-app')) {
        init();
    } else {
        // 极少数情况下 ntp-app 尚未就绪，监听 DOM 等待
        var obs = new MutationObserver(function () {
            if (document.querySelector('ntp-app')) {
                obs.disconnect();
                init();
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }
})();
