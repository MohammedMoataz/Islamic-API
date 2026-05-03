# Phase 6 — Qur'an Radio

> **Status:** ✅ Complete
> **Version bump:** `1.6.0` → `1.7.0`
> **Goal:** Add a live-stream radio tab with the 18+ Qur'an stations from `data-rosy.vercel.app/radio.json`, sharing the offscreen audio document with surah recitation so only one source plays at a time.

---

## 1. Features

| # | Feature | Surface |
|---|---|---|
| F1 | **Radio full tab** at `radio/radio.html` — searchable scrollable list of every station | New full tab |
| F2 | **Per-station ▶ / ⏸** — click ▶ on any row → loads stream → row flips to ⏸; click again → stops | Radio page |
| F3 | **Single-source enforcement** — playing a station while a surah is playing stops the surah; tapping ▶ Listen on a surah while radio is playing stops the radio. Built-in to the offscreen `<audio>` (single element, single source). | Audio plumbing |
| F4 | **Search filter** — substring match against station name | Radio page |
| F5 | **Last-played station** persisted in `chrome.storage.local["lastRadio"]`; on reopen, the matching row shows a *Last played* badge | Radio page |
| F6 | **Cross-surface mini player** — popup mini and reader mini already subscribe to `audio:state`; they pick up radio playback automatically and show the station name as the track title | Popup + reader |
| F7 | **Open Radio** button alongside *Read Qur'an*, *Browse Hadith*, *Open Azkar* | Popup |

---

## 2. Endpoint

| Endpoint | Used for | Cache |
|---|---|---|
| `GET https://data-rosy.vercel.app/radio.json` | Array of stations: `[{ name, url, recent_date? }, ...]` | 24 h, key `radio:list` |

The MP3 / streaming URL itself is loaded directly into `<audio>` and doesn't need a `host_permissions` entry — the wildcards in browsers' media engines bypass extension CSP for media src.

---

## 3. State Schema Update — `station` field

The shared offscreen-audio state grew a `station: string | null` field next to the existing `surah` / `reciter` / `title`:

```jsonc
{
  "playing":     true,
  "loading":     false,
  "surah":       null,                    // null when a non-surah source is playing
  "reciter":     null,
  "station":     "Mishary Alafasy Radio", // null when a surah is playing
  "title":       "Mishary Alafasy Radio",
  "currentTime": 12.34,
  "duration":    Infinity,                // radio streams have no duration
  "ended":       false
}
```

`hasTrack` callers were updated to `surah !== null || station !== null`. Selecting a radio station clears `surah/reciter`; selecting a surah clears `station`. Stop clears all three.

---

## 4. Files Added

| Path | Purpose |
|---|---|
| `radio/radio.html` | Topbar + search + station list. |
| `radio/radio.js` | List render, click → `playRadio` / `stopAudio`, last-played persistence, cross-window sync via `audio:state`. |
| `radio/radio.css` | Station card layout, play-button state, "Last played" badge. |
| `scripts/radio.js` | `fetchStations()` wrapper (cached 24 h, normalises minor shape variants). |
| `docs/PHASE_6.md` | This file. |

## 5. Files Modified

| Path | Change |
|---|---|
| `manifest.json` | Add `https://data-rosy.vercel.app/*` to `host_permissions`. Bump version to `1.7.0`. |
| `offscreen/offscreen.js` | New `play-radio` message action; `station` field in state; broadcasts duration safely (drops `Infinity` for radio so JSON serialisation stays stable). |
| `scripts/audio-controller.js` | New `playRadio(url, name)` exporter. |
| `popup/popup.html` + `popup.js` + `popup.css` | *Open Radio* button. Mini player's `hasTrack` is now `surah !== null || station !== null`; time line hides when duration is Infinity. |
| `reader/reader.js` | `applyAudioState` ignores radio (only mirrors playing state if `surah` matches the current surah's number). |

---

## 6. How to Test Phase 6

1. **Reload** at `chrome://extensions`.
2. Open the popup → **Open Radio** → opens `radio/radio.html` in a new tab.
3. Station list loads (~20 stations). **Search** in the box at top to narrow it down.
4. Click ▶ on any station — within ~1–2 s the row flips to ⏸ and audio starts. The popup's mini control shows the station name (no time, since live).
5. Click ⏸ on the same row → audio stops, row flips back to ▶, mini control disappears.
6. **Single-source check:** start a station → switch to the reader → click ▶ Listen on Al-Fātiḥah → station audio stops, surah recitation begins. The radio page's playing row goes back to ▶.
7. Reverse: play surah → switch to radio tab → click ▶ on a station → surah stops, station starts. Reader's *▶ Listen* button returns to idle.
8. **Last-played:** play and stop a station → close the radio tab → reopen → the station's row shows a *Last played* badge.
9. **Inspect cache:**
   ```js
   chrome.storage.local.get("radio:list", console.log)
   chrome.storage.local.get("lastRadio", console.log)
   ```

---

## 7. Definition of Done

- [x] Stations load from `data-rosy.vercel.app/radio.json`, cached 24 h.
- [x] Per-row play/stop button correctly reflects offscreen state across tabs.
- [x] Single playback source enforced — switching surah↔radio cancels the previous cleanly.
- [x] Popup mini shows station name when radio is the active source.
- [x] Last-played station survives popup / tab close.
- [x] Offscreen document is torn down when the user explicitly stops or the stream ends.

---

## 8. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| No volume slider; system volume is the only control. | Out of scope. |
| No favorites / starred stations beyond "last played." | Future polish. |
| If a stream URL 404s (some upstreams rotate URLs), the row gets stuck in loading state until the user clicks Stop. | Future polish — could subscribe to the `audio:state` `loading: true` for too long and auto-stop. |
| No metadata (current track / reciter name) shown for the playing station. | Future polish — would need ICY metadata which isn't trivially available via `<audio>`. |
