// api.quran.com wrappers for reciter list + chapter MP3 URLs.

import { cacheGet, cacheSet } from "./cache.js";
import { RECITER_FALLBACKS } from "./settings.js";

const RECITERS_TTL = 30 * 24 * 60 * 60 * 1000;
const AUDIO_TTL    = 30 * 24 * 60 * 60 * 1000;

// Returns [{ id, reciter_name, style, translated_name }, ...].
// Falls back to a hardcoded list if the network is unreachable.
export async function fetchReciters() {
    const cached = await cacheGet("reciters");
    if (Array.isArray(cached) && cached.length > 0) return cached;

    try {
        const res = await fetch("https://api.quran.com/api/v4/resources/recitations");
        if (!res.ok) throw new Error(`Reciters request failed: ${res.status}`);
        const json = await res.json();
        const list = json?.recitations;
        if (!Array.isArray(list) || list.length === 0) {
            throw new Error("Malformed reciters response");
        }
        await cacheSet("reciters", list, RECITERS_TTL);
        return list;
    } catch (err) {
        console.warn("fetchReciters falling back:", err);
        return RECITER_FALLBACKS;
    }
}

// Returns the MP3 url for one chapter from one reciter.
export async function fetchChapterAudio(reciterId, chapter) {
    const key = `audio:${reciterId}:${chapter}`;
    const cached = await cacheGet(key);
    if (cached && typeof cached === "string") return cached;

    const url =
        `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${chapter}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Chapter audio request failed: ${res.status}`);
    const json = await res.json();
    const audioUrl = json?.audio_file?.audio_url;
    if (typeof audioUrl !== "string") throw new Error("Malformed chapter audio response");

    await cacheSet(key, audioUrl, AUDIO_TTL);
    return audioUrl;
}
