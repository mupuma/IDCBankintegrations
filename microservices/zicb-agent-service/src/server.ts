import 'dotenv/config';

if (process.env.ZICB_H2H_ENABLED !== 'true') {
  throw new Error('ZICB legacy sender has been removed. Set ZICB_H2H_ENABLED=true and configure ZICB_H2H_PROFILES.');
}

void import('./h2hServer').then(({ startH2hService }) => startH2hService());
