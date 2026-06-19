'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdaptiveQueuePolling } from '@/app/lib/useAdaptiveQueuePolling';
import { motion, AnimatePresence } from 'framer-motion';
import type { PaymentsResponse, BankCode } from '@/app/models/dtos';
import type { BankQueueItem } from '@/app/lib/bankQueue';
import { buildIzbPayload, buildZanacoPayload, buildZicbPayload } from '@/app/lib/banks/payloadBuilders';

const BANK_CODES: BankCode[] = ['IZB', 'ZANACO', 'ZICB'];
const TRANSACTION_TYPES: PaymentsResponse['transactionType'][] = ['RTGS', 'DDACCT', 'INT', 'TT'];
const ACTIVE_POST_STATUSES = new Set(['queued', 'processing', 'success', 'pulled']);

function postKey(paymentId: string, bankCode: string) {
  return `${paymentId}:${bankCode}`;
}

type QueueStatus = 'queued' | 'processing' | 'success' | 'failed' | 'pulled';

type PostedPaymentRecord = {
  bankCode: BankCode;
  queueId: string;
  status: QueueStatus;
  lastError?: string;
  response?: unknown;
};

type QueueStatusRecord = {
  queueId: string;
  status: QueueStatus;
  lastError?: string;
  response?: unknown;
};

interface EnrichedPayment extends PaymentsResponse {
  bank: any;
  entries: any;
  paymentId: string;
  bankDetailsFound: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ProcessedTransactionRecord {
  transactionId: string;
  bankCode: string;
  description: string;
  noEntries: number;
  creditAmount: number;
  debitAmount: number;
  statusCode: number;
  statusMessage?: string;
  processedDate: string;
  createdAt: string;
  updatedAt: string;
}

type BankValidationRule = {
  required: Array<keyof PaymentsResponse>;
  transactionTypeRules?: Partial<Record<PaymentsResponse['transactionType'], Array<keyof PaymentsResponse>>>;
  customValidators?: Array<(payment: EnrichedPayment) => string | null>;
};

const BANK_VALIDATION_CONFIG: Record<BankCode, BankValidationRule> = {
  IZB: {
    required: [
      'accountNumber',
      'accountName',
      'branchCode',
      'sortCode',
      'swiftCode',
      'vendorId',
      'amount',
      'currency',
      'transactionReference',
      'transactionDate',
      'transactionType',
      'bankName',
    ],
    transactionTypeRules: {
      RTGS: ['swiftCode', 'transactionDate', 'transactionReference'],
      INT: ['swiftCode', 'currencyCode', 'transactionDate'],
      TT: ['swiftCode', 'transactionDate'],
      DDACCT: ['sortCode', 'branchCode', 'transactionReference'],
    },
    customValidators: [(payment) => {
      if (payment.amount > 500000 && payment.transactionType !== 'RTGS') {
        return 'Payments exceeding 500,000 must use RTGS for IZB';
      }
      return null;
    }],
  },
  ZANACO: {
    required: [
      'accountNumber',
      'accountName',
      'branchCode',
      'sortCode',
      'vendorId',
      'amount',
      'currency',
      'transactionReference',
      'transactionDate',
      'transactionType',
      'bankName',
    ],
    transactionTypeRules: {
      RTGS: ['swiftCode', 'transactionReference'],
      INT: ['swiftCode', 'currencyCode', 'countryOfOrigin'],
      TT: ['swiftCode'],
      DDACCT: ['sortCode'],
    },
  },
  ZICB: {
    required: [
      'accountNumber',
      'accountName',
      'branchCode',
      'sortCode',
      'vendorId',
      'amount',
      'currency',
      'transactionReference',
      'transactionDate',
      'transactionType',
      'bankName',
    ],
    transactionTypeRules: {
      RTGS: ['swiftCode', 'transactionReference'],
      INT: ['transactionReference'],
      TT: ['swiftCode', 'transactionDate'],
      DDACCT: ['sortCode', 'transactionReference'],
    },
  },
};

function formatDate(value: string | Date) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? 'N/A' : date.toISOString().slice(0, 10);
}

