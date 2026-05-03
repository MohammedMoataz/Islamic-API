// Wrappers around api.alquran.cloud (Arabic text) and quranenc.com (tafsir).
// Each call goes through the TTL cache; network requests retry on transient
// failures and fall back to stale cache on terminal failure.

import { cacheGet, cacheSet } from "./cache.js";
import { withRetry } from "./retry.js";

const SURAH_LIST_TTL = 365 * 24 * 60 * 60 * 1000;
const SURAH_TTL      = 30  * 24 * 60 * 60 * 1000;
const TAFSIR_TTL     = 30  * 24 * 60 * 60 * 1000;

export async function fetchSurahList() {
    const key = "surah-list";
    const cached = await cacheGet(key);
    if (Array.isArray(cached) && cached.length === 114) return cached;

    try {
        const surahs = await withRetry(async () => {
            const res = await fetch("https://api.alquran.cloud/v1/meta");
            if (!res.ok) throw new Error(`Surah list request failed: ${res.status}`);
            const json = await res.json();
            const list = json?.data?.surahs?.references;
            if (!Array.isArray(list)) throw new Error("Malformed surah list response");
            return list;
        });
        await cacheSet(key, surahs, SURAH_LIST_TTL);
        return surahs;
    } catch (err) {
        const stale = await cacheGet(key, { staleOk: true });
        if (Array.isArray(stale) && stale.length === 114) return stale;
        throw err;
    }
}

export async function fetchSurah(number) {
    const key = `surah:${number}`;
    const cached = await cacheGet(key);
    if (cached && Array.isArray(cached.ayahs)) return cached;

    try {
        const data = await withRetry(async () => {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}`);
            if (!res.ok) throw new Error(`Surah ${number} request failed: ${res.status}`);
            const json = await res.json();
            const d = json?.data;
            if (!d?.ayahs) throw new Error("Malformed surah response");
            return d;
        });
        await cacheSet(key, data, SURAH_TTL);
        return data;
    } catch (err) {
        const stale = await cacheGet(key, { staleOk: true });
        if (stale?.ayahs) return stale;
        throw err;
    }
}

export async function fetchTafsir(slug, surah) {
    const key = `tafsir:${slug}:${surah}`;
    const cached = await cacheGet(key);
    if (Array.isArray(cached)) return cached;

    try {
        const normalised = await withRetry(async () => {
            const res = await fetch(`https://quranenc.com/api/v1/translation/sura/${slug}/${surah}`);
            if (!res.ok) throw new Error(`Tafsir ${slug}/${surah} request failed: ${res.status}`);
            const json = await res.json();
            const result = json?.result;
            if (!Array.isArray(result)) throw new Error("Malformed tafsir response");
            return result.map((row) => ({
                aya: Number(row.aya ?? row.aya_num ?? row.ayaNumber),
                translation: String(row.translation ?? "")
            }));
        });
        await cacheSet(key, normalised, TAFSIR_TTL);
        return normalised;
    } catch (err) {
        const stale = await cacheGet(key, { staleOk: true });
        if (Array.isArray(stale)) return stale;
        throw err;
    }
}
