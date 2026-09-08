"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const queue_1 = require("./queue");
const zanacoValidation_1 = require("./zanacoValidation");
const zanacoAgent_1 = require("./zanacoAgent");
const bulk_1 = require("./bulk");
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4003);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: process.env.JSON_LIMIT || '5mb' }));
app.post('/payments', async (req, res) => {
    const body = req.body;
    const queueId = body?.queueId
        || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sourceBank = body?.sourceBank;
    try {
        if ((0, zanacoValidation_1.isZanacoServicePayload)(body)) {
            if ((0, bulk_1.isBulkService)(body.service)) {
                const prepared = (0, bulk_1.prepareBulkPayload)(body.service, body.request);
                const validationErrors = (0, bulk_1.validateBulkPayload)(prepared);
                if (validationErrors.length)
                    return res.status(400).json({ success: false, error: 'Invalid Zanaco bulk payload', validationErrors });
            }
            else {
                (0, zanacoAgent_1.prepareZanacoServicePayload)(body);
            }
            const job = await enqueue(body, queueId, sourceBank);
            return res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
        }
        const payment = body?.payment;
        const bankCode = body?.bankCode;
        if (bankCode !== 'ZANACO')
            return res.status(400).json({ success: false, error: 'bankCode must be ZANACO' });
        if (!payment || typeof payment !== 'object')
            return res.status(400).json({ success: false, error: 'payment object is required' });
        (0, zanacoAgent_1.prepareZanacoPayload)(payment);
        const job = await enqueue(payment, queueId, sourceBank);
        return res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
    }
    catch (error) {
        const validationErrors = error.validationErrors;
        return res.status(validationErrors ? 400 : 500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            validationErrors,
        });
    }
});
app.get('/batches/:batchReference/status', async (req, res) => {
    try {
        const result = await (0, bulk_1.getBatchStatus)(req.params.batchReference);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
});
app.get('/batches/:batchReference/detail', async (req, res) => {
    try {
        const result = await (0, bulk_1.getBatchDetail)(req.params.batchReference);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'zanaco-agent-service' });
});
async function enqueue(payment, queueId, sourceBank) {
    return queue_1.paymentQueue.add('send-zanaco-payment', { payment, queueId, sourceBank }, {
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
