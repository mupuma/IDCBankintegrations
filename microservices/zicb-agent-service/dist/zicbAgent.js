"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAppOfQueueResult = void 0;
exports.prepareZicbPayload = prepareZicbPayload;
exports.sendZicbPayment = sendZicbPayment;
require("dotenv/config");
const zicbValidation_1 = require("./zicbValidation");
const QUEUE_URL = process.env.ZICB_BANK_API_URL;
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');
const DEFAULT_SOURCE_ACCOUNT = process.env.ZICB_SOURCE_ACCOUNT ?? '';
const DEFAULT_SOURCE_BRANCH = process.env.ZICB_SOURCE_BRANCH ?? '';
const DEFAULT_USER_NAME = process.env.ZICB_USER_NAME ?? 'SageSystem';
const DEFAULT_CUSTOMER_ID = process.env.ZICB_CUSTOMER_ID ?? '';
const DEFAULT_IP_ADDRESS = process.env.ZICB_IP_ADDRESS ?? '0.0.0.0';
const MOCK_SUCCESS_RESPONSE = process.env.ZICB_MOCK_SUCCESS_RESPONSE === 'true';
function mergeDefaults(payment) {
    return {
        ...payment,
        accountName: payment.accountName || DEFAULT_USER_NAME,
        vendorId: payment.vendorId || DEFAULT_CUSTOMER_ID,
        ipAddress: payment.ipAddress || DEFAULT_IP_ADDRESS,
        srcAcc: payment.srcAcc || DEFAULT_SOURCE_ACCOUNT,
        srcBranch: payment.srcBranch || DEFAULT_SOURCE_BRANCH,
    };
}
const notifyAppOfQueueResult = async (queueId, result) => {
    if (!APP_API_URL) {
        console.warn('[ZICB] APP_API_URL is not configured; skipping callback to app');
        return;
    }
    const callbackUrl = `${APP_API_URL}/api/v1/posted_payments/response`;
    try {
        const response = await fetch(callbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                queueId,
                status: result.success ? 'success' : 'failed',
                response: result.data,
                error: result.error,
                attempts: undefined,
            }),
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('[ZICB] callback failed', { queueId, callbackUrl, status: response.status, text });
        }
    }
    catch (error) {
        console.error('[ZICB] callback error', { queueId, callbackUrl, error });
    }
};
exports.notifyAppOfQueueResult = notifyAppOfQueueResult;
function buildPayload(payment) {
    const merged = mergeDefaults(payment);
    const amount = Number(merged.amount ?? 0);
    const payCurrency = merged.currency || merged.currencyCode || 'ZMW';
    const payDate = merged.transactionDate || new Date().toISOString().slice(0, 10);
    const transferRef = merged.transactionReference || '';
    const srcAcc = merged.srcAcc?.trim() || merged.accountNumber;
    const srcBranch = merged.srcBranch?.trim() || merged.branchCode;
    const srcName = merged.srcName?.trim() || merged.accountName || merged.vendorId || DEFAULT_USER_NAME;
    if (merged.transactionType === 'INT') {
        return {
            service: 'ZB8628',
            request: {
                destAcc: merged.accountNumber,
                destBranch: merged.branchCode,
                amount: String(amount),
                payDate,
                payCurrency,
                remarks: merged.remarks || transferRef,
                transferRef,
                swiftCode: merged.swiftCode || '',
                countryOfOrigin: merged.countryOfOrigin || '',
                senderAddress1: merged.physicalAddress?.streetName || '',
                senderAddress2: merged.physicalAddress?.town || '',
                senderAddress3: merged.physicalAddress?.plotNo || '',
            },
        };
    }
    return {
        service: 'BNK9900',
        request: {
            userName: DEFAULT_USER_NAME,
            customerId: merged.vendorId,
            ipAddress: merged.ipAddress,
            srcAcc,
            destAcc: merged.accountNumber,
            amount,
            destCurrency: payCurrency,
            srcCurrency: payCurrency,
            payCurrency,
            destBranch: merged.branchCode,
            srcBranch,
            srcName,
            bankName: merged.bankName || 'ZICB',
            sortCode: merged.sortCode || '',
            remarks: merged.remarks || transferRef,
            payDate,
            beneName: merged.accountName,
            senderName: srcName,
            senderEmail: merged.email || '',
            sendermobileno: merged.phoneNumber || '',
            beneEmail: '',
            beneMobileNo: '',
            senderAddress1: merged.physicalAddress?.streetName || '',
            senderAddress2: merged.physicalAddress?.town || '',
            senderAddress3: merged.physicalAddress?.plotNo || '',
            countryOfOrigin: merged.countryOfOrigin || '',
            transferTyp: merged.transactionType === 'DDACCT' ? 'DDACC' : merged.transactionType,
            swiftCode: merged.swiftCode || '',
            transferRef,
        },
    };
}
function prepareZicbPayload(payment) {
    const payload = (0, zicbValidation_1.isZicbServicePayload)(payment)
        ? { service: payment.service.trim(), request: { ...payment.request } }
        : buildPayload(payment);
    if (payload.service === 'BNK9900') {
        if (process.env.ZICB_USER_NAME)
            payload.request.userName = DEFAULT_USER_NAME;
        if (process.env.ZICB_IP_ADDRESS)
            payload.request.ipAddress = DEFAULT_IP_ADDRESS;
        payload.request.transferTyp = String(payload.request.transferTyp ?? '').trim().toUpperCase();
    }
    (0, zicbValidation_1.assertValidZicbPayload)(payload);
    return payload;
}
function buildPositiveResponse(payload) {
    const request = payload.request;
    const transferRef = String(request.transferRef || request.referenceNo || `ZICB-${Date.now()}`);
    const transactionId = `ZICB-${transferRef}`;
    return {
        responseCode: '00',
        responseMessage: 'Payment completed successfully',
        status: 'SUCCESS',
        bankCode: 'ZICB',
        service: payload.service,
        transactionId,
        transferRef,
        amount: request.amount,
        currency: request.payCurrency || request.destCurrency || request.srcCurrency || 'ZMW',
        completedAt: new Date().toISOString(),
    };
}
function readBankMessage(data) {
    if (!data || typeof data !== 'object')
        return '';
    const body = data;
    const nested = body.response && typeof body.response === 'object'
        ? body.response
        : undefined;
    for (const value of [
        body.responseMessage, body.message, body.error, body.description,
        nested?.responseMessage, nested?.message, nested?.error, nested?.description,
    ]) {
        if (typeof value === 'string' && value.trim())
            return value.trim();
    }
    return '';
}
function isBankBusinessFailure(data) {
    if (!data || typeof data !== 'object')
        return false;
    const body = data;
    const status = String(body.status ?? '').trim().toUpperCase();
    const responseCode = String(body.responseCode ?? '').trim().toUpperCase();
    return ['FAILED', 'FAILURE', 'ERROR', 'REJECTED', 'DECLINED'].includes(status)
        || Boolean(responseCode && !['00', '0', 'SUCCESS'].includes(responseCode));
}
async function sendZicbPayment(payment) {
    if (!QUEUE_URL && !MOCK_SUCCESS_RESPONSE) {
        throw new Error('Missing ZICB_BANK_API_URL environment variable');
    }
    const payload = prepareZicbPayload(payment);
    const body = JSON.stringify(payload);
    if (MOCK_SUCCESS_RESPONSE) {
        const data = buildPositiveResponse(payload);
        console.info('[ZICB] mock success response enabled', data);
        return {
            success: true,
            status: 200,
            data,
        };
    }
    if (!process.env.AUTH_KEY?.trim()) {
        throw new Error('Missing AUTH_KEY environment variable');
    }
    const queueUrl = QUEUE_URL;
    if (!queueUrl) {
        throw new Error('Missing ZICB_BANK_API_URL environment variable');
    }
    console.debug('[ZICB] sendZicbPayment request', {
        queueUrl,
        payloadType: (0, zicbValidation_1.isZicbServicePayload)(payment) ? 'servicePayload' : 'PaymentsResponse',
        payloadSummary: {
            service: (0, zicbValidation_1.isZicbServicePayload)(payment) ? payment.service : undefined,
            requestKeys: (0, zicbValidation_1.isZicbServicePayload)(payment) ? Object.keys(payment.request) : Object.keys(payload.request),
            amount: (0, zicbValidation_1.isZicbServicePayload)(payment) ? undefined : payment.amount,
            accountNumber: (0, zicbValidation_1.isZicbServicePayload)(payment) ? undefined : payment.accountNumber,
        },
    });
    let response;
    let text = '';
    try {
        response = await fetch(queueUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'AuthKey': process.env.AUTH_KEY || '',
            },
            body,
        });
    }
    catch (fetchError) {
        console.error('[ZICB] fetch failed', {
            queueUrl,
            error: fetchError,
            payload: JSON.parse(body),
        });
        throw fetchError;
    }
    try {
        text = await response.text();
    }
    catch (textError) {
        console.error('[ZICB] failed to read response text', {
            status: response.status,
            statusText: response.statusText,
            error: textError,
        });
        throw textError;
    }
    let data;
    try {
        data = text ? JSON.parse(text) : undefined;
    }
    catch (parseError) {
        console.warn('[ZICB] response JSON parse failed, using raw text', {
            status: response.status,
            statusText: response.statusText,
            text,
            error: parseError,
        });
        data = text;
    }
    const businessFailure = isBankBusinessFailure(data);
    const success = response.ok && !businessFailure;
    const bankMessage = readBankMessage(data);
    if (!success) {
        console.error('[ZICB] queue request failed', {
            status: response.status,
            statusText: response.statusText,
            body: text,
            data,
        });
    }
    return {
        success,
        status: response.status,
        data,
        error: success
            ? undefined
            : `ZICB rejected the transfer${bankMessage ? `: ${bankMessage}` : ''} (HTTP ${response.status})`,
    };
}
