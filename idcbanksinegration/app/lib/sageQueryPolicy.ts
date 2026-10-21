export function assertSageQueryAllowed(input: unknown, allowCashbookWrites = true) {
  const sql = typeof input === 'string' ? input : (input as { query?: unknown })?.query;
  if (typeof sql !== 'string') throw new Error('Sage SQL must be an explicit query');
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
