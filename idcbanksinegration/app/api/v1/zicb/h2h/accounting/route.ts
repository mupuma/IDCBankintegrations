import { NextRequest, NextResponse } from 'next/server';
import { withAccountingLease, LedgerError } from '@/app/lib/zicb/ledger';
import { isAgent } from '@/app/lib/zicb/security';
import { postConfirmedH2hCashbook } from '@/app/lib/cashbookService';

export async function POST(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.queueId || !body?.leaseToken) return NextResponse.json({ error: 'queueId and leaseToken are required' }, { status: 400 });
  try {
    const result = await withAccountingLease(body.queueId, body.leaseToken, async doc => {
      const payment = doc.payment; // Canonical record, never the nested bank payload.
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { posted: false, review: true, error: 'Invalid canonical accounting amount' };
      if (!doc.cashbookAccount) return { posted: false, review: true, error: 'Configure the source profile cashbook account before accounting recovery' };
      // Existing Sage helper uses ZMW exchange-rate fields. Do not silently
      // post forex as ZMW; an explicit FX accounting implementation is required.
      if (payment.currency !== 'ZMW') return { posted: false, review: true, error: 'Non-ZMW accounting requires configured Sage FX posting support' };
      await postConfirmedH2hCashbook({
        transactionId: doc.accountingId, bankCode: doc.sourceBank, description: payment.remarks || payment.transactionReference,
        noEntries: 1, creditAmount: amount, debitAmount: amount,
        entries: [{ entryNo: 1, referenceNo: doc.accountingId, customerNo: String(payment.vendorId || ''),
          noDetails: 1, amount, currency: payment.currency,
          details: [{ entryDescription: payment.remarks || payment.transactionReference, accountId: doc.cashbookAccount, amount, DrCr: 'Cr', detailNo: 1 }] }],
      });
      return { posted: true };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof LedgerError ? error.message : 'Accounting recovery deferred' }, { status: error instanceof LedgerError ? error.status : 503 });
  }
}
