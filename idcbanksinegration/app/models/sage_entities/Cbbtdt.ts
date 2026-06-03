// models/Cbbtdt.ts
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';

// CbbtdtId composite key interface
interface CbbtdtId {
  batchid: string;
  entryno: string;
  detailno: string;
}

// Cbbtdt creation attributes (omit auto-generated or default fields if any)
interface CbbtdtCreationAttributes extends CbbtdtId {
  audtdate?: number;
  audttime?: number;
  audtuser?: string;
  audtorg?: string;
  srcecode?: string;
  textdesc?: string;
  acctid?: string;
  taxcode?: string;
  taxtype?: number;
  taxpercnt?: number;
  taxamount?: number;
  dtlamount?: number;
  quantity?: number;
  comments?: string;
  rcptno?: string;
  swcash?: number;
  rcptdesc?: string;
  misccode?: string;
  miscbkline?: number;
  rcptentry?: string;
  acctiduf?: string;
  allocmode?: number;
  acctdesc?: string;
  acctqtysw?: number;
  accttax?: string;
  accttaxuf?: string;
  taxdesc?: string;
  taxqtysw?: number;
  adjamount?: number;
  swjob?: number;
  debitamt?: number;
  creditamt?: number;
  swallocate?: number;
  pjcamt?: number;
  pjcdisc?: number;
  entrytype?: number;
  docnumber?: string;
  tottax?: number;
  swmanltx?: number;
  basetax1?: number;
  basetax2?: number;
  basetax3?: number;
  basetax4?: number;
  basetax5?: number;
  taxclass1?: number;
  taxclass2?: number;
  taxclass3?: number;
  taxclass4?: number;
  taxclass5?: number;
  swtaxincl1?: number;
  swtaxincl2?: number;
  swtaxincl3?: number;
  swtaxincl4?: number;
  swtaxincl5?: number;
  ratetax1?: number;
  ratetax2?: number;
  ratetax3?: number;
  ratetax4?: number;
  ratetax5?: number;
  amttax1?: number;
  amttax2?: number;
  amttax3?: number;
  amttax4?: number;
  amttax5?: number;
  misctax1?: number;
  misctax2?: number;
  misctax3?: number;
  misctax4?: number;
  misctax5?: number;
  gltaxamt1?: number;
  gltaxamt2?: number;
  gltaxamt3?: number;
  gltaxamt4?: number;
  gltaxamt5?: number;
  bktaxamt1?: number;
  bktaxamt2?: number;
  bktaxamt3?: number;
  bktaxamt4?: number;
  bktaxamt5?: number;
  tcamtinctx?: number;
  glamtinctx?: number;
  bkamtinctx?: number;
  msamtinctx?: number;
  miscamount?: number;
  glamount?: number;
  bkamount?: number;
  totapplamt?: number;
  totappldsc?: number;
  totunappl?: number;
  pjccost?: number;
  nosubdetl?: number;
  values?: number;
  processcmd?: number;
  amttaxrec1?: number;
  amttaxrec2?: number;
  amttaxrec3?: number;
  amttaxrec4?: number;
  amttaxrec5?: number;
  amttaxexp1?: number;
  amttaxexp2?: number;
  amttaxexp3?: number;
  amttaxexp4?: number;
  amttaxexp5?: number;
  amttaxtobe?: number;
  txamt1rc?: number;
  txamt2rc?: number;
  txamt3rc?: number;
  txamt4rc?: number;
  txamt5rc?: number;
  txtotrc?: number;
  txallrc?: number;
  txexp1rc?: number;
  txexp2rc?: number;
  txexp3rc?: number;
  txexp4rc?: number;
  txexp5rc?: number;
  txrec1rc?: number;
  txrec2rc?: number;
  txrec3rc?: number;
  txrec4rc?: number;
  txrec5rc?: number;
  txbse1hc?: number;
  txbse2hc?: number;
  txbse3hc?: number;
  txbse4hc?: number;
  txbse5hc?: number;
  txrec1hc?: number;
  txrec2hc?: number;
  txrec3hc?: number;
  txrec4hc?: number;
  txrec5hc?: number;
  txexp1hc?: number;
  txexp2hc?: number;
  txexp3hc?: number;
  txexp4hc?: number;
  txexp5hc?: number;
  txallhc?: number;
  txall1hc?: number;
  txall2hc?: number;
  txall3hc?: number;
  txall4hc?: number;
  txall5hc?: number;
  txall1tc?: number;
  txall2tc?: number;
  txall3tc?: number;
  txall4tc?: number;
  txall5tc?: number;
  txexcltc?: number;
  txexclhc?: number;
  txexclbc?: number;
  txexclmc?: number;
  revuniq?: number;
  newrevuniq?: number;
  rvdetailno?: string;
}

