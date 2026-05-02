// Tiny TTL cache backed by chrome.storage.local.

export async function cacheGet(key) {
    const all = await chrome.storage.local.get(key);
    const entry = all[key];
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await chrome.storage.local.remove(key);
        return null;
    }
    return entry.value;
}

export async function cacheSet(key, value, ttlMs) {
    await chrome.storage.local.set({
        [key]: {
            value,
            expiresAt: ttlMs ? Date.now() + ttlMs : null
        }
    });
}
