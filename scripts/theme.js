// Light / dark / auto theme. CSS does the heavy lifting via custom-property
// overrides keyed off <html data-theme>; this module just sets the attribute
// and listens for storage / OS changes.

const THEMES = ["auto", "light", "dark"];
let currentTheme = "auto";

export async function loadTheme() {
    const obj = await chrome.storage.sync.get("settings");
    const settings = obj.settings || {};
    currentTheme = THEMES.includes(settings.theme) ? settings.theme : "auto";
    return currentTheme;
}

export function getTheme() { return currentTheme; }

export function applyTheme(theme = currentTheme) {
    if (!THEMES.includes(theme)) theme = "auto";
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
}

export async function bootstrapTheme() {
    await loadTheme();
    applyTheme(currentTheme);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !changes.settings) return;
        const next = changes.settings.newValue?.theme || "auto";
        if (next !== currentTheme) applyTheme(next);
    });
}
