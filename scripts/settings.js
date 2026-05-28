// User settings persisted in chrome.storage.sync (so they roam across devices).

export const DEFAULT_SETTINGS = {
    location: { city: "Cairo", country: "Egypt", method: 5 },
    notifications: {
        enabled: true,
        preMinutes: 5,
        // Iqama (الإقامة) — typical post-adhan intervals. Defaults match the
        // widely-used Jordanian Awqaf schedule; user can adjust each prayer.
        iqama: {
            enabled: false,
            offsets: { Fajr: 30, Dhuhr: 15, Asr: 15, Maghrib: 5, Isha: 10 }
        }
    },
    quran: { tafsirSlug: "arabic_moyassar", showTafsirByDefault: false },
    audio: { reciterId: 7 },   // Mishary Rashid Alafasy
    hadith: {
        defaultBook: "bukhari",
        dailyNotification: { enabled: true, hour: 15, minute: 0 }
    },
    azkar: {
        reminders: {
            enabled: false,           // opt-in
            avgIntervalMinutes: 180   // mean spacing between reminders within an active window
        }
    },
    language: "en",   // "en" | "ar"
    theme: "auto"     // "auto" | "light" | "dark"
};

// hadis-api-id.vercel.app book slugs + canonical names + collection sizes.
export const HADITH_BOOKS = [
    { slug: "bukhari",    name: "Sahih al-Bukhari",    total: 7563  },
    { slug: "muslim",     name: "Sahih Muslim",        total: 5362  },
    { slug: "abu-dawud",  name: "Sunan Abu Dawud",     total: 4590  },
    { slug: "tirmidzi",   name: "Jami' at-Tirmidhi",   total: 3956  },
    { slug: "nasai",      name: "Sunan an-Nasa'i",     total: 5662  },
    { slug: "ibnu-majah", name: "Sunan Ibn Majah",     total: 4332  },
    { slug: "malik",      name: "Muwatta Malik",       total: 1851  },
    { slug: "ahmad",      name: "Musnad Ahmad",        total: 26363 },
    { slug: "darimi",     name: "Sunan ad-Darimi",     total: 3367  }
];

// Used as a seed when api.quran.com /resources/recitations is unreachable.
// Ids match the canonical v4 reciters; see https://api.quran.com/api/v4/resources/recitations
export const RECITER_FALLBACKS = [
    { id: 1,  reciter_name: "AbdulBaset AbdulSamad",          style: "Mujawwad" },
    { id: 2,  reciter_name: "AbdulBaset AbdulSamad",          style: "Murattal" },
    { id: 3,  reciter_name: "Abdur-Rahman as-Sudais",         style: "Murattal" },
    { id: 4,  reciter_name: "Abu Bakr al-Shatri",             style: "Murattal" },
    { id: 5,  reciter_name: "Hani ar-Rifai",                  style: "Murattal" },
    { id: 6,  reciter_name: "Mahmoud Khalil al-Husary",       style: "Murattal" },
    { id: 7,  reciter_name: "Mishary Rashid al-Afasy",        style: "Murattal" },
    { id: 8,  reciter_name: "Mohamed Siddiq al-Minshawi",     style: "Mujawwad" },
    { id: 9,  reciter_name: "Mohamed Siddiq al-Minshawi",     style: "Murattal" },
    { id: 10, reciter_name: "Sa'ud ash-Shuraim",              style: "Murattal" },
    { id: 12, reciter_name: "Mohammad al-Tablawi",            style: "Murattal" }
];

// Catalogue used by the options page and the reader. Slugs match
// quranenc.com's translation IDs.
export const TAFSIR_EDITIONS = [
    { slug: "arabic_moyassar",       language: "Arabic",     title: "التفسير الميسر (Al-Muyassar)" },
    { slug: "english_saheeh",        language: "English",    title: "Saheeh International" },
    { slug: "english_hilali_khan",   language: "English",    title: "Hilali & Khan" },
    { slug: "urdu_junagarhi",        language: "Urdu",       title: "تفسير جوناگڑھی" },
    { slug: "french_hameedullah",    language: "French",     title: "Muhammad Hamidullah" },
    { slug: "turkish_diyanet",       language: "Turkish",    title: "Diyanet İşleri Vakfı" },
    { slug: "indonesian_complex",    language: "Indonesian", title: "King Fahd Complex" },
    { slug: "bengali_zakaria",       language: "Bengali",    title: "Abu Bakr Zakaria" }
];

export async function getSettings() {
    const { settings } = await chrome.storage.sync.get("settings");
    return mergeDeep(DEFAULT_SETTINGS, settings || {});
}

export async function setSettings(partial) {
    const merged = mergeDeep(await getSettings(), partial);
    await chrome.storage.sync.set({ settings: merged });
    return merged;
}

function mergeDeep(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
        const v = source[key];
        if (v && typeof v === "object" && !Array.isArray(v)) {
            out[key] = mergeDeep(target[key] || {}, v);
        } else {
            out[key] = v;
        }
    }
    return out;
}
