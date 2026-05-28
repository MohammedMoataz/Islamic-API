import { getSettings } from "../scripts/settings.js";
import { fetchTimings, fetchQibla } from "../scripts/api.js";
import {
    todayAt,
    findNextPrayer,
    formatCountdown,
    formatDateLine,
    MAIN_PRAYERS
} from "../scripts/utility.js";
import {
    pauseAudio, resumeAudio, stopAudio, getAudioState, onAudioState
} from "../scripts/audio-controller.js";
import { dailyHadith, bookTitle } from "../scripts/hadith.js";
import { bootstrapI18n, t } from "../scripts/i18n.js";
import { bootstrapTheme } from "../scripts/theme.js";

await Promise.all([bootstrapTheme(), bootstrapI18n()]);

const els = {
    tableBody: document.getElementById("prayer-times"),
    error: document.getElementById("error"),
    cityLine: document.getElementById("city-line"),
    hijriLine: document.getElementById("hijri-line"),
    countdown: document.getElementById("countdown"),
    countdownName: document.getElementById("countdown-name"),
    countdownValue: document.getElementById("countdown-value"),
    qiblaCard: document.getElementById("qibla-card"),
    qiblaNeedle: document.getElementById("qibla-needle"),
    qiblaDegrees: document.getElementById("qibla-degrees"),
    qiblaStatus: document.getElementById("qibla-status"),
    qiblaCalibrate: document.getElementById("qibla-calibrate"),
    audioMini: document.getElementById("audio-mini"),
    audioMiniToggle: document.getElementById("audio-mini-toggle"),
    audioMiniStop: document.getElementById("audio-mini-stop"),
    audioMiniTitle: document.getElementById("audio-mini-title"),
    audioMiniTime: document.getElementById("audio-mini-time"),
    hadithCard: document.getElementById("hadith-card"),
    hadithCardMeta: document.getElementById("hadith-card-meta"),
    hadithCardArab: document.getElementById("hadith-card-arab"),
    hadithCardId: document.getElementById("hadith-card-id")
};

let countdownTimer = null;

(async function init() {
    try {
        const settings = await getSettings();
        els.cityLine.textContent = `${t("popup.cityFallback")} · ${settings.location.city}, ${settings.location.country}`;

        const data = await fetchTimings(settings.location);
        if (!data?.timings || typeof data.timings.Fajr !== "string") {
            throw new Error("fetchTimings returned malformed payload");
        }
        els.hijriLine.textContent = formatDateLine(data.date);
        renderTable(data.timings);
        startCountdown(data.timings);

        if (data.meta?.latitude !== undefined && data.meta?.longitude !== undefined) {
            renderQibla(data.meta.latitude, data.meta.longitude).catch(console.error);
        }

        // Hadith of the Day — non-blocking; failure just hides the card.
        renderDailyHadith(settings.hadith.defaultBook).catch((err) => {
            console.warn("dailyHadith failed:", err);
            els.hadithCard.hidden = true;
        });
    } catch (err) {
        console.error(err);
        els.error.hidden = false;
        els.error.textContent = t("popup.error");
    }
})();

async function renderDailyHadith(book) {
    const { hadith, number } = await dailyHadith(book);
    if (!hadith) return;
    els.hadithCard.hidden = false;
    els.hadithCardMeta.textContent = `${t(`hadith.book.${book}`, bookTitle(book))} #${hadith.number || number}`;
    els.hadithCardArab.textContent = hadith.arab || "";
    els.hadithCardId.textContent = hadith.id || "";
    els.hadithCard.onclick = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(`hadith/hadith.html#${book}:${hadith.number || number}`)
        });
    };
}

function renderTable(timings) {
    els.tableBody.innerHTML = "";
    const now = Date.now();
    const next = findNextPrayer(timings, now);

    for (const name of MAIN_PRAYERS) {
        const hhmm = timings[name];
        if (!hhmm) continue;
        const at = todayAt(hhmm);
        const row = document.createElement("tr");
        if (at < now) row.classList.add("past");
        if (next && name === next.name) row.classList.add("next");
        row.innerHTML = `<td>${t(`prayer.${name}`, name)}</td><td>${cleanTime(hhmm)}</td>`;
        els.tableBody.appendChild(row);
    }
}

function cleanTime(hhmm) {
    return hhmm.split(" ")[0]; // strip "(EET)" etc. for display
}

