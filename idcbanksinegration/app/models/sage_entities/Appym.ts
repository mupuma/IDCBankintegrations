// models/Appym.ts
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  BelongsTo,
  ForeignKey, 
  PrimaryKey
} from 'sequelize-typescript';
import { AppymAttributes, AppymCreationAttributes, AppymId } from '@/app/lib/types';

@Table({
  tableName: 'APPYM',
  timestamps: false, // Sage tables don't have createdAt/updatedAt
  underscored: false
})
export class Appym extends Model<AppymAttributes, AppymCreationAttributes> {
  @PrimaryKey
  @Column({
    field: 'IDBANK',
    type: DataType.STRING(8),
    allowNull: false,
  })
  idbank!: string;

  @PrimaryKey
  @Column({
    field: 'IDVEND',
    type: DataType.STRING(12),
    allowNull: false,
  })
  idvend!: string;

  @PrimaryKey
  @Column({
    field: 'IDRMIT',
    type: DataType.STRING(18),
    allowNull: false,
  })
  idrmit!: string;

  @PrimaryKey
  @Column({
    field: 'LONGSERIAL',
    type: DataType.BIGINT,
    allowNull: false,
  })
  longserial!: string;

  @PrimaryKey
  @Column({
    field: 'DATERMIT',
    type: DataType.DECIMAL(9, 0),
    allowNull: false,
  })
  datermit!: string;

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
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBATCH',
        allowNull: false,
        defaultValue: 0
    })
    datebatch!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTRMITTC',
        allowNull: false,
        defaultValue: 0
    })
    amtrmittc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTPAYM',
        allowNull: false,
        defaultValue: 0
    })
    amtpaym!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTDISC',
        allowNull: false,
        defaultValue: 0
    })
    amtdisc!: number;

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
        field: 'IDRATETYPE',
        allowNull: false,
        defaultValue: ''
    })
    idratetype!: string;

  @Column({
        type: DataType.DECIMAL(15, 7),
        field: 'RATEEXCHHC',
        allowNull: false,
        defaultValue: 0
    })
    rateexchhc!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWOVRDRATE',
        allowNull: false,
        defaultValue: 0
    })
    swovrdrate!: number;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTRETRN',
        allowNull: false,
        defaultValue: ''
    })
    textretrn!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTROUNDER',
        allowNull: false,
        defaultValue: 0
    })
    amtrounder!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATERATE',
        allowNull: false,
        defaultValue: 0
    })
    daterate!: number;

  @Column({
        type: DataType.STRING(4),
        field: 'CNTFISCYR',
        allowNull: false,
        defaultValue: ''
    })
    cntfiscyr!: string;

  @Column({
        type: DataType.STRING(2),
        field: 'CNTFISCPER',
        allowNull: false,
        defaultValue: ''
    })
    cntfiscper!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'TEXTPAYOR',
        allowNull: false,
        defaultValue: ''
    })
    textpayor!: string;

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
        type: DataType.SMALLINT,
        field: 'SWCHKCLRD',
        allowNull: false,
        defaultValue: 0
    })
    swchkclrd!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTRMITHC',
        allowNull: false,
        defaultValue: 0
    })
    amtrmithc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'AMTADJ',
        allowNull: false,
        defaultValue: 0
    })
    amtadj!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATECLRD',
        allowNull: false,
        defaultValue: 0
    })
    dateclrd!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'DATERVRSD',
        allowNull: false,
        defaultValue: 0
    })
    datervrsd!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TRXTYPETXT',
        allowNull: false,
        defaultValue: 0
    })
    trxtypetxt!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVC',
        allowNull: false,
        defaultValue: ''
    })
    idinvc!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'RATEOP',
        allowNull: false,
        defaultValue: 0
    })
    rateop!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'PAYMTYPE',
        allowNull: false,
        defaultValue: 0
    })
    paymtype!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'CUID',
        allowNull: true,
        defaultValue: null
    })
    cuid!: number;

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
        type: DataType.STRING(45),
        field: 'IDACCT',
        allowNull: false,
        defaultValue: ''
    })
    idacct!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWNONRCVBL',
        allowNull: false,
        defaultValue: 0
    })
    swnonrcvbl!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'SWJOB',
        allowNull: false,
        defaultValue: 0
    })
    swjob!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'IDINVCMTCH',
        allowNull: false,
        defaultValue: ''
    })
    idinvcmtch!: string;

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
        type: DataType.DECIMAL(9, 0),
        field: 'DATEBUS',
        allowNull: false,
        defaultValue: 0
    })
    datebus!: number;

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
}

export type AppymPrimaryKey = AppymId;