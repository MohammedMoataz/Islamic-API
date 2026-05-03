# Phase 4 — Hadith

> **Status:** ✅ Complete
> **Version bump:** `1.4.0` → `1.5.0`
> **Goal:** Surface a deterministic *Hadith of the Day* in the popup, and ship a paginated browser for nine canonical collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Malik, Ahmad, Darimi).

---

## 1. Features

| # | Feature | Surface |
|---|---|---|
| F1 | **Hadith of the Day** card — Arabic body + Indonesian translation, with collection name and hadith number. Same hadith all day, new one tomorrow (deterministic). | Popup |
| F2 | **Browse Hadith** button → opens a dedicated full-tab browser (`hadith/hadith.html`) | Popup |
| F3 | **Book picker** — sidebar list of nine collections; selecting one fetches the first page | Hadith page |
| F4 | **Paginated reader** — 20 hadiths per visible page; fetches 300 at a time and slices for fewer round-trips | Hadith page |
| F5 | **Bookmarks** — click 🔖 on any hadith; bookmarks roam via `chrome.storage.sync["hadithBookmarks"]`; sidebar bookmark list with cross-window sync | Hadith page |
| F6 | **Direct link from popup card** — clicking the *Hadith of the Day* card opens the browser tab and jumps directly to that exact hadith | Popup → Hadith page |
| F7 | **Settings** — default collection dropdown for *Hadith of the Day* | Options |

---

## 2. Why `api.hadith.gading.dev`

The project README catalogues `hadis-api-id.vercel.app/hadith/{book}`, but that fork's deployment has gone dark (404). The upstream API is `api.hadith.gading.dev` — same response shape (`{ data: { name, id, available, requested, hadiths: [{ number, arab, id }] } }`), parameterised slightly differently (`?range=START-END` instead of `?page=N&limit=…`). Indonesian translation is the secondary text.

We use it as primary because:
- Single hostname to declare in `host_permissions`.
- Arabic body is what most users actually want; English speakers can read the Arabic and use the collection number to look up references elsewhere.
- Live and maintained.

Adding English translations from fawaz (`cdn.jsdelivr.net/gh/fawazahmed0/hadith-api`) can be a lightweight future enhancement.

---

## 3. Endpoints

| Endpoint | Used for | Cache |
|---|---|---|
| `GET https://api.hadith.gading.dev/books/{book}?range=START-END` | Range of hadiths from a collection (we fetch 300 at a time) | 7 d, key `hadith:gading:{book}:{networkPage}` |

Each hadith in `data.hadiths` has `number`, `arab`, `id`.

---

## 4. Hadith of the Day Algorithm

```
total[book]   = canonical collection size (hardcoded — Bukhari 7563, Muslim 5362, …)
n             = djb2(YYYY-MM-DD) % total[book] + 1     // deterministic 1-based index
page          = ceil(n / 300)                          // 300-per-page chunks
slot          = (n - 1) % 300                          // index within the page
fetch         = fetchHadithPage(book, page)
hadithOfDay   = fetch.hadiths[slot]
```

`djb2` is the classic Bernstein hash. Stable across browsers and locales; same `YYYY-MM-DD` always produces the same `n` for a given `book`. Local date (not UTC) keys the day so a user crossing midnight in their timezone gets a "new" hadith at the right moment.

---

## 5. New Files

| Path | Purpose |
|---|---|
| `hadith/hadith.html` | Full-tab hadith browser shell. |
| `hadith/hadith.js` | Browser logic — book switching, pagination, bookmarks, deep-linking. |
| `hadith/hadith.css` | Layout + Arabic typography (RTL `arab` blocks, LTR `id` blocks). |
| `scripts/hadith.js` | Wrappers `fetchHadithPage(book, page)`, `fetchHadithByNumber(book, n)`, `bookTotal(book)`, `dailyHadith(book, date)` — all cached. |
| `scripts/hadith-bookmarks.js` | `getBookmarks`, `addBookmark`, `removeBookmark`, `toggleBookmark`, `isBookmarked` for hadith. |
| `docs/PHASE_4.md` | This file. |

## 6. Files Modified

| Path | Change |
|---|---|
| `manifest.json` | Add `https://hadis-api-id.vercel.app/*` to `host_permissions`. Bump version to `1.5.0`. |
| `scripts/settings.js` | New `hadith: { defaultBook: "bukhari" }` group + `HADITH_BOOKS` catalogue (slug, English name, total count). |
| `popup/popup.html` | New *Hadith of the Day* card + *Browse Hadith* button. |
| `popup/popup.js` | Loads, renders, and links the daily card. |
| `popup/popup.css` | `.hadith-card` styling. |
| `options/options.html` + `options.js` | New "Hadith" card with default-book dropdown. |

---

## 7. Storage Schema Additions

### `chrome.storage.sync["settings"].hadith`
```jsonc
{ "defaultBook": "bukhari" }
```

