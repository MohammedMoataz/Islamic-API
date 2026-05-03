import { getSettings, setSettings, DEFAULT_SETTINGS, TAFSIR_EDITIONS, HADITH_BOOKS } from "../scripts/settings.js";
import { COUNTRIES, citiesFor } from "../scripts/locations.js";
import { fetchReciters } from "../scripts/quran-audio.js";
import { bootstrapI18n, t } from "../scripts/i18n.js";
import { bootstrapTheme } from "../scripts/theme.js";

await Promise.all([bootstrapTheme(), bootstrapI18n()]);

const els = {
    country: document.getElementById("country"),
    city: document.getElementById("city"),
    method: document.getElementById("method"),
    notifEnabled: document.getElementById("notif-enabled"),
    notifPre: document.getElementById("notif-pre"),
    tafsirSlug: document.getElementById("tafsir-slug"),
    tafsirDefault: document.getElementById("tafsir-default"),
    reciter: document.getElementById("reciter"),
    hadithBook: document.getElementById("hadith-book"),
    azkarReminders: document.getElementById("azkar-reminders"),
    azkarInterval: document.getElementById("azkar-interval"),
    language: document.getElementById("language"),
    theme: document.getElementById("theme"),
    saveBtn: document.getElementById("save-btn"),
    testBtn: document.getElementById("test-notif"),
    status: document.getElementById("status")
};

let pristine = null;       // snapshot of saved values, used to detect dirtiness

(async function load() {
    populateCountries();
    populateTafsirEditions();
    populateHadithBooks();
    const s = await getSettings();
    applyToForm(s);

    // Reciter list comes from the network — populate it after the rest of the
    // form is up so the page isn't gated on it.
    fetchReciters().then((reciters) => {
        populateReciters(reciters, s.audio?.reciterId ?? DEFAULT_SETTINGS.audio.reciterId);
        // If the user hasn't touched anything, refresh the pristine snapshot
        // so opening + closing doesn't look "dirty".
        if (!isDirty()) pristine = snapshotForm();
    }).catch((err) => console.error("fetchReciters:", err));

    pristine = snapshotForm();
    updateDirtyUI();
})();

