import { connectSageDatabase } from '@/app/lib/sageDb';
import { connectDatabase } from '@/app/lib/db';
import { CashbookReceipt } from '@/app/models/internal/CashbookReceipt';
import { ProcessedTransaction } from '@/app/models/internal/Processed_transactions';
import { Cbbctl } from '@/app/models/sage_entities/Cbbctl';
import { Cbbthd } from '@/app/models/sage_entities/Cbbthd';
import { Cbbtdt } from '@/app/models/sage_entities/Cbbtdt';
import { Cbbtm } from '@/app/models/sage_entities/Cbbtm';
import { Cboptio } from '@/app/models/sage_entities/Cboptio';
import { Arcus } from '@/app/models/sage_entities/Arcus';
import type { EntryDetails, ReceiptRequest } from '@/app/models/dtos';

const safeString = (value: unknown, length: number): string => {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  return text.length > length ? text.substring(0, length) : text;
};

const padNumericString = (value: string | number, length: number): string => {
  const text = String(value ?? '');
  return text.padStart(length, '0').slice(-length);
};

const getCurrentDate = (): number => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return Number(`${year}${month}${day}`);
};

const getCurrentTime = (): number => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const hundredths = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
  return Number(`${hours}${minutes}${seconds}${hundredths}`.slice(0, 8));
};

const getMonthYear = (): { month: string; year: string } => {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  };
};

const getCompanyCode = (): string => {
  return safeString(process.env.SAGE_DB_COMPANY ?? process.env.SAGE_DB_NAME ?? '', 6);
};

async function getNextBatchId(): Promise<string> {
  const lastBatch = await Cbbctl.findOne({
    order: [['batchid', 'DESC']],
    attributes: ['batchid'],
    raw: true,
  }) as any;

  const lastId = lastBatch?.batchid ?? '0';
  const next = Number(String(lastId).replace(/^0+/, '') || '0') + 1;
  return String(next).padStart(6, '0');
}

async function updateCashbookOptions(batchId: string) {
  const cboptio = await Cboptio.findOne({ where: { optionid: 'CB01' } });
  if (!cboptio) {
    return;
  }

  const parsed = Number(batchId);
  if (!Number.isFinite(parsed)) {
    return;
  }

  cboptio.nbtchnum = parsed;
  cboptio.audtdate = getCurrentDate();
  cboptio.audttime = getCurrentTime();
  cboptio.audtuser = 'ADMIN';
  cboptio.audtorg = getCompanyCode();
  await cboptio.save();
}

async function existingCashbookReference(reference: string): Promise<boolean> {
  const existing = await Cbbthd.findOne({ where: { reference } });
  return Boolean(existing);
}

async function getCustomer(customerNo: string) {
  if (!customerNo) {
    return null;
  }
  return Arcus.findByPk(customerNo);
}

function formatEntryNo(entryNo: number): string {
  return padNumericString(entryNo, 5);
}

function formatDetailNo(detailNo: number): string {
  return padNumericString(detailNo * 2, 10);
}

async function insertCbbctl(receipt: ReceiptRequest, batchId: string) {
  const date = getCurrentDate();
  const time = getCurrentTime();
  const creditAmount = Number(receipt.creditAmount ?? 0);
  const debitAmount = Number(receipt.debitAmount ?? 0);

  await Cbbctl.create({
    batchid: batchId,
    audtdate: date,
    audttime: time,
    audtuser: 'ADMIN',
    audtorg: getCompanyCode(),
    bankcode: safeString(receipt.bankCode, 12),
    activesw: 'A',
    textdesc: safeString(receipt.description ?? '', 30),
    srceledger: 'CB',
    datecreate: date,
    dateedited: date,
    batchtype: 0,
    entrytype: 2,
    status: 1,
    postseq: 0,
    authuser1: '',
    authuser2: '',
    authuser3: '',
    authstatus: 0,
    bckupsetid: 0,
    eftexpfile: '',
    eftrspovrd: 0,
    eftposttim: 0,
    noeftentry: 0,
    eftprodate: date,
    fileseqnum: 0,
    swauth1: 0,
    swauth2: 0,
    swauth3: 0,
    totdebit: debitAmount,
    totcredit: creditAmount,
    cntentry: receipt.noEntries,
    nextentry: receipt.noEntries + 1,
    cnterror: 0,
    btchdec: 3,
    swprintdep: 0,
    depno: '',
    deppref: 'DP',
    swmultlock: 0,
    datepost: 0,
    swtopost: 0,
    adjamount: 0,
    userid: 'ADMIN',
    singleref: 0,
  });
}

