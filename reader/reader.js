import { fetchSurahList, fetchSurah, fetchTafsir } from "../scripts/quran.js";
import { getSettings } from "../scripts/settings.js";
import {
    getBookmarks, isBookmarked, toggleBookmark
} from "../scripts/bookmarks.js";
import { getLastRead, setLastRead } from "../scripts/last-read.js";
import {
    playSurah, pauseAudio, resumeAudio, stopAudio, seekAudio,
    getAudioState, onAudioState
} from "../scripts/audio-controller.js";

const els = {
    list: document.getElementById("surah-list"),
    search: document.getElementById("surah-search"),
    bookmarksList: document.getElementById("bookmarks-list"),
    bookmarksCount: document.getElementById("bookmarks-count"),
    pane: document.getElementById("reader-pane"),
    header: document.getElementById("surah-header"),
    nameAr: document.getElementById("surah-name-ar"),
    meta: document.getElementById("surah-meta"),
    basmala: document.getElementById("basmala"),
    error: document.getElementById("reader-error"),
    loading: document.getElementById("reader-loading"),
    ayat: document.getElementById("ayat"),
    resumeBanner: document.getElementById("resume-banner"),
    resumeText: document.getElementById("resume-text"),
    resumeGo: document.getElementById("resume-go"),
    resumeDismiss: document.getElementById("resume-dismiss"),
    openOptions: document.getElementById("open-options"),
    playSurahBtn: document.getElementById("play-surah"),
    player: document.getElementById("player"),
    playerToggle: document.getElementById("player-toggle"),
    playerStop: document.getElementById("player-stop"),
    playerTitle: document.getElementById("player-title"),
    playerCurrent: document.getElementById("player-current"),
    playerDuration: document.getElementById("player-duration"),
    playerSeek: document.getElementById("player-seek")
};

const state = {
    surahList: [],          // [{ number, name, englishName, ... }]
    currentSurah: null,     // number
    currentSurahData: null, // full payload from fetchSurah
    tafsirSlug: "arabic_moyassar",
    showTafsirByDefault: false,
    expandedTafsir: new Set(),  // ayah numbers (within current surah)
    bookmarks: [],
    reciterId: 7,
    audio: {                // mirror of last broadcast from offscreen
        playing: false,
        loading: false,
        surah: null,
        title: "",
        currentTime: 0,
        duration: 0,
        ended: false
    },
    seekDragging: false
};

(async function init() {
    const [settings, list, bookmarks, lastRead] = await Promise.all([
        getSettings(),
        fetchSurahList(),
        getBookmarks(),
        getLastRead()
    ]);

    state.tafsirSlug = settings.quran.tafsirSlug;
    state.showTafsirByDefault = settings.quran.showTafsirByDefault;
    state.reciterId = settings.audio?.reciterId ?? 7;
    state.surahList = list;
    state.bookmarks = bookmarks;

    renderSurahList();
    renderBookmarks();
    setupAudio();

    const fromHash = parseHash();
    if (fromHash) {
        await openSurah(fromHash.surah);
        if (fromHash.ayah) scrollToAyah(fromHash.ayah, true);
    } else if (lastRead) {
        // Auto-resume: open the saved surah and scroll to the saved ayah.
        await openSurah(lastRead.surah);
        scrollToAyah(lastRead.ayah, true);
        showResumeBanner(lastRead.surah, lastRead.ayah);
    } else {
        await openSurah(1);
    }
})();

// ------------------------------------------------------------------ Sidebar

function renderSurahList() {
    els.list.innerHTML = "";
    for (const s of state.surahList) {
        const li = document.createElement("li");
        li.dataset.number = String(s.number);
        li.dataset.search =
            `${s.number} ${s.englishName} ${s.englishNameTranslation} ${s.name}`.toLowerCase();
        li.innerHTML = `
            <span class="num">${s.number}.</span>
            <span class="name-en">${escapeHtml(s.englishName)}</span>
            <span class="name-ar">${escapeHtml(s.name)}</span>
        `;
        li.addEventListener("click", () => openSurah(s.number));
        els.list.appendChild(li);
    }
}

