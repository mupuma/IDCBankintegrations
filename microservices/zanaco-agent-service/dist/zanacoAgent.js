"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareZanacoPayload = prepareZanacoPayload;
exports.prepareZanacoServicePayload = prepareZanacoServicePayload;
exports.sendZanacoPayment = sendZanacoPayment;
exports.queryTransactionStatus = queryTransactionStatus;
const zanacoValidation_1 = require("./zanacoValidation");
const zwsClient_1 = require("./zwsClient");
const log_1 = require("./log");
let client = null;
function getClient() {
    client ?? (client = new zwsClient_1.ZanacoClient());
    return client;
}
function prepareZanacoPayload(payment, source) {
    const prepared = (0, zanacoValidation_1.buildZanacoRequest)(payment, source);
    const validationErrors = (0, zanacoValidation_1.validateZanacoPreparedRequest)(prepared);
    if (validationErrors.length) {
        const error = new Error('Invalid Zanaco payment');
        error.validationErrors = validationErrors;
        throw error;
    }
    return prepared;
}
function prepareZanacoServicePayload(payload) {
    const serviceValidationErrors = (0, zanacoValidation_1.validateZanacoServicePayload)(payload);
    if (serviceValidationErrors.length) {
        const error = new Error('Invalid Zanaco payload');
        error.validationErrors = serviceValidationErrors;
        throw error;
    }
    const prepared = {
        service: payload.service,
        endpoint: endpointForService(payload.service),
        method: payload.service.startsWith('ZANACO_GET_') ? 'GET' : 'POST',
        request: payload.request,
        transferType: transferTypeForService(payload.service),
        externalTranRef: typeof payload.request.externalTranRef === 'string' ? payload.request.externalTranRef : undefined,
    };
    const validationErrors = (0, zanacoValidation_1.validateZanacoPreparedRequest)(prepared);
    if (validationErrors.length) {
        const error = new Error('Invalid Zanaco payload');
        error.validationErrors = validationErrors;
        throw error;
    }
    return prepared;
}
async function sendZanacoPayment(prepared) {
    try {
        const response = await getClient().send(prepared);
        const body = response.data;
        const inner = body?.response;
        const respCode = String(inner?.respCode ?? '');
        const respDesc = String(inner?.respDesc ?? '');
        const externalTranRef = String(inner?.externalTranRef ?? prepared.externalTranRef ?? '');
        if (response.ok && ['ZWS-01', 'ZWS-00', '00'].includes(respCode)) {
            return { success: true, status: response.status, data: response.data };
        }
        if (respCode === 'ZWS-51' || isDuplicateReference(respCode, respDesc, response.status)) {
            const statusResult = await queryTransactionStatus(externalTranRef || prepared.externalTranRef);
            return statusResult.success ? statusResult : {
                success: false,
                status: response.status,
                data: response.data,
                error: respDesc || 'Unable to determine transaction status',
                unknown: true,
                retryable: respCode === 'ZWS-51',
            };
        }
        if (response.status >= 500) {
            return { success: false, status: response.status, data: response.data, error: respDesc || 'Zanaco server error', retryable: true };
        }
        return { success: false, status: response.status, data: response.data, error: respDesc || `Zanaco request failed (${response.status})` };
    }
    catch (error) {
        const externalTranRef = prepared.externalTranRef;
        if (externalTranRef) {
            try {
                const statusResult = await queryTransactionStatus(externalTranRef);
                if (statusResult.success)
                    return statusResult;
            }
            catch (statusError) {
                (0, log_1.logError)('zanaco.status_lookup_after_error.failed', {
                    externalTranRef,
                    error: statusError instanceof Error ? statusError.message : String(statusError),
                });
            }
        }
        return {
            success: false,
            status: error?.status ?? 500,
            error: error instanceof Error ? error.message : String(error),
            unknown: true,
            retryable: true,
        };
    }
}
function isDuplicateReference(respCode, respDesc, httpStatus) {
    const description = respDesc.toLowerCase();
    return (respCode === 'ZWS-56' && httpStatus === 409)
        || (respCode === 'ZWS-53' && description.includes('duplicate') && description.includes('externaltranref'));
}
async function queryTransactionStatus(externalTranRef) {
    if (!externalTranRef) {
        return { success: false, status: 400, error: 'externalTranRef is required for status lookup' };
    }
    const response = await getClient().send({
        service: 'ZANACO_TRANSFER_STATUS',
        endpoint: '/zws-fcubs-service/api/v1/flex/transferStatus',
        method: 'POST',
        request: { externalTranRef },
        externalTranRef,
    });
    const inner = response.data?.response;
    const respCode = String(inner?.respCode ?? '');
    const tranRefNo = String(inner?.tranRefNo ?? '');
    if (respCode === 'ZWS-01' && tranRefNo)
        return { success: true, status: response.status, data: response.data };
    if (respCode === 'ZWS-51')
        return { success: false, status: response.status, data: response.data, error: 'Unable to determine transaction status', unknown: true, retryable: true };
    return { success: false, status: response.status, data: response.data, error: String(inner?.respDesc ?? 'Transaction status lookup did not confirm success') };
}
function endpointForService(service) {
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
function transferTypeForService(service) {
    if (service === 'ZANACO_INTERNAL')
        return 'INTERNAL';
    if (service === 'ZANACO_RTGS')
        return 'RTGS';
    if (service === 'ZANACO_DDAC')
        return 'DDAC';
    if (service === 'ZANACO_SWIFT')
        return 'SWIFT';
    if (service === 'ZANACO_MASKED_DISBURSEMENT')
        return 'MASKED';
    if (service === 'ZANACO_COLLECTION')
        return 'COLLECTION';
    if (service.startsWith('ZANACO_NFS'))
        return 'NFS';
    return undefined;
}
