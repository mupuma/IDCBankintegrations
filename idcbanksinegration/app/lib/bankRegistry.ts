import { connectDatabase, getSequelize } from './db';
import { BankIntegration } from '@/app/models/internal/BankIntegration';
import { BUILTIN_BANKS, builtinBank } from './bankCatalog';

export class BankRegistryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
let seedPromise: Promise<void> | null = null;

async function ensureRegistry() {
  await connectDatabase();
  if (!seedPromise) seedPromise = (async () => {
    for (const [bankCode, defaults] of Object.entries(BUILTIN_BANKS)) {
      await BankIntegration.findOrCreate({ where: { bankCode }, defaults: {
        bankCode, displayName: defaults.displayName, adapter: defaults.adapter, enabled: true, revision: 1,
      } });
    }
  })().catch(error => { seedPromise = null; throw error; });
  await seedPromise;
}

function serialize(row: BankIntegration) {
  const catalog = builtinBank(row.bankCode);
  const ready = Boolean(catalog && catalog.adapter === row.adapter);
  return { bankCode: row.bankCode, displayName: row.displayName, adapter: row.adapter,
    enabled: row.enabled && ready, status: ready ? 'ready' : 'draft', revision: row.revision,
    transactionTypes: ready ? catalog!.transactionTypes : [] };
}

export async function listBankIntegrations(administration = false) {
  await ensureRegistry();
  const rows = await BankIntegration.findAll({ order: [['displayName', 'ASC']] });
  return rows.map(serialize).filter(row => administration || row.status === 'ready');
}

export async function assertBankAcceptsPayments(bankCode: string) {
  await ensureRegistry();
  const row = await BankIntegration.findByPk(bankCode);
  if (!row || !serialize(row).enabled) throw new BankRegistryError('This bank is not enabled for new payments. Existing payments remain available for reconciliation and recovery.', 409);
}

function codeOf(value: unknown) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(code)) throw new BankRegistryError('Bank code must contain 2 to 20 uppercase letters, digits or underscores, starting with a letter');
  return code;
}
function nameOf(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) throw new BankRegistryError('Enter a bank name of 1 to 120 characters');
  return value.trim();
}

export async function createBankDraft(body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !['bankCode', 'displayName'].includes(key))) throw new BankRegistryError('Only bank code and display name can be supplied for a draft');
  const bankCode = codeOf(body.bankCode), displayName = nameOf(body.displayName);
  await ensureRegistry();
  const [row, created] = await BankIntegration.findOrCreate({ where: { bankCode }, defaults: {
    bankCode, displayName, adapter: 'agent-v1', enabled: false, revision: 1,
  } });
  if (!created) throw new BankRegistryError('That bank code already exists', 409);
  return serialize(row);
}

export async function updateBankRegistration(body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !['bankCode', 'displayName', 'enabled', 'revision'].includes(key))) throw new BankRegistryError('Unsupported bank registration field');
  const bankCode = codeOf(body.bankCode), displayName = nameOf(body.displayName);
  if (typeof body.enabled !== 'boolean' || !Number.isInteger(body.revision)) throw new BankRegistryError('Enabled status and the current revision are required');
  await ensureRegistry();
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const row = await BankIntegration.findByPk(bankCode, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new BankRegistryError('Bank not found', 404);
    if (row.revision !== body.revision) throw new BankRegistryError('This bank was changed by another administrator. Refresh before saving.', 409);
    const catalog = builtinBank(bankCode);
    if (body.enabled && (!catalog || catalog.adapter !== row.adapter)) throw new BankRegistryError('A compatible agent must be onboarded before this draft can accept payments', 409);
    await row.update({ displayName, enabled: body.enabled, revision: row.revision + 1 }, { transaction });
    return serialize(row);
  });
}
