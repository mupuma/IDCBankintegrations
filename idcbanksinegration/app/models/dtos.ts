export type PhysicalAddress = {
    streetName: string;
    town: string;
    plotNo: string;
};

export type BankCode = 'IZB' | 'ZANACO' | 'ZICB';

export type PaymentsResponse = { //To be used by IZB to pull payments onto banking platform

    accountNumber: string;
    amount: number;
    currency: string;
    currencyCode: string;
    remarks: string;
    vendorId: string;
    accountName: string;
    branchCode: string;
    sortCode: string;
    physicalAddress: PhysicalAddress;
    countryOfOrigin: string;
    swiftCode: string;
    currencyCde: string;
    transactionDate: Date;
    transactionType: 'RTGS' | 'DDACCT' | 'INT' | 'TT';
    transactionReference: string;
    bankName: string;
    email: string;
    phoneNumber: string;
}

export type BankPaymentQueueRequest = {
    bankCode: BankCode;
    payment: PaymentsResponse;
}

export type Entry = {
    entryNo: number;
    referenceNo: string;
    customerNo: string;
    noDetails: number;
    amount: number;
    currency: string;
    details: EntryDetails[];
}

export type EntryDetails = {

    entryDescription: string;
    accountId: string;
    amount: number;
    DrCr: string;
    detailNo: number;
}

export type PaymentsRequest = {

    startDate: number;
    endDate: number;
}




export type ReceiptRequest = {
    transactionId: string;
    bankCode: string;
    description: string;
    noEntries: number;
    creditAmount: number;
    debitAmount: number;
    entries: Entry[];
}


export type ResponseMain = {

    responseCode: string;
    responseMessage: string;
    timeStamp: Date;

    data: PaymentsResponse[];
}

export type TransactionResponse = {
    responseCode: number;
    responseMessage: string;
}