async function insertCbbtdt(details: EntryDetails[], batchId: string, customerNo: string) {
  const date = getCurrentDate();
  const time = getCurrentTime();
  const customer = await getCustomer(customerNo);
  const customerCode = customer?.idcust ?? customerNo ?? '';

  for (const detail of details) {
    const detailAmount = Number(detail.amount ?? 0);
    const isCredit = String(detail.DrCr || '').toUpperCase() === 'C';
    const dtlAmount = isCredit ? -detailAmount : detailAmount;

    await Cbbtdt.create({
      batchid: batchId,
      entryno: formatEntryNo(detail.detailNo),
      detailno: formatDetailNo(detail.detailNo),
      audtdate: date,
      audttime: time,
      audtuser: 'ADMIN',
      audtorg: getCompanyCode(),
      srcecode: '',
      textdesc: safeString(detail.entryDescription ?? '', 60),
      acctid: safeString(detail.accountId ?? '', 45),
      taxcode: '01',
      taxtype: 0,
      taxpercnt: 0,
      taxamount: 0,
      dtlamount: dtlAmount,
      quantity: 0,
      comments: safeString(detail.entryDescription ?? '', 120),
      rcptno: '',
      swcash: 0,
      rcptdesc: '',
      misccode: safeString(customerCode, 12),
      miscbkline: 0,
      rcptentry: '2',
      acctiduf: '',
      allocmode: 0,
      acctdesc: '',
      acctqtysw: 0,
      accttax: '',
      accttaxuf: '',
      taxdesc: '',
      taxqtysw: 0,
      adjamount: 0,
      swjob: 0,
      debitamt: isCredit ? 0 : detailAmount,
      creditamt: isCredit ? detailAmount : 0,
      swallocate: 1,
      pjcamt: 0,
      pjcdisc: 0,
      entrytype: 2,
      docnumber: '',
      tottax: 0,
      swmanltx: 0,
      basetax1: 0,
      basetax2: 0,
      basetax3: 0,
      basetax4: 0,
      basetax5: 0,
      taxclass1: 1,
      taxclass2: 1,
      taxclass3: 1,
      taxclass4: 1,
      taxclass5: 1,
      swtaxincl1: 0,
      swtaxincl2: 0,
      swtaxincl3: 0,
      swtaxincl4: 0,
      swtaxincl5: 0,
      ratetax1: 1,
      ratetax2: 1,
      ratetax3: 1,
      ratetax4: 1,
      ratetax5: 1,
      amttax1: 0,
      amttax2: 0,
      amttax3: 0,
      amttax4: 0,
      amttax5: 0,
      misctax1: 0,
      misctax2: 0,
      misctax3: 0,
      misctax4: 0,
      misctax5: 0,
      gltaxamt1: 0,
      gltaxamt2: 0,
      gltaxamt3: 0,
      gltaxamt4: 0,
      gltaxamt5: 0,
      bktaxamt1: 0,
      bktaxamt2: 0,
      bktaxamt3: 0,
      bktaxamt4: 0,
      bktaxamt5: 0,
      tcamtinctx: 0,
      glamtinctx: 0,
      bkamtinctx: 0,
      msamtinctx: 0,
      miscamount: detailAmount,
      glamount: Math.abs(detailAmount),
      bkamount: Math.abs(detailAmount),
      totapplamt: 0,
      totappldsc: 0,
      totunappl: 0,
      pjccost: 0,
      nosubdetl: 0,
      values: 0,
      processcmd: 0,
      amttaxrec1: 0,
      amttaxrec2: 0,
      amttaxrec3: 0,
      amttaxrec4: 0,
      amttaxrec5: 0,
      amttaxexp1: 0,
      amttaxexp2: 0,
      amttaxexp3: 0,
      amttaxexp4: 0,
      amttaxexp5: 0,
      amttaxtobe: 0,
      txamt1rc: 0,
      txamt2rc: 0,
      txamt3rc: 0,
      txamt4rc: 0,
      txamt5rc: 0,
      txtotrc: 0,
      txallrc: 0,
      txexp1rc: 0,
      txrec1rc: 0,
      txbse1hc: 0,
      txbse2hc: 0,
      txbse3hc: 0,
      txbse4hc: 0,
      txbse5hc: 0,
      txrec1hc: 0,
      txrec2hc: 0,
      txrec3hc: 0,
      txrec4hc: 0,
      txrec5hc: 0,
      txexp1hc: 0,
      txexp2hc: 0,
      txexp3hc: 0,
      txexp4hc: 0,
      txexp5hc: 0,
      txallhc: 0,
      txall1hc: 0,
      txall2hc: 0,
      txall3hc: 0,
      txall4hc: 0,
      txall5hc: 0,
      txall1tc: 0,
      txall2tc: 0,
      txall3tc: 0,
      txall4tc: 0,
      txall5tc: 0,
      txexcltc: 0,
      txexclhc: 0,
      txexclbc: 0,
      txexclmc: 0,
      revuniq: 0,
      newrevuniq: 0,
      rvdetailno: '',
    });
  }
}

