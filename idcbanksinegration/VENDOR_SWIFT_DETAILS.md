# Vendor bank details: portal MySQL, Sage read-only source

Vendor bank details, TPIN, SWIFT purpose and sector codes are maintained in the portal MySQL table `vendor_bank_details`. Portal create/edit/delete actions do not change SQL Server. Source accounts, queue records and recovery history also remain in MySQL.

## Deployment

1. For the old deployed build, set `SAGE_SYNC_VENBANK_SCHEMA=false` and restart the portal to stop its startup migration immediately.
2. Deploy this updated portal and run `npm run build`, then restart its service. The new build completely removes SQL Server schema synchronization; that old flag cannot re-enable it.
3. With `DB_SYNC=true`, the portal creates its missing MySQL table automatically without deleting existing data. With `DB_SYNC=false`, apply `sql/create_vendor_bank_details.sql` to the **portal MySQL database only**.
   The updated build widens imported vendor text fields (bank name/code, account/name, routing codes, tax/regulatory codes, country and contacts) to MySQL LONGTEXT. Source values are preserved independently of payment payload limits. VENDORID and its unique index, JSON addresses and timestamps stay unchanged; existing LONGTEXT fields are skipped. With `DB_SYNC=false`, use `sql/widen_vendor_bank_text.sql` in portal MySQL. This upgrade never runs on SQL Server.
4. Existing visible Sage VENBANK rows are read first, then **all APVEN vendor master records** are synchronized into portal MySQL for vendors not already saved. The full master includes vendors with no payments, inactive vendors and vendors whose bank details are complete. There is no 200-vendor limit. Only columns that actually exist in legacy VENBANK are selected. Saved portal corrections and soft-deleted portal records are not overwritten or resurrected. SQL Server IDs are not copied, so existing browser tabs should be refreshed after deployment.
5. If Sage VENBANK is inaccessible or absent, portal MySQL vendor details remain available. No replacement SQL Server table is created. `SAGE_VENBANK_SCHEMA` optionally selects the existing source schema for read-only import.

The vendor selector reads APVEN directly rather than limiting vendors through APPYM/payment history or hiding complete bank records. Missing master records are inserted into MySQL in batches of 200 until every vendor has been processed; the batch size is not a total limit. Optional-field queries use bounded batches too. Inserts never use INSERT IGNORE, which could suppress data-width errors.

The Vendor Bank Details refresh button forces a new Sage synchronization. Routine requests reuse completed synchronization for up to 60 seconds and share any in-flight synchronization. The page shows the Sage master count alongside the paginated portal count. These can differ when portal records were deliberately deleted or legacy/local records have no current APVEN counterpart. `sql/check_sage_vendor_count.sql` provides a read-only count for comparison in the configured Sage company database.

No SQL Server ALTER, CREATE, DROP, TRUNCATE, GRANT, administrative commands or dynamic execution is allowed through the Sage connection. The old SQL Server VENBANK migration is retired. Do not run earlier instructions to grant ALTER or apply SQL Server schema additions.

Existing Sage cashbook posting remains enabled by default, as authorized. No new environment variable is required for that existing accounting flow. If `SAGE_ALLOW_CASHBOOK_WRITES` was explicitly set to `false`, remove that override or set it to `true` to keep cashbook posting enabled. SQL Server schema changes remain blocked regardless of this setting. Vendor maintenance continues to write only to portal MySQL.

## TPIN and SWIFT fields

TPIN is read in this order: saved portal MySQL value, Sage optional field `TPIN` in `APVENO`, then `APVEN.TAXNBR`. Existing legacy VENBANK values are copied to MySQL if readable. The portal does not update those source values. If APVENO is absent, optional-field lookup falls back to the vendor tax number. Confirm the Sage tax number contains the required TPIN.

Purpose and sector codes are bank-defined classifications. Obtain the applicable codes from Zanaco and confirm that the saved defaults apply to each payment. These codes are not free-text payment remarks. Sage optional field aliases are `PURPOSE` / `PURPOSECODE` and `SECTOR` / `SECTORCODE`; custom aliases can be configured with:

```dotenv
SAGE_VENDOR_BANK_OPTIONAL_FIELDS={"tpin":["TPIN"],"purposeCode":["PURPOSE"],"sectorCode":["SECTOR"]}
```

After saving vendor details, fetch payments again. Payment rows display the saved values rather than a data-entry form. Bank validations remain active, and already queued instructions retain their original payloads.

Database failures remain distinct from empty search results. Server logs provide the underlying database error. `sql/check_venbank_access.sql` is an optional read-only diagnostic; no SQL Server migrations are needed for the portal fields.

Vendor import diagnostics identify whether the failure happened while reading Sage or saving the copy in MySQL. A MySQL source-field width failure must not be reported as lost Sage connectivity. Diagnostic logs include error codes and column names without record values.
