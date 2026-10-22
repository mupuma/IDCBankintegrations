-- READ ONLY. Run in the configured Sage company database (SAGE_DB_NAME).
-- This matches the vendor master source, including inactive/no-payment vendors.
SELECT DB_NAME() AS company_database,
       COUNT(*) AS sage_vendor_count
FROM APVEN
WHERE LTRIM(RTRIM(VENDORID)) <> '';
