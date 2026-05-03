// MV3 service worker. Schedules prayer alarms via chrome.alarms so reminders
// fire even when the popup is closed, and writes a minutes-to-next-prayer
// countdown to the toolbar badge.

import { getSettings } from "./scripts/settings.js";
import { fetchTimings } from "./scripts/api.js";
import {
    todayAt,
    nextLocalMidnightPlus5,
    findNextPrayer,
    formatBadge,
    MAIN_PRAYERS
} from "./scripts/utility.js";

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
    } catch (err) {
        console.error("scheduleToday failed:", err);
        // Try again in 30 minutes if the network was down.
        chrome.alarms.create("daily-refresh", { delayInMinutes: 30 });
    }
}

async function updateBadge() {
    try {
        const settings = await getSettings();
        const data = await fetchTimings(settings.location);
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
        console.error("updateBadge failed:", err);
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
