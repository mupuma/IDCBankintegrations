import type { JobResult, ZanacoPreparedRequest } from './types';
import { ZanacoClient } from './zwsClient';

let client: ZanacoClient | null = null;

function getClient() {
  client ??= new ZanacoClient();
  return client;
}

export function isBulkService(service: string) {
  return ['ZANACO_BULK_INTERNAL', 'ZANACO_BULK_RTGS', 'ZANACO_BULK_DDAC', 'ZANACO_BULK_SWIFT'].includes(service);
}

export function prepareBulkPayload(service: string, request: Record<string, unknown>): ZanacoPreparedRequest {
  return {
    service,
    endpoint: bulkEndpoint(service),
    method: 'POST',
    request,
    transferType: bulkType(service),
  };
}

export function validateBulkPayload(prepared: ZanacoPreparedRequest) {
  const errors: string[] = [];
  const request = prepared.request ?? {};
  const items = Array.isArray(request.items) ? request.items as Record<string, unknown>[] : [];
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);
  const totalAmount = Number(request.totalAmount);

  if (!text(request.batchName)) errors.push('batchName is required');
  if (text(request.batchName).length > 100) errors.push('batchName must be 100 characters or less');
  if (text(request.description).length > 500) errors.push('description must be 500 characters or less');
  if (!/^[A-Z]{3}$/.test(text(request.currency).toUpperCase())) errors.push('currency must be a three-letter ISO currency code');
  if (!Number.isInteger(Number(request.totalCount)) || Number(request.totalCount) <= 0) errors.push('totalCount must be a positive integer');
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) errors.push('totalAmount must be a positive number');
  if (!items.length) errors.push('items must contain at least one transfer');
  if (items.length > 1000) errors.push('items cannot exceed 1000 transfers');
  if (Number(request.totalCount) !== items.length) errors.push('totalCount must match items length');
  const computedTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (items.length && Math.abs(computedTotal - totalAmount) > 0.01) errors.push('totalAmount must equal the sum of item amounts');

  items.forEach((item, index) => {
    const prefix = `items[${index}]`;
    const requireField = (field: string) => {
      if (!text(item[field])) errors.push(`${prefix}.${field} is required`);
    };
    requireField('debitAccount');
    requireField('creditAccount');
    requireField('externalTranRef');
    requireField('amount');
    requireField('name');
    if (!Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) errors.push(`${prefix}.amount must be positive`);
    if (prepared.transferType === 'RTGS' && !text(item.bicCode)) errors.push(`${prefix}.bicCode is required for RTGS`);
    if (prepared.transferType === 'DDAC' && !/^\d{6}$/.test(text(item.sortCode))) errors.push(`${prefix}.sortCode must be 6 digits for DDAC`);
    if (prepared.transferType === 'SWIFT') {
      ['address', 'bicCode', 'tpin', 'purposeCode', 'sectorCode'].forEach(requireField);
    }
  });

  return errors;
}

export async function submitBulk(prepared: ZanacoPreparedRequest): Promise<JobResult> {
  const validationErrors = validateBulkPayload(prepared);
  if (validationErrors.length) return { success: false, status: 400, error: 'Invalid Zanaco bulk payload', data: { validationErrors } };

  const response = await getClient().send(prepared);
  const inner = (response.data as { response?: Record<string, unknown> } | undefined)?.response;
  const respCode = String(inner?.respCode ?? '');
  const status = String(inner?.status ?? '');
  if (response.ok && ['00', 'ZWS-01'].includes(respCode) && status === 'PENDING_APPROVAL') {
    return { success: true, status: response.status, data: response.data };
  }
  return {
    success: false,
    status: response.status,
    data: response.data,
    error: String(inner?.respDesc ?? `Zanaco bulk request failed (${response.status})`),
    retryable: response.status >= 500,
  };
}

export async function getBatchStatus(batchReference: string) {
  return getClient().send({
    service: 'ZANACO_BULK_STATUS',
    endpoint: `/zws-nexus/api/v1/bulk-transfers/${encodeURIComponent(batchReference)}/status`,
    method: 'POST',
  });
}

export async function getBatchDetail(batchReference: string) {
  return getClient().send({
    service: 'ZANACO_BULK_DETAIL',
    endpoint: `/zws-nexus/api/v1/bulk-transfers/${encodeURIComponent(batchReference)}/detail`,
    method: 'POST',
  });
}

function bulkEndpoint(service: string) {
  switch (service) {
    case 'ZANACO_BULK_INTERNAL':
      return '/zws-nexus/api/v1/bulk-transfers/internal';
    case 'ZANACO_BULK_RTGS':
      return '/zws-nexus/api/v1/bulk-transfers/rtgs';
    case 'ZANACO_BULK_DDAC':
      return '/zws-nexus/api/v1/bulk-transfers/ddac';
    case 'ZANACO_BULK_SWIFT':
      return '/zws-nexus/api/v1/bulk-transfers/swift';
    default:
      throw new Error(`Unsupported Zanaco bulk service: ${service}`);
  }
}

function bulkType(service: string): ZanacoPreparedRequest['transferType'] {
  if (service === 'ZANACO_BULK_INTERNAL') return 'INTERNAL';
  if (service === 'ZANACO_BULK_RTGS') return 'RTGS';
  if (service === 'ZANACO_BULK_DDAC') return 'DDAC';
  if (service === 'ZANACO_BULK_SWIFT') return 'SWIFT';
  return undefined;
}