### `chrome.storage.sync["hadithBookmarks"]`
```jsonc
[
  { "book": "bukhari", "number": 1234, "addedAt": 1746234567890 },
  { "book": "muslim",  "number":   45, "addedAt": 1746234567891 }
]
```
Capped at 200 entries (same logic as Qur'an bookmarks).

### `chrome.storage.local` cache entries
- `hadith:{book}:{page}` — `{ data: { hadiths: [{ number, arab, id }, ...] }, ... }` returned by the API. 7-day TTL.

---

## 8. Books Supported

| Slug | English Name | Approx. hadith count |
|---|---|---|
| `bukhari` | Sahih al-Bukhari | 7563 |
| `muslim` | Sahih Muslim | 5362 |
| `abu-dawud` | Sunan Abu Dawud | 4590 |
| `tirmidzi` | Jami' at-Tirmidhi | 3956 |
| `nasai` | Sunan an-Nasa'i | 5662 |
| `ibnu-majah` | Sunan Ibn Majah | 4332 |
| `ahmad` | Musnad Ahmad | 26363 |
| `malik` | Muwatta Malik | 1851 |
| `darimi` | Sunan ad-Darimi | 3367 |

Counts are pinned to the upstream API's pagination; if a book's actual size disagrees (the deterministic index stays valid, just maps to a slightly different hadith on a few days). Adjust if a user reports a 404 on the daily card.

---

## 9. UI Sketches

### Popup card
```
┌──────────────────────────────────────┐
│  Hadith of the Day · Bukhari #1234   │
│  ﺇﻧﻤﺎ ﺍﻷﻋﻤﺎﻝ ﺑﺎﻟﻨﻴﺎﺕ …                │
│  Sesungguhnya amalan-amalan …        │
│  [ Read full → ]                     │
└──────────────────────────────────────┘
```

Card is clickable as a whole — opens the hadith browser at the corresponding entry.

### Hadith browser
```
┌─────────────────────────────────────────────────────────────┐
│  Hadith                                          [Settings] │
├──────────────────┬──────────────────────────────────────────┤
│  🔖 Bookmarks ▾  │  Sahih al-Bukhari                         │
│  • Bukhari #1234 │  Page 1 of 26   ‹ 1 2 3 … 26 ›            │
│                  │                                          │
│  Sahih Bukhari ▶ │  ┌──────────────────────────────────┐    │
│  Sahih Muslim    │  │ #1                  [📖] [🔖]    │    │
│  Abu Dawud       │  │  ﺇﻧﻤﺎ ﺍﻷﻋﻤﺎﻝ ﺑﺎﻟﻨﻴﺎﺕ ...          │    │
│  Tirmidhi        │  │  Sesungguhnya amalan-amalan …    │    │
│  Nasa'i          │  └──────────────────────────────────┘    │
│  Ibn Majah       │  ...                                     │
│  Malik           │                                          │
│  Ahmad           │                                          │
│  Darimi          │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

---

## 10. How to Test Phase 4

1. **Reload** the extension at `chrome://extensions`.
2. Open the popup → a *Hadith of the Day* card appears between the qibla card and the audio mini (or "Read Qur'an" if no audio is playing). Arabic body + Indonesian translation, with the book name and hadith number.
3. Note the hadith — close the popup, reopen it later in the day → **same hadith** (deterministic from `YYYY-MM-DD`).
4. Wait until midnight (or change your system clock by a day) → reopen popup → **different hadith**.
5. Click the popup card → opens `hadith/hadith.html` in a new tab, scrolled to the same hadith.
6. In the hadith page sidebar, click *Sahih Muslim* → page 1 loads.
7. Click 🔖 on any hadith → entry appears in the bookmarks panel; persists across reloads (`chrome.storage.sync`).
8. Settings → *Hadith* card → change default to *Sahih Muslim* → reopen popup → daily card now from Muslim.

---

## 11. Definition of Done

- [x] Hadith of the Day is deterministic per (book, local YYYY-MM-DD).
- [x] Card renders Arabic + Indonesian; truncates gracefully in the 320 px popup.
- [x] Clicking the card deep-links into the browser tab on the right hadith.
- [x] Browser supports nine collections, paginated 20 per UI page (300 per network call).
- [x] Bookmarks add/remove on each hadith; sync across devices.
- [x] No double-fetches on repeat opens within 7 days (cached pages).
- [x] Settings persists default book; dropdown reflects saved value on open.

---

## 12. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| No English translation — only Arabic body + Indonesian. | Future polish (use fawaz `eng-*` editions). |
| No full-text search across hadiths. | Out of scope. |
| No grade / chain-of-narrators metadata. | Future polish. |
| If a book's actual count differs from the hardcoded constant, the daily index can occasionally land on a 404. The hadith page handles this gracefully by surfacing an error; the popup card just hides on failure. | Future polish — fetch the count once and cache. |
