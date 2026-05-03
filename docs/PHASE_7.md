# Phase 7 — i18n + Theming

> **Status:** ✅ Complete
> **Version bump:** `1.7.0` → `1.8.0`
> **Goal:** Bilingual UI (Arabic RTL + English LTR) with an in-extension language toggle, plus a light/dark/auto theme. Switching either should re-paint every visible chrome element instantly.

---

## 1. Why a Custom i18n Layer (Not `chrome.i18n`)

`chrome.i18n` follows the **browser** UI language and isn't user-configurable from inside the extension — switching language in our settings would do nothing. We use a small custom catalogue (`scripts/i18n.js`) backed by `chrome.storage.sync["language"]`. Trade-off: we hand-maintain two `STRINGS` objects in JS instead of `_locales/*/messages.json`. For ~80 strings that's fine and keeps the extension a single bundle.

---

## 2. Features

| # | Feature | Surface |
|---|---|---|
| F1 | **Language toggle** in settings (`ar` / `en`); `chrome.storage.sync["language"]` so it roams across devices | Options |
| F2 | **All chrome strings translated** — popup labels, buttons, prayer names, settings sections, reader sidebar, hadith / azkar / radio topbars | Every page |
| F3 | **RTL layout** auto-applied when locale is `ar`: `<html dir="rtl" lang="ar">`. Layouts already used logical CSS where possible; remaining flips are explicit RTL overrides. | Every page |
| F4 | **Theme toggle** in settings (`light` / `dark` / `auto`); auto follows `prefers-color-scheme` | Options |
| F5 | **Live re-paint** — `chrome.storage.onChanged` fires across pages; each page applies the new locale / theme without a reload | Every page |

---

## 3. Architecture

### `scripts/i18n.js`
- `STRINGS = { en: {...}, ar: {...} }` — flat catalogue, ~80 keys.
- `loadLocale()` — reads `chrome.storage.sync["language"]` (defaults to `"en"`); returns the active locale.
- `t(key, fallback?)` — synchronous lookup against the loaded locale, with `en` as last-resort fallback.
- `applyI18n(root = document)` — walks `[data-i18n]` elements and writes `textContent` (or `placeholder` for `<input type="text|search">`); also sets `<html dir>` / `<html lang>`.
- `setLocale(locale)` — persists via `storage.sync.set` and re-applies. The `storage.onChanged` listener installed by `bootstrapI18n()` re-applies in every other open page.

### `scripts/theme.js`
- `THEMES = ["light", "dark", "auto"]`
- `loadTheme()` — reads `chrome.storage.sync["theme"]` (defaults to `"auto"`).
- `applyTheme(theme)` — sets `<html data-theme>` attribute; CSS does the rest via cascading custom properties.
- Listens for `prefers-color-scheme` changes when in `auto` mode.

### CSS variables — extended for dark mode
Every page-level CSS already uses custom properties like `--bg`, `--card`, `--fg`, `--muted`, `--accent`, `--border`. A new shared `styles/theme.css` defines the dark-mode overrides:

```css
:root[data-theme="dark"] {
    --bg: #15181d;
    --card: #1f242c;
    --fg: #e7e9ee;
    --muted: #8a92a0;
    --accent: #4caf81;
    --accent-soft: rgba(76, 175, 129, 0.16);
    --border: #2a313b;
}

@media (prefers-color-scheme: dark) {
    :root[data-theme="auto"] {
        --bg: #15181d;
        --card: #1f242c;
        --fg: #e7e9ee;
        --muted: #8a92a0;
        --accent: #4caf81;
        --accent-soft: rgba(76, 175, 129, 0.16);
        --border: #2a313b;
    }
}
```

`styles/theme.css` is linked from every page (popup, options, reader, hadith, azkar, radio) — one `<link>` per page.

---

## 4. New Files

| Path | Purpose |
|---|---|
| `scripts/i18n.js` | String catalogue + `t()` / `applyI18n()` / `setLocale()` / `bootstrapI18n()`. |
| `scripts/theme.js` | `loadTheme()` / `applyTheme()` / `bootstrapTheme()`. |
| `styles/theme.css` | Dark-mode CSS variable overrides + cross-page reset for the `[data-theme]` switcher. |
| `docs/PHASE_7.md` | This file. |

## 5. Files Modified

