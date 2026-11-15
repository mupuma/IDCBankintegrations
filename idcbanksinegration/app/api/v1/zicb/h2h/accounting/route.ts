import { NextRequest, NextResponse } from 'next/server';
import { isAgent } from '@/app/lib/zicb/security';

export async function POST(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ success: true, posted: false, accountingStatus: 'not_required',
    message: 'Sage posting is disabled. Bank responses are retained locally.' });
}
