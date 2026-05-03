import { fetchStations } from "../scripts/radio.js";
import {
    playRadio, stopAudio, getAudioState, onAudioState
} from "../scripts/audio-controller.js";

const LAST_RADIO_KEY = "lastRadio";

const els = {
    list: document.getElementById("stations"),
    search: document.getElementById("search"),
    error: document.getElementById("error"),
    loading: document.getElementById("loading"),
    openOptions: document.getElementById("open-options")
};

const state = {
    stations: [],
    currentName: null,    // name of the station the offscreen is playing
    lastPlayed: null      // last station the *user* started in this profile
};

(async function init() {
    try {
        const [stations, lastObj] = await Promise.all([
            fetchStations(),
            chrome.storage.local.get(LAST_RADIO_KEY)
        ]);
        state.stations = stations;
        state.lastPlayed = lastObj[LAST_RADIO_KEY] || null;

        els.loading.hidden = true;
        renderStations();

        onAudioState(applyAudioState);
        const cur = await getAudioState();
        if (cur) applyAudioState(cur);
    } catch (err) {
        console.error(err);
        els.loading.hidden = true;
        els.error.hidden = false;
        els.error.textContent = "Failed to load station list. Check your connection.";
    }
})();

// --------------------------------------------------------------- Rendering

function renderStations() {
    els.list.innerHTML = "";
    state.stations.forEach((s) => {
        const li = document.createElement("li");
        li.className = "station";
        li.dataset.name = s.name;
        li.dataset.url = s.url;
        li.dataset.search = s.name.toLowerCase();

        const playing = state.currentName === s.name;
        if (playing) li.classList.add("active");

        const isLast = state.lastPlayed?.name === s.name;
        const lastBadge = isLast && !playing
            ? `<span class="last-played-badge">Last played</span>`
            : "";

        li.innerHTML = `
            <button class="play-btn" type="button" aria-label="Play / stop">${playing ? "⏸" : "▶"}</button>
            <div class="station-info">
                <div class="station-name">${escapeHtml(s.name)}</div>
                <div class="station-status">${playing ? "Playing" : "Idle"}</div>
            </div>
            ${lastBadge}
        `;

        li.querySelector(".play-btn").addEventListener("click", () => onTogglePlay(s));
        els.list.appendChild(li);
    });
}

async function onTogglePlay(station) {
    if (state.currentName === station.name) {
        await stopAudio();
        return;
    }
    try {
        await playRadio(station.url, station.name);
        await chrome.storage.local.set({
            [LAST_RADIO_KEY]: { name: station.name, url: station.url, ts: Date.now() }
        });
        state.lastPlayed = { name: station.name, url: station.url };
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------- Audio sync

function applyAudioState(s) {
    state.currentName = s.station ?? null;
    // Re-render row states without rebuilding the list (preserves search text).
    for (const li of els.list.children) {
        const isThis = li.dataset.name === state.currentName;
        li.classList.toggle("active", isThis);
        const btn = li.querySelector(".play-btn");
        const status = li.querySelector(".station-status");
        if (!btn || !status) continue;
        if (isThis) {
            btn.textContent = s.playing ? "⏸" : (s.loading ? "…" : "▶");
            status.textContent = s.loading ? "Loading…" : (s.playing ? "Playing" : "Paused");
        } else {
            btn.textContent = "▶";
            status.textContent = "Idle";
        }
    }
}

// --------------------------------------------------------------- Search

els.search.addEventListener("input", () => {
    const q = els.search.value.trim().toLowerCase();
    for (const li of els.list.children) {
        li.classList.toggle("hidden", q.length > 0 && !li.dataset.search.includes(q));
    }
});

// --------------------------------------------------------------- Helpers

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

els.openOptions.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});
