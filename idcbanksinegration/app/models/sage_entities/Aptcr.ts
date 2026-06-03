// models/Aptcr.ts
import { AptcrAttributes, AptcrCreationAttributes, AptcrId } from '@/app/lib/types';
import { Optional } from 'sequelize';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';



@Table({
  tableName: 'APTCR',
  timestamps: false,
  underscored: false
})
export class Aptcr extends Model<AptcrAttributes, AptcrCreationAttributes> {
  @PrimaryKey
    @Column({
        type: DataType.STRING(2),
        field: 'BTCHTYPE',
        allowNull: false
    })
    btchtype!: string;

  @PrimaryKey
    @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'CNTBTCH',
        allowNull: false
    })
    cntbtch!: number;

  @PrimaryKey
    @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTENTR',
        allowNull: false
    })
    cntentr!: number;

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
        type: DataType.STRING(18),
        field: 'IDRMIT',
        allowNull: false,
        defaultValue: ''
    })
    idrmit!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'IDVEND',
        allowNull: false,
        defaultValue: ''
    })
    idvend!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATERMIT',
        allowNull: false,
        defaultValue: 0
    })
    datermit!: number;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTRMIT',
        allowNull: false,
        defaultValue: ''
    })
    textrmit!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'NAMERMIT',
        allowNull: false,
        defaultValue: ''
    })
    namermit!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTRMIT',
        allowNull: false,
        defaultValue: 0
    })
    amtrmit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTRMITTC',
        allowNull: false,
        defaultValue: 0
    })
    amtrmittc!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'RATEEXCHTC',
        allowNull: false,
        defaultValue: 0
    })
    rateexchtc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRATETC',
        allowNull: false,
        defaultValue: 0
    })
    swratetc!: number;

  @Column({
        type: DataType.DECIMAL(5, 0),
        field: 'CNTPAYMENT',
        allowNull: false,
        defaultValue: 0
    })
    cntpayment!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPPAYTC',
        allowNull: false,
        defaultValue: 0
    })
    amtppaytc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDISCTC',
        allowNull: false,
        defaultValue: 0
    })
    amtdisctc!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'PAYMCODE',
        allowNull: false,
        defaultValue: ''
    })
    paymcode!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURN',
        allowNull: false,
        defaultValue: ''
    })
    codecurn!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'RATETYPEHC',
        allowNull: false,
        defaultValue: ''
    })
    ratetypehc!: string;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'RATEEXCHHC',
        allowNull: false,
        defaultValue: 0
    })
    rateexchhc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRATEHC',
        allowNull: false,
        defaultValue: 0
    })
    swratehc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RMITTYPE',
        allowNull: false,
        defaultValue: 0
    })
    rmittype!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'DOCTYPE',
        allowNull: false,
        defaultValue: 0
    })
    doctype!: number;

  @Column({
        type: DataType.DECIMAL(5, 0),
        field: 'CNTLSTLINE',
        allowNull: false,
        defaultValue: 0
    })
    cntlstline!: number;

  @Column({
        type: DataType.STRING(4),
        field: 'FISCYR',
        allowNull: false,
        defaultValue: ''
    })
    fiscyr!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'FISCPER',
        allowNull: false,
        defaultValue: ''
    })
    fiscper!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATERATETC',
        allowNull: false,
        defaultValue: 0
    })
    dateratetc!: number;

  @Column({
        type: DataType.STRING(2),
        field: 'RATETYPETC',
        allowNull: false,
        defaultValue: ''
    })
    ratetypetc!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTADJTCUR',
        allowNull: false,
        defaultValue: 0
    })
    amtadjtcur!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATERATEHC',
        allowNull: false,
        defaultValue: 0
    })
    dateratehc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'REMREAPLTC',
        allowNull: false,
        defaultValue: 0
    })
    remreapltc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ADJTOTDBHC',
        allowNull: false,
        defaultValue: 0
    })
    adjtotdbhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTRMITHC',
        allowNull: false,
        defaultValue: 0
    })
    amtrmithc!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'DOCNBR',
        allowNull: false,
        defaultValue: ''
    })
    docnbr!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'PAYMSTTS',
        allowNull: false,
        defaultValue: 0
    })
    paymstts!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPRNTRMIT',
        allowNull: false,
        defaultValue: 0
    })
    swprntrmit!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'IDRMITTO',
        allowNull: false,
        defaultValue: ''
    })
    idrmitto!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TXTRMITREF',
        allowNull: false,
        defaultValue: ''
    })
    txtrmitref!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ADJTOTCRHC',
        allowNull: false,
        defaultValue: 0
    })
    adjtotcrhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTADJHCUR',
        allowNull: false,
        defaultValue: 0
    })
    amtadjhcur!: number;

  @Column({
        type: DataType.BIGINT,
        field: 'CNTDEPSSEQ',
        allowNull: false,
        defaultValue: 0
    })
    cntdepsseq!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPRINTED',
        allowNull: false,
        defaultValue: 0
    })
    swprinted!: number;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE1',
        allowNull: false,
        defaultValue: ''
    })
    textstre1!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE2',
        allowNull: false,
        defaultValue: ''
    })
    textstre2!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE3',
        allowNull: false,
        defaultValue: ''
    })
    textstre3!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTSTRE4',
        allowNull: false,
        defaultValue: ''
    })
    textstre4!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'NAMECITY',
        allowNull: false,
        defaultValue: ''
    })
    namecity!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CODESTTE',
        allowNull: false,
        defaultValue: ''
    })
    codestte!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'CODEPSTL',
        allowNull: false,
        defaultValue: ''
    })
    codepstl!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CODECTRY',
        allowNull: false,
        defaultValue: ''
    })
    codectry!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'CHECKLANG',
        allowNull: false,
        defaultValue: ''
    })
    checklang!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'OPERBANK',
        allowNull: false,
        defaultValue: 0
    })
    operbank!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'OPERVEND',
        allowNull: false,
        defaultValue: 0
    })
    opervend!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ADJTOTDBTC',
        allowNull: false,
        defaultValue: 0
    })
    adjtotdbtc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ADJTOTCRTC',
        allowNull: false,
        defaultValue: 0
    })
    adjtotcrtc!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEACTVPP',
        allowNull: false,
        defaultValue: 0
    })
    dateactvpp!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWJOB',
        allowNull: false,
        defaultValue: 0
    })
    swjob!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'APPLYMETH',
        allowNull: false,
        defaultValue: 0
    })
    applymeth!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'ERRBATCH',
        allowNull: true,
        defaultValue: null
    })
    errbatch!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'ERRENTRY',
        allowNull: true,
        defaultValue: null
    })
    errentry!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVCMTCH',
        allowNull: false,
        defaultValue: ''
    })
    idinvcmtch!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'VALUES',
        allowNull: true,
        defaultValue: null
    })
    values!: number;

  @Column({
        type: DataType.STRING(2),
        field: 'SRCEAPPL',
        allowNull: false,
        defaultValue: ''
    })
    srceappl!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'IDBANK',
        allowNull: false,
        defaultValue: ''
    })
    idbank!: string;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURNBC',
        allowNull: false,
        defaultValue: ''
    })
    codecurnbc!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'PAYMTYPE',
        allowNull: false,
        defaultValue: 0
    })
    paymtype!: number;

  @Column({
        type: DataType.STRING(45),
        field: 'CASHACCT',
        allowNull: false,
        defaultValue: ''
    })
    cashacct!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'DRILLAPP',
        allowNull: false,
        defaultValue: ''
    })
    drillapp!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'DRILLTYPE',
        allowNull: false,
        defaultValue: 0
    })
    drilltype!: number;

  @Column({
        type: DataType.DECIMAL(19, 0),
        field: 'DRILLDWNLK',
        allowNull: false,
        defaultValue: 0
    })
    drilldwnlk!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'CODE1099',
        allowNull: false,
        defaultValue: ''
    })
    code1099!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMT1099',
        allowNull: false,
        defaultValue: 0
    })
    amt1099!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXAMTCTL',
        allowNull: false,
        defaultValue: 0
    })
    swtxamtctl!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXBSECTL',
        allowNull: false,
        defaultValue: 0
    })
    swtxbsectl!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAXGRP',
        allowNull: false,
        defaultValue: ''
    })
    codetaxgrp!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'TAXVERSION',
        allowNull: true,
        defaultValue: null
    })
    taxversion!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAX1',
        allowNull: false,
        defaultValue: ''
    })
    codetax1!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAX2',
        allowNull: false,
        defaultValue: ''
    })
    codetax2!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAX3',
        allowNull: false,
        defaultValue: ''
    })
    codetax3!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAX4',
        allowNull: false,
        defaultValue: ''
    })
    codetax4!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETAX5',
        allowNull: false,
        defaultValue: ''
    })
    codetax5!: string;

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
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE1TC',
        allowNull: false,
        defaultValue: 0
    })
    txbse1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE2TC',
        allowNull: false,
        defaultValue: 0
    })
    txbse2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE3TC',
        allowNull: false,
        defaultValue: 0
    })
    txbse3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE4TC',
        allowNull: false,
        defaultValue: 0
    })
    txbse4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSE5TC',
        allowNull: false,
        defaultValue: 0
    })
    txbse5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT1TC',
        allowNull: false,
        defaultValue: 0
    })
    txamt1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT2TC',
        allowNull: false,
        defaultValue: 0
    })
    txamt2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT3TC',
        allowNull: false,
        defaultValue: 0
    })
    txamt3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT4TC',
        allowNull: false,
        defaultValue: 0
    })
    txamt4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMT5TC',
        allowNull: false,
        defaultValue: 0
    })
    txamt5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXTOTTC',
        allowNull: false,
        defaultValue: 0
    })
    txtottc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTNETTC',
        allowNull: false,
        defaultValue: 0
    })
    amtnettc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXALLTC',
        allowNull: false,
        defaultValue: 0
    })
    txalltc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXPTC',
        allowNull: false,
        defaultValue: 0
    })
    txexptc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXRECTC',
        allowNull: false,
        defaultValue: 0
    })
    txrectc!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURNRC',
        allowNull: false,
        defaultValue: ''
    })
    codecurnrc!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTXCTLRC',
        allowNull: false,
        defaultValue: 0
    })
    swtxctlrc!: number;

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
        type: DataType.DECIMAL(9, 0),
        field: 'RATEDATERC',
        allowNull: false,
        defaultValue: 0
    })
    ratedaterc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RATEOPRC',
        allowNull: false,
        defaultValue: 0
    })
    rateoprc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRATERC',
        allowNull: false,
        defaultValue: 0
    })
    swraterc!: number;

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
        field: 'AMTPPAYHC',
        allowNull: false,
        defaultValue: 0
    })
    amtppayhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDISCHC',
        allowNull: false,
        defaultValue: 0
    })
    amtdischc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'REMREAPLHC',
        allowNull: false,
        defaultValue: 0
    })
    remreaplhc!: number;

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
        type: DataType.DECIMAL(19, 3),
        field: 'TXTOTHC',
        allowNull: false,
        defaultValue: 0
    })
    txtothc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTNETHC',
        allowNull: false,
        defaultValue: 0
    })
    amtnethc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXALLHC',
        allowNull: false,
        defaultValue: 0
    })
    txallhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXEXPHC',
        allowNull: false,
        defaultValue: 0
    })
    txexphc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXRECHC',
        allowNull: false,
        defaultValue: 0
    })
    txrechc!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'APVERSION',
        allowNull: false,
        defaultValue: ''
    })
    apversion!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'CNTACC',
        allowNull: true,
        defaultValue: 0
    })
    cntacc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTACCTC',
        allowNull: false,
        defaultValue: 0
    })
    amtacctc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTACCHC',
        allowNull: false,
        defaultValue: 0
    })
    amtacchc!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'ENTEREDBY',
        allowNull: false,
        defaultValue: ''
    })
    enteredby!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBUS',
        allowNull: false,
        defaultValue: 0
    })
    datebus!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'IDACCTSET',
        allowNull: false,
        defaultValue: ''
    })
    idacctset!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWHT1TC',
        allowNull: false,
        defaultValue: 0
    })
    amtwht1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWHT2TC',
        allowNull: false,
        defaultValue: 0
    })
    amtwht2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWHT3TC',
        allowNull: false,
        defaultValue: 0
    })
    amtwht3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWHT4TC',
        allowNull: false,
        defaultValue: 0
    })
    amtwht4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTWHT5TC',
        allowNull: false,
        defaultValue: 0
    })
    amtwht5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXBS1TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxbs1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXBS2TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxbs2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXBS3TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxbs3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXBS4TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxbs4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXBS5TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxbs5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXTX1TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxtx1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXTX2TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxtx2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXTX3TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxtx3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXTX4TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxtx4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTCXTX5TC',
        allowNull: false,
        defaultValue: 0
    })
    amtcxtx5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTGROSDST',
        allowNull: false,
        defaultValue: 0
    })
    amtgrosdst!: number;
}

// Export the composite key type for queries
export type AptcrPrimaryKey = AptcrId;