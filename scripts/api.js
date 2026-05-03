// Thin fetch wrappers for the APIs catalogued in README.md.
// Each call goes through the TTL cache before hitting the network.

import { cacheGet, cacheSet } from "./cache.js";
import { formatDateAladhan, localDateKey } from "./utility.js";
import { withRetry } from "./retry.js";

const TIMINGS_TTL = 24 * 60 * 60 * 1000;       // 24 h
const QIBLA_TTL = 30 * 24 * 60 * 60 * 1000;    // 30 days — qibla direction is static per location

// Returns { timings, date, meta }.
//   timings: { Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Imsak, Midnight, ... }
//   date:    { readable, gregorian: { weekday: { en } }, hijri: { day, month: { en, ar }, year } }
//   meta:    { latitude, longitude, timezone, method }
export async function fetchTimings({ city, country, method }, date = new Date()) {
    const dateStr = formatDateAladhan(date);
    // The "v2" segment retires every cache entry written before the Phase-1
    // shape change so we can never accidentally trust a stale Phase-0 dict.
    const cacheKey = `timings:v2:${city}:${country}:${method}:${localDateKey(date)}`;

    const cached = await cacheGet(cacheKey);
    if (isValidTimingsCache(cached)) return cached;

    const url =
        `https://api.aladhan.com/v1/timingsByCity/${dateStr}` +
        `?city=${encodeURIComponent(city)}` +
        `&country=${encodeURIComponent(country)}` +
        `&method=${encodeURIComponent(method)}`;

    const result = await withRetry(async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Aladhan timings request failed: ${res.status}`);
        const json = await res.json();
        const data = json?.data;
        if (!data?.timings) throw new Error("Malformed Aladhan response");
        return { timings: data.timings, date: data.date, meta: data.meta };
    });

    await cacheSet(cacheKey, result, TIMINGS_TTL);
    return result;
}

// Wrapper used by non-critical callers (toolbar badge) — falls back to a
// stale cache entry when the network is unreachable, so a flaky connection
// doesn't blank the UI.
export async function fetchTimingsStaleOk(location, date = new Date()) {
    try {
        return await fetchTimings(location, date);
    } catch (err) {
        const dateStr = `${location.city}:${location.country}:${location.method}:${localDateKey(date)}`;
        const cacheKey = `timings:v2:${dateStr}`;
        const stale = await cacheGet(cacheKey, { staleOk: true });
        if (isValidTimingsCache(stale)) return stale;
        throw err;
    }
}

function isValidTimingsCache(cached) {
    return (
        cached &&
        typeof cached === "object" &&
        cached.timings &&
        typeof cached.timings === "object" &&
        typeof cached.timings.Fajr === "string" &&
        cached.date &&
        cached.meta
    );
}

// Returns the qibla bearing in degrees clockwise from True North.
export async function fetchQibla(latitude, longitude) {
    const lat = Number(latitude).toFixed(2);
    const lng = Number(longitude).toFixed(2);
    const cacheKey = `qibla:${lat}:${lng}`;

    const cached = await cacheGet(cacheKey);
    if (cached !== null) return cached;

    const url = `https://api.aladhan.com/v1/qibla/${lat}/${lng}`;
    const direction = await withRetry(async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Aladhan qibla request failed: ${res.status}`);
        const json = await res.json();
        const d = json?.data?.direction;
        if (typeof d !== "number") throw new Error("Malformed qibla response");
        return d;
    });

    await cacheSet(cacheKey, direction, QIBLA_TTL);
    return direction;
}
