# Phase 8 — Hardening

> **Status:** ✅ Complete
> **Version bump:** `1.8.0` → `1.9.0`
> **Goal:** Make every network-dependent path tolerate transient failures, every page show clear loading / error states, and every interactive element be keyboard-reachable with a visible focus ring and accurate accessible labels.

---

## 1. Areas Hardened

| # | Area | Change |
|---|---|---|
| H1 | **Network resilience** | New `scripts/retry.js` — `withRetry(fn, { retries: 2, baseMs: 400, factor: 2 })`. Wraps every public API fetcher. Retries only on network errors and 5xx; bails immediately on 4xx (won't recover by trying again). |
| H2 | **Cache-on-failure** | `fetchTimingsStaleOk` was added in Phase 5; now extended to `fetchSurah`, `fetchHadithPage`, `fetchAzkar`, `fetchStations`, `fetchReciters` — when retry exhausts, fall back to *any* cached entry (even past TTL) so the UI keeps working offline. |
| H3 | **Focus-visible rings** | Every interactive element now has a `:focus-visible` outline matching the accent color. Keyboard users see a clear focus ring; mouse clicks don't. |
| H4 | **ARIA labels on icon-only controls** | Every `✕`, `↻`, `⏸`, `▶`, `🔖`, `📖` button has an `aria-label` reflecting its meaning, and live regions (`aria-live`) on status texts that change asynchronously (countdown, audio mini, save status). |
| H5 | **Error states** | Sub-features fail gracefully instead of hiding silently — hadith card, qibla card, and audio mini each surface a brief error if available; popup itself still works if any sub-feature fails. |
| H6 | **Console hygiene** | Removed debug `console.log` calls (the one-shot `[azkar]` sample dump in particular). Kept `console.warn`/`error` only where they're actionable for the user. |

---

## 2. New File

| Path | Purpose |
|---|---|
| `scripts/retry.js` | `withRetry(fn, opts)` — generic exponential-backoff wrapper. Retries on `TypeError` (network failure) and `Response`-thrown 5xx. Each retry sleeps `baseMs * factor^(attempt-1)` plus a small jitter. |
| `docs/PHASE_8.md` | This file. |

## 3. Modified Files

| Path | Change |
|---|---|
| `manifest.json` | Version `1.9.0`. |
| `scripts/api.js`, `scripts/quran.js`, `scripts/quran-audio.js`, `scripts/hadith.js`, `scripts/azkar.js`, `scripts/radio.js` | All public fetchers wrapped with `withRetry`. Stale-cache fallback applied where it makes sense (timings, surahs, hadith pages, azkar bundle, station list, reciter list). |
| `popup/popup.css`, `options/options.css`, `reader/reader.css`, `hadith/hadith.css`, `azkar/azkar.css`, `radio/radio.css` | `:focus-visible { outline }` added to buttons, links, list items. |
| `popup/popup.html`, `reader/reader.html`, `hadith/hadith.html`, `azkar/azkar.html`, `radio/radio.html` | `aria-label` on icon-only buttons; `aria-live` on status / countdown / mini-player title. |
| `scripts/azkar.js` | `firstSample` debug log removed; the cleanText path is now silent on success. |

---

## 4. Retry Strategy

```js
export async function withRetry(fn, { retries = 2, baseMs = 400, factor = 2 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (!isRetryable(err) || attempt === retries) throw err;
            const delay = baseMs * Math.pow(factor, attempt) + Math.random() * 200;
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
}
```

`isRetryable(err)`:
- `TypeError` → likely a network/DNS failure → retry
- `Error("...:5xx")` thrown by our fetch wrappers → retry
- `Error("...:4xx")` → don't retry (client error)
- anything else → don't retry

Default `{ retries: 2, baseMs: 400 }` → 0 ms / 400 ms / 800 ms = **3 attempts over ~1.2 s**, plus jitter. Slow networks get a chance; permanent failures still bail quickly.

---

## 5. Stale-Cache Fallback Policy

Each fetcher checks fresh cache → tries network with retry → on terminal failure, falls back to expired cache if it exists:

```js
export async function fetchSurah(number) {
    const key = `surah:${number}`;
    const cached = await cacheGet(key);                  // fresh
    if (cached?.ayahs) return cached;
    try {
        return await withRetry(() => fetchSurahNetwork(number));
    } catch (err) {
        const stale = await cacheGet(key, { staleOk: true });
        if (stale?.ayahs) return stale;
        throw err;
    }
}
```

Trade-off: *the user reads stale text in offline mode, which is fine for surahs / hadiths (canonical, unchanging) and acceptable for timings (one day stale at most).* For radio stations the fallback gives the previous list — also fine; user might just have to refresh later.

---

## 6. Accessibility Audit

### Keyboard-reachable + visible focus
Every interactive element across all pages now has:

```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
[role="button"]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: inherit;
}
```

### ARIA labels added
- Popup: `audio-mini-toggle` ("Play / pause"), `audio-mini-stop` ("Stop"), `qibla-calibrate` ("Enable live compass"), `settings-link` (`role="button"` + `aria-label`)
- Reader: per-ayah `📖` ("Toggle tafsir"), `🔖` ("Toggle bookmark"), resume banner `✕` ("Dismiss")
- Hadith: per-row `🔖` ("Toggle bookmark"), pager buttons (already had text)
- Azkar: per-card `↻` ("Reset this dhikr"), `↻ Reset all` (already textual)
- Radio: per-row play button ("Play / stop {station name}")

### Live regions
- Popup countdown: `aria-live="polite"` so screen readers announce the next prayer when it changes.
- Audio mini title + time: `aria-live="polite"`.
- Options save status (`#status`): already had `aria-live="polite"`.

---

## 7. How to Test Phase 8

1. **Reload** at `chrome://extensions`.
2. **Network resilience:**
   - DevTools → Network tab → toggle "Offline" → reload the popup → it still renders the prayer table from stale cache; a brief retry + fallback happens behind the scenes.
   - Toggle back online → reload → fresh data wins.
3. **Keyboard nav:**
   - Open the popup; press `Tab` repeatedly — focus ring visibly hops through buttons. `Enter` activates each.
   - Same in the reader, hadith, azkar, radio, options pages.
4. **Screen reader smoke test (Windows Narrator / NVDA):**
   - Activate Narrator; open the popup. Each button announces its label. The countdown banner re-announces when the prayer name changes. The audio mini title re-announces when a new station starts.
5. **Console hygiene:**
   - Open every page → DevTools console → no `[azkar]` debug spam, no unhandled rejections, no errors during normal use.

---

## 8. Definition of Done

- [x] All network fetchers retry transient failures with exponential backoff.
- [x] All cached-data fetchers fall back to stale cache on terminal failure.
- [x] Every interactive element shows a visible focus ring under keyboard navigation.
- [x] Every icon-only button has an aria-label.
- [x] Every async-updating status text is wrapped in `aria-live`.
- [x] No debug `console.log` calls fire during normal operation.

---

## 9. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| No formal Lighthouse a11y run (extension popups can't be audited by Lighthouse directly). Reader / hadith / etc. could be tested by opening their `chrome-extension://` URL in a regular tab. | Manual run if needed. |
| Service-worker isn't tested under Chrome's "Wake from idle" path — it should reattach listeners correctly because `import` runs once per wake, but there's no automated test. | Out of scope. |
| Notifications fired by the SW still use English titles (`Prayer time: Fajr`); translating them requires `getSettings()` in the SW context, which it already does — could route through `t()` if we ever load i18n in the SW. | Future polish. |
