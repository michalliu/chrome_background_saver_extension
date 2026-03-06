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
function getImageUrl() {
    const themeEl = document.getElementById('__bgdl_theme_data__');
    if (themeEl?.dataset.imageUrl) return themeEl.dataset.imageUrl;

    const iframe = document.getElementById('backgroundImage');
    if (!iframe) return null;
    const src = iframe.src || iframe.getAttribute('src') || '';
    const m = src.match(/[?&]url=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
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

// ── 按钮状态 ─────────────────────────────────────────────────────────────
const STATE = { idle: 0, loading: 1, done: 2, error: 3 };
let currentState = STATE.idle;

function setButtonState(btn, state) {
    currentState = state;
    const btnIcon  = btn.querySelector('.bgdl-icon');
    const btnLabel = btn.querySelector('.bgdl-label');

    const configs = {
        [STATE.idle]:    { icon: '↓', text: '', color: 'rgba(255,255,255,0.18)' },
        [STATE.loading]: { icon: '…', text: '', color: 'rgba(255,255,255,0.10)' },
        [STATE.done]:    { icon: '✓', text: '', color: 'rgba(100,220,130,0.28)' },
        [STATE.error]:   { icon: '✕', text: '', color: 'rgba(255,100,100,0.28)' },
    };
    const c = configs[state];
    btnIcon.textContent  = c.icon;
    btnLabel.textContent = c.text;
    btn.style.background = c.color;
    LOG('按钮状态切换:', c.text);

    if (state === STATE.done || state === STATE.error) {
        setTimeout(() => setButtonState(btn, STATE.idle), 2500);
    }
}

// ── 执行下载（通过 chrome.downloads API）────────────────────────────────
function doDownload(btn) {
    if (currentState === STATE.loading) return;

    const imageUrl = getImageUrl();
    LOG('imageUrl:', imageUrl);
    if (!imageUrl) {
        LOG('✗ 未获取到图片 URL');
        setButtonState(btn, STATE.error);
        return;
    }

    const meta     = getMetadata();
    const filename = buildFilename(meta);
    LOG('metadata:', meta);
    LOG('filename:', filename);

    setButtonState(btn, STATE.loading);

    chrome.runtime.sendMessage(
        { type: 'DOWNLOAD', url: imageUrl, filename },
        (response) => {
            if (chrome.runtime.lastError || !response?.ok) {
                LOG('✗ 下载失败:', chrome.runtime.lastError?.message || response?.error);
                setButtonState(btn, STATE.error);
            } else {
                LOG('✓ 下载完成:', filename);
                setButtonState(btn, STATE.done);
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
        transition:          'background 0.25s, transform 0.15s, box-shadow 0.2s',
        boxShadow:           '0 2px 12px rgba(0,0,0,0.18)',
        userSelect:          'none',
        outline:             'none',
        lineHeight:          '1',
    });

    Object.assign(icon.style,  { fontSize: '15px', lineHeight: '1' });
    Object.assign(label.style, { lineHeight: '1' });

    btn.addEventListener('mouseenter', () => {
        if (currentState !== STATE.loading) {
            btn.style.background = 'rgba(255,255,255,0.28)';
            btn.style.boxShadow  = '0 4px 18px rgba(0,0,0,0.25)';
            btn.style.transform  = 'translateY(-1px)';
        }
    });
    btn.addEventListener('mouseleave', () => {
        if (currentState === STATE.idle) {
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
