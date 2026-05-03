// api.quran.com wrappers for reciter list + chapter MP3 URLs.

import { cacheGet, cacheSet } from "./cache.js";
import { RECITER_FALLBACKS } from "./settings.js";
import { withRetry } from "./retry.js";

const RECITERS_TTL = 30 * 24 * 60 * 60 * 1000;
const AUDIO_TTL    = 30 * 24 * 60 * 60 * 1000;

export async function fetchReciters() {
    const cached = await cacheGet("reciters");
    if (Array.isArray(cached) && cached.length > 0) return cached;

    try {
        const list = await withRetry(async () => {
            const res = await fetch("https://api.quran.com/api/v4/resources/recitations");
            if (!res.ok) throw new Error(`Reciters request failed: ${res.status}`);
            const json = await res.json();
            const arr = json?.recitations;
            if (!Array.isArray(arr) || arr.length === 0) {
                throw new Error("Malformed reciters response");
            }
            return arr;
        });
        await cacheSet("reciters", list, RECITERS_TTL);
        return list;
    } catch (err) {
        const stale = await cacheGet("reciters", { staleOk: true });
        if (Array.isArray(stale) && stale.length) return stale;
        return RECITER_FALLBACKS;
    }
}

export async function fetchChapterAudio(reciterId, chapter) {
    const key = `audio:${reciterId}:${chapter}`;
    const cached = await cacheGet(key);
    if (cached && typeof cached === "string") return cached;

    try {
        const audioUrl = await withRetry(async () => {
            const res = await fetch(
                `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${chapter}`);
            if (!res.ok) throw new Error(`Chapter audio request failed: ${res.status}`);
            const json = await res.json();
            const u = json?.audio_file?.audio_url;
            if (typeof u !== "string") throw new Error("Malformed chapter audio response");
            return u;
        });
        await cacheSet(key, audioUrl, AUDIO_TTL);
        return audioUrl;
    } catch (err) {
        const stale = await cacheGet(key, { staleOk: true });
        if (typeof stale === "string") return stale;
        throw err;
    }
}
