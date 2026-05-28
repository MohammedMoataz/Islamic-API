// api.quran.com wrappers for reciter list + chapter MP3 URLs.

import { cacheGet, cacheSet } from "./cache.js";
import { RECITER_FALLBACKS } from "./settings.js";
import { withRetry } from "./retry.js";

const RECITERS_TTL = 30 * 24 * 60 * 60 * 1000;
const AUDIO_TTL    = 30 * 24 * 60 * 60 * 1000;

// `locale` ("en" | "ar") is forwarded to api.quran.com so translated_name.name
// comes back in the user's language. Cache key includes the locale so
// switching language doesn't serve a stale-but-fresh list.
export async function fetchReciters(locale = "en") {
    const lang = locale === "ar" ? "ar" : "en";
    const cacheKey = `reciters:${lang}`;
    const cached = await cacheGet(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) return cached;

    try {
        const list = await withRetry(async () => {
            const res = await fetch(
                `https://api.quran.com/api/v4/resources/recitations?language=${lang}`
            );
            if (!res.ok) throw new Error(`Reciters request failed: ${res.status}`);
            const json = await res.json();
            const arr = json?.recitations;
            if (!Array.isArray(arr) || arr.length === 0) {
                throw new Error("Malformed reciters response");
            }
            return arr;
        });
        await cacheSet(cacheKey, list, RECITERS_TTL);
        return list;
    } catch (err) {
        const stale = await cacheGet(cacheKey, { staleOk: true });
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
