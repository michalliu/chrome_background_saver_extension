'use strict';

// 此脚本运行在 MAIN world（页面上下文），可访问页面 JS 对象（如 ntpApp.theme_）
// 提取 theme_ 中的元信息并写入隐藏 DOM 元素，供隔离 world 的 content.js 读取

(function () {
    function extract() {
        const ntpApp = document.querySelector('ntp-app');
        const theme = ntpApp && ntpApp.theme_;
        if (!theme) return false;

        let el = document.getElementById('__bgdl_theme_data__');
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
        return true;
    }

    // theme_ 可能在页面生命周期中异步赋值，轮询直到拿到
    const tid = setInterval(function () {
        if (extract()) clearInterval(tid);
    }, 200);
})();
