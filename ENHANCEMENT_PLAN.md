# Islamic Companion — Extension Enhancement Plan

> A comprehensive roadmap to evolve the current **Prayer Times Table** Chrome extension into a full **Islamic Companion** (مرافقك الإسلامي): prayer times, Qur'an reading & audio, Tafsir, Hadith, Azkar (morning/evening + post-prayer), and Qur'an radio — all consolidated using the endpoints documented in `Islamic-API/README.md`.

---

## 1. Current State Audit

### 1.1 What works today
| Area | File | Status |
|---|---|---|
| Manifest (MV3) | `manifest.json` | Defined: `storage`, `activeTab`, `notifications`; popup, options page, content scripts and a background service worker are *registered* but most targets are empty. |
| Popup UI | `popup/popup.html`, `popup/popup.css` | Bootstrap 5 table, 2 columns (Prayer / Time). |
| Popup logic | `popup/popup.js` | Fetches Aladhan timings for **Cairo, Egypt, method=8** for *today*; highlights past prayers; schedules `setTimeout` notifications 5 min before each prayer. |

### 1.2 Gaps & bugs to fix during the rewrite
1. **`background.js` is empty** but registered as a service worker → MV3 will spin it up and immediately idle. Needed for persistent alarms, caching, badge updates.
2. **Notifications never fire reliably**:
   - `Notification.requestPermission()` call is commented out.
   - `setTimeout` inside the popup dies the moment the popup closes (popups are not persistent in MV3). The correct primitive is `chrome.alarms` + `chrome.notifications` from the service worker.
3. **Hard-coded Cairo / Egypt / method 8** — no options page wiring even though `options_page` is declared. The empty `options/*` files should host city/country/calculation-method/reciter settings.
4. **Date math bug** in highlight logic: comparing only `hour` then `minute` as integers means 09:30 vs 10:05 (currentH=10, timeH=9 → diff>0 → highlighted as past) is OK, but 09:30 vs 09:45 (diff=0 then 30-45=-15 → not highlighted as past) is fine *but* the current/next-prayer relationship is never computed — there is no "next prayer" indicator, only past/not-past.
5. **No caching**: every popup open issues a network call. Aladhan timings for a given city/day are stable — cache by `(city,country,method,YYYY-MM-DD)` in `chrome.storage.local`.
6. **No content script use** even though `content/content.js` is registered on `<all_urls>` (empty file = wasted manifest entry & a minor perf cost on every page load).
7. **Two CSS files in `popup/`** (`popup.css` + empty `styles.css`) and an empty `styles/style.css` and `scripts/utility.js` — dead structure to consolidate.
8. **No localization (i18n)** despite the project being fundamentally bilingual (Arabic/English).
9. **No icons referenced correctly** in notifications: `icon: "icon-48.png"` is a relative path that won't resolve from the popup's directory; should be `images/icon-48.png` resolved via `chrome.runtime.getURL`.

### 1.3 Endpoints available (from `Islamic-API/README.md`)
| # | Resource | Endpoint | Notes |
|---|---|---|---|
| 1 | Prayer times | `https://api.aladhan.com/v1/timingsByCity/{DD-MM-YYYY}?city=&country=&method=` | Already used. Supports many `method` values. |
| 2 | Qur'an text (by surah) | `https://api.alquran.cloud/v1/surah/{1..114}` | Use HTTPS, not HTTP. |
| 3 | Qur'an chapter audio | `https://api.quran.com/api/v4/chapter_recitations/{reciter_id}` | Per-reciter MP3s, one per surah. |
| 4 | Tafsir | `https://quranenc.com/api/v1/translation/sura/arabic_moyassar/{1..114}` | Other slugs available (e.g. `english_saheeh`). |
| 5 | Hadith — collection by book | `https://hadis-api-id.vercel.app/hadith/{book}?page=&limit=` | Books: `abu-dawud`, `bukhari`, `muslim`, `tirmidzi`, `nasai`, `ibnu-majah`, `ahmad`, `darimi`, `malik`. Indonesian metadata, Arabic body. |
| 6 | Hadith — multilingual editions index | `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions.json` | Index of editions; each has its own URL. |
| 7 | Azkar (Nawaf al-Qari) | Github raw `azkar.json` | Single JSON: morning, evening, after-prayer, sleep, etc. |
| 8 | Azkar — Hisn al-Muslim | `https://www.hisnmuslim.com/api/ar/{id}.json` | Browse-able by chapter id. |
| 9 | Qur'an radio (18 reciters) | `https://data-rosy.vercel.app/radio.json` | Live streaming URLs. |

