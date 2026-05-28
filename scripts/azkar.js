// Wraps the Nawaf-Al-Qari azkar bundle and the per-day counter store.

import { cacheGet, cacheSet } from "./cache.js";
import { localDateKey } from "./utility.js";
import { withRetry } from "./retry.js";

const AZKAR_URL =
    "https://raw.githubusercontent.com/nawafalqari/azkar-api/" +
    "56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json";

const AZKAR_TTL = 30 * 24 * 60 * 60 * 1000;
const COUNTS_KEY = "azkarCounts";

// Returns:
//   [
//     { category: "أذكار الصباح",
//       items: [{ zekr, count, description, reference }, ...] },
//     ...
//   ]
// Normalises both the object-of-arrays and array-of-objects shapes the
// upstream has used at different times.
export async function fetchAzkar() {
    const cached = await cacheGet("azkar:nawaf");
    if (Array.isArray(cached) && cached.length > 0 && cached[0].items) return cached;

    try {
        const grouped = await withRetry(async () => {
            const res = await fetch(AZKAR_URL);
            if (!res.ok) throw new Error(`Azkar fetch failed: ${res.status}`);
            const json = await res.json();
            const arr = normalise(json);
            if (!arr.length) throw new Error("Malformed azkar response");
            return arr;
        });
        await cacheSet("azkar:nawaf", grouped, AZKAR_TTL);
        return grouped;
    } catch (err) {
        const stale = await cacheGet("azkar:nawaf", { staleOk: true });
        if (Array.isArray(stale) && stale.length > 0 && stale[0].items) return stale;
        throw err;
    }
}

function normalise(json) {
    // Shape A — { "أذكار الصباح": [ {category, count, zekr, ...}, ... ], ... }
    if (json && typeof json === "object" && !Array.isArray(json)) {
        return Object.entries(json).map(([category, items]) => ({
            category,
            items: (items || []).map(normaliseItem)
        }));
    }
    // Shape B — [ {category, count, zekr, ...}, ... ]
    if (Array.isArray(json)) {
        const buckets = new Map();
        for (const raw of json) {
            const cat = raw.category || raw.title || "Other";
            if (!buckets.has(cat)) buckets.set(cat, []);
            buckets.get(cat).push(normaliseItem(raw));
        }
        return [...buckets.entries()].map(([category, items]) => ({ category, items }));
    }
    return [];
}

function normaliseItem(raw) {
    if (!raw || typeof raw !== "object") return { zekr: "", count: 1, description: "", reference: "" };

    const zekr = pickString(raw, [
        "zekr", "text", "content", "dhikr", "arabic", "arab", "body", "ar",
        "الذكر", "النص", "نص", "الزكر"
    ]);
    const description = pickString(raw, [
        "description", "desc", "note", "info", "title", "name",
        "الوصف", "الاسم"
    ]);
    const reference = pickString(raw, [
        "reference", "source", "ref", "narrator", "hadith",
        "المرجع", "المصدر"
    ]);
    const count = parseCount(raw.count ?? raw.repetitions ?? raw.times ?? raw.repeat ?? raw.vc ?? raw.العدد ?? raw.المرات);

    return { zekr, count, description, reference };
}

function pickString(obj, keys) {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return cleanText(v);
        if (Array.isArray(v) && v.length) {
            return cleanText(v.map((x) => String(x)).join(" "));
        }
        if (v && typeof v === "object") {
            // Some sources nest by language: { ar: "...", en: "..." }
            if (typeof v.ar === "string" && v.ar.trim()) return cleanText(v.ar);
            if (typeof v.text === "string" && v.text.trim()) return cleanText(v.text);
        }
    }
    return "";
}

