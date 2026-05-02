// User settings persisted in chrome.storage.sync (so they roam across devices).

export const DEFAULT_SETTINGS = {
    location: { city: "Cairo", country: "Egypt", method: 5 },
    notifications: { enabled: true, preMinutes: 5 },
    quran: { tafsirSlug: "arabic_moyassar", showTafsirByDefault: false }
};

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
