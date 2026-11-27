# Portal authentication and approvals

## Email OTP

Set `SMTP_ENCRYPTION_KEY` to 32 random bytes encoded as hex. Keep this deployment
secret stable and use the same value across portal instances. The administrator
enters the SMTP host, port, TLS mode, credentials and sender under **Email
Settings**. The SMTP password is encrypted before storage.

With `DB_SYNC=false`, apply `sql/add_email_otp.sql` before deploying. In **User
Management**, add an email address to each active account. Send a test email from
**Email Settings** and confirm delivery to the administrator's inbox. Select
**Enable email OTP** when ready. Existing password-only sessions must sign in
again. Codes expire after five minutes, with five attempts per code and a
one-minute interval between requests.

## Payment approvals

With `DB_SYNC=false`, apply `sql/add_payment_approvals.sql` before deploying.
Before operators submit new payments, an administrator must save a workflow
under **Approval Workflows**. A default workflow covers every bank without
a more specific workflow. Source account rules take precedence over bank rules.

Each stage identifies its eligible users and required approval count. The creator
can approve only when the workflow has one stage and lists that user as an
approver. Assigned users decide from **Payment Approvals**. Rejected instructions
remain in approval history. New workflow versions apply to future submissions.
Instructions already queued before deployment continue through their current
dispatch path.
