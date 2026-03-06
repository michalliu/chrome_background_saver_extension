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

Four files, no build step:

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest — declares permissions (`downloads`, `notifications`), content script, and service worker |
| `content.js` | Injected into `chrome://new-tab-page/*` — polls for shadow DOM readiness, injects button, extracts image URL and artist attribution, triggers download |
| `background.js` | Service worker — receives `DOWNLOAD` messages and calls `chrome.downloads.download()` |
| `icon.png` | Extension icon |

## Key Implementation Details

**Shadow DOM traversal:** The new tab page uses a `<ntp-app>` custom element with a closed-ish shadow root. `content.js` accesses it via `document.querySelector('ntp-app').shadowRoot` and polls every 200ms until `#customizeButton` is present before injecting the button.

**Image URL extraction:** The wallpaper URL is embedded as a query parameter in an iframe's `src` attribute inside the shadow DOM. `getImageUrl()` parses it out.

**Artist attribution:** Read from `#backgroundImageAttribution1` / `#backgroundImageAttribution2` elements within the shadow DOM via `getAttribution()`.

**Message passing:** Content script → background worker via `chrome.runtime.sendMessage({ type: 'DOWNLOAD', url, filename })`. Background responds with `{ ok: true, downloadId }` or an error.

**Filename format:** `{artist_name}_{unix_timestamp_ms}.jpg`

**Button states:** idle → loading → done/error → (auto-reset to idle after 2.5s)

## Chrome API Constraints

- `chrome.downloads` API is only available in service workers (background context), not content scripts — this is why message passing is required.
- Content scripts injected into `chrome://` URLs require the `"content_scripts"` manifest entry with explicit URL pattern; `chrome://new-tab-page/*` is one of the few `chrome://` URLs that allows injection.
- MV3 service workers are ephemeral and will be terminated when idle; `background.js` handles this correctly since each message is stateless.
