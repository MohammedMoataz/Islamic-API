// MV3 service worker. Schedules prayer alarms via chrome.alarms so reminders
// fire even when the popup is closed, and writes a minutes-to-next-prayer
// countdown to the toolbar badge.

import { getSettings } from "./scripts/settings.js";
import { fetchTimings, fetchTimingsStaleOk } from "./scripts/api.js";
import {
    todayAt,
    nextLocalMidnightPlus5,
    findNextPrayer,
    formatBadge,
    MAIN_PRAYERS
} from "./scripts/utility.js";
import {
    fetchAzkar, getCounts, setCount, getNotifiedSet, markNotified, countKey
} from "./scripts/azkar.js";

const ICON_URL = chrome.runtime.getURL("images/icon-128.png");
const BADGE_COLOR = "#1a7f5a";

chrome.runtime.onInstalled.addListener(() => scheduleToday());
if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => scheduleToday());
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "daily-refresh") {
        return scheduleToday();
    }
    if (alarm.name === "badge-tick") {
        return updateBadge();
    }
    if (alarm.name.startsWith("prayer:")) {
        const name = alarm.name.slice("prayer:".length);
        notify(`Prayer time: ${name}`, `${name} is now.`);
        return updateBadge();
    }
    if (alarm.name.startsWith("pre:")) {
        const [, name, mins] = alarm.name.split(":");
        return notify(
            `Upcoming prayer: ${name}`,
            `${name} is in ${mins} minute${mins === "1" ? "" : "s"}.`
        );
    }
    if (alarm.name === "azkar-tick") {
        return onAzkarTick();
    }
});

// Open the azkar page on the right category when the user clicks a reminder.
chrome.notifications.onClicked.addListener((notifId) => {
    if (!notifId.startsWith("azkar:")) return;
    const idx = parseInt(notifId.split(":")[1], 10);
    const url = Number.isFinite(idx)
        ? `azkar/azkar.html#${idx}`
        : "azkar/azkar.html";
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    chrome.notifications.clear(notifId);
});

// Re-schedule whenever the user changes settings.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
        scheduleToday();
    }
});

// Allow the options page to fire a test notification on demand,
// and orchestrate the offscreen audio document.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "test-notification") {
        notify("Test notification", "If you can see this, notifications are working.");
        sendResponse({ ok: true });
        return true;
    }
    if (msg?.type === "reschedule") {
        scheduleToday().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (msg?.type === "audio:ensure") {
        ensureOffscreen().then(() => sendResponse({ ok: true })).catch((err) => {
            console.error("ensureOffscreen failed:", err);
            sendResponse({ ok: false, error: String(err) });
        });
        return true;
    }
    // Tear the offscreen document down once playback truly ends or is stopped.
    if (msg?.type === "audio:state") {
        const s = msg.state;
        if (s && !s.playing && !s.loading && (s.ended || s.surah === null)) {
            scheduleOffscreenClose();
        } else {
            cancelOffscreenClose();
        }
    }
});

const OFFSCREEN_PATH = "offscreen/offscreen.html";

async function ensureOffscreen() {
    if (await hasOffscreen()) return;
    await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Qur'an recitation playback that survives popup and tab close."
    });
}

async function hasOffscreen() {
    if (chrome.offscreen?.hasDocument) {
        try { return await chrome.offscreen.hasDocument(); } catch { /* fall through */ }
    }
    try {
        const matched = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
            documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
        });
        return matched.length > 0;
    } catch {
        return false;
    }
}

let closeTimer = null;
function scheduleOffscreenClose() {
    cancelOffscreenClose();
    closeTimer = setTimeout(async () => {
        if (await hasOffscreen()) {
            try { await chrome.offscreen.closeDocument(); } catch { /* already closed */ }
        }
    }, 500);
}
function cancelOffscreenClose() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
}

async function scheduleToday() {
    try {
        const settings = await getSettings();
        const data = await fetchTimings(settings.location);
        const timings = data?.timings;
        if (!timings || typeof timings.Fajr !== "string") {
            throw new Error("fetchTimings returned malformed payload");
        }

        await chrome.alarms.clearAll();

        if (settings.notifications.enabled) {
            const pre = settings.notifications.preMinutes;
            for (const name of MAIN_PRAYERS) {
                const hhmm = timings[name];
                if (!hhmm) continue;
                const at = todayAt(hhmm);
                if (at > Date.now()) {
                    chrome.alarms.create(`prayer:${name}`, { when: at });
                }
                if (pre > 0) {
                    const preAt = at - pre * 60_000;
                    if (preAt > Date.now()) {
                        chrome.alarms.create(`pre:${name}:${pre}`, { when: preAt });
                    }
                }
            }
        }

        // Refresh just after midnight so tomorrow's timings are ready.
        chrome.alarms.create("daily-refresh", {
            when: nextLocalMidnightPlus5(),
            periodInMinutes: 24 * 60
        });

        // Toolbar countdown.
        chrome.alarms.create("badge-tick", { periodInMinutes: 1 });
        await updateBadge();

        // Azkar reminders (opt-in). scheduleToday clearAll'd above, so always
        // recreate the tick if enabled.
        await ensureAzkarTick(settings);
    } catch (err) {
        console.error("scheduleToday failed:", err);
        // Try again in 30 minutes if the network was down.
        chrome.alarms.create("daily-refresh", { delayInMinutes: 30 });
    }
}

