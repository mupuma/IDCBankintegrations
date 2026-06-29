"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const queue_1 = require("./queue");
const zicbAgent_1 = require("./zicbAgent");
const sageClient_1 = require("./sageClient");
const db_1 = require("./db");
dotenv_1.default.config();
(0, db_1.initDatabase)();
const worker = (0, queue_1.buildWorker)(async (job) => {
    const payload = job.data;
    if (!payload?.payment) {
        throw new Error('Job missing payment payload');
    }
    const queueId = payload.queueId;
    const attempts = job.attemptsMade + 1;
    const hasMoreRetries = typeof job.opts.attempts === 'number'
        ? job.attemptsMade < job.opts.attempts - 1
        : false;
    if (queueId) {
        (0, db_1.updateQueueRequestStatus)(queueId, {
            status: 'processing',
            attempts,
            lastError: undefined,
            updatedAt: new Date().toISOString(),
        });
    }
    try {
        const result = await (0, zicbAgent_1.sendZicbPayment)(payload.payment);
        // if bank post succeeded, attempt to post cashbook to Sage
        if (result.success) {
            try {
                const payment = payload.payment;
                const transactionId = payload.queueId || payment?.paymentId || `zicb-${Date.now()}`;
                const amount = Number(payment?.amount || 0);
                const currency = payment?.currency || payment?.currencyCode || 'ZMW';
                const receipt = {
                    transactionId,
                    bankCode: 'ZICB',
                    Description: payment?.remarks || payment?.transactionReference || 'ZICB cashbook posting',
                    noEntries: 1,
                    creditAmount: amount,
                    debitAmount: amount,
                    entries: [
                        {
                            entryNo: 1,
                            referenceNo: payment?.transactionReference || transactionId,
                            customerNo: payment?.vendorId || undefined,
                            noDetails: 1,
                            amount,
                            currency,
                            details: [
                                {
                                    entryDescription: payment?.remarks || payment?.transactionReference || 'Auto-post',
                                    accountId: process.env.SAGE_CASHBOOK_DEFAULT_ACCOUNT || '4000',
                                    amount,
                                    DrCr: 'Cr',
                                    detailNo: 1,
                                },
                            ],
                        },
                    ],
                };
                const sageResp = await (0, sageClient_1.postCashbook)(receipt);
                if (!sageResp.ok) {
                    console.warn('Sage cashbook post failed', sageResp.status, sageResp.text);
                }
                else {
                    console.log('Sage cashbook posted', transactionId);
                }
            }
            catch (sageErr) {
                console.error('Sage cashbook posting error', sageErr);
            }
        }
        if (queueId) {
            (0, db_1.updateQueueRequestStatus)(queueId, {
                status: result.success ? 'success' : (hasMoreRetries ? 'queued' : 'failed'),
                attempts,
                lastError: result.error,
                response: result.data,
                updatedAt: new Date().toISOString(),
            });
        }
        if (payload.queueId) {
            await (0, zicbAgent_1.notifyAppOfQueueResult)(payload.queueId, result);
        }
        if (!result.success) {
            throw new Error(result.error || `ZICB send failed with status ${result.status}`);
        }
        return result;
    }
    catch (error) {
        if (queueId) {
            (0, db_1.updateQueueRequestStatus)(queueId, {
                status: hasMoreRetries ? 'queued' : 'failed',
                attempts,
                lastError: String(error),
                updatedAt: new Date().toISOString(),
            });
        }
        if (payload.queueId) {
            await (0, zicbAgent_1.notifyAppOfQueueResult)(payload.queueId, {
                success: false,
                status: error?.status ?? 500,
                error: String(error),
            });
        }
        throw error;
    }
});
worker.on('completed', (job, returnvalue) => {
    console.log(`ZICB job completed: ${job.id}`, returnvalue);
});
worker.on('failed', (job, err) => {
    console.error(`ZICB job failed: ${job.id}`, err.message);
});
queue_1.queueScheduler.on('error', (error) => {
    console.error('Queue scheduler error:', error);
});
worker.on('error', (error) => {
    console.error('Worker error:', error);
});
console.log('ZICB worker started, listening for payments...');