els.search.addEventListener("input", () => {
    const q = els.search.value.trim().toLowerCase();
    for (const li of els.list.children) {
        li.classList.toggle("hidden", q.length > 0 && !li.dataset.search.includes(q));
    }
});

function renderBookmarks() {
    els.bookmarksCount.textContent = state.bookmarks.length
        ? `(${state.bookmarks.length})`
        : "";
    els.bookmarksList.innerHTML = "";
    if (state.bookmarks.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "No bookmarks yet — tap 🔖 on any ayah.";
        els.bookmarksList.appendChild(li);
        return;
    }
    for (const b of state.bookmarks) {
        const surah = state.surahList.find((s) => s.number === b.surah);
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = `${b.surah}:${b.ayah}${surah ? ` — ${surah.englishName}` : ""}`;
        a.addEventListener("click", async (e) => {
            e.preventDefault();
            await openSurah(b.surah);
            scrollToAyah(b.ayah, true);
        });
        li.appendChild(a);
        els.bookmarksList.appendChild(li);
    }
}

// -------------------------------------------------------------------- Reader

async function openSurah(number) {
    if (!number || number < 1 || number > 114) return;
    state.currentSurah = number;
    state.expandedTafsir = new Set();

    // Sidebar active state.
    for (const li of els.list.children) {
        li.classList.toggle("active", Number(li.dataset.number) === number);
    }

    // Reset UI.
    els.error.hidden = true;
    els.ayat.innerHTML = "";
    els.header.hidden = true;
    els.loading.hidden = false;

    try {
        const data = await fetchSurah(number);
        state.currentSurahData = data;
        renderHeader(data);
        renderAyat(data);

        if (state.showTafsirByDefault) {
            for (const ayah of data.ayahs) toggleTafsir(ayah.numberInSurah);
        }

        history.replaceState(null, "", `#${number}`);
        // Don't update last-read on open — only on actual scroll/interaction.
    } catch (err) {
        console.error(err);
        els.error.hidden = false;
        els.error.textContent = `Failed to load surah ${number}. Check your connection.`;
    } finally {
        els.loading.hidden = true;
    }
}

function renderHeader(data) {
    els.header.hidden = false;
    els.nameAr.textContent = data.name;
    els.meta.textContent =
        `${data.englishName} · ${data.englishNameTranslation} · ` +
        `${data.numberOfAyahs} ayat · ${data.revelationType}`;
    // Surahs 1 and 9 omit the basmala.
    els.basmala.hidden = data.number === 1 || data.number === 9;
}

function renderAyat(data) {
    els.ayat.innerHTML = "";
    for (const ayah of data.ayahs) {
        // For surah > 1, the alquran.cloud response has the basmala prefix on
        // ayah 1 — strip it so the header's basmala isn't duplicated.
        let text = ayah.text;
        if (
            ayah.numberInSurah === 1 &&
            data.number !== 1 &&
            data.number !== 9 &&
            text.startsWith("بِسْمِ")
        ) {
            const idx = text.indexOf(" ", text.indexOf("الرَّحِيمِ"));
            if (idx > 0) text = text.slice(idx).trim();
        }

        const li = document.createElement("li");
        li.className = "ayah";
        li.id = `a${ayah.numberInSurah}`;
        li.dataset.ayah = String(ayah.numberInSurah);

        const bookmarked = state.bookmarks.some(
            (b) => b.surah === data.number && b.ayah === ayah.numberInSurah
        );

        li.innerHTML = `
            <p class="ayah-text">
                ${escapeHtml(text)}
                <span class="ayah-num">﴿${toArabicDigits(ayah.numberInSurah)}﴾</span>
            </p>
            <div class="ayah-actions">
                <button class="btn-tafsir" type="button">📖 Tafsir</button>
                <button class="btn-bookmark${bookmarked ? " active" : ""}" type="button">
                    ${bookmarked ? "🔖 Bookmarked" : "🔖 Bookmark"}
                </button>
            </div>
        `;

        li.querySelector(".btn-tafsir").addEventListener("click", () =>
            toggleTafsir(ayah.numberInSurah));
        li.querySelector(".btn-bookmark").addEventListener("click", () =>
            handleBookmark(data.number, ayah.numberInSurah, li));

        els.ayat.appendChild(li);
    }
}

