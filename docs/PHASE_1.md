# Phase 1 — Polish Prayer Tab

> **Status:** ✅ Complete
> **Version bump:** `1.1.0` → `1.2.0`
> **Goal:** Turn the prayer popup from a flat list into a glanceable dashboard, and surface the time-to-next-prayer on the toolbar icon so users don't even need to open the popup.

---

## 1. New Features

| # | Feature | Where it appears |
|---|---|---|
| F1 | **Hijri date line** under the city header (e.g. *Saturday · 14 Dhū al-Qaʿdah 1447 AH*) | Popup |
| F2 | **Next-prayer highlight** — the upcoming prayer's row gets an accent background; past prayers stay muted | Popup |
| F3 | **Live countdown banner** — *"Asr in 1h 45m"* — updates every second while the popup is open | Popup |
| F4 | **Toolbar badge countdown** — `45m` / `2h` shown on the extension icon, refreshed every minute by the service worker | Toolbar |
| F5 | **Qibla compass** — small SVG compass with a needle pointing toward Mecca for the configured city. Reacts to device orientation when sensors are available; iOS 13+ users tap **Enable live compass** to grant permission. On desktop (no sensor) the compass is **draggable** — drag to align cardinals with the user's physical environment. The drag offset is persisted in `chrome.storage.local["qiblaManualOffset"]` so calibration survives popup close. | Popup |

No bugs from Phase 0 are addressed in Phase 1 — this phase is pure addition.

---

## 2. Files Added

| Path | Purpose |
|---|---|
| `docs/PHASE_1.md` | This file. |

(Everything else is a modification — no new modules introduced.)

## 3. Files Modified

| Path | What changed |
|---|---|
| `manifest.json` | Version bumped to `1.2.0`. (No new permissions; `chrome.action.setBadgeText` is part of the existing `action` declaration.) |
| `scripts/api.js` | `fetchTimings()` now returns the full `{ timings, date, meta }` object instead of just `timings`. New `fetchQibla(lat, lng)` wrapper, cached for 30 days (qibla direction for a fixed location is a constant). |
| `scripts/utility.js` | New helpers: `findNextPrayer(timings, now)`, `formatCountdown(ms)` (popup-style `1h 45m 12s`), `formatBadge(ms)` (toolbar-style `45m` / `2h`), `formatHijri(hijri)`, `formatDateLine(date)`. |
| `background.js` | Updated to consume the new `fetchTimings` shape (`data.timings`). New `updateBadge()` function. New `badge-tick` alarm fires every 1 min. Badge is also refreshed eagerly on `prayer:*` and `daily-refresh` alarms to avoid up-to-60 s of stale text. |
| `popup/popup.html` | New `<p id="hijri-line">` under the city header; new `#countdown` banner; new `#qibla-card` with inline SVG compass and a degree readout. |
| `popup/popup.js` | Now consumes the new `fetchTimings` shape. Renders the Hijri line, sets a `setInterval` countdown ticker, marks the next prayer row with `.next`, and fetches qibla in parallel (non-blocking). |
| `popup/popup.css` | New rules for `#hijri-line`, `#countdown`, `tr.next`, `.qibla-card`, `.compass`, `#qibla-needle`. |

---

## 4. Data-Shape Change (breaking inside the codebase)

**Before (P0):**
```js
const timings = await fetchTimings(location); // { Fajr, Dhuhr, ... }
```

**After (P1):**
```js
const { timings, date, meta } = await fetchTimings(location);
// timings: { Fajr, Dhuhr, Asr, Maghrib, Isha, ... }
// date:    { readable, gregorian: {...}, hijri: { day, month: {en, ar}, year, weekday: {en, ar} } }
// meta:    { latitude, longitude, timezone, method: {...} }
```

Both call sites (`popup/popup.js`, `background.js`) were updated.

**Cache migration:** the cache key is unchanged, but the cached *value* shape changed. P0 entries (raw `{ Fajr, Dhuhr, ... }`) are still alive on disk for up to 24 h after upgrade and would crash the new code if returned blindly. `fetchTimings` therefore validates the cached object has `.timings && .date && .meta` before trusting it; mismatching entries are ignored and re-fetched. No data migration step required — the next call repopulates the cache with the new shape.

## 5. New Helpers in `scripts/utility.js`

```js
findNextPrayer(timings, now = Date.now())
// → { name: "Asr", at: 1745234100000 } | null

formatCountdown(ms)
// 6_300_000  → "1h 45m"
// 75_000     → "1m 15s"
// 0          → "now"

formatBadge(ms)                    // ≤ 4 chars
// 6_300_000  → "1h"
// 75_000     → "1m"
// ≤ 0        → ""

formatHijri(hijri)
// → "14 Dhū al-Qaʿdah 1447 AH"

formatDateLine(date)
// → "Saturday · 14 Dhū al-Qaʿdah 1447 AH"
```

## 6. New Alarm

| Alarm name | Period | Handler |
|---|---|---|
| `badge-tick` | 1 minute | `updateBadge()` — recomputes minutes-to-next and writes badge text. |

