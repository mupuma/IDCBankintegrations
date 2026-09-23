"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareZicbPayload = prepareZicbPayload;
require("dotenv/config");
const zicbValidation_1 = require("./zicbValidation");
const DEFAULT_SOURCE_ACCOUNT = process.env.ZICB_SOURCE_ACCOUNT ?? '';
const DEFAULT_SOURCE_BRANCH = process.env.ZICB_SOURCE_BRANCH ?? '';
const DEFAULT_USER_NAME = process.env.ZICB_USER_NAME ?? 'SageSystem';
const DEFAULT_CUSTOMER_ID = process.env.ZICB_CUSTOMER_ID ?? '';
const DEFAULT_IP_ADDRESS = process.env.ZICB_IP_ADDRESS ?? '0.0.0.0';
const MOBILE_MONEY_TRANSFER_TYPE = (process.env.ZICB_MOBILE_MONEY_TRANSFER_TYPE || 'MOBILE_MONEY').trim().toUpperCase();
function text(value) {
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}
function mobileNumber(value) {
    return text(value).replace(/[^\d+]/g, '');
}
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
function buildPayload(payment) {
    const merged = mergeDefaults(payment);
    const amount = Number(merged.amount ?? 0);
    const payCurrency = merged.currency || merged.currencyCode || 'ZMW';
    const payDate = merged.transactionDate || new Date().toISOString().slice(0, 10);
    const transferRef = merged.transactionReference || '';
    const transactionType = text(merged.transactionType).toUpperCase();
    const isMobileMoney = transactionType === 'MOBILE_MONEY' || transactionType === MOBILE_MONEY_TRANSFER_TYPE;
    const beneficiaryMobileNumber = mobileNumber(merged.phoneNumber || merged.accountNumber);
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
            destAcc: isMobileMoney ? beneficiaryMobileNumber : merged.accountNumber,
            amount,
            destCurrency: payCurrency,
            srcCurrency: payCurrency,
            payCurrency,
            destBranch: isMobileMoney ? '' : merged.branchCode,
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
            beneMobileNo: isMobileMoney ? beneficiaryMobileNumber : (merged.phoneNumber || ''),
            senderAddress1: merged.physicalAddress?.streetName || '',
            senderAddress2: merged.physicalAddress?.town || '',
            senderAddress3: merged.physicalAddress?.plotNo || '',
            countryOfOrigin: merged.countryOfOrigin || '',
            transferTyp: transactionType === 'DDACCT' ? 'DDACC' : isMobileMoney ? MOBILE_MONEY_TRANSFER_TYPE : transactionType,
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
