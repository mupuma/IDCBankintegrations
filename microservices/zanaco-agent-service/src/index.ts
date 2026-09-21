import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { paymentQueue } from './queue';
import { isZanacoServicePayload } from './zanacoValidation';
import { prepareZanacoPayload, prepareZanacoServicePayload } from './zanacoAgent';
import { getBatchDetail, getBatchStatus, isBulkService, prepareBulkPayload, validateBulkPayload } from './bulk';
import type { PaymentJobPayload, PaymentsResponse } from './types';
import { logEvent, logError } from './log';

const app = express();
const port = Number(process.env.PORT || 4003);

app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '5mb' }));

app.post('/payments', async (req, res) => {
  const body = req.body as PaymentJobPayload | unknown;
  const inboundQueueId = (body as { queueId?: unknown })?.queueId as string | undefined;
  const queueId = inboundQueueId
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const sourceBank = (body as { sourceBank?: unknown })?.sourceBank as string | undefined;
  const service = (body as { service?: unknown })?.service;
  const payment = (body as { payment?: unknown })?.payment as PaymentsResponse | undefined;

  logEvent('api.payments.received', {
    queueId,
    sourceBank,
    service,
    bankCode: (body as { bankCode?: unknown })?.bankCode,
    paymentId: payment?.paymentId,
    transactionReference: payment?.transactionReference,
    transactionType: payment?.transactionType,
  });

  try {
    if (isZanacoServicePayload(body)) {
      if (isBulkService(body.service)) {
        const prepared = prepareBulkPayload(body.service, body.request);
        const validationErrors = validateBulkPayload(prepared);
        if (validationErrors.length) {
          logError('api.payments.validation_failed', { queueId, sourceBank, service: body.service, validationErrors });
          return res.status(400).json({ success: false, error: 'Invalid Zanaco bulk payload', validationErrors });
        }
      } else {
        prepareZanacoServicePayload(body);
      }
      const job = await enqueue(body, queueId, sourceBank, Boolean(inboundQueueId));
      logEvent('api.payments.enqueued', { queueId, sourceBank, service: body.service, jobId: job.id, queue: job.queueName });
      return res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
    }

    const bankCode = (body as { bankCode?: unknown })?.bankCode;
    if (bankCode !== 'ZANACO') {
      logError('api.payments.validation_failed', { queueId, bankCode, error: 'bankCode must be ZANACO' });
      return res.status(400).json({ success: false, error: 'bankCode must be ZANACO' });
    }
    if (!payment || typeof payment !== 'object') {
      logError('api.payments.validation_failed', { queueId, bankCode, error: 'payment object is required' });
      return res.status(400).json({ success: false, error: 'payment object is required' });
    }

    prepareZanacoPayload(payment);
    const job = await enqueue(payment, queueId, sourceBank, Boolean(inboundQueueId));
    logEvent('api.payments.enqueued', {
      queueId,
      sourceBank,
      paymentId: payment.paymentId,
      transactionReference: payment.transactionReference,
      transactionType: payment.transactionType,
      jobId: job.id,
      queue: job.queueName,
    });
    return res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
  } catch (error) {
    const validationErrors = (error as Error & { validationErrors?: string[] }).validationErrors;
    logError(validationErrors ? 'api.payments.validation_failed' : 'api.payments.exception', {
      queueId,
      sourceBank,
      service,
      error: error instanceof Error ? error.message : String(error),
      validationErrors,
    });
    return res.status(validationErrors ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      validationErrors,
    });
  }
});

app.get('/batches/:batchReference/status', async (req, res) => {
  try {
    const result = await getBatchStatus(req.params.batchReference);
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/batches/:batchReference/detail', async (req, res) => {
  try {
    const result = await getBatchDetail(req.params.batchReference);
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'zanaco-agent-service' });
});

async function enqueue(payment: unknown, queueId: string, sourceBank?: string | null, reportToPortal = false) {
  return paymentQueue.add('send-zanaco-payment', { payment, queueId, sourceBank, reportToPortal }, {
    attempts: Number(process.env.JOB_ATTEMPTS || 3),
    backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
    removeOnComplete: true,
    removeOnFail: false,
  });
}

app.listen(port, () => {
  console.log(`Zanaco agent service running on http://localhost:${port}`);
  console.log('POST /payments with { bankCode: "ZANACO", payment: {...} } or a direct { service, request } payload');
});
