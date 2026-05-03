// Reader-side wrapper around the offscreen audio document.

import { fetchChapterAudio } from "./quran-audio.js";

async function ensureOffscreen() {
    await chrome.runtime.sendMessage({ type: "audio:ensure" });
}

export async function playSurah(reciterId, surah, title) {
    await ensureOffscreen();
    const url = await fetchChapterAudio(reciterId, surah);
    return chrome.runtime.sendMessage({
        target: "offscreen",
        action: "play",
        url, surah, reciter: reciterId, title
    });
}

export function pauseAudio() {
    return chrome.runtime.sendMessage({ target: "offscreen", action: "pause" });
}

export function resumeAudio() {
    return chrome.runtime.sendMessage({ target: "offscreen", action: "resume" });
}

export function stopAudio() {
    return chrome.runtime.sendMessage({ target: "offscreen", action: "stop" });
}

export function seekAudio(time) {
    return chrome.runtime.sendMessage({ target: "offscreen", action: "seek", time });
}

// Returns current state, or null if no offscreen document is alive.
export async function getAudioState() {
    try {
        return await chrome.runtime.sendMessage({ target: "offscreen", action: "getState" });
    } catch {
        return null;
    }
}

// Subscribe to state changes. Returns an unsubscribe function.
export function onAudioState(callback) {
    const listener = (msg) => {
        if (msg?.type === "audio:state") callback(msg.state);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
}