@Table({
  tableName: 'CBBTDT',
  timestamps: false,
  underscored: false
})
export class Cbbtdt extends Model<Cbbtdt, CbbtdtCreationAttributes> {
  @PrimaryKey
  @Column({
    type: DataType.STRING(6),
    field: 'BATCHID',
    allowNull: false
  })
  batchid!: string;

  @PrimaryKey
  @Column({
    type: DataType.STRING(5),
    field: 'ENTRYNO',
    allowNull: false
  })
  entryno!: string;

  @PrimaryKey
  @Column({
    type: DataType.STRING(10),
    field: 'DETAILNO',
    allowNull: false
  })
  detailno!: string;

  @Column({
    type: DataType.DECIMAL(9, 0),
    field: 'AUDTDATE',
    allowNull: false
  })
  audtdate!: number;

  @Column({
    type: DataType.DECIMAL(9, 0),
    field: 'AUDTTIME',
    allowNull: false
  })
  audttime!: number;

  @Column({
    type: DataType.STRING(8),
    field: 'AUDTUSER',
    allowNull: false
  })
  audtuser!: string;

  @Column({
    type: DataType.STRING(6),
    field: 'AUDTORG',
    allowNull: false
  })
  audtorg!: string;

  @Column({
    type: DataType.STRING(4),
    field: 'SRCECODE',
    allowNull: false
  })
  srcecode!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'TEXTDESC',
    allowNull: false
  })
  textdesc!: string;

  @Column({
    type: DataType.STRING(45),
    field: 'ACCTID',
    allowNull: false
  })
  acctid!: string;

  @Column({
    type: DataType.STRING(2),
    field: 'TAXCODE',
    allowNull: false
  })
  taxcode!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXTYPE',
    allowNull: false
  })
  taxtype!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TAXPERCNT',
    allowNull: false
  })
  taxpercnt!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TAXAMOUNT',
    allowNull: false
  })
  taxamount!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'DTLAMOUNT',
    allowNull: false
  })
  dtlamount!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'QUANTITY',
    allowNull: false
  })
  quantity!: number;

  @Column({
    type: DataType.STRING(120),
    field: 'COMMENTS',
    allowNull: false
  })
  comments!: string;

  @Column({
    type: DataType.STRING(12),
    field: 'RCPTNO',
    allowNull: false
  })
  rcptno!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWCASH',
    allowNull: false
  })
  swcash!: number;

  @Column({
    type: DataType.STRING(60),
    field: 'RCPTDESC',
    allowNull: false
  })
  rcptdesc!: string;

  @Column({
    type: DataType.STRING(12),
    field: 'MISCCODE',
    allowNull: false
  })
  misccode!: string;

  @Column({
    type: DataType.INTEGER,
    field: 'MISCBKLINE',
    allowNull: false
  })
  miscbkline!: number;

  @Column({
    type: DataType.STRING(5),
    field: 'RCPTENTRY',
    allowNull: false
  })
  rcptentry!: string;

  @Column({
    type: DataType.STRING(45),
    field: 'ACCTIDUF',
    allowNull: false
  })
  acctiduf!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'ALLOCMODE',
    allowNull: false
  })
  allocmode!: number;

  @Column({
    type: DataType.STRING(60),
    field: 'ACCTDESC',
    allowNull: false
  })
  acctdesc!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'ACCTQTYSW',
    allowNull: false
  })
  acctqtysw!: number;

  @Column({
    type: DataType.STRING(45),
    field: 'ACCTTAX',
    allowNull: false
  })
  accttax!: string;

  @Column({
    type: DataType.STRING(45),
    field: 'ACCTTAXUF',
    allowNull: false
  })
  accttaxuf!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'TAXDESC',
    allowNull: false
  })
  taxdesc!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXQTYSW',
    allowNull: false
  })
  taxqtysw!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'ADJAMOUNT',
    allowNull: false
  })
  adjamount!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWJOB',
    allowNull: false
  })
  swjob!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'DEBITAMT',
    allowNull: false
  })
  debitamt!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'CREDITAMT',
    allowNull: false
  })
  creditamt!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWALLOCATE',
    allowNull: false
  })
  swallocate!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'PJCAMT',
    allowNull: false
  })
  pjcamt!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'PJCDISC',
    allowNull: false
  })
  pjcdisc!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'ENTRYTYPE',
    allowNull: false
  })
  entrytype!: number;

  @Column({
    type: DataType.STRING(22),
    field: 'DOCNUMBER',
    allowNull: false
  })
  docnumber!: string;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TOTTAX',
    allowNull: false
  })
  tottax!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWMANLTX',
    allowNull: false
  })
  swmanltx!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BASETAX1',
    allowNull: false
  })
  basetax1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BASETAX2',
    allowNull: false
  })
  basetax2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BASETAX3',
    allowNull: false
  })
  basetax3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BASETAX4',
    allowNull: false
  })
  basetax4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BASETAX5',
    allowNull: false
  })
  basetax5!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXCLASS1',
    allowNull: false
  })
  taxclass1!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXCLASS2',
    allowNull: false
  })
  taxclass2!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXCLASS3',
    allowNull: false
  })
  taxclass3!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXCLASS4',
    allowNull: false
  })
  taxclass4!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'TAXCLASS5',
    allowNull: false
  })
  taxclass5!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWTAXINCL1',
    allowNull: false
  })
  swtaxincl1!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWTAXINCL2',
    allowNull: false
  })
  swtaxincl2!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWTAXINCL3',
    allowNull: false
  })
  swtaxincl3!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWTAXINCL4',
    allowNull: false
  })
  swtaxincl4!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWTAXINCL5',
    allowNull: false
  })
  swtaxincl5!: number;

  @Column({
    type: DataType.DECIMAL(15, 5),
    field: 'RATETAX1',
    allowNull: false
  })
  ratetax1!: number;

  @Column({
    type: DataType.DECIMAL(15, 5),
    field: 'RATETAX2',
    allowNull: false
  })
  ratetax2!: number;

  @Column({
    type: DataType.DECIMAL(15, 5),
    field: 'RATETAX3',
    allowNull: false
  })
  ratetax3!: number;

  @Column({
    type: DataType.DECIMAL(15, 5),
    field: 'RATETAX4',
    allowNull: false
  })
  ratetax4!: number;

  @Column({
    type: DataType.DECIMAL(15, 5),
    field: 'RATETAX5',
    allowNull: false
  })
  ratetax5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAX1',
    allowNull: false
  })
  amttax1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAX2',
    allowNull: false
  })
  amttax2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAX3',
    allowNull: false
  })
  amttax3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAX4',
    allowNull: false
  })
  amttax4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAX5',
    allowNull: false
  })
  amttax5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MISCTAX1',
    allowNull: false
  })
  misctax1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MISCTAX2',
    allowNull: false
  })
  misctax2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MISCTAX3',
    allowNull: false
  })
  misctax3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MISCTAX4',
    allowNull: false
  })
  misctax4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MISCTAX5',
    allowNull: false
  })
  misctax5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLTAXAMT1',
    allowNull: false
  })
  gltaxamt1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLTAXAMT2',
    allowNull: false
  })
  gltaxamt2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLTAXAMT3',
    allowNull: false
  })
  gltaxamt3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLTAXAMT4',
    allowNull: false
  })
  gltaxamt4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLTAXAMT5',
    allowNull: false
  })
  gltaxamt5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKTAXAMT1',
    allowNull: false
  })
  bktaxamt1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKTAXAMT2',
    allowNull: false
  })
  bktaxamt2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKTAXAMT3',
    allowNull: false
  })
  bktaxamt3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKTAXAMT4',
    allowNull: false
  })
  bktaxamt4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKTAXAMT5',
    allowNull: false
  })
  bktaxamt5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TCAMTINCTX',
    allowNull: false
  })
  tcamtinctx!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLAMTINCTX',
    allowNull: false
  })
  glamtinctx!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKAMTINCTX',
    allowNull: false
  })
  bkamtinctx!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MSAMTINCTX',
    allowNull: false
  })
  msamtinctx!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'MISCAMOUNT',
    allowNull: false
  })
  miscamount!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'GLAMOUNT',
    allowNull: false
  })
  glamount!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'BKAMOUNT',
    allowNull: false
  })
  bkamount!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TOTAPPLAMT',
    allowNull: false
  })
  totapplamt!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TOTAPPLDSC',
    allowNull: false
  })
  totappldsc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TOTUNAPPL',
    allowNull: false
  })
  totunappl!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'PJCCOST',
    allowNull: false
  })
  pjccost!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'NOSUBDETL',
    allowNull: false
  })
  nosubdetl!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'VALUES',
    allowNull: false
  })
  values!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'PROCESSCMD',
    allowNull: false
  })
  processcmd!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXREC1',
    allowNull: false
  })
  amttaxrec1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXREC2',
    allowNull: false
  })
  amttaxrec2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXREC3',
    allowNull: false
  })
  amttaxrec3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXREC4',
    allowNull: false
  })
  amttaxrec4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXREC5',
    allowNull: false
  })
  amttaxrec5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXEXP1',
    allowNull: false
  })
  amttaxexp1!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXEXP2',
    allowNull: false
  })
  amttaxexp2!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXEXP3',
    allowNull: false
  })
  amttaxexp3!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXEXP4',
    allowNull: false
  })
  amttaxexp4!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXEXP5',
    allowNull: false
  })
  amttaxexp5!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'AMTTAXTOBE',
    allowNull: false
  })
  amttaxtobe!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXAMT1RC',
    allowNull: false
  })
  txamt1rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXAMT2RC',
    allowNull: false
  })
  txamt2rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXAMT3RC',
    allowNull: false
  })
  txamt3rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXAMT4RC',
    allowNull: false
  })
  txamt4rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXAMT5RC',
    allowNull: false
  })
  txamt5rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXTOTRC',
    allowNull: false
  })
  txtotrc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALLRC',
    allowNull: false
  })
  txallrc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP1RC',
    allowNull: false
  })
  txexp1rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP2RC',
    allowNull: false
  })
  txexp2rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP3RC',
    allowNull: false
  })
  txexp3rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP4RC',
    allowNull: false
  })
  txexp4rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP5RC',
    allowNull: false
  })
  txexp5rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC1RC',
    allowNull: false
  })
  txrec1rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC2RC',
    allowNull: false
  })
  txrec2rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC3RC',
    allowNull: false
  })
  txrec3rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC4RC',
    allowNull: false
  })
  txrec4rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC5RC',
    allowNull: false
  })
  txrec5rc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXBSE1HC',
    allowNull: false
  })
  txbse1hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXBSE2HC',
    allowNull: false
  })
  txbse2hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXBSE3HC',
    allowNull: false
  })
  txbse3hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXBSE4HC',
    allowNull: false
  })
  txbse4hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXBSE5HC',
    allowNull: false
  })
  txbse5hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC1HC',
    allowNull: false
  })
  txrec1hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC2HC',
    allowNull: false
  })
  txrec2hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC3HC',
    allowNull: false
  })
  txrec3hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC4HC',
    allowNull: false
  })
  txrec4hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXREC5HC',
    allowNull: false
  })
  txrec5hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP1HC',
    allowNull: false
  })
  txexp1hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP2HC',
    allowNull: false
  })
  txexp2hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP3HC',
    allowNull: false
  })
  txexp3hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP4HC',
    allowNull: false
  })
  txexp4hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXP5HC',
    allowNull: false
  })
  txexp5hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALLHC',
    allowNull: false
  })
  txallhc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL1HC',
    allowNull: false
  })
  txall1hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL2HC',
    allowNull: false
  })
  txall2hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL3HC',
    allowNull: false
  })
  txall3hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL4HC',
    allowNull: false
  })
  txall4hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL5HC',
    allowNull: false
  })
  txall5hc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL1TC',
    allowNull: false
  })
  txall1tc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL2TC',
    allowNull: false
  })
  txall2tc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL3TC',
    allowNull: false
  })
  txall3tc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL4TC',
    allowNull: false
  })
  txall4tc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXALL5TC',
    allowNull: false
  })
  txall5tc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXCLTC',
    allowNull: false
  })
  txexcltc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXCLHC',
    allowNull: false
  })
  txexclhc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXCLBC',
    allowNull: false
  })
  txexclbc!: number;

  @Column({
    type: DataType.DECIMAL(19, 3),
    field: 'TXEXCLMC',
    allowNull: false
  })
  txexclmc!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'REVUNIQ',
    allowNull: false
  })
  revuniq!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'NEWREVUNIQ',
    allowNull: false
  })
  newrevuniq!: number;

  @Column({
    type: DataType.STRING(10),
    field: 'RVDETAILNO',
    allowNull: false
  })
  rvdetailno!: string;
}

// Export the composite key type for queries
export type CbbtdtPrimaryKey = CbbtdtId;