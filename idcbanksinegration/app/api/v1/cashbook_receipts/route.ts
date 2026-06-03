import { NextRequest, NextResponse } from 'next/server';
import { processCashbookReceipt } from '@/app/lib/cashbookService';
import { connectDatabase } from '@/app/lib/db';
import { CashbookReceipt } from '@/app/models/internal/CashbookReceipt';
import { ReceiptRequest } from '@/app/models/dtos';

const validateReceiptRequest = (body: any): body is ReceiptRequest => {
  if (!body || typeof body !== 'object') return false;

  const hasRequiredFields =
    typeof body.transactionId === 'string' &&
    typeof body.bankCode === 'string' &&
    typeof body.description === 'string' &&
    typeof body.noEntries === 'number' &&
    typeof body.creditAmount === 'number' &&
    typeof body.debitAmount === 'number' &&
    Array.isArray(body.entries);

  if (!hasRequiredFields) return false;

  return body.entries.every((entry: any) =>
    entry &&
    typeof entry.entryNo === 'number' &&
    typeof entry.referenceNo === 'string' &&
    typeof entry.customerNo === 'string' &&
    typeof entry.noDetails === 'number' &&
    typeof entry.amount === 'number' &&
    typeof entry.currency === 'string' &&
    Array.isArray(entry.details) &&
    entry.details.every((detail: any) =>
      detail &&
      typeof detail.entryDescription === 'string' &&
      typeof detail.accountId === 'string' &&
      typeof detail.amount === 'number' &&
      typeof detail.DrCr === 'string' &&
      typeof detail.detailNo === 'number'
    )
  );
};

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!validateReceiptRequest(body)) {
    return NextResponse.json({ error: 'Invalid receipt request payload' }, { status: 400 });
  }

  const result = await processCashbookReceipt(body);
  const status = result.success ? 201 : result.error?.includes('already exists') ? 409 : 500;

  return NextResponse.json(result, { status });
}

export async function GET(request: NextRequest) {
  await connectDatabase();

  const transactionId = request.nextUrl.searchParams.get('transactionId');
  const bankCode = request.nextUrl.searchParams.get('bankCode');

  if (!transactionId || !bankCode) {
    return NextResponse.json(
      { error: 'transactionId and bankCode query parameters are required' },
      { status: 400 }
    );
  }

  const receipt = await CashbookReceipt.findOne({
    where: { transactionId, bankCode },
  });

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  return NextResponse.json({
    receiptId: receipt.id,
    transactionId: receipt.transactionId,
    bankCode: receipt.bankCode,
    status: receipt.status,
    statusMessage: receipt.statusMessage,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  });
}
