import 'dotenv/config';
require('../../../shared/http-logging').installHttpLogging('zicb-agent');

void import('./h2hServer').then(({ startH2hService }) => startH2hService());
