// Generic exponential-backoff retry wrapper.
//
// Usage:
//   await withRetry(() => fetch(url).then(r => r.json()));
//
// Defaults give 3 attempts over ~1.2 s + jitter (immediate, +400 ms, +800 ms).

export async function withRetry(fn, opts = {}) {
    const retries = opts.retries ?? 2;
    const baseMs  = opts.baseMs  ?? 400;
    const factor  = opts.factor  ?? 2;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt === retries || !isRetryable(err)) throw err;
            const delay = baseMs * Math.pow(factor, attempt) + Math.random() * 200;
            await sleep(delay);
        }
    }
    throw lastErr;
}

function isRetryable(err) {
    // Browser fetch network failures throw plain TypeError.
    if (err && err.name === "TypeError") return true;
    // Our fetch wrappers throw `new Error("... failed: 503")` etc.
    const msg = String(err?.message ?? err);
    const m = msg.match(/:\s*(\d{3})\b/);
    if (m) {
        const code = Number(m[1]);
        return code >= 500 && code < 600;
    }
    return false;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