function formatPayload(
  payment: EnrichedPayment,
  bankCode?: BankCode,
  transactionType?: PaymentsResponse['transactionType'],
  source?: string | null,
) {
  const effectiveType = transactionType ?? payment.transactionType;

  let raw: any = null;

  if (bankCode === 'IZB') {
    const res = buildIzbPayload(payment, effectiveType, source || undefined);
    raw = res?.request ?? res;
  } else if (bankCode === 'ZANACO') {
    const res = buildZanacoPayload(payment, effectiveType, source || undefined);
    raw = res?.request ?? res;
  } else if (bankCode === 'ZICB') {
    const res = buildZicbPayload(payment, effectiveType, source || undefined);
    raw = res?.request ?? res;
  }

  // Normalize payload keys so PayloadView can read common fields
  const merged = {
    ...payment,
    transactionType: effectiveType,
    // prefer explicit bank payload values when present
    amount: raw && raw.amount !== undefined ? Number(raw.amount) : Number(payment.amount ?? 0),
    currency: raw?.payCurrency || raw?.currency || payment.currency || payment.currencyCode || '',
    transactionReference: raw?.transferRef || raw?.transactionReference || payment.transactionReference || '',
    transactionDate: raw?.payDate || payment.transactionDate || formatDate(payment.transactionDate),
    accountName: raw?.accountName || payment.accountName || '',
    accountNumber: raw?.accountNumber || payment.accountNumber || '',
    bankName: raw?.bankName || payment.bankName || raw?.bank || payment.bank || '',
    entries: raw?.entries || payment.entries || [],
    // include other raw fields for debugging/visibility
    _raw: raw,
  };

  return merged;
}

