const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

function fixture() {
  const jobs = new Map(), reports = [];
  let lastOptions;
  class Queue {
    async add(name, data, options) {
      lastOptions = options;
      if (!jobs.has(options.jobId)) jobs.set(options.jobId, {
        data, id: options.jobId, attemptsMade: 0, state: 'waiting', getState: async function () { return this.state; },
      });
      return jobs.get(options.jobId);
    }
    async getJob(id) { return jobs.get(id); }
  }
  const filename = path.resolve(__dirname, '../dist/queue.js');
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = module.require.bind(module);
  module.require = id => id === 'bullmq' ? { Queue, JobScheduler: class {}, Worker: class {} }
    : id === './portalQueueClient' ? { reportPaymentResult: async (...args) => reports.push(args) }
    : original(id);
  module._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { enqueue: module.exports.enqueuePaymentWork, jobs, reports, options: () => lastOptions };
}

test('portal redeliveries share a deterministic retained job and replay the saved outcome', async () => {
  const f = fixture();
  const payment = { paymentId: 'SAGE1' };
  const job = await f.enqueue(payment, 'portal:queue:1', null, true);
  assert.equal(f.options().removeOnComplete, false);
  assert.equal(f.options().removeOnFail, false);
  assert.match(job.id, /^[a-f0-9]{64}$/);
  job.state = 'completed';
  job.data.checkpoint = { phase: 'outcome', result: { success: true, status: 200 } };
  assert.equal((await f.enqueue(payment, 'portal:queue:1', null, true)).id, job.id);
  assert.equal(f.jobs.size, 1);
  assert.equal(f.reports[0][1].success, true);
});

test('same queue identity with a different payload is rejected', async () => {
  const f = fixture();
  await f.enqueue({ amount: 10 }, 'queue1');
  await assert.rejects(f.enqueue({ amount: 999 }, 'queue1'), /different payment payload/);
  assert.equal(f.jobs.size, 1);
});

test('retained failed legacy jobs are reported unknown without being replaced', async () => {
  const f = fixture();
  const job = await f.enqueue({ amount: 10 }, 'queue1', null, true);
  job.state = 'failed';
  await f.enqueue({ amount: 10 }, 'queue1', null, true);
  assert.equal(f.jobs.size, 1);
  assert.equal(f.reports[0][1].unknown, true);
});
