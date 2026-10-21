"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRecoveryCommand = applyRecoveryCommand;
async function applyRecoveryCommand(command, operations) {
    const job = await operations.find(command.queueId);
    if (!job)
        throw new Error('Recovery job is missing from Redis. Do not recreate it; reconcile the original bank reference manually.');
    const checkpoint = job.data.checkpoint;
    if (!checkpoint)
        throw new Error('Legacy job has no recoverable checkpoint; manual reconciliation is required.');
    if (command.action === 'retry_reporting') {
        if (!checkpoint.result)
            throw new Error('No saved outcome is available to report yet.');
        await operations.report(command.queueId, checkpoint.result, job.attemptsMade);
        return 'Saved outcome reported. No bank submission was made.';
    }
    if (command.action === 'retry_connection') {
        if (checkpoint.phase !== 'prepared' || !checkpoint.result?.notSent || !checkpoint.result.retryable
            || await operations.submissionStarted(command.queueId))
            throw new Error('No proof of a pre-submission connection failure. Check bank status instead.');
    }
    else if (command.action === 'check_status') {
        if (!checkpoint.prepared)
            throw new Error('Original bank reference is missing from this legacy checkpoint; manual bank reconciliation is required.');
        if (checkpoint.phase === 'prepared')
            throw new Error('Payment has not been submitted. Use Retry connection to resume it.');
        if (checkpoint.result && !checkpoint.result.unknown && !checkpoint.result.accepted) {
            await operations.report(command.queueId, checkpoint.result, job.attemptsMade);
            return 'The saved final outcome was reported without resubmission.';
        }
    }
    else
        throw new Error('Unsupported recovery command');
    const state = await job.getState();
    if (state === 'failed' || state === 'completed')
        await job.retry(state, { resetAttemptsMade: true });
    else if (state === 'delayed')
        await job.promote();
    else if (!['active', 'waiting', 'waiting-children', 'prioritized'].includes(state))
        throw new Error('Job is not in a recoverable state');
    return command.action === 'retry_connection' ? 'Pre-submission connection retry scheduled.' : 'Original-reference status enquiry scheduled. No new payment will be submitted.';
}
