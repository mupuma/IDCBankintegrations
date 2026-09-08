"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAppOfQueueResult = notifyAppOfQueueResult;
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');
async function notifyAppOfQueueResult(queueId, result) {
    if (!APP_API_URL)
        return;
    try {
        await fetch(`${APP_API_URL}/api/v1/posted_payments/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queueId, result }),
        });
    }
    catch (err) {
        console.warn('Failed to notify app of queue result', err);
    }
}
exports.default = { notifyAppOfQueueResult };
