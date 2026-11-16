# Source account selection

Payments are selected in this order: processing bank, source account, transaction type.
This applies to individual payments and bulk settings. Changing the bank clears the
source account and transaction type; changing the account clears the transaction type.
Use **Validate selected** above the payment list to check all selected payments,
including selections on other pages. The summary counts ready payments and payments
that need attention; each row shows its validation issues. This does not queue or
send payments.

The posting API checks that the selected source account belongs to that bank before
creating either an individual or bulk queue request.

## Setup

In Source Accounts, a user with bank-details write permission assigns a **Processing
bank** to each source account. Keep **Source account code (Sage)** as its existing
Sage code. Several different Sage codes can share one processing bank; neither the
Sage code nor account number is replaced with a portal integration code.

Only legacy source codes exactly equal to IZB, ZANACO or ZICB are inferred. Other
codes require explicit assignment. Inactive accounts cannot be selected or submitted.
The configured branch bank list still applies; Infratel remains ZICB only.
Account assignments are saved locally and changes appear in the audit log.

## Deployment

The add-only portal schema sync creates the nullable `source_accounts.processing_bank`
column automatically. If `DB_SYNC=false`, run
`sql/add_source_account_processing_bank.sql` on the portal MySQL database before
restarting the application. This migration does not change Sage.

Rebuild and restart the portal. Assign processing banks to existing custom source
codes before sending new payments. Existing queued transactions are not rewritten.
