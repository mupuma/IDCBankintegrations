import { NextResponse } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { ProcessedTransaction } from '@/app/models/internal/Processed_transactions';

export async function GET() {
  await connectDatabase();

  try {
    const items = await ProcessedTransaction.findAll({
      order: [['processed_date', 'DESC']],
      limit: 100,
      raw: true,
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('Failed to load processed transactions:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Unable to load processed transactions' }, { status: 500 });
  }
}