async function insertCbbtms(details: EntryDetails[], batchId: string, customerNo: string) {
  const date = getCurrentDate();
  const time = getCurrentTime();
  const customer = await getCustomer(customerNo);
  const customerCode = customer?.idcust ?? customerNo ?? '';

  for (const detail of details) {
    await Cbbtm.create({
      batchid: batchId,
      entryno: formatEntryNo(detail.detailNo),
      detailno: formatDetailNo(detail.detailNo),
      audtdate: date,
      audttime: time,
      audtuser: 'ADMIN',
      audtorg: getCompanyCode(),
      misccode: safeString(customerCode, 12),
      name: safeString(detail.entryDescription ?? 'Unidentified Deposit', 60),
      address1: '',
      address2: '',
      address3: '',
      address4: '',
      postcode: '',
      phone1: '',
      phone2: '',
      faxnumber: '',
      contact: '',
      comments: '',
      swkeeptot: 0,
      acctrow: 1,
      acctname: '',
      acctno: '',
      city: '',
      state: '',
      country: '',
      emailaddr: '',
      urladdr: '',
      swapproved: 0,
      eftdesc: '',
      bankname: '',
      account: '',
      branch: '',
      acctype: 0,
      bankid: '',
      swiftcty: '',
      paydetl: '',
      addinfo1: '',
      addinfo2: '',
      covertype: 0,
      coverinfo: '',
      bencode: '',
      eitype: 0,
      bopcatg: '',
      bopref: '',
      bopdesc: '',
      contacteml: '',
      delmethod: 0,
      ftmiscuniq: 0,
      brn: '',
      idn: '',
      accountenc: Buffer.from([]),
      emailsent: 0,
    });
  }
}

