import type { PaymentsResponse } from '../../models/dtos';

function formatDate(value: string | Date) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function normalizeString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

function buildCommonRequest(payment: PaymentsResponse, source?: any) {
  const payDate = formatDate(payment.transactionDate);
  const amount = Number(payment.amount ?? 0);
  const payCurrency = payment.currency || payment.currencyCode || 'ZMW';
  const transferRef = payment.transactionReference || '';
  const remarks = payment.remarks || transferRef;
  const senderName = payment.accountName || payment.vendorId || 'SageSystem';
  const srcAcc = normalizeString(source?.accountNumber);
  const srcBranch = normalizeString(source?.transit);
  const srcName = normalizeString(source?.name) || senderName;

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
        srcAcc: requestBase.srcAcc,
        srcBranch: requestBase.srcBranch,
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
        srcAcc: requestBase.srcAcc,
        srcBranch: requestBase.srcBranch,
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
      userName: 'SageSystem',
      customerId: baseRequest.customerId,
      ipAddress: '0.0.0.0',
      srcAcc: baseRequest.srcAcc,
      destAcc,
      amount,
      destCurrency: payCurrency,
      srcCurrency: payCurrency,
      payCurrency,
      transferTyp: transactionType === 'DDACCT' ? 'DDACC' : transactionType,
      destBranch,
      srcBranch: baseRequest.srcBranch,
      bankName: baseRequest.bankName,
      sortCode: baseRequest.sortCode,
      remarks: baseRequest.remarks,
      payDate,
      beneName: baseRequest.accountName,
      senderName: baseRequest.srcName,
      senderEmail: baseRequest.email,
      sendermobileno: baseRequest.phoneNumber,
      beneEmail: baseRequest.email,
      beneMobileNo: baseRequest.phoneNumber,
      senderAddress1,
      senderAddress2,
      senderAddress3,
      swiftCode: baseRequest.swiftCode,
      transferRef,
    },
  };
}

export function validateZicbPayload(payload: { service: string; request: Record<string, unknown> }) {
  const errors: string[] = [];
  const request = payload.request;
  const value = (field: string) => String(request[field] ?? '').trim();
  const requireFields = (fields: string[]) => fields.forEach((field) => {
    if (!value(field)) errors.push(`request.${field} is required`);
  });
  const validateDate = () => {
    const date = value('payDate');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      errors.push('request.payDate must be a valid YYYY-MM-DD date');
    }
  };
  const amount = Number(request.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('request.amount must be a positive number');

  if (payload.service === 'ZB8628') {
    requireFields(['destAcc', 'destBranch', 'payDate', 'payCurrency', 'remarks', 'transferRef']);
    validateDate();
    if (!/^[A-Z]{3}$/.test(value('payCurrency').toUpperCase())) errors.push('request.payCurrency must be a three-letter currency code');
    return errors;
  }

  if (payload.service !== 'BNK9900') return ['service must be ZB8628 or BNK9900'];
  requireFields([
    'userName', 'customerId', 'ipAddress', 'srcAcc', 'destAcc', 'destCurrency',
    'srcCurrency', 'payCurrency', 'transferTyp', 'destBranch', 'srcBranch',
    'bankName', 'sortCode', 'remarks', 'payDate', 'beneName', 'senderName',
    'senderAddress1', 'senderAddress2', 'senderAddress3',
  ]);
  if (!['RTGS', 'DDACC'].includes(value('transferTyp').toUpperCase())) errors.push('request.transferTyp must be RTGS or DDACC');
  validateDate();
  for (const field of ['destCurrency', 'srcCurrency', 'payCurrency']) {
    if (!/^[A-Z]{3}$/.test(value(field).toUpperCase())) errors.push(`request.${field} must be a three-letter currency code`);
  }
  return errors;
}
