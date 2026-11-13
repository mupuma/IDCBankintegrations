import { NextRequest, NextResponse } from 'next/server';
import { recordIzbPaymentFailure, IzbStatusError } from '@/app/lib/izbPaymentStatus';

export async function POST(request: NextRequest) {
  const key = process.env.BANK_PULL_API_KEY;
  if (!key || request.headers.get('x-bank-api-key') !== key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  try { return NextResponse.json(await recordIzbPaymentFailure(body)); }
  catch (error) {
    if (error instanceof IzbStatusError) return NextResponse.json(error.validation || { error: error.message }, { status: error.status });
    console.error('[IZB payment status] Unable to save bank failure');
    return NextResponse.json({ error: 'Unable to record bank failure; retry the same eventId' }, { status: 503 });
  }
}
