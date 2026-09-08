import type { PaymentsResponse, ZanacoPreparedRequest, ZanacoServicePayload } from './types';

const ZANACO_BIC = 'ZNCOZMLUXXX';
const ALNUM = /^[a-zA-Z0-9]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function amountValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

function formatDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (!raw) return '';
  if (DATE_RE.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function zanacoValueDate(value: unknown) {
  const formatted = formatDate(value);
  const today = todayIsoDate();
  if (!DATE_RE.test(formatted)) return today;
  return formatted < today ? today : formatted;
}

function isTodayOrFuture(date: string) {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return parsed.getTime() >= todayUtc.getTime();
}

function addressFrom(payment: PaymentsResponse) {
  return [
    payment.physicalAddress?.plotNo,
    payment.physicalAddress?.streetName,
    payment.physicalAddress?.town,
  ].map(text).filter(Boolean).join(', ');
}

function transferKind(payment: PaymentsResponse) {
  const raw = text(payment.transactionType).toUpperCase();
  if (raw === 'DDACCT') return 'DDAC';
  if (raw === 'TT') return 'SWIFT';
  if (raw === 'INT') return 'INTERNAL';
  if (raw === 'RTGS' || raw === 'DDAC' || raw === 'SWIFT') return raw;
  return raw || 'INTERNAL';
}

function ensureLength(errors: string[], field: string, value: string, max: number, required = true) {
  if (!value) {
    if (required) errors.push(`${field} is required`);
    return;
  }
  if (value.length > max) errors.push(`${field} must be ${max} characters or less`);
}

function validateExternalRef(errors: string[], value: string, max = 16) {
  if (!value) {
    errors.push('externalTranRef is required');
    return;
  }
  if (value.length < 6 || value.length > max) errors.push(`externalTranRef must be 6-${max} characters`);
  if (!ALNUM.test(value)) errors.push('externalTranRef must contain only letters and numbers');
}

export function buildZanacoRequest(payment: PaymentsResponse, source?: { accountNumber?: string | null; transit?: string | null; name?: string | null }): ZanacoPreparedRequest {
  const kind = transferKind(payment);
  const debitAccount = text(payment.srcAcc) || text(source?.accountNumber);
  const creditAccount = text(payment.accountNumber);
  const externalTranRef = text(payment.transactionReference || payment.paymentId).replace(/[^a-zA-Z0-9]/g, '').slice(0, kind === 'DDAC' ? 20 : 16);
  const ccy = text(payment.currency || payment.currencyCode || payment.currencyCde || 'ZMW').toUpperCase();
  const valueDate = zanacoValueDate(payment.transactionDate || new Date());
  const paymentDetails = text(payment.remarks || payment.transactionReference || 'IDC payment').slice(0, 105);
  const name = text(payment.accountName || payment.vendorId || 'Beneficiary').slice(0, 105);
  const address = (addressFrom(payment) || text(payment.bankName) || 'Zambia').slice(0, kind === 'SWIFT' ? 255 : 105);
  const amount = String(amountValue(payment.amount));

  if (payment.zanacoOperation === 'masked-disbursement') {
    return {
      service: 'ZANACO_MASKED_DISBURSEMENT',
      endpoint: '/zws-fcubs-service/api/v1/flex/maskedFundsTransfer',
      method: 'POST',
      transferType: 'MASKED',
      externalTranRef,
      request: {
        debitAccount,
        creditAccount,
        externalTranRef,
        ccy,
        amount,
        nrc: text(payment.nrc),
        valueDate,
        paymentDetails,
        transactionTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        name,
      },
    };
  }

  if (payment.zanacoOperation === 'collection') {
    return {
      service: 'ZANACO_COLLECTION',
      endpoint: '/zws-fcubs-service/api/v1/flex/collectionFundsTransfer',
      method: 'POST',
      transferType: 'COLLECTION',
      externalTranRef,
      request: {
        debitAccount: creditAccount,
        creditAccount: debitAccount,
        externalTranRef,
        ccy,
        amount,
        valueDate,
        paymentDetails,
        name,
        address,
        bicCode: text(payment.swiftCode) || ZANACO_BIC,
        ftContractRef: text(payment.ftContractRef),
      },
    };
  }

  if (kind === 'DDAC') {
    return {
      service: 'ZANACO_DDAC',
      endpoint: '/zws-fcubs-service/api/v1/flex/funds-transfer/ddac',
      method: 'POST',
      transferType: 'DDAC',
      externalTranRef,
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
        sortCode: text(payment.sortCode || payment.branchCode),
      },
    };
  }

  if (kind === 'SWIFT') {
    return {
      service: 'ZANACO_SWIFT',
      endpoint: '/zws-fcubs-service/api/v1/flex/swiftFundsTransfer',
      method: 'POST',
      transferType: 'SWIFT',
      externalTranRef,
      request: {
        debitAccount,
        creditAccount,
        externalTranRef,
        ccy,
        product: 'SWIFT',
        amount,
        valueDate,
        paymentDetails,
        name,
        address,
        bicCode: text(payment.swiftCode),
        tpin: text(payment.tpin || payment.tpIn),
        purposeCode: text(payment.purposeCode),
        sectorCode: text(payment.sectorCode),
      },
    };
  }

  return {
    service: kind === 'RTGS' ? 'ZANACO_RTGS' : 'ZANACO_INTERNAL',
    endpoint: '/zws-fcubs-service/api/v1/flex/fundsTransfer',
    method: 'POST',
    transferType: kind === 'RTGS' ? 'RTGS' : 'INTERNAL',
    externalTranRef,
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
      bicCode: kind === 'RTGS' ? text(payment.swiftCode) : ZANACO_BIC,
    },
  };
}

