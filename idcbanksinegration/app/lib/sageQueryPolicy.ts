// Transaction-scoped coordination only: this creates no SQL Server objects.
// Keep this exact statement shared with the cashbook writer; never allow EXEC
// generally or accept extra statements appended to this query.
export const SAGE_CASHBOOK_LOCK_SQL = "DECLARE @lockResult int; EXEC @lockResult = sp_getapplock @Resource = 'IDC_CASHBOOK_BATCH', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 60000; SELECT @lockResult AS lockResult;";

export function assertSageQueryAllowed(input: unknown, allowCashbookWrites = true) {
  const sql = typeof input === 'string' ? input : (input as { query?: unknown })?.query;
  if (typeof sql !== 'string') throw new Error('Sage SQL must be an explicit query');
  if (sql === SAGE_CASHBOOK_LOCK_SQL) {
    if (!allowCashbookWrites) throw new Error('SQL Server is read-only. Sage cashbook writes are disabled.');
    return;
  }
  // Exclude quoted values/identifiers and comments before inspecting SQL tokens.
  const tokens = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\[(?:\]\]|[^\]])*\]|--[^\r\n]*|\/\*[\s\S]*?\*\//g, ' ');
  if (/\b(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|DENY|EXEC|EXECUTE|DBCC|RESTORE|BACKUP)\b/i.test(tokens)
    || /\bSELECT\b[^;]*\bINTO\b/i.test(tokens)) {
    throw new Error('SQL Server schema and administrative changes are disabled. Store portal fields in MySQL.');
  }
  if (!allowCashbookWrites && (!/^\s*(SELECT|WITH)\b/i.test(tokens)
    || /\b(INSERT|UPDATE|DELETE|MERGE|INTO|BULK|NEXT\s+VALUE)\b/i.test(tokens))) {
    throw new Error('SQL Server is read-only. Sage cashbook writes are disabled.');
  }
}