// ---------------------------------------------------------------- Azkar reminders

async function ensureAzkarTick(settings) {
    await chrome.alarms.clear("azkar-tick");
    if (!settings.azkar?.reminders?.enabled) return;
    const avg = clampInt(settings.azkar.reminders.avgIntervalMinutes, 30, 360, 180);
    scheduleNextAzkarTick(avg);
}

function scheduleNextAzkarTick(avgMin) {
    // Random delay in [avg/2, avg*1.5]; spread = ±50%.
    const half = avgMin / 2;
    const delayMin = half + Math.random() * (avgMin);
    chrome.alarms.create("azkar-tick", { delayInMinutes: delayMin });
}

async function onAzkarTick() {
    // Reschedule first so the user keeps getting reminders even if the network
    // is down or the dhikr fetch errors out.
    let avg = 180;
    try {
        const settings = await getSettings();
        if (!settings.azkar?.reminders?.enabled) return;
        avg = clampInt(settings.azkar.reminders.avgIntervalMinutes, 30, 360, 180);
    } finally {
        scheduleNextAzkarTick(avg);
    }

    const kind = await activeAzkarWindow();
    if (!kind) return;

    try {
        const azkar = await fetchAzkar();
        const matchers = kind === "morning"
            ? ["الصباح", "morning"]
            : ["المساء", "evening"];
        const idx = azkar.findIndex((g) =>
            matchers.some((m) => (g.category || "").includes(m)));
        if (idx < 0) return;
        const group = azkar[idx];
        if (!group?.items?.length) return;

        // Cycle through unnotified, uncompleted dhikrs so we cover most of the
        // category over the course of the day instead of re-firing the same
        // random one.
        const notified = await getNotifiedSet(kind);
        const counts = await getCounts();
        const eligible = group.items
            .map((item, i) => ({ item, i }))
            .filter(({ item, i }) => {
                if (notified.has(i)) return false;
                const k = countKey(group.category, i);
                if (k in counts && counts[k] <= 0) return false;
                return true;
            });
        if (eligible.length === 0) {
            // Whole category covered for today — wait until tomorrow.
            return;
        }

        const pick = eligible[Math.floor(Math.random() * eligible.length)];
        const item = pick.item;
        const text = item.zekr || "";
        const message = text.length > 220 ? text.slice(0, 220) + "…" : text;
        const title = kind === "morning" ? "Morning Azkar" : "Evening Azkar";

        // One notification id per kind so a fresh reminder replaces the
        // previous one rather than piling up.
        chrome.notifications.create(`azkar:${idx}:${kind}`, {
            type: "basic",
            iconUrl: ICON_URL,
            title,
            message,
            contextMessage: `Repeat × ${item.count}`,
            priority: 1
        });

        // Mark the dhikr as "done" so the user doesn't have to tap-count the
        // same one in the page, and remember we surfaced it so the next tick
        // picks something else.
        await markNotified(kind, pick.i);
        await setCount(group.category, pick.i, 0);
    } catch (err) {
        console.warn("azkar tick: skipped", err?.message ?? err);
    }
}

// Returns "morning" / "evening" based on prayer times when available, falling
// back to a clock-based split if the timings request fails.
//
//   Morning window:  Fajr → Maghrib    (daylight)
//   Evening window:  Maghrib → Fajr    (sunset → next sunrise)
//
// Reminders fire 24/7 — there's no silent period. The user explicitly wanted
// the windows tied to actual prayer times, not to a hardcoded clock.
async function activeAzkarWindow(now = new Date()) {
    try {
        const settings = await getSettings();
        const data = await fetchTimingsStaleOk(settings.location);
        const t = data?.timings;
        if (typeof t?.Fajr === "string" && typeof t?.Maghrib === "string") {
            const fajrAt = todayAt(t.Fajr);
            const maghribAt = todayAt(t.Maghrib);
            const nowMs = now.getTime();
            return (nowMs >= fajrAt && nowMs < maghribAt) ? "morning" : "evening";
        }
    } catch (err) {
        console.warn("activeAzkarWindow: falling back to clock split", err?.message ?? err);
    }
    // Clock fallback — approximate Fajr ≈ 05:00, Maghrib ≈ 18:00.
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes >= 5 * 60 && minutes < 18 * 60) ? "morning" : "evening";
}

function clampInt(raw, min, max, fallback) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

async function updateBadge() {
    try {
        const settings = await getSettings();
        // Stale cache is fine for the badge — a slightly out-of-date countdown
        // is better than blanking the icon during a flaky connection.
        const data = await fetchTimingsStaleOk(settings.location);
        if (!data?.timings || typeof data.timings.Fajr !== "string") {
            console.warn("updateBadge: malformed timings, skipping");
            return;
        }
        const next = findNextPrayer(data.timings);
        if (next) {
            chrome.action.setBadgeText({ text: formatBadge(next.at - Date.now()) });
            chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
        } else {
            chrome.action.setBadgeText({ text: "" });
        }
    } catch (err) {
        // Don't pollute the console — this fires every minute, and a transient
        // network blip isn't actionable. Keep the previous badge text.
        console.warn("updateBadge: skipped (network unavailable, no cache)");
    }
}

function notify(title, message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: ICON_URL,
        title,
        message,
        priority: 2
    });
}
