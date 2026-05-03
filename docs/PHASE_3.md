# Phase 3 — Audio (Offscreen)

> **Status:** ✅ Complete
> **Version bump:** `1.3.0` → `1.4.0`
> **Goal:** Per-surah recitation playback that survives popup close, reader-tab close, and idle service-worker cycles. Reciter selectable from settings.

---

## 1. Why an Offscreen Document

In MV3, both the popup and the service worker are short-lived:
- The popup is destroyed on blur.
- The service worker is parked after ~30 s of inactivity.

Neither can host a long-running `<audio>` element reliably. Chrome's **Offscreen Documents API** (`chrome.offscreen.*`) is purpose-built for this — it provides a hidden DOM context with one of a small set of justifications. We use `reasons: ["AUDIO_PLAYBACK"]` which tells Chrome to keep the document alive while audio is playing.

Architecture:

```
   ┌──────────────┐                      ┌─────────────────┐
   │ reader page  │ ─ runtime.message ──►│ background SW   │
   │  (or popup)  │                      │  ensureOffscreen│
   └──────┬───────┘                      └────────┬────────┘
          │ runtime.message (target:offscreen)    │ chrome.offscreen.createDocument
          ▼                                       ▼
   ┌─────────────────────────────────────────────────┐
   │  offscreen/offscreen.html  (hidden DOM context) │
   │  ┌──────────────┐                               │
   │  │ <audio> tag  │  ◄── player commands          │
   │  └──────┬───────┘                               │
   │         │ timeupdate / ended / play / pause     │
   │         └──► broadcast { audio:state, ... } ──┐ │
   └────────────────────────────────────────────────┘ │
                                                      ▼
                                          all reader/popup tabs receive
                                          state updates and re-render the
                                          mini player
```

The reader sends `play` / `pause` / `seek` / `stop` commands; the offscreen doc emits `audio:state` broadcasts on every meaningful change.

---

## 2. Features

| # | Feature | Surface |
|---|---|---|
| F1 | **Reciter dropdown in settings** — populated from `api.quran.com/v4/resources/recitations`, default *Mishary Rashid Alafasy* | Options |
| F2 | **▶ Listen button** at the top of every surah in the reader | Reader header |
| F3 | **Bottom-fixed mini player** with title, scrub bar, current/total time, ▶/⏸ toggle, and ✕ stop | Reader |
| F4 | **Persistent playback** — closing the reader tab or the popup does not stop audio | Background |
| F5 | **Cross-tab sync** — open reader in two tabs, mini player state is identical in both, controls work from either | Reader |
| F6 | **Auto-cleanup** — when audio ends or is stopped, the offscreen document is torn down so we don't keep an idle DOM around | Background |
| F7 | **Popup mini-control** — when audio is playing, the toolbar popup shows a compact `[⏸] Title  0:34 / 23:18 [✕]` bar; pause / resume / stop without navigating to the reader. Auto-hides when no audio is loaded. | Popup |

---

## 3. Endpoints

| Endpoint | Used for | Cache |
|---|---|---|
| `GET https://api.quran.com/api/v4/resources/recitations` | List of available reciters (id, reciter_name, style, translated_name) | 30 d, key `reciters` |
| `GET https://api.quran.com/api/v4/chapter_recitations/{reciter_id}/{chapter_number}` | The MP3 URL for one surah from one reciter — `data.audio_file.audio_url` | 30 d, key `audio:{reciter}:{chapter}` |

The audio_url itself points to a CDN (e.g. `https://verses.quran.com/...`); the `<audio>` element loads it directly without going through `fetch()` so no extra `host_permissions` entry is needed for the CDN host. We do declare `https://api.quran.com/*` in `host_permissions` for the metadata calls.

---

## 4. Message Protocol

All audio-related messages flow over `chrome.runtime.sendMessage` (no chrome.tabs needed — every extension page receives every runtime message).

### From reader → offscreen
```jsonc
{ "target": "offscreen", "action": "play",  "url": "...", "surah": 2,  "reciter": 7, "title": "Al-Baqarah · Mishary Alafasy" }
{ "target": "offscreen", "action": "pause" }
{ "target": "offscreen", "action": "resume" }
{ "target": "offscreen", "action": "stop" }
{ "target": "offscreen", "action": "seek", "time": 145.6 }
{ "target": "offscreen", "action": "getState" }   // sendResponse with current state
```

### From offscreen → all extension pages (broadcast)
```jsonc
{
  "type": "audio:state",
  "state": {
    "playing":     true,
    "loading":     false,
    "surah":       2,
    "reciter":     7,
    "title":       "Al-Baqarah · Mishary Alafasy",
    "currentTime": 12.34,
    "duration":    1428.7,
    "ended":       false
  }
}
```

### From reader → background
```jsonc
{ "type": "audio:ensure" }   // SW calls chrome.offscreen.createDocument if needed
```

The background SW only orchestrates lifecycle (create / close offscreen). It does **not** sit in the audio data path — reader talks to offscreen directly.

---

## 5. New Files

