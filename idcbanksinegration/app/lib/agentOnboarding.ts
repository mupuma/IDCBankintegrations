import { connectDatabase, getSequelize } from './db';
import { BankIntegration } from '@/app/models/internal/BankIntegration';
import { BankAgentProfile } from '@/app/models/internal/BankAgentProfile';
import { BankRegistryError } from './bankRegistry';
import { discoverAgent, encryptAgentValue, decryptAgentValue, validateConfiguration, tokenMatches } from './agentConfiguration';
import type { AgentManifest } from '../../../shared/bank-agent-v1';

function code(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{1,19}$/.test(value)) throw new BankRegistryError('Invalid bank code.');
  return value;
}
async function registration(bankCode: string) {
  await connectDatabase();
  const bank = await BankIntegration.findByPk(bankCode);
  if (!bank) throw new BankRegistryError('Bank not found.', 404);
  if (bank.adapter !== 'agent-v1') throw new BankRegistryError('Existing bank adapters keep their agent environment configuration.', 409);
}
function summary(row: BankAgentProfile | null) {
  if (!row) return { revision: 0, agentUrl: '', manifest: null, configured: false, configuredKeys: [] as string[] };
  const configuration = row.encryptedConfiguration ? decryptAgentValue(row.bankCode, 'configuration', row.encryptedConfiguration) as Record<string, unknown> : {};
  return { revision: row.revision, agentUrl: row.agentUrl, manifest: JSON.parse(row.manifestJson) as AgentManifest,
    configured: Boolean(row.encryptedConfiguration), configuredKeys: Object.keys(configuration) };
}
export async function readAgentProfile(bankCode: string) {
  await registration(code(bankCode));
  return summary(await BankAgentProfile.findByPk(bankCode));
}
export async function saveAgentProfile(body: Record<string, unknown>) {
  const bankCode = code(body.bankCode);
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new BankRegistryError('Current agent revision is required.');
  const discover = body.action === 'discover';
  if (!discover && body.action !== 'configure') throw new BankRegistryError('Unsupported onboarding action.');
  const keys = discover ? ['action', 'bankCode', 'revision', 'agentUrl', 'token'] : ['action', 'bankCode', 'revision', 'configuration'];
  if (Object.keys(body).some(key => !keys.includes(key))) throw new BankRegistryError('Unsupported onboarding field.');
  await registration(bankCode);
  const discovered = discover ? await discoverAgent(bankCode, body.agentUrl, body.token) : null;
  const db = await getSequelize();
  return db.transaction(async transaction => {
    // Lock the existing parent even for the first onboarding request.
    const bank = await BankIntegration.findByPk(bankCode, { transaction, lock: transaction.LOCK.UPDATE });
    if (!bank || bank.adapter !== 'agent-v1' || bank.enabled) throw new BankRegistryError('Only disabled agent-v1 drafts can be configured.', 409);
    let row = await BankAgentProfile.findByPk(bankCode, { transaction });
    if ((row?.revision ?? 0) !== body.revision) throw new BankRegistryError('Agent settings changed. Reload before saving.', 409);
    if (discovered) {
      const values = { bankCode, agentUrl: discovered.agentUrl, manifestJson: JSON.stringify(discovered.manifest),
        encryptedToken: encryptAgentValue(bankCode, 'token', body.token), encryptedConfiguration: null, revision: Number(body.revision) + 1 };
      // Rediscovery or token rotation intentionally requires configuration again.
      if (row) await row.update(values, { transaction });
      else row = await BankAgentProfile.create(values, { transaction });
    } else {
      if (!row) throw new BankRegistryError('Discover the agent before saving its configuration.', 409);
      const manifest = JSON.parse(row.manifestJson) as AgentManifest;
      const previous = row.encryptedConfiguration ? decryptAgentValue(bankCode, 'configuration', row.encryptedConfiguration) as Record<string, unknown> : {};
      const configuration = validateConfiguration(manifest, body.configuration, previous);
      await row.update({ encryptedConfiguration: encryptAgentValue(bankCode, 'configuration', configuration), revision: row.revision + 1 }, { transaction });
    }
    return summary(row);
  });
}
export async function deliverAgentConfiguration(bankCode: string, token: string) {
  code(bankCode);
  await connectDatabase();
  const row = await BankAgentProfile.findByPk(bankCode);
  if (!row || !token || !tokenMatches(token, String(decryptAgentValue(bankCode, 'token', row.encryptedToken)))) throw new BankRegistryError('Invalid agent credentials.', 401);
  if (!row.encryptedConfiguration) throw new BankRegistryError('Agent configuration has not been saved.', 409);
  return { protocol: 'bank-agent/v1', bankCode, revision: row.revision,
    configuration: decryptAgentValue(bankCode, 'configuration', row.encryptedConfiguration) };
}
