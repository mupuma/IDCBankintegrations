"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCashbook = postCashbook;
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');
const SAGE_API_KEY = process.env.SAGE_API_KEY;
async function postCashbook(receipt) {
    if (!APP_API_URL) {
        throw new Error('APP_API_URL not configured');
    }
    const url = `${APP_API_URL}/api/v1/cashbook`;
    const headers = { 'Content-Type': 'application/json' };
    if (SAGE_API_KEY)
        headers['Authorization'] = `Bearer ${SAGE_API_KEY}`;
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(receipt) });
    const text = await resp.text();
    let data = text;
    try {
        data = text ? JSON.parse(text) : undefined;
    }
    catch { }
    return {
        ok: resp.ok,
        status: resp.status,
        data,
        text,
    };
}
exports.default = { postCashbook };
