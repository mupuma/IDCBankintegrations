import { NextRequest, NextResponse } from 'next/server';
import {
  isCashbookAlreadyProcessed,
  isCashbookProcessError,
  processCashbookReceipt,
} from '@/app/lib/cashbookService';
import {
  cashbookConflictResponse,
  cashbookErrorResponse,
  cashbookInvalidRequestResponse,
  cashbookSavedResponse,
  normalizeReceiptRequest,
} from '@/app/lib/cashbookContract';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

export async function postCashbookTransaction(request: NextRequest) {
  const providedApiKey = request.headers.get('x-bank-api-key');
  const sessionToken = request.cookies.get('session')?.value;

  if (!sessionToken && (!BANK_PULL_API_KEY || providedApiKey !== BANK_PULL_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      cashbookInvalidRequestResponse('Invalid JSON payload'),
      { status: 400 },
    );
  }

  const receipt = normalizeReceiptRequest(body);
  if (!receipt) {
    return NextResponse.json(
      cashbookInvalidRequestResponse('Invalid receipt request payload'),
      { status: 400 },
    );
  }

  let result;
  try {
    result = await processCashbookReceipt(receipt);
  } catch (error: any) {
    console.error('Unhandled cashbook processing error', error);
    return NextResponse.json(
      cashbookErrorResponse(error?.message ?? 'Unexpected cashbook processing error'),
      { status: 500 },
    );
  }

  if (result.success) {
    return NextResponse.json(cashbookSavedResponse(), { status: 200 });
  }

  if (isCashbookAlreadyProcessed(result)) {
    return NextResponse.json(cashbookConflictResponse(), { status: 409 });
  }

  if (isCashbookProcessError(result)) {
    return NextResponse.json(cashbookErrorResponse(result.error), { status: 500 });
  }

  return NextResponse.json(cashbookErrorResponse('Unknown cashbook processing error'), { status: 500 });
}
