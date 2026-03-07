const RoundUtils = {
    getRemainingMs(timeMs, durationMs) {
        return Math.max(0, durationMs - timeMs);
    },

    getStepDurationMs(requestedMs, remainingMs) {
        return Math.max(0, Math.min(requestedMs, remainingMs));
    },

    isExpired(timeMs, durationMs) {
        return timeMs >= durationMs;
    },

    formatCountdown(ms) {
        const remaining = Math.max(0, ms);
        const totalSeconds = Math.ceil(remaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
};

if (typeof window !== 'undefined') {
    window.RoundUtils = RoundUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoundUtils;
}
