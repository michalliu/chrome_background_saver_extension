'use strict';

// 此脚本运行在 MAIN world（页面上下文），可访问页面 JS 对象（如 ntpApp.theme_）
// 提取 theme_ 中的元信息并写入隐藏 DOM 元素，供隔离 world 的 content.js 读取

(function () {
    var lastUrl = '';

    function sync() {
        var ntpApp = document.querySelector('ntp-app');
        var theme = ntpApp && ntpApp.theme_;
        if (!theme) return;

        // 用图片 URL 作为变更标识，避免每次都写 DOM
        var url = (theme.backgroundImage && theme.backgroundImage.url && theme.backgroundImage.url.url) || '';
        if (url === lastUrl) return;
        lastUrl = url;

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

    // 持续轮询：用户切换壁纸时 theme_ 会更新，需要及时同步到 DOM
    setInterval(sync, 500);
})();
