import {
    fetchHadithPage, fetchHadithByNumber, bookTitle, bookTotal,
    UI_PAGE_SIZE
} from "../scripts/hadith.js";
import { HADITH_BOOKS, getSettings } from "../scripts/settings.js";
import {
    getBookmarks, isBookmarked, toggleBookmark
} from "../scripts/hadith-bookmarks.js";
import { bootstrapI18n, t } from "../scripts/i18n.js";
import { bootstrapTheme } from "../scripts/theme.js";

await Promise.all([bootstrapTheme(), bootstrapI18n()]);

const NETWORK_PAGE_SIZE = 300;

const els = {
    bookList: document.getElementById("book-list"),
    bookmarksList: document.getElementById("bookmarks-list"),
    bookmarksCount: document.getElementById("bookmarks-count"),
    bookHeader: document.getElementById("book-header"),
    bookTitleEl: document.getElementById("book-title"),
    bookMeta: document.getElementById("book-meta"),
    pager: document.getElementById("pager"),
    pagePrev: document.getElementById("page-prev"),
    pageNext: document.getElementById("page-next"),
    pageInfo: document.getElementById("page-info"),
    list: document.getElementById("hadiths"),
    error: document.getElementById("hadith-error"),
    loading: document.getElementById("hadith-loading"),
    openOptions: document.getElementById("open-options")
};

const state = {
    currentBook: null,    // slug
    uiPage: 1,            // 1-based UI page (20 hadiths each)
    bookmarks: []
};

(async function init() {
    const [settings, bookmarks] = await Promise.all([getSettings(), getBookmarks()]);
    state.bookmarks = bookmarks;

    renderBookList();
    renderBookmarks();

    const fromHash = parseHash();
    const startBook = fromHash?.book || settings.hadith.defaultBook;
    const startNumber = fromHash?.number ?? null;

    if (startNumber) {
        const uiPage = Math.ceil(startNumber / UI_PAGE_SIZE);
        await openBook(startBook, uiPage);
        scrollToHadith(startNumber, true);
    } else {
        await openBook(startBook, 1);
    }
})();

// --------------------------------------------------------------- Sidebar

function localBookName(slug) {
    return t(`hadith.book.${slug}`, bookTitle(slug));
}

function renderBookList() {
    els.bookList.innerHTML = "";
    for (const b of HADITH_BOOKS) {
        const li = document.createElement("li");
        li.dataset.slug = b.slug;
        li.textContent = localBookName(b.slug);
        li.addEventListener("click", () => openBook(b.slug, 1));
        els.bookList.appendChild(li);
    }
}

function renderBookmarks() {
    els.bookmarksCount.textContent = state.bookmarks.length
        ? `(${state.bookmarks.length})`
        : "";
    els.bookmarksList.innerHTML = "";
    if (state.bookmarks.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = t("hadith.bookmarksEmpty");
        els.bookmarksList.appendChild(li);
        return;
    }
    for (const b of state.bookmarks) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = `${localBookName(b.book)} #${b.number}`;
        a.addEventListener("click", async (e) => {
            e.preventDefault();
            const uiPage = Math.ceil(b.number / UI_PAGE_SIZE);
            await openBook(b.book, uiPage);
            scrollToHadith(b.number, true);
        });
        li.appendChild(a);
        els.bookmarksList.appendChild(li);
    }
}

// --------------------------------------------------------------- Reader

async function openBook(slug, uiPage = 1) {
    state.currentBook = slug;
    state.uiPage = uiPage;

    for (const li of els.bookList.children) {
        li.classList.toggle("active", li.dataset.slug === slug);
    }

    els.error.hidden = true;
    els.list.innerHTML = "";
    els.bookHeader.hidden = true;
    els.pager.hidden = true;
    els.loading.hidden = false;

    try {
        const total = bookTotal(slug);
        const totalUiPages = Math.max(1, Math.ceil(total / UI_PAGE_SIZE));
        const startNumber = (uiPage - 1) * UI_PAGE_SIZE + 1;
        const endNumber = Math.min(uiPage * UI_PAGE_SIZE, total);

        // Map the UI window to one or two network pages (rare overlap).
        const startNetPage = Math.ceil(startNumber / NETWORK_PAGE_SIZE);
        const endNetPage   = Math.ceil(endNumber / NETWORK_PAGE_SIZE);

        const netPages = [];
        for (let p = startNetPage; p <= endNetPage; p++) {
            netPages.push(await fetchHadithPage(slug, p));
        }
        const flat = netPages.flatMap((p) => p.hadiths);
        const slice = flat.filter((h) => h.number >= startNumber && h.number <= endNumber);

        renderHeader(slug, total, uiPage, totalUiPages);
        renderHadiths(slice);
        wirePager(slug, uiPage, totalUiPages);

        history.replaceState(null, "", `#${slug}`);
    } catch (err) {
        console.error(err);
        els.error.hidden = false;
        els.error.textContent = `${t("hadith.errorLoad")} (${localBookName(slug)})`;
    } finally {
        els.loading.hidden = true;
    }
}

