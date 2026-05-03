// Offscreen audio host. Owns the single <audio> element, executes commands
// from any extension page, and broadcasts state updates so every open reader
// tab can render an in-sync mini player.

const audio = document.getElementById("player");

let state = {
    playing: false,
    loading: false,
    surah: null,
    reciter: null,
    station: null,    // non-null when a live radio stream is the source
    title: "",
    currentTime: 0,
    duration: 0,      // 0 for radio (live, no finite duration)
    ended: false
};

function setState(patch) {
    state = { ...state, ...patch };
    chrome.runtime.sendMessage({ type: "audio:state", state }).catch(() => {});
}

function safeDuration() {
    return Number.isFinite(audio.duration) ? audio.duration : 0;
}

audio.addEventListener("loadstart", () => setState({ loading: true, ended: false }));
audio.addEventListener("canplay",   () => setState({ loading: false }));
audio.addEventListener("play",      () => setState({ playing: true, ended: false }));
audio.addEventListener("pause",     () => setState({ playing: false }));
audio.addEventListener("ended",     () => setState({ playing: false, ended: true }));
audio.addEventListener("timeupdate", () => setState({
    currentTime: audio.currentTime || 0,
    duration: safeDuration()
}));
audio.addEventListener("durationchange", () => setState({ duration: safeDuration() }));
audio.addEventListener("error", () => setState({ playing: false, loading: false }));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.target !== "offscreen") return;

    switch (msg.action) {
        case "play": {
            const sameTrack = audio.src === msg.url;
            if (!sameTrack) {
                audio.src = msg.url;
            }
            audio.play().catch((err) => {
                console.error("audio.play() rejected:", err);
                setState({ loading: false, playing: false });
            });
            // Switching to a surah clears any radio attribution.
            setState({
                surah: msg.surah ?? state.surah,
                reciter: msg.reciter ?? state.reciter,
                station: null,
                title: msg.title ?? state.title,
                ended: false
            });
            break;
        }
        case "play-radio": {
            const sameTrack = audio.src === msg.url;
            if (!sameTrack) {
                audio.src = msg.url;
            }
            audio.play().catch((err) => {
                console.error("audio.play() rejected:", err);
                setState({ loading: false, playing: false });
            });
            // Radio replaces any active surah session.
            setState({
                surah: null,
                reciter: null,
                station: msg.station ?? state.station,
                title: msg.title ?? msg.station ?? state.title,
                ended: false
            });
            break;
        }
        case "pause":
            audio.pause();
            break;
        case "resume":
            audio.play().catch((err) => console.error("resume failed:", err));
            break;
        case "stop":
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
            setState({
                playing: false,
                loading: false,
                surah: null,
                reciter: null,
                station: null,
                title: "",
                currentTime: 0,
                duration: 0,
                ended: false
            });
            break;
        case "seek":
            if (Number.isFinite(msg.time)) audio.currentTime = msg.time;
            break;
        case "getState":
            sendResponse(state);
            return true;
    }
});

// Tell anyone listening at startup that we're alive (state is "idle").
chrome.runtime.sendMessage({ type: "audio:state", state }).catch(() => {});
