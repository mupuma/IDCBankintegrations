import 'dotenv/config';

void import('./h2hServer').then(({ startH2hService }) => startH2hService());
