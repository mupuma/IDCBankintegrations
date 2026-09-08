import 'dotenv/config';

if (process.env.ZICB_H2H_ENABLED === 'true') {
  void import('./h2hServer').then(({ startH2hService }) => startH2hService());
} else {
  // Existing in-flight legacy jobs retain their own protocol and queue.
  void import('./index').then(() => import('./worker'));
}
