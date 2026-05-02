// Per-ayah bookmarks, persisted in chrome.storage.sync so they roam.
// Capped at 200 entries to stay under sync's 8 KB-per-key limit.

const KEY = "bookmarks";
const MAX = 200;

export async function getBookmarks() {
    const obj = await chrome.storage.sync.get(KEY);
    return Array.isArray(obj[KEY]) ? obj[KEY] : [];
}

export async function isBookmarked(surah, ayah) {
    const list = await getBookmarks();
    return list.some((b) => b.surah === surah && b.ayah === ayah);
}

export async function addBookmark(surah, ayah) {
    const list = await getBookmarks();
    if (list.some((b) => b.surah === surah && b.ayah === ayah)) return list;
    const next = [{ surah, ayah, addedAt: Date.now() }, ...list].slice(0, MAX);
    await chrome.storage.sync.set({ [KEY]: next });
    return next;
}

export async function removeBookmark(surah, ayah) {
    const list = await getBookmarks();
    const next = list.filter((b) => !(b.surah === surah && b.ayah === ayah));
    await chrome.storage.sync.set({ [KEY]: next });
    return next;
}

export async function toggleBookmark(surah, ayah) {
    return (await isBookmarked(surah, ayah))
        ? removeBookmark(surah, ayah)
        : addBookmark(surah, ayah);
}
