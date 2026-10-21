# Vendor TPIN and SWIFT details

Enter TPIN under **Vendor bank details**, alongside the existing SWIFT code. The same record now holds the SWIFT payment purpose and business sector codes. These fields are optional for domestic payments and required when sending Zanaco SWIFT payments. The payment list displays them for review and no longer presents an entry form.

TPIN is read in this order: saved `VENBANK.TPIN`, Sage vendor optional field `TPIN` in `APVENO`, then the Sage vendor tax number `APVEN.TAXNBR`. Confirm the Sage tax number contains the required TPIN. Saved values are never overwritten during payment refresh. The portal can save a TPIN when none exists in Sage.

Purpose and sector codes are bank-defined classifications. Obtain the applicable codes from Zanaco; do not substitute the payment remarks. The saved vendor defaults must apply to the payment being sent. They can also come from Sage optional fields `PURPOSE` / `PURPOSECODE` and `SECTOR` / `SECTORCODE`. Custom optional field names can be mapped in the portal environment, for example:

```dotenv
SAGE_VENDOR_BANK_OPTIONAL_FIELDS={"tpin":["TPIN"],"purposeCode":["PURPOSE"],"sectorCode":["SECTOR"]}
```

After editing vendor details, fetch payments again so the payment list receives the saved values. All bank payload validations remain active. This does not change already queued instructions.

## Automatic schema additions

On first database connection after restart, the portal creates missing internal MySQL tables and adds missing columns when `DB_SYNC` is not `false`. The Sage connection creates the portal-owned `VENBANK` extension if absent and adds missing extension columns when `SAGE_SYNC_VENBANK_SCHEMA` is not `false`. For explicit settings use:

```dotenv
DB_SYNC=true
SAGE_SYNC_VENBANK_SCHEMA=true
```

The new nullable VENBANK columns are `TPIN VARCHAR(20)`, `PURPOSE_CODE VARCHAR(8)` and `SECTOR_CODE VARCHAR(8)`. Existing rows and column definitions are preserved. There are no table drops, column drops, truncations, or automatic type conversions. Other Sage accounting tables are never synchronised from ORM definitions. Database users need CREATE TABLE / ALTER permissions for automatic additions. If schema changes are managed separately, use the SQL in `app/lib/venbankSchema.ts` against the Sage company database and keep the flag false.

Build and restart the portal to deploy these changes. Bank agents do not need new environment variables for these vendor fields.