export function isZanacoServicePayload(value: unknown): value is ZanacoServicePayload {
  return !!value && typeof value === 'object' && typeof (value as { service?: unknown }).service === 'string'
    && !!(value as { request?: unknown }).request && typeof (value as { request?: unknown }).request === 'object';
}

export function validateZanacoPreparedRequest(payload: ZanacoPreparedRequest) {
  const errors: string[] = [];
  const request = payload.request ?? {};
  const val = (field: string) => text(request[field]);
  const amount = amountValue(request.amount);

  if (payload.method === 'POST' && !payload.endpoint.includes('/queryInstitutions') && !payload.endpoint.includes('/status') && !payload.endpoint.includes('/detail')) {
    if (!request || typeof request !== 'object') errors.push('request body is required');
  }

  if (payload.endpoint.includes('/biCodes/')) return errors;

  if ('debitAccount' in request) ensureLength(errors, 'debitAccount', val('debitAccount'), 20);
  if ('creditAccount' in request) ensureLength(errors, 'creditAccount', val('creditAccount'), 20);
  if ('amount' in request && (!Number.isFinite(amount) || amount <= 0)) errors.push('amount must be a positive number');
  if ('ccy' in request && !/^[A-Z]{3}$/.test(val('ccy'))) errors.push('ccy must be a three-letter ISO currency code');
  if ('valueDate' in request && !isTodayOrFuture(val('valueDate'))) errors.push('valueDate must be a valid YYYY-MM-DD date that is today or in the future');
  if ('externalTranRef' in request) validateExternalRef(errors, val('externalTranRef'), payload.transferType === 'DDAC' ? 20 : 16);
  if ('paymentDetails' in request) ensureLength(errors, 'paymentDetails', val('paymentDetails'), 105);
  if ('name' in request) ensureLength(errors, 'name', val('name'), 105);

  if (payload.transferType === 'INTERNAL' && val('bicCode') !== ZANACO_BIC) errors.push(`bicCode must be ${ZANACO_BIC} for internal Zanaco transfers`);
  if ((payload.transferType === 'RTGS' || payload.transferType === 'SWIFT') && !val('bicCode')) errors.push('bicCode is required');
  if (payload.transferType === 'DDAC' && !/^\d{6}$/.test(val('sortCode'))) errors.push('sortCode must be 6 digits for DDAC transfers');
  if (payload.transferType === 'SWIFT') {
    ensureLength(errors, 'address', val('address'), 255);
    ensureLength(errors, 'tpin', val('tpin'), 20);
    ensureLength(errors, 'purposeCode', val('purposeCode'), 8);
    ensureLength(errors, 'sectorCode', val('sectorCode'), 8);
  }
  if (payload.transferType === 'MASKED') {
    ensureLength(errors, 'nrc', val('nrc'), 20);
    ensureLength(errors, 'transactionTimestamp', val('transactionTimestamp'), 105);
  }
  if (payload.transferType === 'COLLECTION') {
    ensureLength(errors, 'ftContractRef', val('ftContractRef'), 16);
  }

  return errors;
}

export function validateZanacoServicePayload(payload: ZanacoServicePayload) {
  const errors: string[] = [];
  const request = payload.request ?? {};
  const val = (field: string) => text(request[field]);
  const requireFields = (fields: string[]) => fields.forEach((field) => {
    if (!val(field)) errors.push(`${field} is required`);
  });

  switch (payload.service) {
    case 'ZANACO_BALANCE_ENQUIRY':
    case 'ZANACO_ACCOUNT_LOOKUP':
      requireFields(['accountNumber']);
      break;
    case 'ZANACO_TRANSFER_STATUS':
      requireFields(['externalTranRef']);
      break;
    case 'ZANACO_ENHANCED_KYC': {
      const hasLookupKey = !!(val('accountNumber') || val('nrc') || val('phoneNumber'));
      if (!hasLookupKey) errors.push('one of accountNumber, nrc, or phoneNumber is required');
      requireFields(['amount']);
      if (!Number.isFinite(Number(request.amount)) || Number(request.amount) <= 0) errors.push('amount must be a positive number');
      const months = Number(request.numberOfMonths ?? request.numberOfMonth);
      if (!Number.isInteger(months) || months <= 0) errors.push('numberOfMonths must be a positive integer');
      if (val('month') && ![
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ].includes(val('month'))) errors.push('month must be a full month name');
      break;
    }
    case 'ZANACO_NFS_NAME_LOOKUP':
      requireFields(['instId', 'accountNumber']);
      break;
    case 'ZANACO_NFS_TRANSFER':
      requireFields(['debitAccount', 'creditAccount', 'instId', 'recipientName', 'amount', 'transactionRef']);
      if (!Number.isFinite(Number(request.amount)) || Number(request.amount) <= 0) errors.push('amount must be a positive number');
      break;
    case 'ZANACO_NFS_QUERY_INSTITUTIONS':
    case 'ZANACO_GET_RTGS_BIC':
    case 'ZANACO_GET_DDAC_BIC':
    case 'ZANACO_GET_SWIFT_BIC':
      break;
    default:
      errors.push(...validateZanacoPreparedRequest({
        service: payload.service,
        endpoint: '',
        method: 'POST',
        request,
      }));
  }

  return errors;
}

export function validateZanacoPayment(payment: PaymentsResponse, source?: { accountNumber?: string | null; transit?: string | null; name?: string | null }) {
  return validateZanacoPreparedRequest(buildZanacoRequest(payment, source));
}
