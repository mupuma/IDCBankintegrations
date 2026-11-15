// Transaction-scoped coordination only: this creates no SQL Server objects.
// Keep this exact statement shared with the cashbook writer; never allow EXEC
// generally or accept extra statements appended to this query.
export const SAGE_CASHBOOK_LOCK_SQL = "DECLARE @lockResult int; EXEC @lockResult = sp_getapplock @Resource = 'IDC_CASHBOOK_BATCH', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 60000; SELECT @lockResult AS lockResult;";

// Sequelize's MSSQL connection bootstrap reads the server version using local
// variables. Allow this exact read-only batch, without permitting arbitrary
// DECLARE/SET batches or appending further statements.
export const SAGE_VERSION_CHECK_SQL = "DECLARE @ms_ver NVARCHAR(20); SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY('ProductVersion'))); SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX('.', @ms_ver)+1, 20)) AS 'version'";

export function assertSageQueryAllowed(input: unknown, allowCashbookWrites = true) {
  const sql = typeof input === 'string' ? input : (input as { query?: unknown })?.query;
  if (typeof sql !== 'string') throw new Error('Sage SQL must be an explicit query');
  if (sql === SAGE_VERSION_CHECK_SQL) return;
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
