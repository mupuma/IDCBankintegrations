"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIzbPayload = buildIzbPayload;
exports.sendIzbPayment = sendIzbPayment;
const IZB_BANK_API_URL = process.env.IZB_BANK_API_URL;
function isIzbServicePayload(value) {
    return (typeof value === 'object' &&
        value !== null &&
        typeof value.service === 'string' &&
        typeof value.request === 'object' &&
        value.request !== null);
}
function formatDate(value) {
    if (!value)
        return new Date().toISOString().slice(0, 10);
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}
function buildCommonRequest(payment) {
    const transferRef = payment.transactionReference || payment.paymentId || `IZB-${Date.now()}`;
    const amount = Number(payment.amount ?? 0);
    const payCurrency = payment.currency || payment.currencyCode || 'ZMW';
    return {
        payDate: formatDate(payment.transactionDate),
        amount,
        payCurrency,
        remarks: payment.remarks || transferRef,
        transferRef,
        customerId: payment.vendorId || '',
        bankName: payment.bankName || '',
        accountName: payment.accountName || '',
        accountNumber: payment.accountNumber || '',
        branchCode: payment.branchCode || '',
        sortCode: payment.sortCode || '',
        swiftCode: payment.swiftCode || '',
        countryOfOrigin: payment.countryOfOrigin || '',
        recipientCountry: payment.countryOfOrigin || '',
        email: payment.email || '',
        phoneNumber: payment.phoneNumber || '',
        streetName: payment.physicalAddress?.streetName || '',
        town: payment.physicalAddress?.town || '',
        plotNo: payment.physicalAddress?.plotNo || '',
        senderName: payment.accountName || payment.vendorId || 'SageSystem',
    };
}
function buildIzbPayload(payment, transactionType) {
    const requestBase = buildCommonRequest(payment);
    if (transactionType === 'INT') {
        return {
            service: 'IZB_INT',
            request: {
                destAcc: requestBase.accountNumber,
                destBranch: requestBase.branchCode,
                amount: String(requestBase.amount),
                payDate: requestBase.payDate,
                payCurrency: requestBase.payCurrency,
                remarks: requestBase.remarks,
                transferRef: requestBase.transferRef,
                swiftCode: requestBase.swiftCode,
                countryOfOrigin: requestBase.countryOfOrigin,
                recipientCountry: requestBase.recipientCountry,
                streetName: requestBase.streetName,
                town: requestBase.town,
                plotNo: requestBase.plotNo,
            },
        };
    }
    return {
        service: 'IZB_DOM',
        request: {
            ...requestBase,
            transferTyp: transactionType === 'DDACCT' ? 'DDACC' : transactionType,
            destAcc: requestBase.accountNumber,
            destBranch: requestBase.branchCode,
            srcAcc: requestBase.accountNumber,
            srcBranch: requestBase.branchCode,
        },
    };
}
async function postToIzb(payload) {
    if (!IZB_BANK_API_URL) {
        throw new Error('Missing IZB_BANK_API_URL environment variable');
    }
    const response = await fetch(IZB_BANK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : undefined;
    }
    catch {
        data = text;
    }
    return {
        success: response.ok,
        status: response.status,
        data,
        error: response.ok ? undefined : `IZB request failed with status ${response.status}`,
    };
}
async function sendIzbPayment(payment) {
    const payload = isIzbServicePayload(payment)
        ? { service: payment.service, request: payment.request }
        : buildIzbPayload(payment, payment.transactionType);
    return postToIzb(payload);
}
exports.default = { sendIzbPayment, buildIzbPayload };