async function toggleTafsir(ayahNumber) {
    const li = document.getElementById(`a${ayahNumber}`);
    if (!li) return;
    const existing = li.querySelector(".tafsir");
    if (existing) {
        existing.remove();
        state.expandedTafsir.delete(ayahNumber);
        return;
    }
    state.expandedTafsir.add(ayahNumber);
    const tafsirEl = document.createElement("div");
    tafsirEl.className = "tafsir loading";
    tafsirEl.textContent = "Loading tafsir…";
    li.appendChild(tafsirEl);

    try {
        const tafsir = await fetchTafsir(state.tafsirSlug, state.currentSurah);
        const row = tafsir.find((r) => r.aya === ayahNumber);
        tafsirEl.classList.remove("loading");
        tafsirEl.textContent = row?.translation || "Tafsir not available for this ayah.";
    } catch (err) {
        console.error(err);
        tafsirEl.classList.remove("loading");
        tafsirEl.textContent = "Failed to load tafsir. Check your connection.";
    }
}

async function handleBookmark(surah, ayah, rowEl) {
    state.bookmarks = await toggleBookmark(surah, ayah);
    const btn = rowEl.querySelector(".btn-bookmark");
    const now = await isBookmarked(surah, ayah);
    btn.classList.toggle("active", now);
    btn.textContent = now ? "🔖 Bookmarked" : "🔖 Bookmark";
    renderBookmarks();
}

// ------------------------------------------------------------ Resume / scroll

function showResumeBanner(surah, ayah) {
    els.resumeText.textContent = `Resumed at ${surah}:${ayah}`;
    els.resumeBanner.hidden = false;

    // Go = re-scroll to the saved ayah (or open the saved surah and scroll
    // if the user has navigated away in the meantime).
    els.resumeGo.onclick = async () => {
        if (state.currentSurah !== surah) {
            await openSurah(surah);
        }
        scrollToAyah(ayah, true);
    };
    els.resumeDismiss.onclick = () => { els.resumeBanner.hidden = true; };
}

