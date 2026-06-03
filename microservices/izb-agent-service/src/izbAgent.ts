import fetch from 'node-fetch';
import { postCashbook } from './sageClient';
import { notifyAppOfQueueResult } from './notify';

export async function sendIzbPayment(payment: any) {
  // Build IZB-specific payload. This is a stub/mirrors ZICB structure.
  try {
    const payload = buildIzbPayload(payment);

    // Ideally, send to IZB bank endpoint here. For now simulate with a fetch if URL provided.
    const izbUrl = process.env.IZB_BANK_API_URL;
    if (izbUrl) {
      const resp = await fetch(izbUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, status: resp.status, error: text };
      }
    }

    // Simulate bank success
    return { success: true, status: 200, data: { posted: true } };
  } catch (err:any) {
    return { success: false, status: 500, error: String(err) };
  }
}

export function buildIzbPayload(payment: any) {
  const payload = {
    service: 'IZB-PAYMENTS',
    request: {
      amount: Number(payment?.amount || payment?.paymentAmount || 0),
      currency: payment?.currency || 'ZMW',
      destinationAccount: payment?.destinationAccount || payment?.accountNumber,
      reference: payment?.reference || payment?.transactionReference || `IZB-${Date.now()}`,
      vendorId: payment?.vendorId || payment?.vendor || null,
      remarks: payment?.remarks || payment?.narrative || null,
    },
  };
  return payload;
}

export async function notifyAppOfResult(queueId: string, result: any) {
  return notifyAppOfQueueResult(queueId, result);
}

export default { sendIzbPayment, buildIzbPayload };
import type { JobResult, PaymentsResponse, IzbServicePayload } from './types';

const QUEUE_URL = process.env.IZB_BANK_API_URL;
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');

function isIzbServicePayload(value: unknown): value is IzbServicePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).service === 'string' &&
    typeof (value as any).request === 'object' &&
    (value as any).request !== null
  );
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function buildCommonRequest(payment: PaymentsResponse) {
  const payDate = formatDate(payment.transactionDate);
  const amount = Number(payment.amount ?? 0);
  const payCurrency = payment.currency || payment.currencyCode || 'ZMW';
  const transferRef = payment.transactionReference || '';
  const remarks = payment.remarks || transferRef;
  const senderName = payment.accountName || payment.vendorId || 'SageSystem';

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
  };
}

function buildIzbPayload(payment: PaymentsResponse, transactionType?: string) {
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

async function postToQueue(payload: unknown): Promise<JobResult> {
  if (!QUEUE_URL) {
    throw new Error('Missing IZB_BANK_API_URL environment variable');
  }

  const response = await fetch(QUEUE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  return {
    success: response.ok,
    status: response.status,
    data,
    error: response.ok ? undefined : `IZB queue request failed with status ${response.status}`,
  };
}

export async function sendIzbPayment(payment: PaymentsResponse | IzbServicePayload): Promise<JobResult> {
  const payload = isIzbServicePayload(payment) ? { service: payment.service, request: payment.request } : buildIzbPayload(payment as PaymentsResponse, (payment as PaymentsResponse).transactionType);
  return postToQueue(payload);
}

export const notifyAppOfQueueResult = async (queueId: string, result: JobResult) => {
  if (!APP_API_URL) {
    console.warn('[IZB] APP_API_URL is not configured; skipping callback to app');
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
      console.error('[IZB] callback failed', { queueId, callbackUrl, status: response.status, text });
    }
  } catch (error) {
    console.error('[IZB] callback error', { queueId, callbackUrl, error });
  }
};

export default { sendIzbPayment };
