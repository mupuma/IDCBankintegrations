import 'dotenv/config';
require('../../../shared/http-logging').installHttpLogging('izb-worker');

console.log('IZB worker disabled: IZB uses pull-only flow via POST /api/v1/payments/by_date.');
