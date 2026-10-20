import type { PaymentsResponse } from '../../models/dtos';

function formatDate(value: string | Date) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function zanacoValueDate(value: string | Date | undefined) {
  const today = todayIsoDate();
  if (!value) return today;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return raw;
    return raw < today ? today : raw;
  }
  const formatted = formatDate(value);
  if (!formatted) return raw;
  return formatted < today ? today : formatted;
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

function referenceSuffix(seed: string) {
  let hash = BigInt('14695981039346656037');
  const mask = (BigInt(1) << BigInt(64)) - BigInt(1);
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash ^ BigInt(seed.charCodeAt(index))) * BigInt('1099511628211')) & mask;
  }
  return hash.toString(16).toUpperCase().padStart(16, '0');
}

function zanacoExternalTranRef(payment: PaymentsResponse, maxLength: number) {
  const seed = normalizeString(payment.paymentId || payment.transactionReference);
  if (!seed) return '';
  return `${referenceSuffix(seed)}${referenceSuffix(`IDC:${seed}`)}${referenceSuffix(`DDAC:${seed}`)}`.slice(0, maxLength);
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
  const normalizedTransactionType = String(transactionType || '').trim().toUpperCase();
  if (!['INT', 'RTGS', 'DDACCT', 'DDAC', 'TT', 'SWIFT'].includes(normalizedTransactionType)) {
    throw new Error('Unsupported Zanaco transaction type. Choose INT, RTGS, DDACCT or TT.');
  }
  const debitAccount = requestBase.srcAcc;
  const creditAccount = normalizeString(requestBase.accountNumber);
  const externalTranRef = zanacoExternalTranRef(payment, ['DDACCT', 'DDAC'].includes(normalizedTransactionType) ? 20 : 16);
  const ccy = normalizeString(payment.currency || payment.currencyCode).toUpperCase();
  const amount = ['string', 'number'].includes(typeof payment.amount) ? String(requestBase.amount) : 'NaN';
  const valueDate = zanacoValueDate(payment.transactionDate);
  const paymentDetails = requestBase.remarks.slice(0, 105);
  const name = normalizeString(requestBase.accountName);
  const address = [requestBase.plotNo, requestBase.streetName, requestBase.town].map(normalizeString).filter(Boolean).join(', ');

  if (normalizedTransactionType === 'INT') {
    return {
      service: 'ZANACO_INTERNAL',
      request: {
        debitAccount,
        creditAccount,
        externalTranRef,
        ccy,
        amount,
        valueDate,
        paymentDetails,
        name,
        address,
        bicCode: 'ZNCOZMLUXXX',
      },
    };
  }

  if (['TT', 'SWIFT'].includes(normalizedTransactionType)) {
    return {
      service: 'ZANACO_SWIFT',
      request: {
        debitAccount,
        creditAccount,
        externalTranRef,
        duplicatableExternalRef: normalizeString((payment as any).duplicatableExternalRef),
        ccy,
        product: 'SWIFT',
        amount,
        valueDate,
        paymentDetails,
        name,
        address: address.slice(0, 105),
        bicCode: normalizeString(requestBase.swiftCode),
        tpin: normalizeString((payment as any).tpin || (payment as any).tpIn),
        purposeCode: normalizeString((payment as any).purposeCode),
        sectorCode: normalizeString((payment as any).sectorCode),
      },
    };
  }

  if (['DDACCT', 'DDAC'].includes(normalizedTransactionType)) {
    return {
      service: 'ZANACO_DDAC',
      request: {
        debitAccount,
        creditAccount,
        externalTranRef,
        ccy,
        amount,
        valueDate,
        paymentDetails,
        name,
        address,
        sortCode: normalizeString(requestBase.sortCode) || normalizeString(requestBase.branchCode),
      },
    };
  }

  return {
    service: 'ZANACO_RTGS',
    request: {
      debitAccount,
      creditAccount,
      externalTranRef,
      ccy,
      amount,
      valueDate,
      paymentDetails,
      name,
      address,
      bicCode: normalizeString(requestBase.swiftCode),
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

export function validateZanacoPayload(payload: { service: string; request: Record<string, unknown> }) {
  const errors: string[] = [];
  if (!['ZANACO_INTERNAL', 'ZANACO_RTGS', 'ZANACO_DDAC', 'ZANACO_SWIFT'].includes(payload?.service)) {
    return ['Unsupported Zanaco payment service'];
  }
  if (!payload.request || typeof payload.request !== 'object' || Array.isArray(payload.request)) return ['request must be an object'];
  const request = payload.request;
  const value = (field: string) => String(request[field] ?? '').trim();
  const requireFields = (fields: string[]) => fields.forEach((field) => {
    if (!value(field)) errors.push(`request.${field} is required`);
  });
  const amount = ['string', 'number'].includes(typeof request.amount) ? Number(request.amount) : NaN;
  const transferRefMax = payload.service === 'ZANACO_DDAC' ? 20 : 16;
  const duplicatableExternalRef = value('duplicatableExternalRef');

  requireFields(['debitAccount', 'creditAccount', 'externalTranRef', 'ccy', 'amount', 'valueDate', 'paymentDetails', 'name']);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('request.amount must be a positive number');
  if (!/^[A-Z]{3}$/.test(value('ccy'))) errors.push('request.ccy must be a three-letter uppercase currency code');
  const valueDate = value('valueDate');
  const date = new Date(`${valueDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueDate) || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== valueDate || valueDate < todayIsoDate()) {
    errors.push('request.valueDate must be a valid YYYY-MM-DD date that is today or in the future');
  }
  for (const [field, max] of [['creditAccount', 20], ['paymentDetails', 105], ['name', 105]] as const) {
    if (value(field).length > max) errors.push(`request.${field} must be ${max} characters or less`);
  }
  if (value('externalTranRef').length < 6 || value('externalTranRef').length > transferRefMax || !/^[a-zA-Z0-9]+$/.test(value('externalTranRef'))) {
    errors.push(`request.externalTranRef must be 6-${transferRefMax} alphanumeric characters`);
  }
  if (duplicatableExternalRef && (duplicatableExternalRef.length < 36 || duplicatableExternalRef.length > 105)) {
    errors.push('request.duplicatableExternalRef must be 36-105 characters');
  }

  if (['ZANACO_INTERNAL', 'ZANACO_RTGS', 'ZANACO_SWIFT'].includes(payload.service) && value('debitAccount').length !== 13) {
    errors.push('request.debitAccount must be exactly 13 characters');
  }
  if (payload.service === 'ZANACO_INTERNAL' && value('bicCode') !== 'ZNCOZMLUXXX') {
    errors.push('request.bicCode must be ZNCOZMLUXXX for internal Zanaco transfers');
  }
  if (payload.service === 'ZANACO_INTERNAL' || payload.service === 'ZANACO_RTGS') {
    requireFields(['address', 'bicCode']);
    if (value('address').length > 105) errors.push('request.address must be 105 characters or less');
    if (value('bicCode').length > 11) errors.push('request.bicCode must be 11 characters or less');
  }
  if (payload.service === 'ZANACO_DDAC' && !/^\d{6}$/.test(value('sortCode'))) {
    errors.push('request.sortCode must be 6 digits for DDAC transfers');
  }
  if (payload.service === 'ZANACO_DDAC') {
    requireFields(['address']);
    if (value('debitAccount').length !== 13) errors.push('request.debitAccount must be exactly 13 characters for DDAC transfers');
    if (value('externalTranRef').length !== 20) errors.push('request.externalTranRef must be exactly 20 characters for DDAC transfers');
    if (value('address').length > 105) errors.push('request.address must be 105 characters or less');
  }
  if (payload.service === 'ZANACO_SWIFT') {
    requireFields(['product', 'address', 'bicCode', 'tpin', 'purposeCode', 'sectorCode']);
    if (value('product').length > 10) errors.push('request.product must be 10 characters or less');
    if (value('address').length > 105) errors.push('request.address must be 105 characters or less');
    if (value('bicCode').length > 11) errors.push('request.bicCode must be 11 characters or less');
    if (value('tpin').length > 20) errors.push('request.tpin must be 20 characters or less');
    if (value('purposeCode').length > 8) errors.push('request.purposeCode must be 8 characters or less');
    if (value('sectorCode').length > 8) errors.push('request.sectorCode must be 8 characters or less');
  }

  return errors;
}

export function validateZanacoPaymentSelection(payment: PaymentsResponse, transactionType: PaymentsResponse['transactionType'], source?: { accountNumber?: string | null }) {
  if (!source) return { valid: false, errors: ['Source account is required for Zanaco payments.'] };
  if (!String(payment.paymentId ?? '').trim()) return { valid: false, errors: ['A stable Sage paymentId is required for Zanaco payments.'] };
  try {
    const errors = validateZanacoPayload(buildZanacoPayload(payment, transactionType, source));
    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'Unable to validate Zanaco payment.'] };
  }
}

// Keep bulk queue validation aligned with the agent; parity is covered by tests.
export function validateZanacoBulkPayload(prepared: { service: string; request: Record<string, unknown> }) {
  const errors: string[] = [];
  const transferType = prepared.service.replace('ZANACO_BULK_', '');
  if (!['INTERNAL', 'RTGS', 'DDAC', 'SWIFT'].includes(transferType)) return ['Unsupported Zanaco bulk service'];
  const request = prepared.request ?? {};
  const items = Array.isArray(request.items) ? request.items as Record<string, unknown>[] : [];
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);
  const totalAmount = Number(request.totalAmount);
  const descriptionMax = transferType === 'RTGS' ? 500 : 140;
  const refMax = transferType === 'DDAC' ? 20 : 16;
  const refMin = transferType === 'DDAC' ? 16 : 1;
  const isBulkAccount = (value: string) => /^\d{9}$/.test(value) || /^\d{13}$/.test(value);

  if (!text(request.batchName)) errors.push('batchName is required');
  if (text(request.batchName).length > 100) errors.push('batchName must be 100 characters or less');
  if (text(request.description).length > descriptionMax) errors.push(`description must be ${descriptionMax} characters or less`);
  if (!/^[A-Z]{3}$/.test(text(request.currency).toUpperCase())) errors.push('currency must be a three-letter ISO currency code');
  if (!Number.isInteger(Number(request.totalCount)) || Number(request.totalCount) <= 0) errors.push('totalCount must be a positive integer');
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) errors.push('totalAmount must be a positive number');
  if (!items.length) errors.push('items must contain at least one transfer');
  if (items.length > 1000) errors.push('items cannot exceed 1000 transfers');
  if (Number(request.totalCount) !== items.length) errors.push('totalCount must match items length');
  if (items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return [...errors, 'items must contain transfer objects'];
  const refs = items.map(item => text(item.externalTranRef));
  if (new Set(refs).size !== refs.length) errors.push('externalTranRef must be unique within the batch');
  if (items.some(item => item.ccy && text(item.ccy).toUpperCase() !== text(request.currency).toUpperCase())) errors.push('all items must use the batch currency');
  if (items.some(item => item.valueDate && request.valueDate && text(item.valueDate) !== text(request.valueDate))) errors.push('all items must use the batch valueDate');

  const computedTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (items.length && Math.abs(computedTotal - totalAmount) > 0.01) errors.push('totalAmount must equal the sum of item amounts');

  items.forEach((item, index) => {
    const prefix = `items[${index}]`;
    const requireField = (field: string) => {
      if (!text(item[field])) errors.push(`${prefix}.${field} is required`);
    };
    requireField('debitAccount');
    requireField('creditAccount');
    requireField('externalTranRef');
    requireField('amount');
    requireField('name');
    if (text(item.debitAccount) && !isBulkAccount(text(item.debitAccount))) errors.push(`${prefix}.debitAccount must be 9 or 13 digits`);
    if (text(item.creditAccount) && !isBulkAccount(text(item.creditAccount))) errors.push(`${prefix}.creditAccount must be 9 or 13 digits`);
    if (text(item.externalTranRef) && (text(item.externalTranRef).length < refMin || text(item.externalTranRef).length > refMax)) {
      errors.push(`${prefix}.externalTranRef must be ${transferType === 'DDAC' ? '16-20' : '16 or fewer'} characters`);
    }
    if (text(item.name).length > 140) errors.push(`${prefix}.name must be 140 characters or less`);
    if (text(item.paymentDetails).length > 140) errors.push(`${prefix}.paymentDetails must be 140 characters or less`);
    if (!Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) errors.push(`${prefix}.amount must be positive`);
    if (transferType === 'RTGS' && !text(item.bicCode)) errors.push(`${prefix}.bicCode is required for RTGS`);
    if (transferType === 'DDAC' && !/^\d{6}$/.test(text(item.sortCode))) errors.push(`${prefix}.sortCode must be 6 digits for DDAC`);
    if (transferType === 'SWIFT') {
      ['address', 'bicCode', 'tpin', 'purposeCode', 'sectorCode'].forEach(requireField);
      if (text(item.address).length > 255) errors.push(`${prefix}.address must be 255 characters or less`);
    }
  });

  return errors;
}