---

## 2. Target Feature Set

| # | Feature | Maps to endpoint(s) | Surface |
|---|---|---|---|
| F1 | Prayer times for *user-chosen* city + calculation method | (1) | Popup tab |
| F2 | Next-prayer countdown + badge text on toolbar icon | (1) + alarms | Toolbar badge + popup |
| F3 | Reliable adhan/iqamah notifications (offset configurable: 0/5/10/15 min) | (1) + `chrome.alarms` + `chrome.notifications` | Service worker |
| F4 | Hijri date display | (1) — Aladhan response includes `data.date.hijri` | Popup header |
| F5 | Qibla direction | (1) — Aladhan `/qibla/{lat}/{lng}` | Popup widget |
| F6 | Qur'an reader (text, by surah; per-ayah view; bookmarks; last-read) | (2) | Popup tab / dedicated page |
| F7 | Qur'an audio (per-surah, per-reciter; play/pause/seek; persistent across popup close via offscreen audio) | (3) | Popup tab + offscreen document |
| F8 | Tafsir alongside ayah | (4) | Inside reader |
| F9 | Hadith of the day (rotating, deterministic by date) + browse by book | (5) (primary) + (6) (alt translations) | Popup tab |
| F10 | Azkar — morning, evening, after-salah, sleep, waking, mosque entry/exit, etc. with tap-to-count tasbih | (7) primary, (8) fallback/extra | Popup tab |
| F11 | Qur'an radio (18 reciters / live stations) | (9) | Popup tab + offscreen audio |
| F12 | Options page: city/country/method/madhab, reciter, language (ar/en), notification offset, theme, enabled features | — | `options/*` |
| F13 | Bilingual UI (Arabic RTL + English LTR) via `chrome.i18n` | — | All UI |

---

## 3. Proposed Architecture

```
Scheduler/
├── manifest.json
├── background.js                # Service worker: alarms, notifications, badge, offscreen lifecycle
├── offscreen/
│   ├── offscreen.html           # Hosts <audio> for radio + recitation (survives popup close)
│   └── offscreen.js
├── popup/
│   ├── popup.html               # Tabbed shell (Prayer / Quran / Hadith / Azkar / Radio)
│   ├── popup.js                 # Tab router + view bootstrap
│   ├── popup.css
│   └── views/
│       ├── prayer.js
│       ├── quran.js
│       ├── hadith.js
│       ├── azkar.js
│       └── radio.js
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── scripts/
│   ├── api.js                   # Thin fetch wrappers for every endpoint
│   ├── cache.js                 # chrome.storage.local TTL cache
│   ├── settings.js              # get/set with defaults; storage.onChanged broadcaster
│   ├── prayer-time.js           # next-prayer math, hijri formatting, qibla helpers
│   ├── i18n.js                  # ar/en string lookup
│   └── utility.js               # date helpers, DOM helpers
├── content/                     # REMOVE the registration if no use case is added
├── _locales/
│   ├── ar/messages.json
│   └── en/messages.json
├── images/
│   ├── icon-16.png  icon-48.png  icon-128.png
│   └── icon-prayer.png  icon-quran.png  icon-hadith.png  icon-azkar.png  icon-radio.png
└── styles/
    └── style.css                # Shared tokens (colors, spacing, RTL helpers)
```

### 3.1 Background service worker responsibilities
- On install / on alarm `daily-refresh` (00:05 local): pre-fetch today's timings; schedule a `chrome.alarms` per prayer (and pre-prayer offset).
- Listen for `chrome.alarms.onAlarm`:
  - For `prayer:{name}` → fire `chrome.notifications.create`.
  - For `pre-prayer:{name}` → fire reminder.
  - For `next-prayer-tick` (every minute) → recompute remaining minutes and update `chrome.action.setBadgeText`.
