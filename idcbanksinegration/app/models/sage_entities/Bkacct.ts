// models/Bkacct.ts
import { BkacctAttributes, BkacctCreationAttributes } from '@/app/lib/types';
import { Optional } from 'sequelize';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';


@Table({
  tableName: 'BKACCT',
  timestamps: false,
  underscored: false
})
export class Bkacct extends Model<BkacctAttributes, BkacctCreationAttributes> {
  @PrimaryKey
    @Column({
        type: DataType.STRING(8),
        field: 'BANK',
        allowNull: false
    })
    bank!: string;

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
        type: DataType.STRING(60),
        field: 'NAME',
        allowNull: false,
        defaultValue: ''
    })
    name!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'ADDR1',
        allowNull: false,
        defaultValue: ''
    })
    addr1!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'ADDR2',
        allowNull: false,
        defaultValue: ''
    })
    addr2!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'ADDR3',
        allowNull: false,
        defaultValue: ''
    })
    addr3!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'ADDR4',
        allowNull: false,
        defaultValue: ''
    })
    addr4!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'CITY',
        allowNull: false,
        defaultValue: ''
    })
    city!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'STATE',
        allowNull: false,
        defaultValue: ''
    })
    state!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'COUNTRY',
        allowNull: false,
        defaultValue: ''
    })
    country!: string;

  @Column({
        type: DataType.STRING(20),
        field: 'POSTAL',
        allowNull: false,
        defaultValue: ''
    })
    postal!: string;

  @Column({
        type: DataType.STRING(60),
        field: 'CONTACT',
        allowNull: false,
        defaultValue: ''
    })
    contact!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'PHONE',
        allowNull: false,
        defaultValue: ''
    })
    phone!: string;

  @Column({
        type: DataType.STRING(30),
        field: 'FAX',
        allowNull: false,
        defaultValue: ''
    })
    fax!: string;

  @Column({
        type: DataType.STRING(12),
        field: 'TRANSIT',
        allowNull: false,
        defaultValue: ''
    })
    transit!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'MULTICUR',
        allowNull: true,
        defaultValue: 0
    })
    multicur!: number;

  @Column({
        type: DataType.STRING(3),
        field: 'CURNSTMT',
        allowNull: false,
        defaultValue: ''
    })
    curnstmt!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'INACTIVE',
        allowNull: true,
        defaultValue: 0
    })
    inactive!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'INACTDATE',
        allowNull: false,
        defaultValue: 0
    })
    inactdate!: number;

  @Column({
        type: DataType.STRING(22),
        field: 'BKACCT',
        allowNull: false,
        defaultValue: ''
    })
    bkacct!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'IDACCT',
        allowNull: false,
        defaultValue: ''
    })
    idacct!: string;

  @Column({
        type: DataType.STRING(45),
        field: 'IDACCTERR',
        allowNull: false,
        defaultValue: ''
    })
    idaccterr!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'ERRSPREAD',
        allowNull: false,
        defaultValue: 0
    })
    errspread!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'LSTMNTND',
        allowNull: false,
        defaultValue: 0
    })
    lstmntnd!: number;

  @Column({
        type: DataType.STRING(4),
        field: 'RECFY',
        allowNull: false,
        defaultValue: ''
    })
    recfy!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'RECFP',
        allowNull: false,
        defaultValue: 0
    })
    recfp!: number;

  @Column({
        type: DataType.STRING(4),
        field: 'RECLSTFY',
        allowNull: false,
        defaultValue: ''
    })
    reclstfy!: string;

  @Column({
        type: DataType.SMALLINT,
        field: 'RECLSTFP',
        allowNull: false,
        defaultValue: 0
    })
    reclstfp!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RECLSTDATE',
        allowNull: false,
        defaultValue: 0
    })
    reclstdate!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECLSTBAL',
        allowNull: false,
        defaultValue: 0
    })
    reclstbal!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RECDATE',
        allowNull: false,
        defaultValue: 0
    })
    recdate!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RECSTMTDAT',
        allowNull: false,
        defaultValue: 0
    })
    recstmtdat!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECSTMTBAL',
        allowNull: false,
        defaultValue: 0
    })
    recstmtbal!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECINTRANS',
        allowNull: false,
        defaultValue: 0
    })
    recintrans!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECOUTSTND',
        allowNull: false,
        defaultValue: 0
    })
    recoutstnd!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECBKENT',
        allowNull: false,
        defaultValue: 0
    })
    recbkent!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDEPOSIT',
        allowNull: false,
        defaultValue: 0
    })
    recdeposit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECCHECK',
        allowNull: false,
        defaultValue: 0
    })
    reccheck!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECFCDEP',
        allowNull: false,
        defaultValue: 0
    })
    recfcdep!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECFCCHK',
        allowNull: false,
        defaultValue: 0
    })
    recfcchk!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECFCDEPIT',
        allowNull: false,
        defaultValue: 0
    })
    recfcdepit!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECFCCHKOS',
        allowNull: false,
        defaultValue: 0
    })
    recfcchkos!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'RECRECALC',
        allowNull: true,
        defaultValue: 0
    })
    recrecalc!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'RECLSMDATE',
        allowNull: false,
        defaultValue: 0
    })
    reclsmdate!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECFCBKENT',
        allowNull: false,
        defaultValue: 0
    })
    recfcbkent!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECFCENTRE',
        allowNull: false,
        defaultValue: 0
    })
    recfcentre!: number;

  @Column({
        type: DataType.STRING(45),
        field: 'IDACCTCCC',
        allowNull: false,
        defaultValue: ''
    })
    idacctccc!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'CCCSPREAD',
        allowNull: false,
        defaultValue: 0
    })
    cccspread!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'EXSPREAD',
        allowNull: false,
        defaultValue: 0
    })
    exspread!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTERR',
        allowNull: false,
        defaultValue: 0
    })
    recwterr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTWO',
        allowNull: false,
        defaultValue: 0
    })
    recwtwo!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTGAIN',
        allowNull: false,
        defaultValue: 0
    })
    recwtgain!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTLOSS',
        allowNull: false,
        defaultValue: 0
    })
    recwtloss!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTCCC',
        allowNull: false,
        defaultValue: 0
    })
    recwtccc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTCLR',
        allowNull: false,
        defaultValue: 0
    })
    recwtclr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWTFUNAM',
        allowNull: false,
        defaultValue: 0
    })
    recwtfunam!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPERR',
        allowNull: false,
        defaultValue: 0
    })
    recwperr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPWO',
        allowNull: false,
        defaultValue: 0
    })
    recwpwo!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPGAIN',
        allowNull: false,
        defaultValue: 0
    })
    recwpgain!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPLOSS',
        allowNull: false,
        defaultValue: 0
    })
    recwploss!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPCCC',
        allowNull: false,
        defaultValue: 0
    })
    recwpccc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPCLR',
        allowNull: false,
        defaultValue: 0
    })
    recwpclr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWPFUNAM',
        allowNull: false,
        defaultValue: 0
    })
    recwpfunam!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTERR',
        allowNull: false,
        defaultValue: 0
    })
    recdterr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTWO',
        allowNull: false,
        defaultValue: 0
    })
    recdtwo!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTGAIN',
        allowNull: false,
        defaultValue: 0
    })
    recdtgain!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTLOSS',
        allowNull: false,
        defaultValue: 0
    })
    recdtloss!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTCCC',
        allowNull: false,
        defaultValue: 0
    })
    recdtccc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTCLR',
        allowNull: false,
        defaultValue: 0
    })
    recdtclr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDTFUNAM',
        allowNull: false,
        defaultValue: 0
    })
    recdtfunam!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPERR',
        allowNull: false,
        defaultValue: 0
    })
    recdperr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPWO',
        allowNull: false,
        defaultValue: 0
    })
    recdpwo!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPGAIN',
        allowNull: false,
        defaultValue: 0
    })
    recdpgain!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPLOSS',
        allowNull: false,
        defaultValue: 0
    })
    recdploss!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPCCC',
        allowNull: false,
        defaultValue: 0
    })
    recdpccc!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPCLR',
        allowNull: false,
        defaultValue: 0
    })
    recdpclr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDPFUNAM',
        allowNull: false,
        defaultValue: 0
    })
    recdpfunam!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWFCLR',
        allowNull: false,
        defaultValue: 0
    })
    recwfclr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDFCLR',
        allowNull: false,
        defaultValue: 0
    })
    recdfclr!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'FUNWTAMT',
        allowNull: false,
        defaultValue: 0
    })
    funwtamt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'FUNWPAMT',
        allowNull: false,
        defaultValue: 0
    })
    funwpamt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'FUNDTAMT',
        allowNull: false,
        defaultValue: 0
    })
    fundtamt!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'FUNDPAMT',
        allowNull: false,
        defaultValue: 0
    })
    fundpamt!: number;

  @Column({
        type: DataType.STRING(12),
        field: 'CODETXGRP',
        allowNull: false,
        defaultValue: ''
    })
    codetxgrp!: string;

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
        type: DataType.SMALLINT,
        field: 'TXVCLSS1',
        allowNull: false,
        defaultValue: 0
    })
    txvclss1!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TXVCLSS2',
        allowNull: false,
        defaultValue: 0
    })
    txvclss2!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TXVCLSS3',
        allowNull: false,
        defaultValue: 0
    })
    txvclss3!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TXVCLSS4',
        allowNull: false,
        defaultValue: 0
    })
    txvclss4!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'TXVCLSS5',
        allowNull: false,
        defaultValue: 0
    })
    txvclss5!: number;

  @Column({
        type: DataType.SMALLINT,
        field: 'AGEPURGE',
        allowNull: false,
        defaultValue: 0
    })
    agepurge!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'POSTDATE',
        allowNull: false,
        defaultValue: 0
    })
    postdate!: number;

  @Column({
        type: DataType.DECIMAL(9, 0),
        field: 'LSTPOSTDAT',
        allowNull: false,
        defaultValue: 0
    })
    lstpostdat!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'LSTSTMTBAL',
        allowNull: false,
        defaultValue: 0
    })
    lststmtbal!: number;

  @Column({
        type: DataType.STRING(60),
        field: 'RECCOMMENT',
        allowNull: false,
        defaultValue: ''
    })
    reccomment!: string;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECWEXDIFF',
        allowNull: false,
        defaultValue: 0
    })
    recwexdiff!: number;

  @Column({
        type: DataType.DECIMAL(19, 3),
        field: 'RECDEXDIFF',
        allowNull: false,
        defaultValue: 0
    })
    recdexdiff!: number;

  @Column({
        type: DataType.BLOB,
        field: 'BCACCT',
        allowNull: true
    })
    bcacct!: Buffer | null;

  @Column({
        type: DataType.SMALLINT,
        field: 'BCCONNECT',
        allowNull: true,
        defaultValue: 0
    })
    bcconnect!: number;

  @Column({
        type: DataType.INTEGER,
        field: 'BCLSTIDX',
        allowNull: true,
        defaultValue: 0
    })
    bclstidx!: number;
}