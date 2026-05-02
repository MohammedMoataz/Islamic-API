// Last-read tracker — local (per device), since "where I left off reading"
// is more device-bound than user-bound.

const KEY = "lastRead";

export async function getLastRead() {
    const obj = await chrome.storage.local.get(KEY);
    const v = obj[KEY];
    if (v && Number.isInteger(v.surah) && Number.isInteger(v.ayah)) return v;
    return null;
}

export async function setLastRead(surah, ayah) {
    await chrome.storage.local.set({
        [KEY]: { surah, ayah, ts: Date.now() }
    });
}

export async function clearLastRead() {
    await chrome.storage.local.remove(KEY);
}
