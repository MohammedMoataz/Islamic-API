// Shared date / time helpers.

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

// Convert "HH:mm" (Aladhan timing) into a Date.now()-comparable timestamp for today.
export function todayAt(hhmm) {
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
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
