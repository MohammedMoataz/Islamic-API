// data-rosy.vercel.app radio station list wrapper.

import { cacheGet, cacheSet } from "./cache.js";
import { withRetry } from "./retry.js";

const RADIO_TTL = 24 * 60 * 60 * 1000;

// Returns [{ name, url }, ...].
export async function fetchStations() {
    const cached = await cacheGet("radio:list");
    if (Array.isArray(cached) && cached.length) return cached;

    try {
        const stations = await withRetry(async () => {
            const res = await fetch("https://data-rosy.vercel.app/radio.json");
            if (!res.ok) throw new Error(`Radio request failed: ${res.status}`);
            const json = await res.json();
            const raw = Array.isArray(json) ? json : (json?.radios ?? json?.data ?? []);
            if (!Array.isArray(raw)) throw new Error("Malformed radio response");
            const list = raw
                .map((s) => ({
                    name: String(s.name ?? s.title ?? "").trim(),
                    url:  String(s.url  ?? s.stream ?? "").trim()
                }))
                .filter((s) => s.name && s.url);
            if (!list.length) throw new Error("No stations in radio response");
            return list;
        });
        await cacheSet("radio:list", stations, RADIO_TTL);
        return stations;
    } catch (err) {
        const stale = await cacheGet("radio:list", { staleOk: true });
        if (Array.isArray(stale) && stale.length) return stale;
        throw err;
    }
}