| Path | Change |
|---|---|
| `manifest.json` | `default_locale: "ar"` removed (we don't use `chrome.i18n`); version bump to `1.8.0`. |
| `scripts/settings.js` | New `language: "en"` and `theme: "auto"` top-level keys (kept top-level, not nested under another section, since they're cross-cutting). |
| All HTML pages | `<link rel="stylesheet" href="…/styles/theme.css">` added; chrome strings now have `data-i18n="…"` attributes; `<html lang>` removed (set dynamically). |
| All page JS | Imports `bootstrapI18n` and `bootstrapTheme` from `scripts/i18n.js` / `scripts/theme.js`; calls them at startup so the page renders in the saved language and theme without a flash of the wrong one. |
| `options/options.html` + `options.js` | Two new cards: *Display* with language radio + theme dropdown. |

---

## 6. String Catalogue (~80 keys)

Examples — see `scripts/i18n.js` for the full list:

| Key | EN | AR |
|---|---|---|
| `popup.cityFallback` | "Prayer Times" | "مواقيت الصلاة" |
| `popup.openQuran` | "Read Qur'an" | "قراءة القرآن" |
| `popup.openHadith` | "Browse Hadith" | "تصفح الحديث" |
| `popup.openAzkar` | "Open Azkar" | "فتح الأذكار" |
| `popup.openRadio` | "Open Radio" | "فتح الراديو" |
| `popup.settings` | "Settings" | "الإعدادات" |
| `prayer.Fajr` … | "Fajr" / "Dhuhr" / "Asr" / "Maghrib" / "Isha" | "الفجر" / "الظهر" / "العصر" / "المغرب" / "العشاء" |
| `qibla.label` | "Qibla" | "القبلة" |
| `qibla.dragHint` | "Drag to align" | "اسحب للمحاذاة" |
| `options.location.title` | "Location" | "الموقع" |
| `options.notifications.title` | "Notifications" | "الإشعارات" |
| `reader.bookmarks` | "Bookmarks" | "الإشارات المرجعية" |
| `reader.searchSurah` | "Search surah…" | "ابحث في السور..." |
| `radio.searchPlaceholder` | "Search stations…" | "ابحث في المحطات..." |
| `display.title` | "Display" | "العرض" |
| `display.language` | "Language" | "اللغة" |
| `display.theme` | "Theme" | "المظهر" |
| `display.themeAuto` | "Match system" | "تلقائي حسب النظام" |
| `display.themeLight` | "Light" | "فاتح" |
| `display.themeDark` | "Dark" | "داكن" |

Dynamic strings (e.g., countdown formatting, hadith collection names from the API, dhikr text) are **not** translated — they come from upstream sources and are already locale-correct (Arabic for hadith bodies, English for surah transliterations, etc.).

---

## 7. RTL Considerations

- `<html dir="rtl">` flips most flex / inline-flow naturally.
- Existing `direction: rtl` on Arabic text blocks (`.ayah-text`, `.hadith-arab`, `.dhikr-text`) is preserved — they were already RTL regardless of UI locale.
- Compass cardinals (N/E/S/W) stay LTR by design — they're directional symbols, not language. SVG `<text>` elements get an explicit `direction: ltr` to avoid accidental flipping.
- The toolbar badge is symbol-only (`45m` / `2h`), no RTL handling needed.
- Notifications use the OS locale for layout direction; we send Arabic body text and Chrome / Windows handles bidi automatically.

---

## 8. Theme — How Each Page Picks Up

```html
<link rel="stylesheet" href="../styles/theme.css">
<link rel="stylesheet" href="popup.css">
```

`theme.css` is loaded **first** so its `[data-theme="dark"]` selectors override the page-level CSS only when the attribute is set. Page-level CSS retains its light defaults at `:root` (no `[data-theme]` qualifier), so a fresh install renders correctly with no theme attribute set.

Every page's bootstrap JS:

```js
import { bootstrapTheme } from "../scripts/theme.js";
import { bootstrapI18n } from "../scripts/i18n.js";

bootstrapTheme();   // sets <html data-theme> from storage
bootstrapI18n();    // sets <html dir/lang> and rewrites [data-i18n] textContent
```

Both functions are synchronous after their initial async storage read (which happens at module-load time and is awaited via a top-level `await`-friendly cached promise). The page DOM is rendered with the correct attributes before paint, eliminating the "flash of wrong theme/language."

---

## 9. How to Test Phase 7

1. **Reload** at `chrome://extensions`.
2. Open the popup → all visible labels in English (default).
3. Open Settings → new **Display** card → switch language to *العربية* → save.
4. Reopen the popup → labels now in Arabic, layout flipped to RTL. Hijri date already was Arabic; everything around it now matches.
5. Open the reader / hadith / azkar / radio tabs — sidebar headers, search placeholders, button labels all in Arabic.
6. Back to Settings → switch theme to *Dark* → save.
7. Every open page (popup, reader, etc.) re-paints to the dark palette within ~50 ms, no reload required (cross-page `storage.onChanged`).
8. Switch theme to *Match system* and toggle your OS theme → extension follows.

---

## 10. Definition of Done

- [x] `scripts/i18n.js` with ~80-key bilingual catalogue.
- [x] `scripts/theme.js` with light/dark/auto support.
- [x] Every chrome element across every page is translated when `language === "ar"`.
- [x] `<html dir>` flips correctly without breaking inner Arabic-text blocks.
- [x] Dark mode renders cleanly on every page (no white-card-on-dark-bg artefacts).
- [x] Switching either setting in options live-updates every other open extension page.
- [x] No flash of light theme on dark-mode users opening the popup.

---

## 11. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| Only `ar` and `en`. Adding more locales is mechanical (extend `STRINGS`). | Future. |
| Notifications fired from the service worker still use English titles ("Prayer time: Fajr"); only the popup chrome is translated. | Future polish — could read locale in `background.js` and select. |
| No font swap — Arabic UI uses the system Arabic stack already in place for content. Looks fine on Windows / mac OS / iOS; not validated on Linux without an Arabic font installed. | Out of scope. |