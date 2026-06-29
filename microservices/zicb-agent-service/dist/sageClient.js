"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCashbook = postCashbook;
const node_fetch_1 = __importDefault(require("node-fetch"));
// Agents should call the main portal (idcbankintegration) which will talk to Sage.
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');
const SAGE_API_KEY = process.env.SAGE_API_KEY; // optional if portal requires auth
async function postCashbook(receipt) {
    if (!APP_API_URL) {
        throw new Error('APP_API_URL not configured');
    }
    // Call the portal's cashbook endpoint; the portal will handle writing to Sage
    const url = `${APP_API_URL}/api/v1/cashbook`;
    const headers = { 'Content-Type': 'application/json' };
    if (SAGE_API_KEY)
        headers['Authorization'] = `Bearer ${SAGE_API_KEY}`;
    const resp = await (0, node_fetch_1.default)(url, { method: 'POST', headers, body: JSON.stringify(receipt) });
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
