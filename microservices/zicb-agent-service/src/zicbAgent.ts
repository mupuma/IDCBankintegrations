import type { JobResult, PaymentsResponse } from './types';

const QUEUE_URL = process.env.ZICB_BANK_API_URL;
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');
const DEFAULT_SOURCE_ACCOUNT = process.env.ZICB_SOURCE_ACCOUNT ?? '';
const DEFAULT_SOURCE_BRANCH = process.env.ZICB_SOURCE_BRANCH ?? '';
const DEFAULT_USER_NAME = process.env.ZICB_USER_NAME ?? 'SageSystem';
const DEFAULT_CUSTOMER_ID = process.env.ZICB_CUSTOMER_ID ?? '';
const DEFAULT_IP_ADDRESS = process.env.ZICB_IP_ADDRESS ?? '0.0.0.0';

function mergeDefaults(payment: PaymentsResponse): PaymentsResponse {
  return {
    ...payment,
    accountNumber: payment.accountNumber || DEFAULT_SOURCE_ACCOUNT,
    branchCode: payment.branchCode || DEFAULT_SOURCE_BRANCH,
    accountName: payment.accountName || DEFAULT_USER_NAME,
    vendorId: payment.vendorId || DEFAULT_CUSTOMER_ID,
    ipAddress: payment.ipAddress || DEFAULT_IP_ADDRESS,
  };
}

export interface ZicbServicePayload {
  service: string;
  request: Record<string, unknown>;
}

function isZicbServicePayload(value: unknown): value is ZicbServicePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).service === 'string' &&
    typeof (value as any).request === 'object' &&
    (value as any).request !== null
  );
}

export const notifyAppOfQueueResult = async (queueId: string, result: JobResult) => {
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
  } catch (error) {
    console.error('[ZICB] callback error', { queueId, callbackUrl, error });
  }
}

function buildPayload(payment: PaymentsResponse) {
  const merged = mergeDefaults(payment);
  const amount = Number(merged.amount ?? 0);
  const payCurrency = merged.currency || merged.currencyCode || 'ZMW';
  const payDate = merged.transactionDate || new Date().toISOString().slice(0, 10);
  const transferRef = merged.transactionReference || '';

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
      userName: merged.accountName,
      customerId: merged.vendorId,
      ipAddress: merged.ipAddress,
      srcAcc: merged.accountNumber,
      destAcc: merged.accountNumber,
      amount,
      destCurrency: payCurrency,
      srcCurrency: payCurrency,
      payCurrency,
      destBranch: merged.branchCode,
      srcBranch: merged.branchCode,
      bankName: merged.bankName || 'ZICB',
      sortCode: merged.sortCode || '',
      remarks: merged.remarks || transferRef,
      payDate,
      beneName: merged.accountName,
      senderName: merged.accountName || merged.vendorId,
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

export async function sendZicbPayment(payment: PaymentsResponse | ZicbServicePayload): Promise<JobResult> {
  if (!QUEUE_URL) {
    throw new Error('Missing ZICB_BANK_API_URL environment variable');
  }

  const payload = isZicbServicePayload(payment)
    ? { service: payment.service, request: payment.request }
    : buildPayload(payment);
  const body = JSON.stringify(payload);

  console.debug('[ZICB] sendZicbPayment request', {
    queueUrl: QUEUE_URL,
    payloadType: isZicbServicePayload(payment) ? 'servicePayload' : 'PaymentsResponse',
    payloadSummary: {
      service: isZicbServicePayload(payment) ? payment.service : undefined,
      requestKeys: isZicbServicePayload(payment) ? Object.keys(payment.request) : Object.keys(payload.request),
      amount: isZicbServicePayload(payment) ? undefined : payment.amount,
      accountNumber: isZicbServicePayload(payment) ? undefined : payment.accountNumber,
    },
  });

  let response;
  let text = '';
  try {
    response = await fetch(QUEUE_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        "Authkey": process.env.AUTH_KEY || '',
        "ServiceKey": process.env.SERVICE_ID || '',
      },
      body,
    });
  } catch (fetchError) {
    console.error('[ZICB] fetch failed', {
      queueUrl: QUEUE_URL,
      error: fetchError,
      payload: JSON.parse(body),
    });
    throw fetchError;
  }

  try {
    text = await response.text();
  } catch (textError) {
    console.error('[ZICB] failed to read response text', {
      status: response.status,
      statusText: response.statusText,
      error: textError,
    });
    throw textError;
  }

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch (parseError) {
    console.warn('[ZICB] response JSON parse failed, using raw text', {
      status: response.status,
      statusText: response.statusText,
      text,
      error: parseError,
    });
    data = text;
  }

  if (!response.ok) {
    console.error('[ZICB] queue request failed', {
      status: response.status,
      statusText: response.statusText,
      body: text,
      data,
    });
  }

  return {
    success: response.ok,
    status: response.status,
    data,
    error: response.ok ? undefined : `ZICB send failed with status ${response.status}`,
  };
}