async function insertCbbthd(receipt: ReceiptRequest, batchId: string) {
  const date = getCurrentDate();
  const time = getCurrentTime();
  const monthYear = getMonthYear();
  const customer = await getCustomer(receipt.entries?.[0]?.customerNo ?? '');
  const customerCode = customer?.idcust ?? '';
  const customerName = customer?.namecust ?? 'Unidentified Deposit';

  for (const entry of receipt.entries) {
    const amount = Number(entry.amount ?? 0);
    const reference = safeString(entry.referenceNo ?? receipt.transactionId, 22);
    const period = safeString(monthYear.month, 2);
    const fiscyr = safeString(monthYear.year, 4);
    const bytes = Buffer.alloc(32, 0);

    await insertCbbtdt(entry.details, batchId, entry.customerNo);
    await insertCbbtms(entry.details, batchId, entry.customerNo);

    await Cbbthd.create({
      batchid: batchId,
      entryno: formatEntryNo(entry.entryNo),
      audtdate: date,
      audttime: time,
      audtuser: 'ADMIN',
      audtorg: getCompanyCode(),
      entrytype: 2,
      reference,
      period,
      date,
      datechqprn: 0,
      swchqprn: 0,
      misccode: safeString(customerCode, 12),
      textdesc: safeString(customerName, 60),
      distcode: '',
      chargecode: '01',
      chrgamount: 0,
      nodetails: 1,
      totamount: amount,
      tottax: 0,
      taxpercnt: 0,
      bk2glcurhm: 'ZMW',
      bk2glrttyp: 'SP',
      bk2glcursr: 'ZMW',
      bk2gldate: date,
      bk2glrate: 1,
      bk2glsprd: 0,
      bk2glop: 1,
      bk2gldtmth: 3,
      bt2glcurhm: 'ZMW',
      bt2glrttyp: 'SP',
      bt2glcursr: 'ZMW',
      bt2gldate: date,
      bt2glrate: 1,
      bt2glsprd: 0,
      bt2glop: 1,
      bt2gldtmth: 3,
      ms2glcurhm: 'ZMW',
      ms2glrttyp: 'SP',
      ms2glcursr: 'ZMW',
      ms2gldate: date,
      ms2glrate: 1,
      ms2glsprd: 0,
      ms2glop: 1,
      ms2gldtmth: 3,
      swcash: 0,
      btchnodec: 2,
      miscnodec: 2,
      taxgroup: '',
      custchqno: safeString(entry.referenceNo ?? '', 12),
      nosubdetl: 0,
      applamount: 0,
      appldisc: 0,
      acctnat: '1',
      adjamount: amount,
      profileid: '1',
      swinterco: 1,
      fiscyr,
      cctype: '',
      ccnumber: bytes,
      ccname: '',
      ccexp: 0,
      ccauthcode: '',
      xccnumber: '',
      serial: 0,
      bankamount: amount,
      btchamount: amount,
      miscamount: amount,
      funcamount: amount,
      hdrdebit: amount,
      hdrcredit: 0,
      taxauth1: '',
      taxauth2: '',
      taxauth3: '',
      taxauth4: '',
      taxauth5: '',
      txau1desc: '',
      txau2desc: '',
      txau3desc: '',
      txau4desc: '',
      txau5desc: '',
      taxclass1: 1,
      taxclass2: 1,
      taxclass3: 1,
      taxclass4: 1,
      taxclass5: 1,
      basetax1: 0,
      basetax2: 0,
      basetax3: 0,
      basetax4: 0,
      basetax5: 0,
      amttax1: 0,
      amttax2: 0,
      amttax3: 0,
      amttax4: 0,
      amttax5: 0,
      swtaxincl1: 0,
      swtaxincl2: 0,
      swtaxincl3: 0,
      swtaxincl4: 0,
      swtaxincl5: 0,
      bankcode: safeString(receipt.bankCode, 12),
      swposted: 0,
      values: 0,
      processcmd: 0,
      totunappl: 0,
      totapplamt: 0,
      totappldsc: 0,
      allocmode: 0,
      allocamt: 0,
      classtype: 2,
      classaxis: 1,
      datalevel: 0,
      recxcnter: 0,
      raterc: 0,
      ratetyperc: '',
      rateoprc: 0,
      ratedaterc: date,
      eftstatus: 0,
      codecurnrc: safeString(entry.currency ?? '', 3),
      txamt1rc: 0,
      txamt2rc: 0,
      txamt3rc: 0,
      txamt4rc: 0,
      txamt5rc: 0,
      txtotrc: 0,
      txallrc: 0,
      txexprc: 0,
      txrecrc: 0,
      amtrectax: amount,
      amtexptax: 0,
      txbse1hc: 0,
      txbse2hc: 0,
      txbse3hc: 0,
      txbse4hc: 0,
      txbse5hc: 0,
      txamt1hc: 0,
      txamt2hc: 0,
      txamt3hc: 0,
      txamt4hc: 0,
      txamt5hc: 0,
      acctrec1: '',
      acctrec2: '',
      acctrec3: '',
      acctrec4: '',
      acctrec5: '',
      acctexp1: '',
      acctexp2: '',
      acctexp3: '',
      acctexp4: '',
      acctexp5: '',
      txexcltc: 0,
      txexclhc: 0,
      txexclbc: 0,
      txexclmc: 0,
      txincltc: 0,
      txinclhc: 0,
      txinclbc: 0,
      txinclmc: 0,
      arapbatch: '',
      arapentry: '',
      swcheque: 0,
      sweft: 0,
      rxmtchseq: 0,
      rxtrnscode: '',
      rxcategory: '',
      revuniq: 0,
      newrevuniq: 0,
      enteredby: 'ADMIN',
    });
  }
}

