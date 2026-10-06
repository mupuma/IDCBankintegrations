import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

function parseDateParam(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parsePaymentPayload(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function paymentDate(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const raw = record.transactionDate ?? record.paymentDate;
  if (!raw) return null;

  const date = new Date(String(raw));
  return isNaN(date.getTime()) ? null : date;
}

function isWithinDateRange(value: unknown, fromDate: Date | null, toDate: Date | null) {
  if (!fromDate && !toDate) return true;

  const date = paymentDate(value);
  if (!date) return false;

  if (fromDate && date < fromDate) return false;
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }

  return true;
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  const providedApiKey = request.headers.get('x-bank-api-key');

  if (!sessionToken) {
    if (!BANK_PULL_API_KEY || providedApiKey !== BANK_PULL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const fromParam = request.nextUrl.searchParams.get('from');
  const toParam = request.nextUrl.searchParams.get('to');
  const markPulled = request.nextUrl.searchParams.get('markPulled') === 'true';

  const fromDate = parseDateParam(fromParam);
  const toDate = parseDateParam(toParam);

  await connectDatabase();

  const rows = await PaymentQueueRequest.findAll({
    where: {
      bankCode: 'IZB',
      status: 'queued',
    },
    order: [['created_at', 'ASC']],
  });

  const items = rows
    .map((row) => {
      const payment = parsePaymentPayload(row.paymentPayload);
      return {
        id: row.id,
        queueId: row.queueId,
        paymentId: row.paymentId,
        paymentDate: paymentDate(payment),
        payment,
      };
    })
    .filter((item) => isWithinDateRange(item.payment, fromDate, toDate));

  if (markPulled && items.length > 0) {
    try {
      await PaymentQueueRequest.update(
        {
          status: 'pulled',
          lockedBy: 'izb-pull',
          lockedAt: new Date(),
          claimedAt: new Date(),
        } as any,
        {
          where: {
            queueId: items.map((item) => item.queueId),
          },
        },
      );
    } catch (err) {
      console.error('Failed to mark IZB queue items as pulled', err);
    }
  }

  return NextResponse.json({ success: true, items });
}
