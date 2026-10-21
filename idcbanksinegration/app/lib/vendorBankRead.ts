export function normalizeVendorBankRecord(bank: any) {
  const record = bank.toJSON ? bank.toJSON() : bank;
  let address = record.physicalAddress;
  if (typeof address === 'string' && address.trim()) {
    try { address = JSON.parse(address); }
    catch { address = { streetName: address.trim(), town: '', plotNo: '' }; }
  }
  return { ...record, ...(record.id !== undefined ? { id: `portal-${record.id}` } : {}), physicalAddress: address || null };
}

export function vendorBankReadError(error: unknown) {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  let number: number | undefined, code = '';
  while (pending.length && seen.size < 20) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const item = value as { number?: number; code?: string; original?: unknown; parent?: unknown; cause?: unknown; errors?: unknown[] };
    number ??= item.number;
    if (['ELOGIN', 'ETIMEOUT', 'ESOCKET', 'ER_NO_SUCH_TABLE', 'ER_ACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_DATA_TOO_LONG'].includes(item.code || '')) code = item.code!;
    pending.push(item.original, item.parent, item.cause);
    if (Array.isArray(item.errors)) pending.push(...item.errors);
  }
  if (code === 'ER_NO_SUCH_TABLE') return 'The portal MySQL vendor table is missing. Enable DB_SYNC=true or apply create_vendor_bank_details.sql to the portal MySQL database.';
  if (code === 'ER_DATA_TOO_LONG') return 'A portal MySQL vendor column is too short for the Sage value. Apply the portal contact-column upgrade; do not alter SQL Server or truncate the source value.';
  if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_TABLEACCESS_DENIED_ERROR') return 'The portal MySQL database account lacks access. Check DB_USER, DB_NAME and portal table permissions.';
  if (number === 207) return 'Sage is missing a source column. Check the configured company database and server log; portal vendor fields belong in MySQL, not SQL Server.';
  if (number === 208) return 'A required Sage table was not found. Check SAGE_DB_NAME and that VENBANK exists in the selected company database.';
  if (number === 1088 || number === 51000) return 'The portal could not read legacy Sage VENBANK. Verify the company database, SAGE_VENBANK_SCHEMA and SELECT permissions. Do not alter SQL Server.';
  if (number === 51001) return 'Legacy VENBANK schema setup is disabled. Deploy the updated portal and store vendor details in MySQL.';
  if ([229, 262, 2760].includes(number || 0)) return 'The Sage database account lacks read access. Ask the administrator to verify SELECT permissions; portal schema changes belong in MySQL.';
  if (code === 'ELOGIN') return 'Sage database login failed. Check the portal Sage database credentials and company database.';
  if (code === 'ETIMEOUT' || code === 'ESOCKET') return 'The portal could not reach Sage or the database request timed out. Check connectivity and the portal server log.';
  return 'Unable to load portal vendor bank details. Check the portal database and server log.';
}

export function vendorBankFailureDetails(error: unknown) {
  const pending: unknown[] = [error], seen = new Set<unknown>();
  const result: { code?: string; number?: number; column?: string } = {};
  while (pending.length && seen.size < 20) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const item = value as { code?: string; number?: number; errno?: number; sqlMessage?: string; message?: string; cause?: unknown; original?: unknown; parent?: unknown; errors?: unknown[] };
    if (item.code && /^[A-Z0-9_]{1,64}$/.test(item.code)) result.code = item.code;
    result.number ??= item.number ?? item.errno;
    const match = /Data too long for column '([A-Z_]+)'/i.exec(item.sqlMessage || item.message || '');
    if (match && ['PHONE_NUMBER', 'EMAIL', 'VENDORID', 'ACCVEN', 'ACCNAME', 'BANKID', 'SORTCDE', 'BRNCH', 'SWIFTCDE', 'TPIN', 'PURPOSE_CODE', 'SECTOR_CODE', 'COUNTRY_OF_ORIGIN'].includes(match[1].toUpperCase())) result.column = match[1].toUpperCase();
    pending.push(item.cause, item.original, item.parent);
    if (Array.isArray(item.errors)) pending.push(...item.errors);
  }
  return result;
}
