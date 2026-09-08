import { NextRequest, NextResponse } from 'next/server';
import { BANK_CODES } from '@/app/lib/banks';
import { claimNextBankQueueItem } from '@/app/lib/agentQueue';
import type { BankCode } from '@/app/models/dtos';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

export async function POST(request: NextRequest) {
  const providedApiKey = request.headers.get('x-bank-api-key');
  if (!BANK_PULL_API_KEY || providedApiKey !== BANK_PULL_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const bankCode = String(body?.bankCode ?? '').toUpperCase() as BankCode;
  const agentId = String(body?.agentId ?? `${bankCode.toLowerCase()}-agent`);

  if (!BANK_CODES.includes(bankCode)) {
    return NextResponse.json(
      { success: false, error: `bankCode must be one of ${BANK_CODES.join(', ')}` },
      { status: 400 },
    );
  }

  const item = await claimNextBankQueueItem(bankCode, agentId);
  return NextResponse.json({ success: true, item });
}
