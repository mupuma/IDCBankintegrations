'use client';

import { useEffect, useState } from 'react';
import type { ApprovalStage, WorkflowDefinition } from '@/app/lib/paymentApprovals';

const blankStage = (): ApprovalStage => ({ name: '', approverIds: [], required: 1 });
const initial = () => ({ name: '', bankCode: '', sourceBank: '', stages: [blankStage()] });
const input = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
const button = 'rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50';

export default function ApprovalWorkflowsPage() {
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/v1/approval_workflows').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setWorkflows(data.workflows);
      setUsers(data.users);
      setBanks(data.banks);
    }).catch(error => setMessage(error.message)).finally(() => setBusy(false));
  }, []);

  function setStage(index: number, patch: Partial<ApprovalStage>) {
    setForm(current => ({ ...current, stages: current.stages.map((stage, i) => index === i ? { ...stage, ...patch } : stage) }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/approval_workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const saved = data.workflow as WorkflowDefinition;
      setWorkflows(current => [...current.filter(old => old.bankCode !== saved.bankCode
        || old.sourceBank.toUpperCase() !== saved.sourceBank.toUpperCase()), saved]);
      setMessage('Workflow saved for new payments.');
      setEditing(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this workflow.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="max-w-4xl space-y-5">
    <h1 className="text-2xl font-semibold">Approval Workflows</h1>
    <p className="text-sm text-slate-600">A source-account rule takes precedence over its bank rule, followed by the default workflow. Payments require a matching workflow.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} onClick={() => { setForm(initial()); setEditing(false); }}>New workflow</button>
      {workflows.map(workflow => <button type="button" className={button} key={workflow.version}
        onClick={() => { setForm(workflow); setEditing(true); }}>{workflow.name} ({workflow.sourceBank || workflow.bankCode || 'Default'})</button>)}
    </div>
    <form className="space-y-4 rounded-xl border bg-white p-5" onSubmit={save}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Workflow name
          <input className={input} required maxLength={100} value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
        </label>
        <label className="text-sm">Bank
          <select className={input} value={form.bankCode} disabled={editing}
            onChange={event => setForm(current => ({ ...current, bankCode: event.target.value, sourceBank: '' }))}>
            <option value="">All banks (default)</option>
            {banks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
          </select>
        </label>
        <label className="text-sm">Source account code
          <input className={input} value={form.sourceBank} maxLength={100} disabled={!form.bankCode || editing}
            placeholder="Any source account"
            onChange={event => setForm(current => ({ ...current, sourceBank: event.target.value }))} />
        </label>
      </div>
      {form.stages.map((stage, index) => <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4" key={index}>
        <legend className="px-2 font-semibold">Stage {index + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Stage name
            <input className={input} value={stage.name} required maxLength={100}
              onChange={event => setStage(index, { name: event.target.value })} />
          </label>
          <label className="text-sm">Approvals required
            <input className={input} type="number" min={1} max={Math.max(1, stage.approverIds.length)} required
              value={stage.required} onChange={event => setStage(index, { required: Number(event.target.value) })} />
          </label>
        </div>
        <label className="block text-sm">Eligible users
          <select className={input} multiple size={Math.min(6, Math.max(2, users.length))} required
            value={stage.approverIds.map(String)}
            onChange={event => setStage(index, { approverIds: Array.from(event.target.selectedOptions, option => Number(option.value)) })}>
            {users.map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
          </select>
        </label>
        <button type="button" className={button} disabled={form.stages.length === 1}
          onClick={() => setForm(current => ({ ...current, stages: current.stages.filter((_, i) => i !== index) }))}>Remove stage</button>
      </fieldset>)}
      <div className="flex gap-3">
        <button type="button" className={button} disabled={form.stages.length >= 20}
          onClick={() => setForm(current => ({ ...current, stages: [...current.stages, blankStage()] }))}>Add stage</button>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>Save workflow</button>
      </div>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