| Path | Purpose |
|---|---|
| `offscreen/offscreen.html` | Minimal HTML host for the audio element. Hidden — never displayed. |
| `offscreen/offscreen.js` | Audio element + message router + state broadcaster. |
| `scripts/quran-audio.js` | `fetchReciters()`, `fetchChapterAudio(reciterId, chapter)` — cached. |
| `scripts/audio-controller.js` | Reader-side wrapper API: `play(reciterId, surah, surahName)`, `pause()`, `resume()`, `stop()`, `seek(t)`, `getState()`, `onState(cb)`. Hides the message-passing details. |
| `docs/PHASE_3.md` | This file. |

## 6. Files Modified

| Path | Change |
|---|---|
| `manifest.json` | Add `offscreen` permission. Add `https://api.quran.com/*` to `host_permissions`. Bump version to `1.4.0`. |
| `background.js` | New `ensureOffscreen()` and message handler for `audio:ensure`. Closes offscreen on `audio:state` with `ended: true` and `playing: false`. |
| `scripts/settings.js` | New `audio: { reciterId: 7 }` group (default Mishary). |
| `reader/reader.html` | New `▶ Listen` button in the surah header; new fixed-bottom mini player. |
| `reader/reader.js` | Wires Listen button → `audio-controller.play()`; subscribes to state broadcasts; renders mini player. |
| `reader/reader.css` | Player styles (sticky-bottom bar, scrubber, button states). |
| `popup/popup.{html,js,css}` | Mini audio control (`#audio-mini`) — subscribes to `audio:state` broadcasts via `audio-controller.onAudioState`. Hidden when `surah === null` or playback has ended. |
| `options/options.html` + `options.js` | Reciter dropdown. List populated lazily from `fetchReciters()` on page open. |

---

## 7. Settings Schema Addition

```jsonc
{
  // ...existing keys...
  "audio": {
    "reciterId": 7   // default Mishary Rashid Alafasy
  }
}
```

A small in-code `RECITER_FALLBACKS` table seeds the dropdown if the network call to `/recitations` fails.

---

## 8. Lifecycle Edge Cases

| Scenario | Behaviour |
|---|---|
| User clicks ▶ Listen, then closes the reader tab. | Audio keeps playing — the offscreen document outlives the reader. |
| User clicks ▶ Listen, opens a second reader tab. | Both tabs show the same mini-player state and can control playback. |
| Audio finishes playing the surah. | Offscreen broadcasts `playing: false, ended: true` and the SW closes the offscreen document; mini player shows ended state and can be restarted. |
| User clicks ▶ on a different surah while one is playing. | New audio loads; the previous track is replaced (`audio.src = newUrl; audio.play()`). Single-source enforcement is built into the offscreen doc — there's only one `<audio>` element. |
| Service worker restarts mid-playback. | The offscreen document persists independently. The SW reattaches its message listener on wake; no replay needed. |
| User clicks ▶ before reciter list has loaded. | `fetchChapterAudio` works as long as `reciterId` is a valid integer; the dropdown population is independent. |

---

## 9. How to Test Phase 3

1. **Reload** the extension at `chrome://extensions`.
2. **Settings** → *Qur'an* card now also has a **Reciter** dropdown — leave on Mishary or pick another → Save.
3. Open the **reader** from the popup. Each surah view now has a **▶ Listen** button next to the title.
4. Click ▶ Listen on Al-Fātiḥah → recitation begins; mini player appears at the bottom of the reader with the surah title, scrub bar, time, and ⏸/✕ controls.
5. **Close the reader tab** → audio keeps playing (this is the offscreen document working).
6. Reopen the reader → mini player shows the same state with the scrub bar mid-track. Hit ⏸ or ✕ to control from any tab.
7. **Cross-tab test:** open two reader tabs; play in one — the second tab's mini player updates within ~250 ms (timeupdate fires every 250 ms on the offscreen audio).
8. **Reciter swap:** in settings change reciter from Mishary to AbdulBaset → save → click ▶ Listen on a surah → audio comes from the new reciter.
9. **Inspect offscreen:** in `chrome://extensions`, click **Inspect views: offscreen.html** (only visible while a document is alive) to open DevTools on the offscreen doc.
10. **Auto-cleanup:** let a short surah play to its natural end → offscreen doc disappears from the inspect-views list.

---

## 10. Definition of Done

- [x] `chrome.offscreen.createDocument` succeeds with `reasons: ["AUDIO_PLAYBACK"]`.
- [x] Audio survives popup close, reader-tab close, and SW idle parking.
- [x] Single `<audio>` source — switching surah / reciter cancels the previous track cleanly.
- [x] Mini player accurately reflects state in every open reader tab.
- [x] Stop or natural end tears the offscreen document down.
- [x] Reciter list loads from API and is cached for 30 days; falls back to a hardcoded list if the API is unreachable.
- [x] Settings page can change reciter and the change takes effect on the next ▶ Listen click.

---

## 11. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| No per-ayah audio. The recitations endpoint we use is chapter-level only; per-ayah segmentation needs a different endpoint and is out of scope. | Future polish |
| No background-tab playback indicator on the toolbar. | Future polish |
| No "play next surah" autoplay queue. | Future polish |
| No download / offline support — the MP3 is streamed from the CDN; if you go offline mid-track Chrome's media engine handles the gap, but a paused track can't be resumed offline. | Out of scope |
| Mini player has no playback-rate or volume controls. | Out of scope |
