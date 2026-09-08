export type BankCode = 'IZB';

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
  transactionDate?: string;
  amount?: number;
  currency?: string;
  currencyCode?: string;
  transactionReference?: string;
  remarks?: string;
  transactionType?: string;
  bankName?: string;
  sortCode?: string;
  swiftCode?: string;
  countryOfOrigin?: string;
  email?: string;
  phoneNumber?: string;
  physicalAddress?: PhysicalAddress;
}

export interface IzbServicePayload {
  service: string;
  request: Record<string, unknown>;
  queueId?: string;
}

export type PaymentJobPayload =
  | { bankCode: BankCode; payment: PaymentsResponse; queueId?: string; sourceBank?: string | null }
  | IzbServicePayload;

export type JobResult = {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
};