function PayloadView({ payload }: { payload: any }) {
  const p = payload || {};
  const amount = p.amount ?? p.creditAmount ?? p.debitAmount ?? 0;
  const currency = p.currency || p.currencyCode || '';
  const reference = p.transactionReference || p.referenceNo || p.Reference || p.Description || '';
  const vendor = p.vendorId || p.accountName || p.accountNumber || 'N/A';
  const date = p.transactionDate || p.date || p.transactionDate;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Reference</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{reference}</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Vendor / Account</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{vendor}</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{Number(amount).toFixed(2)} {currency}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Transaction Type</p>
          <p className="mt-1 text-sm text-slate-900">{p.transactionType || p.type || 'N/A'}</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Bank</p>
          <p className="mt-1 text-sm text-slate-900">{p.bankName || p.bankCode || 'N/A'}</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Transaction Date</p>
          <p className="mt-1 text-sm text-slate-900">{date ? new Date(date).toLocaleString() : 'N/A'}</p>
        </div>
      </div>

      {Array.isArray(p.entries) && p.entries.length > 0 ? (
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500">Entries</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 text-xs">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Currency</th>
                </tr>
              </thead>
              <tbody>
                {p.entries.map((e: any, idx: number) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-slate-700">{e.entryNo ?? idx + 1}</td>
                    <td className="px-2 py-2 text-slate-700">{e.referenceNo || e.reference || '—'}</td>
                    <td className="px-2 py-2 text-slate-700">{e.customerNo || e.customer || '—'}</td>
                    <td className="px-2 py-2 text-slate-700">{Number(e.amount || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-slate-700">{e.currency || currency || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {p.entries.map((e: any, idx: number) => (
            Array.isArray(e.details) && e.details.length > 0 ? (
              <div key={`d-${idx}`} className="mt-3">
                <p className="text-xs text-slate-500">Details for entry {e.entryNo ?? idx + 1}</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs">
                        <th className="px-2 py-2">Detail #</th>
                        <th className="px-2 py-2">Account</th>
                        <th className="px-2 py-2">Description</th>
                        <th className="px-2 py-2">Dr/Cr</th>
                        <th className="px-2 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.details.map((d: any, j: number) => (
                        <tr key={j} className="border-t border-slate-100">
                          <td className="px-2 py-2 text-slate-700">{d.detailNo ?? j + 1}</td>
                          <td className="px-2 py-2 text-slate-700">{d.accountId || d.account || '—'}</td>
                          <td className="px-2 py-2 text-slate-700">{d.entryDescription || d.description || '—'}</td>
                          <td className="px-2 py-2 text-slate-700">{d.DrCr || d.drcr || '—'}</td>
                          <td className="px-2 py-2 text-slate-700">{Number(d.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-sm text-slate-700">No structured entries available to preview.</p>
        </div>
      )}
    </div>
  );
}

function isTransactionTypeAllowed(payment: EnrichedPayment, bankCode?: BankCode | '', transactionType?: PaymentsResponse['transactionType']) {
  return true;
}

function getEffectiveTransactionType(payment: EnrichedPayment, transactionOverrides: Record<string, PaymentsResponse['transactionType']>) {
  return transactionOverrides[payment.paymentId] ?? payment.transactionType;
}

function validatePayment(payment: EnrichedPayment, bankCode: BankCode, transactionType: PaymentsResponse['transactionType']): ValidationResult {
  const errors: string[] = [];
  const rule = BANK_VALIDATION_CONFIG[bankCode];

  rule.required.forEach((field: keyof PaymentsResponse) => {
    const value = (payment as any)[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`Missing required ${field} for ${bankCode}`);
    }
  });

  const transactionSpecific = rule.transactionTypeRules?.[transactionType];
  if (transactionSpecific) {
    transactionSpecific.forEach((field: keyof PaymentsResponse) => {
      const value = (payment as any)[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`Missing ${field} for ${bankCode} ${transactionType} payment`);
      }
    });
  }

  const currency = String(payment.currency || payment.currencyCode || '').toUpperCase();
  const isForex = currency === 'USD' || currency === 'ZAR';

  if ((bankCode === 'IZB' && transactionType === 'RTGS') || transactionType === 'INT') {
    if (!payment.swiftCode || !String(payment.swiftCode).trim()) {
      errors.push('SWIFT code is required for RTGS and International payments.');
    }
    if (!payment.physicalAddress?.streetName?.trim() || !payment.physicalAddress?.town?.trim() || !payment.physicalAddress?.plotNo?.trim()) {
      errors.push('Physical address (Plot no, Street name, Town) is required for IZB RTGS and International payments.');
    }
    if (!payment.countryOfOrigin || !String(payment.countryOfOrigin).trim()) {
      errors.push('Recipient country is required for IZB RTGS and International payments.');
    }
  }

  if (transactionType === 'DDACCT') {
    if (!payment.sortCode || !String(payment.sortCode).trim()) {
      errors.push('Sort code is required for DDACC payments.');
    }
  }

  if (isForex) {
    if (!payment.physicalAddress?.streetName?.trim() || !payment.physicalAddress?.town?.trim() || !payment.physicalAddress?.plotNo?.trim()) {
      errors.push('For forex payments (USD, ZAR), beneficiary address information is required: Plot no, Street name, and Town.');
    }
    if (!payment.countryOfOrigin || !String(payment.countryOfOrigin).trim()) {
      errors.push('Recipient country is required for forex payments.');
    }
  }

  rule.customValidators?.forEach((validator) => {
    const error = validator(payment);
    if (error) {
      errors.push(error);
    }
  });

  if (!payment.bankDetailsFound) {
    errors.push('Vendor bank details are not available for this payment');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default function PaymentQueueDashboard() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payments, setPayments] = useState<EnrichedPayment[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<Record<string, BankCode | ''>>({});
  const [transactionOverrides, setTransactionOverrides] = useState<Record<string, PaymentsResponse['transactionType']>>({});
  const [queueStatuses, setQueueStatuses] = useState<Record<string, QueueStatusRecord>>({});
  const [postedPayments, setPostedPayments] = useState<Record<string, PostedPaymentRecord>>({});
  const [bankQueueItems, setBankQueueItems] = useState<BankQueueItem[]>([]);
  const [sourceBanks, setSourceBanks] = useState<Array<any>>([]);
  const [selectedSources, setSelectedSources] = useState<Record<string, string>>({});
  const [selectedBankTab, setSelectedBankTab] = useState<BankCode | 'ALL'>('ALL');
  const [queueLoading, setQueueLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewPaymentId, setPreviewPaymentId] = useState<string | null>(null);
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransactionRecord[]>([]);
  const [processedLoading, setProcessedLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const previewPayment = useMemo(
    () => payments.find((row) => row.paymentId === previewPaymentId) ?? null,
    [previewPaymentId, payments],
  );

  const totalPages = Math.max(1, Math.ceil(payments.length / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);
  const pagedPayments = payments.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);
  const filteredQueueItems = selectedBankTab === 'ALL'
    ? bankQueueItems
    : bankQueueItems.filter((item) => item.bankCode === selectedBankTab);

  const clearMessage = () => {
    setTimeout(() => setMessage(null), 4000);
  };

  const syncPostedStatusesFromQueueItems = (items: BankQueueItem[]) => {
    const postedByPayment: Record<string, PostedPaymentRecord> = {};

    setQueueStatuses((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!item.paymentId || !item.bankCode || !ACTIVE_POST_STATUSES.has(item.status)) {
          continue;
        }
        const key = postKey(item.paymentId, item.bankCode);
        next[key] = {
          queueId: item.id,
          status: item.status,
          lastError: item.lastError,
          response: item.response,
        };
        postedByPayment[item.paymentId] = {
          bankCode: item.bankCode,
          queueId: item.id,
          status: item.status,
          lastError: item.lastError,
          response: item.response,
        };
      }
      return next;
    });

    setPostedPayments(postedByPayment);
  };

  const loadQueueItems = useCallback(async (): Promise<BankQueueItem[]> => {
    setQueueLoading(true);
    try {
      const response = await fetch('/api/v1/posted_payments');
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not fetch queue items.');
      }

      const items: BankQueueItem[] = Array.isArray(data.items)
        ? (data.items as BankQueueItem[])
        : [];
      syncPostedStatusesFromQueueItems(items);
      setBankQueueItems(
        selectedBankTab === 'ALL'
          ? items
          : items.filter((item: BankQueueItem) => item.bankCode === selectedBankTab),
      );
      return items;
    } catch (error: any) {
      console.error('Failed to load queue items', error);
      return [];
    } finally {
      setQueueLoading(false);
    }
  }, [selectedBankTab]);

  const { refresh: refreshQueueItems } = useAdaptiveQueuePolling(loadQueueItems, [selectedBankTab]);

  const fetchProcessedTransactions = async () => {
    setProcessedLoading(true);
    try {
      const response = await fetch('/api/v1/processed_transactions');
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load processed transactions');
      }
      setProcessedTransactions(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      console.error('Failed to load processed transactions', error);
    } finally {
      setProcessedLoading(false);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const body = {
        startDate: Number(startDate.replace(/-/g, '')),
        endDate: Number(endDate.replace(/-/g, '')),
      };

      const response = await fetch('/api/v1/payments_by_date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to load payments';
        try {
          const error = await response.json();
          errorMessage = error?.error || errorMessage;
        } catch {
          errorMessage = await response.text();
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const rows = (data.data || []).map((payment: any) => ({
        ...payment,
        transactionDate: payment.transactionDate ? new Date(payment.transactionDate).toISOString() : '',
      })) as EnrichedPayment[];

      setPayments(rows);
      setSelectedQueues({});
      setTransactionOverrides({});
      setValidationResults({});
      await refreshQueueItems();
      setMessage(`Loaded ${rows.length} payment records.`);
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Unable to load payments.');
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  const fetchSourceBanks = async () => {
    try {
      const res = await fetch('/api/v1/source_banks');
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.warn('Failed to load source banks', data?.error);
        return;
      }
      setSourceBanks(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Error fetching source banks', err);
    }
  };

  const handleQueueChange = (paymentId: string, value: BankCode | '') => {
    setSelectedQueues((prev) => ({ ...prev, [paymentId]: value }));
    setValidationResults((prev) => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
  };

  const handleSourceChange = (paymentId: string, value: string) => {
    setSelectedSources((prev) => ({ ...prev, [paymentId]: value }));
    // auto-select target queue when source bank matches known BANK_CODES
    try {
      const src = sourceBanks.find((s:any) => (s.bank || '').toString().toUpperCase() === value.toString().toUpperCase());
      const code = (src?.bank || '').toString().toUpperCase();
      if (code && (BANK_CODES as string[]).includes(code)) {
        setSelectedQueues((prev) => ({ ...prev, [paymentId]: code as BankCode }));
      }
    } catch {}
    setValidationResults((prev) => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
  };

  const handleValidate = (payment: EnrichedPayment) => {
    const bankCode = selectedQueues[payment.paymentId];
    if (!bankCode) {
      setMessage('Choose a queue before validating a payment.');
      clearMessage();
      return;
    }

    const effectiveType = getEffectiveTransactionType(payment, transactionOverrides);
    const effectivePayment = { ...payment, transactionType: effectiveType };
    const result = validatePayment(effectivePayment, bankCode, effectiveType);
    setValidationResults((prev) => ({ ...prev, [payment.paymentId]: result }));
    setMessage(
      result.valid
        ? 'Payload is valid for selected queue.'
        : `Validation found ${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}: ${result.errors.join('; ')}`
    );
    clearMessage();
  };

  const handlePush = async (payment: EnrichedPayment) => {
    const bankCode = selectedQueues[payment.paymentId];
    if (!bankCode) {
      setMessage('Select a target queue before pushing payment.');
      clearMessage();
      return;
    }

    const existingPost = postedPayments[payment.paymentId];
    if (existingPost && ACTIVE_POST_STATUSES.has(existingPost.status)) {
      setMessage(`Payment already posted to ${existingPost.bankCode}. Each payment can only be sent to one bank.`);
      clearMessage();
      return;
    }

    const effectiveType = getEffectiveTransactionType(payment, transactionOverrides);
    const effectivePayment = { ...payment, transactionType: effectiveType };
    const validation = validatePayment(effectivePayment, bankCode, effectiveType);
    if (!validation.valid) {
      setValidationResults((prev) => ({ ...prev, [payment.paymentId]: validation }));
      setMessage('Payment contains validation problems. Fix before pushing.');
      clearMessage();
      return;
    }

    try {
      const payload = effectivePayment;
      const response = await fetch('/api/v1/posted_payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, payment: payload, sourceBank: selectedSources[payment.paymentId] || null }),
      });

      const result = await response.json();
      if (response.status === 409 && result?.alreadyPosted) {
        const postedBankCode = (result.postedBankCode || bankCode) as BankCode;
        const statusKey = postKey(payment.paymentId, postedBankCode);
        const postedRecord: PostedPaymentRecord = {
          bankCode: postedBankCode,
          queueId: String(result.queueId || ''),
          status: (result.existingStatus as QueueStatus | undefined) || 'queued',
        };
        setPostedPayments((prev) => ({ ...prev, [payment.paymentId]: postedRecord }));
        setQueueStatuses((prev) => ({
          ...prev,
          [statusKey]: {
            queueId: postedRecord.queueId,
            status: postedRecord.status,
            lastError: undefined,
          },
        }));
        setSelectedQueues((prev) => ({ ...prev, [payment.paymentId]: postedBankCode }));
        setMessage(result?.error || 'Payment has already been posted.');
        clearMessage();
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Queue push failed');
      }

      const queueId = String(result.queueId || '');
      const queueItem = result.item;
      const statusKey = postKey(payment.paymentId, bankCode);
      const postedRecord: PostedPaymentRecord = {
        bankCode,
        queueId,
        status: 'queued',
        response: queueItem?.response,
      };
      setPostedPayments((prev) => ({ ...prev, [payment.paymentId]: postedRecord }));
      setQueueStatuses((prev) => ({
        ...prev,
        [statusKey]: {
          queueId,
          status: 'queued',
          lastError: undefined,
          response: queueItem?.response,
        },
      }));

      if (queueItem) {
        setBankQueueItems((prev) => [queueItem, ...prev.filter((item) => item.id !== queueItem.id)]);
      }

      void refreshQueueItems();
      setMessage('Payment queued for async processing.');
      clearMessage();
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Failed to push payment.');
      clearMessage();
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchProcessedTransactions();
    fetchSourceBanks();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Posted Payments Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Payment Queue Control</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Fetch posted Sage payments, enrich each record with vendor bank details, validate queue-specific payloads, and push only when the payload is ready.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-600">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <button
              onClick={fetchPayments}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Fetch Payments'}
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

      
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/60">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Value</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Txn type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Info</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Queue</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validate / Push</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-sm font-semibold text-slate-400">
                    No payment records found for the chosen date range.
                  </td>
                </tr>
              ) : (
                pagedPayments.map((payment) => {
                  const validation = validationResults[payment.paymentId];
                  const posted = postedPayments[payment.paymentId];
                  const postedBank = posted?.bankCode;
                  const selectedBank = postedBank || selectedQueues[payment.paymentId] || '';
                  const statusKey = selectedBank ? postKey(payment.paymentId, selectedBank) : '';
                  const queueStatus = posted
                    ? { queueId: posted.queueId, status: posted.status, lastError: posted.lastError, response: posted.response }
                    : statusKey
                      ? queueStatuses[statusKey]
                      : undefined;
                  const selectedType = transactionOverrides[payment.paymentId] ?? payment.transactionType;
                  const isQueued = queueStatus?.status === 'queued' || queueStatus?.status === 'processing';
                  const isAlreadyPosted = Boolean(
                    posted && ACTIVE_POST_STATUSES.has(posted.status),
                  );

                  return (
                    <tr key={payment.paymentId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/40 uppercase tracking-wide">
                          {payment.vendorId || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-2">Ref: {payment.transactionReference || 'N/A'}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Date: {formatDate(payment.transactionDate)}</div>
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        <div className="text-sm font-bold text-slate-800 truncate">{payment.amount.toFixed(2)} {payment.currency}</div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5 tracking-tight">{payment.remarks || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-semibold">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                          {selectedType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 font-semibold">{payment.accountName || 'No bank details'}</div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Acct: <span className="font-mono text-slate-500 font-semibold">{payment.accountNumber || '—'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Bank: <span className="font-mono text-slate-500 font-semibold">{payment.bankName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Source account</label>
                        <select
                          value={selectedSources[payment.paymentId] || ''}
                          onChange={(event) => handleSourceChange(payment.paymentId, event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        >
                          <option value="">Select source</option>
                          {sourceBanks.map((b) => (
                            <option key={`${b.bank}-${b.accountNumber || ''}`} value={b.bank}>
                              {b.bank} — {b.name || 'Unnamed'}
                              {b.accountNumber ? ` (${b.accountNumber})` : ' (no account)'}
                              {b.detailsComplete === false ? ' ⚠' : ''}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const selected = sourceBanks.find(
                            (b: { bank?: string; detailsComplete?: boolean }) =>
                              (b.bank || '').toString().toUpperCase() === (selectedSources[payment.paymentId] || '').toString().toUpperCase(),
                          );
                          if (!selected || selected.detailsComplete !== false) return null;
                          return (
                            <p className="mt-2 text-[11px] text-amber-700">
                              Source account details are incomplete.{' '}
                              <a href="/bank_details/source_accounts" className="font-semibold underline">
                                Add details
                              </a>
                            </p>
                          );
                        })()}

                        <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mt-4 mb-2">Target queue</label>
                        <select
                          value={selectedBank}
                          onChange={(event) => handleQueueChange(payment.paymentId, event.target.value as BankCode)}
                          disabled={isAlreadyPosted}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Select queue</option>
                          {BANK_CODES.map((code) => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mt-4 mb-2">Txn type override</label>
                        <select
                          value={selectedType}
                          onChange={(event) => {
                            const selected = event.target.value as PaymentsResponse['transactionType'];
                            setTransactionOverrides((prev) => ({ ...prev, [payment.paymentId]: selected }));
                            setValidationResults((prev) => {
                              const next = { ...prev };
                              delete next[payment.paymentId];
                              return next;
                            });
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        >
                          {TRANSACTION_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleValidate(payment)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all outline-none"
                          >
                            Validate
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePush(payment)}
                            className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!selectedBank || !validation?.valid || isQueued || isAlreadyPosted}
                          >
                            {isAlreadyPosted ? 'Posted' : 'Push'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewPaymentId(payment.paymentId)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all outline-none"
                          >
                            Preview
                          </button>
                        </div>
                        {validation ? (
                          <div className={`mt-3 rounded-2xl px-3 py-2 text-xs font-semibold ${validation.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {validation.valid ? 'Payload valid' : `${validation.errors.length} issues`}
                          </div>
                        ) : null}
                        {queueStatus ? (
                          <div className={`mt-3 rounded-2xl border p-3 text-xs ${isAlreadyPosted ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            <div className="font-semibold mb-1">{isAlreadyPosted ? 'Posted to bank' : 'Queue status'}:</div>
                            <div>Status: <span className="font-semibold">{queueStatus.status}</span></div>
                            {postedBank ? <div className="mt-1">Bank: <span className="font-semibold">{postedBank}</span></div> : null}
                            {queueStatus.lastError ? <div className="mt-1 text-rose-700">Error: {queueStatus.lastError}</div> : null}
                          </div>
                        ) : null}
                        {!validation?.valid ? (
                          <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                            <div className="font-semibold mb-1">Validation issues:</div>
                            <ul className="list-disc space-y-1 pl-4">
                              {validation?.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-semibold text-slate-500">
            Showing {payments.length > 0 ? (effectivePage - 1) * pageSize + 1 : 0} – {Math.min(effectivePage * pageSize, payments.length)} of {payments.length} payment records
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Per Page:</span>
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              <button
                disabled={effectivePage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                disabled={effectivePage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Processed Transactions</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Receipt Processing History</h2>
          </div>
          <button
            type="button"
            onClick={fetchProcessedTransactions}
            disabled={processedLoading}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {processedLoading ? 'Refreshing...' : 'Refresh History'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/60">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amounts</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-sm font-semibold text-slate-400">
                    {processedLoading ? 'Loading processed transactions...' : 'No processed transactions found.'}
                  </td>
                </tr>
              ) : (
                processedTransactions.slice(0, 25).map((transaction) => (
                  <tr key={transaction.transactionId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{transaction.transactionId}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{transaction.bankCode}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{transaction.statusCode === 200 ? 'Success' : 'Failed'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{transaction.creditAmount.toFixed(2)} / {transaction.debitAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(transaction.processedDate).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 text-xs text-slate-500">Showing latest {Math.min(processedTransactions.length, 25)} processed receipts.</div>
      </div> */}

      {previewPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Bank Payload Preview</h2>
                <p className="text-sm text-slate-500">Review the normalized payment payload before queue push.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bank: {selectedQueues[previewPayment.paymentId] || 'None selected'} • Type: {transactionOverrides[previewPayment.paymentId] ?? previewPayment.transactionType}
                </p>
                {!selectedQueues[previewPayment.paymentId] ? (
                  <p className="text-xs text-amber-400 mt-2">
                    Select a target queue to preview the bank-specific payload and ensure the selected transaction type is applied.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setPreviewPaymentId(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-6">
              {/* User-friendly payload preview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-900">
                <PayloadView payload={formatPayload(
                  previewPayment,
                  selectedQueues[previewPayment.paymentId] || undefined,
                  transactionOverrides[previewPayment.paymentId] ?? previewPayment.transactionType,
                  sourceBanks.find((s:any) => (s.bank || '').toString().toUpperCase() === (selectedSources[previewPayment.paymentId] || '').toString().toUpperCase()) || undefined,
                )} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
