// hadis-api-id.vercel.app wrappers + Hadith of the Day picker.

import { cacheGet, cacheSet } from "./cache.js";
import { HADITH_BOOKS } from "./settings.js";
import { localDateKey } from "./utility.js";

const PAGE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const PAGE_SIZE = 300;                    // hadiths per network call
export const UI_PAGE_SIZE = 20;           // hadiths shown at a time in the browser UI

// Fetch one 300-hadith page from the upstream and cache it.
// Backed by api.hadith.gading.dev which uses ?range=START-END (1-based,
// inclusive) instead of page+limit.
//   Returns: { number, name, available, requested, hadiths: [{ number, arab, id }] }
export async function fetchHadithPage(book, networkPage) {
    const key = `hadith:gading:${book}:${networkPage}`;
    const cached = await cacheGet(key);
    if (cached && Array.isArray(cached.hadiths)) return cached;

    const startNumber = (networkPage - 1) * PAGE_SIZE + 1;
    const endNumber = networkPage * PAGE_SIZE;
    const url =
        `https://api.hadith.gading.dev/books/${encodeURIComponent(book)}` +
        `?range=${startNumber}-${endNumber}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hadith ${book} p.${networkPage} failed: ${res.status}`);
    const json = await res.json();
    const data = json?.data ?? json;
    const hadiths = data?.hadiths ?? [];
    if (!Array.isArray(hadiths)) throw new Error("Malformed hadith response");

    const normalised = {
        number: data?.number ?? null,
        name:   data?.name ?? bookTitle(book),
        available: data?.available ?? null,
        requested: data?.requested ?? hadiths.length,
        hadiths: hadiths.map((h) => ({
            number: Number(h.number ?? 0),
            arab:   String(h.arab ?? ""),
            id:     String(h.id ?? "")
        }))
    };

    await cacheSet(key, normalised, PAGE_TTL);
    return normalised;
}

// Fetch a specific hadith by its 1-based number across the whole collection.
export async function fetchHadithByNumber(book, n) {
    const networkPage = Math.ceil(n / PAGE_SIZE);
    const slot = (n - 1) % PAGE_SIZE;
    const page = await fetchHadithPage(book, networkPage);
    const candidate = page.hadiths[slot];
    if (candidate?.number === n) return candidate;
    // Some collections aren't perfectly contiguous; do a linear scan as fallback.
    return page.hadiths.find((h) => h.number === n) ?? candidate ?? null;
}

// Deterministic "hadith of the day" — same hadith for the whole local day.
export async function dailyHadith(book, date = new Date()) {
    const total = bookTotal(book);
    const dateKey = localDateKey(date);
    const n = (djb2(dateKey) % total) + 1;
    const hadith = await fetchHadithByNumber(book, n);
    return { hadith, number: n, book, dateKey };
}

export function bookTotal(book) {
    return HADITH_BOOKS.find((b) => b.slug === book)?.total ?? 1000;
}

export function bookTitle(book) {
    return HADITH_BOOKS.find((b) => b.slug === book)?.name ?? book;
}

// Bernstein djb2 — stable, locale-independent, fits in 32 bits.
function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
