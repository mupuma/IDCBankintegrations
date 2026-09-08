'use strict';

const CHANNELS = ['INTERNAL', 'RTGS', 'DDACC'];
const PATHS = { INTERNAL: '/h2h/internal-ft', RTGS: '/h2h/other-bank-rtgs-ft/v1', DDACC: '/h2h/other-bank-ddacc-ft/v1' };
const text = value => String(value ?? '').trim();
function channelFor(type) {
  const channel = ({ INT: 'INTERNAL', INTERNAL: 'INTERNAL', RTGS: 'RTGS', DDACCT: 'DDACC', DDACC: 'DDACC' })[text(type).toUpperCase()];
  if (!channel) throw new Error('ZICB supports Internal FT, RTGS and DDACC; this payment type is not supported');
  return channel;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function paymentDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : '';
  const s = text(value);
  if (validDate(s)) return s;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || !validDate(s.slice(0, 10))) return '';
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}
// Fixed six-place integer arithmetic prevents floating-point totals drifting.
// The enabled currency's allowed scale is supplied by onboarding configuration.
function units(value, scale = 2) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) throw new Error('Amount precision must be between 0 and 6');
  const s = text(value);
  if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('Amount must be a positive decimal');
  const [whole, fraction = ''] = s.split('.');
  if (fraction.length > scale) throw new Error(`Amount supports at most ${scale} decimal places`);
  const n = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0') || '0');
  if (n <= 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is outside the supported range');
  return n;
}
function paymentErrors(payment, scale = 2) {
  const errors = [];
  let channel;
  try { channel = channelFor(payment.transactionType); } catch (e) { return [e.message]; }
  try { units(payment.amount, scale); } catch (e) { errors.push(e.message); }
  if (!text(payment.paymentId)) errors.push('A stable Sage paymentId is required');
  if (!text(payment.accountNumber)) errors.push('Beneficiary account number is required');
  if (!text(payment.remarks || payment.transactionReference)) errors.push('Transaction remarks are required');
  if (channel === 'INTERNAL') {
    if (!/^\d{13}$/.test(text(payment.accountNumber))) errors.push('Internal FT account number must be 13 digits');
    if (!text(payment.branchCode)) errors.push('Internal FT branch code is required');
  } else {
    for (const field of ['swiftCode', 'sortCode', 'accountName']) if (!text(payment[field])) errors.push(`${field} is required`);
    if (!/^[A-Z]{3}$/.test(text(payment.currency || payment.currencyCode))) errors.push('Currency must be a three-letter uppercase code');
    const date = paymentDate(payment.transactionDate);
    if (!validDate(date)) errors.push('Value date must be a valid YYYY-MM-DD date');
    if (text(payment.remarks || payment.transactionReference).length > 35) errors.push('Transaction remarks must not exceed 35 characters');
  }
  return errors;
}
function buildBatch(payment, options) {
  const errors = paymentErrors(payment, options.amountScale ?? 2);
  if (errors.length) throw new Error(errors.join('; '));
  const channel = channelFor(payment.transactionType);
  const item = {
    prcn_number: text(options.prcn), amount: Number(payment.amount),
    transaction_remarks: text(payment.remarks || payment.transactionReference), is_retry: 0, retry_count: 0,
  };
  if (channel === 'INTERNAL') Object.assign(item, { account_number: text(payment.accountNumber), branch_code: text(payment.branchCode) });
  else Object.assign(item, {
    receiver_bic: text(payment.swiftCode), receiver_currency: text(payment.currency || payment.currencyCode),
    receiver_sort_code: text(payment.sortCode), receiver_account_number: text(payment.accountNumber), receiver_acc_name: text(payment.accountName),
    transaction_value_date: paymentDate(payment.transactionDate),
  });
  const batch = { reference: text(options.reference), count: 1, region_code: text(options.regionCode), total_amount: Number(payment.amount), transactions: [item] };
  const batchErrors = validateBatch(channel, batch, options.amountScale ?? 2);
  if (batchErrors.length) throw new Error(batchErrors.join('; '));
  return batch;
}
function validateBatch(channel, batch, scale = 2) {
  const errors = [];
  if (!CHANNELS.includes(channel)) errors.push('Unsupported channel');
  if (!batch || typeof batch !== 'object') return ['Batch is required'];
  for (const field of ['reference', 'region_code']) if (!text(batch[field])) errors.push(`${field} is required`);
  if (!Array.isArray(batch.transactions) || !batch.transactions.length) return [...errors, 'At least one transaction is required'];
  if (!Number.isInteger(batch.count) || batch.count !== batch.transactions.length) errors.push('count must equal the number of transactions');
  let sum = 0n;
  const refs = new Set();
  batch.transactions.forEach((item, index) => {
    const prefix = `transactions[${index}]`;
    if (!item || typeof item !== 'object') { errors.push(`${prefix} must be an object`); return; }
    const ref = text(item.prcn_number);
    if (!ref || ref.length > 35) errors.push(`${prefix}.prcn_number must contain 1–35 characters`);
    if (refs.has(ref)) errors.push(`${prefix}.prcn_number is duplicated`);
    refs.add(ref);
    try { sum += units(item.amount, scale); } catch (e) { errors.push(`${prefix}: ${e.message}`); }
    if (![0, 1].includes(item.is_retry) || !Number.isInteger(item.retry_count) || item.retry_count < 0 || item.retry_count > 10 || (item.is_retry === 0) !== (item.retry_count === 0)) errors.push(`${prefix}: invalid retry metadata`);
    const fields = channel === 'INTERNAL' ? ['account_number', 'branch_code', 'transaction_remarks'] : ['receiver_bic', 'receiver_currency', 'receiver_sort_code', 'receiver_account_number', 'receiver_acc_name', 'transaction_value_date', 'transaction_remarks'];
    for (const field of fields) if (!text(item[field])) errors.push(`${prefix}.${field} is required`);
    if (channel === 'INTERNAL' && !/^\d{13}$/.test(text(item.account_number))) errors.push(`${prefix}: account_number must be 13 digits`);
    if (channel !== 'INTERNAL') {
      if (!validDate(item.transaction_value_date)) errors.push(`${prefix}: invalid value date`);
      if (text(item.transaction_remarks).length > 35) errors.push(`${prefix}: remarks exceed 35 characters`);
      if (!/^[A-Z]{3}$/.test(text(item.receiver_currency))) errors.push(`${prefix}: invalid currency`);
    }
  });
  try { if (units(batch.total_amount, scale) !== sum) errors.push('total_amount must exactly equal the sum of item amounts'); } catch (e) { errors.push(e.message); }
  return errors;
}
function submissionOutcome(httpStatus, body) {
  if (httpStatus === 202 && body && body.error === null && body.status === 201) return { state: 'accepted' };
  const code = typeof body?.error === 'string' ? body.error : '';
  const error = typeof body?.message === 'string' ? body.message : typeof body?.error_description === 'string' ? body.error_description : `Unexpected bank response (HTTP ${httpStatus})`;
  const details = { errorCode: code, items: body?.info, trackingNumber: body?.h2h_tracking_number };
  if (['duplicate_reference', 'duplicate_invoice_items'].includes(code)) return { state: 'unknown', error, details };
  if ([400, 401, 403, 422].includes(httpStatus) && ['invalid_client', 'invalid_token', 'permission_error', 'profile_permission_error', 'duplicate_prcn_numbers_in_request', 'items_failed_validation', 'validation_error'].includes(code)) return { state: 'rejected', error, details };
  // Even transient errors can follow a bank-side commit. Query the original reference.
  return { state: 'unknown', error, details };
}
const PAID = new Set(['completed', 'completed_nfs_sc_notified', 'completed_fcub_ft_sc_notified', 'completed_nfs_pending_notify_sc', 'completed_fcub_ft_pending_notify_sc']);
const FAILED = new Set(['failed', 'failed_nfs_sc_notified', 'failed_nfs_verify_acc_pending_notify_sc', 'failed_nfs_verify_acc_sc_notified', 'failed_verify_acc_pending_notify_sc', 'failed_verify_acc_sc_notified', 'fcubs_notify_ft_failed_pending_notify_sc', 'fcubs_notify_ft_failed_sc_notified']);
function itemOutcome(item, channel) {
  if (!item || typeof item !== 'object') return { state: 'needs_review', error: 'Missing bank item' };
  const rawStatus = text(item.status);
  if (item.is_still_processing === true) return { state: 'accepted', rawStatus };
  if (item.is_still_processing !== false) return { state: 'needs_review', rawStatus, error: 'Missing bank finality flag' };
  const bankRef = text(item.bank_reference || item.bank_callback_reference);
  if (PAID.has(rawStatus) && bankRef) return { state: 'paid', bankRef, rawStatus };
  if (FAILED.has(rawStatus)) return { state: 'failed', rawStatus };
  return { state: 'needs_review', rawStatus, error: 'Unknown or unconfirmed bank outcome' };
}
function statusOutcome(body, batch, channel) {
  if (!body || body.error || body.ext_batch_ref_no !== batch.reference || !Array.isArray(body.transactions)) return { state: 'unknown', error: 'Bank status response does not match the submitted batch' };
  const expected = batch.transactions[0];
  const matches = body.transactions.filter(item => item.prcn_number === expected.prcn_number);
  if (matches.length !== 1) return { state: 'needs_review', error: 'Missing or duplicate item in bank status response' };
  const item = matches[0];
  if (channel !== 'INTERNAL' && item.currency !== expected.receiver_currency) return { state: 'needs_review', error: 'Bank item currency does not match submission' };
  if (text(item.receiver_account_number || item.account_number) !== text(expected.receiver_account_number || expected.account_number) || Number(item.amount) !== Number(expected.amount)) return { state: 'needs_review', error: 'Bank item amount or beneficiary does not match submission' };
  return itemOutcome(item, channel);
}
function callbackErrors(body) {
  if (!body || typeof body !== 'object') return ['Callback body is required'];
  const errors = [];
  for (const field of ['reference', 'prcn_number']) if (typeof body[field] !== 'string' || !body[field].trim()) errors.push(`${field} is required and cannot be empty`);
  if (![200, 400].includes(body.status_code)) errors.push('status_code must be 200 (DISBURSED) or 400 (FAILED)');
  if (body.status_code === 200 && (typeof body.bankRef !== 'string' || !body.bankRef.trim())) errors.push('bankRef is required when status_code is 200');
  return errors;
}
function mergeOutcome(current, incoming) {
  if (['paid', 'failed'].includes(current)) {
    if (['paid', 'failed'].includes(incoming) && incoming !== current) return 'needs_review';
    return current; // Late acceptance/polling cannot undo settlement.
  }
  if (current === 'needs_review') return current; // Conflicts require explicit reconciliation review.
  return incoming;
}
module.exports = { CHANNELS, PATHS, channelFor, validDate, units, paymentErrors, buildBatch, validateBatch, submissionOutcome, itemOutcome, statusOutcome, callbackErrors, mergeOutcome };
