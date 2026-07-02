import type { ZicbServicePayload } from './types';

const SUPPORTED_SERVICES = new Set(['ZB8628', 'BNK9900']);
const SUPPORTED_TRANSFER_TYPES = new Set(['RTGS', 'DDACC']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function requireFields(request: Record<string, unknown>, fields: string[], errors: string[]) {
  for (const field of fields) {
    if (!text(request[field])) errors.push(`request.${field} is required`);
  }
}

function validateDate(value: unknown, field: string, errors: string[]) {
  const date = text(value);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!DATE_PATTERN.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    errors.push(`request.${field} must be a valid YYYY-MM-DD date`);
  }
}

function validateCurrency(value: unknown, field: string, errors: string[]) {
  if (!CURRENCY_PATTERN.test(text(value).toUpperCase())) {
    errors.push(`request.${field} must be a three-letter currency code`);
  }
}

export function isZicbServicePayload(value: unknown): value is ZicbServicePayload {
  return Boolean(
    value && typeof value === 'object' &&
    typeof (value as ZicbServicePayload).service === 'string' &&
    (value as ZicbServicePayload).request &&
    typeof (value as ZicbServicePayload).request === 'object' &&
    !Array.isArray((value as ZicbServicePayload).request),
  );
}

export function validateZicbPayload(payload: ZicbServicePayload): string[] {
  const errors: string[] = [];
  const service = text(payload.service);
  const request = payload.request;

  if (!SUPPORTED_SERVICES.has(service)) {
    return [`service must be one of ${Array.from(SUPPORTED_SERVICES).join(', ')}`];
  }

  const amount = Number(request.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('request.amount must be a positive number');

  if (service === 'ZB8628') {
    requireFields(request, ['destAcc', 'destBranch', 'payDate', 'payCurrency', 'remarks', 'transferRef'], errors);
    validateDate(request.payDate, 'payDate', errors);
    validateCurrency(request.payCurrency, 'payCurrency', errors);
    return errors;
  }

  requireFields(request, [
    'userName', 'customerId', 'ipAddress', 'srcAcc', 'destAcc', 'destCurrency',
    'srcCurrency', 'payCurrency', 'transferTyp', 'destBranch', 'srcBranch',
    'bankName', 'sortCode', 'remarks', 'payDate', 'beneName', 'senderName',
    'senderAddress1', 'senderAddress2', 'senderAddress3',
  ], errors);

  const transferType = text(request.transferTyp).toUpperCase();
  if (!SUPPORTED_TRANSFER_TYPES.has(transferType)) {
    errors.push('request.transferTyp must be RTGS or DDACC');
  }

  validateDate(request.payDate, 'payDate', errors);
  for (const field of ['destCurrency', 'srcCurrency', 'payCurrency']) {
    validateCurrency(request[field], field, errors);
  }

  for (const field of ['senderEmail', 'beneEmail']) {
    const value = text(request[field]);
    if (value && !EMAIL_PATTERN.test(value)) errors.push(`request.${field} must be a valid email address`);
  }

  return errors;
}

export function assertValidZicbPayload(payload: ZicbServicePayload) {
  const errors = validateZicbPayload(payload);
  if (errors.length) {
    const error = new Error(`Invalid ZICB payload: ${errors.join('; ')}`);
    (error as Error & { status?: number; validationErrors?: string[] }).status = 400;
    (error as Error & { validationErrors?: string[] }).validationErrors = errors;
    throw error;
  }
}
