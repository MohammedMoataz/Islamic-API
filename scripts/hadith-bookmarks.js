// Per-hadith bookmarks, persisted in chrome.storage.sync.

const KEY = "hadithBookmarks";
const MAX = 200;

export async function getBookmarks() {
    const obj = await chrome.storage.sync.get(KEY);
    return Array.isArray(obj[KEY]) ? obj[KEY] : [];
}

export async function isBookmarked(book, number) {
    const list = await getBookmarks();
    return list.some((b) => b.book === book && b.number === number);
}

export async function addBookmark(book, number) {
    const list = await getBookmarks();
    if (list.some((b) => b.book === book && b.number === number)) return list;
    const next = [{ book, number, addedAt: Date.now() }, ...list].slice(0, MAX);
    await chrome.storage.sync.set({ [KEY]: next });
    return next;
}

export async function removeBookmark(book, number) {
    const list = await getBookmarks();
    const next = list.filter((b) => !(b.book === book && b.number === number));
    await chrome.storage.sync.set({ [KEY]: next });
    return next;
}

export async function toggleBookmark(book, number) {
    return (await isBookmarked(book, number))
        ? removeBookmark(book, number)
        : addBookmark(book, number);
}
