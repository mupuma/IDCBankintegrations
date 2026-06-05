// models/Cbbtm.ts
import { CbbtmCreationAttributes, CbbtmId } from '@/app/lib/types';
import { 
  Model, 
  Table, 
  Column, 
  DataType, 
  PrimaryKey 
} from 'sequelize-typescript';


@Table({
  tableName: 'CBBTMS',
  timestamps: false,
  underscored: false
})
export class Cbbtm extends Model<Cbbtm, CbbtmCreationAttributes> {
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
    type: DataType.STRING(12),
    field: 'MISCCODE',
    allowNull: false
  })
  misccode!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'NAME',
    allowNull: false
  })
  name!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'ADDRESS1',
    allowNull: false
  })
  address1!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'ADDRESS2',
    allowNull: false
  })
  address2!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'ADDRESS3',
    allowNull: false
  })
  address3!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'ADDRESS4',
    allowNull: false
  })
  address4!: string;

  @Column({
    type: DataType.STRING(20),
    field: 'POSTCODE',
    allowNull: false
  })
  postcode!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'PHONE1',
    allowNull: false
  })
  phone1!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'PHONE2',
    allowNull: false
  })
  phone2!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'FAXNUMBER',
    allowNull: false
  })
  faxnumber!: string;

  @Column({
    type: DataType.STRING(60),
    field: 'CONTACT',
    allowNull: false
  })
  contact!: string;

  @Column({
    type: DataType.STRING(120),
    field: 'COMMENTS',
    allowNull: false
  })
  comments!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWKEEPTOT',
    allowNull: false
  })
  swkeeptot!: number;

  @Column({
    type: DataType.INTEGER,
    field: 'ACCTROW',
    allowNull: false
  })
  acctrow!: number;

  @Column({
    type: DataType.STRING(50),
    field: 'ACCTNAME',
    allowNull: false
  })
  acctname!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'ACCTNO',
    allowNull: false
  })
  acctno!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'CITY',
    allowNull: false
  })
  city!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'STATE',
    allowNull: false
  })
  state!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'COUNTRY',
    allowNull: false
  })
  country!: string;

  @Column({
    type: DataType.STRING(50),
    field: 'EMAILADDR',
    allowNull: false
  })
  emailaddr!: string;

  @Column({
    type: DataType.STRING(100),
    field: 'URLADDR',
    allowNull: false
  })
  urladdr!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'SWAPPROVED',
    allowNull: false
  })
  swapproved!: number;

  @Column({
    type: DataType.STRING(50),
    field: 'EFTDESC',
    allowNull: false
  })
  eftdesc!: string;

  @Column({
    type: DataType.STRING(50),
    field: 'BANKNAME',
    allowNull: false
  })
  bankname!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'ACCOUNT',
    allowNull: false
  })
  account!: string;

  @Column({
    type: DataType.STRING(20),
    field: 'BRANCH',
    allowNull: false
  })
  branch!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'ACCTYPE',
    allowNull: false
  })
  acctype!: number;

  @Column({
    type: DataType.STRING(12),
    field: 'BANKID',
    allowNull: false
  })
  bankid!: string;

  @Column({
    type: DataType.STRING(2),
    field: 'SWIFTCTY',
    allowNull: false
  })
  swiftcty!: string;

  @Column({
    type: DataType.STRING(75),
    field: 'PAYDETL',
    allowNull: false
  })
  paydetl!: string;

  @Column({
    type: DataType.STRING(100),
    field: 'ADDINFO1',
    allowNull: false
  })
  addinfo1!: string;

  @Column({
    type: DataType.STRING(100),
    field: 'ADDINFO2',
    allowNull: false
  })
  addinfo2!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'COVERTYPE',
    allowNull: false
  })
  covertype!: number;

  @Column({
    type: DataType.STRING(75),
    field: 'COVERINFO',
    allowNull: false
  })
  coverinfo!: string;

  @Column({
    type: DataType.STRING(16),
    field: 'BENCODE',
    allowNull: false
  })
  bencode!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'EITYPE',
    allowNull: false
  })
  eitype!: number;

  @Column({
    type: DataType.STRING(3),
    field: 'BOPCATG',
    allowNull: false
  })
  bopcatg!: string;

  @Column({
    type: DataType.STRING(24),
    field: 'BOPREF',
    allowNull: false
  })
  bopref!: string;

  @Column({
    type: DataType.STRING(150),
    field: 'BOPDESC',
    allowNull: false
  })
  bopdesc!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'BRN',
    allowNull: false
  })
  brn!: string;

  @Column({
    type: DataType.STRING(30),
    field: 'IDN',
    allowNull: false
  })
  idn!: string;

  @Column({
    type: DataType.BLOB('tiny'),
    field: 'ACCOUNTENC',
    allowNull: false
  })
  accountenc!: Buffer;

  @Column({
    type: DataType.INTEGER,
    field: 'FTMISCUNIQ',
    allowNull: false
  })
  ftmiscuniq!: number;

  @Column({
    type: DataType.STRING(50),
    field: 'CONTACTEML',
    allowNull: false
  })
  contacteml!: string;

  @Column({
    type: DataType.SMALLINT,
    field: 'DELMETHOD',
    allowNull: false
  })
  delmethod!: number;

  @Column({
    type: DataType.SMALLINT,
    field: 'EMAILSENT',
    allowNull: false
  })
  emailsent!: number;
}

// Export the composite key type for queries
export type CbbtmPrimaryKey = CbbtmId;