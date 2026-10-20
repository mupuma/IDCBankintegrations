import type { JobResult, PaymentsResponse, ZanacoPreparedRequest, ZanacoServicePayload } from './types';
import { buildZanacoRequest, validateZanacoPreparedRequest, validateZanacoServicePayload } from './zanacoValidation';
import { ZanacoClient } from './zwsClient';

let client: ZanacoClient | null = null;

function getClient() {
  client ??= new ZanacoClient();
  return client;
}

export function prepareZanacoPayload(payment: PaymentsResponse, source?: { accountNumber?: string | null; transit?: string | null; name?: string | null }) {
  const prepared = buildZanacoRequest(payment, source);
  const validationErrors = validateZanacoPreparedRequest(prepared);
  if (validationErrors.length) {
    const error = new Error('Invalid Zanaco payment') as Error & { validationErrors?: string[] };
    error.validationErrors = validationErrors;
    throw error;
  }
  return prepared;
}

export function prepareZanacoServicePayload(payload: ZanacoServicePayload) {
  const serviceValidationErrors = validateZanacoServicePayload(payload);
  if (serviceValidationErrors.length) {
    const error = new Error('Invalid Zanaco payload') as Error & { validationErrors?: string[] };
    error.validationErrors = serviceValidationErrors;
    throw error;
  }

  const prepared: ZanacoPreparedRequest = {
    service: payload.service,
    endpoint: endpointForService(payload.service),
    method: payload.service.startsWith('ZANACO_GET_') ? 'GET' : 'POST',
    request: payload.request,
    transferType: transferTypeForService(payload.service),
    externalTranRef: typeof payload.request.externalTranRef === 'string' ? payload.request.externalTranRef
      : typeof payload.request.transactionRef === 'string' ? payload.request.transactionRef : undefined,
  };
  const validationErrors = validateZanacoPreparedRequest(prepared);
  if (validationErrors.length) {
    const error = new Error('Invalid Zanaco payload') as Error & { validationErrors?: string[] };
    error.validationErrors = validationErrors;
    throw error;
  }
  return prepared;
}

export function isPaymentSubmission(prepared: ZanacoPreparedRequest) {
  return ['ZANACO_INTERNAL', 'ZANACO_RTGS', 'ZANACO_DDAC', 'ZANACO_SWIFT',
    'ZANACO_MASKED_DISBURSEMENT', 'ZANACO_COLLECTION', 'ZANACO_NFS_TRANSFER'].includes(prepared.service);
}

type BankTransport = Pick<ZanacoClient, 'send'>;
export async function sendZanacoPayment(prepared: ZanacoPreparedRequest, bank: BankTransport = getClient()): Promise<JobResult> {
  try {
    const response = await bank.send(prepared);
    const inner = (response.data as { response?: Record<string, unknown> } | undefined)?.response;
    const code = String(inner?.respCode ?? '');
    const description = String(inner?.respDesc ?? '');
    const mutation = isPaymentSubmission(prepared);
    const returnedRef = String(inner?.externalTranRef ?? inner?.transactionRef ?? '');
    const identityMatches = !prepared.externalTranRef || returnedRef === prepared.externalTranRef;
    const postingRef = String(inner?.tranRefNo ?? inner?.rrn ?? '');
    const successCodes = mutation ? (prepared.service === 'ZANACO_NFS_TRANSFER' ? ['00'] : ['ZWS-01']) : ['ZWS-01', 'ZWS-00', '00'];
    if (response.ok && response.status !== 202 && successCodes.includes(code)
      && (!mutation || (identityMatches && postingRef))) {
      return { success: true, status: response.status, data: response.data };
    }
    // A duplicate belonging to another caller is a conflict, never proof of payment.
    if (code === 'ZWS-56') return { success: false, status: response.status, data: response.data, error: description || 'Reference belongs to another caller; manual review required' };
    if (['ZWS-53', 'ZWS-57'].includes(code) && !/duplicate/i.test(description)) {
      return { success: false, status: response.status, data: response.data, error: description || 'Bank rejected the payment' };
    }
    if (response.status >= 500 || response.status === 202 || code === 'ZWS-51'
      || (mutation && response.ok) || (code === 'ZWS-53' && /duplicate/i.test(description))) {
      return { success: false, status: response.status, data: response.data, unknown: true,
        error: description || 'Bank outcome is uncertain; status enquiry required' };
    }
    return { success: false, status: response.status, data: response.data, error: description || `Zanaco request failed (${response.status})` };
  } catch (error) {
    return { success: false, status: 503, unknown: true,
      error: error instanceof Error ? error.message : String(error) };
  }
}