The handler is also called eagerly from `scheduleToday()` and from the `prayer:*` alarm handler so the toolbar reflects state changes the moment they happen.

## 7. Qibla — Endpoint and Live Orientation

### Endpoint

```
GET https://api.aladhan.com/v1/qibla/{lat}/{lng}
→ { data: { latitude, longitude, direction } }
```

`direction` is the bearing in **degrees clockwise from True North**. Cached for 30 days under `qibla:{lat.toFixed(2)}:{lng.toFixed(2)}` — cheap and never wrong (the qibla doesn't move). The lat/lng comes from the timings response's `meta` block, so no extra geolocation prompt is needed for the API itself.

### Needle math

Static (no live sensor):

```
needleAngle = qiblaBearing
```

Live (compass available):

```
needleAngle = (qiblaBearing - deviceHeading + 360) % 360
```

This way the needle always points to Mecca regardless of which way the user is facing — when the device's heading equals the qibla bearing, the needle points straight up.

### Permission flow

| Platform | What happens |
|---|---|
| iOS Safari 13+ | `DeviceOrientationEvent.requestPermission` exists → popup shows **Enable live compass** button. User taps → permission prompt → on grant, listener attaches and status flips to *Live*. Required because Apple gates motion/orientation sensors behind explicit consent triggered by a user gesture. |
| Android Chrome | No permission API — listener attaches silently. Status shows *Calibrating…* until the first event arrives, then *Live*. |
| Desktop Chrome | Listener attaches silently but no events fire (no sensor). Status falls back to *Static (no sensor)* after 3 s. Bearing remains correct, just not orientation-aware. |

### Heading source

```js
function compassHeadingFromEvent(event) {
    if (event.webkitCompassHeading != null) return event.webkitCompassHeading; // iOS — true heading
    if (event.absolute && event.alpha != null) return (360 - event.alpha) % 360;
    return null;
}
```

Listener prefers `deviceorientationabsolute` (Earth-relative) when supported, falling back to `deviceorientation`.

---

## 8. UI Layout (popup, after Phase 1)

```
┌────────────────────────────────────┐
│  Cairo, Egypt                      │
│  Saturday · 14 Dhū al-Qaʿdah 1447  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Asr in 1h 45m               │  │ ← live countdown
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Fajr             04:34      │  │ ← muted (past)
│  │  Dhuhr            12:53      │  │ ← muted (past)
│  │  Asr              16:23      │  │ ← .next, accent bg
│  │  Maghrib          18:42      │  │
│  │  Isha             20:11      │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ ◯ Qibla   136°               │  │ ← compass + degrees
│  └──────────────────────────────┘  │
│                                    │
│             Settings               │
└────────────────────────────────────┘
```

---

## 9. How to Test Phase 1

1. **Reload the unpacked extension** at `chrome://extensions`.
2. **Toolbar badge** — within ~1 minute, the icon should show e.g. `45m` or `2h`. (If you just reloaded, give it a few seconds for the first `badge-tick`.)
3. **Open the popup** — confirm:
   - City line
   - Hijri date line (e.g. *Saturday · 14 Dhū al-Qaʿdah 1447 AH*)
   - Countdown banner with the *next* prayer's name and a live HMS counter
   - The next prayer's row has a green left-border / background accent
   - Past prayers are muted (unchanged from P0)
   - Qibla card with a compass needle and degree readout
4. **Watch the countdown** — leave the popup open for ~1 minute and verify the seconds tick down.
5. **Change city** in settings → reopen popup → Hijri may stay the same but qibla bearing should update for the new lat/lng.
6. **Inspect badge** — DevTools (service worker) console:
   ```js
   chrome.action.getBadgeText({}, console.log)
   ```
7. **Inspect the qibla cache**:
   ```js
   chrome.storage.local.get(null, console.log) // look for qibla:30.04:31.24 etc.
   ```

---

## 10. Definition of Done

- [x] Hijri date renders for any configured city.
- [x] Countdown banner ticks down live (1 s resolution).
- [x] Next-prayer row is visually distinct from past and future rows.
- [x] Toolbar badge updates within 1 minute of state change and clears (no text) when no prayer remains today.
- [x] Qibla compass renders, needle rotates to correct bearing for the configured city.
- [x] No additional network calls per popup open after caches warm (timings 24 h, qibla 30 days).
- [x] Background and popup share the same `fetchTimings` cache — no double-fetch on a fresh install.

---

## 11. Known Limitations (deferred to later phases)

| Limitation | Resolved in |
|---|---|
| On Chrome desktop the compass stays static — desktops have no magnetometer, so `deviceorientation` events never fire. Status line shows *"Static (no sensor)"* after 3 s. | Hardware-bound. |
| Between Isha and the next day's `daily-refresh` (00:05) the badge clears — we don't pre-fetch tomorrow's Fajr until midnight passes. | Future polish. |
| Hijri month names are English transliterations; Arabic month names are available in the API but not rendered until full RTL/i18n. | Phase 7 |
| Sunrise/Imsak/Midnight are still hidden — only the 5 main prayers render in the table. | Out of scope unless requested. |
