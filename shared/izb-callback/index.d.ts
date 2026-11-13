export type IzbBankReferenceError = {
  responseCode: 400; errorCode: 'BANK_REFERENCE_REQUIRED' | 'INVALID_BANK_REFERENCE';
  field: 'bankReference'; responseMessage: string; error: string;
};
export function izbBankReferenceError(value: unknown): IzbBankReferenceError | null;