- Maintain an **offscreen document** (`chrome.offscreen.createDocument`) when audio playback is requested (Qur'an recitation or radio); tear it down when paused.

### 3.2 Offscreen document
MV3 popups close on blur and can't keep an `<audio>` element alive. The offscreen API (`reasons: ['AUDIO_PLAYBACK']`) hosts the player; popup talks to it via `chrome.runtime.sendMessage`.

### 3.3 Caching policy
| Data | Key | TTL |
|---|---|---|
| Timings | `timings:{city}:{country}:{method}:{YYYY-MM-DD}` | 24 h |
| Surah text | `surah:{n}` | 30 days |
| Tafsir | `tafsir:{slug}:{n}` | 30 days |
| Reciter chapters | `reciter:{id}` | 7 days |
| Hadith books | `hadith:{book}:{page}:{limit}` | 7 days |
| Azkar | `azkar:nawaf` / `azkar:hisn:{id}` | 30 days |
| Radio | `radio:list` | 24 h |

Stale-while-revalidate: serve from cache immediately, refresh in background if older than half-TTL.

---

## 4. Manifest Changes

```jsonc
{
  "manifest_version": 3,
  "name": "__MSG_extension_name__",
  "default_locale": "ar",
  "description": "__MSG_extension_description__",
  "version": "2.0.0",
  "icons": { "16": "images/icon-16.png", "48": "images/icon-48.png", "128": "images/icon-128.png" },
  "permissions": ["storage", "notifications", "alarms", "offscreen"],
  "host_permissions": [
    "https://api.aladhan.com/*",
    "https://api.alquran.cloud/*",
    "https://api.quran.com/*",
    "https://quranenc.com/*",
    "https://hadis-api-id.vercel.app/*",
    "https://cdn.jsdelivr.net/*",
    "https://raw.githubusercontent.com/*",
    "https://www.hisnmuslim.com/*",
    "https://data-rosy.vercel.app/*"
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": "images/icon-48.png"
  },
  "options_page": "options/options.html"
  // content_scripts: REMOVE — there is no DOM-injection use case yet.
}
```
**Notable changes:** drop `activeTab` (unused), drop `content_scripts` (empty), add `alarms` and `offscreen`, declare explicit `host_permissions` so MV3 doesn't gate every fetch through CORS surprises, set `default_locale`.

---

## 5. Settings Schema (`chrome.storage.sync`)

```js
{
  location: { city: "Cairo", country: "Egypt", method: 8, madhab: 0 },
  notifications: { enabled: true, preMinutes: 5, athanSound: false },
  language: "ar",                 // "ar" | "en"
  theme: "auto",                  // "auto" | "light" | "dark"
  reciter: { id: 7, name: "Mishary Alafasy" },
  tafsir: "arabic_moyassar",
  hadith: { defaultBook: "bukhari", language: "ar" },
  features: { prayer: true, quran: true, hadith: true, azkar: true, radio: true }
}
```
Use `chrome.storage.sync` for user prefs (cross-device); `chrome.storage.local` for caches.

---

## 6. Feature Designs

### F1–F4 — Prayer module
- **API call:** `GET https://api.aladhan.com/v1/timingsByCity/{DD-MM-YYYY}?city={city}&country={country}&method={method}&school={madhab}`
- **Display:** Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha (filter the rest unless user toggles "show all"). Show the **next prayer** highlighted (not past prayers — invert current behavior; past prayers go muted).
- **Header strip:** Hijri date from `data.date.hijri.date` (e.g., `25-10-1446`) + weekday in Arabic from `data.date.hijri.weekday.ar`.
- **Badge:** every minute, write `Hh Mm` until next prayer (capped at 4 chars: `2h45`, `45m`).

### F5 — Qibla widget
- **API:** `GET https://api.aladhan.com/v1/qibla/{lat}/{lng}` (use `data.latitude/longitude` from the timings response, no extra geolocation prompt).
- A simple compass SVG rotated by `data.direction` degrees. Optional: live device-orientation rotation when the popup is opened on a mobile-emulated browser (best-effort; skip on desktop).

### F6–F8 — Qur'an reader
- **Layout:** sidebar list of 114 surahs (cached forever) → main pane shows selected surah's ayat.
- **Per-ayah row** has: Arabic text, ayah number, ▶ play (queues up the chapter MP3 from F7 and seeks if word-by-word is unavailable), 📖 tafsir (expandable from F4).
- **Bookmarks:** `chrome.storage.sync` → `bookmarks: [{ surah, ayah, note }]`.
- **Last-read:** auto-saved scroll position per surah → "Resume from 2:255" banner on next open.
- **Endpoint mapping:**
  - `https://api.alquran.cloud/v1/surah/{n}` → Arabic text (`data.ayahs[].text`).
  - `https://quranenc.com/api/v1/translation/sura/{slug}/{n}` → Tafsir (`result[].translation`).
  - `https://api.quran.com/api/v4/chapter_recitations/{reciter}` → MP3 per chapter (`audio_files[].audio_url`).

### F9 — Hadith
- **Hadith of the day:** deterministic pick — `index = djb2(YYYY-MM-DD) % 7000` (Bukhari has ~7563); fetch by book + page calculation: `page = ceil(index / limit)` with `limit=300`, then `array[index % limit]`.
- **Browse mode:** dropdown of books (Bukhari, Muslim, Abu Dawud, Tirmidzi, Nasai, Ibn Majah, Ahmad, Darimi, Malik) → paginated list (10 per page in UI, fetched 300 at a time and sliced).
- **Endpoint:** `https://hadis-api-id.vercel.app/hadith/{book}?page={p}&limit=300`. Each item has `{ number, arab, id }` — `arab` is Arabic text, `id` is Indonesian translation. Optionally use API 6 for English editions: pick `eng-bukhari`, fetch its `link` from `editions.json`, then individual hadith JSONs.

### F10 — Azkar
- **Source A (primary):** `https://raw.githubusercontent.com/nawafalqari/azkar-api/.../azkar.json` — categories: `أذكار الصباح`, `أذكار المساء`, `أذكار بعد السلام`, `أذكار النوم`, …
- **UI:** category list → cards with `{ category, count, description, reference, zekr }`. **Tap-to-count tasbih:** big Arabic dhikr text + a counter button styled as a worry-bead; pressing decrements remaining count; auto-advance to next dhikr at zero.
- **Source B (Hisn al-Muslim) as enrichment:** for users who want extended supplications, expose a "more" link that fetches `https://www.hisnmuslim.com/api/ar/{id}.json` for the matching chapter.

### F11 — Qur'an radio
- **Endpoint:** `https://data-rosy.vercel.app/radio.json` → list of `{ name, url }`.
- **UI:** searchable list, ▶ button posts a message to the offscreen document: `{ type: 'radio:play', url }`.
- Only one audio source plays at a time; selecting another auto-stops the previous.
- Persist `lastPlayed` station and offer "resume" on popup open.

### F12 — Options page
Sections (each saves on change, no submit button):
1. **Location** — text inputs for city/country, dropdown for calculation method (the 15 Aladhan methods, with method 8 = "Egyptian General Authority of Survey" preselected for backwards compat), madhab Hanafi/Shafi'i radio.
2. **Notifications** — master toggle, pre-prayer offset slider (0–30 min, step 5), athan sound toggle (uses a bundled MP3 in `images/`).
3. **Reciter** — dropdown populated from `chapter_recitations` reciter list.
4. **Tafsir** — dropdown of slugs (`arabic_moyassar`, `english_saheeh`, `urdu_junagarhi`, …).
5. **Language** — `ar` / `en` radio. Updates `<html dir>` accordingly.
6. **Theme** — auto / light / dark.
7. **Features** — checkboxes to hide tabs the user doesn't want.

### F13 — i18n
- All UI strings via `chrome.i18n.getMessage("key")`.
- `_locales/ar/messages.json` is the default; `_locales/en/messages.json` mirrors.
- `<html dir>` toggled in JS based on `language` setting (overrides Chrome UI locale).

---

## 7. Notification Reliability Fix (concrete)

Replace the popup-side `setTimeout` with this in `background.js`:

```js
// On install + every day at 00:05 local
chrome.runtime.onInstalled.addListener(scheduleToday);
chrome.alarms.create('daily-refresh', { when: nextLocalMidnightPlus5Min(), periodInMinutes: 24 * 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-refresh') return scheduleToday();
  if (alarm.name.startsWith('prayer:')) return notify(alarm.name.slice(7), 'now');
  if (alarm.name.startsWith('pre:'))    return notify(alarm.name.slice(4), 'soon');
  if (alarm.name === 'badge-tick')      return updateBadge();
});

async function scheduleToday() {
  const { location, notifications } = await getSettings();
  const timings = await fetchTimings(location);                  // cached
  await chrome.alarms.clearAll();
  for (const [name, hhmm] of Object.entries(timings)) {
    const at = todayAt(hhmm);
    if (at > Date.now())                  chrome.alarms.create(`prayer:${name}`, { when: at });
    if (notifications.preMinutes > 0)     chrome.alarms.create(`pre:${name}`,    { when: at - notifications.preMinutes * 60_000 });
  }
  chrome.alarms.create('badge-tick', { periodInMinutes: 1 });
  chrome.alarms.create('daily-refresh', { when: nextLocalMidnightPlus5Min(), periodInMinutes: 24 * 60 });
}
```

Permission request happens **once** in the options page on first save, not on every popup open.

---

## 8. UI/UX Notes

- **Popup width** ~360–400 px (Chrome popup max ≈ 800×600). Use vertical tabs at top, content below.
- **RTL by default** when language is Arabic — flip Bootstrap with `dir="rtl"` on `<html>`; for icon-only buttons add `transform: scaleX(-1)` to forward/back affordances.
- **Theming** via CSS custom properties in `styles/style.css`:
  ```css
  :root { --bg: #fff; --fg: #111; --accent: #1a7f5a; }
  [data-theme="dark"] { --bg: #111; --fg: #eee; --accent: #4caf81; }
  ```
- **Bootstrap is overkill** for a popup — consider dropping it and writing ~150 lines of CSS. Saves ~250 KB and one CDN dependency. (Trade-off: slower initial styling work.)

---

## 9. Implementation Phases

| Phase | Scope | Definition of done |
|---|---|---|
| **P0 — Stabilize** | Move scheduling to `background.js` with `chrome.alarms`; request notification permission on install; fix icon paths; add cache layer; wire `options.html` to set city/country/method. | Notifications fire after popup closes; switching city in options updates timings without code edits. |
| **P1 — Polish prayer tab** | Hijri date, next-prayer highlight, badge countdown, qibla widget. | Toolbar badge shows live countdown; qibla compass renders. |
| **P2 — Qur'an reader** | Surah list + reader + bookmarks + last-read; tafsir popovers. | Can read surah 1–114 offline after first visit. |
| **P3 — Audio (offscreen)** | Per-surah recitation playback that survives popup close; reciter selector. | Audio keeps playing for 60 s after popup closes. |
| **P4 — Hadith tab** | Hadith of the day + browse by book with pagination. | Same hadith of the day across opens within one day. |
| **P5 — Azkar tab** | Categories + tap-to-count tasbih; persistent counts within a session. | Counter resets at midnight or on manual reset. |
| **P6 — Radio tab** | Station list + play/stop via offscreen. | Single playback source enforced. |
| **P7 — i18n + theming** | `_locales`, theme toggle, all strings translated. | Switching language in options instantly relabels every visible string. |
| **P8 — Hardening** | Network error states, retry/back-off, telemetry-free, accessibility (focus rings, aria). | Lighthouse a11y ≥ 95 on popup. |

---

## 10. Risks & Open Questions

1. **CORS / mixed content:** `api.alquran.cloud` is documented as `http://` — must use `https://api.alquran.cloud/...`. Verify HTTPS endpoints for all listed APIs before declaring `host_permissions`.
2. **Endpoint stability:** `hadis-api-id.vercel.app`, `data-rosy.vercel.app`, and Github raw URLs are community-hosted; build a small adapter layer in `scripts/api.js` so any single source can be swapped without touching views.
3. **Qur'an audio licensing:** chapter recitations from `api.quran.com` are public, but bundling an athan MP3 requires choosing a license-clean recording (record provenance in `images/sounds/README`).
4. **Method 8 default change:** existing users will keep method 8 via storage migration. New users get the same default to preserve behavior.
5. **Hadith of the day across timezones:** key by user's local YYYY-MM-DD, not UTC, to avoid the same hadith appearing twice when crossing midnight.
6. **Storage budgets:** `chrome.storage.sync` has 100 KB total / 8 KB per item. Keep bookmarks small or move them to `local` if large.

---

## 11. Quick Wins (do these first, in order)

1. **Move notification scheduling to `background.js`** with `chrome.alarms` (kills the popup-closes-and-timer-dies bug). Request permission in `chrome.runtime.onInstalled`.
2. **Wire the empty `options.html`** to edit `{ city, country, method }` in `chrome.storage.sync`. Have `popup.js` read those settings instead of the hard-coded constants.
3. **Add a "next prayer" row** above the table with countdown — high perceived value, ~30 lines of code.
4. **Cache the daily timings response** in `chrome.storage.local` keyed by `(city,country,method,date)` — eliminates the network call on every popup open.
5. **Delete dead files** (`popup/styles.css`, `styles/style.css` if unused, empty `content/*` registration in manifest, empty `scripts/utility.js` if not adopted).

These five take the extension from "fragile demo" to "reliable v1.1" without adding any new tabs.

---

*Reference for endpoints throughout this document: `Islamic-API/README.md`.*
