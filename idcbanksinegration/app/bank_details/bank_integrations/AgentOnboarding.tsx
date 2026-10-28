'use client';
import { useState } from 'react';
import type { AgentManifest } from '../../../../shared/bank-agent-v1';

type Profile = { revision: number; agentUrl: string; manifest: AgentManifest | null; configured: boolean; configuredKeys: string[] };
export default function AgentOnboarding({ bankCode }: { bankCode: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [url, setUrl] = useState(''), [token, setToken] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function request(body?: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/v1/bank_integrations/agent?bankCode=${encodeURIComponent(bankCode)}`, body ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ ...body, bankCode, revision: profile?.revision ?? 0 }),
      } : { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load agent settings');
      setProfile(data); setUrl(data.agentUrl); setToken(''); setValues({});
      if (body) setMessage(body.action === 'discover' ? 'Agent verified. Review and save its required configuration.' : 'Configuration saved. The agent can now retrieve it securely. Payment activation is still pending.');
    } catch (value) { setError(value instanceof Error ? value.message : 'Agent onboarding failed'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border bg-slate-50 p-5 space-y-4">
    <div className="flex items-center gap-4"><h3 className="font-semibold">Connect {bankCode} agent</h3><button type="button" disabled={busy} onClick={() => void request()} className="rounded-lg border px-3 py-2 text-sm">{profile ? 'Reload agent settings' : 'Open agent settings'}</button></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    {profile && <>
      <p className="text-sm text-slate-600">{profile.configured ? 'Configuration saved.' : profile.manifest ? 'Agent discovered; configuration required.' : 'No agent connected.'} Discovering again replaces the token and clears saved configuration.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void request({ action: 'discover', agentUrl: url, token }); }}>
        <label className="text-sm">Agent URL<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://agent.example.com" className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Dedicated agent token<input type="password" autoComplete="new-password" required minLength={32} maxLength={256} value={token} onChange={event => setToken(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <button disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-white sm:col-span-2">Verify and discover agent</button>
      </form>
      {profile.manifest && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void request({ action: 'configure', configuration: values }); }}>
        <p className="text-sm">Agent version {profile.manifest.agentVersion}. Declared payment types: {profile.manifest.transactionTypes.join(', ')}.</p>
        {profile.manifest.configuration.map(field => <label key={field.key} className="block text-sm">{field.label}{field.required ? ' *' : ''}
          {field.type === 'boolean' ? <select value={values[field.key] === undefined ? '' : String(values[field.key])} required={field.required && !profile.configuredKeys.includes(field.key)} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value === '' ? null : event.target.value === 'true' }))} className="mt-1 block w-full rounded-lg border p-2"><option value="">{profile.configuredKeys.includes(field.key) ? 'Keep saved value' : 'Select value'}</option><option value="true">Yes</option><option value="false">No</option></select>
          : <input type={field.type === 'secret' ? 'password' : field.type === 'integer' ? 'number' : field.type === 'url' ? 'url' : 'text'} step={field.type === 'integer' ? 1 : undefined} autoComplete="off" maxLength={8192} required={field.required && !profile.configuredKeys.includes(field.key)} value={String(values[field.key] ?? '')} placeholder={profile.configuredKeys.includes(field.key) ? 'Saved; leave unchanged to retain' : ''} onChange={event => setValues(previous => {
            const next = { ...previous };
            if (!event.target.value) delete next[field.key];
            else next[field.key] = field.type === 'integer' ? Number(event.target.value) : event.target.value;
            return next;
          })} className="mt-1 block w-full rounded-lg border p-2" />}
          {!field.required && profile.configuredKeys.includes(field.key) && <button type="button" onClick={() => setValues(previous => ({ ...previous, [field.key]: null }))} className="mt-1 text-xs underline">{values[field.key] === null ? 'Will clear on save' : 'Clear saved value'}</button>}
        </label>)}
        <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white">Save agent configuration</button>
      </form>}
    </>}
  </section>;
}
