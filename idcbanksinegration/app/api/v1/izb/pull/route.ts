import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { IzbPayment } from '@/app/models/internal/IzbPayment';
import { Op } from 'sequelize';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

function parseDateParam(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
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

  const where: any = { status: 'queued' };
  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = fromDate;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.paymentDate[Op.lte] = end;
    }
  }

  const items = await IzbPayment.findAll({
    where,
    order: [['payment_date', 'ASC']],
  });

  const results = items.map((i) => ({
    id: i.id,
    paymentId: i.paymentId,
    paymentDate: i.paymentDate,
    payment: (() => {
      try { return JSON.parse(i.paymentPayload); } catch { return i.paymentPayload; }
    })(),
  }));

  if (markPulled && items.length > 0) {
    try {
      const now = new Date();
      for (const row of items) {
        row.pulledAt = now as any;
        row.status = 'pulled';
        await row.save();
      }
    } catch (err) {
      console.error('Failed to mark IZB items as pulled', err);
    }
  }

  return NextResponse.json({ success: true, items: results });
}
