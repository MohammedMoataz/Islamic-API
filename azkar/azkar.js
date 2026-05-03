import {
    fetchAzkar, getCounts, setCount, resetCount, resetCategory,
    clearNotifiedKind, countKey
} from "../scripts/azkar.js";
import { bootstrapI18n, t } from "../scripts/i18n.js";
import { bootstrapTheme } from "../scripts/theme.js";

await Promise.all([bootstrapTheme(), bootstrapI18n()]);

const els = {
    categoryList: document.getElementById("category-list"),
    catHeader: document.getElementById("cat-header"),
    catTitle: document.getElementById("cat-title"),
    catMeta: document.getElementById("cat-meta"),
    list: document.getElementById("azkar-list"),
    error: document.getElementById("azkar-error"),
    loading: document.getElementById("azkar-loading"),
    resetAll: document.getElementById("reset-all"),
    openOptions: document.getElementById("open-options")
};

const state = {
    categories: [],   // [{ category, items: [...] }]
    currentIdx: 0,    // index into state.categories
    counts: {}        // map of "category:index" -> remaining
};

(async function init() {
    try {
        const [groups, counts] = await Promise.all([fetchAzkar(), getCounts()]);
        state.categories = groups;
        state.counts = counts;
        renderSidebar();

        const fromHash = parseHash();
        if (fromHash !== null && fromHash < state.categories.length) {
            openCategory(fromHash);
        } else {
            openCategory(0);
        }
    } catch (err) {
        console.error(err);
        els.loading.hidden = true;
        els.error.hidden = false;
        els.error.textContent = t("azkar.errorLoad");
    }
})();

// ---------------------------------------------------------------- Sidebar

function renderSidebar() {
    els.categoryList.innerHTML = "";
    state.categories.forEach((g, i) => {
        const li = document.createElement("li");
        li.dataset.index = String(i);
        li.textContent = g.category;
        li.addEventListener("click", () => openCategory(i));
        els.categoryList.appendChild(li);
    });
}

// ---------------------------------------------------------------- Reader

function openCategory(idx) {
    state.currentIdx = idx;
    const group = state.categories[idx];
    if (!group) return;

    for (const li of els.categoryList.children) {
        li.classList.toggle("active", Number(li.dataset.index) === idx);
    }

    els.loading.hidden = true;
    els.error.hidden = true;
    els.catHeader.hidden = false;
    els.catTitle.textContent = group.category;
    els.catMeta.textContent = `${group.items.length} ${t("azkar.supplications")}`;
    history.replaceState(null, "", `#${idx}`);

    renderDhikrs(group);
}

function renderDhikrs(group) {
    els.list.innerHTML = "";
    group.items.forEach((item, idx) => {
        els.list.appendChild(buildDhikrCard(group.category, idx, item));
    });
}

function buildDhikrCard(category, index, item) {
    const li = document.createElement("li");
    li.className = "dhikr";
    li.dataset.category = category;
    li.dataset.index = String(index);

    // Determine remaining: stored value, else target.
    const key = countKey(category, index);
    const remaining = key in state.counts ? state.counts[key] : item.count;
    const done = remaining <= 0;
    if (done) li.classList.add("done");

    const referenceLine = item.reference || item.description;

    li.innerHTML = `
        <p class="dhikr-text">${escapeHtml(item.zekr)}</p>
        ${referenceLine ? `<p class="dhikr-meta">${escapeHtml(referenceLine)}</p>` : ""}
        <div class="dhikr-controls">
            <button class="tasbih${done ? " done" : ""}" type="button"
                    aria-label="${escapeHtml(t("azkar.tapHint"))}">${done ? "✓" : remaining}</button>
            <div class="tasbih-info">
                <span class="tasbih-target">${escapeHtml(t("azkar.target"))}: ${item.count}</span>
                <span class="tasbih-hint">${escapeHtml(done ? t("azkar.completed") : t("azkar.tapHint"))}</span>
            </div>
            <button class="btn-reset" type="button" aria-label="Reset" title="Reset">↻</button>
        </div>
    `;

    const tasbih = li.querySelector(".tasbih");
    tasbih.addEventListener("click", () => onTap(category, index, item, li));

    li.querySelector(".btn-reset").addEventListener("click", (e) => {
        e.stopPropagation();
        onReset(category, index, item, li);
    });

    return li;
}

async function onTap(category, index, item, rowEl) {
    const key = countKey(category, index);
    const current = key in state.counts ? state.counts[key] : item.count;
    if (current <= 0) return;
    const next = current - 1;
    state.counts[key] = next;
    await setCount(category, index, next);

    updateRow(rowEl, item, next);

    if (next === 0) {
        autoAdvanceFrom(rowEl);
    }
}

async function onReset(category, index, item, rowEl) {
    delete state.counts[countKey(category, index)];
    await resetCount(category, index);
    updateRow(rowEl, item, item.count);
}

function updateRow(rowEl, item, remaining) {
    const done = remaining <= 0;
    rowEl.classList.toggle("done", done);
    const tasbih = rowEl.querySelector(".tasbih");
    tasbih.classList.toggle("done", done);
    tasbih.textContent = done ? "✓" : String(remaining);
    rowEl.querySelector(".tasbih-hint").textContent = done ? t("azkar.completed") : t("azkar.tapHint");
}

function autoAdvanceFrom(rowEl) {
    let next = rowEl.nextElementSibling;
    while (next && next.classList.contains("done")) {
        next = next.nextElementSibling;
    }
    if (next) {
        next.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

// ---------------------------------------------------------------- Helpers

function parseHash() {
    const m = location.hash.match(/^#(\d+)$/);
    return m ? Number(m[1]) : null;
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

els.resetAll.addEventListener("click", async () => {
    const group = state.categories[state.currentIdx];
    if (!group) return;

    // Bulk-clear local state + storage in one round-trip.
    for (let i = 0; i < group.items.length; i++) {
        delete state.counts[countKey(group.category, i)];
    }
    await resetCategory(group.category);

    // If this category corresponds to a reminder kind, also clear the
    // "notified today" set so reminders can re-cover its dhikrs.
    const kind = kindForCategory(group.category);
    if (kind) await clearNotifiedKind(kind);

    openCategory(state.currentIdx);
});

function kindForCategory(category) {
    const c = String(category || "");
    if (c.includes("الصباح") || /morning/i.test(c)) return "morning";
    if (c.includes("المساء") || /evening/i.test(c)) return "evening";
    return null;
}

// Day rollover while the tab is open: re-pull counts when storage clears them.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.azkarCounts) return;
    const next = changes.azkarCounts.newValue?.counts || {};
    state.counts = next;
    // Re-render the active category to reflect any external changes.
    openCategory(state.currentIdx);
});
