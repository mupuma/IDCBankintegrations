// models/Arobl.ts
import { AroblAttributes, AroblCreationAttributes, AroblId } from '@/app/lib/types';
import { Optional } from 'sequelize';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';


@Table({
  tableName: 'AROBL',
  timestamps: false,
  underscored: false
})
export class Arobl extends Model<AroblAttributes, AroblCreationAttributes> {
  @PrimaryKey
    @Column({
        type: DataType.STRING(12),
        field: 'IDCUST',
        allowNull: false
    })
    idcust!: string;

  @PrimaryKey
    @Column({
        type: DataType.STRING(22),
        field: 'IDINVC',
        allowNull: false
    })
    idinvc!: string;

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
        type: DataType.STRING(24),
        field: 'IDRMIT',
        allowNull: false,
        defaultValue: ''
    })
    idrmit!: string;

  @Column({
        type: DataType.STRING(22),
        field: 'IDORDERNBR',
        allowNull: false,
        defaultValue: ''
    })
    idordernbr!: string;

  @Column({
        type: DataType.STRING(22),
        field: 'IDCUSTPO',
        allowNull: false,
        defaultValue: ''
    })
    idcustpo!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEDUE',
        allowNull: false,
        defaultValue: 0
    })
    datedue!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'IDNATACCT',
        allowNull: false,
        defaultValue: ''
    })
    idnatacct!: string;

  @Column({
        type: DataType.STRING(6),
        field: 'IDCUSTSHPT',
        allowNull: false,
        defaultValue: ''
    })
    idcustshpt!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'TRXTYPEID',
        allowNull: false,
        defaultValue: 0
    })
    trxtypeid!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TRXTYPETXT',
        allowNull: false,
        defaultValue: 0
    })
    trxtypetxt!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBTCH',
        allowNull: false,
        defaultValue: 0
    })
    datebtch!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'CNTBTCH',
        allowNull: false,
        defaultValue: 0
    })
    cntbtch!: number;

  @Column({
        type: DataType.DECIMAL(7, 0),
        field: 'CNTITEM',
        allowNull: false,
        defaultValue: 0
    })
    cntitem!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'IDGRP',
        allowNull: false,
        defaultValue: ''
    })
    idgrp!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'DESCINVC',
        allowNull: false,
        defaultValue: ''
    })
    descinvc!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEINVC',
        allowNull: false,
        defaultValue: 0
    })
    dateinvc!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEASOF',
        allowNull: false,
        defaultValue: 0
    })
    dateasof!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'CODETERM',
        allowNull: false,
        defaultValue: ''
    })
    codeterm!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEDISC',
        allowNull: false,
        defaultValue: 0
    })
    datedisc!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURN',
        allowNull: false,
        defaultValue: ''
    })
    codecurn!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'IDRATETYPE',
        allowNull: false,
        defaultValue: ''
    })
    idratetype!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRATEOVRD',
        allowNull: false,
        defaultValue: 0
    })
    swrateovrd!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'EXCHRATEHC',
        allowNull: false,
        defaultValue: 0
    })
    exchratehc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVCHC',
        allowNull: false,
        defaultValue: 0
    })
    amtinvchc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDUEHC',
        allowNull: false,
        defaultValue: 0
    })
    amtduehc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTXBLHC',
        allowNull: false,
        defaultValue: 0
    })
    amttxblhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTNONTXHC',
        allowNull: false,
        defaultValue: 0
    })
    amtnontxhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAXHC',
        allowNull: false,
        defaultValue: 0
    })
    amttaxhc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDISCHC',
        allowNull: false,
        defaultValue: 0
    })
    amtdischc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTINVCTC',
        allowNull: false,
        defaultValue: 0
    })
    amtinvctc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDUETC',
        allowNull: false,
        defaultValue: 0
    })
    amtduetc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTXBLTC',
        allowNull: false,
        defaultValue: 0
    })
    amttxbltc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTNONTXTC',
        allowNull: false,
        defaultValue: 0
    })
    amtnontxtc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAXTC',
        allowNull: false,
        defaultValue: 0
    })
    amttaxtc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDISCTC',
        allowNull: false,
        defaultValue: 0
    })
    amtdisctc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWPAID',
        allowNull: false,
        defaultValue: 0
    })
    swpaid!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELSTACT',
        allowNull: false,
        defaultValue: 0
    })
    datelstact!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELSTSTM',
        allowNull: false,
        defaultValue: 0
    })
    datelststm!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELSTDLQ',
        allowNull: false,
        defaultValue: 0
    })
    datelstdlq!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'CODEDLQSTS',
        allowNull: false,
        defaultValue: 0
    })
    codedlqsts!: number;

  @Column({
        type: DataType.DECIMAL(5, 0),
        field: 'CNTTOTPAYM',
        allowNull: false,
        defaultValue: 0
    })
    cnttotpaym!: number;

  @Column({
        type: DataType.DECIMAL(5, 0),
        field: 'CNTLSTPAID',
        allowNull: false,
        defaultValue: 0
    })
    cntlstpaid!: number;

  @Column({
        type: DataType.DECIMAL(5, 0),
        field: 'CNTLSTPYST',
        allowNull: false,
        defaultValue: 0
    })
    cntlstpyst!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTREMIT',
        allowNull: false,
        defaultValue: 0
    })
    amtremit!: number;

  @Column({
        type: DataType.DECIMAL(5, 0),
        field: 'CNTLASTSEQ',
        allowNull: false,
        defaultValue: 0
    })
    cntlastseq!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWTAXINPUT',
        allowNull: false,
        defaultValue: 0
    })
    swtaxinput!: number;

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
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE1HC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase1hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE2HC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase2hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE3HC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase3hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE4HC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase4hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE5HC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase5hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX1HC',
        allowNull: false,
        defaultValue: 0
    })
    amttax1hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX2HC',
        allowNull: false,
        defaultValue: 0
    })
    amttax2hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX3HC',
        allowNull: false,
        defaultValue: 0
    })
    amttax3hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX4HC',
        allowNull: false,
        defaultValue: 0
    })
    amttax4hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX5HC',
        allowNull: false,
        defaultValue: 0
    })
    amttax5hc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE1TC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE2TC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE3TC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE4TC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTBASE5TC',
        allowNull: false,
        defaultValue: 0
    })
    amtbase5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX1TC',
        allowNull: false,
        defaultValue: 0
    })
    amttax1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX2TC',
        allowNull: false,
        defaultValue: 0
    })
    amttax2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX3TC',
        allowNull: false,
        defaultValue: 0
    })
    amttax3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX4TC',
        allowNull: false,
        defaultValue: 0
    })
    amttax4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTTAX5TC',
        allowNull: false,
        defaultValue: 0
    })
    amttax5tc!: number;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP1',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp1!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP2',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp2!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP3',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp3!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP4',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp4!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'CODESLSP5',
        allowNull: false,
        defaultValue: ''
    })
    codeslsp5!: string;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT1',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt1!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT2',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt2!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT3',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt3!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT4',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt4!: number;

  @Column({
        type: DataType.DECIMAL(9, 5),
        field: 'PCTSASPLT5',
        allowNull: false,
        defaultValue: 0
    })
    pctsasplt5!: number;

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
        type: DataType.STRING(22),
        field: 'IDPREPAID',
        allowNull: false,
        defaultValue: ''
    })
    idprepaid!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBUS',
        allowNull: false,
        defaultValue: 0
    })
    datebus!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RATEDATE',
        allowNull: false,
        defaultValue: 0
    })
    ratedate!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RATEOP',
        allowNull: false,
        defaultValue: 0
    })
    rateop!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'YPLASTACT',
        allowNull: false,
        defaultValue: ''
    })
    yplastact!: string;

  @Column({
        type: DataType.STRING(8),
        field: 'IDBANK',
        allowNull: false,
        defaultValue: ''
    })
    idbank!: string;

  @Column({
        type: DataType.DECIMAL(15, 0),
        field: 'DEPSTNBR',
        allowNull: false,
        defaultValue: 0
    })
    depstnbr!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'POSTSEQNCE',
        allowNull: false,
        defaultValue: 0
    })
    postseqnce!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWJOB',
        allowNull: false,
        defaultValue: 0
    })
    swjob!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRTG',
        allowNull: false,
        defaultValue: 0
    })
    swrtg!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRTGOUT',
        allowNull: false,
        defaultValue: 0
    })
    swrtgout!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RTGDATEDUE',
        allowNull: false,
        defaultValue: 0
    })
    rtgdatedue!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGOAMTHC',
        allowNull: false,
        defaultValue: 0
    })
    rtgoamthc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGAMTHC',
        allowNull: false,
        defaultValue: 0
    })
    rtgamthc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGOAMTTC',
        allowNull: false,
        defaultValue: 0
    })
    rtgoamttc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RTGAMTTC',
        allowNull: false,
        defaultValue: 0
    })
    rtgamttc!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'RTGTERMS',
        allowNull: false,
        defaultValue: ''
    })
    rtgterms!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWRTGRATE',
        allowNull: false,
        defaultValue: 0
    })
    swrtgrate!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'RTGAPPLYTO',
        allowNull: false,
        defaultValue: ''
    })
    rtgapplyto!: string;

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
        type: DataType.STRING(3),
        field: 'ARVERSION',
        allowNull: false,
        defaultValue: ''
    })
    arversion!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'INVCTYPE',
        allowNull: false,
        defaultValue: 0
    })
    invctype!: number;

  @Column({
        type: DataType.BIGINT,
        field: 'DEPSEQ',
        allowNull: true,
        defaultValue: 0
    })
    depseq!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'DEPLINE',
        allowNull: true,
        defaultValue: 0
    })
    depline!: number;

  @Column({
        type: DataType.STRING(2),
        field: 'TYPEBTCH',
        allowNull: false,
        defaultValue: ''
    })
    typebtch!: string;

  @Column({
        type: DataType.INTEGER,
        field: 'CNTOBLJ',
        allowNull: true,
        defaultValue: null
    })
    cntoblj!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CODECURNRC',
        allowNull: false,
        defaultValue: ''
    })
    codecurnrc!: string;

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
        type: DataType.SMALLINT,
        field: 'SWTXRTGRPT',
        allowNull: false,
        defaultValue: 0
    })
    swtxrtgrpt!: number;

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
        type: DataType.SMALLINT,
        field: 'SWTXCTLRC',
        allowNull: false,
        defaultValue: 0
    })
    swtxctlrc!: number;

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
        field: 'TXBSERT1TC',
        allowNull: false,
        defaultValue: 0
    })
    txbsert1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSERT2TC',
        allowNull: false,
        defaultValue: 0
    })
    txbsert2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSERT3TC',
        allowNull: false,
        defaultValue: 0
    })
    txbsert3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSERT4TC',
        allowNull: false,
        defaultValue: 0
    })
    txbsert4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXBSERT5TC',
        allowNull: false,
        defaultValue: 0
    })
    txbsert5tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMTRT1TC',
        allowNull: false,
        defaultValue: 0
    })
    txamtrt1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMTRT2TC',
        allowNull: false,
        defaultValue: 0
    })
    txamtrt2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMTRT3TC',
        allowNull: false,
        defaultValue: 0
    })
    txamtrt3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMTRT4TC',
        allowNull: false,
        defaultValue: 0
    })
    txamtrt4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'TXAMTRT5TC',
        allowNull: false,
        defaultValue: 0
    })
    txamtrt5tc!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'IDSHIPNBR',
        allowNull: false,
        defaultValue: ''
    })
    idshipnbr!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEFRSTBK',
        allowNull: false,
        defaultValue: 0
    })
    datefrstbk!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATELSTRVL',
        allowNull: false,
        defaultValue: 0
    })
    datelstrvl!: number;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'ORATE',
        allowNull: false,
        defaultValue: 0
    })
    orate!: number;

  @Column({
        type: DataType.STRING(2),
        field: 'ORATETYPE',
        allowNull: false,
        defaultValue: ''
    })
    oratetype!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'ORATEDATE',
        allowNull: false,
        defaultValue: 0
    })
    oratedate!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'ORATEOP',
        allowNull: false,
        defaultValue: 0
    })
    orateop!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'OSWRATE',
        allowNull: false,
        defaultValue: 0
    })
    oswrate!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'IDACCTSET',
        allowNull: false,
        defaultValue: ''
    })
    idacctset!: string;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATEPAID',
        allowNull: false,
        defaultValue: 0
    })
    datepaid!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWNONRCVBL',
        allowNull: false,
        defaultValue: 0
    })
    swnonrcvbl!: number;

  @Column({
        type: DataType.STRING(6),
        field: 'CODETERR',
        allowNull: false,
        defaultValue: ''
    })
    codeterr!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'OAMTWHT1TC',
        allowNull: false,
        defaultValue: 0
    })
    oamtwht1tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'OAMTWHT2TC',
        allowNull: false,
        defaultValue: 0
    })
    oamtwht2tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'OAMTWHT3TC',
        allowNull: false,
        defaultValue: 0
    })
    oamtwht3tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'OAMTWHT4TC',
        allowNull: false,
        defaultValue: 0
    })
    oamtwht4tc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'OAMTWHT5TC',
        allowNull: false,
        defaultValue: 0
    })
    oamtwht5tc!: number;
}

// Export the composite key type for queries
export type AroblPrimaryKey = AroblId;