export async function queryTransactionStatus(externalTranRef?: string, bank: BankTransport = getClient()): Promise<JobResult> {
  if (!externalTranRef) return { success: false, status: 409, unknown: true, error: 'No recoverable transaction reference; manual review required' };
  const response = await bank.send({
    service: 'ZANACO_TRANSFER_STATUS', endpoint: '/zws-fcubs-service/api/v1/flex/transferStatus',
    method: 'POST', request: { externalTranRef }, externalTranRef,
  });
  const inner = (response.data as { response?: Record<string, unknown> } | undefined)?.response;
  const code = String(inner?.respCode ?? '');
  if (response.ok && response.status !== 202 && code === 'ZWS-01' && inner?.tranRefNo
    && inner.externalTranRef === externalTranRef) {
    return { success: true, status: response.status, data: response.data };
  }
  if (code === 'ZWS-56') return { success: false, status: response.status, data: response.data, error: 'Reference belongs to another caller; manual review required' };
  // Not-found, malformed and unavailable status responses do not authorise resubmission.
  return { success: false, status: response.status, data: response.data, unknown: true,
    error: String(inner?.respDesc ?? 'Status enquiry did not confirm payment; manual review or further status enquiry required') };
}

function endpointForService(service: string) {
  switch (service) {
    case 'ZANACO_INTERNAL':
    case 'ZANACO_RTGS':
      return '/zws-fcubs-service/api/v1/flex/fundsTransfer';
    case 'ZANACO_DDAC':
      return '/zws-fcubs-service/api/v1/flex/funds-transfer/ddac';
    case 'ZANACO_SWIFT':
      return '/zws-fcubs-service/api/v1/flex/swiftFundsTransfer';
    case 'ZANACO_MASKED_DISBURSEMENT':
      return '/zws-fcubs-service/api/v1/flex/maskedFundsTransfer';
    case 'ZANACO_COLLECTION':
      return '/zws-fcubs-service/api/v1/flex/collectionFundsTransfer';
    case 'ZANACO_BALANCE_ENQUIRY':
      return '/zws-fcubs-service/api/v1/flex/balanceEnquiry';
    case 'ZANACO_ACCOUNT_LOOKUP':
      return '/zws-fcubs-service/api/v1/flex/accountLookup';
    case 'ZANACO_ENHANCED_KYC':
      return '/zws-fcubs-service/api/v1/flex/kyc/enhanced';
    case 'ZANACO_NFS_NAME_LOOKUP':
      return '/zws-postilion-service/api/v1/nfs/nameLookup';
    case 'ZANACO_NFS_QUERY_INSTITUTIONS':
      return '/zws-postilion-service/api/v1/nfs/queryInstitutions';
    case 'ZANACO_NFS_TRANSFER':
      return '/zws-postilion-service/api/v1/nfs/fundsTransfer';
    case 'ZANACO_GET_RTGS_BIC':
      return '/zws-fcubs-service/api/v1/biCodes/rtgs';
    case 'ZANACO_GET_DDAC_BIC':
      return '/zws-fcubs-service/api/v1/biCodes/ddac';
    case 'ZANACO_GET_SWIFT_BIC':
      return '/zws-fcubs-service/api/v1/biCodes/swift';
    default:
      throw new Error(`Unsupported Zanaco service: ${service}`);
  }
}

function transferTypeForService(service: string): ZanacoPreparedRequest['transferType'] {
  if (service === 'ZANACO_INTERNAL') return 'INTERNAL';
  if (service === 'ZANACO_RTGS') return 'RTGS';
  if (service === 'ZANACO_DDAC') return 'DDAC';
  if (service === 'ZANACO_SWIFT') return 'SWIFT';
  if (service === 'ZANACO_MASKED_DISBURSEMENT') return 'MASKED';
  if (service === 'ZANACO_COLLECTION') return 'COLLECTION';
  if (service.startsWith('ZANACO_NFS')) return 'NFS';
  return undefined;
}
