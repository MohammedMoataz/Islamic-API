# Phase 2 — Qur'an Reader

> **Status:** ✅ Complete
> **Version bump:** `1.2.0` → `1.3.0`
> **Goal:** Read all 114 surahs of the Qur'an with Arabic typography, tafsir alongside each ayah, last-read resume, and per-ayah bookmarks. Works offline after first visit (each surah cached for 30 days).

---

## 1. Why a Dedicated Page (Not a Popup Tab)

The popup is 320 px wide — too cramped for proper Qur'anic typography (right-to-left text with diacritics needs room and a generous line-height). This phase ships:

- A **standalone reader page** (`reader/reader.html`) opened in a full Chrome tab.
- A **"Read Qur'an"** button in the popup that calls `chrome.tabs.create({ url: chrome.runtime.getURL("reader/reader.html") })`.
- The reader auto-resumes at the user's last-read ayah on each open.

Future phases (Hadith, Azkar, Radio) follow the same pattern: small entry point in the popup, full UI in a dedicated page.

---

## 2. Features

| # | Feature | UI surface |
|---|---|---|
| F1 | **Surah picker** — sidebar list of all 114 surahs (number, Arabic name, English transliteration, ayah count) with search filter | Reader sidebar |
| F2 | **Ayah-by-ayah view** — each ayah on its own line, large RTL Arabic text with the ayah end-glyph (۝) | Reader main pane |
| F3 | **Tafsir popover** — click an ayah's 📖 button to expand the Arabic Muyassar tafsir below it; click again to collapse | Reader main pane |
| F4 | **Bookmarks** — click 🔖 on any ayah to add/remove. List of bookmarks shown in a collapsible panel above the surah list. Synced via `chrome.storage.sync` so they roam across devices. | Reader sidebar + ayah row |
| F5 | **Last-read resume** — every scroll/click updates `lastRead = { surah, ayah }`. On next open, reader scrolls directly to that ayah and shows a *"Resume from 2:255"* banner (dismissable). Stored in `chrome.storage.local`. | Reader main pane |
| F6 | **Surah info header** — name (Arabic + English), revelation type (Meccan / Medinan), ayah count, and the basmala (where applicable). | Reader main pane |
| F7 | **Keyboard shortcuts** — `←` / `→` previous / next surah; `b` toggle bookmark on focused ayah; `t` toggle tafsir on focused ayah; `/` focus search | Reader |

---

## 3. Endpoints Used

| API | Used for | Cache |
|---|---|---|
| `https://api.alquran.cloud/v1/surah/{n}` | Arabic text per surah (returns `data.ayahs[].text` + `data.numberOfAyahs`, `data.englishName`, `data.englishNameTranslation`, `data.revelationType`) | 30 days, key `surah:{n}` |
| `https://api.alquran.cloud/v1/meta` | Surah index (114 entries with names + ayah counts) — fetched **once** on first reader open | 365 days, key `surah-list` |
| `https://quranenc.com/api/v1/translation/sura/{slug}/{n}` | Tafsir text — fetched **lazily** when a user expands tafsir on any ayah of a surah, then cached for the whole surah | 30 days, key `tafsir:{slug}:{n}` |

Default tafsir slug: `arabic_moyassar` (Tafsīr al-Muyassar). Configurable in settings.

---

## 4. New Files

| Path | Purpose |
|---|---|
| `reader/reader.html` | Reader shell — sidebar (surah list + bookmarks) and main pane (ayat). |
| `reader/reader.js` | Reader logic — surah list rendering, ayah rendering, tafsir lazy-load, bookmarks, last-read tracking, keyboard shortcuts. |
| `reader/reader.css` | Reader-specific styling — Arabic typography (`Amiri Quran`/`Scheherazade New` web-safe stack), RTL layout, sticky sidebar, ayah card style. |
| `scripts/quran.js` | Wrappers `fetchSurahList()`, `fetchSurah(n)`, `fetchTafsir(slug, n)` — all cached. |
| `scripts/bookmarks.js` | `getBookmarks()`, `addBookmark(s, a)`, `removeBookmark(s, a)`, `isBookmarked(s, a)` — sync storage. |
| `scripts/last-read.js` | `getLastRead()`, `setLastRead(s, a)` — local storage. |
| `docs/PHASE_2.md` | This file. |

## 5. Files Modified

| Path | Change |
|---|---|
| `manifest.json` | Add `https://api.alquran.cloud/*` and `https://quranenc.com/*` to `host_permissions`. Add `tabs` permission (for `chrome.tabs.create`). Bump version to `1.3.0`. |
| `popup/popup.html` | New "Read Qur'an" button below the prayer table. |
| `popup/popup.js` | Click handler for the button → `chrome.tabs.create`. |
| `popup/popup.css` | `.btn-read-quran` styling. |
| `scripts/settings.js` | New `quran` settings group: `{ tafsirSlug: "arabic_moyassar", showTafsirByDefault: false }`. |
| `options/options.html` + `options.js` + `options.css` | New "Qur'an" card with tafsir-edition dropdown and "show tafsir by default" toggle. |

