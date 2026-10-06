"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIzbPayload = buildIzbPayload;
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
exports.default = { buildIzbPayload };
