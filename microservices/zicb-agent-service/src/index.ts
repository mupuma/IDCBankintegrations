import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { paymentQueue } from './queue';
import { initDatabase, insertQueueRequest } from './db';
import type { PaymentJobPayload, PaymentsResponse } from './types';

dotenv.config();
initDatabase();

const app = express();
const port = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json());

function isZicbServicePayload(value: unknown): value is { service: string; request: Record<string, unknown> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).service === 'string' &&
    typeof (value as any).request === 'object' &&
    (value as any).request !== null
  );
}

app.post('/payments', async (req, res) => {
  const body = req.body as PaymentJobPayload | unknown;
  const queueId = (body as { queueId?: unknown })?.queueId as string | undefined
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  if (isZicbServicePayload(body)) {
    await insertQueueRequest({
      queueId,
      bankCode: 'ZICB',
      payload: body,
      status: 'queued',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const job = await paymentQueue.add('send-zicb-payment', { payment: body, queueId }, {
      attempts: Number(process.env.JOB_ATTEMPTS || 3),
      backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
  }

  const payment = (body as { payment?: unknown })?.payment as PaymentsResponse | undefined;
  const bankCode = (body as { bankCode?: unknown })?.bankCode;

  if (bankCode !== 'ZICB') {
    return res.status(400).json({ success: false, error: 'bankCode must be ZICB' });
  }

  if (!payment || typeof payment !== 'object') {
    return res.status(400).json({ success: false, error: 'payment object is required' });
  }

  await insertQueueRequest({
    queueId,
    bankCode: 'ZICB',
    payload: body,
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const job = await paymentQueue.add('send-zicb-payment', { payment, queueId }, {
    attempts: Number(process.env.JOB_ATTEMPTS || 3),
    backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
    removeOnComplete: true,
    removeOnFail: false,
  });

  res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'zicb-agent-service' });
});

app.listen(port, () => {
  console.log(`ZICB agent service running on http://localhost:${port}`);
  console.log('POST /payments with either { bankCode: "ZICB", payment: {...} } or direct ZICB payload { service, request }');
});
