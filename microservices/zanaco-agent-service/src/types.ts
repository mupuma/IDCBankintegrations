export type ZanacoTransferType = 'INT' | 'RTGS' | 'DDACCT' | 'DDAC' | 'TT' | 'SWIFT';

export interface PhysicalAddress {
  streetName?: string;
  town?: string;
  plotNo?: string;
}

export interface PaymentsResponse {
  paymentId?: string;
  accountNumber?: string;
  branchCode?: string;
  accountName?: string;
  vendorId?: string;
  transactionDate?: string | Date;
  amount?: number | string;
  currency?: string;
  currencyCode?: string;
  currencyCde?: string;
  transactionReference?: string;
  duplicatableExternalRef?: string;
  remarks?: string;
  transactionType?: ZanacoTransferType | string;
  bankName?: string;
  sortCode?: string;
  swiftCode?: string;
  countryOfOrigin?: string;
  email?: string;
  phoneNumber?: string;
  physicalAddress?: PhysicalAddress;
  srcAcc?: string;
  srcBranch?: string;
  srcName?: string;
  tpin?: string;
  tpIn?: string;
  purposeCode?: string;
  sectorCode?: string;
  nrc?: string;
  ftContractRef?: string;
  zanacoOperation?: 'transfer' | 'masked-disbursement' | 'collection';
}

export interface ZanacoServicePayload {
  service: string;
  request: Record<string, unknown>;
  queueId?: string;
  sourceBank?: string | null;
}

export type PaymentJobPayload =
  | { bankCode: 'ZANACO'; payment: PaymentsResponse; queueId?: string; sourceBank?: string | null }
  | ZanacoServicePayload;

export type JobResult = {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  retryable?: boolean;
  unknown?: boolean;
};

export type QueueReportStatus =
  | 'queued'
  | 'processing'
  | 'success'
  | 'failed'
  | 'accepted'
  | 'unknown'
  | 'paid'
  | 'rejected'
  | 'needs_review'
  | 'partially_completed';

export type ZanacoPreparedRequest = {
  service: string;
  endpoint: string;
  method: 'POST' | 'GET';
  request?: Record<string, unknown>;
  transferType?: 'INTERNAL' | 'RTGS' | 'DDAC' | 'SWIFT' | 'MASKED' | 'COLLECTION' | 'NFS';
  externalTranRef?: string;
};
