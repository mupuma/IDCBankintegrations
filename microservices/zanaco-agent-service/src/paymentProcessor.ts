import type { JobResult, ZanacoPreparedRequest } from './types';

export type Checkpoint = {
  prepared?: ZanacoPreparedRequest;
  phase: 'prepared' | 'submitting' | 'outcome';
  result?: JobResult;
  reported?: boolean;
};
export type PaymentWork = {
  payment: unknown; queueId?: string; sourceBank?: string | null; reportToPortal?: boolean;
  checkpoint?: Checkpoint;
};
export interface DurableJob {
  data: PaymentWork;
  attemptsMade: number;
  attemptsStarted?: number;
  updateData(data: PaymentWork): Promise<void>;
}
export interface PaymentOperations {
  prepare(payment: unknown): ZanacoPreparedRequest;
  authorize?(prepared: ZanacoPreparedRequest): Promise<void>;
  reserve?(prepared: ZanacoPreparedRequest, queueId: string): Promise<void>;
  beginSubmission?(queueId: string): Promise<boolean>;
  submit(prepared: ZanacoPreparedRequest): Promise<JobResult>;
  reconcile(prepared: ZanacoPreparedRequest, previous?: JobResult): Promise<JobResult>;
  report(queueId: string, result: JobResult, attempts: number): Promise<void>;
}

const unresolved = (result: JobResult) => Boolean(result.unknown || result.accepted || (result.notSent && result.retryable));
const uncertain = (error: unknown): JobResult => ({
  success: false, status: 503, unknown: true,
  error: error instanceof Error ? error.message : String(error),
});

// BullMQ persists each checkpoint in Redis. No network submission is allowed until
// the submitting marker is saved. Recovery from that marker only reconciles.
export async function processPaymentJob(job: DurableJob, operations: PaymentOperations): Promise<JobResult> {
  async function save(checkpoint: Checkpoint) {
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
    let prepared: ZanacoPreparedRequest;
    try { prepared = operations.prepare(job.data.payment); }
    catch (error) {
      // Fence any overlapping worker before asserting that validation prevented
      // submission. A stale worker must not send after this outcome is reported.
      const fenced = operations.beginSubmission ? await operations.beginSubmission(job.data.queueId!) : true;
      const result: JobResult = { success: false, status: fenced ? 400 : 409, notSent: fenced, unknown: !fenced,
        error: fenced ? error instanceof Error ? error.message : String(error) : 'Instruction already started; reconcile the original reference before any correction' };
      checkpoint = { phase: 'outcome', result };
      await save(checkpoint);
    }
    if (!checkpoint) {
      checkpoint = { prepared: prepared!, phase: 'prepared' };
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
  if (checkpoint.result && !unresolved(checkpoint.result)) return checkpoint.result;

  let result: JobResult;
  if (checkpoint.phase === 'prepared') {
    // Authentication sends no payment. Keep this checkpoint resumable if login
    // fails; only cross the durable submission boundary after credentials work.
    try { await operations.authorize?.(checkpoint.prepared!); }
    catch (error) {
      result = { success: false, status: 503, notSent: true, retryable: true, error: error instanceof Error ? error.message : String(error) };
      await save({ ...checkpoint, result, reported: false });
      if (job.data.reportToPortal && job.data.queueId) await operations.report(job.data.queueId, result, job.attemptsMade + 1);
      await save({ ...job.data.checkpoint!, reported: true });
      throw new Error(result.error || 'Authentication failed before payment submission');
    }
    // Reference collisions are rejected before the submission marker/network call.
    if (operations.reserve) {
      try { await operations.reserve(checkpoint.prepared!, job.data.queueId!); }
      catch (error) {
        result = { success: false, status: 409, error: error instanceof Error ? error.message : String(error) };
        await save({ ...checkpoint, phase: 'outcome', result, reported: false });
        if (job.data.reportToPortal && job.data.queueId) await operations.report(job.data.queueId, result, job.attemptsMade + 1);
        await save({ ...job.data.checkpoint!, reported: true });
        return result;
      }
    }
    checkpoint = { ...checkpoint, phase: 'submitting', result: undefined, reported: false };
    await save(checkpoint);
    try {
      // A separate atomic marker fences overlapping/stalled BullMQ workers even
      // if both loaded the same pre-submission checkpoint before losing a lock.
      const first = operations.beginSubmission ? await operations.beginSubmission(job.data.queueId!) : true;
      result = first ? await operations.submit(checkpoint.prepared!)
        : await operations.reconcile(checkpoint.prepared!, checkpoint.result);
    }
    catch (error) { result = uncertain(error); }
  } else {
    try { result = checkpoint.prepared ? await operations.reconcile(checkpoint.prepared, checkpoint.result) : checkpoint.result!; }
    catch (error) { result = uncertain(error); }
  }
  checkpoint = { ...checkpoint, phase: 'outcome', result, reported: false };
  await save(checkpoint);
  if (job.data.reportToPortal && job.data.queueId) {
    await operations.report(job.data.queueId, result, job.attemptsMade + 1);
  }
  await save({ ...checkpoint, reported: true });
  // On retry, only reconciliation runs. Exhaustion leaves the portal unknown or
  // accepted and retains the failed job for an operator to retry safely.
  if (unresolved(result)) throw new Error(result.error || 'Payment awaits bank confirmation; retry status enquiry only');
  return result;
}
