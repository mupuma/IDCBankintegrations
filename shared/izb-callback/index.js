'use strict';

function izbBankReferenceError(value) {
  const missing = value == null || typeof value === 'string' && !value.trim();
  if (!missing && typeof value === 'string' && value.length <= 100 && !/[\x00-\x1f\x7f]/.test(value)) return null;
  const message = missing
    ? "bankReference is required for IZB callbacks. Supply IZB's bank-issued reconciliation reference, keep transactionId unchanged, and retry."
    : 'bankReference must be a non-empty string of at most 100 characters without control characters. Correct bankReference, keep transactionId unchanged, and retry.';
  return { responseCode: 400, errorCode: missing ? 'BANK_REFERENCE_REQUIRED' : 'INVALID_BANK_REFERENCE',
    field: 'bankReference', responseMessage: message, error: message };
}

module.exports = { izbBankReferenceError };
