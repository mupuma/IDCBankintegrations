import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isCashbookAlreadyProcessed,
  isCashbookProcessError,
  processCashbookReceipt,
} from '../../../lib/cashbookService';
import {
  cashbookConflictResponse,
  cashbookErrorResponse,
  cashbookInvalidRequestResponse,
  cashbookResponseEnvelope,
  cashbookSavedResponse,
  normalizeReceiptRequest,
} from '../../../lib/cashbookContract';

export async function POST(request: NextRequest) {
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

  const result = await processCashbookReceipt(receipt);

  if (result.success) {
    return NextResponse.json(cashbookResponseEnvelope(cashbookSavedResponse()), { status: 200 });
  }

  if (isCashbookAlreadyProcessed(result)) {
    return NextResponse.json(cashbookResponseEnvelope(cashbookConflictResponse()), { status: 409 });
  }

  if (isCashbookProcessError(result)) {
    return NextResponse.json(cashbookResponseEnvelope(cashbookErrorResponse(result.error)), { status: 500 });
  }

  return NextResponse.json(cashbookResponseEnvelope(cashbookErrorResponse('Unknown cashbook processing error')), { status: 500 });
}
