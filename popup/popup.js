import { getSettings } from "../scripts/settings.js";
import { fetchTimings } from "../scripts/api.js";
import { todayAt, MAIN_PRAYERS } from "../scripts/utility.js";

const tableBody = document.getElementById("prayer-times");
const errorEl = document.getElementById("error");
const cityLine = document.getElementById("city-line");

(async function init() {
    try {
        const settings = await getSettings();
        cityLine.textContent = `${settings.location.city}, ${settings.location.country}`;
        const timings = await fetchTimings(settings.location);
        render(timings);
    } catch (err) {
        console.error(err);
        errorEl.hidden = false;
        errorEl.textContent = "Failed to load prayer times. Check your connection or settings.";
    }
})();

function render(timings) {
    tableBody.innerHTML = "";
    const now = Date.now();
    for (const name of MAIN_PRAYERS) {
        const hhmm = timings[name];
        if (!hhmm) continue;
        const at = todayAt(hhmm);
        const row = document.createElement("tr");
        if (at < now) row.classList.add("past");
        row.innerHTML = `<td>${name}</td><td>${hhmm}</td>`;
        tableBody.appendChild(row);
    }
}

document.getElementById("settings-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});
