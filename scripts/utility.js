// Shared date / time / formatting helpers.

export const MAIN_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

// Aladhan expects DD-MM-YYYY in the path.
export function formatDateAladhan(d = new Date()) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${d.getFullYear()}`;
}

// YYYY-MM-DD for cache keys (sortable, locale-independent within a TZ).
export function localDateKey(d = new Date()) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

// Convert "HH:mm" (Aladhan timing — may include " (TZ)" suffix) into a
// Date.now()-comparable timestamp for today.
export function todayAt(hhmm) {
    const clean = hhmm.split(" ")[0]; // strip "(EET)" etc.
    const [h, m] = clean.split(":").map((n) => parseInt(n, 10));
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
}

// Timestamp of 00:05 the next local day — used to pre-fetch tomorrow's timings.
export function nextLocalMidnightPlus5() {
    const d = new Date();
    d.setHours(24, 5, 0, 0);
    return d.getTime();
}

// Returns the next-upcoming prayer { name, at } today, or null if all are past.
export function findNextPrayer(timings, now = Date.now()) {
    let next = null;
    for (const name of MAIN_PRAYERS) {
        const hhmm = timings[name];
        if (!hhmm) continue;
        const at = todayAt(hhmm);
        if (at > now && (next === null || at < next.at)) {
            next = { name, at };
        }
    }
    return next;
}

// Popup-style countdown: "1h 45m" / "12m 03s" / "now".
export function formatCountdown(ms) {
    if (ms <= 0) return "now";
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${seconds}s`;
}

// Toolbar-badge formatting — at most 4 chars Chrome reliably renders.
export function formatBadge(ms) {
    if (ms <= 0) return "";
    const totalMin = Math.ceil(ms / 60_000);
    if (totalMin < 60) return `${totalMin}m`;
    const hours = Math.floor(totalMin / 60);
    return `${hours}h`;
}

// "14 Dhū al-Qaʿdah 1447 AH"
export function formatHijri(hijri) {
    if (!hijri) return "";
    const day = hijri.day || "";
    const month = hijri.month?.en || "";
    const year = hijri.year || "";
    return `${day} ${month} ${year} AH`.trim();
}

// "Saturday · 14 Dhū al-Qaʿdah 1447 AH"
export function formatDateLine(date) {
    if (!date) return "";
    const weekday = date.gregorian?.weekday?.en || "";
    const hijri = formatHijri(date.hijri);
    return weekday && hijri ? `${weekday} · ${hijri}` : (hijri || weekday);
}
