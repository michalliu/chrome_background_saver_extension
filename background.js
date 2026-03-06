'use strict';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'DOWNLOAD') return false;

    chrome.downloads.download(
        { url: msg.url, filename: msg.filename, saveAs: false },
        (downloadId) => {
            if (chrome.runtime.lastError || downloadId === undefined) {
                sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'unknown error' });
            } else {
                sendResponse({ ok: true, downloadId });
            }
        }
    );

    return true; // 保持 sendResponse 通道异步有效
});