function scrollToAyah(ayahNumber, highlight = false) {
    // Defer past the next layout — openSurah's renderAyat populates the DOM
    // synchronously but the browser may not have laid out the new <li>s yet.
    requestAnimationFrame(() => {
        const el = document.getElementById(`a${ayahNumber}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (highlight) {
            el.classList.add("highlight");
            setTimeout(() => el.classList.remove("highlight"), 2000);
        }
    });
}

// Update last-read as the user scrolls — debounced.
let scrollTimer = null;
window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(updateLastReadFromScroll, 400);
});

function updateLastReadFromScroll() {
    if (!state.currentSurah) return;
    // Find the ayah whose top is closest to (but below) the viewport top.
    const target = window.scrollY + window.innerHeight * 0.35;
    let best = null;
    for (const li of els.ayat.children) {
        const top = li.offsetTop;
        if (top <= target && (best === null || top > best.offsetTop)) best = li;
    }
    if (best?.dataset.ayah) {
        setLastRead(state.currentSurah, Number(best.dataset.ayah));
    }
}

// ----------------------------------------------------------- Helpers / events

function parseHash() {
    const m = location.hash.match(/^#(\d+)(?::(\d+))?$/);
    if (!m) return null;
    return { surah: Number(m[1]), ayah: m[2] ? Number(m[2]) : null };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function toArabicDigits(n) {
    const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

els.openOptions.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

// Keyboard shortcuts.
document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.key === "ArrowRight" && state.currentSurah > 1) openSurah(state.currentSurah - 1);
    else if (e.key === "ArrowLeft" && state.currentSurah < 114) openSurah(state.currentSurah + 1);
    else if (e.key === "/") { e.preventDefault(); els.search.focus(); }
});

// Live-update bookmarks when changed in another window/tab.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.bookmarks) {
        state.bookmarks = changes.bookmarks.newValue || [];
        renderBookmarks();
        // Refresh button states on the currently-open surah.
        for (const li of els.ayat.children) {
            const a = Number(li.dataset.ayah);
            const b = state.bookmarks.some(
                (bk) => bk.surah === state.currentSurah && bk.ayah === a
            );
            const btn = li.querySelector(".btn-bookmark");
            if (btn) {
                btn.classList.toggle("active", b);
                btn.textContent = b ? "🔖 Bookmarked" : "🔖 Bookmark";
            }
        }
    }
    if (area === "sync" && changes.settings?.newValue?.audio?.reciterId) {
        state.reciterId = changes.settings.newValue.audio.reciterId;
    }
});

// ----------------------------------------------------------------- Audio

function setupAudio() {
    els.playSurahBtn.addEventListener("click", onListenClick);
    els.playerToggle.addEventListener("click", () => {
        if (state.audio.playing) pauseAudio();
        else if (state.audio.surah) resumeAudio();
    });
    els.playerStop.addEventListener("click", () => stopAudio());
    els.playerSeek.addEventListener("input", () => { state.seekDragging = true; });
    els.playerSeek.addEventListener("change", () => {
        const pct = Number(els.playerSeek.value) / 100;
        const t = pct * (state.audio.duration || 0);
        seekAudio(t);
        state.seekDragging = false;
    });

    onAudioState(applyAudioState);

    // If we returned to the reader while audio was already playing, sync now.
    getAudioState().then((s) => { if (s) applyAudioState(s); });
}

async function onListenClick() {
    const data = state.currentSurahData;
    if (!data) return;
    // Toggle behaviour: if already playing this surah, pause/resume.
    if (state.audio.surah === data.number) {
        if (state.audio.playing) return pauseAudio();
        return resumeAudio();
    }
    const title = `${data.englishName} · Surah ${data.number}`;
    els.playSurahBtn.disabled = true;
    els.playSurahBtn.textContent = "Loading…";
    try {
        await playSurah(state.reciterId, data.number, title);
    } catch (err) {
        console.error(err);
        els.playSurahBtn.textContent = "▶ Listen";
    } finally {
        els.playSurahBtn.disabled = false;
    }
}

function applyAudioState(audioState) {
    state.audio = audioState;
    const hasTrack = audioState.surah !== null;
    els.player.hidden = !hasTrack;
    document.body.classList.toggle("has-player", hasTrack);

    els.playerToggle.textContent = audioState.playing ? "⏸" : (audioState.loading ? "…" : "▶");
    els.playerTitle.textContent = audioState.title || "—";
    els.playerCurrent.textContent = formatClock(audioState.currentTime);
    els.playerDuration.textContent = formatClock(audioState.duration);

    if (!state.seekDragging) {
        const pct = audioState.duration > 0
            ? (audioState.currentTime / audioState.duration) * 100
            : 0;
        els.playerSeek.value = String(pct);
    }

    // Surah-level Listen button label.
    if (els.playSurahBtn && state.currentSurahData) {
        const isThis = audioState.surah === state.currentSurahData.number;
        els.playSurahBtn.classList.toggle("playing", isThis && audioState.playing);
        if (isThis && audioState.playing) {
            els.playSurahBtn.textContent = "⏸ Pause";
        } else if (isThis && audioState.loading) {
            els.playSurahBtn.textContent = "Loading…";
        } else {
            els.playSurahBtn.textContent = "▶ Listen";
        }
    }
}

function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}
