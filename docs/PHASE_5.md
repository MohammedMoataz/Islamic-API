# Phase 5 — Azkar

> **Status:** ✅ Complete
> **Version bump:** `1.5.0` → `1.6.0`
> **Goal:** Browse and count Islamic supplications (morning, evening, after-prayer, sleep, waking, mosque entry/exit, etc.) with a tap-to-count tasbih that persists across popup/tab close and auto-resets at local midnight.

---

## 1. Features

| # | Feature | Surface |
|---|---|---|
| F1 | **Azkar full tab** at `azkar/azkar.html` — sidebar lists categories, main pane shows the dhikr cards for the chosen category. | New full tab |
| F2 | **Tap-to-count tasbih** on every card — large circular button shows remaining repetitions; tap decrements; reaches 0 → button changes state and the page auto-scrolls to the next dhikr. | Azkar page |
| F3 | **Per-day persistence** — counts are stored with today's `YYYY-MM-DD` key. If the user reopens the page on a new day the counts are cleared so morning/evening azkar start fresh each day. | `chrome.storage.local["azkarCounts"]` |
| F4 | **Manual reset** — every card has a small ↻ button that re-arms the counter to the dhikr's original target count. | Azkar page |
| F5 | **Reset-all-in-category** — a *↻ Reset all* button at the top of each category clears every counter for that category in one storage write. For morning/evening categories it also clears the "notified today" set, so reminders can re-cover the same dhikrs. | Azkar page |
| F6 | **Open Azkar** button alongside *Read Qur'an* and *Browse Hadith* in the popup. | Popup |
| F7 | **Random-time reminder notifications** — when enabled in settings, the service worker fires a notification with one of the un-notified dhikrs at random intervals. Windows are **prayer-time relative**: morning runs from *Fajr* to *Maghrib*, evening from *Maghrib* to the next *Fajr*. Falls back to a clock split (05:00 ↔ 18:00) if timings can't be fetched. Each notified dhikr is **marked as done** (count → 0) and added to a per-day notified-set so the next tick picks something else; reminders cycle through the category instead of repeating. Click the notification → opens the azkar page on the right category. | Service worker + notifications |

---

## 2. Endpoints

| Endpoint | Used for | Cache |
|---|---|---|
| `GET https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json` | Single JSON containing every dhikr grouped by category | 30 d, key `azkar:nawaf` |

The Hisn al-Muslim API (`https://www.hisnmuslim.com/api/ar/{id}.json`) catalogued in the README is **not** wired in for Phase 5 — Nawaf's bundle covers the full canonical set in one fetch. Hisn enrichment is left as a future polish.

The response has either an object-of-arrays or array-of-objects shape (the upstream has flipped between them historically). The wrapper normalises both into:

```jsonc
[
  {
    "category": "أذكار الصباح",
    "items": [
      { "zekr": "...", "count": 3, "description": "...", "reference": "..." },
      ...
    ]
  },
  ...
]
```

---

## 3. Persistence Schema

```jsonc
chrome.storage.local["azkarCounts"] = {
  "date": "2026-05-04",
  "counts": {
    "أذكار الصباح:0": 0,    // index 0 of morning azkar — completed
    "أذكار الصباح:1": 2,    // 2 repetitions remaining
    "أذكار المساء:0": 3
  }
}
```

The `date` field is matched against the browser's local `YYYY-MM-DD` on every page open. If they differ, `counts` is cleared in-place — your morning-azkar progress survives popup/tab close *within the same day* but starts fresh tomorrow. Manual reset just deletes a single entry; the rest stay intact.

`chrome.storage.local` (not `sync`) — sync's 8 KB-per-key limit would constrain us, and per-day counter state isn't worth roaming across devices.

---

## 4. Counter UX

- **Tap** the big circular button → decrement.
- Reaches **0** → button colour switches to muted-grey, label changes from the number to ✓, and the page scrolls the next un-completed card into view.
- **↻** small button on the card → reset that single dhikr to its target count.
- Every dhikr in a category visible at once (single-page list, no pagination).

---

## 5. New Files

| Path | Purpose |
|---|---|
| `azkar/azkar.html` | Sidebar (categories) + main pane (dhikr cards). |
| `azkar/azkar.js` | Category switching, counter logic, storage round-trips, auto-advance. |
| `azkar/azkar.css` | RTL Arabic typography, big circular tasbih button, completion state. |
| `scripts/azkar.js` | `fetchAzkar()` (cached 30 d, with shape normalisation) + counter persistence helpers (`getCounts`, `setCount`, `resetCount`, `clearIfNewDay`). |
| `docs/PHASE_5.md` | This file. |

## 6. Files Modified

| Path | Change |
|---|---|
| `manifest.json` | Add `https://raw.githubusercontent.com/*` to `host_permissions`. Bump to `1.6.0`. |
| `popup/popup.html` | New *Open Azkar* button next to *Browse Hadith*. |
| `popup/popup.js` | Click handler → `chrome.tabs.create`. |
| `popup/popup.css` | Reuses the `.btn-read-hadith` styling (outline button) for visual parity. |