---

## 6. Storage Schema Additions

### `chrome.storage.sync["settings"]`
```jsonc
{
  // ... existing P0/P1 keys ...
  "quran": {
    "tafsirSlug": "arabic_moyassar",   // see https://quranenc.com for the full list
    "showTafsirByDefault": false
  }
}
```

### `chrome.storage.sync["bookmarks"]`
```jsonc
[
  { "surah": 2, "ayah": 255, "addedAt": 1746234567890 },
  { "surah": 36, "ayah": 1, "addedAt": 1746234567891 }
]
```
Capped at 200 entries (chrome.storage.sync per-key limit is 8 KB). At ~30 bytes per entry this is 6 KB — comfortable.

### `chrome.storage.local["lastRead"]`
```jsonc
{ "surah": 2, "ayah": 255, "ts": 1746234567890 }
```

### `chrome.storage.local` cache entries
- `surah-list` — array of 114 `{ number, name, englishName, englishNameTranslation, numberOfAyahs, revelationType }`.
- `surah:{n}` — `{ number, name, englishName, englishNameTranslation, revelationType, numberOfAyahs, ayahs: [{ numberInSurah, text }] }`.
- `tafsir:{slug}:{n}` — array of `{ aya: number, translation: string }` (mapped from `result[]`).

---

## 7. Tafsir Editions Available (sample)

| Slug | Language | Title |
|---|---|---|
| `arabic_moyassar` | Arabic | التفسير الميسر (default) |
| `english_saheeh` | English | Saheeh International |
| `english_hilali_khan` | English | Hilali & Khan |
| `urdu_junagarhi` | Urdu | تفسير جوناگڑھی |
| `french_hameedullah` | French | Muhammad Hamidullah |
| `turkish_diyanet` | Turkish | Diyanet İşleri Vakfı |
| `indonesian_complex` | Indonesian | King Fahd Complex |
| `bengali_zakaria` | Bengali | Abu Bakr Zakaria |

(Editions list comes from `https://quranenc.com/api/v1/translations` — for P2 we hard-code the eight above; full list later.)

---

## 8. Reader Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Qur'an                                          [Settings] │
├──────────────────┬──────────────────────────────────────────┤
│  🔖 Bookmarks ▾ │           ﷽                          │
│  • 2:255         │           سورة البقرة (2)              │
│  • 36:1          │           Al-Baqarah · 286 ayat · Madani │
│                  │                                          │
│  [search…]       │  ◯ Resume from 2:255  [×]                │
│                  │                                          │
│  1. al-Fātiḥah   │  ┌────────────────────────────────────┐  │
│  2. al-Baqarah ▶ │  │ 1 │  بِسْمِ اللَّهِ ...              │  │
│  3. Āl ʿImrān    │  │     [📖 Tafsir]  [🔖]              │  │
│  4. an-Nisāʾ     │  └────────────────────────────────────┘  │
│  ...             │  ...                                     │
│  114. an-Nās     │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

---

## 9. How to Test Phase 2

1. **Reload** the extension at `chrome://extensions`.
2. Click the toolbar icon → **"Read Qur'an"** in the popup → opens a new tab at `chrome-extension://…/reader/reader.html`.
3. **Surah list** loads on the left (≈ 1 network call to `/v1/meta`, then cached). Click `2. Al-Baqarah` → main pane fills with the ayat.
4. **Tafsir** — click 📖 next to ayah 255 → an indented Arabic paragraph appears below it.
5. **Bookmark** — click 🔖 on ayah 255 → bookmark icon fills; entry appears in the *Bookmarks* panel.
6. **Last-read** — close the tab, reopen the reader from the popup → it should jump to 2:255 with a *"Resume from 2:255"* banner.
7. **Search** — type `nas` in the sidebar search box → filters to *Al-Nās*.
8. **Cross-device bookmarks** — sign in to Chrome on a second machine, bookmarks should sync via `chrome.storage.sync`.
9. **Offline** — disable network → reload reader → all visited surahs still load (from `chrome.storage.local` cache); unvisited ones show an error.

---

## 10. Definition of Done

- [x] Reader page renders all 114 surahs with proper Arabic typography (RTL, ayah-end glyph, generous line-height).
- [x] First open of any surah caches the response; subsequent opens are instant and offline-capable.
- [x] Tafsir loads lazily per surah and is cached for 30 days.
- [x] Bookmarks add/remove from the ayah row and the sidebar list, persisting in `chrome.storage.sync`.
- [x] Last-read auto-saves on scroll (debounced) and resumes correctly.
- [x] Reader is reachable from the popup; popup itself stays under 400 px height.
- [x] Search filter narrows the surah list to substring matches in either Arabic or English transliteration.

---

## 11. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| No per-ayah audio playback (would need Phase 3's offscreen document for cross-tab persistence). | Phase 3 |
| No per-word translation. | Out of scope. |
| Tafsir is per-ayah, not per-word. | Out of scope. |
| Search is substring on names only — no full-text search across ayat. | Out of scope. |
| No bookmarks export/import. | Out of scope. |
