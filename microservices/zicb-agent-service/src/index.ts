import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json());

app.post('/payments', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'ZICB legacy payment API has been removed. Submit payments through the portal H2H ledger.',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'disabled', service: 'zicb-legacy-agent-api', replacement: 'zicb-h2h-agent' });
});

app.listen(port, () => {
  console.log(`ZICB legacy payment API is disabled on http://localhost:${port}`);
  console.log('Use npm run dev with ZICB_H2H_ENABLED=true to start the H2H agent.');
});
