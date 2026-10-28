import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { validateManifest, type AgentManifest } from '../../../shared/bank-agent-v1';
import { BankRegistryError } from './bankRegistry';

export function configurationKey() {
  const encoded = process.env.BANK_AGENT_CONFIG_KEY || '';
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new BankRegistryError('Configure BANK_AGENT_CONFIG_KEY with a 32-byte base64 encryption key on the portal.', 503);
  return key;
}
export function encryptAgentValue(bankCode: string, purpose: string, value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', configurationKey(), iv);
  cipher.setAAD(Buffer.from(`bank-agent/v1:${bankCode}:${purpose}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}
export function decryptAgentValue(bankCode: string, purpose: string, envelope: string): unknown {
  try {
    const [version, iv, tag, ciphertext, extra] = envelope.split('.');
    if (version !== 'v1' || extra !== undefined) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', configurationKey(), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(`bank-agent/v1:${bankCode}:${purpose}`));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  } catch { throw new BankRegistryError('Agent configuration could not be decrypted. Check the portal encryption key.', 503); }
}
export function tokenMatches(actual: string, expected: string) {
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
export function validAgentToken(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(value)) throw new BankRegistryError('Use a dedicated agent token of 32 to 256 letters, digits, underscores or hyphens.');
}
export function allowedAgentUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw new BankRegistryError('Enter an allowed agent origin.');
  let url: URL;
  try { url = new URL(value); } catch { throw new BankRegistryError('Enter a valid agent URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && process.env.BANK_AGENT_ALLOW_LOOPBACK_HTTP === 'true')))
    throw new BankRegistryError('Agent URL must be an HTTPS origin without a path, credentials or query.');
  const allowed = (process.env.BANK_AGENT_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
  if (!allowed.includes(url.origin)) throw new BankRegistryError('The agent origin is not in BANK_AGENT_ALLOWED_ORIGINS on the portal.');
  return url.origin;
}
export async function discoverAgent(bankCode: string, agentUrl: unknown, token: unknown): Promise<{ agentUrl: string; manifest: AgentManifest }> {
  configurationKey(); validAgentToken(token);
  const origin = allowedAgentUrl(agentUrl);
  try {
    const response = await fetch(`${origin}/v1/manifest`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const result = await reader.read(); if (result.done) break;
        size += result.value.length;
        if (size > 32768) throw new Error();
        chunks.push(result.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const manifest = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (validateManifest(manifest).length || manifest.bankCode !== bankCode) throw new Error();
    return { agentUrl: origin, manifest };
  } catch { throw new BankRegistryError('Agent discovery failed. Check connectivity, TLS trust, the agent token, bank code and bank-agent/v1 manifest.', 502); }
}
export function validateConfiguration(manifest: AgentManifest, input: unknown, previous: Record<string, unknown> = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BankRegistryError('Configuration must be an object.');
  const supplied = input as Record<string, unknown>;
  if (Object.keys(supplied).some(key => !manifest.configuration.some(field => field.key === key))) throw new BankRegistryError('Unknown configuration field.');
  const result: Record<string, unknown> = Object.create(null);
  for (const field of manifest.configuration) {
    // Omitted secrets are retained. Explicit null clears an optional field.
    const value = Object.hasOwn(supplied, field.key) ? supplied[field.key] : previous[field.key];
    if (value === undefined || value === null || value === '') {
      if (field.required) throw new BankRegistryError(`${field.key} is required.`);
      continue;
    }
    let valid = false;
    if (field.type === 'boolean') valid = typeof value === 'boolean';
    else if (field.type === 'integer') valid = Number.isSafeInteger(value);
    else if (typeof value === 'string' && value.length <= 8192) {
      valid = true;
      if (field.type === 'url') {
        try { const url = new URL(value); valid = url.protocol === 'https:' && !url.username && !url.password; } catch { valid = false; }
      }
    }
    if (!valid) throw new BankRegistryError(`${field.key} has an invalid ${field.type} value.`);
    result[field.key] = value;
  }
  return result;
}
