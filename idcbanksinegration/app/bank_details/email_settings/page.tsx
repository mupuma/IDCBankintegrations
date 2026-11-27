'use client';

import { useEffect, useState } from 'react';

const initial = { host: '', port: '587', mode: 'starttls', username: '', password: '', sender: '' };
const field = 'block w-full rounded border border-slate-300 px-3 py-2';

export default function EmailSettingsPage() {
  const [configuration, setConfiguration] = useState(initial);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/v1/email_settings').then(async response => {
      if (!response.ok) throw new Error('Unable to load email settings.');
      const data = await response.json();
      if (data.configuration) setConfiguration({ ...initial, ...data.configuration, port: String(data.configuration.port) });
      setEnabled(data.enabled);
    }).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false));
  }, []);

  async function submit(action: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/email_settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...configuration, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (action === 'activate') {
        window.location.assign('/login');
        return;
      }
      setMessage(action === 'test' ? 'Test email sent to your account.' : 'Settings saved and test email sent.');
      setEnabled(data.enabled);
      if (action === 'save') setConfiguration(current => ({ ...current, password: '' }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update email settings.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="max-w-2xl space-y-4">
    <h1 className="text-2xl font-semibold">Email Settings</h1>
    <p>Email OTP is {enabled ? 'enabled' : 'awaiting activation'}.</p>
    <form className="space-y-4 rounded-xl border bg-white p-5" onSubmit={event => {
      event.preventDefault();
      const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      void submit(button?.value || 'save');
    }}>
      {([
        ['host', 'SMTP host', 'text'], ['port', 'SMTP port', 'number'], ['username', 'SMTP username', 'text'],
        ['password', 'SMTP password', 'password'], ['sender', 'Sender email', 'email'],
      ] as const).map(([key, label, type]) => <label className="block text-sm" key={key}>{label}
        <input className={field} type={type} value={configuration[key]} required={key !== 'username' && key !== 'password'}
          autoComplete={key === 'password' ? 'new-password' : 'off'}
          onChange={event => setConfiguration(current => ({ ...current, [key]: event.target.value }))} />
      </label>)}
      <label className="block text-sm">Encryption
        <select className={field} value={configuration.mode}
          onChange={event => setConfiguration(current => ({ ...current, mode: event.target.value }))}>
          <option value="starttls">STARTTLS</option>
          <option value="tls">TLS</option>
        </select>
      </label>
      <p className="text-sm text-slate-600">Leave the password blank to keep saved credentials. Test delivery before enabling OTP.</p>
      <div className="flex flex-wrap gap-3">
        <button className="rounded border px-3 py-2" disabled={busy} value="test">Send test email</button>
        <button className="rounded border px-3 py-2" disabled={busy} value="save">Save settings</button>
        {!enabled && <button className="rounded bg-slate-900 px-3 py-2 text-white" disabled={busy} value="activate">Enable email OTP</button>}
      </div>
    </form>
    {message && <p role="status">{message}</p>}
  </div>;
}
