import { getSettings, setSettings, DEFAULT_SETTINGS, TAFSIR_EDITIONS } from "../scripts/settings.js";
import { COUNTRIES, citiesFor } from "../scripts/locations.js";

const els = {
    country: document.getElementById("country"),
    city: document.getElementById("city"),
    method: document.getElementById("method"),
    notifEnabled: document.getElementById("notif-enabled"),
    notifPre: document.getElementById("notif-pre"),
    tafsirSlug: document.getElementById("tafsir-slug"),
    tafsirDefault: document.getElementById("tafsir-default"),
    saveBtn: document.getElementById("save-btn"),
    testBtn: document.getElementById("test-notif"),
    status: document.getElementById("status")
};

let pristine = null;       // snapshot of saved values, used to detect dirtiness

(async function load() {
    populateCountries();
    populateTafsirEditions();
    const s = await getSettings();
    applyToForm(s);
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
}

function snapshotForm() {
    return JSON.stringify({
        country: els.country.value,
        city: els.city.value,
        method: els.method.value,
        notifEnabled: els.notifEnabled.checked,
        notifPre: els.notifPre.value,
        tafsirSlug: els.tafsirSlug.value,
        tafsirDefault: els.tafsirDefault.checked
    });
}

function isDirty() {
    return pristine !== null && snapshotForm() !== pristine;
}

function updateDirtyUI() {
    const dirty = isDirty();
    els.saveBtn.disabled = !dirty;
    els.status.textContent = dirty ? "Unsaved changes" : "";
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
        }
    });
    pristine = snapshotForm();
    els.saveBtn.disabled = true;
    flashSaved();
}

function flashSaved() {
    els.status.classList.remove("muted");
    els.status.classList.add("success");
    els.status.textContent = "Saved ✓";
    setTimeout(() => {
        if (els.status.textContent === "Saved ✓") {
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
[els.city, els.method, els.notifEnabled, els.notifPre, els.tafsirSlug, els.tafsirDefault].forEach((el) => {
    el.addEventListener("change", updateDirtyUI);
    el.addEventListener("input", updateDirtyUI);
});

els.saveBtn.addEventListener("click", save);

els.testBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "test-notification" });
    els.status.classList.remove("muted");
    els.status.classList.add("success");
    els.status.textContent = "Test notification sent.";
    setTimeout(() => {
        if (els.status.textContent === "Test notification sent.") {
            els.status.textContent = "";
            els.status.classList.remove("success");
        }
    }, 1500);
});