function startCountdown(timings) {
    if (countdownTimer) clearInterval(countdownTimer);
    const tick = () => {
        const next = findNextPrayer(timings);
        if (!next) {
            els.countdown.hidden = true;
            return;
        }
        els.countdown.hidden = false;
        els.countdownName.textContent = t(`prayer.${next.name}`, next.name);
        els.countdownValue.textContent = formatCountdown(next.at - Date.now());
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
}

const QIBLA_OFFSET_KEY = "qiblaManualOffset";

let qiblaState = {
    bearing: 0,
    heading: 0,        // last known device heading; 0 = facing North
    manualOffset: 0,   // user-applied compass rotation (drag); persisted
    mode: "idle"       // "idle" | "live" | "manual"
};

async function loadManualOffset() {
    const obj = await chrome.storage.local.get(QIBLA_OFFSET_KEY);
    const v = obj[QIBLA_OFFSET_KEY];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function saveManualOffset(offset) {
    chrome.storage.local.set({ [QIBLA_OFFSET_KEY]: offset });
}

async function renderQibla(latitude, longitude) {
    qiblaState.bearing = await fetchQibla(latitude, longitude);
    qiblaState.manualOffset = await loadManualOffset();
    els.qiblaCard.hidden = false;
    els.qiblaDegrees.textContent = `${qiblaState.bearing.toFixed(1)}°`;
    redrawCompass();
    setupDragRotation();        // always available — user can spin the dial
    setupLiveCompass(qiblaState.bearing);
}

function redrawCompass() {
    // Needle points to qibla relative to "where the user is facing".
    // Manual offset spins the entire compass (cardinals + needle) so the
    // user can align it with their physical environment.
    const needleAngle = (qiblaState.bearing - qiblaState.heading + 360) % 360;
    els.qiblaNeedle.setAttribute("transform", `rotate(${needleAngle} 50 50)`);
    document.querySelector(".compass").style.transform =
        `rotate(${qiblaState.manualOffset}deg)`;
}

function setNeedle(angle) {
    qiblaState.heading = (qiblaState.bearing - angle + 360) % 360;
    redrawCompass();
}

function setupDragRotation() {
    const compassEl = document.querySelector(".compass");
    compassEl.classList.add("draggable");
    let drag = null;

    const angleFromCenter = (e) => {
        const r = compassEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    };

    compassEl.addEventListener("pointerdown", (e) => {
        drag = { startAngle: angleFromCenter(e), startOffset: qiblaState.manualOffset };
        compassEl.setPointerCapture(e.pointerId);
        compassEl.classList.add("dragging");
        if (qiblaState.mode === "idle") {
            qiblaState.mode = "manual";
            setQiblaStatus(t("qibla.manual"));
        }
        e.preventDefault();
    });

    compassEl.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const delta = angleFromCenter(e) - drag.startAngle;
        qiblaState.manualOffset = ((drag.startOffset + delta) % 360 + 360) % 360;
        redrawCompass();
    });

    const endDrag = (e) => {
        if (!drag) return;
        try { compassEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        drag = null;
        compassEl.classList.remove("dragging");
        saveManualOffset(qiblaState.manualOffset);
    };
    compassEl.addEventListener("pointerup", endDrag);
    compassEl.addEventListener("pointercancel", endDrag);
}

function setupLiveCompass(qiblaBearing) {
    if (typeof DeviceOrientationEvent === "undefined") {
        setQiblaStatus(t("qibla.dragHint"));
        return;
    }

    const needsPermission = typeof DeviceOrientationEvent.requestPermission === "function";

    if (needsPermission) {
        els.qiblaCalibrate.hidden = false;
        setQiblaStatus(t("qibla.tapEnable"));
        els.qiblaCalibrate.addEventListener("click", async () => {
            try {
                const result = await DeviceOrientationEvent.requestPermission();
                if (result === "granted") {
                    els.qiblaCalibrate.hidden = true;
                    attachOrientation();
                } else {
                    setQiblaStatus(t("qibla.permDenied"));
                }
            } catch (err) {
                console.error(err);
                setQiblaStatus(t("qibla.permDenied"));
            }
        }, { once: true });
    } else {
        attachOrientation();
    }
}

function attachOrientation() {
    let receivedEvent = false;
    setQiblaStatus(t("qibla.calibrating"));

    const handler = (event) => {
        const heading = compassHeadingFromEvent(event);
        if (heading == null) return;
        if (!receivedEvent) {
            receivedEvent = true;
            qiblaState.mode = "live";
            qiblaState.manualOffset = 0;
            document.querySelector(".compass").classList.remove("draggable");
            setQiblaStatus(t("qibla.live"));
        }
        qiblaState.heading = heading;
        redrawCompass();
    };

    const eventName = "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    window.addEventListener(eventName, handler);

    setTimeout(() => {
        if (!receivedEvent) setQiblaStatus(t("qibla.noSensor"));
    }, 3000);
}

function compassHeadingFromEvent(event) {
    // iOS Safari exposes a true-north heading directly.
    if (event.webkitCompassHeading != null) {
        return event.webkitCompassHeading;
    }
    // Standard spec: alpha is rotation around z-axis, counterclockwise from
    // North when `absolute` is true. Convert to clockwise heading.
    if (event.absolute && event.alpha != null) {
        return (360 - event.alpha) % 360;
    }
    return null;
}

function setQiblaStatus(text) {
    els.qiblaStatus.textContent = text;
}

document.getElementById("settings-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

document.getElementById("open-quran").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("reader/reader.html") });
});

document.getElementById("open-hadith").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("hadith/hadith.html") });
});

document.getElementById("open-azkar").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("azkar/azkar.html") });
});

document.getElementById("open-radio").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("radio/radio.html") });
});

// ---------------------------------------------------------------- Audio mini

let audioPlaying = false;

els.audioMiniToggle.addEventListener("click", () => {
    if (audioPlaying) pauseAudio();
    else resumeAudio();
});
els.audioMiniStop.addEventListener("click", () => stopAudio());

onAudioState(applyAudioMini);
getAudioState().then((s) => { if (s) applyAudioMini(s); });

function applyAudioMini(s) {
    audioPlaying = s.playing;
    const hasTrack = (s.surah !== null || s.station !== null) && !s.ended;
    els.audioMini.hidden = !hasTrack;
    if (!hasTrack) return;

    els.audioMiniToggle.textContent = s.playing ? "⏸" : (s.loading ? "…" : "▶");
    els.audioMiniTitle.textContent = s.title || "—";
    if (s.station !== null || !s.duration) {
        // Live stream / unknown duration — show "LIVE" instead of bogus clock.
        els.audioMiniTime.textContent = s.station !== null ? "LIVE" : "—";
    } else {
        els.audioMiniTime.textContent =
            `${formatClock(s.currentTime)} / ${formatClock(s.duration)}`;
    }
}

function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
}

window.addEventListener("unload", () => {
    if (countdownTimer) clearInterval(countdownTimer);
});