// Normalises arbitrarily-mangled upstream text into one clean paragraph.
//
// Handles the common upstream pathologies:
//   - Real newlines / tabs / carriage returns → single space.
//   - Literal "\n", "\r", "\t" escape sequences (where the serialiser left
//     the backslash + letter as two separate characters) → single space.
//   - Python-list-as-string artifacts: ['\n', '"actual text". [ref]\n', '\n']
//     → strip the brackets, pull out each single-quoted item, discard the
//       items that are pure whitespace / "\n" markers, join the rest.
//   - Stray leading / trailing quotes left over from the list serialisation.
function cleanText(s) {
    let str = String(s);

    // 1) Drop outer Python-list brackets if present.
    const trimmed = str.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        str = trimmed.slice(1, -1);
    }

    // 2) If the value still looks like a Python-list serialisation (single-
    //    quoted items separated by commas), extract each item and drop the
    //    junk ones.
    //
    //    Some upstream entries (e.g. categories "أدعية قرآنية" and
    //    "أدعية الأنبياء") store the dhikr like
    //      "\n', '\"text…\". [ref]\n', '\n', '\n', '\n', '"
    //    Naive cleanup yields a salad of "," fragments. Require each surviving
    //    item to contain at least one letter (Arabic or Latin), otherwise it's
    //    just leftover separator characters.
    if (/'\s*,\s*'/.test(str)) {
        const items = [...str.matchAll(/'((?:\\'|[^'])*)'/g)].map((m) => m[1]);
        if (items.length) {
            const cleaned = items
                .map((it) => it
                    .replace(/\\n/g, " ")
                    .replace(/\\r/g, " ")
                    .replace(/\\t/g, " ")
                    .replace(/\\"/g, '"')
                    .replace(/[\r\n\t]+/g, " ")
                    .trim()
                )
                .filter((it) => /[؀-ۿA-Za-z]/.test(it));
            str = cleaned.join(" ");
        }
    }

    // 3) Final cleanup pass for anything that didn't go through the list path.
    return str
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\\"/g, '"')
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[\s'"]+|[\s'"]+$/g, "")
        .trim();
}

function parseCount(raw) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw !== "string") return 1;
    // Numeric digits anywhere in the string win.
    const m = raw.match(/\d+/);
    if (m) return Math.max(1, parseInt(m[0], 10));
    // Arabic word forms — covers the most common azkar counts.
    const t = raw.replace(/\s+/g, "");
    if (t.includes("مرتين") || t.includes("مرتان")) return 2;
    if (t.includes("ثلاث"))  return 3;
    if (t.includes("أربع") || t.includes("اربع")) return 4;
    if (t.includes("خمس"))   return 5;
    if (t.includes("ست"))    return 6;
    if (t.includes("سبع"))   return 7;
    if (t.includes("ثمان"))  return 8;
    if (t.includes("تسع"))   return 9;
    if (t.includes("عشر"))   return 10;
    if (t.includes("مئة") || t.includes("مائة")) return 100;
    return 1; // single repetition
}

// ---------------------------------------------------------- Counter store

// Shape: { date: "YYYY-MM-DD", counts: { "category:index": remaining } }
async function readStore() {
    const obj = await chrome.storage.local.get(COUNTS_KEY);
    return obj[COUNTS_KEY] || { date: null, counts: {} };
}

async function writeStore(store) {
    await chrome.storage.local.set({ [COUNTS_KEY]: store });
}

// Returns the per-day counts map after rolling over if the local day has changed.
export async function getCounts() {
    const today = localDateKey();
    let store = await readStore();
    if (store.date !== today) {
        store = { date: today, counts: {} };
        await writeStore(store);
    }
    return store.counts;
}

export async function setCount(category, index, remaining) {
    const today = localDateKey();
    const store = await readStore();
    const counts = store.date === today ? { ...store.counts } : {};
    counts[`${category}:${index}`] = remaining;
    await writeStore({ date: today, counts });
}

export async function resetCount(category, index) {
    const store = await readStore();
    if (!store?.counts) return;
    const key = `${category}:${index}`;
    if (key in store.counts) {
        const next = { ...store.counts };
        delete next[key];
        await writeStore({ date: store.date, counts: next });
    }
}

export function countKey(category, index) {
    return `${category}:${index}`;
}

// Bulk reset every counter for a single category in one storage write.
export async function resetCategory(category) {
    const store = await readStore();
    if (!store?.counts) return;
    const next = { ...store.counts };
    let changed = false;
    const prefix = `${category}:`;
    for (const k of Object.keys(next)) {
        if (k.startsWith(prefix)) {
            delete next[k];
            changed = true;
        }
    }
    if (changed) await writeStore({ date: store.date, counts: next });
}

// ---------------------------------------------------------- Notified store
//
// Tracks which dhikrs the service worker has already surfaced via a reminder
// notification today. Used so morning/evening reminders cycle through the
// category instead of re-firing the same random dhikr, and so we can mark a
// notified dhikr as "done" in the counter store at the same time.
//
// Shape: { date: "YYYY-MM-DD", sets: { morning: [3, 7], evening: [1] } }

const NOTIFIED_KEY = "azkarNotified";

async function readNotifiedStore() {
    const obj = await chrome.storage.local.get(NOTIFIED_KEY);
    return obj[NOTIFIED_KEY] || null;
}

async function writeNotifiedStore(store) {
    await chrome.storage.local.set({ [NOTIFIED_KEY]: store });
}

export async function getNotifiedSet(kind) {
    const today = localDateKey();
    const store = await readNotifiedStore();
    if (!store || store.date !== today) {
        await writeNotifiedStore({ date: today, sets: { morning: [], evening: [] } });
        return new Set();
    }
    return new Set(store.sets?.[kind] || []);
}

export async function markNotified(kind, index) {
    const today = localDateKey();
    let store = await readNotifiedStore();
    if (!store || store.date !== today) {
        store = { date: today, sets: { morning: [], evening: [] } };
    }
    if (!Array.isArray(store.sets[kind])) store.sets[kind] = [];
    if (!store.sets[kind].includes(index)) store.sets[kind].push(index);
    await writeNotifiedStore(store);
}

export async function clearNotifiedKind(kind) {
    const store = await readNotifiedStore();
    if (!store?.sets) return;
    if (Array.isArray(store.sets[kind]) && store.sets[kind].length === 0) return;
    await writeNotifiedStore({
        date: store.date,
        sets: { ...store.sets, [kind]: [] }
    });
}