---

## 7. UI Sketch

```
┌─────────────────────────────────────────────────────────────┐
│  Azkar                                          [Settings] │
├──────────────────┬──────────────────────────────────────────┤
│  Morning         │  أذكار الصباح                            │
│  Evening    ▶    │  18 supplications                        │
│  After prayer    │                                          │
│  Sleep           │  ┌────────────────────────────────────┐  │
│  Waking          │  │  ﺳﺒﺤﺎﻥ ﺍﻟﻠﻪ ﻭﺑﺤﻤﺪﻩ                  │  │
│  Mosque entry    │  │  Source: Bukhari …                  │  │
│  Mosque exit     │  │                                     │  │
│  Toilet entry    │  │       ╭───╮                         │  │
│  Toilet exit     │  │       │ 3 │   ↻                     │  │
│  ...             │  │       ╰───╯                         │  │
│                  │  └────────────────────────────────────┘  │
└──────────────────┴──────────────────────────────────────────┘
```

---

## 8. How to Test Phase 5

1. **Reload** at `chrome://extensions`.
2. Click the toolbar icon → *Open Azkar* → opens `azkar/azkar.html`.
3. Sidebar shows all categories from Nawaf's bundle. Click *Morning* (أذكار الصباح).
4. Main pane shows every morning dhikr with a big tap-counter on each.
5. **Tap a counter** a few times → number decrements. Reach 0 → ✓ shows, page smooth-scrolls to the next card.
6. Close the tab → reopen → previous progress is intact (today's date matches).
7. Hit ↻ on a single dhikr → that one resets to its target; others untouched.
8. **Day rollover test:** change your system clock forward a day → reload → all counts cleared and morning starts fresh.
9. **Inspect storage:**
   ```js
   chrome.storage.local.get("azkarCounts", console.log)
   ```

---

## 9. Definition of Done

- [x] All categories from Nawaf's bundle render in the sidebar.
- [x] Tap-counter decrements correctly and reaches 0 → completed visual state.
- [x] Counters persist across popup/tab close within a local day.
- [x] Counters auto-clear on first open of a new local day.
- [x] Manual reset on a single card doesn't touch the others.
- [x] Auto-advance scrolls to the next un-completed dhikr (even if it's not the immediate next index — e.g. user already completed 0 and 1, taps 2 to 0, page jumps to 3).
- [x] Reachable from the popup's *Open Azkar* button.

---

## 10. Reminder Notifications

Settings → **Azkar reminders** → toggle + interval dropdown.

```
chrome.storage.sync["settings"].azkar.reminders = {
  enabled: false,                 // opt-in
  avgIntervalMinutes: 180         // 60–360
}
```

Scheduler:
- One-shot `azkar-tick` alarm with `delayInMinutes = avg/2 + random()*avg`
  (uniform spread of `±50%` around the average).
- On fire:
  1. Reschedule the next tick first (so we never lose the cadence).
  2. Detect window: read today's `timings.Fajr` and `timings.Maghrib` from the
     cached Aladhan response. If now ∈ [Fajr, Maghrib) → morning; otherwise →
     evening. (Both pre-Fajr and post-Maghrib count as evening, since Maghrib
     → next-Fajr is one continuous evening window that crosses midnight.)
     Falls back to a clock-only split (05:00 ↔ 18:00) when timings are
     unreachable.
  3. Build the eligible pool: dhikrs from the matching category that are
     **not** in the per-day notified set **and** not already at count 0.
     If the pool is empty (whole category covered for today), skip — the next
     tick is still scheduled.
  4. Pick a random dhikr from the pool.
  5. `chrome.notifications.create("azkar:{idx}:{kind}", …)` — single id per
     kind so a fresh reminder replaces the previous one rather than piling up
     in the OS notification center.
  6. `markNotified(kind, i)` + `setCount(category, i, 0)` — record the
     surfacing and mark the dhikr as done so the open azkar page reflects
     completion via the existing `chrome.storage.onChanged` listener.
- Click handler: `chrome.notifications.onClicked` parses the id, opens
  `azkar/azkar.html#{idx}`, and clears the notification.

Why one-shot + reschedule (not periodic): `chrome.alarms` periodic alarms fire on a fixed cadence from creation time, which doesn't give the random feel the user asked for. One-shot with random delay produces genuinely random spacing while still being cheap (a single live alarm).

The tick is recreated on every `scheduleToday()` (which `clearAll`s) and on
every settings change (storage.onChanged → scheduleToday).

## 11. Known Limitations (deferred)

| Limitation | Resolved in |
|---|---|
| No Hisn al-Muslim secondary source — extended supplications for a chapter unavailable. | Future polish. |
| No "share progress" / streak / history. | Out of scope. |
| Arabic only — no transliteration or English translation. | Future polish. |
| Reminder windows are not configurable — they're tied to your configured prayer times (`Fajr` / `Maghrib`). Change city or calculation method in settings to shift them. | By design. |
