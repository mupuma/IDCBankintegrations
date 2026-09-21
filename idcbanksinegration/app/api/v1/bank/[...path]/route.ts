import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: 'bank_callbacks_moved',
    message: 'ZICB bank callbacks must be sent to the ZICB H2H agent, not the portal.',
    path: request.nextUrl.pathname,
  }, { status: 410 });
}
