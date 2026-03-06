'use strict';

const LOG = (...args) => console.log('[BG Saver] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));

LOG('脚本启动');

// ── 读取作品元信息 ───────────────────────────────────────────────────────
// theme-extractor.js 运行在 MAIN world，将 theme_ 数据写入隐藏 DOM 元素
// 本脚本运行在隔离 world，通过读取该 DOM 元素获取元信息
function getMetadata() {
    const ntpApp = document.querySelector('ntp-app');
    const sr = ntpApp?.shadowRoot;

    // 优先从 MAIN world 注入的 DOM 元素读取
    const themeEl = document.getElementById('__bgdl_theme_data__');

    // 作品标题
    const title = themeEl?.dataset.title
        || sr?.getElementById('backgroundImageAttribution1')?.textContent?.trim()
        || '';

    // 艺术家归属文本，如 "Dirtypote的艺术作品"
    const attribution2 = themeEl?.dataset.attribution2
        || sr?.getElementById('backgroundImageAttribution2')?.textContent?.trim()
        || '';

    // 合集 ID，如 "rising_artists_collection"
    const collectionId = themeEl?.dataset.collectionId || '';

    // 归属链接
    const attrUrl = themeEl?.dataset.attrUrl
        || sr?.getElementById('backgroundImageAttribution')?.href
        || '';

    return { title, attribution2, collectionId, attrUrl };
}

// ── 读取背景图 URL ──────────────────────────────────────────────────────
// 优先从 theme_ 桥接数据读取（切换壁纸时 theme_ 立即更新，iframe src 有延迟）

// 将 Google 图片代理 URL 的分辨率参数替换为 4K (3840×2160)
// 例: =w1920-h1080-p-k-no-nd-mv → =w3840-h2160-p-k-no-nd-mv
function upscaleTo4K(url) {
    if (!url) return url;
    return url.replace(/=w\d+-h\d+/, '=w3840-h2160');
}

function getImageUrl() {
    const themeEl = document.getElementById('__bgdl_theme_data__');
    if (themeEl?.dataset.imageUrl) return upscaleTo4K(themeEl.dataset.imageUrl);

    const iframe = document.getElementById('backgroundImage');
    if (!iframe) return null;
    const src = iframe.src || iframe.getAttribute('src') || '';
    const m = src.match(/[?&]url=([^&]+)/);
    return m ? upscaleTo4K(decodeURIComponent(m[1])) : null;
}

// ── 文件名：包含所有可用元信息 ───────────────────────────────────────────
function sanitize(str) {
    return str.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

function buildFilename(meta) {
    const parts = [];

    // 作品标题
    if (meta.title)        parts.push(sanitize(meta.title));
    // 艺术家归属（保留原始文本，如 "Kate Dehler的艺术作品"）
    if (meta.attribution2) parts.push(sanitize(meta.attribution2));
    // 合集
    if (meta.collectionId) parts.push(sanitize(meta.collectionId));
    // 时间戳兜底（确保文件名唯一）
    parts.push(String(Date.now()));

    if (parts.length === 1) {
        // 没有任何元信息，仅时间戳
        return 'chrome_newtab_bg_' + parts[0] + '.jpg';
    }
    return parts.join('-') + '.jpg';
}

// ── 按钮状态（支持并发下载队列）─────────────────────────────────────────
let pendingCount = 0;
let flashTimer = null;   // 用于短暂显示 ✓/✕ 后恢复

function updateButtonAppearance(btn, flash) {
    const btnIcon  = btn.querySelector('.bgdl-icon');
    const btnLabel = btn.querySelector('.bgdl-label');

    if (flash) {
        // 短暂闪烁成功/失败状态
        const isError = flash === 'error';
        btnIcon.textContent  = isError ? '✕' : '✓';
        btnLabel.textContent = '';
        btn.style.background = isError
            ? 'rgba(255,100,100,0.28)'
            : 'rgba(100,220,130,0.28)';
        btn.style.width      = '32px';
        btn.style.padding    = '0';
        btn.style.gap        = '0';
        LOG('按钮闪烁:', flash);
        return;
    }

    if (pendingCount > 1) {
        btnIcon.textContent  = '…';
        btnLabel.textContent = String(pendingCount);
        btn.style.background = 'rgba(255,255,255,0.10)';
        btn.style.width      = 'auto';
        btn.style.padding    = '0 8px';
        btn.style.gap        = '2px';
    } else if (pendingCount === 1) {
        btnIcon.textContent  = '…';
        btnLabel.textContent = '';
        btn.style.background = 'rgba(255,255,255,0.10)';
        btn.style.width      = '32px';
        btn.style.padding    = '0';
        btn.style.gap        = '0';
    } else {
        btnIcon.textContent  = '↓';
        btnLabel.textContent = '';
        btn.style.background = 'rgba(255,255,255,0.18)';
        btn.style.width      = '32px';
        btn.style.padding    = '0';
        btn.style.gap        = '0';
    }
    LOG('按钮状态: pending=' + pendingCount);
}

function flashButton(btn, type) {
    clearTimeout(flashTimer);
    if (pendingCount > 0) {
        // 还有下载在进行，不闪烁，直接更新计数
        updateButtonAppearance(btn);
        return;
    }
    updateButtonAppearance(btn, type);
    flashTimer = setTimeout(() => updateButtonAppearance(btn), 2500);
}

// ── 执行下载（支持并发，点击时快照 URL 与元信息）────────────────────────
function doDownload(btn) {
    // 立即快照当前图片 URL 与元信息
    const imageUrl = getImageUrl();
    LOG('imageUrl:', imageUrl);
    if (!imageUrl) {
        LOG('✗ 未获取到图片 URL');
        flashButton(btn, 'error');
        return;
    }

    const meta     = getMetadata();
    const filename = buildFilename(meta);
    LOG('metadata:', meta);
    LOG('filename:', filename);

    pendingCount++;
    updateButtonAppearance(btn);

    chrome.runtime.sendMessage(
        { type: 'DOWNLOAD', url: imageUrl, filename },
        (response) => {
            pendingCount--;
            if (chrome.runtime.lastError || !response?.ok) {
                LOG('✗ 下载失败:', chrome.runtime.lastError?.message || response?.error);
                flashButton(btn, 'error');
            } else {
                LOG('✓ 下载完成:', filename);
                flashButton(btn, 'done');
            }
        }
    );
}

// ── 创建按钮 ─────────────────────────────────────────────────────────────
function createButton() {
    LOG('createButton 执行');

    const btn = document.createElement('button');
    btn.id = 'bgdl-save-btn';

    const icon = document.createElement('span');
    icon.className = 'bgdl-icon';
    icon.textContent = '↓';

    const label = document.createElement('span');
    label.className = 'bgdl-label';
    label.textContent = '';

    btn.appendChild(icon);
    btn.appendChild(label);

    Object.assign(btn.style, {
        position:            'fixed',
        bottom:              '16px',
        right:               '56px',  // 16(margin) + 32(customize btn) + 8(gap)
        zIndex:              '9999',
        display:             'flex',
        alignItems:          'center',
        gap:                 '0',
        padding:             '0',
        width:               '32px',
        height:              '32px',
        justifyContent:      'center',
        border:              '1px solid rgba(255,255,255,0.35)',
        borderRadius:        '16px',
        background:          'rgba(255,255,255,0.18)',
        backdropFilter:      'blur(12px) saturate(1.6)',
        WebkitBackdropFilter:'blur(12px) saturate(1.6)',
        color:               'rgba(255,255,255,0.95)',
        fontSize:            '13px',
        fontFamily:          'Google Sans, sans-serif',
        fontWeight:          '500',
        letterSpacing:       '0.01em',
        cursor:              'pointer',
        transition:          'background 0.25s, transform 0.15s, box-shadow 0.2s, width 0.2s, padding 0.2s',
        boxShadow:           '0 2px 12px rgba(0,0,0,0.18)',
        userSelect:          'none',
        outline:             'none',
        lineHeight:          '1',
    });

    Object.assign(icon.style,  { fontSize: '15px', lineHeight: '1' });
    Object.assign(label.style, { lineHeight: '1' });

    btn.addEventListener('mouseenter', () => {
        if (pendingCount === 0) {
            btn.style.background = 'rgba(255,255,255,0.28)';
            btn.style.boxShadow  = '0 4px 18px rgba(0,0,0,0.25)';
            btn.style.transform  = 'translateY(-1px)';
        }
    });
    btn.addEventListener('mouseleave', () => {
        if (pendingCount === 0) {
            btn.style.background = 'rgba(255,255,255,0.18)';
            btn.style.boxShadow  = '0 2px 12px rgba(0,0,0,0.18)';
            btn.style.transform  = '';
        }
    });
    btn.addEventListener('mousedown', () => {
        btn.style.transform = 'translateY(0) scale(0.96)';
    });
    btn.addEventListener('mouseup', () => {
        btn.style.transform = '';
    });

    btn.addEventListener('click', () => doDownload(btn));

    document.body.appendChild(btn);
    LOG('✓ 按钮已挂载到 DOM');
}

// ── 等待 customizeButton 就绪后注入 ──────────────────────────────────────
// 使用 MutationObserver 监听 shadow DOM，避免轮询
function waitForCustomizeButton() {
    const ntpApp = document.querySelector('ntp-app');
    if (!ntpApp) {
        // ntp-app 还没出现，监听 document.body 等它出现
        const bodyObs = new MutationObserver(() => {
            if (document.querySelector('ntp-app')) {
                bodyObs.disconnect();
                waitForCustomizeButton();
            }
        });
        bodyObs.observe(document.body, { childList: true, subtree: true });
        return;
    }

    const sr = ntpApp.shadowRoot;
    if (!sr) return; // 无 shadowRoot 则无法继续

    // 已就绪则直接注入
    if (sr.getElementById('customizeButton')) {
        LOG('✓ customizeButton 已就绪');
        createButton();
        return;
    }

    // 否则监听 shadow DOM 子树变化
    const obs = new MutationObserver(() => {
        if (sr.getElementById('customizeButton')) {
            obs.disconnect();
            LOG('✓ customizeButton 就绪（MutationObserver）');
            createButton();
        }
    });
    obs.observe(sr, { childList: true, subtree: true });
}

waitForCustomizeButton();
