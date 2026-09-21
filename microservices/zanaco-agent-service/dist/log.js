"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
exports.logError = logError;
function maskValue(value) {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    if (!text)
        return undefined;
    if (text.length <= 4)
        return '****';
    return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}
function cleanDetails(details) {
    const output = {};
    for (const [key, value] of Object.entries(details)) {
        if (/account|acc/i.test(key)) {
            output[key] = maskValue(value);
        }
        else {
            output[key] = value;
        }
    }
    return output;
}
function logEvent(event, details = {}) {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        app: 'zanaco-agent',
        event,
        ...cleanDetails(details),
    }));
}
function logError(event, details = {}) {
    console.error(JSON.stringify({
        ts: new Date().toISOString(),
        app: 'zanaco-agent',
        level: 'error',
        event,
        ...cleanDetails(details),
    }));
}
