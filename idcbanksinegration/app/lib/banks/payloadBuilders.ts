import type { PaymentsResponse } from '../../models/dtos';

function formatDate(value: string | Date) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function buildCommonRequest(payment: PaymentsResponse, source?: any) {
  const payDate = formatDate(payment.transactionDate);
  const amount = Number(payment.amount ?? 0);
  const payCurrency = payment.currency || payment.currencyCode || 'ZMW';
  const transferRef = payment.transactionReference || '';
  const remarks = payment.remarks || transferRef;
  const senderName = payment.accountName || payment.vendorId || 'SageSystem';
  const srcAcc = source?.accountNumber || payment.accountNumber || '';
  const srcBranch = source?.transit || payment.branchCode || '';
  const srcName = source?.name || senderName;

  return {
    payDate,
    amount,
    payCurrency,
    remarks,
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
    senderName,
    // source account overrides
    srcAcc,
    srcBranch,
    srcName,
  };
}

export function buildIzbPayload(payment: PaymentsResponse, transactionType: PaymentsResponse['transactionType'], source?: any) {
  const requestBase = buildCommonRequest(payment, source);

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
        srcAcc: requestBase.srcAcc || requestBase.accountNumber,
        srcBranch: requestBase.srcBranch || requestBase.branchCode,
        srcName: requestBase.srcName,
      },
    };
}

export function buildZanacoPayload(payment: PaymentsResponse, transactionType: PaymentsResponse['transactionType'], source?: any) {
  const requestBase = buildCommonRequest(payment, source);

  if (transactionType === 'INT') {
    return {
      service: 'ZANACO_INT',
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
      service: 'ZANACO_DOM',
      request: {
        ...requestBase,
        transferTyp: transactionType === 'DDACCT' ? 'DDACC' : transactionType,
        destAcc: requestBase.accountNumber,
        destBranch: requestBase.branchCode,
        srcAcc: requestBase.srcAcc || requestBase.accountNumber,
        srcBranch: requestBase.srcBranch || requestBase.branchCode,
        srcName: requestBase.srcName,
      },
    };
}

export function buildZicbPayload(payment: PaymentsResponse, transactionType: PaymentsResponse['transactionType'], source?: any) {
  const payDate = formatDate(payment.transactionDate);
  const destAcc = payment.accountNumber;
  const destBranch = payment.branchCode || '';
  const transferRef = payment.transactionReference || '';
  const payCurrency = payment.currency || payment.currencyCode || 'ZMW';
  const amount = Number(payment.amount ?? 0);
  const senderAddress1 = payment.physicalAddress?.streetName || '';
  const senderAddress2 = payment.physicalAddress?.town || '';
  const senderAddress3 = payment.physicalAddress?.plotNo || '';

  const baseRequest = buildCommonRequest(payment, source);


  if (transactionType === 'INT') {
    return {
      service: 'ZB8628',
      request: {
        destAcc,
        destBranch,
        amount: String(amount),
        payDate,
        payCurrency,
        remarks: payment.remarks || transferRef,
        transferRef,
        swiftCode: payment.swiftCode || '',
        countryOfOrigin: payment.countryOfOrigin || '',
        senderAddress1,
        senderAddress2,
        senderAddress3,
      },
    };
  }

  return {
    service: 'BNK9900',
    request: {
      ...baseRequest,
      transferTyp: transactionType === 'DDACCT' ? 'DDACC' : transactionType,
    },
  };
}
