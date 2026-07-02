"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const queue_1 = require("./queue");
const db_1 = require("./db");
const zicbValidation_1 = require("./zicbValidation");
const zicbAgent_1 = require("./zicbAgent");
dotenv_1.default.config();
(0, db_1.initDatabase)();
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4001);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/payments', async (req, res) => {
    const body = req.body;
    const queueId = body?.queueId
        || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sourceBank = body?.sourceBank;
    if ((0, zicbValidation_1.isZicbServicePayload)(body)) {
        const validationErrors = (0, zicbValidation_1.validateZicbPayload)(body);
        if (validationErrors.length) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ZICB payload',
                validationErrors,
            });
        }
        await (0, db_1.insertQueueRequest)({
            queueId,
            bankCode: 'ZICB',
            payload: body,
            status: 'queued',
            attempts: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        const job = await queue_1.paymentQueue.add('send-zicb-payment', { payment: body, queueId, sourceBank }, {
            attempts: Number(process.env.JOB_ATTEMPTS || 3),
            backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
            removeOnComplete: true,
            removeOnFail: false,
        });
        return res.status(202).json({ success: true, jobId: job.id, queue: job.queueName, queueId });
    }
    const payment = body?.payment;
    const bankCode = body?.bankCode;
    if (bankCode !== 'ZICB') {
        return res.status(400).json({ success: false, error: 'bankCode must be ZICB' });
    }
    if (!payment || typeof payment !== 'object') {
        return res.status(400).json({ success: false, error: 'payment object is required' });
    }
    try {
        (0, zicbAgent_1.prepareZicbPayload)(payment);
    }
    catch (error) {
        const validationErrors = error.validationErrors;
        return res.status(400).json({
            success: false,
            error: 'Invalid ZICB payment',
            validationErrors: validationErrors ?? [String(error)],
        });
    }
    await (0, db_1.insertQueueRequest)({
        queueId,
        bankCode: 'ZICB',
        payload: body,
        status: 'queued',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    const job = await queue_1.paymentQueue.add('send-zicb-payment', { payment, queueId, sourceBank }, {
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
