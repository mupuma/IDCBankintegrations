// models/Cbbthd.ts
import { CbbthdAttributes, CbbthdCreationAttributes } from '@/app/lib/types';
import { Optional } from 'sequelize';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';



@Table({
  tableName: 'CBBTHD',
  timestamps: false,
  underscored: false
})
export class Cbbthd extends Model<CbbthdAttributes, CbbthdCreationAttributes> {
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

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'AUDTDATE',
        allowNull: false,
        defaultValue: 0
    })
    audtdate!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'AUDTTIME',
        allowNull: false,
        defaultValue: 0
    })
    audttime!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'AUDTUSER',
        allowNull: false,
        defaultValue: ''
    })
    audtuser!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'AUDTORG',
        allowNull: false,
        defaultValue: ''
    })
    audtorg!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'ENTRYTYPE',
        allowNull: false,
        defaultValue: 0
    })
    entrytype!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'REFERENCE',
        allowNull: false,
        defaultValue: ''
    })
    reference!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'PERIOD',
        allowNull: false,
        defaultValue: ''
    })
    period!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATE',
        allowNull: false,
        defaultValue: 0
    })
    date!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATECHQPRN',
        allowNull: false,
        defaultValue: 0
    })
    datechqprn!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWCHQPRN',
        allowNull: false,
        defaultValue: 0
    })
    swchqprn!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'MISCCODE',
        allowNull: false,
        defaultValue: ''
    })
    misccode!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTDESC',
        allowNull: false,
        defaultValue: ''
    })
    textdesc!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'DISTCODE',
        allowNull: false,
        defaultValue: ''
    })
    distcode!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'CHARGECODE',
        allowNull: false,
        defaultValue: ''
    })
    chargecode!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'CHRGAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    chrgamount!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'NODETAILS',
        allowNull: false,
        defaultValue: 0
    })
    nodetails!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    totamount!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTTAX',
        allowNull: false,
        defaultValue: 0
    })
    tottax!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TAXPERCNT',
        allowNull: false,
        defaultValue: 0
    })
    taxpercnt!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'BK2GLCURHM',
        allowNull: false,
        defaultValue: ''
    })
    bk2glcurhm!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'BK2GLRTTYP',
        allowNull: false,
        defaultValue: ''
    })
    bk2glrttyp!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'BK2GLCURSR',
        allowNull: false,
        defaultValue: ''
    })
    bk2glcursr!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'BK2GLDATE',
        allowNull: false,
        defaultValue: 0
    })
    bk2gldate!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'BK2GLRATE',
        allowNull: false,
        defaultValue: 0
    })
    bk2glrate!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'BK2GLSPRD',
        allowNull: false,
        defaultValue: 0
    })
    bk2glsprd!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BK2GLOP',
        allowNull: false,
        defaultValue: 0
    })
    bk2glop!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BK2GLDTMTH',
        allowNull: false,
        defaultValue: 0
    })
    bk2gldtmth!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'BT2GLCURHM',
        allowNull: false,
        defaultValue: ''
    })
    bt2glcurhm!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'BT2GLRTTYP',
        allowNull: false,
        defaultValue: ''
    })
    bt2glrttyp!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'BT2GLCURSR',
        allowNull: false,
        defaultValue: ''
    })
    bt2glcursr!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'BT2GLDATE',
        allowNull: false,
        defaultValue: 0
    })
    bt2gldate!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'BT2GLRATE',
        allowNull: false,
        defaultValue: 0
    })
    bt2glrate!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'BT2GLSPRD',
        allowNull: false,
        defaultValue: 0
    })
    bt2glsprd!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BT2GLOP',
        allowNull: false,
        defaultValue: 0
    })
    bt2glop!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BT2GLDTMTH',
        allowNull: false,
        defaultValue: 0
    })
    bt2gldtmth!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'MS2GLCURHM',
        allowNull: false,
        defaultValue: ''
    })
    ms2glcurhm!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'MS2GLRTTYP',
        allowNull: false,
        defaultValue: ''
    })
    ms2glrttyp!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'MS2GLCURSR',
        allowNull: false,
        defaultValue: ''
    })
    ms2glcursr!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'MS2GLDATE',
        allowNull: false,
        defaultValue: 0
    })
    ms2gldate!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'MS2GLRATE',
        allowNull: false,
        defaultValue: 0
    })
    ms2glrate!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'MS2GLSPRD',
        allowNull: false,
        defaultValue: 0
    })
    ms2glsprd!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'MS2GLOP',
        allowNull: false,
        defaultValue: 0
    })
    ms2glop!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'MS2GLDTMTH',
        allowNull: false,
        defaultValue: 0
    })
    ms2gldtmth!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWCASH',
        allowNull: false,
        defaultValue: 0
    })
    swcash!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'BTCHNODEC',
        allowNull: false,
        defaultValue: 0
    })
    btchnodec!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'MISCNODEC',
        allowNull: false,
        defaultValue: 0
    })
    miscnodec!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'TAXGROUP',
        allowNull: false,
        defaultValue: ''
    })
    taxgroup!: string;

  @Column({
        type: DataType.STRING(24),
        field: 'CUSTCHQNO',
        allowNull: false,
        defaultValue: ''
    })
    custchqno!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'NOSUBDETL',
        allowNull: true,
        defaultValue: 0
    })
    nosubdetl!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'APPLAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    applamount!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'APPLDISC',
        allowNull: false,
        defaultValue: 0
    })
    appldisc!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'ACCTNAT',
        allowNull: false,
        defaultValue: ''
    })
    acctnat!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ADJAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    adjamount!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'PROFILEID',
        allowNull: false,
        defaultValue: ''
    })
    profileid!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWINTERCO',
        allowNull: false,
        defaultValue: 0
    })
    swinterco!: number;

  @Column({
        type: DataType.STRING(4),
        field: 'FISCYR',
        allowNull: false,
        defaultValue: ''
    })
    fiscyr!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'CCTYPE',
        allowNull: false,
        defaultValue: ''
    })
    cctype!: string;

  @Column({
        type: DataType.BLOB,
        field: 'CCNUMBER',
        allowNull: true
    })
    ccnumber!: Buffer | null;

  @Column({
        type: DataType.STRING(60),
        field: 'CCNAME',
        allowNull: false,
        defaultValue: ''
    })
    ccname!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'CCEXP',
        allowNull: false,
        defaultValue: 0
    })
    ccexp!: number;

  @Column({
        type: DataType.STRING(20),
        field: 'CCAUTHCODE',
        allowNull: false,
        defaultValue: ''
    })
    ccauthcode!: string;

  @Column({
        type: DataType.STRING(32),
        field: 'XCCNUMBER',
        allowNull: false,
        defaultValue: ''
    })
    xccnumber!: string;

  @Column({
        type: DataType.BIGINT,
        field: 'SERIAL',
        allowNull: false,
        defaultValue: 0
    })
    serial!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BANKAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    bankamount!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BTCHAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    btchamount!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'MISCAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    miscamount!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'FUNCAMOUNT',
        allowNull: false,
        defaultValue: 0
    })
    funcamount!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'HDRDEBIT',
        allowNull: false,
        defaultValue: 0
    })
    hdrdebit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'HDRCREDIT',
        allowNull: false,
        defaultValue: 0
    })
    hdrcredit!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'TAXAUTH1',
        allowNull: false,
        defaultValue: ''
    })
    taxauth1!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'TAXAUTH2',
        allowNull: false,
        defaultValue: ''
    })
    taxauth2!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'TAXAUTH3',
        allowNull: false,
        defaultValue: ''
    })
    taxauth3!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'TAXAUTH4',
        allowNull: false,
        defaultValue: ''
    })
    taxauth4!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'TAXAUTH5',
        allowNull: false,
        defaultValue: ''
    })
    taxauth5!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TXAU1DESC',
        allowNull: false,
        defaultValue: ''
    })
    txau1desc!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TXAU2DESC',
        allowNull: false,
        defaultValue: ''
    })
    txau2desc!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TXAU3DESC',
        allowNull: false,
        defaultValue: ''
    })
    txau3desc!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TXAU4DESC',
        allowNull: false,
        defaultValue: ''
    })
    txau4desc!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TXAU5DESC',
        allowNull: false,
        defaultValue: ''
    })
    txau5desc!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS1',
        allowNull: false,
        defaultValue: 0
    })
    taxclass1!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS2',
        allowNull: false,
        defaultValue: 0
    })
    taxclass2!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS3',
        allowNull: false,
        defaultValue: 0
    })
    taxclass3!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS4',
        allowNull: false,
        defaultValue: 0
    })
    taxclass4!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TAXCLASS5',
        allowNull: false,
        defaultValue: 0
    })
    taxclass5!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BASETAX1',
        allowNull: false,
        defaultValue: 0
    })
    basetax1!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BASETAX2',
        allowNull: false,
        defaultValue: 0
    })
    basetax2!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BASETAX3',
        allowNull: false,
        defaultValue: 0
    })
    basetax3!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BASETAX4',
        allowNull: false,
        defaultValue: 0
    })
    basetax4!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'BASETAX5',
        allowNull: false,
        defaultValue: 0
    })
    basetax5!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX1',
        allowNull: false,
        defaultValue: 0
    })
    amttax1!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX2',
        allowNull: false,
        defaultValue: 0
    })
    amttax2!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX3',
        allowNull: false,
        defaultValue: 0
    })
    amttax3!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX4',
        allowNull: false,
        defaultValue: 0
    })
    amttax4!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX5',
        allowNull: false,
        defaultValue: 0
    })
    amttax5!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTAXINCL1',
        allowNull: false,
        defaultValue: 0
    })
    swtaxincl1!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTAXINCL2',
        allowNull: false,
        defaultValue: 0
    })
    swtaxincl2!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTAXINCL3',
        allowNull: false,
        defaultValue: 0
    })
    swtaxincl3!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTAXINCL4',
        allowNull: false,
        defaultValue: 0
    })
    swtaxincl4!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTAXINCL5',
        allowNull: false,
        defaultValue: 0
    })
    swtaxincl5!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'BANKCODE',
        allowNull: false,
        defaultValue: ''
    })
    bankcode!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPOSTED',
        allowNull: false,
        defaultValue: 0
    })
    swposted!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'VALUES',
        allowNull: true,
        defaultValue: null
    })
    values!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'PROCESSCMD',
        allowNull: true,
        defaultValue: 0
    })
    processcmd!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTUNAPPL',
        allowNull: false,
        defaultValue: 0
    })
    totunappl!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTAPPLAMT',
        allowNull: false,
        defaultValue: 0
    })
    totapplamt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TOTAPPLDSC',
        allowNull: false,
        defaultValue: 0
    })
    totappldsc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'ALLOCMODE',
        allowNull: false,
        defaultValue: 0
    })
    allocmode!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ALLOCAMT',
        allowNull: false,
        defaultValue: 0
    })
    allocamt!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'CLASSTYPE',
        allowNull: false,
        defaultValue: 0
    })
    classtype!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'CLASSAXIS',
        allowNull: false,
        defaultValue: 0
    })
    classaxis!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'DATALEVEL',
        allowNull: false,
        defaultValue: 0
    })
    datalevel!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'RECXCNTER',
        allowNull: true,
        defaultValue: null
    })
    recxcnter!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'RATERC',
        allowNull: false,
        defaultValue: 0
    })
    raterc!: number;

  @Column({
        type: DataType.STRING(2),
        field: 'RATETYPERC',
        allowNull: false,
        defaultValue: ''
    })
    ratetyperc!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'RATEOPRC',
        allowNull: false,
        defaultValue: 0
    })
    rateoprc!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RATEDATERC',
        allowNull: false,
        defaultValue: 0
    })
    ratedaterc!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURNRC',
        allowNull: false,
        defaultValue: ''
    })
    codecurnrc!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT1RC',
        allowNull: false,
        defaultValue: 0
    })
    txamt1rc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT2RC',
        allowNull: false,
        defaultValue: 0
    })
    txamt2rc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT3RC',
        allowNull: false,
        defaultValue: 0
    })
    txamt3rc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT4RC',
        allowNull: false,
        defaultValue: 0
    })
    txamt4rc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT5RC',
        allowNull: false,
        defaultValue: 0
    })
    txamt5rc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXTOTRC',
        allowNull: false,
        defaultValue: 0
    })
    txtotrc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXALLRC',
        allowNull: false,
        defaultValue: 0
    })
    txallrc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXPRC',
        allowNull: false,
        defaultValue: 0
    })
    txexprc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXRECRC',
        allowNull: false,
        defaultValue: 0
    })
    txrecrc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTRECTAX',
        allowNull: false,
        defaultValue: 0
    })
    amtrectax!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTEXPTAX',
        allowNull: false,
        defaultValue: 0
    })
    amtexptax!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE1HC',
        allowNull: false,
        defaultValue: 0
    })
    txbse1hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE2HC',
        allowNull: false,
        defaultValue: 0
    })
    txbse2hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE3HC',
        allowNull: false,
        defaultValue: 0
    })
    txbse3hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE4HC',
        allowNull: false,
        defaultValue: 0
    })
    txbse4hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE5HC',
        allowNull: false,
        defaultValue: 0
    })
    txbse5hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT1HC',
        allowNull: false,
        defaultValue: 0
    })
    txamt1hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT2HC',
        allowNull: false,
        defaultValue: 0
    })
    txamt2hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT3HC',
        allowNull: false,
        defaultValue: 0
    })
    txamt3hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT4HC',
        allowNull: false,
        defaultValue: 0
    })
    txamt4hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT5HC',
        allowNull: false,
        defaultValue: 0
    })
    txamt5hc!: number;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTREC1',
        allowNull: false,
        defaultValue: ''
    })
    acctrec1!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTREC2',
        allowNull: false,
        defaultValue: ''
    })
    acctrec2!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTREC3',
        allowNull: false,
        defaultValue: ''
    })
    acctrec3!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTREC4',
        allowNull: false,
        defaultValue: ''
    })
    acctrec4!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTREC5',
        allowNull: false,
        defaultValue: ''
    })
    acctrec5!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTEXP1',
        allowNull: false,
        defaultValue: ''
    })
    acctexp1!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTEXP2',
        allowNull: false,
        defaultValue: ''
    })
    acctexp2!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTEXP3',
        allowNull: false,
        defaultValue: ''
    })
    acctexp3!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTEXP4',
        allowNull: false,
        defaultValue: ''
    })
    acctexp4!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'ACCTEXP5',
        allowNull: false,
        defaultValue: ''
    })
    acctexp5!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXCLTC',
        allowNull: false,
        defaultValue: 0
    })
    txexcltc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXCLHC',
        allowNull: false,
        defaultValue: 0
    })
    txexclhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXCLBC',
        allowNull: false,
        defaultValue: 0
    })
    txexclbc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXCLMC',
        allowNull: false,
        defaultValue: 0
    })
    txexclmc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXINCLTC',
        allowNull: false,
        defaultValue: 0
    })
    txincltc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXINCLHC',
        allowNull: false,
        defaultValue: 0
    })
    txinclhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXINCLBC',
        allowNull: false,
        defaultValue: 0
    })
    txinclbc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXINCLMC',
        allowNull: false,
        defaultValue: 0
    })
    txinclmc!: number;

  @Column({
        type: DataType.STRING(9),
        field: 'ARAPBATCH',
        allowNull: false,
        defaultValue: ''
    })
    arapbatch!: string;

  @Column({
        type: DataType.STRING(9),
        field: 'ARAPENTRY',
        allowNull: false,
        defaultValue: ''
    })
    arapentry!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWCHEQUE',
        allowNull: false,
        defaultValue: 0
    })
    swcheque!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWEFT',
        allowNull: false,
        defaultValue: 0
    })
    sweft!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RXMTCHSEQ',
        allowNull: true,
        defaultValue: null
    })
    rxmtchseq!: number;

  @Column({
        type: DataType.STRING(30),
        field: 'RXTRNSCODE',
        allowNull: false,
        defaultValue: ''
    })
    rxtrnscode!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'RXCATEGORY',
        allowNull: false,
        defaultValue: ''
    })
    rxcategory!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'REVUNIQ',
        allowNull: true,
        defaultValue: null
    })
    revuniq!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'NEWREVUNIQ',
        allowNull: true,
        defaultValue: null
    })
    newrevuniq!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'ENTEREDBY',
        allowNull: false,
        defaultValue: ''
    })
    enteredby!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'EFTSTATUS',
        allowNull: false,
        defaultValue: 0
    })
    eftstatus!: number;
}