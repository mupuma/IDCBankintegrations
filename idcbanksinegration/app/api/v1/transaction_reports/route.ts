import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAuthError } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { matchingReportRows } from '@/app/lib/transactionReportStore';
import { parseReportFilters, createReportSummary, REPORT_CSV_COLUMNS, reportCsvRow, type ReportRow } from '@/app/lib/transactionReports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.REPORTS_READ);
  if (isAuthError(auth)) return auth;
  const params = request.nextUrl.searchParams;
  let filters;
  try { filters = parseReportFilters(params); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid filters' }, { status: 400, headers: privateHeaders }); }
  const format = params.get('format') || 'json';
  const page = Number(params.get('page') || 1), pageSize = Number(params.get('pageSize') || 25);
  if (!['json', 'csv', 'summary_csv'].includes(format) || !Number.isSafeInteger(page) || page < 1 || ![10, 25, 50, 100].includes(pageSize)) {
    return NextResponse.json({ error: 'Invalid format or pagination' }, { status: 400, headers: privateHeaders });
  }
  try {
    const iterator = matchingReportRows(filters);
    // Open the database before sending download headers so connection failures
    // return a proper error instead of an empty successful CSV.
    const first = await iterator.next();
    if (format === 'csv') {
      const encoder = new TextEncoder();
      let initial = true, pending: IteratorResult<ReportRow> = first;
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            if (initial) { initial = false; controller.enqueue(encoder.encode('\uFEFF' + REPORT_CSV_COLUMNS.join(',') + '\r\n')); return; }
            if (pending.done) { controller.close(); return; }
            controller.enqueue(encoder.encode(reportCsvRow(pending.value)));
            pending = await iterator.next();
          } catch (error) { controller.error(error); await iterator.return(undefined); }
        },
        async cancel() { await iterator.return(undefined); },
      });
      return new Response(stream, { headers: { ...privateHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="transaction-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"` } });
    }
    const summary = createReportSummary(filters.groupBy);
    const items: ReportRow[] = [];
    let total = 0, missingReferences = 0, dataQualityWarnings = 0, historicalDates = 0;
    function add(row: ReportRow) {
      summary.add(row);
      if (!row.bankReferences) missingReferences++;
      if (row.dataQuality) dataQualityWarnings++;
      if (row.dateSource.includes('historical')) historicalDates++;
      if (total >= (page - 1) * pageSize && items.length < pageSize) items.push(row);
      total++;
    }
    if (!first.done) add(first.value);
    for await (const row of iterator) add(row);
    const groups = summary.rows();
    if (format === 'summary_csv') {
      const { csvCell } = await import('@/app/lib/transactionReports');
      const columns = ['period', 'bank', 'currency', 'status', 'count', 'amount', 'missingAmounts'] as const;
      return new Response('\uFEFF' + columns.join(',') + '\r\n' + groups.map(row => columns.map(key => csvCell(row[key])).join(',')).join('\r\n'), {
        headers: { ...privateHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="reconciliation-summary.csv"' },
      });
    }
    return NextResponse.json({ success: true, items, total, page, pageSize, groups, filters, missingReferences, dataQualityWarnings, historicalDates,
      generatedAt: new Date().toISOString(), timezone: 'Africa/Johannesburg' }, { headers: privateHeaders });
  } catch (error) {
    console.error('Transaction report generation failed', error instanceof Error ? error.message : 'Unknown failure');
    return NextResponse.json({ error: 'Unable to generate the complete report. Please retry.' }, { status: 500, headers: privateHeaders });
  }
}
