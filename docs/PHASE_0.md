# Phase 0 — Stabilize

> **Status:** ✅ Complete
> **Version bump:** `1.0` → `1.1.0`
> **Goal:** Move from a fragile demo (CDN-loaded Bootstrap, popup-only `setTimeout` notifications, hardcoded Cairo) to a reliable v1 with persistent reminders, cached fetches, and a real settings page.

---

## 1. Bugs Fixed

| # | Bug (in v1.0) | Fix (in v1.1) |
|---|---|---|
| 1 | Notifications were scheduled with `setTimeout` **inside the popup**, which is destroyed the moment the popup closes — so reminders almost never fired. | Scheduling moved to the MV3 service worker (`background.js`) using `chrome.alarms`. Alarms wake the worker on time even when Chrome is idle. |
| 2 | `Notification.requestPermission()` was commented out; the popup tried to fire `new Notification(...)` with no permission flow. | The `notifications` permission in the manifest grants `chrome.notifications.create` directly — no runtime prompt needed. |
| 3 | Notification icon path was `"icon-48.png"` (relative to popup dir, didn't resolve). | Now `chrome.runtime.getURL("images/icon-128.png")` — absolute, always resolves. |
| 4 | Bootstrap CSS + JS loaded from `cdn.jsdelivr.net` — MV3 CSP blocks remote JS, and the CSS load made the popup depend on a network request. | Bootstrap removed entirely. Popup is styled with ~80 lines of native CSS. |
| 5 | "Past prayer" detection used `currentHourse - timeHourse` integer arithmetic which has off-by-one issues around the minute boundary. | Replaced with timestamp comparison (`Date.now() < todayAt(hhmm)`). |
| 6 | City / country / method were hardcoded constants in `popup.js`. | Now read from `chrome.storage.sync` via `getSettings()`; configurable via the options page. |
| 7 | Every popup open triggered a network request, even for the same day's timings. | Aladhan response is cached for 24 h in `chrome.storage.local`, keyed by `(city, country, method, date)`. Subsequent opens are instant. |
| 8 | `console.log` debug spam every render. | Removed. |
| 9 | `manifest.json` registered `content_scripts` against `<all_urls>` even though `content/content.js` was empty — a perf hit on every page load. | Content-script registration removed. `activeTab` permission also removed (unused). |

---

## 2. Files Added

| Path | Purpose |
|---|---|
| `scripts/utility.js` | Date helpers: `formatDateAladhan`, `localDateKey`, `todayAt`, `nextLocalMidnightPlus5`, plus the canonical `MAIN_PRAYERS` list. |
| `scripts/cache.js` | TTL cache wrapping `chrome.storage.local` (`cacheGet` / `cacheSet`). Auto-evicts on read after expiry. |
| `scripts/settings.js` | `DEFAULT_SETTINGS`, `getSettings`, `setSettings` against `chrome.storage.sync` with deep-merge. |
| `scripts/api.js` | `fetchTimings({city, country, method}, date)` — Aladhan wrapper with 24 h cache. The single source of truth for prayer-time data. |
| `scripts/locations.js` | Curated list of ~47 countries with their major cities (~250 cities total) for the cascading dropdowns in settings. Exports `COUNTRIES` and `citiesFor(name)`. |
| `docs/PHASE_0.md` | This file. |

## 3. Files Modified

| Path | What changed |
|---|---|
| `manifest.json` | Drop `activeTab` and the empty `content_scripts` entry. Add `alarms` permission and an explicit `host_permissions: ["https://api.aladhan.com/*"]`. Service worker now declares `"type": "module"`. Version bumped to `1.1.0`. |
| `background.js` | Was empty. Now hosts `scheduleToday()` — fetches timings, clears alarms, and creates one `prayer:{Name}` alarm per upcoming prayer plus one `pre:{Name}:{minutes}` alarm at the configured offset. Listens for `chrome.alarms.onAlarm` to fire `chrome.notifications`, for `chrome.storage.onChanged` to re-schedule when settings change, and for runtime messages (`test-notification`, `reschedule`). Has a `daily-refresh` alarm at 00:05 to roll forward each day. |
| `popup/popup.html` | Stripped Bootstrap CDN tags. New semantic structure (`<header>`, `<main>`, `<footer>`) + a settings link. Uses `<script type="module">`. |
| `popup/popup.js` | Reads city/country/method from `getSettings()`; uses cached `fetchTimings()`; simpler render loop using `MAIN_PRAYERS` (drops Imsak/Sunset/Midnight clutter). Past prayers get a `.past` class. Settings link calls `chrome.runtime.openOptionsPage()`. No more `setTimeout` notification scheduling — that's now the service worker's job. |
| `popup/popup.css` | Rewritten without Bootstrap. CSS custom properties (`--bg`, `--accent`, etc.) for future theming. Tabular numerals on the time column. |
| `options/options.html` | Was empty. Real settings form: city, country, calculation method (15 Aladhan methods), notifications toggle, pre-prayer minutes, and a **Send test notification** button. |
| `options/options.js` | Was empty. Loads current settings, debounced auto-save on every input event, fires test-notification message on demand. |
| `options/options.css` | Was empty. Card-based layout matching the popup's design tokens. |

## 4. Files Removed

- `popup/styles.css` (empty duplicate of `popup.css`)
- `content/content.js` (empty; the manifest no longer references it)
- `content/content.css` (empty; the manifest no longer references it)

The `content/` directory still exists but is empty — left in place because no manifest entries reference it.

---

## 5. New Architecture (after Phase 0)

```
Islamic-api/
├── manifest.json            # MV3, module SW, alarms + notifications + storage
├── background.js            # Service worker — alarms + notifications + reschedule listener
├── popup/
│   ├── popup.html
│   ├── popup.js             # ES module — imports from ../scripts
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js           # ES module
│   └── options.css
├── scripts/
│   ├── api.js               # Aladhan wrapper (cached)
│   ├── cache.js             # TTL cache via storage.local
│   ├── settings.js          # storage.sync with defaults
│   └── utility.js           # date / prayer-name helpers
├── images/  icon-16.png  icon-48.png  icon-128.png
└── docs/PHASE_0.md
```

### Data flow

```
   ┌──────────────┐  storage.sync   ┌──────────────────┐
   │ options page │ ──────────────► │ chrome.storage   │
   └──────────────┘                 └────────┬─────────┘
                                             │ onChanged
                                             ▼
   ┌──────────────┐  alarms       ┌────────────────────┐
   │ chrome.alarms│ ◄───clearAll─ │ background.js      │
   │              │ ───onAlarm──► │ scheduleToday()    │
   └──────────────┘               └─────────┬──────────┘
                                            │ fetchTimings (cached)
                                            ▼
                                  ┌──────────────────┐
                                  │ Aladhan API      │
                                  └──────────────────┘
                                            ▲
                                            │ same fetchTimings()
                                  ┌─────────┴────────┐
                                  │ popup.js         │
                                  └──────────────────┘
```

The popup and the service worker share the same cached `fetchTimings()`, so opening the popup doesn't trigger a network call if the SW already populated the cache that day, and vice-versa.

---

## 6. Settings Schema (`chrome.storage.sync["settings"]`)

```jsonc
{
  "location": {
    "city":    "Cairo",
    "country": "Egypt",
    "method":  5            // Aladhan calculation method id (0–15, no 6)
  },
  "notifications": {
    "enabled":    true,
    "preMinutes": 5         // 0–60
  }
}
```

Defaults live in `scripts/settings.js`. `getSettings()` deep-merges saved values onto the defaults so adding a new setting in a future phase doesn't break existing users.

---

## 7. Alarm Names

| Alarm name | When | What it does |
|---|---|---|
| `prayer:Fajr` (etc.) | Exactly at the prayer time | Fires "Prayer time: Fajr" notification |
| `pre:Fajr:5` (etc.) | `preMinutes` before the prayer | Fires "Upcoming prayer: Fajr — 5 minutes" notification |
| `daily-refresh` | 00:05 local + every 24 h | Re-runs `scheduleToday()` for the new day |

You can inspect the live alarms in DevTools (service worker console):
```js
chrome.alarms.getAll(console.log)
```

---

## 8. How to Test Phase 0

1. **Load unpacked**: `chrome://extensions` → Developer mode → Load unpacked → pick `Islamic-api/`.
2. **Popup**: Click the toolbar icon — you should see the city header (e.g. *Cairo, Egypt*), the 5 main prayers, and past prayers muted gray. Repeat opens are instant (cache hit).
3. **Options page**: Click *Settings* in the popup footer (or right-click the icon → *Options*).
4. **Change city**: e.g. *Istanbul / Turkey*, calculation method *Diyanet İşleri Başkanlığı*. The next time you open the popup the new times appear.
5. **Test notifications**: in Settings, click **Send test notification** — a desktop notification should appear immediately.
6. **Real reminder**: set pre-prayer minutes to `30`, save. The next prayer ≥30 min away will fire a notification at the offset, *even after closing the popup and the browser sitting idle*.
7. **Inspect alarms** (sanity check): `chrome://extensions` → click the *service worker* link → DevTools console:
   ```js
   chrome.alarms.getAll().then(console.log)
   ```
   You should see entries like `prayer:Maghrib`, `pre:Maghrib:30`, plus `daily-refresh`.

---

## 9. Definition of Done

- [x] Notifications fire reliably after the popup closes.
- [x] Notifications fire after Chrome has been idle.
- [x] Switching city/country/method in options updates timings on next popup open without code edits.
- [x] Repeat popup opens within the same day make zero network calls.
- [x] No remote CDN dependencies in the popup.
- [x] All cross-cutting helpers live in `scripts/` and are imported as ES modules.
- [x] `chrome.alarms.getAll()` shows one alarm per upcoming prayer + one per pre-prayer reminder + the daily-refresh.

---

## 10. Known Limitations (deferred to later phases)

| Limitation | Resolved in |
|---|---|
| No Hijri date or weekday display in the popup. | Phase 1 |
| No "next prayer" highlight or countdown. | Phase 1 |
| No toolbar badge with minutes-until-next-prayer. | Phase 1 |
| No Qibla compass. | Phase 1 |
| No Qur'an reading / audio / tafsir. | Phase 2 + 3 |
| No Hadith / Azkar / Radio tabs. | Phases 4 / 5 / 6 |
| English UI only. | Phase 7 |
| Dark theme not auto-detected. | Phase 7 |

---

## 11. Refinements (within Phase 0 scope)

> Settings-page polish shipped on top of the initial Phase 0 cut.

### 11.1 Country / City as cascading dropdowns
- Free-text `<input>` for City + Country replaced with paired `<select>` elements.
- Country list and city sub-lists live in `scripts/locations.js` (~47 countries, ~250 cities) — alphabetised, focused on Muslim-majority countries plus Western countries with notable Muslim populations.
- Selecting a country rebuilds the city dropdown; if the previously-saved city exists in the new country's list it stays selected, otherwise the first city is picked.
- **Trade-off** (chosen: strict): if a user's city isn't in the curated list, they can't pick it. Flexibility option ("Other (type custom)…") was deliberately deferred — bring it back via a tweak if real users hit the wall.

### 11.2 Default calculation method: 5 instead of 8
- `DEFAULT_SETTINGS.location.method` changed from `8` (Gulf Region) to `5` (**Egyptian General Authority of Survey**) in `scripts/settings.js`.
- Better fit for the Cairo seed location.
- Existing users who already saved settings keep their stored method (deep-merge in `getSettings()` only fills *missing* keys).

### 11.3 Explicit Save button
- Removed the debounced auto-save from `options.js`.
- New `<button id="save-btn">` in a sticky `.actions` row at the bottom of the page.
- The button is **disabled until the form is dirty** (compared against a `pristine` snapshot taken on load and after each save).
- Status text shows `"Unsaved changes"` while dirty and `"Saved ✓"` for 1.5 s after a successful save.
- Eliminates noisy `storage.onChanged` → `scheduleToday()` thrash while a user is mid-edit (each storage write previously cleared and re-built every alarm).

### Files touched in §11
- **Added:** `scripts/locations.js`
- **Modified:** `scripts/settings.js` (default method), `options/options.html` (selects + button + sticky actions row), `options/options.js` (cascading + dirty state + explicit save), `options/options.css` (`.btn-primary`, `.btn-secondary`, `.actions`, `.status.muted`/`.success`)
