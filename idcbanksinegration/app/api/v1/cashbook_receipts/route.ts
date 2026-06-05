import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { CashbookReceipt } from '@/app/models/internal/CashbookReceipt';
import { cashbookInvalidRequestResponse } from '@/app/lib/cashbookContract';
import { postCashbookTransaction } from '@/app/lib/postCashbookTransaction';

export async function POST(request: NextRequest) {
  return postCashbookTransaction(request);
}

export async function GET(request: NextRequest) {
  await connectDatabase();

  const transactionId = request.nextUrl.searchParams.get('transactionId');
  const bankCode = request.nextUrl.searchParams.get('bankCode');

  if (!transactionId || !bankCode) {
    return NextResponse.json(
      cashbookInvalidRequestResponse('transactionId and bankCode query parameters are required'),
      { status: 400 },
    );
  }

  const receipt = await CashbookReceipt.findOne({
    where: { transactionId, bankCode },
  });

  if (!receipt) {
    return NextResponse.json(
      cashbookInvalidRequestResponse('Receipt not found'),
      { status: 404 },
    );
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
