# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A minimal Chrome Extension (Manifest V3) that adds a "Save Wallpaper" button to Chrome's new tab page, allowing users to download the background image with artist attribution in the filename.

No build system, bundler, or package manager — the extension loads directly into Chrome as plain JavaScript.

## Loading the Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

To reload after changes: click the refresh icon on the extension card, then open a new tab.

## Architecture

Five files, no build step:

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest — declares permissions (`downloads`, `notifications`), two content scripts (MAIN + ISOLATED world), and service worker |
| `theme-extractor.js` | Content script running in `MAIN` world — continuously polls `ntp-app.theme_` for metadata changes and bridges data to a hidden DOM element |
| `content.js` | Content script running in ISOLATED world — polls for shadow DOM readiness, injects button, reads metadata from bridged DOM element, triggers download |
| `background.js` | Service worker — receives `DOWNLOAD` messages and calls `chrome.downloads.download()` |
| `icon.png` | Extension icon |

## Key Implementation Details

**Shadow DOM traversal:** The new tab page uses a `<ntp-app>` custom element with a closed-ish shadow root. `content.js` accesses it via `document.querySelector('ntp-app').shadowRoot` and polls every 200ms until `#customizeButton` is present before injecting the button.

**MAIN world bridge (theme-extractor.js):** Content scripts run in an isolated world and cannot access page JS object properties like `ntp-app.theme_`. `theme-extractor.js` is registered with `"world": "MAIN"` in the manifest, giving it access to the page's JS context. It continuously polls `theme_` (every 500ms, skipping writes when the image URL hasn't changed) and writes metadata to a hidden `<div id="__bgdl_theme_data__">` via `dataset` attributes. The isolated-world `content.js` reads this DOM element to get current metadata. Inline `<script>` injection doesn't work here because `chrome://` pages enforce a strict CSP.

**Image URL extraction:** `getImageUrl()` reads from the bridged theme data (`dataset.imageUrl`) first, falling back to parsing the `backgroundImage` iframe's `src` query parameter. The theme data is preferred because `theme_` updates immediately on wallpaper change, while the iframe `src` may lag behind.

**Metadata extraction:** `getMetadata()` reads title (`backgroundImageAttribution1`), artist attribution (`backgroundImageAttribution2`), collection ID (`backgroundImageCollectionId`), and attribution URL from the bridged DOM element, falling back to shadow DOM text content.

**Message passing:** Content script → background worker via `chrome.runtime.sendMessage({ type: 'DOWNLOAD', url, filename })`. Background responds with `{ ok: true, downloadId }` or an error.

**Filename format:** `{title}-{attribution2}-{collectionId}-{timestamp_ms}.jpg` — parts are joined with `-`, each sanitized to remove filesystem-unsafe characters. Example: `新的喜悦-Kate Dehler的艺术作品-rising_artists_collection-1772817180982.png`

**Button states:** idle → loading → done/error → (auto-reset to idle after 2.5s)

## Chrome API Constraints

- `chrome.downloads` API is only available in service workers (background context), not content scripts — this is why message passing is required.
- Content scripts injected into `chrome://` URLs require the `"content_scripts"` manifest entry with explicit URL pattern; `chrome://new-tab-page/*` is one of the few `chrome://` URLs that allows injection.
- MV3 service workers are ephemeral and will be terminated when idle; `background.js` handles this correctly since each message is stateless.
- `chrome://` pages enforce a strict Content Security Policy that blocks inline `<script>` injection. The `"world": "MAIN"` manifest option is used instead to run `theme-extractor.js` in the page's JS context.
- MV3 `"world": "MAIN"` content scripts share the page's JS context but are loaded from the extension's own files, bypassing CSP restrictions that would block inline scripts.
