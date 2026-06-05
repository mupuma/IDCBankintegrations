import type { NextRequest } from 'next/server';
import { postCashbookTransaction } from '@/app/lib/postCashbookTransaction';

export async function POST(request: NextRequest) {
  return postCashbookTransaction(request);
}