async function updateProcessedTransaction(receipt: ReceiptRequest, statusCode: number, statusMessage: string) {
  const now = new Date();
  const existing = await ProcessedTransaction.findByPk(receipt.transactionId);

  if (existing) {
    existing.statusCode = statusCode;
    existing.statusMessage = safeString(statusMessage, 255);
    existing.processedDate = now;
    await existing.save();
    return;
  }

  await ProcessedTransaction.create({
    transactionId: safeString(receipt.transactionId, 50),
    bankCode: safeString(receipt.bankCode, 12),
    description: safeString(receipt.description, 30),
    noEntries: receipt.noEntries,
    creditAmount: receipt.creditAmount,
    debitAmount: receipt.debitAmount,
    statusCode,
    statusMessage: safeString(statusMessage, 255),
    processedDate: now,
  });
}

export async function processCashbookReceipt(receipt: ReceiptRequest) {
  await connectSageDatabase();
  await connectDatabase();

  const localReceipt = await CashbookReceipt.create({
    transactionId: receipt.transactionId,
    bankCode: receipt.bankCode,
    description: receipt.description,
    noEntries: receipt.noEntries,
    creditAmount: receipt.creditAmount,
    debitAmount: receipt.debitAmount,
    paymentPayload: JSON.stringify(receipt),
    status: 'pending',
  });

  try {
    if (await existingCashbookReference(receipt.transactionId)) {
      const message = `Cashbook transaction ${receipt.transactionId} already exists`;
      await localReceipt.update({ status: 'failed', statusMessage: message, processedDate: new Date() });
      await updateProcessedTransaction(receipt, -1, message);
      return {
        success: false,
        receiptId: localReceipt.id,
        error: message,
      };
    }

    const batchId = await getNextBatchId();
    await insertCbbctl(receipt, batchId);
    await insertCbbthd(receipt, batchId);
    await updateCashbookOptions(batchId);

    const message = `Cashbook transaction inserted into Sage batch ${batchId}`;
    await localReceipt.update({ status: 'success', statusMessage: message, processedDate: new Date() });
    await updateProcessedTransaction(receipt, 200, message);

    return {
      success: true,
      receiptId: localReceipt.id,
      batchId,
      status: 'success',
      message,
    };
  } catch (error: any) {
    const message = error?.message ?? String(error);
    await localReceipt.update({ status: 'failed', statusMessage: message, processedDate: new Date() });
    await updateProcessedTransaction(receipt, -1, message);
    return {
      success: false,
      receiptId: localReceipt.id,
      error: message,
    };
  }
}
