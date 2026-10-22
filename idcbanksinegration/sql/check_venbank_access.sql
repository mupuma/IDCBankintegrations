-- READ ONLY. Run in the company database configured by SAGE_DB_NAME.
-- Run as the portal database user to check its visibility and permissions,
-- then as a DBA if the portal account cannot see VENBANK.
SELECT @@SERVERNAME AS server_name, DB_NAME() AS database_name,
       ORIGINAL_LOGIN() AS login_name, USER_NAME() AS database_user,
       SCHEMA_NAME() AS default_schema;

SELECT s.name AS table_schema, t.name AS table_name,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT', 'SELECT') AS can_select,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT', 'INSERT') AS can_insert,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT', 'UPDATE') AS can_update,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT', 'ALTER') AS can_alter
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.name = 'VENBANK';

SELECT s.name AS table_schema, c.name AS column_name
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name = 'VENBANK'
ORDER BY s.name, c.column_id;

SELECT HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DEFINITION') AS can_view_database_definitions,
       HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS can_create_table;
