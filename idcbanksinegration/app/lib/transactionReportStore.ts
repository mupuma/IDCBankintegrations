import { Op } from 'sequelize';
import { connectDatabase } from './db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { matchesReport, reportRows, type ReportFilters, type SavedReportPayment } from './transactionReports';

// Walk every saved queue row in bounded batches. Never reuse the paginated
// queue dashboard or a fixed row cap for reconciliation exports.
export async function* matchingReportRows(filters: ReportFilters) {
  await connectDatabase();
  const scope = filters.bank ? { bankCode: filters.bank } : {};
  const last = await PaymentQueueRequest.findOne({ where: scope, attributes: ['id'], order: [['id', 'DESC']], raw: true });
  if (!last) return;
  const highWater = String(last.id);
  let after = '0';
  while (true) {
    const records = await PaymentQueueRequest.findAll({
      where: { ...scope, id: { [Op.gt]: after, [Op.lte]: highWater } },
      order: [['id', 'ASC']], limit: 500, raw: true,
    });
    if (!records.length) return;
    for (const record of records) {
      for (const row of reportRows(record as unknown as SavedReportPayment, filters)) {
        if (matchesReport(row, filters)) yield row;
      }
    }
    after = String(records[records.length - 1].id);
  }
}
