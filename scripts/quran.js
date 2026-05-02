// Wrappers around api.alquran.cloud (Arabic text) and quranenc.com (tafsir).
// Each call goes through the TTL cache before hitting the network.

import { cacheGet, cacheSet } from "./cache.js";

const SURAH_LIST_TTL = 365 * 24 * 60 * 60 * 1000;
const SURAH_TTL      = 30  * 24 * 60 * 60 * 1000;
const TAFSIR_TTL     = 30  * 24 * 60 * 60 * 1000;

// Index of all 114 surahs:
//   [{ number, name, englishName, englishNameTranslation, numberOfAyahs, revelationType }, ...]
export async function fetchSurahList() {
    const cached = await cacheGet("surah-list");
    if (Array.isArray(cached) && cached.length === 114) return cached;

    const res = await fetch("https://api.alquran.cloud/v1/meta");
    if (!res.ok) throw new Error(`Surah list request failed: ${res.status}`);
    const json = await res.json();
    const surahs = json?.data?.surahs?.references;
    if (!Array.isArray(surahs)) throw new Error("Malformed surah list response");

    await cacheSet("surah-list", surahs, SURAH_LIST_TTL);
    return surahs;
}

// Single surah:
//   { number, name, englishName, englishNameTranslation, revelationType,
//     numberOfAyahs, ayahs: [{ numberInSurah, text, ... }] }
export async function fetchSurah(number) {
    const key = `surah:${number}`;
    const cached = await cacheGet(key);
    if (cached && Array.isArray(cached.ayahs)) return cached;

    const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}`);
    if (!res.ok) throw new Error(`Surah ${number} request failed: ${res.status}`);
    const json = await res.json();
    const data = json?.data;
    if (!data?.ayahs) throw new Error("Malformed surah response");

    await cacheSet(key, data, SURAH_TTL);
    return data;
}

// Tafsir for an entire surah, returned as an array indexed by ayah number:
//   [{ aya: 1, translation: "..." }, { aya: 2, translation: "..." }, ...]
export async function fetchTafsir(slug, surah) {
    const key = `tafsir:${slug}:${surah}`;
    const cached = await cacheGet(key);
    if (Array.isArray(cached)) return cached;

    const res = await fetch(`https://quranenc.com/api/v1/translation/sura/${slug}/${surah}`);
    if (!res.ok) throw new Error(`Tafsir ${slug}/${surah} request failed: ${res.status}`);
    const json = await res.json();
    const result = json?.result;
    if (!Array.isArray(result)) throw new Error("Malformed tafsir response");

    // Normalise to { aya, translation } since quranenc varies field names slightly.
    const normalised = result.map((row) => ({
        aya: Number(row.aya ?? row.aya_num ?? row.ayaNumber),
        translation: String(row.translation ?? "")
    }));

    await cacheSet(key, normalised, TAFSIR_TTL);
    return normalised;
}