function renderHeader(slug, total, uiPage, totalUiPages) {
    els.bookHeader.hidden = false;
    els.bookTitleEl.textContent = localBookName(slug);
    const startNumber = (uiPage - 1) * UI_PAGE_SIZE + 1;
    const endNumber = Math.min(uiPage * UI_PAGE_SIZE, total);
    els.bookMeta.textContent =
        `${total.toLocaleString()} ${t("hadith.hadithsTotal")} · ${t("hadith.showing")} #${startNumber}–${endNumber}`;
    els.pager.hidden = false;
    els.pageInfo.textContent = `${t("hadith.pageOf")} ${uiPage} ${t("hadith.of")} ${totalUiPages}`;
}

function renderHadiths(list) {
    els.list.innerHTML = "";
    if (list.length === 0) {
        els.error.hidden = false;
        els.error.textContent = "No hadiths returned for this page.";
        return;
    }
    for (const h of list) {
        const li = document.createElement("li");
        li.className = "hadith";
        li.id = `h${h.number}`;
        li.dataset.number = String(h.number);

        const bookmarked = state.bookmarks.some(
            (b) => b.book === state.currentBook && b.number === h.number
        );

        const aria = `Toggle bookmark on ${localBookName(state.currentBook)} #${h.number}`;
        li.innerHTML = `
            <div class="hadith-num">#${h.number}</div>
            <p class="hadith-arab">${escapeHtml(h.arab)}</p>
            <p class="hadith-id">${escapeHtml(h.id)}</p>
            <div class="hadith-actions">
                <button class="btn-bookmark${bookmarked ? " active" : ""}" type="button"
                        aria-label="${escapeHtml(aria)}">${escapeHtml(bookmarked ? t("reader.btnBookmarked") : t("reader.btnBookmark"))}</button>
            </div>
        `;
        li.querySelector(".btn-bookmark").addEventListener("click", () =>
            handleBookmark(state.currentBook, h.number, li));
        els.list.appendChild(li);
    }
}

function wirePager(slug, uiPage, totalUiPages) {
    els.pagePrev.disabled = uiPage <= 1;
    els.pageNext.disabled = uiPage >= totalUiPages;
    els.pagePrev.onclick = () => openBook(slug, Math.max(1, uiPage - 1)).then(() => window.scrollTo(0, 0));
    els.pageNext.onclick = () => openBook(slug, Math.min(totalUiPages, uiPage + 1)).then(() => window.scrollTo(0, 0));
}

async function handleBookmark(book, number, rowEl) {
    state.bookmarks = await toggleBookmark(book, number);
    const btn = rowEl.querySelector(".btn-bookmark");
    const now = await isBookmarked(book, number);
    btn.classList.toggle("active", now);
    btn.textContent = now ? t("reader.btnBookmarked") : t("reader.btnBookmark");
    renderBookmarks();
}

function scrollToHadith(number, highlight = false) {
    requestAnimationFrame(() => {
        const el = document.getElementById(`h${number}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (highlight) {
            el.classList.add("highlight");
            setTimeout(() => el.classList.remove("highlight"), 2000);
        }
    });
}

// --------------------------------------------------------------- Helpers

function parseHash() {
    const m = location.hash.match(/^#([a-z-]+)(?::(\d+))?$/i);
    if (!m) return null;
    return { book: m[1], number: m[2] ? Number(m[2]) : null };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

els.openOptions.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

// Cross-window bookmark sync.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.hadithBookmarks) return;
    state.bookmarks = changes.hadithBookmarks.newValue || [];
    renderBookmarks();
    for (const li of els.list.children) {
        const n = Number(li.dataset.number);
        const b = state.bookmarks.some(
            (bk) => bk.book === state.currentBook && bk.number === n
        );
        const btn = li.querySelector(".btn-bookmark");
        if (btn) {
            btn.classList.toggle("active", b);
            btn.textContent = b ? t("reader.btnBookmarked") : t("reader.btnBookmark");
        }
    }
});
