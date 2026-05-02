import { getSettings } from "../scripts/settings.js";
import { fetchTimings, fetchQibla } from "../scripts/api.js";
import {
    todayAt,
    findNextPrayer,
    formatCountdown,
    formatDateLine,
    MAIN_PRAYERS
} from "../scripts/utility.js";

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
    qiblaCalibrate: document.getElementById("qibla-calibrate")
};

let countdownTimer = null;

(async function init() {
    try {
        const settings = await getSettings();
        els.cityLine.textContent = `${settings.location.city}, ${settings.location.country}`;

        const data = await fetchTimings(settings.location);
        els.hijriLine.textContent = formatDateLine(data.date);
        renderTable(data.timings);
        startCountdown(data.timings);

        if (data.meta?.latitude !== undefined && data.meta?.longitude !== undefined) {
            renderQibla(data.meta.latitude, data.meta.longitude).catch(console.error);
        }
    } catch (err) {
        console.error(err);
        els.error.hidden = false;
        els.error.textContent = "Failed to load prayer times. Check your connection or settings.";
    }
})();

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
        row.innerHTML = `<td>${name}</td><td>${cleanTime(hhmm)}</td>`;
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
        els.countdownName.textContent = next.name;
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
            setQiblaStatus("Manual — drag to align");
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
        setQiblaStatus("Drag to align");
        return;
    }

    // iOS 13+ requires explicit permission from a user gesture.
    const needsPermission = typeof DeviceOrientationEvent.requestPermission === "function";

    if (needsPermission) {
        els.qiblaCalibrate.hidden = false;
        setQiblaStatus("Tap to enable live compass");
        els.qiblaCalibrate.addEventListener("click", async () => {
            try {
                const result = await DeviceOrientationEvent.requestPermission();
                if (result === "granted") {
                    els.qiblaCalibrate.hidden = true;
                    attachOrientation();
                } else {
                    setQiblaStatus("Permission denied — drag to align");
                }
            } catch (err) {
                console.error(err);
                setQiblaStatus("Permission failed — drag to align");
            }
        }, { once: true });
    } else {
        // Android / desktop: try silently. If sensors absent, drag fallback stays.
        attachOrientation();
    }
}

function attachOrientation() {
    let receivedEvent = false;
    setQiblaStatus("Calibrating…");

    const handler = (event) => {
        const heading = compassHeadingFromEvent(event);
        if (heading == null) return;
        if (!receivedEvent) {
            receivedEvent = true;
            qiblaState.mode = "live";
            qiblaState.manualOffset = 0; // sensor takes over
            document.querySelector(".compass").classList.remove("draggable");
            setQiblaStatus("Live");
        }
        qiblaState.heading = heading;
        redrawCompass();
    };

    const eventName = "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    window.addEventListener(eventName, handler);

    setTimeout(() => {
        if (!receivedEvent) setQiblaStatus("Drag to align (no sensor)");
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

window.addEventListener("unload", () => {
    if (countdownTimer) clearInterval(countdownTimer);
});