function populateCountries() {
    els.country.innerHTML = COUNTRIES
        .map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`)
        .join("");
}

function populateTafsirEditions() {
    els.tafsirSlug.innerHTML = TAFSIR_EDITIONS
        .map((t) => `<option value="${escapeHtml(t.slug)}">${escapeHtml(t.language)} — ${escapeHtml(t.title)}</option>`)
        .join("");
}

function populateHadithBooks() {
    els.hadithBook.innerHTML = HADITH_BOOKS
        .map((b) => `<option value="${escapeHtml(b.slug)}">${escapeHtml(b.name)}</option>`)
        .join("");
}

function populateReciters(reciters, selectedId) {
    els.reciter.innerHTML = reciters
        .map((r) => {
            const label = r.translated_name?.name || r.reciter_name || `Reciter ${r.id}`;
            const style = r.style ? ` (${escapeHtml(r.style)})` : "";
            return `<option value="${r.id}">${escapeHtml(label)}${style}</option>`;
        })
        .join("");
    if (reciters.some((r) => r.id === selectedId)) {
        els.reciter.value = String(selectedId);
    }
}

function populateCities(countryName, preferredCity) {
    const cities = citiesFor(countryName);
    els.city.innerHTML = cities
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join("");
    els.city.value = cities.includes(preferredCity) ? preferredCity : (cities[0] || "");
}

function applyToForm(s) {
    const knownCountry = COUNTRIES.some((c) => c.name === s.location.country)
        ? s.location.country
        : DEFAULT_SETTINGS.location.country;
    els.country.value = knownCountry;
    populateCities(knownCountry, s.location.city);
    els.method.value = String(s.location.method);
    els.notifEnabled.checked = s.notifications.enabled;
    els.notifPre.value = String(s.notifications.preMinutes);
    const knownSlug = TAFSIR_EDITIONS.some((t) => t.slug === s.quran.tafsirSlug)
        ? s.quran.tafsirSlug
        : DEFAULT_SETTINGS.quran.tafsirSlug;
    els.tafsirSlug.value = knownSlug;
    els.tafsirDefault.checked = s.quran.showTafsirByDefault;
    const knownBook = HADITH_BOOKS.some((b) => b.slug === s.hadith.defaultBook)
        ? s.hadith.defaultBook
        : DEFAULT_SETTINGS.hadith.defaultBook;
    els.hadithBook.value = knownBook;
    els.azkarReminders.checked = !!s.azkar?.reminders?.enabled;
    const knownInterval = String(s.azkar?.reminders?.avgIntervalMinutes ?? DEFAULT_SETTINGS.azkar.reminders.avgIntervalMinutes);
    if ([...els.azkarInterval.options].some((o) => o.value === knownInterval)) {
        els.azkarInterval.value = knownInterval;
    }
    els.language.value = s.language === "ar" ? "ar" : "en";
    els.theme.value = ["auto", "light", "dark"].includes(s.theme) ? s.theme : "auto";
}

function snapshotForm() {
    return JSON.stringify({
        country: els.country.value,
        city: els.city.value,
        method: els.method.value,
        notifEnabled: els.notifEnabled.checked,
        notifPre: els.notifPre.value,
        tafsirSlug: els.tafsirSlug.value,
        tafsirDefault: els.tafsirDefault.checked,
        reciter: els.reciter.value,
        hadithBook: els.hadithBook.value,
        azkarReminders: els.azkarReminders.checked,
        azkarInterval: els.azkarInterval.value,
        language: els.language.value,
        theme: els.theme.value
    });
}

function isDirty() {
    return pristine !== null && snapshotForm() !== pristine;
}

function updateDirtyUI() {
    const dirty = isDirty();
    els.saveBtn.disabled = !dirty;
    els.status.textContent = dirty ? t("options.unsaved") : "";
    els.status.classList.toggle("muted", dirty);
    els.status.classList.toggle("success", false);
}

function clampInt(raw, min, max, fallback) {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

async function save() {
    await setSettings({
        location: {
            city: els.city.value || DEFAULT_SETTINGS.location.city,
            country: els.country.value || DEFAULT_SETTINGS.location.country,
            method: parseInt(els.method.value, 10)
        },
        notifications: {
            enabled: els.notifEnabled.checked,
            preMinutes: clampInt(
                els.notifPre.value,
                0,
                60,
                DEFAULT_SETTINGS.notifications.preMinutes
            )
        },
        quran: {
            tafsirSlug: els.tafsirSlug.value || DEFAULT_SETTINGS.quran.tafsirSlug,
            showTafsirByDefault: els.tafsirDefault.checked
        },
        audio: {
            reciterId: parseInt(els.reciter.value, 10) || DEFAULT_SETTINGS.audio.reciterId
        },
        hadith: {
            defaultBook: els.hadithBook.value || DEFAULT_SETTINGS.hadith.defaultBook
        },
        azkar: {
            reminders: {
                enabled: els.azkarReminders.checked,
                avgIntervalMinutes: clampInt(
                    els.azkarInterval.value,
                    15, 360,
                    DEFAULT_SETTINGS.azkar.reminders.avgIntervalMinutes
                )
            }
        },
        language: els.language.value === "ar" ? "ar" : "en",
        theme: ["auto", "light", "dark"].includes(els.theme.value) ? els.theme.value : "auto"
    });
    pristine = snapshotForm();
    els.saveBtn.disabled = true;
    flashSaved();
}

function flashSaved() {
    els.status.classList.remove("muted");
    els.status.classList.add("success");
    const msg = t("options.saved");
    els.status.textContent = msg;
    setTimeout(() => {
        if (els.status.textContent === msg) {
            els.status.textContent = "";
            els.status.classList.remove("success");
        }
    }, 1500);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

// Cascading: country change rebuilds the city list.
els.country.addEventListener("change", () => {
    populateCities(els.country.value, els.city.value);
    updateDirtyUI();
});

// Any other change just toggles dirty UI.
[els.city, els.method, els.notifEnabled, els.notifPre, els.tafsirSlug, els.tafsirDefault, els.reciter, els.hadithBook, els.azkarReminders, els.azkarInterval, els.language, els.theme].forEach((el) => {
    el.addEventListener("change", updateDirtyUI);
    el.addEventListener("input", updateDirtyUI);
});

els.saveBtn.addEventListener("click", save);

els.testBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "test-notification" });
    els.status.classList.remove("muted");
    els.status.classList.add("success");
    const msg = t("options.testSent");
    els.status.textContent = msg;
    setTimeout(() => {
        if (els.status.textContent === msg) {
            els.status.textContent = "";
            els.status.classList.remove("success");
        }
    }, 1500);
});
