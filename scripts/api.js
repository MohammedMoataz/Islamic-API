// Thin fetch wrappers for the APIs catalogued in README.md.
// Each call goes through the TTL cache before hitting the network.

import { cacheGet, cacheSet } from "./cache.js";
import { formatDateAladhan, localDateKey } from "./utility.js";

const TIMINGS_TTL = 24 * 60 * 60 * 1000; // 24 h

export async function fetchTimings({ city, country, method }, date = new Date()) {
    const dateStr = formatDateAladhan(date);
    const cacheKey = `timings:${city}:${country}:${method}:${localDateKey(date)}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const url =
        `https://api.aladhan.com/v1/timingsByCity/${dateStr}` +
        `?city=${encodeURIComponent(city)}` +
        `&country=${encodeURIComponent(country)}` +
        `&method=${encodeURIComponent(method)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Aladhan timings request failed: ${res.status}`);
    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) throw new Error("Malformed Aladhan response");

    await cacheSet(cacheKey, timings, TIMINGS_TTL);
    return timings;
}
