"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPaymentJob = processPaymentJob;
const unresolved = (result) => Boolean(result.unknown || result.accepted);
const uncertain = (error) => ({
    success: false, status: 503, unknown: true,
    error: error instanceof Error ? error.message : String(error),
});
// BullMQ persists each checkpoint in Redis. No network submission is allowed until
// the submitting marker is saved. Recovery from that marker only reconciles.
async function processPaymentJob(job, operations) {
    async function save(checkpoint) {
        const data = { ...job.data, checkpoint };
        await job.updateData(data);
        job.data = data;
    }
    let checkpoint = job.data.checkpoint;
    if (!checkpoint && (job.attemptsMade > 0 || (job.attemptsStarted ?? 1) > 1)) {
        checkpoint = { phase: 'outcome', result: {
                success: false, status: 409, unknown: true,
                error: 'Legacy job has no submission checkpoint; manually reconcile its original bank reference before continuing',
            } };
        await save(checkpoint);
    }
    if (!checkpoint) {
        let prepared;
        try {
            prepared = operations.prepare(job.data.payment);
        }
        catch (error) {
            const result = { success: false, status: 400, error: error instanceof Error ? error.message : String(error) };
            checkpoint = { phase: 'outcome', result };
            await save(checkpoint);
        }
        if (!checkpoint) {
            checkpoint = { prepared: prepared, phase: 'prepared' };
            await save(checkpoint);
        }
    }
    // A reporting failure must retry the saved outcome before any further work.
    if (checkpoint.result && !checkpoint.reported) {
        if (job.data.reportToPortal && job.data.queueId) {
            await operations.report(job.data.queueId, checkpoint.result, job.attemptsMade + 1);
        }
        checkpoint = { ...checkpoint, reported: true };
        await save(checkpoint);
    }
    if (checkpoint.result && !unresolved(checkpoint.result))
        return checkpoint.result;
    let result;
    if (checkpoint.phase === 'prepared') {
        // Reference collisions are rejected before the submission marker/network call.
        if (operations.reserve) {
            try {
                await operations.reserve(checkpoint.prepared, job.data.queueId);
            }
            catch (error) {
                result = { success: false, status: 409, error: error instanceof Error ? error.message : String(error) };
                await save({ ...checkpoint, phase: 'outcome', result, reported: false });
                if (job.data.reportToPortal && job.data.queueId)
                    await operations.report(job.data.queueId, result, job.attemptsMade + 1);
                await save({ ...job.data.checkpoint, reported: true });
                return result;
            }
        }
        checkpoint = { ...checkpoint, phase: 'submitting' };
        await save(checkpoint);
        try {
            // A separate atomic marker fences overlapping/stalled BullMQ workers even
            // if both loaded the same pre-submission checkpoint before losing a lock.
            const first = operations.beginSubmission ? await operations.beginSubmission(job.data.queueId) : true;
            result = first ? await operations.submit(checkpoint.prepared)
                : await operations.reconcile(checkpoint.prepared, checkpoint.result);
        }
        catch (error) {
            result = uncertain(error);
        }
    }
    else {
        try {
            result = checkpoint.prepared ? await operations.reconcile(checkpoint.prepared, checkpoint.result) : checkpoint.result;
        }
        catch (error) {
            result = uncertain(error);
        }
    }
    checkpoint = { ...checkpoint, phase: 'outcome', result, reported: false };
    await save(checkpoint);
    if (job.data.reportToPortal && job.data.queueId) {
        await operations.report(job.data.queueId, result, job.attemptsMade + 1);
    }
    await save({ ...checkpoint, reported: true });
    // On retry, only reconciliation runs. Exhaustion leaves the portal unknown or
    // accepted and retains the failed job for an operator to retry safely.
    if (unresolved(result))
        throw new Error(result.error || 'Payment awaits bank confirmation; retry status enquiry only');
    return result;
}
