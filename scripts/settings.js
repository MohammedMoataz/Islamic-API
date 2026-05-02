// User settings persisted in chrome.storage.sync (so they roam across devices).

export const DEFAULT_SETTINGS = {
    location: { city: "Cairo", country: "Egypt", method: 5 },
    notifications: { enabled: true, preMinutes: 5 }
};

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
